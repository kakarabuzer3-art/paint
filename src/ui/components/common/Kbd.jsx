import { cn } from '../../../lib/cn.js'

/**
 * A single keyboard keycap.
 *
 * Shortcut hints are everywhere in the UI on purpose: recognition over
 * recall — the user never has to remember a binding they can simply read.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'sm'|'md'} [props.size]
 * @param {string} [props.className]
 */
export default function Kbd({ children, size = 'md', className }) {
  return (
    <kbd
      className={cn(
        'inline-flex select-none items-center justify-center rounded-[6px] border border-line',
        'bg-white/[0.07] font-mono font-medium text-fg-muted shadow-[2px_2px_5px_-2px_rgb(0_0_0/0.5),-1px_-1px_4px_-2px_rgb(255_255_255/0.04)]',
        size === 'sm' ? 'min-w-4 px-1 text-[9px] leading-[15px]' : 'min-w-5 px-1.5 text-[10px] leading-[17px]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** Renders a "⌘K" style chord from an array of keys. */
export function KbdChord({ keys, size = 'md', className }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key) => (
        <Kbd key={key} size={size}>
          {key}
        </Kbd>
      ))}
    </span>
  )
}