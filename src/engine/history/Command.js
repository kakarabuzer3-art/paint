/**
 * Base class for undoable commands.
 *
 * Commands are the *only* way the document changes. Every mutation therefore
 * knows how to reverse itself, which is what makes undo/redo trustworthy —
 * there is no "guess what changed" path.
 *
 * Two rules keep memory bounded:
 *   - pixel changes store only the affected **band**, not a canvas snapshot
 *   - structural changes keep the lightweight `Layer` object, not its pixels
 *     (reinserting the same object restores the pixels for free)
 */
export default class Command {
  /** @param {{ label: string, kind?: string }} options */
  constructor({ label = 'Action', kind = 'action' } = {}) {
    this.label = label
    this.kind = kind
    this.timestamp = Date.now()
  }

  do() {}

  undo() {}

  /** Document region affected, so the caller can repaint only that band. */
  get rect() {
    return null
  }

  /** Approximate bytes retained, used by the history memory budget. */
  get memoryCost() {
    return 0
  }
}

/** Convenience factory for one-off commands expressed as closures. */
export function command({ label, kind = 'action', doAction, undoAction, rect = null }) {
  return {
    label,
    kind,
    timestamp: Date.now(),
    rect,
    memoryCost: 0,
    do: doAction,
    undo: undoAction,
  }
}