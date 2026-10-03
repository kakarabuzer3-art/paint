/**
 * Engine integration smoke test against a minimal fake DOM.
 *
 * SSR proves the engine *constructs*; this proves it *works*: attach() sizes
 * three surfaces, the compositor flattens the layer stack, pointer input maps
 * into document coordinates, wheel zooms, and pan drags the viewport.
 *
 * A hand-written fake canvas/DOM is enough because the engine only uses a
 * small, well-defined slice of the 2D API — and keeping it dependency-free
 * preserves the runtime-dependency budget.
 *
 * Usage: npm run engine-dom
 */
import assert from 'node:assert/strict'
import process from 'node:process'

import { createEditor } from '../src/engine/core/EditorController.js'

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

/* ------------------------------------------------------------- fake DOM */

const recorded = (name) =>
  function record(...args) {
    this.calls.push([name, ...args])
  }

function makeContext() {
  const ctx = {
    calls: [],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '',
    lineJoin: '',
    lineCap: '',
    textAlign: '',
    textBaseline: '',
  }

  for (const name of [
    'save', 'restore', 'beginPath', 'closePath', 'arc', 'moveTo', 'lineTo', 'stroke', 'fill',
    'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'setLineDash', 'setTransform', 'scale',
    'translate', 'fillText', 'strokeText', 'putImageData', 'rotate', 'rect',
  ]) {
    ctx[name] = recorded(name)
  }

  // Real sub-rect read that returns a *copy*, exactly like the real API.
  // Returning a live buffer would alias every "before" snapshot onto the
  // live layer and silently disable undo.
  ctx.getImageData = function read(x, y, width, height) {
    const out = new Uint8ClampedArray(width * height * 4)
    const stride = this.__width || width

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const source = ((y + row) * stride + x + column) * 4
        const target = (row * width + column) * 4
        if (source + 3 >= this.__pixels.length) continue
        out[target] = this.__pixels[source]
        out[target + 1] = this.__pixels[source + 1]
        out[target + 2] = this.__pixels[source + 2]
        out[target + 3] = this.__pixels[source + 3]
      }
    }

    return { data: out, width, height }
  }
  // Nearest-neighbour drawImage across the fake canvases. Without this the
// snapshot canvas stays empty, so "before" images compare as changed and
// every gesture looks like a real edit.
  ctx.drawImage = function drawImage(source, ...rest) {
    this.calls.push(['drawImage', source, ...rest])

    const src = source && source.__ctx ? source.__ctx : null
    if (!src) return

    let sx = 0
    let sy = 0
    let sw = src.__width ?? source.width
    let sh = src.__height ?? source.height
    let dx
    let dy
    let dw
    let dh

    if (rest.length === 2) {
      ;[dx, dy] = rest
      dw = sw
      dh = sh
    } else if (rest.length === 4) {
      ;[dx, dy, dw, dh] = rest
    } else {
      ;[sx, sy, sw, sh, dx, dy, dw, dh] = rest
    }

    const stride = this.__width ?? this.__pixels.length / 4 / (this.__height || 1)

    for (let row = 0; row < Math.max(1, Math.round(dh)); row += 1) {
      for (let column = 0; column < Math.max(1, Math.round(dw)); column += 1) {
        const sourceX = Math.min(sw - 1, sx + Math.floor((column / dw) * sw))
        const sourceY = Math.min(sh - 1, sy + Math.floor((row / dh) * sh))
        const targetX = Math.round(dx) + column
        const targetY = Math.round(dy) + row

        const from = (sourceY * (src.__width ?? sw) + sourceX) * 4
        const to = (targetY * stride + targetX) * 4
        if (from + 3 >= src.__pixels.length || to + 3 >= this.__pixels.length) continue

        this.__pixels[to] = src.__pixels[from]
        this.__pixels[to + 1] = src.__pixels[from + 1]
        this.__pixels[to + 2] = src.__pixels[from + 2]
        this.__pixels[to + 3] = src.__pixels[from + 3]
      }
    }
  }

  ctx.putImageData = function put(imageData, x = 0, y = 0) {
    this.calls.push(['putImageData', x, y])
    // Write into the fake pixel buffer so undo/redo can actually be verified.
    const width = this.__width || imageData.width
    for (let row = 0; row < imageData.height; row += 1) {
      for (let column = 0; column < imageData.width; column += 1) {
        const source = (row * imageData.width + column) * 4
        const target = ((y + row) * width + x + column) * 4
        if (target + 3 >= this.__pixels.length) continue
        this.__pixels[target] = imageData.data[source]
        this.__pixels[target + 1] = imageData.data[source + 1]
        this.__pixels[target + 2] = imageData.data[source + 2]
        this.__pixels[target + 3] = imageData.data[source + 3]
      }
    }
  }
  ctx.__setPixels = (width, height, [r, g, b, a]) => {
    ctx.__width = width
    ctx.__height = height
    ctx.__pixels = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < ctx.__pixels.length; i += 4) {
      ctx.__pixels[i] = r
      ctx.__pixels[i + 1] = g
      ctx.__pixels[i + 2] = b
      ctx.__pixels[i + 3] = a
    }
  }
  ctx.createRadialGradient = () => ({ addColorStop() {} })
  ctx.createLinearGradient = () => ({ addColorStop() {} })
  ctx.measureText = (text) => ({ width: String(text).length * 8 })
  ctx.createPattern = () => ({})
  ctx.__pixels = new Uint8ClampedArray(4)

  return ctx
}

