/**
 * Tool registry — the single source of truth for the tool rail, the
 * contextual options bar, keyboard shortcuts and the command palette.
 *
 * Adding a tool = add an entry here + one engine module. No UI edits.
 *
 * `options` lists OPTION_DEFS ids that appear in the options bar, in order.
 * Progressive disclosure: only the active tool's options are rendered.
 */

/** Control descriptors rendered by components/options/OptionControl.jsx */
export const OPTION_DEFS = {
  size: { label: 'Size', type: 'slider', min: 1, max: 400, step: 1, unit: 'px', width: 'w-44' },
  hardness: { label: 'Hardness', type: 'slider', min: 0, max: 100, step: 1, unit: '%', width: 'w-32' },
  opacity: { label: 'Opacity', type: 'slider', min: 1, max: 100, step: 1, unit: '%', width: 'w-32' },
  flow: { label: 'Flow', type: 'slider', min: 1, max: 100, step: 1, unit: '%', width: 'w-32' },
  smoothing: { label: 'Smoothing', type: 'slider', min: 0, max: 95, step: 1, unit: '%', width: 'w-32' },
  spacing: { label: 'Spacing', type: 'slider', min: 2, max: 200, step: 1, unit: '%', width: 'w-32' },

  tolerance: { label: 'Tolerance', type: 'slider', min: 0, max: 255, step: 1, width: 'w-36' },
  feather: { label: 'Feather', type: 'slider', min: 0, max: 60, step: 1, unit: 'px', width: 'w-32' },

  contiguous: { label: 'Contiguous', type: 'toggle' },
  antialias: { label: 'Anti-alias', type: 'toggle' },
  pressure: { label: 'Pressure', type: 'toggle' },

  selectionMode: {
    label: 'Mode',
    type: 'segmented',
    items: [
      { value: 'new', label: 'New', icon: 'plus' },
      { value: 'add', label: 'Add', icon: 'check' },
      { value: 'subtract', label: 'Subtract', icon: 'minus' },
    ],
  },

  eraserMode: {
    label: 'Edge',
    type: 'segmented',
    items: [
      { value: 'soft', label: 'Soft', icon: 'droplet' },
      { value: 'block', label: 'Block', icon: 'grid' },
    ],
  },

  sampleSize: {
    label: 'Sample',
    type: 'segmented',
    items: [
      { value: 'point', label: '1×1' },
      { value: 'avg3', label: '3×3' },
      { value: 'avg5', label: '5×5' },
    ],
  },

  shapeMode: {
    label: 'Style',
    type: 'segmented',
    items: [
      { value: 'fill', label: 'Fill', icon: 'fill' },
      { value: 'stroke', label: 'Stroke', icon: 'line' },
      { value: 'both', label: 'Both', icon: 'shape' },
    ],
  },

  zoomPreset: {
    label: 'Zoom to',
    type: 'segmented',
    items: [
      { value: 'in', label: 'In', icon: 'plus' },
      { value: 'out', label: 'Out', icon: 'minus' },
    ],
  },

  strokeWidth: { label: 'Stroke', type: 'slider', min: 1, max: 200, step: 1, unit: 'px', width: 'w-32' },
  cornerRadius: { label: 'Corners', type: 'slider', min: 0, max: 200, step: 1, unit: 'px', width: 'w-32' },

  fontSize: { label: 'Size', type: 'slider', min: 8, max: 400, step: 1, unit: 'px', width: 'w-32' },
  letterSpacing: { label: 'Tracking', type: 'slider', min: -20, max: 60, step: 1, unit: '‰', width: 'w-32' },
  lineHeight: { label: 'Leading', type: 'slider', min: 60, max: 260, step: 1, unit: '%', width: 'w-32' },

  fontFamily: {
    label: 'Font',
    type: 'select',
    width: 'w-44',
    options: [
      { value: 'sans', label: 'Sans (System UI)' },
      { value: 'display', label: 'Display' },
      { value: 'mono', label: 'Mono' },
      { value: 'serif', label: 'Serif' },
    ],
  },

  blendMode: {
    label: 'Blend',
    type: 'select',
    width: 'w-40',
    options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'multiply', label: 'Multiply' },
      { value: 'screen', label: 'Screen' },
      { value: 'overlay', label: 'Overlay' },
      { value: 'darken', label: 'Darken' },
      { value: 'lighten', label: 'Lighten' },
      { value: 'color-dodge', label: 'Color Dodge' },
      { value: 'color-burn', label: 'Color Burn' },
      { value: 'hard-light', label: 'Hard Light' },
      { value: 'soft-light', label: 'Soft Light' },
      { value: 'difference', label: 'Difference' },
      { value: 'exclusion', label: 'Exclusion' },
      { value: 'hue', label: 'Hue' },
      { value: 'saturation', label: 'Saturation' },
      { value: 'color', label: 'Color' },
      { value: 'luminosity', label: 'Luminosity' },
    ],
  },

  fillSource: { label: 'Fill', type: 'colorSlot', slot: 'primary' },
  strokeSource: { label: 'Stroke', type: 'colorSlot', slot: 'secondary' },
}

