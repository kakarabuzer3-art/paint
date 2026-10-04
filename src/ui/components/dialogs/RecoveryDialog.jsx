import { useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import Button from '../common/Button.jsx'
import { describeAge, describeSnapshot } from '../../../engine/io/autosave.js'
import { useUi } from '../../state/context.js'

/**
 * Offers a snapshot left behind by a previous session.
 *
 * Deliberately *not* wired to `dialogs`: recovery is not something the user
 * opens, it is something the app interrupts with, and mixing the two would mean
 * a stray Escape silently destroyed unsaved work. Instead, closing the prompt
 * by any route — Escape, backdrop, the X — means "do not recover", the same as
 * the Discard button. Closing the prompt and keeping the work it holds are
 * contradictory, so they resolve to one outcome.
 *
 * The recovery path is the default and holds focus, since it is the outcome that
 * preserves work and the one a user who closed the tab by accident wants.
 */
export default function RecoveryDialog() {
  const { recovery, recoverSnapshot, startFresh } = useUi()
  const [busy, setBusy] = useState(false)

  const open = recovery.status === 'offered'

  // Keep the app responsive while a snapshot decodes; it is real work.
  const handleRecover = async () => {
    setBusy(true)
    await recoverSnapshot()
    setBusy(false)
  }

  useEffect(() => {
    if (!open) setBusy(false)
  }, [open])

  if (!open) return null

  const { savedAt, project } = recovery

  return (
    <Modal
      open={open}
      onClose={startFresh}
      title="Recover unsaved work?"
      description="The last session ended before this document was saved to a file."
      icon="clock"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={startFresh} disabled={busy}>
            Discard it
          </Button>
          <Button variant="primary" onClick={handleRecover} disabled={busy}>
            {busy ? 'Recovering…' : 'Recover my work'}
          </Button>
        </>
      }
    >
      <div className="rounded-[var(--radius-md)] border border-white/[0.09] bg-white/[0.03] px-4 py-3.5">
        <p className="text-[13px] font-medium text-fg">{project?.name ?? 'Untitled artwork'}</p>
        <p className="mt-1 text-[11.5px] text-fg-muted">
          {describeSnapshot(project)} · autosaved {describeAge(savedAt)}
        </p>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-fg-subtle">
        Recovering replaces the blank document on screen. You can still undo it afterwards, and
        nothing is written to disk until you save.
      </p>
    </Modal>
  )
}