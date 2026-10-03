import Layer from './Layer.js'
import { MAX_DOCUMENT_DIM } from './constants.js'

const clampDim = (value) => Math.min(MAX_DOCUMENT_DIM, Math.max(1, Math.round(value || 1)))

/**
 * The document: size, paper colour, and the ordered layer stack.
 *
 * Order convention (matches the UI panel): `layers[0]` is the TOP of the
 * stack. Compositors iterate `compositingOrder()` which reverses it, so the
 * panel and the renderer can never disagree about which layer is on top.
 */
export default class DocumentModel {
  constructor({ width = 1920, height = 1080, name = 'Untitled artwork', paper = '#ffffff' } = {}) {
    this.name = name
    this.width = clampDim(width)
    this.height = clampDim(height)
    this.paper = paper
    /** @type {Layer[]} top-first */
    this.layers = []
    this.activeLayerId = null
    /** @type {null | (() => void)} set by EditorController */
    this.onStructureChange = null
  }

  /* ---------------------------------------------------------------- layers */

  get activeLayer() {
    return this.getLayer(this.activeLayerId)
  }

  getLayer(id) {
    return this.layers.find((layer) => layer.id === id) ?? null
  }

  indexOf(id) {
    return this.layers.findIndex((layer) => layer.id === id)
  }

  /** Bottom-to-top order, ready for drawing. */
  compositingOrder() {
    return [...this.layers].reverse()
  }

  addLayer(options = {}) {
    const layer = new Layer({ width: this.width, height: this.height, ...options })

    // A brand-new layer gets a visible footprint immediately — an invisible,
    // empty layer reads as a bug to anyone using the app.
    if (!options.fill && options.transparent !== true) {
      layer.fillAll('#f4f4f8')
    }

    this.layers.unshift(layer)
    this.activeLayerId = layer.id
    this.#changed()
    return layer
  }

  /** Insert an existing layer at a stack position (used by history redo). */
  insertLayer(layer, index = 0) {
    const at = Math.max(0, Math.min(index, this.layers.length))
    this.layers.splice(at, 0, layer)
    if (!this.activeLayerId) this.activeLayerId = layer.id
    this.#changed()
    return layer
  }

  /**
   * @param {string} id
   * @param {{ force?: boolean }} [options] force allows removing the last layer
   *   (history undo of an "add layer" must be able to empty the stack).
   */
  removeLayer(id, { force = false } = {}) {
    if (!force && this.layers.length <= 1) return false

    const index = this.indexOf(id)
    if (index === -1) return false

    this.layers[index].dispose()
    this.layers.splice(index, 1)

    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[0].id
    }
    this.#changed()
    return true
  }

  duplicateLayer(id) {
    const source = this.getLayer(id)
    if (!source) return null

    const copy = new Layer({
      name: `${source.name} copy`,
      width: this.width,
      height: this.height,
      opacity: source.opacity,
      blendMode: source.blendMode,
      transparent: true,
    })

    copy.ensureCanvas()
    copy.context.drawImage(source.ensureCanvas(), 0, 0)

    const index = this.indexOf(id)
    this.layers.splice(index + 1, 0, copy)
    this.activeLayerId = copy.id
    this.#changed()
    return copy
  }

  setLayerProps(id, patch) {
    const layer = this.getLayer(id)
    if (!layer) return null

    Object.assign(layer, patch)
    this.#changed()
    return layer
  }

  selectLayer(id) {
    if (!this.getLayer(id)) return
    this.activeLayerId = id
    this.#changed()
  }

  /* -------------------------------------------------------------- document */

  resize(width, height) {
    const nextWidth = clampDim(width)
    const nextHeight = clampDim(height)
    if (nextWidth === this.width && nextHeight === this.height) return false

    this.width = nextWidth
    this.height = nextHeight
    for (const layer of this.layers) layer.resize(nextWidth, nextHeight)
    this.#changed()
    return true
  }

  setPaper(color) {
    this.paper = color
    this.#changed()
  }

  /** Topmost layer the pointer can paint on, honouring visibility/locks. */
  paintableLayer() {
    const index = this.indexOf(this.activeLayerId)
    if (index !== -1) {
      const active = this.layers[index]
      if (!active.locked && active.visible) return active
    }
    return this.layers.find((layer) => layer.visible && !layer.locked) ?? null
  }

  toJSON() {
    return {
      name: this.name,
      width: this.width,
      height: this.height,
      paper: this.paper,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map((layer) => layer.toJSON()),
    }
  }

  #changed() {
    this.onStructureChange?.()
  }
}