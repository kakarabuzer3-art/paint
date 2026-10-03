import Tool from './Tool.js'
import { rgbToHex } from '../../lib/color.js'

/**
 * Eyedropper — samples the *composited* pixel under the pointer.
 *
 * Sampling the composite (rather than the active layer) matches what the user
 * can actually see, which is the whole point of an eyedropper: they pick the
 * colour that appears on screen, including anything composited above.
 */
export default class EyedropperTool extends Tool {
  static id = 'eyedropper'
  static cursor = 'crosshair'
  static optionDefaults = { sampleSize: 'point' }

  onPointerDown(event) {
    const options = { ...EyedropperTool.optionDefaults, ...this.context.getOptions() }
    const rgba = this.context.sampleDocumentColor(event.docX, event.docY, options.sampleSize)

    if (!rgba) return

    this.context.onPickColor?.(rgbToHex(rgba))
  }

  onPointerMove() {}
}