import StrokeTool from './StrokeTool.js'

/**
 * Soft round brush.
 * Options come from the UI (size, hardness, opacity, flow, spacing,
 * smoothing, pressure, blend mode); these are only the fallbacks used when a
 * tool is activated programmatically (e.g. from a test or the palette).
 */
export default class BrushTool extends StrokeTool {
  static id = 'brush'
  static cursor = 'crosshair'
  static label = 'Brush stroke'
  static optionDefaults = {
    size: 24,
    hardness: 82,
    opacity: 100,
    flow: 100,
    spacing: 12,
    smoothing: 40,
    pressure: false,
  }
}