/** Minimal Path2D stand-in — shapes only need the call to be recorded. */
globalThis.Path2D = class Path2D {
  constructor() {
    this.ops = []
  }

  rect(...args) {
    this.ops.push(['rect', ...args])
  }

  roundRect(...args) {
    this.ops.push(['roundRect', ...args])
  }

  ellipse(...args) {
    this.ops.push(['ellipse', ...args])
  }

  moveTo(...args) {
    this.ops.push(['moveTo', ...args])
  }

  lineTo(...args) {
    this.ops.push(['lineTo', ...args])
  }
}

function makeCanvasElement() {
  const ctx = makeContext()
  return { width: 0, height: 0, style: {}, getContext: () => ctx, __ctx: ctx }
}

/** Deterministic rAF: callbacks are queued and flushed manually. */
const frameQueue = []
globalThis.requestAnimationFrame = (callback) => frameQueue.push(callback)
globalThis.cancelAnimationFrame = () => {}

function flushFrames(times = 1) {
  for (let i = 0; i < times; i += 1) {
    const queued = frameQueue.splice(0, frameQueue.length)
    queued.forEach((callback, index) => callback(16 + index))
  }
}

globalThis.document = { createElement: () => makeCanvasElement() }

globalThis.OffscreenCanvas = class {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.style = {}
    this.__ctx = makeContext()
    // Size the pixel buffer up front so drawImage/putImageData can write.
    this.__ctx.__width = width
    this.__ctx.__height = height
    this.__ctx.__pixels = new Uint8ClampedArray(Math.max(1, width * height * 4))
  }

  getContext() {
    return this.__ctx
  }
}

/* -------------------------------------------------------------- fixture */

function makeEngine({ width = 800, height = 600 } = {}) {
  const container = {
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  }

  const composite = makeCanvasElement()
  const scratch = makeCanvasElement()
  const overlay = makeCanvasElement()

  const engine = createEditor({ width, height, name: 'Test doc' })
  const cursorRef = { current: { x: 0, y: 0, inside: false, pressure: 0 } }

  engine.attach({ container, composite, scratch, overlay, cursorRef })

  return { engine, container, composite, scratch, overlay, cursorRef }
}

const pointerEvent = (overrides = {}) => ({
  pointerId: 1,
  pointerType: 'mouse',
  clientX: 100,
  clientY: 100,
  pressure: 0.5,
  buttons: 1,
  button: 0,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  getCoalescedEvents: () => [],
  ...overrides,
})

console.log('\nEngine integration (fake DOM)')

