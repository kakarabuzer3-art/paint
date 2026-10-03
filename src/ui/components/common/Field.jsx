import { cn } from '../../../lib/cn.js'

/**
 * The single labelled-control wrapper used by the options bar and inspector.
 *
 * Centralising the label/readout layout is what keeps the options bar
 * visually calm as tools swap their controls in and out.
 */
export default function Field({ label, readout, hint, htmlFor, width, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', width, className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle"
      >
        <span className="truncate">{label}</span>
        {readout !== undefined && readout !== null && (
          <span className="font-mono text-[10px] font-medium normal-case tracking-normal text-fg-muted tabular-nums">
            {readout}
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[10px] leading-tight text-fg-subtle">{hint}</p>}
    </div>
  )
}