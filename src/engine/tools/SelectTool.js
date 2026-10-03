import Tool from './Tool.js'
import { fromPoints } from '../render/dirtyRect.js'

/**
 * Rectangular selection.
 *
 * The marquee is drawn on the *overlay* (screen space, constant line width at
 * any zoom) while dragging, and the selection mask is only committed on
 * release — so an abandoned drag costs nothing.
 */
export default class SelectTool extends Tool {
  static id = 'select'
  static cursor = 'crosshair'
  static optionDefaults = { selectionMode: 'new', feather: 0, antialias: true }

  #start = null

  onPointerDown(event) {
    this.#start = { x: event.docX, y: event.docY }
  }

  onPointerMove(event) {
    if (!this.#start) return

    let x2 = event.docX
    let y2 = event.docY
    if (event.shiftKey) {
      // Constrain to a square from the anchor.
      const size = Math.max(Math.abs(x2 - this.#start.x), Math.abs(y2 - this.#start.y))
      x2 = this.#start.x + Math.sign(x2 - this.#start.x || 1) * size
      y2 = this.#start.y + Math.sign(y2 - this.#start.y || 1) * size
    }

    this.context.overlay?.setMarquee(fromPoints(this.#start.x, this.#start.y, x2, y2))
    this.context.invalidateOverlay()
  }

  onPointerUp(event) {
    if (!this.#start) return

    let x2 = event.docX
    let y2 = event.docY
    if (event.shiftKey) {
      const size = Math.max(Math.abs(x2 - this.#start.x), Math.abs(y2 - this.#start.y))
      x2 = this.#start.x + Math.sign(x2 - this.#start.x || 1) * size
      y2 = this.#start.y + Math.sign(y2 - this.#start.y || 1) * size
    }

    const rect = fromPoints(this.#start.x, this.#start.y, x2, y2)
    this.#start = null
    this.context.overlay?.setMarquee(null)

    // A plain click clears the selection, matching every other editor.
    if (rect.width < 1 || rect.height < 1) {
      this.context.selection.clear()
    } else {
      const { selectionMode } = { ...SelectTool.optionDefaults, ...this.context.getOptions() }
      this.context.selection.selectRect(rect, {
        mode: selectionMode,
        width: this.context.document.width,
        height: this.context.document.height,
      })
    }

    this.context.invalidateOverlay()
    this.context.onSelectionChange?.()
  }

  onPointerCancel() {
    this.#start = null
    this.context.overlay?.setMarquee(null)
    this.context.invalidateOverlay()
  }
}