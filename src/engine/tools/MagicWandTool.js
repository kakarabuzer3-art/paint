import Tool from './Tool.js'

/**
 * Magic wand — one click selects a colour region from the composited image.
 *
 * Samples the *composite* rather than the active layer, matching what the user
 * can see. Tolerance and contiguity come straight from the options bar.
 */
export default class MagicWandTool extends Tool {
  static id = 'magicWand'
  static cursor = 'crosshair'
  static optionDefaults = { tolerance: 32, contiguous: true, selectionMode: 'new' }

  onPointerDown(event) {
    const source = this.context.getCompositeImageData()
    if (!source) return

    const options = { ...MagicWandTool.optionDefaults, ...this.context.getOptions() }

    this.context.selection.selectByColour({
      x: event.docX,
      y: event.docY,
      width: this.context.document.width,
      height: this.context.document.height,
      data: source.data,
      tolerance: options.tolerance ?? 32,
      contiguous: options.contiguous !== false,
      mode: options.selectionMode ?? 'new',
    })

    this.context.invalidateOverlay()
    this.context.onSelectionChange?.()
  }
}