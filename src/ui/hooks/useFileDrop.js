import { useEffect, useRef, useState } from 'react'
import { useUi } from '../state/context.js'

/** True when a drag actually carries files (rather than text or a dragged tab). */
function dragHasFiles(event) {
  const types = event.dataTransfer?.types
  return Boolean(types && Array.from(types).includes('Files'))
}

/**
 * Drag-and-drop file import.
 *
 * Listens on `window` rather than the canvas: the browser only fires
 * `dragenter`/`dragleave` on the element under the cursor, and the canvas
 * re-renders constantly, so element-level listeners are both fragile and
 * flicker-prone. A depth counter (rather than a boolean) is what keeps the
 * overlay steady while the pointer crosses child elements.
 *
 * `.aurora` files reopen the layered project; everything else opens as an
 * image document.
 *
 * @returns {{ isDragging: boolean, route: (file: File) => void }}
 */
export default function useFileDrop() {
  const { openFile } = useUi()
  const [isDragging, setDragging] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    const onDragEnter = (event) => {
      if (!dragHasFiles(event)) return
      // Without preventDefault the browser navigates to the dropped file,
      // which unloads the whole app and loses the session.
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    }

    const onDragOver = (event) => {
      if (!dragHasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const onDragLeave = (event) => {
      if (!dragHasFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }

    const onDrop = (event) => {
      if (!dragHasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      openFile(event.dataTransfer?.files?.[0])
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)

    // A drag released outside the window fires no `drop`, which would
    // otherwise strand the overlay on screen indefinitely.
    const onDragEnd = () => {
      depth.current = 0
      setDragging(false)
    }
    window.addEventListener('dragend', onDragEnd)
    window.addEventListener('blur', onDragEnd)

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('blur', onDragEnd)
    }
  }, [openFile])

  return { isDragging }
}