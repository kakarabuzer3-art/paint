/**
 * Engine-wide constants.
 *
 * Lives in engine/ (not ui/data) because the canvas engine must never import
 * from the React layer — the dependency arrow only ever points ui/ → engine/.
 */

/** Canonical z-order of the three DOM surfaces. */
export const SURFACES = ['composite', 'scratch', 'overlay']

/**
 * Zoom ladder. Snapping through recognised steps beats free-floating scale —
 * the same reason 100%/200%/400% stops exist in every editor.
 */
export const ZOOM_STOPS = [
  0.05, 0.08, 0.12, 0.16, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32,
]

export const MIN_ZOOM = ZOOM_STOPS[0]
export const MAX_ZOOM = ZOOM_STOPS[ZOOM_STOPS.length - 1]

/** Breathing room around the artboard when fitting. */
export const FIT_PADDING = 72

/** Largest document dimension before the UI warns the user (see dialogs). */
export const MAX_DOCUMENT_DIM = 8192

/**
 * Rendering rules (Phase 0 decision):
 *   composite — all visible layers, redrawn only on layer commit/reorder/undo
 *   scratch   — the in-flight stroke, cleared every frame while interacting
 *   overlay   — screen-space UI (cursor ring, marquee); never exported
 */
export const RENDER = {
  COMPOSITE: 1 << 0,
  SCRATCH: 1 << 1,
  OVERLAY: 1 << 2,
}

export const EVENTS = {
  VIEWPORT: 'viewport',
  DOCUMENT: 'document',
  LAYERS: 'layers',
  RENDER: 'render',
  POINTER: 'pointer',
  TOOL: 'tool',
  HISTORY: 'history',
  SELECTION: 'selection',
}

/** Canvas 2D blend modes the layer panel can offer. */
export const BLEND_MODES = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]

/** Overlay metrics, in CSS pixels (constant regardless of zoom). */
export const OVERLAY = {
  CURSOR_RING_WIDTH: 1.5,
  CURSOR_CROSS: 9,
  HANDLE: 8,
  MARQUEE_DASH: 4,
  MARQUEE_GAP: 4,
}