import { RENDER } from '../core/constants.js'

/**
 * The single rAF loop. Nothing else in the engine may call requestAnimationFrame.
 *
 * Why one loop: coalescing every invalidation into one pass per frame is what
 * keeps a fast mouse from queueing 200 repaints per second, and it guarantees
 * surfaces are drawn in a fixed order (composite → scratch → overlay).
 * Requests that arrive *during* a frame schedule the next one instead of
 * dropping, so a stroke never loses a repaint.
 *
 * Handlers are injected, so the scheduler has no knowledge of canvases and
 * can be exercised without a DOM.
 */
export default class RenderScheduler {
  constructor(handlers = {}) {
    this.handlers = handlers
    this.flags = 0
    this.frame = 0
    this.lastTime = 0
    /** Rolling frame durations (ms) for the Phase 8 performance HUD. */
    this.frameTimes = []
    this.loop = this.loop.bind(this)
  }

  get running() {
    return this.frame !== 0
  }

  requestComposite() {
    this.#schedule(RENDER.COMPOSITE)
  }

  requestScratch() {
    this.#schedule(RENDER.SCRATCH)
  }

  requestOverlay() {
    this.#schedule(RENDER.OVERLAY)
  }

  requestAll() {
    this.#schedule(RENDER.COMPOSITE | RENDER.SCRATCH | RENDER.OVERLAY)
  }

  /** Rolling average frame time, or 0 before two frames have run. */
  get averageFrameTime() {
    if (this.frameTimes.length < 2) return 0
    const total = this.frameTimes.reduce((sum, value) => sum + value, 0)
    return total / this.frameTimes.length
  }

  loop(time) {
    this.frame = 0

    const flags = this.flags
    this.flags = 0

    if (this.lastTime) {
      this.frameTimes.push(time - this.lastTime)
      if (this.frameTimes.length > 60) this.frameTimes.shift()
    }
    this.lastTime = time

    if (flags & RENDER.COMPOSITE) this.handlers.composite?.()
    if (flags & RENDER.SCRATCH) this.handlers.scratch?.()
    if (flags & RENDER.OVERLAY) this.handlers.overlay?.()

    // Anything invalidated mid-frame gets the next frame, not a lost repaint.
    if (this.flags) this.#schedule(this.flags)
  }

  #schedule(flag) {
    this.flags |= flag
    if (!this.frame) this.frame = requestAnimationFrame(this.loop)
  }

  dispose() {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.flags = 0
    this.frameTimes.length = 0
  }
}