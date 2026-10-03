import { FIT_PADDING, MAX_ZOOM, MIN_ZOOM, ZOOM_STOPS } from './constants.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * Screen ⇄ document transform.
 *
 * Model:  screen = document * scale + offset
 *
 * This single formula is the source of truth for the artboard's CSS
 * transform, the pointer's coordinate mapping, the overlay ring radius and
 * wheel-zoom anchoring. Keeping it in one DOM-free class means all four can
 * never drift apart, and the maths is unit-testable in plain Node.
 */
export default class Viewport {
  constructor() {
    this.viewWidth = 0
    this.viewHeight = 0
    this.docWidth = 1
    this.docHeight = 1
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.fitScale = 1
    /** @type {null | (() => void)} set by EditorController */
    this.onChange = null
  }

  /* --------------------------------------------------------------- sizing */

  setViewSize(width, height) {
    if (width === this.viewWidth && height === this.viewHeight) return
    this.viewWidth = width
    this.viewHeight = height
    this.fitScale = this.#computeFitScale()
    this.#emit()
  }

  setDocumentSize(width, height) {
    if (width === this.docWidth && height === this.docHeight) return
    this.docWidth = width
    this.docHeight = height
    this.fit()
  }

  /** Fit the document inside the viewport, centred. Safe before attach. */
  fit() {
    if (!this.viewWidth || !this.viewHeight) return this.scale

    const scale = this.#computeFitScale()
    this.scale = scale
    this.offsetX = (this.viewWidth - this.docWidth * scale) / 2
    this.offsetY = (this.viewHeight - this.docHeight * scale) / 2
    this.#emit()
    return scale
  }

  #computeFitScale() {
    if (!this.viewWidth || !this.viewHeight) return 1
    const raw = Math.min(
      (this.viewWidth - FIT_PADDING) / this.docWidth,
      (this.viewHeight - FIT_PADDING) / this.docHeight,
    )
    return clamp(raw, MIN_ZOOM, 1)
  }

  /* ------------------------------------------------------------- transform */

  setScale(next, anchorX, anchorY) {
    const scale = clamp(next, MIN_ZOOM, MAX_ZOOM)
    if (scale === this.scale) return

    // Anchor defaults to the viewport centre so keyboard zoom feels centred
    // and pointer zoom stays pinned under the cursor.
    const ax = anchorX ?? this.viewWidth / 2
    const ay = anchorY ?? this.viewHeight / 2
    const docPoint = this.screenToDoc(ax, ay)

    this.scale = scale
    this.offsetX = ax - docPoint.x * scale
    this.offsetY = ay - docPoint.y * scale
    this.#emit()
  }

  /** Snap through the zoom ladder in `direction` (1 = in, -1 = out). */
  step(direction, anchorX, anchorY) {
    if (direction > 0) {
      const next = ZOOM_STOPS.find((stop) => stop > this.scale + 0.0001)
      this.setScale(next ?? MAX_ZOOM, anchorX, anchorY)
    } else {
      const lower = [...ZOOM_STOPS].reverse().find((stop) => stop < this.scale - 0.0001)
      this.setScale(lower ?? MIN_ZOOM, anchorX, anchorY)
    }
  }

  zoomBy(factor, anchorX, anchorY) {
    this.setScale(this.scale * factor, anchorX, anchorY)
  }

  panBy(deltaX, deltaY) {
    if (!deltaX && !deltaY) return
    this.offsetX += deltaX
    this.offsetY += deltaY
    this.#emit()
  }

  resetZoom() {
    this.setScale(1)
  }

  /* ------------------------------------------------------------ conversion */

  screenToDoc(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    }
  }

  docToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY,
    }
  }

  /** Convert a document-space length (e.g. brush radius) to screen pixels. */
  toScreenLength(length) {
    return length * this.scale
  }

  /** The visible document rectangle in document coordinates. */
  visibleDocRect() {
    const topLeft = this.screenToDoc(0, 0)
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: this.viewWidth / this.scale,
      height: this.viewHeight / this.scale,
    }
  }

  /** Document rectangle currently on screen, clamped to the document. */
  intersectionRect() {
    const visible = this.visibleDocRect()
    const x = Math.max(0, visible.x)
    const y = Math.max(0, visible.y)
    const right = Math.min(this.docWidth, visible.x + visible.width)
    const bottom = Math.min(this.docHeight, visible.y + visible.height)
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
  }

  /* ----------------------------------------------------------- inspection */

  toState() {
    return {
      zoom: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      fitScale: this.fitScale,
    }
  }

  #emit() {
    this.onChange?.()
  }
}