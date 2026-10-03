import { useCallback, useRef } from 'react'

/**
 * A hidden `<input type="file">` plus a function that opens it.
 *
 * Modelled as a hook rather than a ref hung off a button so that every surface
 * — top bar, command palette, keyboard shortcut — triggers the *same* input.
 * One file input in the app means one place to reason about `accept`, resets
 * and change events.
 *
 * @param {(file: File) => void} onFile called with the chosen file
 * @param {{ accept?: string, multiple?: boolean }} [options]
 * @returns {{ open: () => void, inputProps: object }} spread inputProps onto
 *   a real `<input type="file">` somewhere in the tree.
 */
export default function useFilePicker(onFile, { accept = 'image/*,.aurora', multiple = false } = {}) {
  const inputRef = useRef(null)

  const open = useCallback(() => inputRef.current?.click(), [])

  const inputProps = {
    ref: inputRef,
    type: 'file',
    accept,
    multiple,
    className: 'hidden',
    onChange: (event) => {
      const file = event.target.files?.[0]
      // Cleared *before* handing over: choosing the same file twice in a row
      // must still fire onChange, which it would not if the value persisted.
      event.target.value = ''
      if (file) onFile(file)
    },
  }

  return { open, inputProps }
}