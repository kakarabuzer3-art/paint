/**
 * Bounded undo/redo stack.
 *
 * Two independent limits, because either alone is insufficient:
 *   - `limit` — number of steps (a user expects ~50, not 500, of "undo")
 *   - `memoryBudget` — bytes of retained pixel data, because a single
 *     full-canvas operation on a 4K layer is ~33MB
 *
 * The oldest command is evicted when either limit is exceeded.
 */
export default class HistoryStack {
  constructor({ limit = 60, memoryBudget = 256 * 1024 * 1024 } = {}) {
    this.limit = limit
    this.memoryBudget = memoryBudget

    /** @type {Array} oldest → newest */
    this.past = []
    /** @type {Array} most recently undone */
    this.future = []

    /** @type {null | ((command: ?object) => void)} set by EditorController */
    this.onChange = null
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }

  get memoryUsed() {
    return this.past.reduce((total, entry) => total + (entry.memoryCost ?? 0), 0)
  }

  /** Labels for the history panel, oldest first. */
  entries() {
    return this.past.map((entry, index) => ({
      index,
      label: entry.label,
      kind: entry.kind,
      timestamp: entry.timestamp,
    }))
  }

  push(command) {
    this.past.push(command)
    // A new action invalidates the redo branch — standard editor behaviour.
    this.future.length = 0
    this.#enforce()
    this.#changed(command)
    return command
  }

  undo() {
    const command = this.past.pop()
    if (!command) return null

    command.undo()
    this.future.push(command)
    this.#changed(command)
    return command
  }

  redo() {
    const command = this.future.pop()
    if (!command) return null

    command.do()
    this.past.push(command)
    this.#changed(command)
    return command
  }

  /** Scrub to a state where exactly `index` commands are applied. */
  jumpTo(index) {
    const target = Math.max(0, Math.min(index, this.past.length + this.future.length))

    while (this.past.length > target) this.undo()
    while (this.past.length < target) this.redo()
  }

  clear() {
    this.past.length = 0
    this.future.length = 0
    this.#changed(null)
  }

  #enforce() {
    while (this.past.length > this.limit || this.memoryUsed > this.memoryBudget) {
      this.past.shift()
    }
  }

  #changed(command) {
    this.onChange?.(command)
  }
}