check('attach sizes all three surfaces and fits the view', () => {
  const { engine, composite, scratch, overlay } = makeEngine({ width: 1920, height: 1080 })

  assert.equal(composite.width, 1920)
  assert.equal(composite.height, 1080)
  assert.equal(scratch.width, 1920)
  // Overlay is viewport resolution (DPR is 1 in this fake).
  assert.equal(overlay.width, 1200)
  assert.equal(overlay.height, 800)

  assert.equal(engine.document.width, 1920)
  assert.ok(engine.viewport.scale > 0 && engine.viewport.scale <= 1)
})

check('compositor paints paper and every visible layer', () => {
  const { engine, composite } = makeEngine()
  flushFrames(2)

  const names = composite.__ctx.calls.map(([name]) => name)
  assert.ok(names.includes('fillRect'), 'paper fill missing')
  assert.ok(names.includes('drawImage'), 'layer blit missing')

  const blits = composite.__ctx.calls.filter(([name]) => name === 'drawImage').length
  assert.equal(blits, engine.document.layers.length)
})

check('pointer input maps into document coordinates', () => {
  const { engine, cursorRef } = makeEngine({ width: 800, height: 600 })

  // Pin an exact transform so the mapping is easy to reason about.
  engine.viewport.setDocumentSize(800, 600)
  engine.viewport.setScale(1)
  engine.viewport.offsetX = 200
  engine.viewport.offsetY = 100

  engine.pointer.onPointerMove(pointerEvent({ clientX: 300, clientY: 250 }))

  assert.equal(cursorRef.current.inside, true)
  assert.equal(round(cursorRef.current.x), 100)
  assert.equal(round(cursorRef.current.y), 150)
})

check('wheel zoom changes the scale', () => {
  const { engine } = makeEngine()
  const before = engine.viewport.scale

  engine.wheel.onWheel({ clientX: 600, clientY: 400, deltaY: -120, deltaMode: 0, preventDefault() {} })

  assert.ok(engine.viewport.scale > before, 'wheel up should zoom in')
})

check('drag panning moves the viewport', () => {
  const { engine } = makeEngine()
  engine.tools.setActive('pan')

  const before = engine.viewport.toState()

  engine.pointer.onPointerDown(pointerEvent({ clientX: 200, clientY: 200 }))
  engine.pointer.onPointerMove(pointerEvent({ clientX: 260, clientY: 230 }))

  assert.equal(round(engine.viewport.offsetX - before.offsetX), 60)
  assert.equal(round(engine.viewport.offsetY - before.offsetY), 30)
})

check('temporary pan overrides the active tool and restores it', () => {
  const { engine } = makeEngine()

  engine.tools.setActive('zoom')
  assert.equal(engine.tools.effectiveId, 'zoom')

  engine.tools.beginTemporary('pan')
  assert.equal(engine.tools.effectiveId, 'pan')

  // Choosing a tool while panning must not steal the pointer.
  engine.tools.setActive('null')
  assert.equal(engine.tools.effectiveId, 'pan')

  engine.tools.endTemporaryIfPanning()
  assert.equal(engine.tools.effectiveId, 'zoom')
})

check('resizing the document resizes the surfaces', () => {
  const { engine, composite, scratch } = makeEngine()

  engine.setDocument({ width: 640, height: 480 })

  assert.equal(engine.document.width, 640)
  assert.equal(composite.width, 640)
  assert.equal(scratch.height, 480)
})

/* --------------------------------------------------------- drawing tools */
console.log('\nDrawing tools')

/** Pin an identity transform so document coordinates equal client ones. */
const identityView = (engine, width, height) => {
  engine.viewport.setDocumentSize(width, height)
  engine.viewport.setScale(1)
  engine.viewport.offsetX = 0
  engine.viewport.offsetY = 0
}

const useColors = (engine, primary = '#ff0000', secondary = '#0000ff') => {
  engine.getColors = () => ({ primary, secondary })
}

