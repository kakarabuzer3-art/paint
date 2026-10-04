/**
 * Pure-logic unit tests — no DOM, no canvas.
 *
 * engine-smoke covers geometry and the document model; engine-dom-smoke covers
 * the engine against a fake canvas. Neither reaches the small pure modules that
 * everything else depends on: colour maths, the bounded history stack, and the
 * palette's fuzzy matcher. Those are exactly the places where a silently wrong
 * answer stays invisible until a user picks the wrong colour or cannot undo.
 *
 * Usage: npm run pure
 */
import assert from 'node:assert/strict'
import process from 'node:process'

import {
  clamp,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  mixHex,
  normalizeHex,
  parseColor,
  readableInkOn,
  relativeLuminance,
  rgbToHex,
  toRgbaString,
} from '../src/lib/color.js'
import HistoryStack from '../src/engine/history/HistoryStack.js'
import { MATERIALS, matchMaterial, materialsFor } from '../src/ui/data/materials.js'
import { fuzzyMatch, highlightSegments } from '../src/ui/hooks/useFuzzyMatch.js'

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

/** Minimal duck-typed command: HistoryStack only needs these four fields. */
function command(label, { memoryCost = 0 } = {}) {
  return { label, memoryCost, do: () => {}, undo: () => {} }
}

/* ------------------------------------------------------------------- colour */

check('normalizeHex accepts the shapes a user actually types', () => {
  assert.equal(normalizeHex('#abc'), '#aabbcc')
  assert.equal(normalizeHex('abc'), '#aabbcc', 'the # is optional')
  assert.equal(normalizeHex('  #AABBCC  '), '#aabbcc', 'trimmed and lower-cased')
  assert.equal(normalizeHex('#aabbccdd'), '#aabbcc', 'alpha is dropped for a swatch')
  assert.equal(normalizeHex('#12345'), null, 'five digits is not a colour')
  assert.equal(normalizeHex('rebeccapurple'), null)
  assert.equal(normalizeHex(42), null, 'non-strings are rejected, not coerced')
})

check('rgbToHex clamps rather than wrapping', () => {
  assert.equal(rgbToHex({ r: -20, g: 0, b: 300 }), '#0000ff', 'no negative or >255 channels')
  assert.equal(rgbToHex({ r: 255.6, g: 0.4, b: 0 }), '#ff0000', 'rounds to the nearest byte')
})

check('hsv places the primaries on the canonical hues', () => {
  assert.deepEqual(hexToHsv('#ff0000'), { h: 0, s: 100, v: 100 })
  assert.deepEqual(hexToHsv('#00ff00'), { h: 120, s: 100, v: 100 })
  assert.deepEqual(hexToHsv('#0000ff'), { h: 240, s: 100, v: 100 })
  assert.deepEqual(hexToHsv('#000000'), { h: 0, s: 0, v: 0 }, 'black is fully desaturated')
  assert.deepEqual(hexToHsv('#ffffff'), { h: 0, s: 0, v: 100 }, 'white has no hue')
})

check('hsv round-trips through rgb without drift', () => {
  for (const hex of ['#8b5cf6', '#0c0a15', '#f4f4f8', '#00b894', '#ffd166']) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex, `${hex} survives hex -> hsv -> hex`)
  }
})

check('hsv wraps hue instead of overflowing', () => {
  // The colour wheel is continuous: 420 degrees is 60, not a broken colour.
  assert.deepEqual(hsvToRgb({ h: 60, s: 100, v: 100 }), hsvToRgb({ h: 420, s: 100, v: 100 }))
  assert.deepEqual(hsvToRgb({ h: 0, s: 100, v: 100 }), hsvToRgb({ h: -360, s: 100, v: 100 }))
  assert.equal(hsvToHex({ h: 999, s: 50, v: 50 }), hsvToHex({ h: 279, s: 50, v: 50 }), 'modulo 360')
check('parseColor handles the CSS forms the app can receive', () => {
  assert.deepEqual(parseColor('#8b5cf6'), { r: 139, g: 92, b: 246, a: 1 })
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 })
  assert.deepEqual(parseColor('rgba(1,2,3,0.5)'), { r: 1, g: 2, b: 3, a: 0.5 })
  assert.deepEqual(parseColor('rgb(1 2 3 / 50%)'), { r: 1, g: 2, b: 3, a: 0.5 }, 'modern syntax')
  assert.deepEqual(parseColor('rgb(999, 5, 3)'), { r: 255, g: 5, b: 3, a: 1 }, 'channels are clamped')
  assert.equal(parseColor('rgba(0,0,0,5)').a, 1, 'alpha cannot exceed 1')
  assert.equal(parseColor('rgb(-5, 2, 3)'), null, 'a negative channel is invalid CSS, not a clamp job')
  assert.equal(parseColor('not a colour'), null)
  assert.equal(parseColor(undefined), null)
})

