import Modal from '../common/Modal.jsx'
import ColorPanel from '../color/ColorPanel.jsx'
import { useUi } from '../../state/context.js'

/**
 * Floating colour dialog, opened from the fill/stroke chips in the options
 * bar. Reuses the exact same ColorPanel as the inspector so behaviour and
 * memory of recent colours stay identical wherever colour is edited.
 */
export default function ColorDialog() {
  const { dialogs, closeDialog } = useUi()

  return (
    <Modal
      open={dialogs.color}
      onClose={() => closeDialog('color')}
      title="Colour"
      description="Edit the fill and stroke colours."
      icon="palette"
      size="sm"
    >
      <ColorPanel allowSlotChange />
    </Modal>
  )
}