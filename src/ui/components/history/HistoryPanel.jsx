import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Button from '../common/Button.jsx'
import { useUi } from '../../state/context.js'

const ICON_BY_KIND = {
  pixels: 'brush',
  structure: 'layers',
  action: 'sparkle',
}

/**
 * History panel — the visible, scrubable form of the undo stack.
 *
 * Entries are listed newest-first (what the user just did is at the top) and
 * clicking one jumps the document to that point, which is the whole reason to
 * keep labels rather than a bare stack.
 */
export default function HistoryPanel() {
  const { historyEntries, canUndo, canRedo, undo, redo, jumpHistory } = useUi()

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="glass" icon="undo" disabled={!canUndo} onClick={undo}>
          Undo
        </Button>
        <Button size="sm" variant="glass" icon="redo" disabled={!canRedo} onClick={redo}>
          Redo
        </Button>
        <span className="ml-auto font-mono text-[10px] text-fg-subtle tabular-nums">
          {historyEntries.length}/60
        </span>
      </div>

      {historyEntries.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-white/[0.12] px-2.5 py-4 text-center text-[10.5px] leading-relaxed text-fg-subtle">
          Every action will appear here so you can scrub back through your work.
        </p>
      ) : (
        <ol className="scroll-slim flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-0.5">
          {[...historyEntries].reverse().map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                onClick={() => jumpHistory(entry.index + 1)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition-colors duration-150',
                  'text-[11px] text-fg-muted hover:bg-white/[0.07] hover:text-fg',
                  entry.index === historyEntries.length - 1 && 'bg-white/[0.06] text-fg',
                )}
              >
                <Icon name={ICON_BY_KIND[entry.kind] ?? 'sparkle'} size={13} className="shrink-0 text-fg-subtle" />
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <span className="shrink-0 font-mono text-[9px] text-fg-subtle tabular-nums">
                  {entry.index + 1}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}