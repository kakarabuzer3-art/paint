import Tool from './Tool.js'
import { createPixelCanvas } from '../core/pixelCanvas.js'
import { createRect, unionRect } from '../render/dirtyRect.js'
import { clearSelection, extractSelection } from '../selection/ops.js'

/**
 * Move the selected pixels.
 *
 * Live preview re-renders the payload every frame from immutable source data,
 * so the drag is idempotent — no accumulation drift, no "smearing".
 *
 * Default is a *move* (the source pixels are erased); Alt-drag *duplicates*
 * them, which is the convention every editor uses.
 *
 * Undo band: the visible viewport region, because that is the only area a drag
 * can possibly touch. One viewport-sized patch per drag, released on commit.
 */
export default class MoveTool extends Tool {
  static id = 'move'
  static cursor = 'move'
  static optionDefaults = {}

  #state = null

  onPointerDown(event) {
    const selection = this.context.selection
    if (selection.isEmpty) {
      this.context.notice?.('Nothing to move', 'Make a selection first, then drag.')
      return
    }

    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Layer unavailable', 'Unlock and show the active layer.')
      return
    }

    const payload = extractSelection(layer, selection)
    if (!payload) return

    // Mask the snapshot so unselected pixels inside the bounding box stay put.
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
      rect: payload.rect,
      snapshot,
      patch: this.context.beginRegionPatch(layer),
      origin: { x: event.docX, y: event.docY },
      dx: 0,
      dy: 0,
      dirty: null,
      duplicate: event.altKey,
    }
  }

  onPointerMove(event) {
    const state = this.#state
    if (!state) return

    state.dx = Math.round(event.docX - state.origin.x)
    state.dy = Math.round(event.docY - state.origin.y)
    if (state.dx === 0 && state.dy === 0) return

    this.#paint()

    const moved = createRect(
      state.rect.x + state.dx,
      state.rect.y + state.dy,
      state.rect.width,
      state.rect.height,
    )

    state.dirty = unionRect(state.dirty, unionRect(state.rect, moved))
    this.context.requestComposite(state.dirty)

    this.context.overlay?.setMarquee(moved)
    this.context.invalidateOverlay()
  }

  onPointerUp() {
    const state = this.#state
    if (!state) return

    const moved = state.dx !== 0 || state.dy !== 0

    if (moved) {
      this.context.commitRegionPatch(state.patch, state.dirty, state.duplicate ? 'Duplicate selection' : 'Move selection')
      if (!state.duplicate) state.selection.translate(state.dx, state.dy)
    } else {
      this.context.abandonRegionPatch(state.patch, null)
    }

    this.#state = null
    this.context.overlay?.setMarquee(null)
    this.context.invalidateOverlay()
    this.context.onSelectionChange?.()
  }

  onPointerCancel() {
    if (this.#state) this.context.abandonRegionPatch(this.#state.patch, this.#state.dirty)
    this.#state = null
    this.context.overlay?.setMarquee(null)
    this.context.invalidateOverlay()
  }

  /** Idempotent: erase the source (unless duplicating), stamp the payload. */
  #paint() {
    const { layer, selection, rect, snapshot, dx, dy, duplicate } = this.#state

    if (!duplicate) clearSelection(layer, selection)
    layer.context.drawImage(snapshot, rect.x + dx, rect.y + dy)
  }
}