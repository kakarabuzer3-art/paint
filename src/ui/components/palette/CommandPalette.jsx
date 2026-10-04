import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Kbd from '../common/Kbd.jsx'
import { highlightSegments, rankItems } from '../../hooks/useFuzzyMatch.js'
import { buildCommands, GROUP_ORDER } from './commands.js'
import { useUi } from '../../state/context.js'

/** Focusable descendants, matching the Modal's selector so traps behave alike. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Resolve a command's label, which may be a function of live UI state. */
function labelOf(command) {
  return typeof command.label === 'function' ? command.label() : command.label
}

/**
 * Global command palette (⌘/Ctrl+K).
 *
 * Keyboard-first: the input keeps focus, arrows move the selection, Enter
 * runs, Escape dismisses, focus returns to where the user was. Results are
 * grouped by area and matched with a fuzzy scorer that highlights hits so
 * scanning is visual rather than literal.
 */
export default function CommandPalette() {
  const ui = useUi()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const itemRefs = useRef([])

  const open = ui.dialogs.palette

  // `ui` is a fresh object on every provider render, so building the command
  // list is skipped entirely while the palette is closed — otherwise each
  // stroke would allocate ~40 command objects for a list nobody can see.
  const commands = useMemo(() => (open ? buildCommands(ui) : []), [open, ui])
  const ranked = useMemo(
    () => rankItems(query, commands, ui.recentCommands),
    [query, commands, ui.recentCommands],
  )
  const flat = useMemo(
    () => ranked.map((hit) => ({ ...hit.item, label: labelOf(hit.item) })),
    [ranked],
  )

  const groups = useMemo(() => {
    const buckets = new Map(GROUP_ORDER.map((group) => [group, []]))
    // Bucket the resolved `flat` entries, not `ranked`, so a function label is
    // rendered as text and not called on the DOM side.
    flat.forEach((item, index) => buckets.get(item.group)?.push({ item, index }))
    return GROUP_ORDER.filter((group) => buckets.get(group).length).map((group) => ({
      group,
      items: buckets.get(group),
    }))
  }, [flat])

  /* --------------------------------------------------------------- focus */
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement
      setQuery('')
      setActiveIndex(0)
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
    const target = restoreRef.current
    if (target && typeof target.focus === 'function') target.focus()
    return undefined
  }, [open])

  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(flat.length ? flat.length - 1 : 0)
  }, [activeIndex, flat.length])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const runCommand = useCallback(
    (command) => {
      if (!command) return
      // Recorded before closing so the next open of the palette is already
      // reordered, and only for commands the user actually chose.
      ui.noteCommand(command.id)
      ui.closeDialog('palette')
      // Defer so focus restoration completes before a dialog opens.
      requestAnimationFrame(() => command.run())
    },
    [ui],
  )

  const handleKeyDown = useCallback(
    (event) => {
      // This dialog declares aria-modal, so Tab must not escape it. Without
      // the trap, focus walks into the app behind the overlay where it is
      // invisible and meaningless — the classic half-modal failure.
      if (event.key === 'Tab') {
        const nodes = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []).filter(
          (node) => node.offsetParent !== null,
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const active = document.activeElement

        if (event.shiftKey && (active === first || active === panelRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
        return
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          ui.closeDialog('palette')
          break
        case 'ArrowDown':
          event.preventDefault()
          setActiveIndex((index) => (flat.length ? (index + 1) % flat.length : 0))
          break
        case 'ArrowUp':
          event.preventDefault()
          setActiveIndex((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0))
          break
        case 'Enter':
          event.preventDefault()
          runCommand(flat[activeIndex])
          break
        default:
          break
      }
    },
    [activeIndex, flat, runCommand, ui],
  )

  if (!open) return null

  /** Match positions per command id, for rendering the highlighted label. */
  const highlightIndices = useMemo(
    () => new Map(ranked.map((hit) => [hit.item.id, hit.indices])),
    [ranked],
  )

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh] pb-8">
      <div
        className="animate-fade absolute inset-0 bg-void/85"
        onMouseDown={() => ui.closeDialog('palette')}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="clay-3 animate-rise relative flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-lg)]"
      >
        {/* ---------------------------------------------------------- search */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Icon name="search" size={17} className="shrink-0 text-aurora-cyan" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={flat.length ? `palette-option-${activeIndex}` : undefined}
            aria-label="Search commands"
            placeholder="Type a command or search…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            spellCheck="false"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] tracking-tight text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <Kbd size="sm">Esc</Kbd>
        </div>

        <div className="hairline-t" />

        {/* ---------------------------------------------------------- results */}
        <div
          id="palette-results"
          role="listbox"
          aria-label="Commands"
          className="scroll-slim max-h-[52vh] min-h-[10rem] overflow-y-auto px-2 py-2"
        >
          {flat.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Icon name="search" size={22} className="text-fg-subtle" />
              <p className="text-[13px] font-medium text-fg">No commands match “{query}”</p>
              <p className="text-[11.5px] text-fg-subtle">
                Try a tool name, “zoom”, “layer”, or “colour”.
              </p>
            </div>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} className="mb-1.5 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-semibold tracking-[0.16em] text-fg-subtle uppercase">
                  {group}
                </p>

                {items.map(({ item, index }) => {
                  const isActive = index === activeIndex
                  // Match indices are computed against `keywords`, which is
                  // longer than the label, so clamp them to the rendered text
                  // before using them to split it.
                  const indices = (highlightIndices.get(item.id) ?? []).filter(
                    (position) => position < item.label.length,
                  )

                  return (
                    <div
                      key={item.id}
                      id={`palette-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      ref={(node) => {
                        if (node) itemRefs.current[index] = node
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        runCommand(item)
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-100',
                        isActive ? 'bg-aurora-violet/20 text-fg' : 'text-fg-muted',
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={15}
                        className={cn('shrink-0', isActive ? 'text-fg' : 'text-fg-subtle')}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] tracking-tight">
                        {highlightSegments(item.label, indices).map((segment, segmentIndex) => (
                          <span
                            key={segmentIndex}
                            className={segment.hit ? 'aurora-text font-semibold' : undefined}
                          >
                            {segment.text}
                          </span>
                        ))}
                      </span>
                      {item.kbd && <Kbd size="sm">{item.kbd}</Kbd>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ----------------------------------------------------------- footer */}
        <div className="hairline-t flex items-center gap-4 px-4 py-2.5 text-[10.5px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd size="sm">↑</Kbd>
            <Kbd size="sm">↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd size="sm">↵</Kbd> run
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd size="sm">Esc</Kbd> close
          </span>
          <span className="ml-auto hidden items-center gap-3 sm:flex">
            <span>
              {flat.length} command{flat.length === 1 ? '' : 's'}
            </span>
            {/* Recency is a learned preference, so it needs an undo. */}
            {ui.recentCommands.length > 0 && !query && (
              <button
                type="button"
                onClick={ui.clearRecentCommands}
                className="text-fg-subtle transition-colors duration-100 hover:text-fg"
              >
                Clear recent
              </button>
            )}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}