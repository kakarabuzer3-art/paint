import { useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import Button from '../common/Button.jsx'
import Segmented from '../common/Segmented.jsx'
import Slider from '../common/Slider.jsx'
import Toggle from '../common/Toggle.jsx'
import { DEFAULT_EXPORT_FORMAT, EXPORT_FORMATS, getFormat } from '../../../engine/io/codec.js'
import { useUi } from '../../state/context.js'

/**
 * Export dialog.
 *
 * Progressive disclosure: only the controls that matter for the chosen format
 * are shown. PNG hides the quality slider (lossless has no quality) and JPEG
 * hides transparency (it cannot store alpha) — offering a control that would
 * silently do nothing is worse than not offering it at all.
 */
export default function ExportDialog() {
  const { dialogs, closeDialog, doc, exportImageFile } = useUi()

  const [format, setFormat] = useState(DEFAULT_EXPORT_FORMAT)
  const [quality, setQuality] = useState(0.92)
  const [scale, setScale] = useState(1)
  const [transparent, setTransparent] = useState(false)
  const [busy, setBusy] = useState(false)

  const spec = getFormat(format)

  // Re-seed each time the dialog opens so it never shows a stale export.
  useEffect(() => {
    if (!dialogs.export) return
    setFormat(DEFAULT_EXPORT_FORMAT)
    setQuality(0.92)
    setScale(1)
    setTransparent(false)
    setBusy(false)
  }, [dialogs.export])

  // JPEG cannot represent transparency, so the choice is dropped rather than
  // silently ignored when the format changes.
  const effectiveTransparent = transparent && spec.supportsAlpha
  const outputWidth = Math.round(doc.width * scale)
  const outputHeight = Math.round(doc.height * scale)

  const run = async () => {
    setBusy(true)
    await exportImageFile({ format, quality, scale, transparent: effectiveTransparent })
    setBusy(false)
    closeDialog('export')
  }

  return (
    <Modal
      open={dialogs.export}
      onClose={() => closeDialog('export')}
      title="Export image"
      description="Saves the flattened artwork. Layers are not included."
      icon="download"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => closeDialog('export')}>
            Cancel
          </Button>
          <Button variant="primary" icon="download" disabled={busy} onClick={run}>
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Format"
          width="w-full"
          value={format}
          items={Object.values(EXPORT_FORMATS).map((entry) => ({
            value: entry.id,
            label: entry.label,
          }))}
          onChange={(value) => {
            setFormat(value)
            if (!getFormat(value).supportsAlpha) setTransparent(false)
          }}
        />

        {spec.supportsQuality && (
          <Slider
            label="Quality"
            value={Math.round(quality * 100)}
            min={40}
            max={100}
            unit="%"
            width="w-full"
            onChange={(value) => setQuality(value / 100)}
          />
        )}

        <Segmented
          label="Size"
          width="w-full"
          value={scale}
          items={[
            { value: 0.5, label: '0.5×' },
            { value: 1, label: '1×' },
            { value: 2, label: '2×' },
          ]}
          onChange={setScale}
        />

        {spec.supportsAlpha ? (
          <Toggle
            label="Transparent background"
            checked={effectiveTransparent}
            onChange={setTransparent}
            hint="Drops the paper colour so only your artwork remains."
          />
        ) : (
          <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-fg-subtle">
            JPEG has no transparency, so the paper colour is always kept.
          </p>
        )}

        {/* Live output size — the most useful thing to know before saving. */}
        <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-fg-subtle">
          Outputs <span className="font-mono text-fg-muted">{outputWidth} × {outputHeight}</span>
          {scale > 1 && <span> upscaled</span>} · {spec.label}
          {spec.supportsQuality && ` at ${Math.round(quality * 100)}% quality`}
        </p>
      </div>
    </Modal>
  )
}