check('brush stroke stamps onto the active layer', () => {
  const { engine } = makeEngine({ width: 200, height: 200 })
  identityView(engine, 200, 200)
  useColors(engine)

  engine.tools.setActive('brush')
  engine.getOptions = () => ({
    size: 20, hardness: 100, opacity: 100, flow: 100, spacing: 10, smoothing: 0,
  })

  const layer = engine.document.paintableLayer()
  // Real starting pixels: a stamp must be able to change something.
  layer.ensureCanvas().__ctx.__setPixels(120, 60, [255, 255, 255, 255])
  const calls = () => layer.ensureCanvas().__ctx.calls

  engine.pointer.onPointerDown(pointerEvent({ clientX: 20, clientY: 100 }))
  engine.pointer.onPointerMove(pointerEvent({ clientX: 180, clientY: 100 }))
  engine.pointer.onPointerUp(pointerEvent({ clientX: 180, clientY: 100, buttons: 0 }))

  const stamps = calls().filter(([name]) => name === 'drawImage').length
  assert.ok(stamps >= 3, `expected several stamps along the stroke, got ${stamps}`)
  assert.ok(engine.pendingCompositeRect, 'expected a pending composite band')
})

check('eraser composites with destination-out', () => {
  const { engine } = makeEngine({ width: 120, height: 120 })
  identityView(engine, 120, 120)
  useColors(engine)

  engine.tools.setActive('eraser')
  engine.getOptions = () => ({ size: 16, hardness: 100, opacity: 100, eraserMode: 'soft' })

  const layer = engine.document.paintableLayer()
  const ctx = layer.ensureCanvas().__ctx
  let sawDestinationOut = false

  const originalDrawImage = ctx.drawImage
  ctx.drawImage = function spy(...args) {
    if (this.globalCompositeOperation === 'destination-out') sawDestinationOut = true
    return originalDrawImage.apply(this, args)
  }

  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))
  engine.pointer.onPointerMove(pointerEvent({ clientX: 90, clientY: 60 }))
  engine.pointer.onPointerUp(pointerEvent({ clientX: 90, clientY: 60, buttons: 0 }))

  assert.ok(sawDestinationOut, 'eraser must composite with destination-out')
})

check('flood fill rewrites the region and reports a band', () => {
  const { engine } = makeEngine({ width: 50, height: 50 })
  identityView(engine, 50, 50)
  useColors(engine, '#ff0000')

  const layer = engine.document.paintableLayer()
  const ctx = layer.ensureCanvas().__ctx
  ctx.__setPixels(50, 50, [255, 255, 255, 255])

  engine.tools.setActive('fill')
  engine.getOptions = () => ({ tolerance: 0, contiguous: true })

  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))

  assert.ok(ctx.calls.some(([name]) => name === 'putImageData'), 'expected putImageData')
  assert.equal(ctx.__pixels[0], 255, 'red channel should be filled')
  assert.deepEqual(engine.pendingCompositeRect, { x: 0, y: 0, width: 50, height: 50 })
})

check('shape previews on scratch, then commits into the layer', () => {
  const { engine, scratch } = makeEngine({ width: 200, height: 200 })
  identityView(engine, 200, 200)
  useColors(engine)

  engine.tools.setActive('shape')
  engine.getOptions = () => ({ shapeMode: 'fill', strokeWidth: 4 })

  const layer = engine.document.paintableLayer()
  const layerCtx = layer.ensureCanvas().__ctx
  const before = layerCtx.calls.length

  engine.pointer.onPointerDown(pointerEvent({ clientX: 20, clientY: 20 }))

  // A click with no drag has zero size and must not paint a stray dot.
  assert.equal(
    scratch.__ctx.calls.filter(([name]) => name === 'fill').length,
    0,
    'a click without a drag should not paint',
  )

  engine.pointer.onPointerMove(pointerEvent({ clientX: 120, clientY: 90 }))

  const previews = scratch.__ctx.calls.filter(([name]) => name === 'fill').length
  assert.ok(
    previews >= 1,
    `expected a preview while dragging, got ${previews} — calls: ${scratch.__ctx.calls.map(([n]) => n).join(',')}`,
  )

  engine.pointer.onPointerUp(pointerEvent({ clientX: 120, clientY: 90 }))

  assert.ok(layerCtx.calls.length > before, 'expected the commit blit onto the layer')
})

