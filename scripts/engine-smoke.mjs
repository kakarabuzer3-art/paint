/**
 * Engine unit smoke test — the maths that must be exactly right.
 *
 * Viewport and dirtyRect are deliberately DOM-free so they can be verified in
 * plain Node. Zoom anchoring and dirty-rect unions are the two places where a
 * subtle off-by-one is invisible in a screenshot but very visible as "the
 * canvas drifts every time I zoom in".
 *
 * Usage: npm run engine
 */
import assert from 'node:assert/strict'
import process from 'node:process'

import Viewport from '../src/engine/core/Viewport.js'
import DocumentModel from '../src/engine/core/DocumentModel.js'
import { FIT_PADDING, MAX_ZOOM } from '../src/engine/core/constants.js'
import {
  createRect,
  expandRect,
  fromPoints,
  intersectRect,
  isEmptyRect,
  unionRect,
  clampRect,
} from '../src/engine/render/dirtyRect.js'

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures.push([name, error.message])
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

const round = (value) => Math.round(value * 1000) / 1000

/* ------------------------------------------------------------- viewport */
console.log('\nViewport')

check('screen ⇄ document round-trips', () => {
  const viewport = new Viewport()
  viewport.setViewSize(1000, 800)
  viewport.setDocumentSize(1920, 1080)
  viewport.setScale(2.5, 400, 300)

  const doc = viewport.screenToDoc(400, 300)
  const back = viewport.docToScreen(doc.x, doc.y)
  assert.equal(round(back.x), 400)
  assert.equal(round(back.y), 300)
})

check('fit centres the document and never exceeds 100%', () => {
  const viewport = new Viewport()
  viewport.setViewSize(1000, 800)
  viewport.setDocumentSize(1920, 1080)

  const scale = viewport.fit()
  // Width is the binding constraint here, not height.
  const expected = round(Math.min((1000 - FIT_PADDING) / 1920, (800 - FIT_PADDING) / 1080))
  assert.equal(round(scale), expected)

  const centre = viewport.docToScreen(960, 540)
  assert.equal(round(centre.x), 500)
  assert.equal(round(centre.y), 400)
})

check('fit clamps small documents to 100%', () => {
  const viewport = new Viewport()
  viewport.setViewSize(2000, 2000)
  viewport.setDocumentSize(400, 300)
  assert.equal(viewport.fit(), 1)
})

check('anchored zoom keeps the pointer on the same document pixel', () => {
  const viewport = new Viewport()
  viewport.setViewSize(1000, 800)
  viewport.setDocumentSize(1920, 1080)
  viewport.fit()

  const before = viewport.screenToDoc(250, 150)
  viewport.setScale(3, 250, 150)
  const after = viewport.screenToDoc(250, 150)

  assert.equal(round(after.x), round(before.x))
  assert.equal(round(after.y), round(before.y))
})

check('stepping walks the ladder and clamps at both ends', () => {
  const viewport = new Viewport()
  viewport.setViewSize(1000, 800)
  viewport.setDocumentSize(100, 100)

  viewport.setScale(1)
  viewport.step(1)
  assert.equal(viewport.scale, 1.5)
  viewport.step(-1)
  assert.equal(viewport.scale, 1)

  viewport.setScale(MAX_ZOOM)
  viewport.step(1)
  assert.equal(viewport.scale, MAX_ZOOM)
})

check('panBy shifts the offset without touching the scale', () => {
  const viewport = new Viewport()
  viewport.setViewSize(1000, 800)
  viewport.setDocumentSize(500, 500)
  viewport.fit()
  const scaleBefore = viewport.scale

  const before = viewport.docToScreen(0, 0)
  viewport.panBy(120, -40)
  const after = viewport.docToScreen(0, 0)

  assert.equal(viewport.scale, scaleBefore)
  assert.equal(round(after.x - before.x), 120)
  assert.equal(round(after.y - before.y), -40)
})

check('change notifications fire on zoom and pan', () => {
  const viewport = new Viewport()
  let calls = 0
  viewport.onChange = () => {
    calls += 1
  }

  viewport.setViewSize(800, 600)
  viewport.setScale(2)
  viewport.panBy(10, 10)
  assert.ok(calls >= 3, `expected >= 3 change events, saw ${calls}`)
})

