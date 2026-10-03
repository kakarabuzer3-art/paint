import { createPixelCanvas } from '../core/pixelCanvas.js'

/**
 * Brush tip cache + stroke sampler.
 *
 * Two ideas do the heavy lifting here:
 *
 * 1. **Pre-rendered tips.** Per MDN's optimisation guidance, a brush tip is a
 *    repeating primitive, so it is rasterised once into a small canvas and
 *    then stamped with `drawImage`. Re-creating a radial gradient per stamp is
 *    the single most expensive thing a canvas brush can do.
 *    Tips are keyed by colour+size+hardness (colour-keyed so a stamp can be
 *    drawn straight onto the layer with `source-over`, no per-stamp tinting).
 *
 * 2. **Residual-based spacing.** Input events arrive at irregular distances;
 *    spacing stays uniform by carrying the leftover distance between samples
 *    instead of restarting at each point. Without it, fast strokes dot and
 *    slow strokes blob.
 */

/** Colour chosen so a neutral tip is still recognisable in the cache view. */
const MAX_CACHED_TIPS = 32

const tipCache = new Map()

export function clearTipCache() {
  tipCache.clear()
}

/**
 * Rasterised circular tip.
 * @param {{ color: string, size: number, hardness: number }} spec
 * @returns {OffscreenCanvas | HTMLCanvasElement}
 */
export function getBrushTip({ color, size, hardness }) {
  const diameter = Math.max(1, Math.ceil(Math.max(1, size)))
  const key = `${color}|${diameter}|${Math.round(hardness)}`

  const cached = tipCache.get(key)
  if (cached) return cached

  const radius = diameter / 2
  const canvas = createPixelCanvas(diameter, diameter)
  const ctx = canvas.getContext('2d')
  const centre = radius

  if (hardness >= 98) {
    // Pixel-crisp edge: no gradient at all.
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const inner = radius * (Math.min(99, Math.max(0, hardness)) / 100)
    const gradient = ctx.createRadialGradient(centre, centre, inner, centre, centre, radius)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, `${color}00`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, diameter, diameter)
  }

  // Cheap FIFO eviction — enough to keep a 200px brush storm from growing.
  if (tipCache.size >= MAX_CACHED_TIPS) {
    tipCache.delete(tipCache.keys().next().value)
  }
  tipCache.set(key, canvas)

  return canvas
}

/**
 * Stateful stroke sampler.
 *
 * Feed it raw pointer samples; it returns the positions where a tip should be
 * stamped, with optional positional smoothing applied first.
 */
export default class BrushEngine {
  constructor() {
    this.reset()
  }

  reset() {
    this.last = null
    this.residual = 0
  }

  /**
   * Exponential smoothing: pulls each sample toward the previous one.
   * @param {{x: number, y: number}} point
   * @param {number} amount 0 = off, ~90 = very heavy
   */
  static smooth(previous, point, amount) {
    if (!previous || amount <= 0) return { x: point.x, y: point.y }
    const factor = 1 - Math.min(0.95, amount / 100) * 0.9
    return {
      x: previous.x + (point.x - previous.x) * factor,
      y: previous.y + (point.y - previous.y) * factor,
    }
  }

  /**
   * @returns {Array<{x: number, y: number}>} stamp positions for this segment
   */
  extend(point, { size = 12, spacing = 12 } = {}) {
    if (!this.last) {
      this.last = point
      return [{ ...point }]
    }

    const dx = point.x - this.last.x
    const dy = point.y - this.last.y
    const distance = Math.hypot(dx, dy)
    const step = Math.max(1, (size * Math.max(1, spacing)) / 100)

    if (distance < 0.0001) return []

    const stamps = []
    let travelled = this.residual + distance

    while (travelled >= step) {
      const t = (distance - travelled + step) / distance
      stamps.push({ x: this.last.x + dx * t, y: this.last.y + dy * t })
      travelled -= step
    }

    this.residual = travelled
    this.last = point

    return stamps
  }

  /** Force a stamp at the final position (avoids a dotty stroke end). */
  finish(point) {
    if (!this.last) return [{ ...point }]
    const distance = Math.hypot(point.x - this.last.x, point.y - this.last.y)
    return distance < 0.5 ? [] : [{ ...point }]
  }
}