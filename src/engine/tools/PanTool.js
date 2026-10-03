import Tool from './Tool.js'

/**
 * Pan tool — drags the document across the viewport.
 *
 * Pan moves the viewport transform rather than redrawing anything: the same
 * CSS transform that drives all three surfaces moves the artboard, so panning
 * costs one style write instead of a repaint.
 *
 * Also used as the temporary override for Space-drag and middle-button drag,
 * so it must not depend on being "activated" in the usual sense.
 */
export default class PanTool extends Tool {
  static id = 'pan'
  static cursor = 'grab'

  #last = null

  onActivate() {
    this.#last = null
  }

  onDeactivate() {
    this.#last = null
  }

  onPointerDown(event) {
    this.#last = { x: event.screenX, y: event.screenY }
    this.context.setCursor('grabbing')
  }

  onPointerMove(event) {
    if (!this.#last || event.buttons === 0) return

    const deltaX = event.screenX - this.#last.x
    const deltaY = event.screenY - this.#last.y
    this.#last = { x: event.screenX, y: event.screenY }

    if (deltaX || deltaY) this.context.viewport.panBy(deltaX, deltaY)
  }

  onPointerUp() {
    this.#last = null
    this.context.setCursor(this.constructor.cursor)
  }

  onPointerCancel() {
    this.onPointerUp()
  }
}