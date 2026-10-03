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
import { EVENTS } from '../src/engine/core/constants.js'

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

/**
 * A <textarea> stand-in for the text tool.
 *
 * The text tool is the one place a tool touches the DOM — it hands editing to a
 * real textarea rather than reimplementing a caret. The stub records listeners
 * so the test can simulate typing without a browser.
 */
function makeTextArea() {
  return {
    value: '',
    style: {},
    spellcheck: true,
    focused: false,
    removed: false,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler
    },
    removeEventListener() {},
    setAttribute() {},
    focus() {
      this.focused = true
    },
    remove() {
      this.removed = true
    },
    /** Simulate the user typing. */
    type(text) {
      this.value = text
      this.listeners.input?.()
    },
    /** Simulate focus leaving the field (commits the text). */
    blur() {
      this.listeners.blur?.()
    },
  }
}

/** Every textarea the engine has created, newest last. */
const createdTextareas = []

globalThis.document = {
  createElement: (tag) => {
    if (tag === 'textarea') {
      const element = makeTextArea()
      createdTextareas.push(element)
      return element
    }
    return makeCanvasElement()
  },
  body: { appendChild() {} },
}

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

/* ----------------------------------------------------------------- layers */

console.log('\nLayers')

check('the panel snapshot is seeded from the engine, not from placeholders', () => {
  const { engine } = makeEngine({ width: 60, height: 40 })
  const snapshot = engine.layerSnapshot()

  assert.ok(Array.isArray(snapshot), 'snapshot must be an array')
  assert.equal(snapshot.length, engine.document.layers.length)
  assert.equal(
    snapshot.filter((layer) => layer.isActive).length,
    1,
    'exactly one layer is active',
  )
  // Painting lands on a middle layer by default, not the top one.
  assert.equal(snapshot[0].isActive, false, 'the top layer is not the paint target')
  assert.ok(
    snapshot.every((layer) => typeof layer.revision === 'number'),
    'every row carries a thumbnail cache key',
  )
  // The panel renders `meta` directly, so a missing field would print NaN.
  assert.ok(snapshot.every((layer) => typeof layer.meta === 'string' && layer.meta.includes('×')))
})

check('adding a layer publishes a panel-shaped snapshot', () => {
  const { engine } = makeEngine({ width: 60, height: 40 })
  const seen = []
  engine.on(EVENTS.LAYERS, (payload) => seen.push(payload))

  const before = engine.document.layers.length
  const added = engine.addLayerCommand({ name: 'Extra' })

  assert.equal(engine.document.layers.length, before + 1)
  assert.ok(seen.length > 0, 'the panel is notified')

  // Regression guard: these used to emit document.toJSON() (an object), so the
  // panel called .find() on a non-array and the whole app white-screened.
  for (const payload of seen) {
    assert.ok(Array.isArray(payload), 'every LAYERS payload is the snapshot array')
  }

  const latest = seen[seen.length - 1]
  assert.equal(latest[0].name, 'Extra', 'the new layer lands on top')
  assert.equal(latest[0].isActive, true, 'and becomes the active layer')
  assert.equal(added.visible, true, 'a new layer is visible, not an empty ghost')
})

check('pasting as a new layer also publishes a snapshot array', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  const layer = engine.document.paintableLayer()
  layer.ensureCanvas().__ctx.__setPixels(40, 40, [10, 20, 30, 255])

  engine.selection.selectRect({ x: 0, y: 0, width: 8, height: 8 }, {
    mode: 'new', width: 40, height: 40,
  })
  engine.copySelection()

  const seen = []
  engine.on(EVENTS.LAYERS, (payload) => seen.push(payload))
  engine.pasteClipboard({ asNewLayer: true })

  assert.ok(seen.length > 0, 'the panel is notified')
  assert.ok(seen.every(Array.isArray), 'paste must not publish the document JSON')
})

check('a locked or hidden layer is skipped when painting', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  const layer = engine.document.paintableLayer()

  engine.setLayerPropsCommand(layer.id, { locked: true })
  assert.notEqual(engine.document.paintableLayer()?.id, layer.id, 'locked layer is skipped')

  engine.setLayerPropsCommand(layer.id, { locked: false, visible: false })
  assert.notEqual(engine.document.paintableLayer()?.id, layer.id, 'hidden layer is skipped')
})

check('layer properties are undoable', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  const layer = engine.document.paintableLayer()

  engine.setLayerPropsCommand(layer.id, { visible: false }, 'Hide')
  assert.equal(engine.document.getLayer(layer.id).visible, false)

  engine.undo()
  assert.equal(engine.document.getLayer(layer.id).visible, true, 'undo restores visibility')

  engine.setLayerPropsCommand(layer.id, { name: 'Sky' }, 'Rename')
  assert.equal(engine.document.getLayer(layer.id).name, 'Sky')
  engine.undo()
  assert.notEqual(engine.document.getLayer(layer.id).name, 'Sky', 'undo restores the name')

  engine.setLayerPropsCommand(layer.id, { opacity: 40 })
  assert.equal(engine.document.getLayer(layer.id).opacity, 40)
  engine.undo()
  assert.equal(engine.document.getLayer(layer.id).opacity, 100)
})

