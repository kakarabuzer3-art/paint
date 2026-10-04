import { cn } from '../../../lib/cn.js'
import Field from './Field.jsx'

/**
 * Switch built on role="switch" (not a checkbox) because it takes effect
 * immediately — no save step to defer to.
 */
export default function Toggle({ label, checked, onChange, hint, disabled = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'group inline-flex h-7 items-center gap-2 rounded-full pr-2.5 pl-1 text-[11px] font-medium tracking-tight',
          'border border-line transition-colors duration-150 disabled:opacity-40',
          checked ? 'bg-aurora-violet/25 text-fg' : 'bg-white/[0.04] text-fg-subtle hover:text-fg-muted',
        )}
      >
        <span
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease-out-soft)]',
            checked ? 'bg-aurora-violet/80' : 'bg-white/[0.13]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-clay-1 shadow-[2px_2px_6px_-1px_rgb(0_0_0/0.6),-1px_-1px_4px_-1px_rgb(255_255_255/0.08)]',
              'transition-transform duration-200 ease-[var(--ease-spring)]',
              checked ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </span>
        <span className="truncate">{label}</span>
      </button>
      {hint && <p className="text-[10px] leading-tight text-fg-subtle">{hint}</p>}
    </div>
  )
}

/** Toggle that sits inline in the options bar without an outer label. */
export function InlineToggle({ label, checked, onChange, disabled }) {
  return (
    <Field label={label} width="w-auto">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'inline-flex h-5 w-9 items-center rounded-full border border-line px-0.5 transition-colors duration-200',
          checked ? 'bg-aurora-violet/80' : 'bg-white/[0.11]',
          disabled && 'opacity-40',
        )}
      >
        <span
          className={cn(
            'h-4 w-4 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.5)] transition-transform duration-200 ease-[var(--ease-spring)]',
            checked ? 'translate-x-3.5' : 'translate-x-0',
          )}
        />
      </button>
    </Field>
  )
}