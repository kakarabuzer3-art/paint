import Tool, { NullTool } from './Tool.js'

/**
 * Owns the active tool and its lifecycle.
 *
 * Two distinct concerns, deliberately kept here:
 *   - `setActive` follows the UI's tool selection (a click, a shortcut, the
 *     command palette) and is ignored while a temporary override is held.
 *   - `beginTemporary`/`endTemporary` implement Space-drag and middle-button
 *     pan without disturbing the user's chosen tool — you press Space, pan,
 *     release, and your brush is still the brush.
 *
 * Phase 3 registers the drawing tools into the same table.
 */
export default class ToolManager {
  constructor(context) {
    this.context = context

    /** @type {Map<string, Tool>} */
    this.tools = new Map()

    // Only the fallback lives here; the real tool table is registered by the
    // EditorController, so there is exactly one list of tools in the codebase.
    this.tools.set(NullTool.id, new NullTool(context))

    this.activeId = 'null'
    this.temporaryId = null
  }

  get effectiveId() {
    return this.temporaryId ?? this.activeId
  }

  get current() {
    return this.tools.get(this.effectiveId) ?? this.tools.get('null')
  }

  get isTemporary() {
    return this.temporaryId !== null
  }

  has(id) {
    return this.tools.has(id)
  }

  register(toolClass) {
    this.tools.set(toolClass.id, new toolClass(this.context))
    return this
  }

  setActive(id) {
    if (this.isTemporary || this.activeId === id) return
    if (!this.tools.has(id)) return

    this.tools.get(this.activeId)?.onDeactivate()
    this.activeId = id
    this.tools.get(id)?.onActivate()

    this.context.setCursor(this.tools.get(id).constructor.cursor)
    this.context.onToolChange?.(id)
  }

  /** Space-drag / middle-button pan: active without changing the tool. */
  beginTemporary(id) {
    if (!this.tools.has(id) || this.temporaryId === id) return

    this.tools.get(this.effectiveId)?.onDeactivate()
    this.temporaryId = id
    this.tools.get(id)?.onActivate()

    this.context.setCursor(this.tools.get(id).constructor.cursor)
    this.context.onToolChange?.(this.activeId)
  }

  /** Space-hold / middle-button pan ends on pointer release. */
  endTemporaryIfPanning() {
    if (this.temporaryId === 'pan') this.endTemporary()
  }

  endTemporary() {
    if (!this.temporaryId) return

    this.tools.get(this.temporaryId)?.onDeactivate()
    this.temporaryId = null

    const tool = this.tools.get(this.activeId)
    tool?.onActivate()
    this.context.setCursor(tool?.constructor.cursor ?? 'default')
    this.context.onToolChange?.(this.activeId)
  }
}