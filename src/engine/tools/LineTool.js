import Tool from './Tool.js'
import { createRect, unionRect } from '../render/dirtyRect.js'

const SNAP = Math.PI / 12 // 15° increments, the convention users expect

/**
 * Straight line tool.
 *
 * Same preview-then-commit model as the shapes: the line lives on the scratch
 * surface until release. Shift snaps to 15° so straight edges (wireframes,
 * perspective guides) are quick to draw.
 */
export default class LineTool extends Tool {
  static id = 'line'
  static cursor = 'crosshair'
  static label = 'Line'
  static optionDefaults = { strokeWidth: 4, strokeSource: 'secondary' }

  #start = null
  #layer = null
  #patch = null
  #dirty = null

  onActivate() {
    this.#reset()
  }

  onPointerDown(event) {
    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Nothing to draw on', 'Add an unlocked, visible layer first.')
      return
    }

    this.#layer = layer
    this.#start = { x: event.docX, y: event.docY }
    this.#patch = this.context.beginRegionPatch(layer)
    this.#preview(event)
  }

  onPointerMove(event) {
    if (!this.#start) return
    this.#preview(event)
  }

  onPointerUp(event) {
    if (!this.#start) return
    this.#preview(event)
    this.#commit()
  }

  onPointerCancel() {
    if (this.#patch) this.context.abandonRegionPatch(this.#patch, this.#dirty)
    this.#reset()
    this.context.requestScratch(null)
    this.context.invalidateOverlay()
  }

  /* --------------------------------------------------------------- internals */

  #reset() {
    this.#start = null
    this.#layer = null
    this.#dirty = null
    this.#patch = null
  }

  #endPoint(event) {
    const { x, y } = this.#start
    let dx = event.docX - x
    let dy = event.docY - y

    if (event.shiftKey) {
      const angle = Math.round(Math.atan2(dy, dx) / SNAP) * SNAP
      const length = Math.hypot(dx, dy)
      dx = Math.cos(angle) * length
      dy = Math.sin(angle) * length
    }

    return { x: x + dx, y: y + dy }
  }

  #preview(event) {
    const scratch = this.context.scratch
    if (!scratch) return

    const options = { ...LineTool.optionDefaults, ...this.context.getOptions() }
    const width = Math.max(1, options.strokeWidth ?? 4)
    const end = this.#endPoint(event)
    const start = this.#start

    scratch.paint((ctx) => {
      ctx.globalAlpha = (options.opacity ?? 100) / 100
      ctx.lineCap = 'round'
      ctx.lineWidth = width
      ctx.strokeStyle = this.context.getColors().secondary ?? '#ffffff'
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    })

    const band = createRect(
      Math.min(start.x, end.x) - width - 2,
      Math.min(start.y, end.y) - width - 2,
      Math.abs(end.x - start.x) + width * 2 + 4,
      Math.abs(end.y - start.y) + width * 2 + 4,
    )

    this.#dirty = unionRect(this.#dirty, band)
    this.context.requestScratch(band)
  }

  #commit() {
    if (this.#dirty && this.#layer) {
      this.context.scratch?.commitInto(this.#layer, this.#dirty)
      this.context.commitRegionPatch(this.#patch, this.#dirty, LineTool.label)
    } else if (this.#patch) {
      this.context.abandonRegionPatch(this.#patch, null)
    }

    this.#reset()
    this.context.requestScratch(null)
    this.context.invalidateOverlay()
  }
}