check('luminance and ink contrast pick the readable option', () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0)
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1)
  assert.equal(readableInkOn('#ffffff'), '#000000', 'dark ink on a light swatch')
  assert.equal(readableInkOn('#000000'), '#ffffff', 'light ink on a dark swatch')
  assert.equal(readableInkOn('#8b5cf6'), '#ffffff', 'violet reads as dark')
})

check('mixHex interpolates and clamps its ratio', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000', 't=0 is the first colour')
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff', 't=1 is the second')
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(mixHex('#000000', '#ffffff', 5), '#ffffff', 'ratios past 1 clamp')
  assert.equal(mixHex('#000000', '#ffffff', -1), '#000000', 'ratios below 0 clamp')
})

check('toRgbaString produces a canvas-usable value', () => {
  assert.equal(toRgbaString('#8b5cf6', 0.5), 'rgba(139, 92, 246, 0.5)')
  assert.equal(toRgbaString('#000000', 9), 'rgba(0, 0, 0, 1)', 'alpha clamps to 1')
  assert.equal(clamp(5, 0, 3), 3)
})

/* ------------------------------------------------------------------ history */

check('undo and redo walk the stack and report emptiness honestly', () => {
  const stack = new HistoryStack()
  assert.equal(stack.canUndo, false)
  assert.equal(stack.undo(), null, 'undoing nothing returns null, not undefined')
  assert.equal(stack.redo(), null)

  const first = command('Stroke')
  const second = command('Add layer')
  stack.push(first)
  stack.push(second)

  assert.equal(stack.canUndo, true)
  assert.equal(stack.undo(), second)
  assert.equal(stack.canRedo, true)
  assert.equal(stack.redo(), second, 'redo re-applies the same command object')
  assert.equal(stack.canRedo, false)
})

check('a new action discards the redo branch', () => {
  const stack = new HistoryStack()
  stack.push(command('One'))
  stack.push(command('Two'))
  stack.undo()
  assert.equal(stack.canRedo, true)

  stack.push(command('Three'))
  assert.equal(stack.canRedo, false, 'the abandoned branch is gone, standard editor behaviour')
  assert.equal(stack.past.length, 2)
})

check('the step limit evicts the oldest command', () => {
  const stack = new HistoryStack({ limit: 3 })
  for (const label of ['a', 'b', 'c', 'd']) stack.push(command(label))

  assert.equal(stack.past.length, 3)
  assert.deepEqual(stack.entries().map((entry) => entry.label), ['b', 'c', 'd'])
})

check('the memory budget evicts independently of the step limit', () => {
  // Four 300MB steps must not survive a 1GB budget just because they are under
  // the 60-step limit. This is the case that protects a 4K layer from
  // exhausting the tab.
  const stack = new HistoryStack({ limit: 60, memoryBudget: 1000 })
  for (const label of ['a', 'b', 'c', 'd']) stack.push(command(label, { memoryCost: 300 }))

  assert.equal(stack.past.length, 3, 'one was evicted to fit the budget')
  assert.deepEqual(stack.entries().map((entry) => entry.label), ['b', 'c', 'd'])
  assert.equal(stack.memoryUsed, 900)
})

check('a single oversized command is dropped rather than retained', () => {
  const stack = new HistoryStack({ limit: 60, memoryBudget: 100 })
  stack.push(command('huge', { memoryCost: 9999 }))

  // Keeping it would defeat the budget entirely, so an unaffordable step is
  // discarded instead of silently blowing the cap.
  assert.equal(stack.past.length, 0)
  assert.equal(stack.canUndo, false)
})

check('jumpTo scrubs to an exact depth in both directions', () => {
  const stack = new HistoryStack()
  for (const label of ['a', 'b', 'c']) stack.push(command(label))

  stack.jumpTo(1)
  assert.equal(stack.past.length, 1)
  stack.jumpTo(3)
  assert.equal(stack.past.length, 3)
  stack.jumpTo(0)
  assert.equal(stack.past.length, 0)
  stack.jumpTo(99)
  assert.equal(stack.past.length, 3, 'clamped rather than throwing')
})

check('clear empties both branches and notifies', () => {
  const seen = []
  const stack = new HistoryStack()
  stack.onChange = (entry) => seen.push(entry?.label ?? null)
  stack.push(command('a'))
  stack.undo()
  stack.clear()

  assert.equal(stack.canUndo, false)
  assert.equal(stack.canRedo, false)
  assert.deepEqual(seen, ['a', 'a', null], 'push, undo, then the null clear signal')
})

