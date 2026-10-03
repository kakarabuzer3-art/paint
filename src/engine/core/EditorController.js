import EventBus from './EventBus.js'
import Viewport from './Viewport.js'
import DocumentModel from './DocumentModel.js'
import RenderScheduler from './RenderScheduler.js'
import Compositor from '../render/Compositor.js'
import ScratchRenderer from '../render/ScratchRenderer.js'
import OverlayRenderer from '../render/OverlayRenderer.js'
import { createRect, intersectRect, unionRect } from '../render/dirtyRect.js'
import { getDpr, sizeDocumentSurface, sizeScreenSurface } from '../render/CanvasFactory.js'
import { createPixelCanvas } from './pixelCanvas.js'
import SelectionManager from '../selection/SelectionManager.js'
import { clearSelection, extractSelection, stampSelection } from '../selection/ops.js'
import HistoryStack from '../history/HistoryStack.js'
import { command } from '../history/Command.js'
import {
  AddLayerCommand,
  DeleteLayerCommand,
  DocResizeCommand,
  LayerPropsCommand,
  PixelPatchCommand,
} from '../history/commands.js'
import Layer from './Layer.js'
import ToolManager from '../tools/ToolManager.js'
import PanTool from '../tools/PanTool.js'
import ZoomTool from '../tools/ZoomTool.js'
import BrushTool from '../tools/BrushTool.js'
import PencilTool from '../tools/PencilTool.js'
import EraserTool from '../tools/EraserTool.js'
import FillTool from '../tools/FillTool.js'
import EyedropperTool from '../tools/EyedropperTool.js'
import ShapeTool from '../tools/ShapeTool.js'
import EllipseTool from '../tools/EllipseTool.js'
import LineTool from '../tools/LineTool.js'
import TextTool from '../tools/TextTool.js'
import SelectTool from '../tools/SelectTool.js'
import LassoTool from '../tools/LassoTool.js'
import MagicWandTool from '../tools/MagicWandTool.js'
import MoveTool from '../tools/MoveTool.js'
import TransformTool from '../tools/TransformTool.js'
import PointerRouter from '../input/PointerRouter.js'
import WheelRouter from '../input/WheelRouter.js'
import { EVENTS } from './constants.js'
import {
  canvasToBlob,
  decodeImageBlob,
  exportFilename,
  getFormat,
} from '../io/codec.js'
import { buildLayers, parseProject, serializeProject } from '../io/project.js'

/** Factory so the UI layer can create an engine without importing the class. */
export function createEditor(options) {
  return new EditorController(options)
}

/**
 * Byte-identical pixel buffers?
 * Used to drop no-op patches (an accidental click, a zero-length drag) so the
 * history never fills with entries that did nothing.
 */
function samePixels(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return false
  const left = a.data
  const right = b.data
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false
  return true
}

/** Copy a subset of properties (used to snapshot layer state for undo). */
const pick = (source, keys) =>
  keys.reduce((acc, key) => {
    acc[key] = source[key]
    return acc
  }, {})

/**
 * The engine's public face.
 *
 * Everything above this line (React) talks to the controller; everything below
 * (document, viewport, renderers, tools, routers) stays private to the engine.
 * That boundary is what keeps pixels out of React state.
 *
 * Construction is DOM-free on purpose: the UI provider instantiates the engine
 * during render, and that must also work in a plain Node process (unit tests,
 * SSR smoke). Canvases and listeners only exist after `attach()`.
 */
