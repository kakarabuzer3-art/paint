import StrokeTool from './StrokeTool.js'

/**
 * Hard-edged pencil — one sample per device pixel, no gradient tip.
 *
 * `hardness: 100` makes getBrushTip() skip the radial gradient entirely and
 * stamp a hard circle, which is what gives the pencil its 1:1 pixel look.
 */
export default class PencilTool extends StrokeTool {
  static id = 'pencil'
  static cursor = 'crosshair'
  static label = 'Pencil line'
  static optionDefaults = {
    size: 6,
    hardness: 100,
    opacity: 100,
    flow: 100,
    spacing: 2, // dense enough that the outline has no gaps
    smoothing: 0,
    pressure: false,
  }
}