import { cn } from '../../../lib/cn.js'
import Kbd from './Kbd.jsx'

/**
 * CSS-only tooltip — no portal, no measurement, no listeners.
 *
 * A pure-CSS approach keeps tooltips off the JS main thread entirely, which
 * matters because the rail is hovered constantly. The accessible name is not
 * delegated to the tooltip: interactive children should carry their own
 * `aria-label`, so screen-reader users get the label without hovering.
 */
const SIDES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const ORIGIN = {
  top: 'origin-bottom',
  bottom: 'origin-top',
  left: 'origin-right',
  right: 'origin-left',
}

export default function Tooltip({
  label,
  shortcut,
  side = 'top',
  delay = 260,
  className,
  children,
}) {
  if (!label) return children

  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        style={{ transitionDelay: `${delay}ms` }}
        className={cn(
          'glass-solid pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap',
          'rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium tracking-tight text-fg',
          'opacity-0 shadow-black/50 transition-[opacity,transform] duration-150 ease-[var(--ease-out-soft)]',
          'scale-95 group-hover/tip:scale-100 group-hover/tip:opacity-100',
          'group-focus-visible/tip:scale-100 group-focus-visible/tip:opacity-100',
          SIDES[side],
          ORIGIN[side],
        )}
      >
        {label}
        {shortcut && <Kbd size="sm">{shortcut}</Kbd>}
      </span>
    </span>
  )
}

/** Same visual treatment, exposed for ad-hoc usage (e.g. canvas HUD hints). */
export function TooltipSurface({ children, className }) {
  return (
    <span
      className={cn(
        'glass-solid rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium tracking-tight text-fg',
        className,
      )}
    >
      {children}
    </span>
  )
}