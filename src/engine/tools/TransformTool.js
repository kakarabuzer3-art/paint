import Tool from './Tool.js'
import { createPixelCanvas } from '../core/pixelCanvas.js'
import { createRect, fromPoints, unionRect } from '../render/dirtyRect.js'
import { clearSelection, extractSelection } from '../selection/ops.js'
import { hitTestHandles } from '../render/handles.js'

const MIN_SIZE = 2

/**
 * Scale the selected pixels with eight resize handles.
 *
 * Handles are hit-tested in screen space (constant grab radius at any zoom)
 * but the maths stays in document space, so a zoom change mid-drag never
 * shifts the target rect.
 *
 *   Shift = keep aspect ratio    Alt = scale from the centre
 *
 * Undo band is the visible region, matching MoveTool: a drag cannot touch
 * anything outside it.
 */
export default class TransformTool extends Tool {
  static id = 'transform'
  static cursor = 'default'
  static optionDefaults = {}

  #state = null

  onHover(event) {
    const selection = this.context.selection
    if (selection.isEmpty) {
      this.context.overlay?.setHandles(null)
      this.context.invalidateOverlay()
      return
    }

    const handle = hitTestHandles(selection.bounds, this.context.viewport, event.screenX, event.screenY)
    this.context.overlay?.setHandles(selection.bounds, { hover: handle?.id ?? null })
    this.context.setCursor(handle ? handle.cursor : 'default')
    this.context.invalidateOverlay()
  }

  onPointerDown(event) {
    const selection = this.context.selection
    if (selection.isEmpty) {
      this.context.notice?.('Nothing to transform', 'Make a selection first, then drag a handle.')
      return
    }

    const handle = hitTestHandles(selection.bounds, this.context.viewport, event.screenX, event.screenY)
    if (!handle) {
      this.context.notice?.('Grab a handle', 'Drag one of the eight handles to scale the selection.')
      return
    }

    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Layer unavailable', 'Unlock and show the active layer.')
      return
    }

    const payload = extractSelection(layer, selection)
    if (!payload) return

    const snapshot = createPixelCanvas(payload.width, payload.height)
    const snapshotCtx = snapshot.getContext('2d')
    snapshotCtx.putImageData(payload.imageData, 0, 0)
    const masked = snapshotCtx.getImageData(0, 0, payload.width, payload.height)
    for (let i = 0; i < payload.mask.length; i += 1) {
      if (payload.mask[i]) continue
      masked.data[i * 4 + 3] = 0
    }
    snapshotCtx.putImageData(masked, 0, 0)

    this.#state = {
      layer,
      selection,
      handle,
      rect: payload.rect,
      snapshot,
      target: payload.rect,
      dirty: null,
      patch: this.context.beginRegionPatch(layer),
    }
  }

  onPointerMove(event) {
    const state = this.#state
    if (!state) return

    state.target = this.#geometry(event)
    this.#paint()

    state.dirty = unionRect(state.dirty, unionRect(state.rect, state.target))
    this.context.requestComposite(state.dirty)
    this.context.overlay?.setMarquee(state.target)
    this.context.overlay?.setHandles(state.target, { active: state.handle.id })
    this.context.invalidateOverlay()
  }

  onPointerUp() {
    const state = this.#state
    if (!state) return

    const changed =
      state.target.x !== state.rect.x ||
      state.target.y !== state.rect.y ||
      state.target.width !== state.rect.width ||
      state.target.height !== state.rect.height

    if (changed) {
      this.context.commitRegionPatch(state.patch, state.dirty, 'Transform')
      // The selection follows the new bounds. A non-rectangular mask is
      // re-created as a rectangle — exact mask scaling is a Phase 8 nicety.
      this.context.selection.selectRect(state.target, {
        mode: 'new',
        width: this.context.document.width,
        height: this.context.document.height,
      })
    } else {
      this.context.abandonRegionPatch(state.patch, null)
    }

    this.#state = null
    this.context.overlay?.setHandles(this.context.selection.bounds)
    this.context.invalidateOverlay()
    this.context.onSelectionChange?.()
  }

  onPointerCancel() {
    if (this.#state) this.context.abandonRegionPatch(this.#state.patch, this.#state.dirty)
    this.#state = null
    this.context.overlay?.setHandles(this.context.selection.bounds)
    this.context.invalidateOverlay()
  }

  /* --------------------------------------------------------------- internals */

  #geometry(event) {
    const { rect, handle } = this.#state
    const fromCentre = event.altKey

    const anchorX = fromCentre ? rect.x + rect.width / 2 : rect.x + rect.width * handle.anchorX
    const anchorY = fromCentre ? rect.y + rect.height / 2 : rect.y + rect.height * handle.anchorY

    let width = Math.max(MIN_SIZE, Math.abs(event.docX - anchorX))
    let height = Math.max(MIN_SIZE, Math.abs(event.docY - anchorY))

    if (event.shiftKey) {
      const ratio = Math.max(width / Math.max(rect.width, MIN_SIZE), height / Math.max(rect.height, MIN_SIZE))
      width = Math.max(MIN_SIZE, rect.width * ratio)
      height = Math.max(MIN_SIZE, rect.height * ratio)
    }

    const signX = fromCentre ? Math.sign(event.docX - anchorX || 1) : handle.fx === 0 ? -1 : 1
    const signY = fromCentre ? Math.sign(event.docY - anchorY || 1) : handle.fy === 0 ? -1 : 1

    return fromPoints(anchorX, anchorY, anchorX + width * signX, anchorY + height * signY)
  }

  /** Idempotent repaint from immutable source data. */
  #paint() {
    const { layer, selection, snapshot, target } = this.#state

    clearSelection(layer, selection)
    layer.context.drawImage(
      snapshot,
      0,
      0,
      snapshot.width,
      snapshot.height,
      Math.round(target.x),
      Math.round(target.y),
      Math.round(target.width),
      Math.round(target.height),
    )
  }
}