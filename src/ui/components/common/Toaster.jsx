import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import { useUi } from '../../state/context.js'

const TONES = {
  info: { icon: 'info', ring: 'border-aurora-cyan/35', accent: 'text-aurora-cyan' },
  success: { icon: 'check', ring: 'border-aurora-teal/40', accent: 'text-aurora-teal' },
  warning: { icon: 'alert', ring: 'border-aurora-amber/40', accent: 'text-aurora-amber' },
  error: { icon: 'alert', ring: 'border-rose-400/45', accent: 'text-rose-300' },
}

/**
 * Global, non-blocking feedback channel.
 *
 * Rendered in a polite live region so assistive tech announces the result of
 * an action without stealing focus (immediate feedback, zero interruption).
 */
export default function Toaster() {
  const { toasts, dismissToast } = useUi()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-14 left-1/2 z-[90] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.info
        return (
          <div
            key={toast.id}
            className={cn(
              'clay-3 animate-rise pointer-events-auto flex w-full items-start gap-2.5 rounded-[13px] border px-3 py-2.5',
              tone.ring,
            )}
          >
            <Icon name={tone.icon} size={15} className={cn('mt-0.5', tone.accent)} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold tracking-tight text-fg">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="mt-0.5 shrink-0 rounded-[7px] p-1 text-fg-subtle transition-colors hover:bg-white/10 hover:text-fg"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}