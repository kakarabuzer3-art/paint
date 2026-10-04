import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'

const SIZES = {
  xs: { btn: 'h-7 w-7 rounded-[9px]', icon: 15 },
  sm: { btn: 'h-8 w-8 rounded-[10px]', icon: 16 },
  md: { btn: 'h-9 w-9 rounded-[11px]', icon: 18 },
  lg: { btn: 'h-10 w-10 rounded-[12px]', icon: 19 },
}

const VARIANTS = {
  ghost: 'text-fg-muted hover:bg-white/[0.07] hover:text-fg',
  clay: 'clay text-fg-muted hover:bg-white/[0.1] hover:text-fg',
  subtle: 'bg-white/[0.05] text-fg hover:bg-white/[0.1]',
}

/**
 * Square, icon-only control used across the top bar, rail and panels.
 *
 * Always forwards an accessible name via `aria-label` — an icon alone is not
 * a label. Pairs with <Tooltip> for the sighted shortcut hint.
 */
export default function IconButton({
  icon,
  label,
  size = 'sm',
  variant = 'ghost',
  active = false,
  disabled = false,
  tone = 'accent',
  className,
  iconClassName,
  children,
  ...rest
}) {
  const dims = SIZES[size] ?? SIZES.sm

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={rest.role === 'switch' ? undefined : active || undefined}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center transition-[background-color,color,box-shadow,transform]',
        'duration-150 ease-[var(--ease-out-soft)] active:scale-[0.95]',
        dims.btn,
        VARIANTS[variant],
        active &&
          (tone === 'accent'
            ? 'bg-aurora-violet/20 text-fg shadow-[0_0_0_1px_rgb(139_92_246/0.5)_inset,0_6px_18px_-8px_rgb(139_92_246/0.8)]'
            : 'bg-white/[0.14] text-fg'),
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={dims.icon} className={iconClassName} /> : null}
      {children}
    </button>
  )
}