check('line tool snaps to 15° increments with Shift', () => {
  const { engine, scratch } = makeEngine({ width: 200, height: 200 })
  identityView(engine, 200, 200)
  useColors(engine)

  engine.tools.setActive('line')
  engine.getOptions = () => ({ strokeWidth: 4 })

  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))
  engine.pointer.onPointerMove(pointerEvent({ clientX: 150, clientY: 80, shiftKey: true }))

  const lineTo = scratch.__ctx.calls.filter(([name]) => name === 'lineTo').pop()
  const [, x, y] = lineTo
  const angle = Math.atan2(y - 10, x - 10)
  const steps = angle / (Math.PI / 12)

  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6, `angle not snapped: ${angle}`)
})

check('eyedropper reports the composited colour', () => {
  const { engine, composite } = makeEngine({ width: 40, height: 40 })
  identityView(engine, 40, 40)
  composite.__ctx.__setPixels(40, 40, [12, 200, 90, 255])

  let picked = null
  engine.onPickColor = (hex) => {
    picked = hex
  }
  engine.getOptions = () => ({ sampleSize: 'point' })

  engine.tools.setActive('eyedropper')
  engine.pointer.onPointerDown(pointerEvent({ clientX: 5, clientY: 5 }))

  assert.equal(picked, '#0cc85a')
})

/* --------------------------------------------------- selection + history */
console.log('\nSelection + history')

check('rectangular selection builds a mask and bounds', () => {
  const { engine } = makeEngine({ width: 80, height: 80 })
  identityView(engine, 80, 80)

  engine.tools.setActive('select')
  engine.getOptions = () => ({ selectionMode: 'new' })

  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))
  engine.pointer.onPointerMove(pointerEvent({ clientX: 40, clientY: 30 }))
  engine.pointer.onPointerUp(pointerEvent({ clientX: 40, clientY: 30 }))

  assert.equal(engine.selection.isEmpty, false)
  assert.deepEqual(engine.selection.bounds, { x: 10, y: 10, width: 30, height: 20 })
  assert.equal(engine.selection.area, 30 * 20)
})

check('clicking without a drag clears the selection', () => {
  const { engine } = makeEngine({ width: 60, height: 60 })
  identityView(engine, 60, 60)
  engine.selectAll()
  assert.equal(engine.selection.isEmpty, false)

  engine.tools.setActive('select')
  engine.getOptions = () => ({ selectionMode: 'new' })
  engine.pointer.onPointerDown(pointerEvent({ clientX: 5, clientY: 5 }))
  engine.pointer.onPointerUp(pointerEvent({ clientX: 5, clientY: 5 }))

  assert.equal(engine.selection.isEmpty, true)
})

check('a fill is recorded and undo restores the pixels', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  identityView(engine, 40, 40)
  useColors(engine, '#ff0000')

  const layer = engine.document.paintableLayer()
  const ctx = layer.ensureCanvas().__ctx
  ctx.__setPixels(40, 40, [255, 255, 255, 255])

  engine.tools.setActive('fill')
  engine.getOptions = () => ({ tolerance: 0, contiguous: true })

  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))
  assert.equal(ctx.__pixels[0], 255, 'filled red')
  assert.equal(engine.history.canUndo, true)
  assert.equal(engine.history.entries().at(-1).label, 'Fill')

  engine.undo()
  assert.equal(ctx.__pixels[0], 255, 'white restored')
  assert.equal(ctx.__pixels[1], 255, 'green channel restored')
  assert.equal(engine.history.canRedo, true)

  engine.redo()
  assert.equal(ctx.__pixels[0], 255, 'red reapplied by redo')
  assert.equal(ctx.__pixels[1], 0, 'green overwritten by redo')
})

