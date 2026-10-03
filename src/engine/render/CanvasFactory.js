/**
 * Canvas surface creation and sizing.
 *
 * Two kinds of surface, sized differently on purpose:
 *
 *  - document surfaces (composite, scratch): backing store equals document
 *    pixels, and CSS `transform` does the zooming (per MDN's optimisation
 *    guidance). The 2D context therefore works in *document* coordinates
 *    with no scaling transform at all.
 *  - screen surface (overlay): backing store is viewport × devicePixelRatio
 *    and the context is scaled by DPR, because overlay UI (cursor ring,
 *    marquee, handles) must stay crisp at any zoom.
 */

/** Create a DOM canvas plus its 2D context. */
export function createSurface({ alpha = true } = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha })
  return { canvas, ctx }
}

/** Size a composite/scratch surface to document resolution (CSS = pixels). */
export function sizeDocumentSurface(surface, docWidth, docHeight) {
  const width = Math.max(1, Math.round(docWidth))
  const height = Math.max(1, Math.round(docHeight))

  if (surface.canvas.width !== width || surface.canvas.height !== height) {
    surface.canvas.width = width
    surface.canvas.height = height
  }

  surface.canvas.style.width = `${width}px`
  surface.canvas.style.height = `${height}px`

  // Identity transform: document pixel space.
  surface.ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/** Size the overlay to viewport CSS pixels × DPR and scale its context. */
export function sizeScreenSurface(surface, cssWidth, cssHeight, dpr) {
  const ratio = Math.min(dpr || 1, 3) // cap: 3× already costs ~64MB at 4K
  const width = Math.max(1, Math.round(cssWidth))
  const height = Math.max(1, Math.round(cssHeight))

  if (surface.canvas.width !== Math.round(width * ratio)) {
    surface.canvas.width = Math.round(width * ratio)
  }
  if (surface.canvas.height !== Math.round(height * ratio)) {
    surface.canvas.height = Math.round(height * ratio)
  }

  surface.canvas.style.width = `${width}px`
  surface.canvas.style.height = `${height}px`

  surface.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ratio
}

/** Device pixel ratio, guarded for non-browser environments. */
export function getDpr() {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio || 1
}