check('reordering moves a layer and is undoable', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })
  const before = engine.document.layers.map((layer) => layer.name)

  // The panel is top-first, so direction -1 moves a row upward in the list.
  const second = engine.document.layers[1].id
  assert.equal(engine.moveLayerCommand(second, -1), true)
  assert.equal(engine.document.layers[0].id, second, 'the layer moved to the top')
  assert.equal(engine.moveLayerCommand(second, -1), false, 'cannot move past the top')

  engine.undo()
  assert.deepEqual(
    engine.document.layers.map((layer) => layer.name),
    before,
    'undo restores the original order',
  )
})

check('the last layer is protected, and deleting is undoable', () => {
  const { engine } = makeEngine({ width: 40, height: 40 })

  while (engine.document.layers.length > 1) {
    assert.equal(engine.deleteLayerCommand(engine.document.layers[0].id), true)
  }

  assert.equal(
    engine.deleteLayerCommand(engine.document.layers[0].id),
    false,
    'a document always keeps one layer',
  )

  engine.undo()
  assert.equal(engine.document.layers.length, 2, 'undo restores the deleted layer')
})

check('duplicating a layer copies its pixels', () => {
  const { engine } = makeEngine({ width: 30, height: 30 })
  const source = engine.document.paintableLayer()
  source.ensureCanvas().__ctx.__setPixels(30, 30, [9, 8, 7, 255])

  const copy = engine.duplicateLayerCommand(source.id)
  assert.ok(copy, 'a copy was created')
  assert.equal(copy.ensureCanvas().__ctx.__pixels[0], 9, 'the pixels came along')

  engine.undo()
  assert.equal(engine.document.layers.includes(copy), false, 'undo removes the copy')
})

check('thumbnails blit the layer and honour the cache key', () => {
  const { engine } = makeEngine({ width: 30, height: 30 })
  const layer = engine.document.paintableLayer()
  layer.ensureCanvas().__ctx.__setPixels(30, 30, [200, 30, 90, 255])

  const target = makeCanvasElement()
  target.width = 44
  target.height = 32
  target.__ctx.__setPixels(44, 32, [0, 0, 0, 0])

  assert.equal(engine.drawLayerThumbnail(layer.id, target.__ctx, 44, 32), true)
  assert.ok(target.__ctx.calls.some(([name]) => name === 'drawImage'), 'the layer was blitted')

  // The thumbnail is centred, so sample the middle rather than a corner.
  const centre = (16 * 44 + 22) * 4
  assert.equal(target.__ctx.__pixels[centre], 200, 'the thumbnail carries the layer colour')

  const before = engine.layerSnapshot().find((row) => row.id === layer.id).revision
  engine.document.getLayer(layer.id).markDirty()
  assert.ok(
    engine.layerSnapshot().find((row) => row.id === layer.id).revision > before,
    'the revision advances so the thumbnail is redrawn',
  )

  assert.equal(engine.drawLayerThumbnail('no-such-layer', target.__ctx, 44, 32), false)
})

/* ------------------------------------------------------------------- text */

console.log('\nText')

const textOptions = (extra = {}) => ({
  fontSize: 20,
  lineHeight: 120,
  letterSpacing: 0,
  fontFamily: 'sans',
  fillSource: 'primary',
  ...extra,
})

/**
 * Make `fillText` actually mark pixels.
 *
 * The default stub only records calls, so before/after would be identical and
 * the engine would (correctly) drop the commit as a no-op. Writing a pixel is
 * what makes "this gesture changed something" observable.
 */
function paintTextInto(ctx, sink = null) {
  ctx.fillText = function fillText(text, x, y) {
    sink?.push({ text, x, y, fillStyle: this.fillStyle })

    // Paint a short column *above* the baseline. The engine only compares the
    // band covered by the reported bounds, and a glyph sits between the top of
    // the line box and its baseline — never below it.
    for (let row = Math.max(0, Math.round(y) - 6); row <= Math.round(y); row += 1) {
      const px = Math.round(x)
      if (px < 0 || row < 0 || px >= this.__width || row >= this.__height) continue
      const at = (row * this.__width + px) * 4
      this.__pixels[at] = 255
      this.__pixels[at + 1] = 255
      this.__pixels[at + 2] = 255
      this.__pixels[at + 3] = 255
    }
  }
}

