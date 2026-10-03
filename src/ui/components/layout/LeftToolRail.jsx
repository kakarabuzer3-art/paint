import { useCallback } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Tooltip from '../common/Tooltip.jsx'
import { TOOLS, TOOL_GROUPS, TOOL_ORDER } from '../../data/tools.js'
import { useUi } from '../../state/context.js'

/**
 * Vertical tool rail.
 *
 * Implements the toolbar ARIA pattern with a roving tabindex: exactly one
 * tool is tabbable, arrow keys move between tools, and selection follows
 * focus. Global single-letter shortcuts (B, P, E…) are handled by the
 * keyboard hook, so they work without the rail ever receiving focus.
 */
export default function LeftToolRail() {
  const { activeTool, setTool, panels } = useUi()

  const moveSelection = useCallback(
    (direction) => {
      const index = TOOL_ORDER.indexOf(activeTool)
      const next = (index + direction + TOOL_ORDER.length) % TOOL_ORDER.length
      setTool(TOOL_ORDER[next])
    },
    [activeTool, setTool],
  )

  const handleKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          moveSelection(1)
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          moveSelection(-1)
          break
        case 'Home':
          event.preventDefault()
          setTool(TOOL_ORDER[0])
          break
        case 'End':
          event.preventDefault()
          setTool(TOOL_ORDER[TOOL_ORDER.length - 1])
          break
        default:
          break
      }
    },
    [moveSelection, setTool],
  )

  if (!panels.rail) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center pt-3">
        <Tooltip label="Show tools" side="right">
          <button
            type="button"
            aria-label="Show tools"
            className="glass grid h-8 w-8 place-items-center rounded-[10px] text-fg-muted transition-colors hover:text-fg"
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <nav
      aria-label="Tools"
      aria-orientation="vertical"
      role="toolbar"
      onKeyDown={handleKeyDown}
      className="glass-2 glass-specular scroll-slim flex w-[54px] shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-[var(--radius-panel)] py-2"
    >
      {TOOL_GROUPS.map((group, groupIndex) => (
        <div key={group.id} className="flex flex-col items-center gap-1">
          {groupIndex > 0 && <div className="my-1 h-px w-7 bg-white/10" />}

          {group.items.map((toolId) => {
            const tool = TOOLS[toolId]
            const isActive = toolId === activeTool

            return (
              <Tooltip key={toolId} label={tool.label} shortcut={tool.shortcut} side="right">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setTool(toolId)}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[11px]',
                    'transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-soft)]',
                    'active:scale-[0.94]',
                    isActive
                      ? 'bg-gradient-to-br from-aurora-violet/85 to-aurora-indigo/70 text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3),0_8px_20px_-10px_rgb(139_92_246/1)]'
                      : 'text-fg-muted hover:bg-white/[0.08] hover:text-fg',
                  )}
                >
                  <Icon name={tool.icon} size={19} />
                </button>
              </Tooltip>
            )
          })}
        </div>
      ))}

      {/* Primary / secondary colour pair lives here: it is the control the eye
          reaches for most often, and keeping it in the rail removes a trip to
          the inspector (low cognitive load). */}
      <div className="my-1 h-px w-7 bg-white/10" />
      <ColourStack />
    </nav>
  )
}

function ColourStack() {
  const { primary, secondary, swapColors, resetColors, openDialog } = useUi()

  return (
    <div className="flex flex-col items-center gap-1.5 pb-1">
      <Tooltip label="Primary / secondary colour — click to swap" shortcut="X" side="right">
        <button
          type="button"
          onClick={swapColors}
          onDoubleClick={resetColors}
          aria-label="Swap primary and secondary colours"
          className="group relative h-11 w-11"
        >
          <span
            className="absolute right-0 bottom-0 h-7 w-7 rounded-[9px] border border-white/25 shadow-[0_3px_10px_-4px_rgb(0_0_0/0.8)] transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ background: secondary }}
          />
          <span
            className="absolute top-0 left-0 h-7 w-7 rounded-[9px] border border-white/40 shadow-[0_4px_12px_-4px_rgb(0_0_0/0.85)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:translate-y-0.5"
            style={{ background: primary }}
          />
        </button>
      </Tooltip>

      <Tooltip label="Command palette" shortcut="⌘K" side="right">
        <button
          type="button"
          onClick={() => openDialog('palette')}
          aria-label="Open the command palette"
          className="grid h-7 w-7 place-items-center rounded-[9px] text-fg-subtle transition-colors hover:bg-white/[0.08] hover:text-fg"
        >
          <Icon name="palette" size={15} />
        </button>
      </Tooltip>
    </div>
  )
}