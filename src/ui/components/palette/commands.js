import { TOOLS, TOOL_ORDER } from '../../data/tools.js'

export const GROUP_ORDER = [
  'File', 'Edit', 'Tools', 'Selection', 'View', 'Layers', 'Colour', 'Panels', 'Document', 'Help',
]

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '')

export const mod = isMac ? '⌘' : 'Ctrl'

/**
 * The palette's command surface.
 *
 * Every entry has a visible toolbar equivalent — the palette is an
 * accelerator, never the only path to an action (progressive disclosure:
 * power users get a fast lane, newcomers still have buttons).
 *
 * Phase 7 adds recency ranking and engine-backed commands; the shape stays
 * the same so no caller needs to change.
 *
 * @param {object} ui — the UiProvider value
 */
export function buildCommands(ui) {
  const list = []

  for (const id of TOOL_ORDER) {
    const tool = TOOLS[id]
    list.push({
      id: `tool:${id}`,
      group: 'Tools',
      label: tool.label,
      icon: tool.icon,
      kbd: tool.shortcut?.toUpperCase(),
      keywords: `${tool.label} tool ${id} ${tool.shortcut}`,
      run: () => ui.setTool(id),
    })
  }

  list.push(
    {
      id: 'file:new',
      group: 'File',
      label: 'New document',
      icon: 'newFile',
      kbd: `${mod}N`,
      keywords: 'new blank document canvas create',
      run: () => ui.openDialog('newDoc'),
    },
    {
      id: 'file:open',
      group: 'File',
      label: 'Open an image or project',
      icon: 'folder',
      kbd: `${mod}O`,
      keywords: 'open load import file image project aurora',
      run: () => ui.openFilePicker(),
    },
    {
      id: 'file:save',
      group: 'File',
      label: 'Save project',
      icon: 'save',
      kbd: `${mod}S`,
      keywords: 'save write project file aurora disk',
      run: () => ui.saveProject(),
    },
    {
      id: 'file:export',
      group: 'File',
      label: 'Export image…',
      icon: 'download',
      kbd: `${mod}E`,
      keywords: 'export download png jpeg jpg webp save image output',
      run: () => ui.openDialog('export'),
    },
    {
      id: 'view:fit',
      group: 'View',
      label: 'Fit document to screen',
      icon: 'maximize',
      kbd: '0',
      keywords: 'fit screen zoom scale reset view',
      run: () => ui.fitToScreen(),
    },
    {
      id: 'view:actual',
      group: 'View',
      label: 'Zoom to 100%',
      icon: 'zoom',
      kbd: `${mod}1`,
      keywords: 'actual size 100 percent zoom',
      run: () => ui.zoomTo(1),
    },
    {
      id: 'view:in',
      group: 'View',
      label: 'Zoom in',
      icon: 'plus',
      kbd: '+',
      keywords: 'zoom in enlarge',
      run: () => ui.zoomIn(),
    },
    {
      id: 'view:out',
      group: 'View',
      label: 'Zoom out',
      icon: 'minus',
      kbd: '−',
      keywords: 'zoom out shrink',
      run: () => ui.zoomOut(),
    },
    {
      id: 'layer:add',
      group: 'Layers',
      label: 'Add a new layer',
      icon: 'plus',
      kbd: `${mod}⇧N`,
      keywords: 'add new layer create',
      run: () => ui.addLayer(),
    },
    {
      id: 'layer:dup',
      group: 'Layers',
      label: 'Duplicate active layer',
      icon: 'copy',
      kbd: `${mod}J`,
      keywords: 'duplicate copy layer',
      run: () => ui.duplicateLayer(ui.activeLayerId),
    },
    {
      id: 'layer:del',
      group: 'Layers',
      label: 'Delete active layer',
      icon: 'trash',
      kbd: 'Del',
      keywords: 'delete remove layer',
      run: () => ui.deleteLayer(ui.activeLayerId),
    },
    {
      id: 'colour:swap',
      group: 'Colour',
      label: 'Swap primary and secondary colours',
      icon: 'flipH',
      kbd: 'X',
      keywords: 'swap colours colors switch primary secondary',
      run: () => ui.swapColors(),
    },
    {
      id: 'colour:reset',
      group: 'Colour',
      label: 'Reset colours to black and white',
      icon: 'contrast',
      kbd: 'D',
      keywords: 'reset default black white colours colors',
      run: () => ui.resetColors(),
    },
    {
      id: 'colour:picker',
      group: 'Colour',
      label: 'Open the colour picker',
      icon: 'palette',
      kbd: 'C',
      keywords: 'colour color picker open studio',
      run: () => ui.openDialog('color'),
    },
    {
      id: 'panel:inspector',
      group: 'Panels',
      label: 'Toggle the inspector',
      icon: 'layers',
      kbd: `${mod}⇧I`,
      keywords: 'toggle inspector panel layers hide show',
      run: () => ui.togglePanel('inspector'),
    },
    {
      id: 'panel:options',
      group: 'Panels',
      label: 'Toggle tool options',
      icon: 'sliders',
      kbd: 'Tab',
      keywords: 'toggle tool options bar hide show',
      run: () => ui.togglePanel('options'),
    },
    {
      id: 'panel:rail',
      group: 'Panels',
      label: 'Toggle the tool rail',
      icon: 'grip',
      kbd: '\\',
      keywords: 'toggle tool rail hide show',
      run: () => ui.togglePanel('rail'),
    },
    {
      id: 'doc:new',
      group: 'Document',
      label: 'New document…',
      icon: 'newFile',
      kbd: `${mod}N`,
      keywords: 'new document create canvas size',
      run: () => ui.openDialog('newDoc'),
    },
    {
      id: 'help:shortcuts',
      group: 'Help',
      label: 'Keyboard shortcuts',
      icon: 'keyboard',
      kbd: '?',
      keywords: 'keyboard shortcuts help keys bindings',
      run: () => ui.openDialog('shortcuts'),
    },
  )

  list.push(
    {
      id: 'edit:undo',
      group: 'Edit',
      label: 'Undo',
      icon: 'undo',
      kbd: `${mod}Z`,
      keywords: 'undo revert go back history step',
      run: () => ui.undo(),
    },
    {
      id: 'edit:redo',
      group: 'Edit',
      label: 'Redo',
      icon: 'redo',
      kbd: `${mod}⇧+Z`,
      keywords: 'redo forward history replay',
      run: () => ui.redo(),
    },
    {
      id: 'edit:copy',
      group: 'Edit',
      label: 'Copy selection',
      icon: 'copy',
      kbd: `${mod}C`,
      keywords: 'copy selection clipboard duplicate pixels',
      run: () => ui.copy(),
    },
    {
      id: 'edit:cut',
      group: 'Edit',
      label: 'Cut selection',
      icon: 'crop',
      kbd: `${mod}X`,
      keywords: 'cut selection clipboard remove pixels',
      run: () => ui.cut(),
    },
    {
      id: 'edit:paste',
      group: 'Edit',
      label: 'Paste as a new layer',
      icon: 'layers',
      kbd: `${mod}V`,
      keywords: 'paste clipboard new layer selection',
      run: () => ui.paste(),
    },
    {
      id: 'edit:delete',
      group: 'Edit',
      label: 'Delete selected pixels',
      icon: 'trash',
      kbd: 'Del',
      keywords: 'delete clear erase selection pixels',
      run: () => ui.deleteSelection(),
    },
    {
      id: 'select:all',
      group: 'Selection',
      label: 'Select all',
      icon: 'grid',
      kbd: `${mod}A`,
      keywords: 'select all everything whole document',
      run: () => ui.selectAll(),
    },
    {
      id: 'select:none',
      group: 'Selection',
      label: 'Deselect',
      icon: 'x',
      kbd: 'Esc',
      keywords: 'deselect none clear remove selection',
      run: () => ui.deselect(),
    },
    {
      id: 'select:invert',
      group: 'Selection',
      label: 'Invert selection',
      icon: 'flipH',
      kbd: `${mod}⇧I`,
      keywords: 'invert reverse selection opposite',
      run: () => ui.invertSelection(),
    },
  )

  return list
}