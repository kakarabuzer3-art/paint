/**
 * Normalises raw pointer input into engine events.
 *
 * Responsibilities kept deliberately narrow:
 *   - convert client coords → screen coords → document coords (one place, so
 *     tools never do arithmetic)
 *   - pointer capture, so a stroke that leaves the canvas keeps drawing
 *   - expose `getCoalescedEvents()` samples, letting tools use the full input
 *     frequency of a stylus/mouse instead of one sample per rAF frame
 *   - hover updates for the overlay and the status bar
 *
 * It dispatches to the controller; it never talks to a tool or a canvas.
 */
export default class PointerRouter {
  constructor(context) {
    this.context = context
    this.element = null
    this.activePointerId = null
    this.isDown = false
  }

  attach(element) {
    this.detach()
    this.element = element

    element.addEventListener('pointerdown', this.onPointerDown)
    element.addEventListener('pointermove', this.onPointerMove)
    element.addEventListener('pointerup', this.onPointerUp)
    element.addEventListener('pointercancel', this.onPointerCancel)
    element.addEventListener('pointerleave', this.onPointerLeave)
    // Chrome needs an explicit opt-out or touch drags scroll/zoom the page.
    element.style.touchAction = 'none'
  }

  detach() {
    if (!this.element) return
    const { element } = this

    element.removeEventListener('pointerdown', this.onPointerDown)
    element.removeEventListener('pointermove', this.onPointerMove)
    element.removeEventListener('pointerup', this.onPointerUp)
    element.removeEventListener('pointercancel', this.onPointerCancel)
    element.removeEventListener('pointerleave', this.onPointerLeave)

    this.element = null
    this.activePointerId = null
    this.isDown = false
  }

  /** Client coords → { screen, doc, modifiers, pressure }. */
  toEvent(event) {
    const rect = this.context.getContainerRect()
    const screenX = event.clientX - rect.left
    const screenY = event.clientY - rect.top
    const doc = this.context.viewport.screenToDoc(screenX, screenY)

    return {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      screenX,
      screenY,
      docX: doc.x,
      docY: doc.y,
      pressure: event.pressure,
      buttons: event.buttons,
      button: event.button,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      nativeEvent: event,
    }
  }

  onPointerDown = (event) => {
    if (this.activePointerId !== null) return

    // Middle-button drag is a universal "temporary pan" gesture.
    if (event.button === 1) {
      event.preventDefault()
      this.context.tools.beginTemporary('pan')
    }

    const payload = this.toEvent(event)
    this.activePointerId = event.pointerId
    this.isDown = true

    try {
      this.element.setPointerCapture(event.pointerId)
    } catch {
      /* capture is best-effort (some synthetic events reject it) */
    }

    this.context.onPointerDown(payload)
  }

  onPointerMove = (event) => {
    const payload = this.toEvent(event)

    // Higher-frequency samples than rAF delivers — strokes use these.
    if (typeof event.getCoalescedEvents === 'function') {
      const coalesced = event.getCoalescedEvents()
      if (coalesced.length > 1) {
        payload.coalesced = coalesced.map((sample) => this.toEvent(sample))
      }
    }

    if (event.pointerId === this.activePointerId) {
      this.context.onPointerMove(payload)
    } else {
      this.context.onPointerHover(payload)
    }
  }

  onPointerUp = (event) => {
    if (event.pointerId !== this.activePointerId) return

    const payload = this.toEvent(event)
    this.activePointerId = null
    this.isDown = false

    try {
      this.element.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    this.context.onPointerUp(payload)
    this.context.tools.endTemporaryIfPanning()
  }

  onPointerCancel = (event) => {
    if (event.pointerId !== this.activePointerId) return
    this.activePointerId = null
    this.isDown = false
    this.context.onPointerCancel(this.toEvent(event))
    this.context.tools.endTemporaryIfPanning()
  }

  onPointerLeave = () => {
    if (this.isDown) return
    this.context.onPointerLeave()
  }
}