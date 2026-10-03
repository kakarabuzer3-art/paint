import { useId } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Field from './Field.jsx'

/**
 * Native <select> in glass clothing.
 *
 * A native element is intentional: it keeps platform keyboard behaviour,
 * type-ahead, and the OS picker on mobile — all of which a div-based menu
 * would have to rebuild (badly). Visuals come from the wrapper.
 */
export default function Select({ label, value, options, onChange, width = 'w-40', disabled = false }) {
  const id = useId()

  return (
    <Field label={label} htmlFor={id} width={width}>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'well h-7 w-full cursor-pointer appearance-none rounded-[10px] pr-7 pl-2.5',
            'text-[11px] font-medium tracking-tight text-fg',
            'transition-colors duration-150 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-ink text-fg">
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          size={13}
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-fg-subtle"
        />
      </div>
    </Field>
  )
}