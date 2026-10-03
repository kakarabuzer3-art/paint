import AuroraBackground from './ui/theme/AuroraBackground.jsx'
import UiProvider from './ui/state/UiProvider.jsx'
import AppShell from './ui/components/layout/AppShell.jsx'
import CommandPalette from './ui/components/palette/CommandPalette.jsx'
import Toaster from './ui/components/common/Toaster.jsx'
import ShortcutsDialog from './ui/components/dialogs/ShortcutsDialog.jsx'
import NewDocumentDialog from './ui/components/dialogs/NewDocumentDialog.jsx'
import ColorDialog from './ui/components/dialogs/ColorDialog.jsx'
import ExportDialog from './ui/components/dialogs/ExportDialog.jsx'
import useKeyboardShortcuts from './ui/hooks/useKeyboardShortcuts.js'

/**
 * Everything that must sit *inside* UiProvider.
 *
 * Keeping this separate from <App> means hooks like useUi() and
 * useKeyboardShortcuts() cannot accidentally run above the provider.
 */
function Studio() {
  useKeyboardShortcuts()

  return (
    <>
      <AppShell />
      {/* Overlays are siblings of the shell, never children — so the shell
          re-rendering never unmounts the palette or dialogs. */}
      <CommandPalette />
      <ShortcutsDialog />
      <NewDocumentDialog />
      <ColorDialog />
      <ExportDialog />
      <Toaster />
    </>
  )
}

export default function App() {
  return (
    <UiProvider>
      <AuroraBackground />
      <Studio />
    </UiProvider>
  )
}