/** The tools themselves, grouped exactly as they appear in the rail. */
export const TOOL_GROUPS = [
  {
    id: 'select',
    label: 'Select',
    items: ['select', 'lasso', 'magicWand', 'move', 'transform'],
  },
  { id: 'paint', label: 'Paint', items: ['brush', 'pencil', 'eraser', 'fill', 'eyedropper'] },
  { id: 'type', label: 'Shape & Type', items: ['shape', 'ellipse', 'line', 'text'] },
  { id: 'view', label: 'View', items: ['zoom', 'pan'] },
]

export const TOOLS = {
  select: {
    id: 'select',
    label: 'Rect Select',
    icon: 'cursor',
    shortcut: 'v',
    hint: 'Drag to select a rectangular region.',
    options: ['selectionMode', 'feather', 'antialias'],
  },
  lasso: {
    id: 'lasso',
    label: 'Lasso Select',
    icon: 'lasso',
    shortcut: 'l',
    hint: 'Draw a freehand outline to select an irregular region.',
    options: ['selectionMode', 'feather', 'antialias'],
  },
  magicWand: {
    id: 'magicWand',
    label: 'Magic Wand',
    icon: 'magicWand',
    shortcut: 'w',
    hint: 'Click to select connected pixels of a similar colour.',
    options: ['selectionMode', 'tolerance', 'contiguous', 'antialias'],
  },
  move: {
    id: 'move',
    label: 'Move',
    icon: 'move',
    shortcut: 'm',
    hint: 'Drag to move the selection. Alt-drag duplicates it instead.',
    options: [],
  },
  transform: {
    id: 'transform',
    label: 'Transform',
    icon: 'expand',
    shortcut: 'y',
    hint: 'Drag a handle to scale the selection. Shift keeps ratio, Alt scales from centre.',
    options: [],
  },
  brush: {
    id: 'brush',
    label: 'Brush',
    icon: 'brush',
    shortcut: 'b',
    hint: 'Paint soft round strokes. Hold Shift for a straight line.',
    options: ['size', 'hardness', 'opacity', 'flow', 'spacing', 'smoothing', 'pressure', 'blendMode'],
  },
  pencil: {
    id: 'pencil',
    label: 'Pencil',
    icon: 'pencil',
    shortcut: 'p',
    hint: 'Hard-edged pixels — ideal for crisp line work and pixel art.',
    options: ['size', 'opacity', 'smoothing', 'blendMode'],
  },
  eraser: {
    id: 'eraser',
    label: 'Eraser',
    icon: 'eraser',
    shortcut: 'e',
    hint: 'Erase to transparency. Alt-drag temporarily samples a colour.',
    options: ['size', 'hardness', 'opacity', 'eraserMode'],
  },
  fill: {
    id: 'fill',
    label: 'Paint Bucket',
    icon: 'fill',
    shortcut: 'g',
    hint: 'Click a region to flood-fill it with the primary colour.',
    options: ['tolerance', 'contiguous', 'antialias', 'opacity', 'blendMode'],
  },
  eyedropper: {
    id: 'eyedropper',
    label: 'Eyedropper',
    icon: 'eyedropper',
    shortcut: 'i',
    hint: 'Sample a colour from the canvas into the primary swatch.',
    options: ['sampleSize'],
  },

  shape: {
    id: 'shape',
    label: 'Rectangle',
    icon: 'shape',
    shortcut: 'r',
    hint: 'Drag to draw a rectangle. Shift constrains to a square.',
    options: ['shapeMode', 'cornerRadius', 'strokeWidth', 'fillSource', 'strokeSource'],
  },
  ellipse: {
    id: 'ellipse',
    label: 'Ellipse',
    icon: 'ellipse',
    shortcut: 'o',
    hint: 'Drag to draw an ellipse. Shift constrains to a circle.',
    options: ['shapeMode', 'strokeWidth', 'fillSource', 'strokeSource'],
  },
  line: {
    id: 'line',
    label: 'Line',
    icon: 'line',
    shortcut: 'n',
    hint: 'Drag to draw a straight line. Shift snaps to 15° increments.',
    options: ['strokeWidth', 'strokeSource'],
  },
  text: {
    id: 'text',
    label: 'Text',
    icon: 'text',
    shortcut: 't',
    hint: 'Click to place a text cursor, then type. Esc commits the text.',
    options: ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fillSource'],
  },

  zoom: {
    id: 'zoom',
    label: 'Zoom',
    icon: 'zoom',
    shortcut: 'z',
    hint: 'Click to zoom in, Alt-click to zoom out. Drag to zoom a region.',
    options: ['zoomPreset'],
  },
  pan: {
    id: 'pan',
    label: 'Pan',
    icon: 'hand',
    shortcut: 'h',
    hint: 'Drag to move around the canvas. Hold Space with any tool.',
    options: [],
  },
}

/** Tools in rail order, flattened — used for cycling and palette listings. */
export const TOOL_ORDER = TOOL_GROUPS.flatMap((group) => group.items)

export const DEFAULT_TOOL = 'brush'

/** Shortcut letter -> tool id. Single source for the keyboard router. */
export const TOOL_BY_SHORTCUT = TOOL_ORDER.reduce((acc, id) => {
  const { shortcut } = TOOLS[id]
  if (shortcut) acc[shortcut] = id
  return acc
}, {})