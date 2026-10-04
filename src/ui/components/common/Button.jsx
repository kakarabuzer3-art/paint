import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Kbd from './Kbd.jsx'

const VARIANTS = {
  primary:
    'bg-gradient-to-br from-aurora-violet to-aurora-indigo text-white shadow-[0_10px_26px_-12px_rgb(139_92_246/0.9),inset_0_1px_0_0_rgb(255_255_255/0.24)] hover:brightness-110',
  clay: 'clay text-fg hover:bg-white/[0.1]',
  ghost: 'text-fg-muted hover:bg-white/[0.07] hover:text-fg',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500',
}

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-[12px] rounded-[10px]',
  md: 'h-9 gap-2 px-3.5 text-[13px] rounded-[11px]',
  lg: 'h-10 gap-2 px-4 text-[13px] rounded-[12px]',
}

/**
 * Labelled button. Used wherever an action benefits from a written label —
 * a label beats an icon alone for learnability (icon-only lives in IconButton).
 */
export default function Button({
  children,
  icon,
  variant = 'clay',
  size = 'md',
  trailingIcon,
  shortcut,
  className,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-medium tracking-tight',
        'transition-[background-color,color,box-shadow,filter,transform] duration-150',
        'ease-[var(--ease-out-soft)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        SIZES[size] ?? SIZES.md,
        VARIANTS[variant] ?? VARIANTS.clay,
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} size={15} className="opacity-70" /> : null}
      {shortcut ? <Kbd size="sm" className="ml-0.5">{shortcut}</Kbd> : null}
    </button>
  )
}