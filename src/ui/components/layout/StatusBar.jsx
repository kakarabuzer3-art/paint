import { useEffect, useRef } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import { TOOLS } from '../../data/tools.js'
import { useUi } from '../../state/context.js'

/** Autosave states the status bar is allowed to talk about. */
const AUTOSAVE_LABELS = {
  saving: 'Autosaving…',
  saved: 'Recovery on',
  unavailable: 'Recovery unavailable',
}

/**
 * Bottom status bar.
 *
 * Performance pattern worth calling out: pointer coordinates are shared with
 * the engine through `cursorRef` and read here inside a single rAF loop that
 * writes straight to the DOM. Fast pointer movement therefore produces *zero*
 * React renders — putting x/y in useState would re-render the whole tree on
 * every mousemove, which is the classic canvas-app performance mistake.
 */
export default function StatusBar() {
  const { activeTool, doc, zoom, layers, activeLayerId, cursorRef, panels, selection, isDirty, recovery } =
    useUi()
  const xRef = useRef(null)
  const yRef = useRef(null)

  const tool = TOOLS[activeTool]

  useEffect(() => {
    let frame = 0
    let lastX = null
    let lastY = null

    const tick = () => {
      const { x, y, inside } = cursorRef.current
      const displayX = inside ? String(Math.round(x)) : '—'
      const displayY = inside ? String(Math.round(y)) : '—'

      // Only touch the DOM when the value actually changed.
      if (displayX !== lastX && xRef.current) {
        xRef.current.textContent = displayX
        lastX = displayX
      }
      if (displayY !== lastY && yRef.current) {
        yRef.current.textContent = displayY
        lastY = displayY
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cursorRef])

  const activeLayer = layers.find((layer) => layer.id === activeLayerId)

  return (
    <footer
      className="clay-2 flex h-8 shrink-0 items-center gap-3 overflow-hidden rounded-[var(--radius-panel)] px-3 text-[10.5px] text-fg-subtle"
      aria-label="Status"
    >
      {/*
        Current tool + its guidance, always visible for learning. The tool
        change is announced politely because every other surface announces its
        own changes — a tool switch is otherwise a silent, invisible state
        change for anyone not looking at the rail.
      */}
      <span
        className="flex min-w-0 items-center gap-1.5 text-fg-muted"
        role="status"
        aria-live="polite"
      >
        <Icon name={tool.icon} size={13} className="shrink-0 text-aurora-cyan" />
        <span className="truncate font-medium">{tool.label}</span>
        <span className="hidden truncate text-fg-subtle lg:inline">— {tool.hint}</span>
      </span>

      <div className="flex-1" />

      <Item label="X" value={<span ref={xRef}>—</span>} />
      <Item label="Y" value={<span ref={yRef}>—</span>} />
      <Item label="Doc" value={`${doc.width} × ${doc.height}`} className="hidden sm:flex" />

      {/* Live selection size — the number you check after every lasso. */}
      {!selection.isEmpty && selection.bounds && (
        <Item
          label="Sel"
          value={`${selection.bounds.width} × ${selection.bounds.height}`}
          className="text-aurora-cyan"
        />
      )}

      {panels.inspector && activeLayer && (
        <Item
          label="Layer"
          value={activeLayer.name}
          className="hidden max-w-[9rem] xl:flex"
          truncate
        />
      )}

      <span className="h-4 w-px shrink-0 bg-white/10" />

      <span className="flex items-center gap-1.5 font-mono tabular-nums">
        <Icon name="zoom" size={12} />
        {Math.round(zoom * 100)}%
      </span>

      {/* Two independent facts, kept apart: whether the file on disk matches
          the canvas, and whether a recovery snapshot is armed. Conflating them
          would mean either lying about autosave or implying a file was written. */}
      <span className="hidden items-center gap-1.5 md:flex">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isDirty ? 'bg-aurora-cyan' : 'bg-aurora-teal/80',
          )}
          aria-hidden="true"
        />
        {isDirty ? 'Unsaved changes' : 'No unsaved changes'}
      </span>

      {recovery.status !== 'idle' && recovery.status !== 'offered' && (
        <span className="hidden items-center gap-1.5 lg:flex">
          <span className="h-4 w-px shrink-0 bg-white/10" />
          <Icon name="clock" size={12} className="text-fg-subtle" />
          {AUTOSAVE_LABELS[recovery.status] ?? recovery.status}
        </span>
      )}
    </footer>
  )
}

function Item({ label, value, className, truncate }) {
  return (
    <span className={`flex shrink-0 items-center gap-1.5 ${className ?? ''}`}>
      <span className="font-mono text-[9.5px] tracking-[0.08em] text-fg-subtle uppercase">{label}</span>
      <span className={`font-mono text-fg-muted tabular-nums ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
    </span>
  )
}