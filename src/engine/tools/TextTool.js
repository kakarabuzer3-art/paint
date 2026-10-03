import Tool from './Tool.js'

const FONT_STACKS = {
  sans: '"Segoe UI", system-ui, -apple-system, sans-serif',
  display: '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  mono: '"Cascadia Mono", "SF Mono", Menlo, Consolas, monospace',
  serif: 'Georgia, "Times New Roman", serif',
}

/** Draw multi-line text with the configured leading and colour. */
function drawText(ctx, text, x, y, options, color) {
  const size = options.fontSize
  const leading = (size * (options.lineHeight ?? 120)) / 100
  const lines = text.split('\n')

  ctx.save()
  ctx.font = `${size}px ${FONT_STACKS[options.fontFamily] ?? FONT_STACKS.sans}`
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + size + index * leading)
  })

  ctx.restore()

  const width = Math.max(
    1,
    ...lines.map((line) => ctx.measureText(line).width + (options.letterSpacing ?? 0) * line.length),
  )

  return { x, y, width: Math.ceil(width), height: Math.ceil(size + (lines.length - 1) * leading) }
}

/**
 * Text tool.
 *
 * Editing uses a real `<textarea>` floating in screen space, styled to match
 * the canvas text: browsers already solve caret, IME, selection, undo and
 * mobile keyboards for free. Typing previews onto the scratch surface;
 * committing rasterises onto the layer through the history stack.
 *
 * This is the one place a tool touches the DOM — deliberately self-contained
 * rather than pushing a text-editor state machine through React on every
 * keystroke.
 */
export default class TextTool extends Tool {
  static id = 'text'
  static cursor = 'text'
  static label = 'Text'
  static optionDefaults = {
    fontSize: 72,
    lineHeight: 120,
    letterSpacing: 0,
    fontFamily: 'sans',
  }

  #editor = null

  onActivate() {
    this.#commit()
  }

  onPointerDown(event) {
    // Clicking anywhere while editing commits the current text.
    if (this.#editor) {
      this.#commit()
      return
    }

    const layer = this.context.document.paintableLayer()
    if (!layer) {
      this.context.notice?.('Nothing to write on', 'Add an unlocked, visible layer first.')
      return
    }

    this.#open(event, layer)
  }

  #open(event, layer) {
    const options = { ...TextTool.optionDefaults, ...this.context.getOptions() }
    const viewport = this.context.viewport
    const screen = viewport.docToScreen(event.docX, event.docY)
    const scale = viewport.scale

    const input = document.createElement('textarea')
    input.value = ''
    input.spellcheck = false
    input.setAttribute('aria-label', 'Type text to place on the canvas')

    Object.assign(input.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      zIndex: '200',
      minWidth: '140px',
      padding: '4px 8px',
      borderRadius: '8px',
      border: '1px solid rgb(255 255 255 / 0.25)',
      background: 'rgb(12 10 21 / 0.9)',
      color: this.context.getColors().primary,
      font: `${options.fontSize * scale}px ${FONT_STACKS[options.fontFamily] ?? FONT_STACKS.sans}`,
      lineHeight: String((options.lineHeight ?? 120) / 100),
      outline: 'none',
      resize: 'both',
      colorScheme: 'dark',
    })

    document.body.appendChild(input)
    input.focus()

    this.#editor = {
      input,
      layer,
      origin: { x: event.docX, y: event.docY },
      options,
      color: this.context.getColors().primary,
      patch: this.context.beginRegionPatch(layer),
    }

    input.addEventListener('input', () => this.#preview())
    input.addEventListener('blur', () => this.#commit())
    input.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key !== 'Escape') return
      keyEvent.preventDefault()
      this.#commit()
    })
  }

  /** Live preview on the scratch surface, cleared at the next pointer frame. */
  #preview() {
    const state = this.#editor
    const scratch = this.context.scratch
    if (!state || !scratch) return

    const text = state.input.value
    if (!text) {
      this.context.requestScratch(null)
      return
    }

    const band = scratch.paint((ctx) =>
      drawText(ctx, text, state.origin.x, state.origin.y, state.options, state.color),
    )

    this.context.requestScratch(band)
  }

  #commit() {
    const state = this.#editor
    if (!state) return
    this.#editor = null

    state.input.remove()

    const text = state.input.value.replace(/\s+$/, '')
    if (!text) {
      this.context.abandonRegionPatch(state.patch, null)
      this.context.requestScratch(null)
      return
    }

    const bounds = drawText(
      state.layer.context,
      text,
      state.origin.x,
      state.origin.y,
      state.options,
      state.color,
    )

    this.context.commitRegionPatch(state.patch, bounds, 'Text')
    this.context.requestScratch(null)
  }
}