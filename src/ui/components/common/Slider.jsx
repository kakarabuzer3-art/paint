import { useId } from 'react'
import { cn } from '../../../lib/cn.js'
import Field from './Field.jsx'

/**
 * Range control with a filled track.
 *
 * Uses a native <input type="range"> so keyboard support, RTL behaviour and
 * touch handling come for free — a custom drag surface would have to
 * reimplement all three (and usually gets ARIA wrong).
 */
export default function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  width = 'w-32',
  onChange,
  disabled = false,
  format,
}) {
  const id = useId()
  const safeValue = Number.isFinite(value) ? value : min
  const pct = max === min ? 0 : ((safeValue - min) / (max - min)) * 100
  const readout = format ? format(safeValue) : `${Math.round(safeValue * 10) / 10}${unit}`

  return (
    <Field label={label} readout={readout} htmlFor={id} width={width}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          // Filled-track effect without an extra element.
          backgroundImage: `linear-gradient(90deg, var(--color-aurora-violet) 0%, var(--color-aurora-cyan) ${pct}%, rgb(255 255 255 / 0.09) ${pct}%, rgb(255 255 255 / 0.09) 100%)`,
        }}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10',
          'transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40',
          '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/70',
          '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.65)]',
          '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150',
          'hover:[&::-webkit-slider-thumb]:scale-110',
          '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
        )}
      />
    </Field>
  )
}