/* ------------------------------------------------------------ fuzzy matching */

check('fuzzyMatch prefers contiguous matches over scattered ones', () => {
  // "car" appears literally in one and only as a subsequence in the other.
  const literal = fuzzyMatch('car', 'red car')
  const scattered = fuzzyMatch('car', 'copper arrow')
  assert.ok(literal && scattered, 'both are reachable, so the scores are comparable')
  assert.ok(literal.score > scattered.score, 'contiguity wins')
})

check('fuzzyMatch rejects a query the target cannot satisfy', () => {
  assert.equal(fuzzyMatch('zzz', 'Add a new layer'), null)
  assert.equal(fuzzyMatch('', 'anything').score, 0, 'an empty query matches everything')
  assert.deepEqual(fuzzyMatch('', 'anything').indices, [])
})

check('fuzzyMatch is case insensitive and reports highlight positions', () => {
  const match = fuzzyMatch('LAYER', 'Add a new Layer')
  assert.ok(match)
  assert.equal(match.indices.length, 5)
  // Indices must address the original casing, or highlighting lands on the
  // wrong letters entirely.
  assert.equal('Add a new Layer'[match.indices[0]], 'L')
})

check('highlightSegments splits a label into hit and miss runs', () => {
  assert.deepEqual(highlightSegments('Add layer', [4, 5, 6, 7, 8]), [
    { text: 'Add ', hit: false },
    { text: 'layer', hit: true },
  ])
  assert.deepEqual(highlightSegments('Add layer', []), [{ text: 'Add layer', hit: false }])
  assert.deepEqual(highlightSegments('Add layer', null), [{ text: 'Add layer', hit: false }])
})

/**
 * Materials must be internally consistent, or they become traps.
 *
 * The most important rule: a material may only set options its tool actually
 * exposes. Writing `{ hardness: 60 }` on a Pencil — which has no hardness
 * control — produces a switch that silently does nothing while looking
 * perfectly real. Nothing else in the app would catch it.
 */
const TOOL_OPTIONS = {
  brush: ['size', 'hardness', 'opacity', 'flow', 'spacing', 'smoothing', 'pressure', 'blendMode'],
  pencil: ['size', 'opacity', 'smoothing', 'blendMode'],
  eraser: ['size', 'hardness', 'opacity', 'eraserMode'],
}

/** Colour must never be set by a material — that is the user's decision. */
const FORBIDDEN = new Set(['color', 'primary', 'secondary'])

for (const [toolId, list] of Object.entries(MATERIALS)) {
  const allowed = new Set(TOOL_OPTIONS[toolId] ?? [])

  for (const material of list) {
    for (const key of Object.keys(material.options)) {
      assert.ok(allowed.has(key), `${toolId}/${material.id} sets "${key}", which ${toolId} does not expose`)
      assert.ok(!FORBIDDEN.has(key), `${toolId}/${material.id} must not set "${key}"`)
    }
    assert.ok(material.label && material.hint, `${toolId}/${material.id} needs a name and a hint`)
    assert.ok(Number.isFinite(material.options.size), `${toolId}/${material.id} needs a size`)
  }

  assert.equal(
    new Set(list.map((m) => m.id)).size,
    list.length,
    `${toolId} material ids must be unique`,
  )
}

check('every material only sets options its tool actually exposes', () => {})

check('tools with no materials return an empty list, never undefined', () => {
  assert.deepEqual(materialsFor('shape'), [])
  assert.deepEqual(materialsFor('nonexistent'), [])
  assert.ok(materialsFor('brush').length > 0)
})

check('the first brush material is a forgiving all-rounder', () => {
  // Choice architecture: whatever is listed first is what most people will
  // paint with, so it should be the one least likely to ruin a first attempt.
  const first = materialsFor('brush')[0]
  assert.ok(first.options.opacity >= 90, 'fully opaque, so strokes are visible immediately')
  assert.ok(first.options.hardness >= 60, 'a defined edge, not a smudge')
})

check('matchMaterial identifies the material currently held', () => {
  const marker = materialsFor('brush')[0]
  assert.equal(matchMaterial('brush', { ...marker.options, opacity: 55 })?.id, marker.id,
    'a nudged flow does not lose the selection')
  assert.equal(matchMaterial('brush', { size: 999, hardness: 1 }), null,
    'an unlisted brush shows as custom rather than lying')
  assert.equal(matchMaterial('shape', { size: 18 }), null)
})

/* ------------------------------------------------------------------- result */
console.log('')
if (failures.length > 0) {
  console.error(`pure smoke FAILED — ${passed} passed, ${failures.length} failed`)
  process.exit(1)
}
console.log(`pure smoke OK — ${passed}/${passed} assertions passed`)
})