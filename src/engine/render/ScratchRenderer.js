import { isEmptyRect, toCoverRect, unionRect } from './dirtyRect.js'

/**
 * The scratch surface: everything transient that is not yet part of the
 * document — the in-flight stroke, a live shape preview, a transform drag.
 *
 * Contract: the engine clears it before each interaction frame, tools draw
 * into `ctx` in *document* coordinates, and the dirty band is accumulated so
 * only the touched region is cleared and recomposited. Nothing here is ever
 * exported or pushed to history.
 */
export default class ScratchRenderer {
  constructor(surface) {
    this.surface = surface
    this.dirty = null
  }

  get ctx() {
    return this.surface.ctx
  }

  get width() {
    return this.surface.canvas.width
  }

  get height() {
    return this.surface.canvas.height
  }

  /** Accumulate the band a tool is about to touch. */
  markDirty(rect) {
    if (!rect) {
      this.dirty = { x: 0, y: 0, width: this.width, height: this.height }
      return
    }
    this.dirty = unionRect(this.dirty, toCoverRect(rect))
  }

  consumeDirty() {
    const rect = this.dirty
    this.dirty = null
    return rect
  }

  /** Clear the whole scratch (start of an interaction frame). */
  clearAll() {
    this.markDirty(null)
  }

  /** Clear only a band — used when retiring scratch content. */
  clear(rect) {
    if (isEmptyRect(rect)) return
    const ctx = this.ctx
    ctx.save()
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
  }

  /** Run a drawing callback in document coordinates with state isolation. */
  paint(callback) {
    const ctx = this.ctx
    ctx.save()
    try {
      callback(ctx)
    } finally {
      ctx.restore()
    }
  }

  /** Hand the scratch contents into a layer, then clear. Phase 3/4 use this. */
  commitInto(layer, rect = null) {
    const band = rect ?? { x: 0, y: 0, width: this.width, height: this.height }
    layer.context.drawImage(
      this.surface.canvas,
      band.x,
      band.y,
      band.width,
      band.height,
      band.x,
      band.y,
      band.width,
      band.height,
    )
  }
}