check('visible doc rect is clamped to the document', () => {
  const viewport = new Viewport()
  viewport.setViewSize(400, 400)
  viewport.setDocumentSize(200, 200)
  viewport.setScale(1)
  viewport.panBy(-500, -500)

  const rect = viewport.intersectionRect()
  assert.ok(rect.x >= 0 && rect.y >= 0)
  assert.ok(rect.width <= 200 && rect.height <= 200)
})

/* ------------------------------------------------------------ dirtyRect */
console.log('\nDirty rectangles')

check('fromPoints normalises a reversed drag', () => {
  assert.deepEqual(fromPoints(100, 80, 20, 10), { x: 20, y: 10, width: 80, height: 70 })
})

check('union grows to cover both rects', () => {
  const rect = unionRect(createRect(0, 0, 10, 10), createRect(90, 40, 10, 10))
  assert.deepEqual(rect, { x: 0, y: 0, width: 100, height: 50 })
})

check('union treats a missing rect as absent', () => {
  assert.deepEqual(unionRect(null, createRect(5, 5, 5, 5)), createRect(5, 5, 5, 5))
  assert.equal(unionRect(createRect(1, 1, 1, 1), null).width, 1)
})

check('expand widens by a symmetric margin', () => {
  assert.deepEqual(expandRect(createRect(10, 10, 10, 10), 2), createRect(8, 8, 14, 14))
})

check('intersect returns null for disjoint rects', () => {
  assert.equal(intersectRect(createRect(0, 0, 5, 5), createRect(50, 50, 5, 5)), null)
  assert.deepEqual(intersectRect(createRect(0, 0, 10, 10), createRect(5, 5, 10, 10)), {
    x: 5,
    y: 5,
    width: 5,
    height: 5,
  })
})

check('clampRect drops bands fully outside the document', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 }
  assert.equal(clampRect(createRect(200, 200, 10, 10), bounds), null)
  assert.deepEqual(clampRect(createRect(90, 90, 40, 40), bounds), {
    x: 90,
    y: 90,
    width: 10,
    height: 10,
  })
})

check('empty rects are detected', () => {
  assert.equal(isEmptyRect(createRect(0, 0, 0, 10)), true)
  assert.equal(isEmptyRect(createRect(0, 0, 10, 10)), false)
})

/* -------------------------------------------------------- document model */
console.log('\nDocument model')

check('layers are stored top-first and composited bottom-first', () => {
  const model = new DocumentModel({ width: 100, height: 100 })
  model.addLayer({ name: 'Bottom', transparent: true })
  model.addLayer({ name: 'Top', transparent: true })

  // addLayer() always inserts at the top of the stack.
  assert.equal(model.layers[0].name, 'Top')
  assert.deepEqual(
    model.compositingOrder().map((layer) => layer.name),
    ['Bottom', 'Top'],
  )
})

check('the last remaining layer cannot be deleted', () => {
  const model = new DocumentModel({ width: 10, height: 10 })
  model.addLayer({ name: 'Only', transparent: true })
  assert.equal(model.removeLayer(model.layers[0].id), false)
  assert.equal(model.layers.length, 1)
})

check('removing the active layer selects another', () => {
  const model = new DocumentModel({ width: 10, height: 10 })
  const first = model.addLayer({ name: 'First', transparent: true })
  model.addLayer({ name: 'Second', transparent: true })

  model.selectLayer(first.id)
  model.removeLayer(first.id)
  assert.equal(model.activeLayerId, model.layers[0].id)
})

check('resize clamps absurd dimensions', () => {
  const model = new DocumentModel({ width: 100, height: 100 })
  model.resize(99999, -5)
  assert.equal(model.width, 8192)
  assert.equal(model.height, 1)
})

/* --------------------------------------------------------------- result */
console.log('')
if (failures.length > 0) {
  console.error(`engine smoke FAILED — ${passed} passed, ${failures.length} failed`)
  process.exit(1)
}
console.log(`engine smoke OK — ${passed}/${passed} assertions passed`)