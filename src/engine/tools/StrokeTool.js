import Tool from './Tool.js'
import BrushEngine, { getBrushTip } from '../brush/BrushEngine.js'
import { createRect, expandRect, unionRect } from '../render/dirtyRect.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * Shared implementation of brush / pencil / eraser.
 *
 * They differ only in how the tip is composited and which options they
 * honour, so they share one sampler rather than three copies of the maths.
 *
 * Paints directly into the target layer rather than through the scratch
 * surface: a raster brush has no "preview vs. final" distinction worth the
 * extra blit, and the composite already redraws only the dirty band, so the
 * stroke stays visible live at a fraction of the cost.
 *
 * Subclasses set `static id`, `mode` (composite operation) and
 * `optionDefaults`.
 */
export default class StrokeTool extends Tool {
  static id = 'stroke'
  static cursor = 'crosshair'
  static optionDefaults = {}
  /** History label — shown in the history panel. */
  static label = 'Stroke'

  /** Compositing operation used to stamp the tip. */
  get mode() {
    return 'source-over'
  }

  #brush = new BrushEngine()
  #layer = null
  #dirty = null
  #touched = null
  #patch = null
  #smoothed = null

  onActivate() {
    this.#reset()
  }

  onPointerDown(event) {
    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Nothing to draw on', 'Add an unlocked, visible layer first.')
      return
    }

    this.#layer = layer
    this.#reset()
    // Snapshot the visible region once; only the touched band is kept in history.
    this.#patch = this.context.beginRegionPatch(layer)
    this.#stroke(event)
    this.#flush()
  }

  onPointerMove(event) {
    if (!this.#layer) return

    // Use every sample the browser captured, not just one per frame: on a
    // 240Hz mouse or a stylus this is the difference between a smooth curve
    // and a polygon.
    const samples = event.coalesced?.length ? event.coalesced : [event]
    for (const sample of samples) this.#stroke(sample)

    this.#flush()
  }

  onPointerUp(event) {
    if (!this.#layer) return
    this.#stroke(event, true)
    this.#flush()

    if (this.#patch) {
      this.context.commitRegionPatch(this.#patch, this.#touched, this.constructor.label)
    }

    this.#finish()
  }

  onPointerCancel() {
    if (this.#patch) this.context.abandonRegionPatch(this.#patch, this.#touched)
    this.#finish()
  }

  /* --------------------------------------------------------------- internals */

  #reset() {
    this.#brush.reset()
    this.#smoothed = null
    this.#dirty = null
    this.#touched = null
    this.#patch = null
  }

  #finish() {
    this.#reset()
    this.#layer = null
    // Phase 4 pushes the pixel patch here; for now the stroke is already on
    // the layer, so only the overlay (dirty overlay state) needs refreshing.
    this.context.invalidateOverlay()
  }

  #options() {
    return {
      size: 12,
      hardness: 82,
      opacity: 100,
      flow: 100,
      spacing: 12,
      smoothing: 0,
      pressure: false,
      ...this.constructor.optionDefaults,
      ...this.context.getOptions(),
    }
  }

  #stroke(event, isEnd = false) {
    const options = this.#options()
    const size = Math.max(1, options.size)
    const hardness = this.hardnessFor(options)

    const point = BrushEngine.smooth(
      this.#smoothed,
      { x: event.docX, y: event.docY },
      options.smoothing,
    )
    this.#smoothed = point

    const stamps = isEnd
      ? this.#brush.finish(point)
      : this.#brush.extend(point, { size, spacing: options.spacing })

    if (stamps.length === 0) return

    const alpha = this.alphaFor(options, event)
    const tip = getBrushTip({ color: this.tipColor(options), size, hardness })

    const ctx = this.#layer.context
    ctx.save()
    ctx.globalCompositeOperation = this.mode
    ctx.globalAlpha = alpha

    for (const stamp of stamps) {
      const x = stamp.x - tip.width / 2
      const y = stamp.y - tip.height / 2
      ctx.drawImage(tip, x, y)

      const band = expandRect(createRect(x, y, tip.width, tip.height), 1)
      this.#dirty = unionRect(this.#dirty, band)
      // Accumulated for the whole gesture — this is what history will keep.
      this.#touched = unionRect(this.#touched, band)
    }

    ctx.restore()
  }

  /** Eraser subclasses force a crisp edge in "block" mode. */
  hardnessFor(options) {
    return options.hardness
  }

  tipColor(options) {
    return this.context.getColors().primary ?? '#000000'
  }

  alphaFor(options, event) {
    const base = ((options.opacity ?? 100) / 100) * ((options.flow ?? 100) / 100)
    // Stylus pressure modulates flow; mice report 0.5 while down, which would
    // otherwise halve every mouse stroke.
    const pressure =
      options.pressure && event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 1
    return clamp(base * pressure, 0.01, 1)
  }

  #flush() {
    if (!this.#dirty) return
    this.context.requestComposite(this.#dirty)
    this.#dirty = null
  }
}