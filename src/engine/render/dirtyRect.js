/**
 * Integer dirty-rectangle helpers.
 *
 * Dirty rectangles are the single biggest win in a canvas editor: a brush
 * stroke only repaints the band it touched, not the whole document. Rects are
 * always integral (integer document pixels) because sub-pixel rects force the
 * compositor into slower antialiasing paths for no visual gain.
 *
 * Pure functions — unit-tested in scripts/engine-smoke.mjs.
 */

/** @returns {{ x: number, y: number, width: number, height: number }} */
export function createRect(x, y, width, height) {
  return { x: Math.floor(x), y: Math.floor(y), width: Math.ceil(width), height: Math.ceil(height) }
}

export function emptyRect() {
  return { x: 0, y: 0, width: 0, height: 0 }
}

export function isEmptyRect(rect) {
  return !rect || rect.width <= 0 || rect.height <= 0
}

/** Normalise a rect given by a drag (which may have negative extents). */
export function fromPoints(x1, y1, x2, y2) {
  return createRect(
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
  )
}

export function expandRect(rect, amount) {
  if (isEmptyRect(rect)) return rect
  return createRect(
    rect.x - amount,
    rect.y - amount,
    rect.width + amount * 2,
    rect.height + amount * 2,
  )
}

export function unionRect(a, b) {
  if (isEmptyRect(a)) return b ? { ...b } : null
  if (isEmptyRect(b)) return { ...a }

  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return createRect(x, y, right - x, bottom - y)
}

export function intersectRect(a, b) {
  if (isEmptyRect(a) || isEmptyRect(b)) return null

  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return createRect(x, y, right - x, bottom - y)
}

/** Clamp to a document bounds, returning null when fully outside. */
export function clampRect(rect, bounds) {
  const clipped = intersectRect(rect, bounds)
  return clipped
}

/** Round outward so nothing on the edge is missed. */
export function toCoverRect(rect) {
  if (isEmptyRect(rect)) return rect
  const x = Math.floor(rect.x)
  const y = Math.floor(rect.y)
  return createRect(x, y, Math.ceil(rect.x + rect.width) - x, Math.ceil(rect.y + rect.height) - y)
}

export function rectsEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}