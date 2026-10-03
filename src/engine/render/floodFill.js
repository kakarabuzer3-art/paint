import { createRect } from './dirtyRect.js'

/**
 * Scanline flood fill.
 *
 * Works on a single ImageData pass with an explicit stack (no recursion, so a
 * full-canvas fill cannot blow the call stack) plus a `visited` byte array.
 * Pixels are matched by squared colour distance so `tolerance` costs one
 * multiply instead of a sqrt per pixel.
 *
 * Returns the dirty rect it changed, or null when nothing matched — callers
 * use that to skip the recomposite entirely.
 *
 * Cost: one getImageData/putImageData of the whole layer. Fine for a
 * one-shot action; a progressive/tiled version is a Phase 8 optimisation.
 */
export function floodFill(context, { x, y, width, height, fill, tolerance = 32, contiguous = true }) {
  const px = Math.floor(x)
  const py = Math.floor(y)

  if (px < 0 || py < 0 || px >= width || py >= height) return null

  const imageData = context.getImageData(0, 0, width, height)
  const data = imageData.data

  const origin = (py * width + px) * 4
  const target = [data[origin], data[origin + 1], data[origin + 2], data[origin + 3]]
  const limit = tolerance * tolerance * 4 // 4 channels in the distance

  const matches = (index) => {
    const dr = data[index] - target[0]
    const dg = data[index + 1] - target[1]
    const db = data[index + 2] - target[2]
    const da = data[index + 3] - target[3]
    return dr * dr + dg * dg + db * db + da * da <= limit
  }

  const paint = (index) => {
    data[index] = fill[0]
    data[index + 1] = fill[1]
    data[index + 2] = fill[2]
    data[index + 3] = fill[3]
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  const mark = (column, row) => {
    if (column < minX) minX = column
    if (column > maxX) maxX = column
    if (row < minY) minY = row
    if (row > maxY) maxY = row
  }

  if (contiguous) {
    const visited = new Uint8Array(width * height)
    const stack = [px, py]

    while (stack.length > 0) {
      const row = stack.pop()
      const column = stack.pop()
      if (visited[row * width + column]) continue

      let left = column
      while (left > 0 && !visited[row * width + left - 1] && matches((row * width + left - 1) * 4)) {
        left -= 1
      }

      let right = column
      while (
        right < width - 1 &&
        !visited[row * width + right + 1] &&
        matches((row * width + right + 1) * 4)
      ) {
        right += 1
      }

      for (let i = left; i <= right; i += 1) {
        visited[row * width + i] = 1
        paint((row * width + i) * 4)
        mark(i, row)
      }

      // Seed the rows above and below for every matching span pixel.
      for (const neighbour of [row - 1, row + 1]) {
        if (neighbour < 0 || neighbour >= height) continue
        for (let i = left; i <= right; i += 1) {
          if (!visited[neighbour * width + i] && matches((neighbour * width + i) * 4)) {
            stack.push(i, neighbour)
          }
        }
      }
    }
  } else {
    // "Replace colour everywhere" — the magic-wand non-contiguous mode.
    for (let index = 0; index < data.length; index += 4) {
      if (!matches(index)) continue
      paint(index)
      const pixel = index / 4
      mark(pixel % width, Math.floor(pixel / width))
    }
  }

  if (maxX < 0) return null

  context.putImageData(imageData, 0, 0)
  return createRect(minX, minY, maxX - minX + 1, maxY - minY + 1)
}