/**
 * Seed values for the UI shell.
 *
 * Keeping defaults in one module is what makes "sensible defaults" a
 * deliberate design decision rather than scattered literals.
 */

/** Initial value for every option id declared in data/tools.js */
export const DEFAULT_OPTIONS = {
  /* brush family */
  size: 24,
  hardness: 82,
  opacity: 100,
  flow: 100,
  spacing: 12,
  smoothing: 40,
  pressure: true,
  /* selection / fill */
  tolerance: 32,
  feather: 0,
  contiguous: true,
  antialias: true,
  selectionMode: 'new',
  /* eraser */
  eraserMode: 'soft',
  /* eyedropper */
  sampleSize: 'point',
  /* shapes */
  shapeMode: 'fill',
  strokeWidth: 4,
  cornerRadius: 0,
  /* text */
  fontSize: 72,
  letterSpacing: 0,
  lineHeight: 120,
  fontFamily: 'sans',
  /* colour application */
  blendMode: 'source-over',
  /* view */
  zoomPreset: 'in',
}

export const DEFAULT_DOC = {
  name: 'Untitled artwork',
  width: 1920,
  height: 1080,
}

/** Curated 24-swatch studio palette (harmonised, not random hex soup). */
export const DEFAULT_PALETTE = [
  '#000000', '#1f2233', '#3b3f5c', '#6f7590', '#aeb3c4', '#ffffff',
  '#7c3aed', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#f59e0b', '#facc15', '#a3e635', '#22c55e', '#10b981',
  '#14b8a6', '#22d3ee', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
]

/** Recognition over recall: a few colours are pre-loaded into "recent". */
export const SEED_RECENT = ['#8b5cf6', '#22d3ee', '#f5f4ff', '#0c0a15', '#fbbf24', '#2dd4bf']

/**
 * The zoom ladder lives in engine/core/constants.js (the engine owns zoom),
 * so there is exactly one source of truth for zoom stops and clamping.
 */