import Tool from './Tool.js'

/**
 * Zoom tool — click to step the zoom ladder, drag to zoom into a region.
 *
 * Anchoring matters: the zoom is applied about the pointer (or the dragged
 * region's centre), so the thing the user is looking at stays put. Centring
 * on the viewport instead is the classic zoom-tool annoyance.
 */
export default class ZoomTool extends Tool {
  static id = 'zoom'
  static cursor = 'zoom-in'

  #anchor = null

  onActivate() {
    this.#anchor = null
  }

  onPointerDown(event) {
    this.#anchor = { x: event.screenX, y: event.screenY }
  }

  onPointerMove() {}

  onPointerUp(event) {
    const anchor = this.#anchor
    this.#anchor = null
    if (!anchor) return

    const viewport = this.context.viewport
    const dx = Math.abs(event.screenX - anchor.x)
    const dy = Math.abs(event.screenY - anchor.y)

    // A click: one ladder step, pinned under the pointer.
    if (dx < 4 && dy < 4) {
      viewport.step(this.context.getZoomDirection?.() ?? 1, event.screenX, event.screenY)
      return
    }

    // A drag: fit the dragged screen rect.
    const docA = viewport.screenToDoc(anchor.x, anchor.y)
    const docB = viewport.screenToDoc(event.screenX, event.screenY)
    const width = Math.abs(docB.x - docA.x)
    const height = Math.abs(docB.y - docA.y)
    if (width < 1 || height < 1) return

    const scale = Math.min(viewport.viewWidth / width, viewport.viewHeight / height)
    const centre = viewport.docToScreen((docA.x + docB.x) / 2, (docA.y + docB.y) / 2)
    viewport.setScale(scale, centre.x, centre.y)
  }

  onPointerCancel() {
    this.#anchor = null
  }
}