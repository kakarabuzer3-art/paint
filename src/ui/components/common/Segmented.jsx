import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Field from './Field.jsx'

/**
 * Segmented control for small mutually-exclusive choices.
 *
 * Exposed as a radiogroup with real radio semantics so arrow keys and screen
 * readers behave natively; the visual treatment is the clay "well".
 */
export default function Segmented({ label, value, items, onChange, width, className }) {
  return (
    <Field label={label} width={width} className={className}>
      <div
        role="radiogroup"
        aria-label={label}
        className="well inline-flex items-center gap-0.5 rounded-[11px] p-0.5"
      >
        {items.map((item) => {
          const selected = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(item.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[11px] font-medium tracking-tight',
                'transition-[background-color,color,box-shadow] duration-150 ease-[var(--ease-out-soft)]',
                selected
                  ? 'bg-white/[0.13] text-fg shadow-[inset_3px_3px_7px_-3px_rgb(0_0_0/0.65),inset_-2px_-2px_6px_-4px_rgb(255_255_255/0.05)]'
                  : 'text-fg-subtle hover:text-fg',
              )}
            >
              {item.icon && <Icon name={item.icon} size={13} />}
              {item.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}