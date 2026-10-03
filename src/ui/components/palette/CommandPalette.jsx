import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Kbd from '../common/Kbd.jsx'
import { highlightSegments, rankItems } from '../../hooks/useFuzzyMatch.js'
import { buildCommands, GROUP_ORDER } from './commands.js'
import { useUi } from '../../state/context.js'

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
  const restoreRef = useRef(null)
  const itemRefs = useRef([])

  const open = ui.dialogs.palette

  const commands = useMemo(() => buildCommands(ui), [ui])
  const ranked = useMemo(() => rankItems(query, commands), [query, commands])
  const flat = useMemo(() => ranked.map((hit) => hit.item), [ranked])

  const groups = useMemo(() => {
    const buckets = new Map(GROUP_ORDER.map((group) => [group, []]))
    for (const hit of ranked) buckets.get(hit.item.group)?.push(hit)
    return GROUP_ORDER.filter((group) => buckets.get(group).length).map((group) => ({
      group,
      items: buckets.get(group),
    }))
  }, [ranked])

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
      ui.closeDialog('palette')
      // Defer so focus restoration completes before a dialog opens.
      requestAnimationFrame(() => command.run())
    },
    [ui],
  )

  const handleKeyDown = useCallback(
    (event) => {
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

  const indexOf = new Map(flat.map((item, index) => [item.id, index]))

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh] pb-8">
      <div
        className="animate-fade absolute inset-0 bg-void/70 backdrop-blur-[6px]"
        onMouseDown={() => ui.closeDialog('palette')}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass-3 glass-specular animate-rise relative flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-lg)]"
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

                {items.map((hit) => {
                  const index = indexOf.get(hit.item.id)
                  const isActive = index === activeIndex

                  return (
                    <div
                      key={hit.item.id}
                      id={`palette-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      ref={(node) => {
                        if (node) itemRefs.current[index] = node
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        runCommand(hit.item)
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-100',
                        isActive ? 'bg-aurora-violet/20 text-fg' : 'text-fg-muted',
                      )}
                    >
                      <Icon
                        name={hit.item.icon}
                        size={15}
                        className={cn('shrink-0', isActive ? 'text-fg' : 'text-fg-subtle')}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] tracking-tight">
                        {highlightSegments(hit.item.label, hit.indices).map((segment, segmentIndex) => (
                          <span
                            key={segmentIndex}
                            className={segment.hit ? 'aurora-text font-semibold' : undefined}
                          >
                            {segment.text}
                          </span>
                        ))}
                      </span>
                      {hit.item.kbd && <Kbd size="sm">{hit.item.kbd}</Kbd>}
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
          <span className="ml-auto hidden sm:inline">
            {flat.length} command{flat.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}