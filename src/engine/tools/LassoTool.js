import SelectTool from './SelectTool.js'

/**
 * Freehand lasso. Records the drag path, draws it as a live marquee, and
 * closes the polygon on release before handing it to the mask filler.
 */
export default class LassoTool extends SelectTool {
  static id = 'lasso'
  static cursor = 'crosshair'
  static optionDefaults = { selectionMode: 'new', feather: 0, antialias: true }

  #points = null

  onPointerDown(event) {
    this.#points = [{ x: event.docX, y: event.docY }]
  }

  onPointerMove(event) {
    if (!this.#points) return

    const last = this.#points[this.#points.length - 1]
    const distance = Math.hypot(event.docX - last.x, event.docY - last.y)

    // Thin the path: sub-pixel points bloat the mask scan for no benefit.
    if (distance < 2) return

    this.#points.push({ x: event.docX, y: event.docY })
    this.context.overlay?.setMarquee({
      x: event.docX,
      y: event.docY,
      width: 0,
      height: 0,
      points: this.#points,
    })
    this.context.invalidateOverlay()
  }

  onPointerUp() {
    const points = this.#points
    this.#points = null
    this.context.overlay?.setMarquee(null)

    if (!points || points.length < 3) {
      this.context.invalidateOverlay()
      return
    }

    const { selectionMode } = { ...LassoTool.optionDefaults, ...this.context.getOptions() }
    this.context.selection.selectPolygon(points, {
      mode: selectionMode,
      width: this.context.document.width,
      height: this.context.document.height,
    })

    this.context.invalidateOverlay()
    this.context.onSelectionChange?.()
  }

  onPointerCancel() {
    this.#points = null
    this.context.overlay?.setMarquee(null)
    this.context.invalidateOverlay()
  }
}