/**
 * Named drawing materials.
 *
 * The problem this solves: "hardness 82%, flow 100%, spacing 12%, smoothing 40%"
 * is a set of numbers nobody can hold in their head, and the four of them only
 * make sense in combination. Every mainstream paint app therefore leads with
 * *named* brushes — Procreate's "Studio Pen", Photoshop's brush presets,
 * Krita's brush tags — and hides the numbers behind an edit.
 *
 * Each material is a coherent bundle, not a single setting: a charcoal that is
 * soft but also dark and well-spaced is one decision, and offering its four
 * halves separately invites four wrong combinations that no artist wanted.
 *
 * Two rules the presets obey, because breaking either produces a control that
 * silently does nothing:
 *   - A material may only set options its tool actually exposes (see the
 *     `apply` tests). Setting `hardness` on the Pencil, which has no hardness
 *     control, would be a dead knob the user can see and cannot turn.
 *   - A material never sets colour. Choosing what to paint *with* is the user's
 *     decision, not a property of the tool.
 */

/** Materials for the brush family. */
const BRUSH = [
  {
    id: 'marker',
    label: 'Marker',
    hint: 'Bold felt-tip, flat and even',
    icon: 'text',
    options: { size: 18, hardness: 94, opacity: 100, flow: 100, spacing: 6, smoothing: 55, pressure: false },
  },
  {
    id: 'ink',
    label: 'Ink pen',
    hint: 'Crisp line, no bleed',
    icon: 'text',
    options: { size: 8, hardness: 100, opacity: 100, flow: 100, spacing: 4, smoothing: 65, pressure: false },
  },
  {
    id: 'airbrush',
    label: 'Airbrush',
    hint: 'Soft mist for shading',
    icon: 'sparkle',
    options: { size: 70, hardness: 6, opacity: 100, flow: 16, spacing: 10, smoothing: 80, pressure: true },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    hint: 'Dark and grainy',
    icon: 'brush',
    options: { size: 44, hardness: 38, opacity: 100, flow: 70, spacing: 16, smoothing: 35, pressure: true },
  },
  {
    id: 'watercolour',
    label: 'Watercolour',
    hint: 'Pale wash that builds up',
    icon: 'droplet',
    options: { size: 60, hardness: 10, opacity: 45, flow: 12, spacing: 14, smoothing: 85, pressure: true },
  },
  {
    id: 'crayon',
    label: 'Crayon',
    hint: 'Waxy and flat',
    icon: 'crop',
    options: { size: 22, hardness: 72, opacity: 100, flow: 88, spacing: 5, smoothing: 25, pressure: false },
  },
  {
    id: 'oil',
    label: 'Oil paint',
    hint: 'Thick, soft edges',
    icon: 'brush',
    options: { size: 56, hardness: 26, opacity: 100, flow: 92, spacing: 8, smoothing: 45, pressure: true },
  },
  {
    id: 'technical',
    label: 'Technical pen',
    hint: 'Even, precise, no taper',
    icon: 'text',
    options: { size: 5, hardness: 100, opacity: 100, flow: 100, spacing: 3, smoothing: 88, pressure: false },
  },
]

/**
 * Pencil materials.
 *
 * The Pencil tool exposes no hardness or flow, so these bundles only vary size,
 * opacity and smoothing — writing that a "graphite 4B" has 60% hardness would be
 * inventing a control the user cannot find.
 */
const PENCIL = [
  {
    id: 'sketch',
    label: 'Sketch',
    hint: 'Light, loose, quick',
    icon: 'pencil',
    options: { size: 6, opacity: 70, smoothing: 30 },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    hint: 'Everyday drawing',
    icon: 'pencil',
    options: { size: 5, opacity: 100, smoothing: 45 },
  },
  {
    id: 'construction',
    label: 'Construction',
    hint: 'Thin and precise',
    icon: 'pencil',
    options: { size: 2, opacity: 90, smoothing: 75 },
  },
  {
    id: 'charcoalPencil',
    label: 'Charcoal pencil',
    hint: 'Thick and dark',
    icon: 'pencil',
    options: { size: 16, opacity: 100, smoothing: 30 },
  },
]

/** Eraser materials. `eraserMode` is the tool's own soft/hard switch. */
const ERASER = [
  {
    id: 'softEraser',
    label: 'Soft eraser',
    hint: 'Gentle, feathered edge',
    icon: 'eraser',
    options: { size: 60, hardness: 10, opacity: 100, eraserMode: 'soft' },
  },
  {
    id: 'hardEraser',
    label: 'Hard eraser',
    hint: 'Precise, clean cut',
    icon: 'eraser',
    options: { size: 30, hardness: 98, opacity: 100, eraserMode: 'hard' },
  },
  {
    id: 'precisionEraser',
    label: 'Precision',
    hint: 'Single-pixel clean-up',
    icon: 'eraser',
    options: { size: 8, hardness: 100, opacity: 100, eraserMode: 'hard' },
  },
]

/** Every material, keyed by the tool id it belongs to. */
export const MATERIALS = {
  brush: BRUSH,
  pencil: PENCIL,
  eraser: ERASER,
}

/**
 * Materials for a tool, or an empty list.
 *
 * Tools with no materials (shapes, text, selection) return `[]` rather than
 * undefined so a caller can always map over the result.
 */
export function materialsFor(toolId) {
  return MATERIALS[toolId] ?? []
}

/**
 * Find the material matching a set of options, for showing the current pick.
 *
 * Matches on `size` and `hardness` only: those two are what a user actually
 * perceives as "which brush am I holding". Comparing every option would make
 * the selection flicker off the moment they nudged flow by one.
 */
export function matchMaterial(toolId, options) {
  const candidates = materialsFor(toolId)
  return (
    candidates.find(
      (material) =>
        material.options.size === options?.size &&
        (material.options.hardness ?? null) === (options?.hardness ?? null),
    ) ?? null
  )
}