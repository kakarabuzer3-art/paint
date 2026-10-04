import { useCallback, useRef, useState } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import Tooltip from '../common/Tooltip.jsx'
import { matchMaterial, materialsFor } from '../../data/materials.js'
import { useUi } from '../../state/context.js'

/**
 * Named-material picker.
 *
 * Sits above the raw sliders because a number is not a decision anybody can
 * make from memory: "hardness 82, flow 100, spacing 12" describes a material far
 * less well than "Charcoal" does. Every mainstream paint app leads with names
 * and hides the numbers; this is that layer.
 *
 * Two affordances carry the weight:
 *   - The active material stays highlighted, so the user always knows what they
 *     are holding without reading anything.
 *   - Choosing one is a single, complete change rather than a series of slider
 *     nudges, so a material can never be half-applied.
 *
 * Applying a material is *not* undoable and deliberately so: tool options are
 * interface state, not document state, and mixing the two would mean a Ctrl+Z
 * after drawing would walk back through brush selections. The options bar's
 * existing "Reset to defaults" covers the case where a material is a mistake.
 */
export default function MaterialPicker() {
  const { activeTool, options, setOptions } = useUi()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const materials = materialsFor(activeTool)
  const active = matchMaterial(activeTool, options)

  const choose = useCallback(
    (material) => {
      setOptions(material.options)
      setOpen(false)
    },
    [setOptions],
  )

  // Tools without materials render nothing rather than an empty pill.
  if (materials.length === 0) return null

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="clay flex h-8 items-center gap-2 rounded-[12px] px-2.5 text-left transition-[box-shadow,background-color] duration-150 hover:bg-[#282336]"
      >
        <Icon name={active?.icon ?? materials[0].icon} size={14} className="text-fg-muted" />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-medium tracking-tight text-fg-subtle">Material</span>
          <span className="text-[11.5px] font-semibold tracking-tight text-fg">
            {active?.label ?? 'Custom'}
          </span>
        </span>
        <Icon name="chevronDown" size={13} className="ml-0.5 text-fg-subtle" />
      </button>

      {open && (
        <>
          {/* Click-away catcher. Rendered under the sheet so it never eats the
              click that opened it. */}
          <button
            type="button"
            aria-label="Close the material menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Drawing materials"
            className="clay-3 absolute top-full left-0 z-50 mt-1.5 grid w-[264px] grid-cols-2 gap-1.5 rounded-[var(--radius-md)] p-1.5"
          >
            {materials.map((material) => {
              const isActive = active?.id === material.id
              return (
                <button
                  key={material.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => choose(material)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-[11px] px-2.5 py-2 text-left transition-colors duration-150',
                    isActive
                      ? 'bg-aurora-violet/22 text-fg'
                      : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <Icon name={material.icon} size={13} />
                    <span className="text-[11.5px] font-semibold tracking-tight">{material.label}</span>
                  </span>
                  <span className="text-[9.5px] leading-tight text-fg-subtle">{material.hint}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}