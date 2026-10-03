import StrokeTool from './StrokeTool.js'

/**
 * Eraser — the same sampler as the brush, composited with `destination-out`
 * so it removes pixels (and their alpha) instead of painting colour.
 *
 * "Block" mode ignores the hardness slider and erases with a hard edge, which
 * is what the options-bar toggle expects.
 */
export default class EraserTool extends StrokeTool {
  static id = 'eraser'
  static cursor = 'crosshair'
  static label = 'Erase'
  static optionDefaults = {
    size: 24,
    hardness: 60,
    opacity: 100,
    flow: 100,
    spacing: 12,
    smoothing: 0,
    pressure: false,
  }

  get mode() {
    return 'destination-out'
  }

  hardnessFor(options) {
    return options.eraserMode === 'block' ? 100 : options.hardness
  }

  /** Colour is irrelevant when compositing with destination-out. */
  tipColor() {
    return '#000000'
  }
}