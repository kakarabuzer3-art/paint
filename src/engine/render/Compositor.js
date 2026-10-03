import { clampRect } from './dirtyRect.js'

/**
 * Flattens the visible layer stack onto the composite surface.
 *
 * Runs only when a layer commits, the stack reorders, or history rewinds —
 * never while a stroke is being drawn (that is the scratch surface's job).
 * When a partial rect is supplied it repaints just that band: paper, then
 * every visible layer, each clipped to the band by drawing the matching
 * source sub-rect.
 */
export default class Compositor {
  constructor(surface) {
    this.surface = surface
  }

  /**
   * @param {object} document
   * @param {{ rect?: ?object, paper?: boolean }} [options]
   *   `paper: false` skips the opaque base — used by PNG/WebP export, where a
   *   transparent background is the whole point.
   */
  render(document, { rect = null, paper = true } = {}) {
    const ctx = this.surface.ctx
    const bounds = { x: 0, y: 0, width: document.width, height: document.height }
    const target = rect ? clampRect(rect, bounds) : bounds
    if (!target) return

    ctx.save()

    // Paper first — an opaque base keeps blend modes from sampling garbage.
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    if (paper) {
      ctx.fillStyle = document.paper
      ctx.fillRect(target.x, target.y, target.width, target.height)
    } else {
      ctx.clearRect(target.x, target.y, target.width, target.height)
    }

    for (const layer of document.compositingOrder()) {
      if (!layer.visible || layer.alpha === 0) continue

      ctx.globalAlpha = layer.alpha
      ctx.globalCompositeOperation = layer.blendMode

      // 1:1 source→dest copy of the dirty band.
      ctx.drawImage(
        layer.ensureCanvas(),
        target.x,
        target.y,
        target.width,
        target.height,
        target.x,
        target.y,
        target.width,
        target.height,
      )
    }

    ctx.restore()
  }
}