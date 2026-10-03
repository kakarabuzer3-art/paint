import Modal from '../common/Modal.jsx'
import Kbd from '../common/Kbd.jsx'
import { SHORTCUT_GROUPS } from '../../data/shortcuts.js'
import { useUi } from '../../state/context.js'

/**
 * Shortcut reference sheet.
 *
 * Pressing "?" reveals every live binding — the escape hatch for "recognition
 * over recall" users who would otherwise guess.
 */
export default function ShortcutsDialog() {
  const { dialogs, closeDialog } = useUi()

  return (
    <Modal
      open={dialogs.shortcuts}
      onClose={() => closeDialog('shortcuts')}
      title="Keyboard shortcuts"
      description="Every binding below is active right now."
      icon="keyboard"
      size="lg"
    >
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-aurora-cyan uppercase">
              {group.title}
            </h3>

            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li
                  key={`${group.title}-${item.label}`}
                  className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-1.5 last:border-b-0"
                >
                  <span className="text-[12px] text-fg-muted">{item.label}</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {item.keys.map((key, index) => (
                      <span key={key} className="inline-flex items-center gap-1">
                        {index > 0 && <span className="text-fg-subtle">+</span>}
                        <Kbd size="sm">{key}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}