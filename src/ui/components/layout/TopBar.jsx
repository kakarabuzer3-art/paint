import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import IconButton from '../common/IconButton.jsx'
import Button from '../common/Button.jsx'
import Tooltip from '../common/Tooltip.jsx'
import Kbd from '../common/Kbd.jsx'
import { useUi } from '../../state/context.js'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '')

const MOD = isMac ? '⌘' : 'Ctrl'

/**
 * Top bar: identity, document actions, history, and view controls.
 *
 * Ordered by frequency of use from left to right — document identity and file
 * actions first, history in the middle, view controls at the trailing edge
 * where a pointer stroke naturally finishes.
 */
export default function TopBar() {
  const {
    doc,
    setDoc,
    panels,
    togglePanel,
    openDialog,
    canUndo,
    canRedo,
    undo,
    redo,
    historyEntries,
    isDirty,
    saveProject,
    openFilePicker,
    simpleMode,
    toggleSimpleMode,
  } = useUi()

  // Naming the action in the tooltip is recognition over recall — you always
  // know what Ctrl+Z is about to reverse.
  const lastUndoLabel = historyEntries.at(-1)?.label ?? ''
  const lastRedoLabel = historyEntries.at(-1)?.label ?? ''

  return (
    <header className="clay-2 flex h-12 shrink-0 items-center gap-2 rounded-[var(--radius-panel)] px-2.5">

      {/* ---------------------------------------------------------- identity */}
      <div className="flex shrink-0 items-center gap-2.5 pl-0.5">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-gradient-to-br from-aurora-cyan via-aurora-violet to-aurora-magenta shadow-[inset_0_1px_0_0_rgb(255_255_255/0.35),0_6px_16px_-8px_rgb(139_92_246/1)]">
          <Icon name="sparkle" size={15} className="text-white" />
        </span>
        <div className="hidden leading-tight lg:block">
          <p className="text-[12.5px] font-semibold tracking-tight text-fg">
            Aurora <span className="aurora-text">Paint</span>
          </p>
          <p className="text-[9.5px] font-medium tracking-[0.16em] text-fg-subtle uppercase">
            Creative Studio
          </p>
        </div>
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />

      {/* ----------------------------------------------------------- document */}
      <div className="flex min-w-0 items-center gap-2">
        <label className="sr-only" htmlFor="doc-name">
          Document name
        </label>
        <input
          id="doc-name"
          value={doc.name}
          onChange={(event) => setDoc((prev) => ({ ...prev, name: event.target.value }))}
          spellCheck="false"
          className={cn(
            'h-7 min-w-0 max-w-[10rem] truncate rounded-[9px] bg-transparent px-2 text-[12.5px] font-medium',
            'tracking-tight text-fg transition-colors duration-150 hover:bg-white/[0.06] focus:bg-white/[0.08]',
          )}
        />
        <span className="clay hidden items-center rounded-full px-2 py-0.5 font-mono text-[10px] text-fg-muted tabular-nums xl:inline-flex">
          {doc.width} × {doc.height}
        </span>
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />

      {/* -------------------------------------------------------- file + edit */}
      <div className="flex shrink-0 items-center gap-1">
        <Button icon="newFile" size="sm" variant="ghost" onClick={() => openDialog('newDoc')}>
          <span className="hidden sm:inline">New</span>
        </Button>

        <Tooltip label="Open an image or .aurora project" shortcut={`${MOD}+O`}>
          <span>
            <Button icon="folder" size="sm" variant="ghost" onClick={openFilePicker}>
              <span className="hidden sm:inline">Open</span>
            </Button>
          </span>
        </Tooltip>

        <Tooltip
          label={isDirty ? 'Save project (unsaved changes)' : 'Save project'}
          shortcut={`${MOD}+S`}
        >
          <span>
            <Button icon="save" size="sm" variant="ghost" onClick={saveProject}>
              <span className="hidden sm:inline">Save</span>
              {/* An unsaved-changes dot: the cheapest possible save affordance. */}
              {isDirty && (
                <span
                  className="ml-1 h-1.5 w-1.5 rounded-full bg-aurora-cyan"
                  aria-label="Unsaved changes"
                />
              )}
            </Button>
          </span>
        </Tooltip>

        <Tooltip label="Export the flattened artwork" shortcut={`${MOD}+E`}>
          <span>
            <Button icon="download" size="sm" variant="ghost" onClick={() => openDialog('export')}>
              <span className="hidden sm:inline">Export</span>
            </Button>
          </span>
        </Tooltip>
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip
          label={canUndo ? `Undo ${lastUndoLabel}` : 'Nothing to undo yet'}
          shortcut={`${MOD}+Z`}
        >
          <span>
            <IconButton icon="undo" label="Undo" disabled={!canUndo} onClick={undo} />
          </span>
        </Tooltip>

        <Tooltip
          label={canRedo ? `Redo ${lastRedoLabel}` : 'Nothing to redo yet'}
          shortcut={`${MOD}+⇧+Z`}
        >
          <span>
            <IconButton icon="redo" label="Redo" disabled={!canRedo} onClick={redo} />
          </span>
        </Tooltip>
      </div>

      {/* Spacer pushes the view controls to the trailing edge. */}
      <div className="flex-1" />

      {/* ------------------------------------------------------------- search */}
      <button
        type="button"
        onClick={() => openDialog('palette')}
        className={cn(
          'clay hidden h-8 shrink-0 items-center gap-2 rounded-[10px] px-2.5 text-[11.5px] text-fg-subtle',
          'transition-colors duration-150 hover:bg-white/[0.09] hover:text-fg-muted lg:flex',
        )}
      >
        <Icon name="search" size={14} />
        <span className="hidden xl:inline">Search commands…</span>
        <Kbd size="sm" className="ml-0.5">
          {MOD}K
        </Kbd>
      </button>

      <ZoomControls />

      {/*
        Simple / Advanced.

        Labelled in words rather than shown as a toggle icon, because the two
        states mean different things and a switch glyph does not say which mode
        you are in. It is a two-way choice, not a boolean you flip blind — the
        label is the state, so there is never a moment of guessing.
      */}
      <Tooltip
        label={
          simpleMode
            ? 'Simple mode: showing the controls that matter. Switch to Advanced for every setting.'
            : 'Advanced mode: showing all settings. Switch to Simple for just the essentials.'
        }
      >
        <button
          type="button"
          onClick={toggleSimpleMode}
          aria-pressed={!simpleMode}
          className={cn(
            'clay flex h-8 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-[11.5px] font-medium tracking-tight',
            'transition-colors duration-150 hover:bg-[#282336]',
            simpleMode ? 'text-fg-muted' : 'text-fg',
          )}
        >
          <Icon name={simpleMode ? 'sparkle' : 'sliders'} size={13} />
          <span className="hidden sm:inline">{simpleMode ? 'Simple' : 'Advanced'}</span>
        </button>
      </Tooltip>

      {/* ------------------------------------------------------------- panels */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip label="Toggle tool options" shortcut="Tab">
          <span>
            <IconButton
              icon="sliders"
              label="Toggle tool options"
              tone="neutral"
              active={panels.options}
              onClick={() => togglePanel('options')}
            />
          </span>
        </Tooltip>
        <Tooltip label="Toggle inspector" shortcut="Ctrl+Shift+P">
          <span>
            <IconButton
              icon="layers"
              label="Toggle inspector"
              tone="neutral"
              active={panels.inspector}
              onClick={() => togglePanel('inspector')}
            />
          </span>
        </Tooltip>
        <Tooltip label="Keyboard shortcuts" shortcut="?">
          <span>
            <IconButton
              icon="keyboard"
              label="Keyboard shortcuts"
              onClick={() => openDialog('shortcuts')}
            />
          </span>
        </Tooltip>
      </div>
    </header>
  )
}

/**
 * Zoom cluster. Extracted as its own component so changing zoom only
 * re-renders this subtree, not the whole top bar.
 */
function ZoomControls() {
  const { zoom, zoomIn, zoomOut, zoomTo, fitToScreen } = useUi()

  return (
    <div className="clay flex shrink-0 items-center gap-0.5 rounded-[10px] p-0.5">
      <Tooltip label="Zoom out" shortcut="−">
        <span>
          <IconButton icon="minus" label="Zoom out" size="xs" onClick={zoomOut} />
        </span>
      </Tooltip>

      <Tooltip label="Reset to 100%" shortcut={`${MOD}+1`}>
        <button
          type="button"
          onClick={() => zoomTo(1)}
          aria-label={`Zoom ${Math.round(zoom * 100)} percent — activate for 100 percent`}
          className="h-7 min-w-[3.1rem] rounded-[8px] px-1 font-mono text-[11px] font-medium text-fg-muted tabular-nums transition-colors hover:bg-white/[0.08] hover:text-fg"
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>

      <Tooltip label="Zoom in" shortcut="+">
        <span>
          <IconButton icon="plus" label="Zoom in" size="xs" onClick={zoomIn} />
        </span>
      </Tooltip>

      <Tooltip label="Fit to screen" shortcut="0">
        <span>
          <IconButton icon="maximize" label="Fit to screen" size="xs" onClick={fitToScreen} />
        </span>
      </Tooltip>
    </div>
  )
}