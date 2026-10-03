import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn.js'
import { clamp, hexToHsv, hsvToHex, hexToRgb, normalizeHex } from '../../../lib/color.js'
import Icon from '../../icons/Icon.jsx'
import IconButton from '../common/IconButton.jsx'
import Tooltip from '../common/Tooltip.jsx'

const CAN_EYEDROP = typeof window !== 'undefined' && 'EyeDropper' in window

/**
 * Saturation/value pad + hue slider + hex entry.
 *
 * HSV is held in local state while dragging. Round-tripping every pointer
 * move through hex would quantise the intermediate positions (hex is 8-bit
 * per channel) and make fine control feel sticky.
 */
export default function ColorPicker({ value, onChange, className }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const committedRef = useRef(value)

  // Adopt an external change (eyedropper, swatch click, swap) only when it
  // actually differs from what we last emitted — never mid-drag.
  useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value
      setHsv(hexToHsv(value))
      setDraft(value.toUpperCase())
    }
  }, [value])

  // Local draft so a hex value can be typed one character at a time;
  // committing only happens when the string is a complete colour.
  const [draft, setDraft] = useState(() => value.toUpperCase())

  const handleHexInput = (event) => {
    const raw = event.target.value.replace(/[^#0-9a-f]/gi, '').slice(0, 7)
    setDraft(raw.toUpperCase())

    const complete = raw.startsWith('#') ? raw.length === 7 : raw.length >= 6
    const hex = normalizeHex(raw)
    if (complete && hex) emit(hexToHsv(hex))
  }

  const emit = useCallback(
    (next) => {
      setHsv(next)
      const hex = hsvToHex(next)
      committedRef.current = hex
      onChange(hex)
    },
    [onChange],
  )

  const padHue = hsvToHex({ h: hsv.h, s: 100, v: 100 })
  const rgb = hexToRgb(value)

  const updateFromPad = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const s = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
    const v = clamp(100 - ((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    emit({ ...hsv, s, v })
  }

  const handlePad = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPad(event)
  }

  const pickFromScreen = async () => {
    if (!CAN_EYEDROP) return
    try {
      const result = await new window.EyeDropper().open()
      const hex = normalizeHex(result.sRGBHex)
      if (hex) emit(hexToHsv(hex))
    } catch {
      /* User cancelled — nothing to report. */
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* -------------------------------------------------- saturation / value */}
      <div
        role="presentation"
        onPointerDown={handlePad}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPad(event)
        }}
        className="well relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-[12px]"
        style={{ backgroundColor: padHue }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff,transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#000,transparent)]" />
        <span
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow-[0_2px_8px_rgb(0_0_0/0.7)]"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, transform: 'translate(-50%,-50%)' }}
        />
      </div>

      {/* ---------------------------------------------------------------- hue */}
      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          aria-label="Hue"
          onChange={(event) => emit({ ...hsv, h: Number(event.target.value) })}
          style={{
            backgroundImage:
              'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
          className={cn(
            'h-3 w-full cursor-pointer appearance-none rounded-full border border-white/15',
            '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:rounded-[5px] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
            '[&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.7)]',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-[5px]',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white',
          )}
        />
      </div>

      {/* ---------------------------------------------------------- hex + read */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 rounded-[9px] border border-white/30 shadow-[0_3px_10px_-4px_rgb(0_0_0/0.8)]"
          style={{ background: value }}
        />

        <label className="sr-only" htmlFor="hex-input">
          Hex colour value
        </label>
        <input
          id="hex-input"
          value={draft}
          spellCheck="false"
          maxLength={7}
          aria-label="Hex colour value"
          onChange={handleHexInput}
          onBlur={() => setDraft(value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className={cn(
            'well h-8 min-w-0 flex-1 rounded-[9px] px-2.5 font-mono text-[12px] tracking-tight',
            'text-fg tabular-nums outline-none focus:ring-1 focus:ring-aurora-cyan/50',
          )}
        />

        <div className="flex shrink-0 gap-0.5 font-mono text-[10.5px] text-fg-subtle tabular-nums">
          {[rgb.r, rgb.g, rgb.b].map((channel, index) => (
            <span key={index} className="rounded-[7px] bg-white/[0.05] px-1.5 py-1">
              {channel}
            </span>
          ))}
        </div>

        {CAN_EYEDROP && (
          <Tooltip label="Sample from screen">
            <span>
              <IconButton icon="eyedropper" label="Sample colour from the screen" onClick={pickFromScreen} />
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}