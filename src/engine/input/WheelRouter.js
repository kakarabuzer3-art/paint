/**
 * Wheel / trackpad zoom, anchored under the pointer.
 *
 * Registered as a non-passive listener because zoom must call preventDefault
 * — the alternative is the page scrolling behind a canvas that should not
 * scroll at all.
 *
 * The delta is converted to an exponential factor so trackpads (many small
 * deltas) and notched wheels (large deltas) feel equally controlled, with a
 * per-event clamp so one violent scroll cannot jump several zoom levels.
 */
export default class WheelRouter {
  constructor(context) {
    this.context = context
    this.element = null
  }

  attach(element) {
    this.detach()
    this.element = element
    element.addEventListener('wheel', this.onWheel, { passive: false })
  }

  detach() {
    if (!this.element) return
    this.element.removeEventListener('wheel', this.onWheel)
    this.element = null
  }

  onWheel = (event) => {
    event.preventDefault()

    const rect = this.context.getContainerRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top

    // Line-mode deltas arrive ~16× smaller than pixel-mode on older engines.
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const factor = Math.min(2, Math.max(0.5, Math.exp(-delta * 0.002)))

    this.context.viewport.zoomBy(factor, screenX, screenY)
  }
}