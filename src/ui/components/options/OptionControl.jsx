import { OPTION_DEFS } from '../../data/tools.js'
import Slider from '../common/Slider.jsx'
import Segmented from '../common/Segmented.jsx'
import Select from '../common/Select.jsx'
import { InlineToggle } from '../common/Toggle.jsx'
import Field from '../common/Field.jsx'
import { useUi } from '../../state/context.js'

/**
 * Renders one control for the active tool's option schema.
 *
 * The options bar never branches on tool id — it branches on *control type*.
 * That is what lets a new tool reuse existing controls for free.
 */
export default function OptionControl({ id, value, onChange }) {
  const def = OPTION_DEFS[id]

  switch (def?.type) {
    case 'slider':
      return (
        <Slider
          label={def.label}
          value={value}
          min={def.min}
          max={def.max}
          step={def.step}
          unit={def.unit}
          width={def.width}
          onChange={onChange}
        />
      )

    case 'segmented':
      return (
        <Segmented label={def.label} value={value} items={def.items} onChange={onChange} />
      )

    case 'toggle':
      return <InlineToggle label={def.label} checked={Boolean(value)} onChange={onChange} />

    case 'select':
      return (
        <Select
          label={def.label}
          value={value}
          options={def.options}
          onChange={onChange}
          width={def.width}
        />
      )

    case 'colorSlot':
      return <ColorSlotControl def={def} />

    default:
      return null
  }
}

/**
 * Fill / stroke slot chip. Clicking opens the colour dialog rather than
 * embedding a full picker in the options bar — progressive disclosure: the
 * control stays compact, the depth is one click away.
 */
function ColorSlotControl({ def }) {
  const { primary, secondary, openDialog } = useUi()
  const hex = def.slot === 'primary' ? primary : secondary
  const label = def.label

  return (
    <Field label={label} width="w-auto">
      <button
        type="button"
        onClick={() => openDialog('color')}
        aria-label={`${label} colour ${hex} — open colour picker`}
        className="flex h-7 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.05] px-1.5 transition-colors duration-150 hover:bg-white/[0.1]"
      >
        <span
          className="h-4 w-4 rounded-[6px] border border-white/35"
          style={{ background: hex }}
        />
        <span className="font-mono text-[10px] text-fg-muted uppercase tabular-nums">
          {hex}
        </span>
      </button>
    </Field>
  )
}