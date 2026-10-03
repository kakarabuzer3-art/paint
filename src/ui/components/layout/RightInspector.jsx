import Icon from '../../icons/Icon.jsx'
import IconButton from '../common/IconButton.jsx'
import PanelSection from './PanelSection.jsx'
import ColorPanel from '../color/ColorPanel.jsx'
import LayerPanel from '../layers/LayerPanel.jsx'
import HistoryPanel from '../history/HistoryPanel.jsx'
import { useUi } from '../../state/context.js'

/**
 * Right inspector.
 *
 * Sections are collapsible and ordered by how often they are used while
 * painting: colour, then layers, then history.
 */
export default function RightInspector() {
  const { panels, openDialog } = useUi()

  if (!panels.inspector) return null

  return (
    <aside
      aria-label="Inspector"
      className="glass-2 glass-specular scroll-slim flex w-[266px] shrink-0 flex-col overflow-y-auto rounded-[var(--radius-panel)]"
    >
      <PanelSection
        title="Colour"
        icon="palette"
        actions={
          <IconButton
            icon="expand"
            label="Open the colour dialog"
            size="xs"
            onClick={() => openDialog('color')}
          />
        }
      >
        <ColorPanel />
      </PanelSection>

      <PanelSection title="Layers" icon="layers">
        <LayerPanel />
      </PanelSection>

      <PanelSection title="History" icon="clock">
        <HistoryPanel />
      </PanelSection>
    </aside>
  )
}