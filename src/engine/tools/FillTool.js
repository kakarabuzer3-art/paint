import Tool from './Tool.js'
import { floodFill } from '../render/floodFill.js'
import { hexToRgb } from '../../lib/color.js'

/**
 * Paint bucket — one-shot flood fill of the contiguous (or matching) region
 * under the pointer on the active layer.
 *
 * Anti-aliased edges are not flood-filled (they contain intermediate colours
 * and would leave a halo); the options-bar toggle is accepted here and the
 * AA pass is a Phase 8 refinement.
 */
export default class FillTool extends Tool {
  static id = 'fill'
  static cursor = 'crosshair'
  static optionDefaults = { tolerance: 32, contiguous: true, opacity: 100, blendMode: 'source-over' }

  onPointerDown(event) {
    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Nothing to fill on', 'Add an unlocked, visible layer first.')
      return
    }

    const options = { ...FillTool.optionDefaults, ...this.context.getOptions() }
    const { r, g, b } = hexToRgb(this.context.getColors().primary ?? '#000000')

    const patch = this.context.beginRegionPatch(layer)

    const rect = floodFill(layer.context, {
      x: event.docX,
      y: event.docY,
      width: layer.width,
      height: layer.height,
      fill: [r, g, b, 255],
      tolerance: options.tolerance ?? 32,
      contiguous: options.contiguous !== false,
    })

    if (rect) {
      this.context.commitRegionPatch(patch, rect, 'Fill')
      return
    }

    this.context.abandonRegionPatch(patch, rect)
    this.context.notice?.(
      'Nothing to fill',
      'The tolerance may be too low for this colour, or the area is already that colour.',
    )
  }
}