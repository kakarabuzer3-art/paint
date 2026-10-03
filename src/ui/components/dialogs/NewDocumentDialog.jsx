import { useEffect, useState } from 'react'
import { cn } from '../../../lib/cn.js'
import Modal from '../common/Modal.jsx'
import Button from '../common/Button.jsx'
import { useUi } from '../../state/context.js'

const PRESETS = [
  { label: 'HD', width: 1920, height: 1080 },
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'Large square', width: 2048, height: 2048 },
  { label: '4K', width: 3840, height: 2160 },
  { label: 'A4 @150dpi', width: 1240, height: 1754 },
  { label: 'Retro', width: 1024, height: 768 },
]

const MIN_DIM = 64
const MAX_DIM = 8192
const CAUTION_DIM = 4096 // layered documents above this cost ~64MB+ per layer

const clampDim = (value) => Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(value || MIN_DIM)))

/**
 * New document dialog.
 *
 * Defaults, presets and validation live here so a fresh canvas is one click
 * away (sensible defaults) while the numbers stay editable for real work.
 * Large dimensions warn rather than block — the artist decides.
 */
export default function NewDocumentDialog() {
  const { dialogs, closeDialog, doc, setDoc, pushToast, fitToScreen } = useUi()
  const [name, setName] = useState(doc.name)
  const [width, setWidth] = useState(doc.width)
  const [height, setHeight] = useState(doc.height)

  // Re-seed from the live document each time the dialog opens.
  useEffect(() => {
    if (dialogs.newDoc) {
      setName('Untitled artwork')
      setWidth(doc.width)
      setHeight(doc.height)
    }
  }, [dialogs.newDoc, doc.width, doc.height])

  const apply = () => {
    const w = clampDim(width)
    const h = clampDim(height)

    setDoc({ name: name.trim() || 'Untitled artwork', width: w, height: h })
    closeDialog('newDoc')

    // The stage re-measures on a size change and snaps back to fit.
    requestAnimationFrame(() => fitToScreen())

    if (w > CAUTION_DIM || h > CAUTION_DIM) {
      pushToast({
        title: 'Large document created',
        message: 'Above 4096px, many layers can use several hundred MB of memory.',
        tone: 'warning',
        duration: 5200,
      })
    } else {
      pushToast({ title: 'New document ready', message: `${w} × ${h}`, tone: 'success' })
    }
  }

  const current = (preset) => preset.width === width && preset.height === height

  return (
    <Modal
      open={dialogs.newDoc}
      onClose={() => closeDialog('newDoc')}
      title="New document"
      description="Pick a preset or enter your own dimensions."
      icon="newFile"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => closeDialog('newDoc')}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={apply}>
            Create document
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Presets — the fast path for the common cases. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setWidth(preset.width)
                setHeight(preset.height)
              }}
              className={cn(
                'rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150',
                current(preset)
                  ? 'border-aurora-violet/60 bg-aurora-violet/15'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
              )}
            >
              <span className="block text-[12px] font-medium text-fg">{preset.label}</span>
              <span className="block font-mono text-[10.5px] text-fg-subtle tabular-nums">
                {preset.width} × {preset.height}
              </span>
            </button>
          ))}
        </div>

        {/* Custom fields */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              spellCheck="false"
              className="well h-9 rounded-[10px] px-2.5 text-[13px] text-fg outline-none focus:ring-1 focus:ring-aurora-cyan/50"
            />
          </label>

          <NumberField label="Width" value={width} onChange={setWidth} />
          <NumberField label="Height" value={height} onChange={setHeight} />
        </div>

        <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-fg-subtle">
          Dimensions are in pixels. Values are clamped between {MIN_DIM} and {MAX_DIM}px.
        </p>
      </div>
    </Modal>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="flex w-full flex-col gap-1.5 sm:w-32">
      <span className="text-[9.5px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        {label}
      </span>
      <input
        type="number"
        min={MIN_DIM}
        max={MAX_DIM}
        value={value}
        onChange={(event) => onChange(clampDim(Number(event.target.value)))}
        className="well h-9 rounded-[10px] px-2.5 font-mono text-[13px] text-fg tabular-nums outline-none focus:ring-1 focus:ring-aurora-cyan/50"
      />
    </label>
  )
}