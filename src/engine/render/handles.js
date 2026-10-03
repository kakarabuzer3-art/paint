import { OVERLAY } from '../core/constants.js'

/**
 * Resize-handle geometry, shared by the overlay (drawing) and the transform
 * tool (hit-testing and scaling maths).
 *
 * Handles live in *screen* space: they stay a constant size and a constant
 * grab distance at any zoom, which is what makes them feel like UI rather
 * than artwork.
 */
export const HANDLES = [
  { id: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize', anchorX: 1, anchorY: 1 },
  { id: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize', anchorX: 0.5, anchorY: 1 },
  { id: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize', anchorX: 0, anchorY: 1 },
  { id: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize', anchorX: 0, anchorY: 0.5 },
  { id: 'se', fx: 1, fy: 1, cursor: 'nwse-resize', anchorX: 0, anchorY: 0 },
  { id: 's', fx: 0.5, fy: 1, cursor: 'ns-resize', anchorX: 0.5, anchorY: 0 },
  { id: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize', anchorX: 1, anchorY: 0 },
  { id: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize', anchorX: 1, anchorY: 0.5 },
]

/** Screen-space centre of each handle for a document-space rect. */
export function handlePositions(rect, viewport) {
  const topLeft = viewport.docToScreen(rect.x, rect.y)
  const width = viewport.toScreenLength(rect.width)
  const height = viewport.toScreenLength(rect.height)

  return HANDLES.map((handle) => ({
    ...handle,
    x: topLeft.x + width * handle.fx,
    y: topLeft.y + height * handle.fy,
  }))
}

/**
 * Handle under a screen point, or null.
 * @param {number} tolerance grab radius in CSS pixels
 */
export function hitTestHandles(rect, viewport, screenX, screenY, tolerance = OVERLAY.HANDLE + 3) {
  for (const handle of handlePositions(rect, viewport)) {
    if (Math.abs(handle.x - screenX) <= tolerance && Math.abs(handle.y - screenY) <= tolerance) {
      return handle
    }
  }
  return null
}