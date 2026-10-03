/**
 * Mask-based selection.
 *
 * A selection is a `Uint8Array` mask (255 = selected) plus a bounding box,
 * not a path or a set of shapes. That one decision is what makes rectangular,
 * lasso and magic-wand selections interchangeable downstream: move, transform,
 * copy, delete and invert all operate on the same mask, so a new selection
 * tool needs no changes anywhere else.
 *
 * The mask is document-sized and allocated lazily, so an unused selection
 * costs nothing.
 */
export default class SelectionManager {
  constructor() {
    /** @type {?Uint8Array} */
    this.mask = null
    this.width = 0
    this.height = 0
    this.bounds = null

    /** @type {null | (() => void)} set by EditorController */
    this.onChange = null
  }

  get isEmpty() {
    return !this.mask || !this.bounds
  }

  get area() {
    if (this.isEmpty) return 0
    let count = 0
    for (let i = 0; i < this.mask.length; i += 1) if (this.mask[i]) count += 1
    return count
  }

  /* ------------------------------------------------------------ mask basics */

  #ensure(width, height) {
    if (this.mask && this.width === width && this.height === height) return this.mask
    this.mask = new Uint8Array(width * height)
    this.width = width
    this.height = height
    this.bounds = null
    return this.mask
  }

  clear() {
    this.mask = null
    this.width = 0
    this.height = 0
    this.bounds = null
    this.onChange?.()
  }

  /** Rebuild the bounding box from the mask (full scan, selection-time only). */
  #recomputeBounds() {
    if (!this.mask) return

    let minX = this.width
    let minY = this.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < this.height; y += 1) {
      const rowStart = y * this.width
      for (let x = 0; x < this.width; x += 1) {
        if (!this.mask[rowStart + x]) continue
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }

    this.bounds = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    this.onChange?.()
  }

  /** Merge a freshly-built mask into the current one. */
  #merge(next, mode) {
    if (mode === 'new' || !this.mask) {
      this.mask = next
    } else if (mode === 'add') {
      for (let i = 0; i < next.length; i += 1) if (next[i]) this.mask[i] = 255
    } else {
      for (let i = 0; i < next.length; i += 1) if (next[i]) this.mask[i] = 0
    }
    this.#recomputeBounds()
  }

  /* ------------------------------------------------------------- rectangular */

  selectRect(rect, { mode = 'new', width, height } = {}) {
    this.#ensure(width, height)
    const next = new Uint8Array(this.mask.length)

    const x1 = Math.max(0, Math.floor(rect.x))
    const y1 = Math.max(0, Math.floor(rect.y))
    const x2 = Math.min(width, Math.ceil(rect.x + rect.width))
    const y2 = Math.min(height, Math.ceil(rect.y + rect.height))

    for (let y = y1; y < y2; y += 1) {
      const rowStart = y * width
      for (let x = x1; x < x2; x += 1) next[rowStart + x] = 255
    }

    this.#merge(next, mode)
  }

  /* ------------------------------------------------------------------ lasso */

  /** Even-odd scanline fill of a closed polygon. */
  selectPolygon(points, { mode = 'new', width, height } = {}) {
    this.#ensure(width, height)
    const next = new Uint8Array(this.mask.length)

    if (points.length >= 3) {
      let minY = Infinity
      let maxY = -Infinity
      for (const [, y] of points) {
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }

      const from = Math.max(0, Math.floor(minY))
      const to = Math.min(height - 1, Math.ceil(maxY))

      for (let y = from; y <= to; y += 1) {
        const scanY = y + 0.5
        const crossings = []

        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const [xi, yi] = points[i]
          const [xj, yj] = points[j]
          // Count edges that straddle this scanline.
          if (yi <= scanY === yj <= scanY) continue
          crossings.push(xi + ((scanY - yi) / (yj - yi)) * (xj - xi))
        }

        crossings.sort((a, b) => a - b)
        const rowStart = y * width

        for (let k = 0; k + 1 < crossings.length; k += 2) {
          const start = Math.max(0, Math.ceil(crossings[k] - 0.5))
          const end = Math.min(width - 1, Math.floor(crossings[k + 1] - 0.5))
          for (let x = start; x <= end; x += 1) next[rowStart + x] = 255
        }
      }
    }

    this.#merge(next, mode)
  }

  /* ------------------------------------------------------------- magic wand */

  /** Select connected (or all matching) pixels of a similar colour. */
  selectByColour({ x, y, width, height, data, tolerance = 32, contiguous = true, mode = 'new' }) {
    this.#ensure(width, height)
    const next = new Uint8Array(this.mask.length)

    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= width || py >= height) {
      this.#merge(next, mode)
      return
    }

    const origin = (py * width + px) * 4
    const target = [data[origin], data[origin + 1], data[origin + 2], data[origin + 3]]
    const limit = tolerance * tolerance * 4

    const matches = (index) => {
      const dr = data[index] - target[0]
      const dg = data[index + 1] - target[1]
      const db = data[index + 2] - target[2]
      const da = data[index + 3] - target[3]
      return dr * dr + dg * dg + db * db + da * da <= limit
    }

    if (contiguous) {
      const stack = [px, py]
      while (stack.length > 0) {
        const row = stack.pop()
        const column = stack.pop()
        if (next[row * width + column]) continue

        let left = column
        while (left > 0 && !next[row * width + left - 1] && matches((row * width + left - 1) * 4)) {
          left -= 1
        }
        let right = column
        while (
          right < width - 1 &&
          !next[row * width + right + 1] &&
          matches((row * width + right + 1) * 4)
        ) {
          right += 1
        }

        for (let i = left; i <= right; i += 1) next[row * width + i] = 255
        for (const neighbour of [row - 1, row + 1]) {
          if (neighbour < 0 || neighbour >= height) continue
          for (let i = left; i <= right; i += 1) {
            if (!next[neighbour * width + i] && matches((neighbour * width + i) * 4)) {
              stack.push(i, neighbour)
            }
          }
        }
      }
    } else {
      for (let index = 0; index < data.length; index += 4) {
        if (matches(index)) next[index / 4] = 255
      }
    }

    this.#merge(next, mode)
  }

  /** Shift the mask so the outline follows moved pixels. */
  translate(dx, dy) {
    if (!this.mask || (!dx && !dy)) return

    const next = new Uint8Array(this.mask.length)
    for (let y = 0; y < this.height; y += 1) {
      const sourceY = y - dy
      if (sourceY < 0 || sourceY >= this.height) continue
      for (let x = 0; x < this.width; x += 1) {
        const sourceX = x - dx
        if (sourceX < 0 || sourceX >= this.width) continue
        if (this.mask[sourceY * this.width + sourceX]) next[y * this.width + x] = 255
      }
    }

    this.mask = next
    this.#recomputeBounds()
  }

  /* ----------------------------------------------------------------- global */

  selectAll(width, height) {
    this.#ensure(width, height).fill(255)
    this.#recomputeBounds()
  }

  invert() {
    if (!this.mask) return
    for (let i = 0; i < this.mask.length; i += 1) this.mask[i] = this.mask[i] ? 0 : 255
    this.#recomputeBounds()
  }
}