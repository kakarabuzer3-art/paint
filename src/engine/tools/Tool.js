/**
 * Base class for every tool.
 *
 * A tool is a tiny state machine driven by the PointerRouter. It receives
 * *normalised* events (document coordinates, pressure, modifiers, coalesced
 * samples) and talks back only through the engine context — never through the
 * DOM, never through React.
 *
 * Adding a tool = subclass + one registry entry. No engine or UI changes.
 */
export default class Tool {
  /** @type {string} stable id matching ui/data/tools.js */
  static id = 'tool'

  /** CSS cursor shown while this tool is active. */
  static cursor = 'default'

  constructor(context) {
    this.context = context
  }

  /** Pointer is in a tool-neutral area (e.g. outside the document). */
  onHover() {}

  onPointerDown() {}

  onPointerMove() {}

  onPointerUp() {}

  onPointerCancel() {}

  /** Called when the tool becomes active, or when a temporary override ends. */
  onActivate() {}

  onDeactivate() {}
}

/**
 * Placeholder for tools whose engine implementation lands in Phase 3+.
 *
 * It keeps the app fully usable in the meantime — the overlay still shows the
 * cursor preview — instead of silently swallowing pointer input.
 */
export class NullTool extends Tool {
  static id = 'null'
  static cursor = 'default'
}