/** Type `text` through the real TextTool and commit it. */
function commitText(engine, text) {
  const created = createdTextareas.length
  engine.pointer.onPointerDown(pointerEvent({ clientX: 10, clientY: 20 }))

  const field = createdTextareas[created]
  assert.ok(field, 'the tool opened a text field')
  assert.equal(field.focused, true, 'the field takes focus so typing reaches it')

  field.type(text)
  // Switching tools commits, exactly as clicking away or pressing Esc does.
  engine.tools.current.onActivate()
  return field
}

check('text commits onto the active layer and is undoable', () => {
  const { engine } = makeEngine({ width: 120, height: 80 })
  identityView(engine, 120, 80)
  useColors(engine, '#ff0000', '#0000ff')
  engine.getOptions = () => textOptions()

  const layer = engine.document.paintableLayer()
  paintTextInto(layer.ensureCanvas().__ctx)

  engine.tools.setActive('text')
  const field = commitText(engine, 'Hello')

  assert.equal(field.removed, true, 'the field is torn down on commit')
  assert.equal(engine.history.entries().length, 1, 'one undoable text entry')
  assert.equal(engine.history.entries()[0].label, 'Text')

  engine.undo()
  assert.equal(engine.history.entries().length, 0, 'undo removes the entry')
})

check('an empty text entry leaves no history behind', () => {
  const { engine } = makeEngine({ width: 60, height: 60 })
  identityView(engine, 60, 60)
  engine.getOptions = () => textOptions()

  engine.tools.setActive('text')
  const field = commitText(engine, '')

  assert.equal(field.removed, true)
  assert.equal(engine.history.entries().length, 0, 'clicking without typing is a no-op')
})

check('text paints with the selected fill slot', () => {
  const { engine } = makeEngine({ width: 80, height: 60 })
  identityView(engine, 80, 60)
  useColors(engine, '#ff0000', '#0000ff')
  engine.getOptions = () => textOptions({ fillSource: 'secondary' })

  // Watch the fill style the tool actually hands to the canvas.
  const painted = []
  const layer = engine.document.paintableLayer()
  paintTextInto(layer.ensureCanvas().__ctx, painted)

  engine.tools.setActive('text')
  commitText(engine, 'Slot')

  assert.ok(painted.length > 0, 'glyphs were drawn')
  assert.ok(
    painted.every((glyph) => glyph.fillStyle === '#0000ff'),
    'the secondary slot colour was used, not the primary',
  )
})

check('letter spacing is drawn glyph by glyph and widens the bounds', () => {
  const measuredWithout = []
  const measuredWith = []

  const run = (tracking, sink) => {
    const { engine } = makeEngine({ width: 200, height: 60 })
    identityView(engine, 200, 60)
    useColors(engine)
    engine.getOptions = () => textOptions({ letterSpacing: tracking })

    const layer = engine.document.paintableLayer()
    const ctx = layer.ensureCanvas().__ctx
    const real = ctx.measureText
    ctx.measureText = (text) => {
      sink.push(text)
      return real(text)
    }
    paintTextInto(ctx)

    engine.tools.setActive('text')
    commitText(engine, 'AB')

    // The newest command carries the exact region that was written.
    return engine.history.past[engine.history.past.length - 1].rect
  }

  const tight = run(0, measuredWithout)
  const wide = run(20, measuredWith)

  assert.ok(
    measuredWithout.includes('AB'),
    'without tracking the line is measured as a single string',
  )
  assert.ok(
    measuredWith.every((text) => text.length === 1),
    'with tracking every glyph is measured on its own',
  )
  assert.ok(
    wide.width > tight.width,
    `tracking widens the committed bounds (${wide.width} > ${tight.width})`,
  )
})

check('multi-line text grows downwards by the leading', () => {
  const { engine } = makeEngine({ width: 200, height: 120 })
  identityView(engine, 200, 120)
  useColors(engine)
  engine.getOptions = () => textOptions({ fontSize: 20, lineHeight: 150 })

  const layer = engine.document.paintableLayer()
  paintTextInto(layer.ensureCanvas().__ctx)

  engine.tools.setActive('text')
  commitText(engine, 'one\ntwo\nthree')

  const rect = engine.history.past[engine.history.past.length - 1].rect
  // 20px type at 150% leading: cap height plus two 30px gaps = 80.
  assert.ok(rect.height >= 80, `bounds cover every line (got ${rect.height})`)
  assert.ok(rect.height <= 90, 'and are not wildly oversized')
})

/* --------------------------------------------------------------- result */
console.log('')
if (failures.length > 0) {
  console.error(`engine-dom smoke FAILED — ${passed} passed, ${failures.length} failed`)
  process.exit(1)
}
console.log(`engine-dom smoke OK — ${passed}/${passed} assertions passed`)