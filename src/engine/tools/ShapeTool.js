import Tool from './Tool.js'
import { createRect, fromPoints, unionRect } from '../render/dirtyRect.js'

/**
 * Rectangles and ellipses.
 *
 * Shapes use the *preview-then-commit* model that brush strokes don't need:
 * the shape is drawn on the scratch surface while dragging and only merged
 * into the layer on release, so an accidental drag leaves no pixels behind and
 * the layer stays clean until the gesture is intentional.
 *
 * Shift constrains to a square / circle; the stroke-and-fill style comes from
 * the options bar.
 */
export default class ShapeTool extends Tool {
  static id = 'shape'
  static cursor = 'crosshair'
  static kind = 'rect'
  static label = 'Shape'
  static optionDefaults = {
    shapeMode: 'fill',
    cornerRadius: 0,
    strokeWidth: 4,
    fillSource: 'primary',
    strokeSource: 'secondary',
  }

  #start = null
  #dirty = null

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
    this.#start = { x: event.docX, y: event.docY, shiftKey: event.shiftKey }
    this.#patch = this.context.beginRegionPatch(layer)
    this.#preview(event)
  }

  onPointerMove(event) {
    if (!this.#start) return
    this.#preview(event)
  }

  onPointerUp(event) {
    if (!this.#start) return

    this.#preview(event)
    this.#commit()
  }

  onPointerCancel() {
    if (this.#patch) this.context.abandonRegionPatch(this.#patch, this.#dirty)
    this.#reset()
    this.context.requestScratch(null)
    this.context.invalidateOverlay()
  }

  /* --------------------------------------------------------------- internals */

  #layer = null
  #patch = null

  #reset() {
    this.#start = null
    this.#layer = null
    this.#dirty = null
    this.#patch = null
  }

  /** Geometry for the current drag, with Shift constraints applied. */
  #geometry(event) {
    const { x: x1, y: y1 } = this.#start
    let { x: x2, y: y2 } = { x: event.docX, y: event.docY }

    if (event.shiftKey) {
      const size = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
      x2 = x1 + Math.sign(x2 - x1 || 1) * size
      y2 = y1 + Math.sign(y2 - y1 || 1) * size
    }

    return fromPoints(x1, y1, x2, y2)
  }

  #style() {
    const options = { ...this.constructor.optionDefaults, ...this.context.getOptions() }
    const colors = this.context.getColors()
    const mode = options.shapeMode ?? 'fill'

    return {
      fill: mode === 'fill' || mode === 'both' ? colors.primary : null,
      stroke: mode === 'stroke' || mode === 'both' ? colors.secondary : null,
      strokeWidth: Math.max(1, options.strokeWidth ?? 4),
      cornerRadius: Math.max(0, options.cornerRadius ?? 0),
      opacity: (options.opacity ?? 100) / 100,
    }
  }

  #preview(event) {
    const rect = this.#geometry(event)
    const style = this.#style()
    const scratch = this.context.scratch
    if (!scratch) return

    scratch.paint((ctx) => {
      ctx.globalAlpha = style.opacity
      const path = this.constructor.pathFor(ctx, rect, style.cornerRadius)
      if (style.fill && path) {
        ctx.fillStyle = style.fill
        ctx.fill(path)
      }
      if (style.stroke && path) {
        ctx.lineWidth = style.strokeWidth
        ctx.strokeStyle = style.stroke
        ctx.stroke(path)
      }
    })

    // Pad the band so anti-aliased edges and stroke width stay covered.
    const band = createRect(
      rect.x - style.strokeWidth - 2,
      rect.y - style.strokeWidth - 2,
      rect.width + style.strokeWidth * 2 + 4,
      rect.height + style.strokeWidth * 2 + 4,
    )

    this.#dirty = unionRect(this.#dirty, band)
    this.context.requestScratch(band)
  }

  #commit() {
    if (this.#dirty && this.#layer) {
      this.context.scratch?.commitInto(this.#layer, this.#dirty)
      this.context.commitRegionPatch(this.#patch, this.#dirty, this.constructor.label)
    } else if (this.#patch) {
      this.context.abandonRegionPatch(this.#patch, null)
    }

    this.#reset()
    this.context.requestScratch(null)
    this.context.invalidateOverlay()
  }

  /** Build the shape path; overridden by EllipseTool. */
  static pathFor(ctx, rect, radius) {
    const { x, y, width, height } = rect
    if (width < 1 || height < 1) return null

    const path = new Path2D()
    const r = Math.min(radius, width / 2, height / 2)

    if (r > 0 && typeof path.roundRect === 'function') {
      path.roundRect(x, y, width, height, r)
    } else {
      path.rect(x, y, width, height)
    }
    return path
  }
}