export default class EditorController {
  constructor({ width = 1920, height = 1080, name = 'Untitled artwork', paper = '#ffffff' } = {}) {
    this.bus = new EventBus()
    this.viewport = new Viewport()
    this.document = new DocumentModel({ width, height, name, paper })

    this.surfaces = null
    this.compositor = null
    this.scratch = null
    this.overlay = null
    this.scheduler = null
    this.container = null
    this.cursorRef = { current: { x: 0, y: 0, inside: false, pressure: 0 } }
    this.cursorPreview = () => ({ radius: 0, show: false, crosshair: true })
    this.zoomDirection = 'in'

    // Injected by the UI layer — the engine never imports UI state. Tools read
    // these on every stroke, so they must be cheap property reads.
    this.getOptions = () => ({})
    this.getColors = () => ({ primary: '#000000', secondary: '#ffffff' })
    this.notice = () => {}
    this.onPickColor = () => {}

    // Pending composite work: either a full repaint or an accumulated band.
    this.pendingCompositeRect = null
    this.pendingFullComposite = false

    this.viewport.onChange = () => this.#onViewportChange()
    this.document.onStructureChange = () => {
      this.invalidateComposite()
      this.#emit(EVENTS.LAYERS, this.layerSnapshot())
    }

    this.tools = new ToolManager(this)
    this.tools
      .register(PanTool)
      .register(ZoomTool)
      .register(BrushTool)
      .register(PencilTool)
      .register(EraserTool)
      .register(FillTool)
      .register(EyedropperTool)
      .register(ShapeTool)
      .register(EllipseTool)
      .register(LineTool)
      .register(TextTool)
      .register(SelectTool)
      .register(LassoTool)
      .register(MagicWandTool)
      .register(MoveTool)
      .register(TransformTool)

    // Selection + history are engine state, not UI state.
    this.selection = new SelectionManager()
    this.selection.onChange = () => this.#emitSelection()

    this.history = new HistoryStack({ limit: 60, memoryBudget: 192 * 1024 * 1024 })
    this.history.onChange = (command) => {
      // Undo/redo rewrites pixels outside the commit path, so the revision is
      // bumped here as well — otherwise thumbnails go stale after a rewind.
      if (command?.layerId) this.document.getLayer(command.layerId)?.markDirty()
      this.invalidateComposite(command?.rect ?? null)
      this.#emit(EVENTS.HISTORY, this.historySnapshot())
    }

    /** @type {?{ payload: object, anchorX: number, anchorY: number }} */
    this.clipboard = null

    this.pointer = new PointerRouter(this)
    this.wheel = new WheelRouter(this)
  }

  /**
   * A small starter stack so compositing is visible immediately: a paper
   * layer, a light "paint" layer, and a transparent annotations layer. Phase 5
   * replaces this with user-driven layers.
   *
   * Seeded during `attach()` rather than construction because filling a layer
   * allocates real pixels — the engine must stay constructible in Node (unit
   * tests, SSR) where there is no canvas implementation.
   */
  #seedLayers(paper) {
    this.document.layers.length = 0

    // Top-first, matching the inspector panel.
    this.document.addLayer({ name: 'Annotations', transparent: true })
    const paint = this.document.addLayer({ name: 'Paint', fill: '#eef0f9' })
    this.document.addLayer({ name: 'Background', fill: paper })

