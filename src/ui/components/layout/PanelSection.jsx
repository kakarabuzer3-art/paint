import { useState } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'

/**
 * A collapsible clay section inside the inspector.
 *
 * Progressive disclosure: the common controls (colour, layers) stay open,
 * secondary detail collapses so the panel never becomes a wall of sliders.
 */
export default function PanelSection({
  title,
  icon,
  actions,
  defaultOpen = true,
  children,
  className,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={cn('hairline-b last:border-b-0', className)}>
      <header className="flex items-center gap-1 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-1 py-0.5 text-left"
        >
          <Icon
            name="chevronRight"
            size={13}
            className={cn(
              'shrink-0 text-fg-subtle transition-transform duration-200 ease-[var(--ease-out-soft)]',
              open && 'rotate-90',
            )}
          />
          {icon && <Icon name={icon} size={14} className="shrink-0 text-fg-muted" />}
          <span className="truncate text-[10.5px] font-semibold tracking-[0.13em] text-fg-muted uppercase">
            {title}
          </span>
        </button>
        {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
      </header>

      {open && <div className="px-3 pb-3.5">{children}</div>}
    </section>
  )
}