check('a no-op gesture does not create a history entry', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  identityView(engine, 40, 40)
  useColors(engine, '#ff0000')

  const layer = engine.document.paintableLayer()
  layer.ensureCanvas().__ctx.__setPixels(40, 40, [255, 0, 0, 255])

  // Filling an already-red area with red must not be recorded.
  engine.tools.setActive('fill')
  engine.getOptions = () => ({ tolerance: 0, contiguous: true })
  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 10 }))

  assert.equal(engine.history.canUndo, false, 'identical pixels must not be recorded')
})

check('brush strokes become single undoable steps', () => {
  const { engine } = makeEngine({ width: 120, height: 60 })
  identityView(engine, 120, 60)
  useColors(engine)

  // Start from real pixels, otherwise stamping zeros changes nothing.
  engine.document.paintableLayer().ensureCanvas().__ctx.__setPixels(120, 60, [255, 255, 255, 255])

  engine.tools.setActive('brush')
  engine.getOptions = () => ({
    size: 12, hardness: 100, opacity: 100, flow: 100, spacing: 10, smoothing: 0,
  })

  for (let i = 0; i < 3; i += 1) {
    engine.pointer.onPointerDown(pointerEvent({ clientX: 10 + i * 30, clientY: 20 }))
    engine.pointer.onPointerMove(pointerEvent({ clientX: 35 + i * 30, clientY: 20 }))
    engine.pointer.onPointerUp(pointerEvent({ clientX: 35 + i * 30, clientY: 20, buttons: 0 }))
  }

  assert.equal(engine.history.entries().length, 3, 'one entry per stroke')

  engine.undo()
  engine.undo()
  assert.equal(engine.history.entries().length, 1, 'two strokes undone')
})

check('deleting a selection clears pixels and is undoable', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  identityView(engine, 40, 40)

  const layer = engine.document.paintableLayer()
  const ctx = layer.ensureCanvas().__ctx
  ctx.__setPixels(40, 40, [10, 20, 30, 255])

  engine.selection.selectRect({ x: 0, y: 0, width: 10, height: 10 }, {
    mode: 'new', width: 40, height: 40,
  })

  assert.equal(engine.deleteSelection(), true)
  assert.equal(ctx.__pixels[3], 0, 'selected pixels cleared')

  engine.undo()
  assert.equal(ctx.__pixels[3], 255, 'pixels restored by undo')
})

check('copy then paste creates a new layer', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  identityView(engine, 40, 40)

  const layer = engine.document.paintableLayer()
  layer.ensureCanvas().__ctx.__setPixels(40, 40, [10, 20, 30, 255])

  engine.selection.selectRect({ x: 0, y: 0, width: 8, height: 8 }, {
    mode: 'new', width: 40, height: 40,
  })

  const before = engine.document.layers.length
  assert.equal(engine.copySelection(), true)
  assert.equal(engine.pasteClipboard({ asNewLayer: true }), true)
  assert.equal(engine.document.layers.length, before + 1)

  engine.undo()
  assert.equal(engine.document.layers.length, before, 'paste undone')
})

check('history evicts the oldest entry beyond its limit', () => {
  const { engine } = makeEngine({ width: 20, height: 20 })
  identityView(engine, 20, 20)

  const layer = engine.document.paintableLayer()
  const ctx = layer.ensureCanvas().__ctx
  ctx.__setPixels(20, 20, [255, 255, 255, 255])

  engine.tools.setActive('fill')
  engine.getOptions = () => ({ tolerance: 0, contiguous: true })

  for (let i = 0; i < engine.history.limit + 5; i += 1) {
    useColors(engine, i % 2 === 0 ? '#ff0000' : '#00ff00')
    engine.pointer.onPointerDown(pointerEvent({ clientX: 2, clientY: 2 }))
    engine.pointer.onPointerUp(pointerEvent({ clientX: 2, clientY: 2, buttons: 0 }))
  }

  assert.equal(
    engine.history.entries().length,
    engine.history.limit,
    'stack must be capped at the limit',
  )
})

/* --------------------------------------------------------------- result */
console.log('')
if (failures.length > 0) {
  console.error(`engine-dom smoke FAILED — ${passed} passed, ${failures.length} failed`)
  process.exit(1)
}
console.log(`engine-dom smoke OK — ${passed}/${passed} assertions passed`)