    // Painting lands on the middle layer rather than on the paper.
    this.document.selectLayer(paint.id)
  }

  /* ------------------------------------------------------------- lifecycle */

  /**
   * Mounts the three DOM surfaces and the input listeners.
   * @param {{ composite: HTMLCanvasElement, scratch: HTMLCanvasElement, overlay: HTMLCanvasElement, container: HTMLElement }} refs
   */
  attach({ composite, scratch, overlay, container, cursorRef }) {
    this.detach()

    // Seed the layer stack once we are in a browser and can allocate pixels.
    this.#seedLayers(this.document.paper)

    this.surfaces = {
      // The composite always paints opaque paper first, so it opts out of
      // alpha (a real per-frame saving when blitting many layers).
      composite: { canvas: composite, ctx: composite.getContext('2d', { alpha: false }) },
      scratch: { canvas: scratch, ctx: scratch.getContext('2d') },
      overlay: { canvas: overlay, ctx: overlay.getContext('2d') },
    }

    this.container = container
    this.cursorRef = cursorRef ?? this.cursorRef

    this.compositor = new Compositor(this.surfaces.composite)
    this.scratch = new ScratchRenderer(this.surfaces.scratch)
    this.overlay = new OverlayRenderer(this.surfaces.overlay)

    this.scheduler = new RenderScheduler({
      composite: () => this.#drawComposite(),
      scratch: () => this.#drawScratch(),
      overlay: () => this.#drawOverlay(),
    })

    this.viewport.onChange = () => this.#onViewportChange()
    this.document.onStructureChange = () => {
      this.invalidateComposite()
      this.#emit(EVENTS.LAYERS, this.layerSnapshot())
    }

    // Overlay must size to its own container, not the document.
    const rect = container.getBoundingClientRect()
    this.viewport.setViewSize(rect.width, rect.height)
    this.viewport.fit()
    sizeDocumentSurface(this.surfaces.composite, this.document.width, this.document.height)
    sizeDocumentSurface(this.surfaces.scratch, this.document.width, this.document.height)
    sizeScreenSurface(this.surfaces.overlay, rect.width, rect.height, getDpr())

    this.pointer.attach(container)
    this.wheel.attach(container)

    this.invalidateAll()
    this.#emit(EVENTS.DOCUMENT, this.document.toJSON())
    this.#emit(EVENTS.TOOL, this.tools.effectiveId)
  }

  detach() {
    this.pointer.detach()
    this.wheel.detach()
    this.scheduler?.dispose()
    this.scheduler = null
    this.compositor = null
    this.scratch = null
    this.overlay = null
    this.surfaces = null
    this.container = null
  }

  /* --------------------------------------------------------------- helpers */

  getContainerRect() {
    return this.container?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 }
  }

  setCursor(cursor) {
    if (this.container) this.container.style.cursor = cursor ?? 'default'
  }

  /**
 * Colour under a document point, sampled from the *composited* result.
 * `sampleSize` averages a 3×3 or 5×5 window, which is what makes the
 * eyedropper useful on anti-aliased edges and gradients.
 *
 * @returns {?{ r: number, g: number, b: number, a: number }}
 */
  sampleDocumentColor(x, y, sampleSize = 'point') {
    const ctx = this.surfaces?.composite?.ctx
    if (!ctx) return null

    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= this.document.width || py >= this.document.height) return null

    const radius = sampleSize === 'avg5' ? 2 : sampleSize === 'avg3' ? 1 : 0
    const left = Math.max(0, px - radius)
    const top = Math.max(0, py - radius)
    const width = Math.min(this.document.width - left, radius * 2 + 1)
    const height = Math.min(this.document.height - top, radius * 2 + 1)

    const data = ctx.getImageData(left, top, width, height).data
    if (radius === 0) return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 }

    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      a += data[i + 3]
    }

    const count = data.length / 4
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
      a: a / count / 255,
    }
  }

  /** Supplied by the UI so the zoom tool honours the options-bar toggle. */
  getZoomDirection() {
    return this.zoomDirection === 'out' ? -1 : 1
  }

  /* ------------------------------------------------------- document + view */

  setDocument({ name, width, height } = {}) {
    if (name !== undefined) this.document.name = name

    if (width !== undefined || height !== undefined) {
      this.document.resize(width ?? this.document.width, height ?? this.document.height)
      this.viewport.setDocumentSize(this.document.width, this.document.height)

      if (this.surfaces) {
        sizeDocumentSurface(this.surfaces.composite, this.document.width, this.document.height)
        sizeDocumentSurface(this.surfaces.scratch, this.document.width, this.document.height)
      }
    }

    this.invalidateAll()
    this.#emit(EVENTS.DOCUMENT, this.document.toJSON())
  }

  setContainerSize(width, height) {
    if (!this.container) return
    this.viewport.setViewSize(width, height)
    if (this.surfaces) sizeScreenSurface(this.surfaces.overlay, width, height, getDpr())
    this.invalidateOverlay()
  }

  fitToScreen() {
    this.viewport.fit()
  }

  /* --------------------------------------------------------- invalidation */

  /**
   * @param {?object} rect partial band to repaint; omit for a full repaint.
   *   Bands accumulate, so a fast stroke that dirties three areas in one frame
   *   still results in a single composite pass.
   */
  invalidateComposite(rect = null) {
    if (rect) this.pendingCompositeRect = unionRect(this.pendingCompositeRect, rect)
    else this.pendingFullComposite = true

    this.scheduler?.requestComposite()
    this.scheduler?.requestOverlay()
  }

  /** Alias used by tools: "these document pixels changed". */
  requestComposite(rect) {
    this.invalidateComposite(rect)
  }

  requestScratch(rect = null) {
    this.scratch?.markDirty(rect)
    this.scheduler?.requestScratch()
  }

  invalidateOverlay() {
    this.scheduler?.requestOverlay()
  }

  invalidateAll() {
    this.scheduler?.requestAll()
  }

  /* ------------------------------------------------------- pointer bridge */

  #trackPointer(payload) {
    const target = this.cursorRef.current
    target.x = payload.docX
    target.y = payload.docY
    target.pressure = payload.pressure ?? 0
    target.inside = true
  }

  /**
   * Clear the previous scratch band *before* a tool draws.
   *
   * Done synchronously rather than in the render loop so a preview can never
   * flicker or lag a frame behind the pointer.
   */
  #beginScratchFrame() {
    if (!this.scratch) return
    const previous = this.scratch.consumeDirty()
    if (previous) this.scratch.clear(previous)
  }

  #updatePointerUi(payload) {
    this.#trackPointer(payload)
    this.overlay?.setPointer(payload.screenX, payload.screenY)
    this.overlay?.setBrushPreview(this.cursorPreview())
  }

  onPointerDown(payload) {
    this.#beginScratchFrame()
    this.#updatePointerUi(payload)
    this.tools.current.onPointerDown(payload)
    this.invalidateOverlay()
  }

  onPointerMove(payload) {
    this.#beginScratchFrame()
    this.#updatePointerUi(payload)
    this.tools.current.onPointerMove(payload)
    this.invalidateOverlay()
  }

  onPointerUp(payload) {
    this.#beginScratchFrame()
    this.#updatePointerUi(payload)
    this.tools.current.onPointerUp(payload)
    this.invalidateOverlay()
  }

  onPointerCancel(payload) {
    this.tools.current.onPointerCancel(payload)
    this.invalidateOverlay()
  }

  onPointerHover(payload) {
    this.#updatePointerUi(payload)
    this.tools.current.onHover(payload)
    this.invalidateOverlay()
  }

  onPointerLeave() {
    this.cursorRef.current.inside = false
    this.overlay?.clearPointer()
    this.invalidateOverlay()
  }

  /* ---------------------------------------------------------------- drawing */

  #drawComposite() {
    const rect = this.pendingFullComposite ? null : this.pendingCompositeRect
    this.pendingFullComposite = false
    this.pendingCompositeRect = null

    this.compositor?.render(this.document, { rect })
  }

  /**
   * Phase 2 has no previews, so the scratch surface is only drained here.
   * Phase 3 replaces this with the live stroke/shape preview renderer; the
   * clear-then-draw ordering is already handled by #beginScratchFrame.
   */
  #drawScratch() {
    this.scratch?.consumeDirty()
  }

  #drawOverlay() {
    this.overlay?.render(this.viewport)
  }

  /* -------------------------------------------------------- history + patches */

  historySnapshot() {
    return {
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      entries: this.history.entries(),
    }
  }

  undo() {
    return this.history.undo()
  }

  redo() {
    return this.history.redo()
  }

  jumpHistory(index) {
    this.history.jumpTo(index)
  }

  /**
   * Snapshot a band before an in-flight gesture edits it.
   * @returns {{ layer: Layer, rect: object, before: ImageData }}
   */
  beginPixelPatch(layer, rect) {
    const band = {
      x: Math.floor(rect.x),
      y: Math.floor(rect.y),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    }
    const before = layer.context.getImageData(band.x, band.y, band.width, band.height)
    return { layer, rect: band, before }
  }

  /** Close a patch into a history entry (no-op when nothing changed). */
  commitPixelPatch(patch, { label = 'Edit' } = {}) {
    const after = patch.layer.context.getImageData(
      patch.rect.x,
      patch.rect.y,
      patch.rect.width,
      patch.rect.height,
    )

    if (samePixels(patch.before, after)) {
      this.invalidateComposite(patch.rect)
      return patch
    }

    this.history.push(
      new PixelPatchCommand(this.document, patch.layer, patch.rect, patch.before, after, label),
    )
    this.#refreshLayerPanel(patch.layer)
    return patch
  }

  /** Roll back an abandoned gesture without leaving a history entry. */
  abandonPixelPatch(patch) {
    patch.layer.context.putImageData(patch.before, patch.rect.x, patch.rect.y)
    this.invalidateComposite(patch.rect)
    this.#refreshLayerPanel(patch.layer)
  }

  /**
   * Begin a patch whose final band is not known yet — strokes, shapes and
   * drags.
   *
   * Instead of holding a full ImageData of the visible region (megabytes per
   * gesture), a transient canvas snapshots the layer once at gesture start.
   * On commit only the band that actually changed is read back, so history
   * memory stays proportional to the edit, not the viewport.
   */
  beginRegionPatch(layer) {
    const visible = this.viewport.intersectionRect()
    const rect = createRect(
      0,
      0,
      layer.width,
      layer.height,
    )

    if (visible && visible.width > 0 && visible.height > 0) {
      const x = Math.max(0, Math.floor(visible.x))
      const y = Math.max(0, Math.floor(visible.y))
      rect.width = Math.min(layer.width, Math.ceil(visible.x + visible.width)) - x
      rect.height = Math.min(layer.height, Math.ceil(visible.y + visible.height)) - y
      rect.x = x
      rect.y = y
    }

    const canvas = createPixelCanvas(rect.width, rect.height)
    canvas
      .getContext('2d')
      .drawImage(
        layer.ensureCanvas(),
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height,
      )

    return { layer, rect, canvas }
  }

  /**
   * Close a region patch, keeping only the band that changed.
   * @param {?object} dirty union of everything the gesture touched
   */
  commitRegionPatch(patch, dirty, label = 'Edit') {
    const band = intersectRect(dirty ?? patch.rect, patch.rect)
    if (!band) return

    const before = patch.canvas
      .getContext('2d')
      .getImageData(band.x - patch.rect.x, band.y - patch.rect.y, band.width, band.height)

    const after = patch.layer.context.getImageData(band.x, band.y, band.width, band.height)

    // A gesture that changed nothing (a stray click) must not fill history.
    if (!samePixels(before, after)) {
      this.history.push(new PixelPatchCommand(this.document, patch.layer, band, before, after, label))
    }

    this.invalidateComposite(band)
    this.#refreshLayerPanel(patch.layer)
  }

  /** Undo an in-flight gesture from the snapshot, recording nothing. */
  abandonRegionPatch(patch, dirty) {
    const band = intersectRect(dirty ?? patch.rect, patch.rect)
    if (!band) return

    patch.layer.context.putImageData(
      patch.canvas
        .getContext('2d')
        .getImageData(band.x - patch.rect.x, band.y - patch.rect.y, band.width, band.height),
      band.x,
      band.y,
    )
    this.invalidateComposite(band)
    this.#refreshLayerPanel(patch.layer)
  }

  /* -------------------------------------------------------------- structure */

  /**
   * Structural commands are *executed first, then recorded*: `push()` only
   * stores the command, it never runs it. Undo reverses the recorded command,
   * redo re-applies it — so the document must already be in its "after" state.
   */
  addLayerCommand(options = {}, label = 'Add layer') {
    const layer = new Layer({ width: this.document.width, height: this.document.height, ...options })
    if (!options.fill && options.transparent !== true) layer.fillAll('#f4f4f8')

    this.document.insertLayer(layer, 0)
    this.history.push(new AddLayerCommand(this.document, layer, 0, label))
    this.document.selectLayer(layer.id)
    // No explicit emit: insertLayer/selectLayer fire onStructureChange, which
    // publishes the panel snapshot. Emitting here would ship the wrong shape.
    return layer
  }

  deleteLayerCommand(id, label = 'Delete layer') {
    const layer = this.document.getLayer(id)
    if (!layer || this.document.layers.length <= 1) return false

    const index = this.document.indexOf(id)
    const fallback = this.document.layers[index + 1] ?? this.document.layers[index - 1]

    this.document.removeLayer(id)
    this.history.push(new DeleteLayerCommand(this.document, layer, index, label))

    if (fallback) this.document.selectLayer(fallback.id)
    return true
  }

  duplicateLayerCommand(id, label = 'Duplicate layer') {
    const copy = this.document.duplicateLayer(id)
    if (!copy) return null

    // duplicateLayer() already inserted it; record so undo can remove it.
    this.history.push(
      new AddLayerCommand(this.document, copy, this.document.indexOf(copy.id), label),
    )
    return copy
  }

  /** @param {1|-1} direction */
  moveLayerCommand(id, direction, label = 'Reorder layer') {
    const from = this.document.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= this.document.layers.length) return false

    const swap = (a, b) => {
      const layers = this.document.layers
      const [moved] = layers.splice(a, 1)
      layers.splice(b, 0, moved)
      this.document.onStructureChange?.()
    }

    swap(from, to)
    this.history.push(
      command({
        label,
        kind: 'structure',
        doAction: () => swap(from, to),
        undoAction: () => swap(to, from),
      }),
    )
    return true
  }

  setLayerPropsCommand(id, patch, label = 'Layer settings') {
    const layer = this.document.getLayer(id)
    if (!layer) return false

    const before = pick(layer, ['name', 'visible', 'locked', 'opacity', 'blendMode'])
    const after = { ...before, ...patch }

    this.document.setLayerProps(id, after)
    this.history.push(new LayerPropsCommand(this.document, id, before, after, label))
    return true
  }

  /* -------------------------------------------------------------- selection */

  selectAll() {
    this.selection.selectAll(this.document.width, this.document.height)
  }

  deselect() {
    this.selection.clear()
  }

  invertSelection() {
    if (this.selection.isEmpty) this.selectAll()
    else this.selection.invert()
  }

  deleteSelection() {
    if (this.selection.isEmpty) {
      this.notice?.('Nothing to delete', 'Make a selection first.')
      return false
    }

    const layer = this.document.paintableLayer()
    if (!layer) return false

    const patch = this.beginPixelPatch(layer, this.selection.bounds)
    clearSelection(layer, this.selection)
    this.commitPixelPatch(patch, { label: 'Delete selection' })
    return true
  }

  /* -------------------------------------------------------------- clipboard */

  copySelection({ cut = false } = {}) {
    if (this.selection.isEmpty) {
      this.notice?.('Nothing to copy', 'Make a selection first.')
      return false
    }

    const layer = this.document.paintableLayer()
    if (!layer) return false

    const payload = extractSelection(layer, this.selection)
    if (!payload) return false

    this.clipboard = { payload, anchorX: payload.rect.x, anchorY: payload.rect.y }

    if (cut) {
      const patch = this.beginPixelPatch(layer, payload.rect)
      clearSelection(layer, this.selection)
      this.commitPixelPatch(patch, { label: 'Cut' })
      this.selection.clear()
    }

    return true
  }

  pasteClipboard({ asNewLayer = true } = {}) {
    if (!this.clipboard) {
      this.notice?.('Clipboard is empty', 'Copy a selection first.')
      return false
    }

    const { payload } = this.clipboard
    // Paste over the selection if there is one, otherwise at the source spot.
    const target = this.selection.bounds ?? {
      x: this.clipboard.anchorX,
      y: this.clipboard.anchorY,
      width: payload.width,
      height: payload.height,
    }

    if (asNewLayer) {
      const layer = new Layer({
        width: this.document.width,
        height: this.document.height,
        name: 'Pasted selection',
        transparent: true,
      })
      layer.ensureCanvas()
      stampSelection(layer, payload, 0, 0)

      // Execute, then record — see addLayerCommand().
      this.document.insertLayer(layer, 0)
      this.history.push(new AddLayerCommand(this.document, layer, 0, 'Paste'))
      this.document.selectLayer(layer.id)
      this.invalidateComposite(target)
      return true
    }

    const layer = this.document.paintableLayer()
    if (!layer) return false

    const band = unionRect(target, { x: target.x, y: target.y, width: payload.width, height: payload.height })
    const patch = this.beginPixelPatch(layer, band)
    stampSelection(layer, payload, target.x, target.y)
    this.commitPixelPatch(patch, { label: 'Paste' })
    return true
  }

  /** Layer metadata for the UI panel (never the pixels). */
  layerSnapshot() {
    return this.document.layers.map((layer, index) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      index,
      meta: `${layer.width} × ${layer.height}`,
      revision: layer.revision,
      isActive: layer.id === this.document.activeLayerId,
    }))
  }

  /**
   * Blit a layer's pixels into a small target context, fitted and centred.
   *
   * The panel renders *real* thumbnails rather than colour-coded placeholders:
   * people pick layers by eye, so the picture has to be the actual content.
   * The UI owns the destination canvas, so this stays a pure blit — no
   * allocation and no data URLs crossing the engine boundary.
   *
   * @returns {boolean} false when the layer no longer exists
   */
  drawLayerThumbnail(layerId, ctx, width, height) {
    const layer = this.document.getLayer(layerId)
    if (!layer || !ctx) return false

    // Fit the whole layer inside the box, preserving aspect ratio.
    const scale = Math.min(width / layer.width, height / layer.height)
    const drawWidth = Math.max(1, Math.floor(layer.width * scale))
    const drawHeight = Math.max(1, Math.floor(layer.height * scale))

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(
      layer.ensureCanvas(),
      0,
      0,
      layer.width,
      layer.height,
      Math.floor((width - drawWidth) / 2),
      Math.floor((height - drawHeight) / 2),
      drawWidth,
      drawHeight,
    )
    return true
  }

  /**
   * Publish a pixel change to the layer panel.
   *
   * Bumping the revision invalidates that layer's cached thumbnail; the LAYERS
   * event is what makes the panel redraw it. Fired once per *gesture* on
   * commit — never per frame, so a stroke cannot re-render React.
   */
  #refreshLayerPanel(layer) {
    if (!layer) return
    layer.markDirty()
    this.#emit(EVENTS.LAYERS, this.layerSnapshot())
  }

  /* --------------------------------------------------------------- file I/O */

  /**
   * Flatten the visible stack into a detached canvas, ready for encoding.
   *
   * Deliberately *not* the on-screen composite surface: export must not depend
   * on what happens to be painted right now, must not include the overlay, and
   * has to work at 1× while the user happens to be zoomed to 8×.
   *
   * @param {{ scale?: number, transparent?: boolean }} [options]
   */
  renderExportCanvas({ scale = 1, transparent = false } = {}) {
    const width = Math.max(1, Math.round(this.document.width * scale))
    const height = Math.max(1, Math.round(this.document.height * scale))

    const canvas = createPixelCanvas(width, height)
    const ctx = canvas.getContext('2d')

    if (!transparent) {
      // Paper colour as the base, then the stack flattened on top.
      ctx.fillStyle = this.document.paper
      ctx.fillRect(0, 0, width, height)
    }

    // Composite at document resolution and scale *afterwards*: upscaling first
    // would let blend modes sample neighbouring pixels and fringe the edges.
    const flattened = createPixelCanvas(this.document.width, this.document.height)
    new Compositor({ ctx: flattened.getContext('2d') }).render(this.document, { paper: false })
    ctx.drawImage(flattened, 0, 0, width, height)

    return canvas
  }

  /**
   * Encode the flattened document.
   *
   * @param {{ format?: string, quality?: number, scale?: number, transparent?: boolean }} options
   * @returns {Promise<{ blob: Blob, filename: string, format: object }>}
   */
  async exportImage({ format, quality, scale = 1, transparent = false } = {}) {
    const spec = getFormat(format)

    // JPEG has no alpha channel, so the paper is always kept there — otherwise
    // every transparent pixel exports as black.
    const useTransparency = spec.supportsAlpha ? transparent : false
    const canvas = this.renderExportCanvas({ scale, transparent: useTransparency })
    const blob = await canvasToBlob(canvas, { format, quality })

    return {
      blob,
      format: spec,
      filename: exportFilename(this.document.name, { format, scale }),
    }
  }

  /**
   * Place a decoded image on the canvas as a new layer.
   *
   * @param {{ source: CanvasImageSource, width: number, height: number }} image
   * @param {{ name?: string, fit?: boolean }} [options] `fit` scales an oversized
   *   image down to the document instead of clipping it at 100%.
   */
  importImage(image, { name = 'Image', fit = true } = {}) {
    const scale = fit
      ? Math.min(1, this.document.width / image.width, this.document.height / image.height)
      : 1
    const drawWidth = Math.max(1, Math.round(image.width * scale))
    const drawHeight = Math.max(1, Math.round(image.height * scale))

    const layer = new Layer({
      name,
      width: this.document.width,
      height: this.document.height,
      transparent: true,
    })
    layer.ensureCanvas().getContext('2d').drawImage(
      image.source,
      Math.round((this.document.width - drawWidth) / 2),
      Math.round((this.document.height - drawHeight) / 2),
      drawWidth,
      drawHeight,
    )

    // Execute, then record — see addLayerCommand().
    this.document.insertLayer(layer, 0)
    this.history.push(new AddLayerCommand(this.document, layer, 0, 'Import image'))
    this.document.selectLayer(layer.id)
    this.invalidateComposite()
    return layer
  }

  /** Decode a File/Blob and place it on the canvas as a new layer. */
  async importImageFile(file, options = {}) {
    const image = await decodeImageBlob(file)
    const name = options.name ?? (file?.name ? file.name.replace(/\.[^.]+$/, '') : 'Image')
    return this.importImage(image, { ...options, name })
  }

  /**
   * Open an image *as the document* rather than as a layer.
   *
   * The image becomes the new document size and its sole layer. History is
   * cleared because undoing back into the previous document would be nonsense.
   */
  async openImageAsDocument(image, { name = 'Untitled artwork' } = {}) {
    const resized = this.document.resize(image.width, image.height)
    this.document.name = name
    if (resized) this.viewport.setDocumentSize(this.document.width, this.document.height)

    const layer = this.document.resetLayers({ name: 'Background', transparent: true })
    layer.ensureCanvas().getContext('2d').drawImage(image.source, 0, 0, image.width, image.height)
    layer.markDirty()

    if (this.surfaces) {
      sizeDocumentSurface(this.surfaces.composite, this.document.width, this.document.height)
      sizeDocumentSurface(this.surfaces.scratch, this.document.width, this.document.height)
    }

    this.history.clear()
    this.invalidateAll()
    this.#emit(EVENTS.DOCUMENT, this.document.toJSON())
    return layer
  }

  /** Decode a File/Blob and open it as a new document. */
  async openImageFile(file) {
    const image = await decodeImageBlob(file)
    const name = file?.name ? file.name.replace(/\.[^.]+$/, '') : 'Untitled artwork'
    return this.openImageAsDocument(image, { name })
  }

  /** The document as a plain, serialisable object (the `.aurora` payload). */
  snapshotProject() {
    return serializeProject(this.document)
  }

  /**
   * Replace the document from a parsed project.
   *
   * Every layer is decoded *before* the current document is touched, so a
   * corrupt file leaves the user's work intact rather than half-replaced.
   */
  async loadProject(raw) {
    const project = parseProject(raw)
    const layers = await buildLayers(project)

    // Nothing below this point can fail, so the swap itself is safe.
    this.document.resize(project.width, project.height)
    this.document.name = project.name
    this.document.setPaper(project.paper)

    for (const layer of this.document.layers) layer.dispose()
    this.document.layers.length = 0
    this.document.activeLayerId = null

    for (const layer of layers) this.document.insertLayer(layer, this.document.layers.length)
    this.document.selectLayer(layers[project.activeIndex]?.id ?? layers[0].id)

    this.viewport.setDocumentSize(this.document.width, this.document.height)
    if (this.surfaces) {
      sizeDocumentSurface(this.surfaces.composite, this.document.width, this.document.height)
      sizeDocumentSurface(this.surfaces.scratch, this.document.width, this.document.height)
    }

    this.history.clear()
    this.invalidateAll()
    this.#emit(EVENTS.DOCUMENT, this.document.toJSON())
    return this.document
  }

  /** Composited pixels, document resolution (magic wand, import, export). */
  getCompositeImageData() {
    const ctx = this.surfaces?.composite?.ctx
    if (!ctx) return null
    return ctx.getImageData(0, 0, this.document.width, this.document.height)
  }

  /** Called by selection tools after committing a mask. */
  onSelectionChange() {
    this.#emitSelection()
  }

  #emitSelection() {
    const bounds = this.selection.bounds

    // Only the transform tool owns handles; other tools must not show them.
    this.overlay?.setHandles(this.tools.effectiveId === 'transform' ? bounds : null)

    this.#emit(EVENTS.SELECTION, {
      isEmpty: this.selection.isEmpty,
      bounds,
      area: bounds ? bounds.width * bounds.height : 0,
    })
    this.invalidateOverlay()
  }

  /* ----------------------------------------------------------------- events */

  on(event, handler) {
    return this.bus.on(event, handler)
  }

  onToolChange(id) {
    this.#emit(EVENTS.TOOL, id)
  }

  #onViewportChange() {
    this.#emit(EVENTS.VIEWPORT, this.viewport.toState())
    this.invalidateOverlay()
  }

  #emit(type, payload) {
    this.bus.emit(type, payload)
  }
}