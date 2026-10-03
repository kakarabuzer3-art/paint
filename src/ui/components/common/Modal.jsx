import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import IconButton from './IconButton.jsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

/**
 * Accessible glass dialog.
 *
 * Responsibilities kept in one place so no caller can forget them:
 *   - Escape to dismiss, backdrop click to dismiss
 *   - focus moved into the dialog and restored to the trigger on close
 *   - Tab / Shift+Tab trapped inside the dialog
 *   - role="dialog" + aria-modal + labelled heading
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  children,
  footer,
}) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      )
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return undefined

    restoreRef.current = document.activeElement

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const target = panel.querySelector(FOCUSABLE) ?? panel
      target.focus?.()
    })

    return () => {
      cancelAnimationFrame(raf)
      const restore = restoreRef.current
      if (restore && typeof restore.focus === 'function') restore.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] pb-8"
      onKeyDown={handleKeyDown}
    >
      <div
        className="animate-fade absolute inset-0 bg-void/70 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'glass-3 glass-specular animate-rise relative w-full overflow-hidden rounded-[var(--radius-lg)] outline-none',
          WIDTHS[size] ?? WIDTHS.md,
        )}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3">
          {icon && (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-aurora-violet/20 text-fg">
              <Icon name={icon} size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="x" label="Close dialog" onClick={onClose} />
        </header>

        <div className="hairline-t scroll-slim max-h-[62vh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="hairline-t flex items-center justify-end gap-2 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}