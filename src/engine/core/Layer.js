import { createPixelCanvas } from './pixelCanvas.js'

let seq = 0

/**
 * One document layer: a full document-sized pixel buffer plus its
 * compositing properties.
 *
 * Layers are deliberately *not* DOM canvases — they are OffscreenCanvas
 * buffers. The visible <canvas> elements belong to the compositor, which
 * flattens the visible stack on demand. That keeps the number of live DOM
 * canvases constant (three) no matter how many layers the document has.
 */
export default class Layer {
  constructor({
    id = `layer-${(seq += 1)}`,
    name = 'Layer',
    width = 1920,
    height = 1080,
    visible = true,
    locked = false,
    opacity = 100,
    blendMode = 'source-over',
    fill = null,
  } = {}) {
    this.id = id
    this.name = name
    this.width = width
    this.height = height
    this.visible = visible
    this.locked = locked
    this.opacity = opacity
    this.blendMode = blendMode

    /** @type {OffscreenCanvas | HTMLCanvasElement | null} */
    this.canvas = null

    /**
     * Bumped whenever this layer's pixels change. The layer panel uses it as a
     * cache key for thumbnails: same revision means same picture, so a stroke
     * only costs one re-render instead of a redraw per frame.
     */
    this.revision = 0

    // Optional pre-fill colour (used for the initial background layer).
    if (fill) this.fillAll(fill)
  }

  /** Signal that the pixels changed, invalidating derived caches. */
  markDirty() {
    this.revision += 1
  }

  /** Lazily allocate the pixel buffer — never during construction. */
  ensureCanvas() {
    if (!this.canvas) {
      this.canvas = createPixelCanvas(this.width, this.height)
    }
    return this.canvas
  }

  get context() {
    return this.ensureCanvas().getContext('2d')
  }

  get alpha() {
    return Math.min(1, Math.max(0, this.opacity / 100))
  }

  fillAll(color) {
    const ctx = this.context
    ctx.save()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.restore()
  }

  clearRect(rect) {
    if (!rect) {
      this.context.clearRect(0, 0, this.width, this.height)
      return
    }
    this.context.clearRect(rect.x, rect.y, rect.width, rect.height)
  }

  /**
   * Resize the layer, preserving content anchored at the top-left.
   * Paints are anchored rather than centred on purpose: Photoshop-style
   * resize keeps the origin of the artwork fixed.
   */
  resize(width, height) {
    if (width === this.width && height === this.height) return

    const previous = this.canvas
    this.width = width
    this.height = height

    if (!previous) return

    const next = createPixelCanvas(width, height)
    const ctx = next.getContext('2d')
    ctx.drawImage(previous, 0, 0)
    this.canvas = next
  }

  /** Bounding box of non-transparent pixels, or null when fully empty. */
  contentBounds() {
    const { width, height } = this
    const data = this.context.getImageData(0, 0, width, height).data

    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      const rowStart = y * width * 4
      for (let x = 0; x < width; x += 1) {
        if (data[rowStart + x * 4 + 3] !== 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < 0) return null
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  }

  /** Serialisable snapshot — Phase 6 turns this into a saved file. */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      opacity: this.opacity,
      blendMode: this.blendMode,
      width: this.width,
      height: this.height,
    }
  }

  dispose() {
    if (this.canvas && 'width' in this.canvas) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
    this.canvas = null
  }
}