import ShapeTool from './ShapeTool.js'

/**
 * Ellipse / circle. Identical interaction to the rectangle tool — only the
 * path construction differs, which is why it subclasses rather than forking.
 * Shift constrains to a circle.
 */
export default class EllipseTool extends ShapeTool {
  static id = 'ellipse'
  static cursor = 'crosshair'
  static kind = 'ellipse'
  static label = 'Ellipse'

  static pathFor(ctx, rect) {
    const { x, y, width, height } = rect
    if (width < 1 || height < 1) return null

    const path = new Path2D()
    path.ellipse(
      x + width / 2,
      y + height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      Math.PI * 2,
    )
    return path
  }
}