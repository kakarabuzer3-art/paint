import Command from './Command.js'

/**
 * Undoable pixel change over a single rectangular band.
 *
 * This is the workhorse of the history system: brushes, fills, erases, moves
 * and transforms all reduce to "these pixels changed from A to B". Storing
 * two ImageData slices of a 200×200 band costs ~320KB instead of the ~8MB a
 * full-canvas snapshot of a 1920×1080 layer would.
 */
export class PixelPatchCommand extends Command {
  /**
   * @param {import('../core/DocumentModel.js').default} document
   * @param {import('../core/Layer.js').default} layer
   * @param {{x:number,y:number,width:number,height:number}} rect
   * @param {ImageData} before
   * @param {ImageData} after
   */
  constructor(document, layer, rect, before, after, label = 'Stroke') {
    super({ label, kind: 'pixels' })
    this.document = document
    this.layerId = layer.id
    this.patchRect = rect
    this.before = before
    this.after = after
  }

  get rect() {
    return this.patchRect
  }

  get memoryCost() {
    return (this.before?.data?.length ?? 0) + (this.after?.data?.length ?? 0)
  }

  #apply(imageData) {
    const layer = this.document.getLayer(this.layerId)
    if (!layer) return // layer deleted since — nothing to restore
    layer.context.putImageData(imageData, this.patchRect.x, this.patchRect.y)
  }

  do() {
    this.#apply(this.after)
  }

  undo() {
    this.#apply(this.before)
  }
}

/** Adds a layer (new layer, paste, duplicate). */
export class AddLayerCommand extends Command {
  constructor(document, layer, index = 0, label = 'Add layer') {
    super({ label, kind: 'structure' })
    this.document = document
    this.layer = layer
    this.index = index
  }

  do() {
    this.document.insertLayer(this.layer, this.index)
  }

  undo() {
    this.document.removeLayer(this.layer.id, { force: true })
  }
}

/** Removes a layer, keeping the object (and therefore its pixels) for redo. */
export class DeleteLayerCommand extends Command {
  constructor(document, layer, index, label = 'Delete layer') {
    super({ label, kind: 'structure' })
    this.document = document
    this.layer = layer
    this.index = index
  }

  do() {
    this.document.removeLayer(this.layer.id, { force: true })
  }

  undo() {
    this.document.insertLayer(this.layer, this.index)
  }
}

/** Layer metadata: visibility, opacity, blend mode, name. */
export class LayerPropsCommand extends Command {
  constructor(document, layerId, before, after, label = 'Layer settings') {
    super({ label, kind: 'structure' })
    this.document = document
    this.layerId = layerId
    this.before = before
    this.after = after
  }

  do() {
    this.document.setLayerProps(this.layerId, this.after)
  }

  undo() {
    this.document.setLayerProps(this.layerId, this.before)
  }
}

/**
 * Document resize. Undo re-runs the resize with the previous dimensions;
 * content added *after* shrinking is lost, which matches how a raster
 * document behaves once pixels are discarded.
 */
export class DocResizeCommand extends Command {
  constructor(document, from, to) {
    super({ label: 'Resize document', kind: 'structure' })
    this.document = document
    this.from = from
    this.to = to
  }

  do() {
    this.document.resize(this.to.width, this.to.height)
  }

  undo() {
    this.document.resize(this.from.width, this.from.height)
  }
}