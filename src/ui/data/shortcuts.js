/**
 * The shortcut reference (opened with "?" and listed in the command palette).
 *
 * Keeping this declarative means the sheet can never drift from the actual
 * bindings — the keyboard router iterates `TOOL_BY_SHORTCUT`, and this file
 * mirrors the non-tool bindings that router implements.
 *
 * Only bindings that are live in this build are listed; bindings that depend
 * on later phases (clipboard, history, space-to-pan) are added to this file
 * when they ship, so the sheet never advertises something that does not work.
 */
export const SHORTCUT_GROUPS = [
  {
    title: 'Tools',
    items: [
      { keys: ['V'], label: 'Rectangular select' },
      { keys: ['L'], label: 'Lasso select' },
      { keys: ['W'], label: 'Magic wand' },
      { keys: ['M'], label: 'Move' },
      { keys: ['Y'], label: 'Transform (scale selection)' },
      { keys: ['B'], label: 'Brush' },
      { keys: ['P'], label: 'Pencil' },
      { keys: ['E'], label: 'Eraser' },
      { keys: ['G'], label: 'Paint bucket' },
      { keys: ['I'], label: 'Eyedropper' },
      { keys: ['R'], label: 'Rectangle' },
      { keys: ['O'], label: 'Ellipse' },
      { keys: ['N'], label: 'Line' },
      { keys: ['T'], label: 'Text' },
      { keys: ['Z'], label: 'Zoom' },
      { keys: ['H'], label: 'Hand (pan)' },
      { keys: ['['], label: 'Brush size down' },
      { keys: [']'], label: 'Brush size up' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: ['Space'], label: 'Hold to pan (any tool)' },
      { keys: ['Middle-drag'], label: 'Pan with the middle button' },
      { keys: ['0'], label: 'Fit to screen' },
      { keys: ['+', '−'], label: 'Zoom in / out' },
      { keys: ['Ctrl', '1'], label: 'Zoom to 100%' },
      { keys: ['Scroll'], label: 'Zoom at the pointer' },
      { keys: ['Tab'], label: 'Toggle tool options' },
      { keys: ['Ctrl', 'Shift', 'P'], label: 'Toggle inspector' },
      { keys: ['\\'], label: 'Toggle the tool rail' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
      { keys: ['Ctrl', 'C'], label: 'Copy selection' },
      { keys: ['Ctrl', 'X'], label: 'Cut selection' },
      { keys: ['Ctrl', 'V'], label: 'Paste as a new layer' },
      { keys: ['Ctrl', 'Shift', 'N'], label: 'New layer' },
      { keys: ['Del'], label: 'Delete selected pixels' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: ['Ctrl', 'A'], label: 'Select all' },
      { keys: ['Esc'], label: 'Deselect' },
      { keys: ['Ctrl', 'Shift', 'I'], label: 'Invert selection' },
      { keys: ['Alt-drag'], label: 'Duplicate while moving' },
      { keys: ['Shift'], label: 'Constrain drag / keep ratio' },
    ],
  },
  {
    title: 'Colour',
    items: [
      { keys: ['X'], label: 'Swap primary / secondary' },
      { keys: ['D'], label: 'Reset to black & white' },
      { keys: ['C'], label: 'Open colour picker' },
    ],
  },
  {
    title: 'Document & help',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Command palette' },
      { keys: ['Ctrl', 'N'], label: 'New document' },
      { keys: ['Ctrl', 'Shift', 'N'], label: 'New layer' },
      { keys: ['Ctrl', 'J'], label: 'Duplicate layer' },
      { keys: ['?'], label: 'This shortcut sheet' },
      { keys: ['Esc'], label: 'Close dialog / clear selection' },
    ],
  },
]