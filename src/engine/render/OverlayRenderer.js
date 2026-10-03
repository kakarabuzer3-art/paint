import { OVERLAY } from '../core/constants.js'
import { handlePositions } from './handles.js'

/**
 * Screen-space overlay: cursor ring, crosshair, selection marquee.
 *
 * Deliberately drawn at viewport resolution (not document resolution) and in
 * CSS-pixel space. That is what keeps the brush ring exactly the on-screen
 * size of the brush, handles a constant size at any zoom, and the overlay
 * crisp on high-DPI displays — all without touching the document.
 *
 * The overlay is never exported and never enters history.
 */
export default class OverlayRenderer {
  constructor(surface) {
    this.surface = surface
    this.pointer = null // { x, y } in CSS/screen pixels
    this.brushRadius = 0 // document pixels
    this.showRing = false
    this.crosshair = false
    this.marquee = null // document-space rect (Phase 4)
    this.snapshotRect = null // document-space rect (Phase 4)
    this.handles = null // { rect, active, hover } — transform handles
  }

  /** Eight resize handles around the selection bounds. */
  setHandles(rect, { active = null, hover = null } = {}) {
    this.handles = rect ? { rect, active, hover } : null
  }

  setPointer(x, y) {
    this.pointer = { x, y }
  }

  clearPointer() {
    this.pointer = null
  }

  setBrushPreview({ radius = 0, show = true, crosshair = false }) {
    this.brushRadius = radius
    this.showRing = show
    this.crosshair = crosshair
  }

  setMarquee(rect) {
    this.marquee = rect
  }

  /** @param {import('../core/Viewport.js').default} viewport */
  render(viewport) {
    const ctx = this.surface.ctx
    const width = viewport.viewWidth
    const height = viewport.viewHeight

    ctx.clearRect(0, 0, width, height)
    if (!width || !height) return

    if (this.pointer) {
      this.#renderCursor(ctx, viewport)
    }

    if (this.marquee) {
      this.#renderMarquee(ctx, viewport)
    }

    if (this.handles) {
      this.#renderHandles(ctx, viewport)
    }

    if (this.snapshotRect) {
      ctx.save()
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.strokeRect(
        viewport.docToScreen(this.snapshotRect.x, this.snapshotRect.y).x,
        viewport.docToScreen(this.snapshotRect.x, this.snapshotRect.y).y,
        viewport.toScreenLength(this.snapshotRect.width),
        viewport.toScreenLength(this.snapshotRect.height),
      )
      ctx.restore()
    }
  }

  #renderCursor(ctx, viewport) {
    const { x, y } = this.pointer

    ctx.save()

    if (this.showRing && this.brushRadius > 0) {
      const radius = viewport.toScreenLength(this.brushRadius)
      const offDocument = radius < 3 // a ring that collapses to a dot is useless

      ctx.beginPath()
      if (offDocument) {
        ctx.moveTo(x - 4, y)
        ctx.lineTo(x + 4, y)
        ctx.moveTo(x, y - 4)
        ctx.lineTo(x, y + 4)
      } else {
        ctx.arc(x, y, radius, 0, Math.PI * 2)
      }
      ctx.strokeStyle = 'rgba(12, 10, 21, 0.75)'
      ctx.lineWidth = OVERLAY.CURSOR_RING_WIDTH + 1
      ctx.stroke()

      ctx.beginPath()
      if (!offDocument) ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
      ctx.lineWidth = OVERLAY.CURSOR_RING_WIDTH
      ctx.stroke()
    }

    if (this.crosshair) {
      const reach = OVERLAY.CURSOR_CROSS
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - reach, y)
      ctx.lineTo(x + reach, y)
      ctx.moveTo(x, y - reach)
      ctx.lineTo(x, y + reach)
      ctx.stroke()
    }

    ctx.restore()
  }

  #renderHandles(ctx, viewport) {
    const { rect, active, hover } = this.handles
    const size = OVERLAY.HANDLE
    const half = size / 2

    ctx.save()

    for (const handle of handlePositions(rect, viewport)) {
      const isActive = handle.id === active
      const isHover = handle.id === hover

      ctx.fillStyle = isActive || isHover ? '#22d3ee' : '#ffffff'
      ctx.strokeStyle = 'rgba(12, 10, 21, 0.85)'
      ctx.lineWidth = 1

      ctx.fillRect(handle.x - half, handle.y - half, size, size)
      ctx.strokeRect(handle.x - half + 0.5, handle.y - half + 0.5, size - 1, size - 1)
    }

    ctx.restore()
  }

  #renderMarquee(ctx, viewport) {
    // A lasso in progress arrives as a point path rather than a rect.
    if (this.marquee.points?.length) {
      ctx.save()
      ctx.setLineDash([OVERLAY.MARQUEE_DASH, OVERLAY.MARQUEE_GAP])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
      ctx.beginPath()

      this.marquee.points.forEach((point, index) => {
        const screen = viewport.docToScreen(point.x, point.y)
        if (index === 0) ctx.moveTo(screen.x, screen.y)
        else ctx.lineTo(screen.x, screen.y)
      })

      ctx.stroke()
      ctx.restore()
      return
    }

    const topLeft = viewport.docToScreen(this.marquee.x, this.marquee.y)
    const width = viewport.toScreenLength(this.marquee.width)
    const height = viewport.toScreenLength(this.marquee.height)

    ctx.save()
    ctx.fillStyle = 'rgba(34, 211, 238, 0.08)'
    ctx.fillRect(topLeft.x, topLeft.y, width, height)

    ctx.setLineDash([OVERLAY.MARQUEE_DASH, OVERLAY.MARQUEE_GAP])
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(12, 10, 21, 0.6)'
    ctx.strokeRect(topLeft.x - 0.5, topLeft.y - 0.5, width + 1, height + 1)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
    ctx.strokeRect(topLeft.x + 0.5, topLeft.y + 0.5, width - 1, height - 1)
    ctx.restore()
  }
}