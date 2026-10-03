import { useState } from 'react'
import { cn } from '../../../lib/cn.js'
import { readableInkOn } from '../../../lib/color.js'
import ColorPicker from './ColorPicker.jsx'
import IconButton from '../common/IconButton.jsx'
import { useUi } from '../../state/context.js'

/**
 * Colour studio: slot switcher, picker, curated palette, recent colours.
 *
 * The slot switcher matters because shapes need a *stroke* colour as well as
 * a fill — showing both slots up front makes the primary/secondary model
 * visible instead of hidden behind a modifier key.
 */
export default function ColorPanel({ allowSlotChange = true, className }) {
  const {
    primary,
    secondary,
    setPrimary,
    setSecondary,
    recentColors,
    clearRecent,
    palette,
  } = useUi()

  // Ephemeral per-surface choice: the inspector and the colour dialog each
  // remember their own slot rather than writing it into global state.
  const [slot, setSlot] = useState('primary')
  const activeSlot = allowSlotChange ? slot : 'primary'
  const activeHex = activeSlot === 'primary' ? primary : secondary
  const apply = activeSlot === 'primary' ? setPrimary : setSecondary

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {allowSlotChange && (
        <div role="radiogroup" aria-label="Colour slot" className="flex items-center gap-2">
          {[
            { id: 'primary', label: 'Primary', hex: primary },
            { id: 'secondary', label: 'Secondary', hex: secondary },
          ].map((item) => {
            const selected = item.id === activeSlot
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSlot(item.id)}
                className={cn(
                  'flex h-9 flex-1 items-center gap-2 rounded-[11px] border px-2 text-[11px] font-medium tracking-tight transition-colors duration-150',
                  selected
                    ? 'border-aurora-violet/60 bg-aurora-violet/15 text-fg'
                    : 'border-white/10 bg-white/[0.04] text-fg-subtle hover:text-fg-muted',
                )}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-[7px] border border-white/35"
                  style={{ background: item.hex }}
                />
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      <ColorPicker value={activeHex} onChange={(hex) => apply(hex, { remember: true })} />

      {/* ------------------------------------------------------ curated palette */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9.5px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
            Studio palette
          </p>
          <IconButton
            icon="contrast"
            label="Reset colours to black and white"
            size="xs"
            onClick={() => {
              setPrimary('#000000', { remember: true })
              setSecondary('#ffffff', { remember: true })
            }}
          />
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {palette.map((hex) => {
            const isActive = hex.toLowerCase() === activeHex.toLowerCase()
            return (
              <button
                key={hex}
                type="button"
                onClick={() => apply(hex, { remember: true })}
                aria-label={`Use colour ${hex}`}
                title={hex.toUpperCase()}
                className={cn(
                  'group relative aspect-square rounded-[9px] border transition-transform duration-150',
                  'hover:scale-[1.08] active:scale-95',
                  isActive
                    ? 'border-white shadow-[0_0_0_2px_rgb(139_92_246/0.55)]'
                    : 'border-white/20',
                )}
                style={{ background: hex }}
              >
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[9px] text-[9px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: readableInkOn(hex) }}
                >
                  {hex.slice(1, 4).toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* -------------------------------------------------------------- recent */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9.5px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
            Recent
          </p>
          {recentColors.length > 0 && (
            <button
              type="button"
              onClick={clearRecent}
              className="text-[10px] font-medium text-fg-subtle transition-colors hover:text-fg"
            >
              Clear
            </button>
          )}
        </div>

        {recentColors.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-white/[0.12] px-2.5 py-3 text-center text-[10.5px] text-fg-subtle">
            Colours you use appear here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {recentColors.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => apply(hex, { remember: true })}
                aria-label={`Use recent colour ${hex}`}
                title={hex.toUpperCase()}
                className="h-6 w-6 rounded-[7px] border border-white/25 transition-transform duration-150 hover:scale-110 active:scale-95"
                style={{ background: hex }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}