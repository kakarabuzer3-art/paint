import { useEffect } from 'react'
import { TOOL_BY_SHORTCUT } from '../data/tools.js'
import { useUi } from '../state/context.js'

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable)

/**
 * Global keyboard router.
 *
 * Priority order matters:
 *   1. platform modifiers (⌘/Ctrl) — always available
 *   2. typing contexts — never hijacked, so renaming a layer or typing in a
 *      dialog keeps working
 *   3. bare single letters — only fire when focus is not on a control, so a
 *      focused button still receives Enter/Space/Tab normally
 *
 * Tab is only intercepted when focus is on <body>; stealing it globally would
 * break keyboard navigation, which is a WCAG failure.
 */
export default function useKeyboardShortcuts() {
  const ui = useUi()

  useEffect(() => {
    const handleKeyDown = (event) => {
      const typing = isTypingTarget(event.target)
      const mod = event.metaKey || event.ctrlKey
      const key = event.key

      /* --------------------------------------------------- platform chords */
      if (mod) {
        switch (key.toLowerCase()) {
          case 'k':
            event.preventDefault()
            ui.closeDialog('palette')
            if (!ui.dialogs.palette) ui.openDialog('palette')
            break

          case 'n':
            event.preventDefault()
            if (event.shiftKey) ui.addLayer()
            else ui.openDialog('newDoc')
            break

          case 'j':
            event.preventDefault()
            ui.duplicateLayer(ui.activeLayerId)
            break

          case '1':
            event.preventDefault()
            ui.zoomTo(1)
            break

          case '0':
            event.preventDefault()
            ui.fitToScreen()
            break

          case 'i':
            if (event.shiftKey) {
              event.preventDefault()
              ui.invertSelection()
            }
            break

          case 'c':
            event.preventDefault()
            ui.copy()
            break

          case 'x':
            event.preventDefault()
            ui.cut()
            break

          case 'v':
            event.preventDefault()
            ui.paste()
            break

          case 'a':
            event.preventDefault()
            ui.selectAll()
            break

          case 'p':
            if (event.shiftKey) {
              event.preventDefault()
              ui.togglePanel('inspector')
            }
            break

          case 's':
            event.preventDefault()
            ui.pushToast({
              title: 'Saving arrives in Phase 6',
              message: 'Autosave and export land with the file layer.',
              tone: 'info',
            })
            break

          case 'z':
            event.preventDefault()
            ui.undo()
            break

          case 'y':
            event.preventDefault()
            ui.redo()
            break

          default:
            break
        }
        return
      }

      if (event.altKey) return

      /* ------------------------------------------------- non-modifier keys */
      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault()
        ui.openDialog('shortcuts')
        return
      }

      if (key === 'Escape') {
        // Dialogs first; otherwise Escape clears the selection.
        if (ui.anyDialogOpen) ui.closeAllDialogs()
        else if (!ui.selection.isEmpty) ui.deselect()
        return
      }

      if (typing) return

      switch (key) {
        case 'Tab':
          // Only intercept when nothing focusable holds focus.
          if (document.activeElement === document.body) {
            event.preventDefault()
            ui.togglePanel('options')
          }
          break

        case '0':
          event.preventDefault()
          ui.fitToScreen()
          break

        case '+':
        case '=':
          event.preventDefault()
          ui.zoomIn()
          break

        case '-':
        case '_':
          event.preventDefault()
          ui.zoomOut()
          break

        case '[':
          event.preventDefault()
          ui.setOption('size', Math.max(1, ui.options.size - sizeStep(event.shiftKey)))
          break

        case ']':
          event.preventDefault()
          ui.setOption('size', Math.min(400, ui.options.size + sizeStep(event.shiftKey)))
          break

        case 'x':
          event.preventDefault()
          ui.swapColors()
          break

        case 'd':
          event.preventDefault()
          ui.resetColors()
          break

        case 'c':
          event.preventDefault()
          ui.openDialog('color')
          break

        case '\\':
          event.preventDefault()
          ui.togglePanel('rail')
          break

        case ' ':
          // Space = temporary pan: the active tool is restored on release, so
          // you can nudge the view without losing your brush.
          event.preventDefault()
          ui.engine?.tools.beginTemporary('pan')
          break

        case 'Delete':
        case 'Backspace':
          // Only ever deletes selected pixels — deleting a whole layer from a
          // stray keypress would be a nasty surprise.
          if (!ui.selection.isEmpty) {
            event.preventDefault()
            ui.deleteSelection()
          }
          break

        default: {
          const toolId = TOOL_BY_SHORTCUT[key.toLowerCase()]
          if (toolId) {
            event.preventDefault()
            ui.setTool(toolId)
          }
          break
        }
      }
    }

    const handleKeyUp = (event) => {
      if (event.key === ' ') ui.engine?.tools.endTemporaryIfPanning()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // A tab switch mid-hold must not leave the canvas stuck in pan mode.
    window.addEventListener('blur', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleKeyUp)
    }
  }, [ui])
}

/** Shift accelerates brush-size changes by 10px — the usual convention. */
const sizeStep = (big) => (big ? 10 : 1)