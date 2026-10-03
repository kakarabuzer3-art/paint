import { createPixelCanvas } from '../core/pixelCanvas.js'
import { createRect } from '../render/dirtyRect.js'

/**
 * Pixel operations driven by a selection mask.
 *
 * Every function takes the tight bounding box of the mask, so a 4px
 * lasso inside a 4K document copies 16 pixels, not 8 million.
 */

/** Copy the selected pixels (and mask) out of a layer. */
export function extractSelection(layer, selection) {
  const { bounds } = selection
  if (!bounds) return null

  const rect = createRect(bounds.x, bounds.y, bounds.width, bounds.height)
  const imageData = layer.context.getImageData(rect.x, rect.y, rect.width, rect.height)
  const mask = new Uint8Array(rect.width * rect.height)

  for (let y = 0; y < rect.height; y += 1) {
    const sourceRow = (rect.y + y) * selection.width + rect.x
    for (let x = 0; x < rect.width; x += 1) {
      const index = y * rect.width + x
      if (!selection.mask[sourceRow + x]) continue

      mask[index] = 255
      // Pixels outside the mask must not travel with the selection.
      const p = index * 4
      imageData.data[p] = 0
      imageData.data[p + 1] = 0
      imageData.data[p + 2] = 0
      imageData.data[p + 3] = 0
    }
  }

  return { rect, imageData, mask, width: rect.width, height: rect.height }
}

/** Erase the selected pixels. Returns the affected rect. */
export function clearSelection(layer, selection) {
  const { bounds } = selection
  if (!bounds) return null

  const rect = createRect(bounds.x, bounds.y, bounds.width, bounds.height)
  const imageData = layer.context.getImageData(rect.x, rect.y, rect.width, rect.height)

  for (let y = 0; y < rect.height; y += 1) {
    const sourceRow = (rect.y + y) * selection.width + rect.x
    for (let x = 0; x < rect.width; x += 1) {
      if (!selection.mask[sourceRow + x]) continue
      const p = (y * rect.width + x) * 4
      imageData.data[p] = 0
      imageData.data[p + 1] = 0
      imageData.data[p + 2] = 0
      imageData.data[p + 3] = 0
    }
  }

  layer.context.putImageData(imageData, rect.x, rect.y)
  return rect
}

/** Draw a previously extracted payload onto a layer at a document position. */
export function stampSelection(layer, payload, x, y) {
  if (!payload) return null

  const target = createPixelCanvas(payload.width, payload.height)
  const tctx = target.getContext('2d')
  tctx.putImageData(payload.imageData, 0, 0)

  // Re-apply the mask: extraction keeps unselected pixels transparent, but a
  // payload can also come from an external source with its own alpha.
  const masked = tctx.getImageData(0, 0, payload.width, payload.height)
  for (let i = 0; i < payload.mask.length; i += 1) {
    if (payload.mask[i]) continue
    masked.data[i * 4] = 0
    masked.data[i * 4 + 1] = 0
    masked.data[i * 4 + 2] = 0
    masked.data[i * 4 + 3] = 0
  }
  tctx.putImageData(masked, 0, 0)

  layer.context.drawImage(target, Math.round(x), Math.round(y))
  return createRect(x, y, payload.width, payload.height)
}