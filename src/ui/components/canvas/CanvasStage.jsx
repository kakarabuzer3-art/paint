import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '../../../lib/cn.js'
import Icon from '../../icons/Icon.jsx'
import { EVENTS } from '../../../engine/core/constants.js'
import useFileDrop from '../../hooks/useFileDrop.js'
import { useUi } from '../../state/context.js'

const CURSOR_BY_TOOL = {
  brush: 'crosshair',
  pencil: 'crosshair',
  eraser: 'crosshair',
  fill: 'crosshair',
  eyedropper: 'crosshair',
  select: 'crosshair',
  lasso: 'crosshair',
  magicWand: 'crosshair',
  move: 'move',
  text: 'text',
  zoom: 'zoom-in',
  pan: 'grab',
}

/**
 * The document viewport: hosts the engine's three surfaces.
 *
 * Structure (bottom to top):
 *   • composite — flattened layer stack, document resolution
 *   • scratch   — in-flight previews (Phase 3+), document resolution
 *   [transformed wrapper: only these two, so they always stay aligned]
 *   • overlay   — cursor ring / marquee, viewport resolution, never exported
 *
 * The wrapper's `transform` is written **imperatively** from the engine's
 * viewport events rather than from React state. Zoom and pan therefore never
 * re-render the tree: panning a 4K document is one style write, not a render.
 */
export default function CanvasStage() {
  const { doc, zoom, engine, cursorRef, activeTool } = useUi()

  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const compositeRef = useRef(null)
  const scratchRef = useRef(null)
  const overlayRef = useRef(null)

  /* ------------------------------------------------ mount + size the engine */
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !engine) return undefined

    engine.attach({
      container,
      composite: compositeRef.current,
      scratch: scratchRef.current,
      overlay: overlayRef.current,
      cursorRef,
    })

    const syncSize = () => {
      const rect = container.getBoundingClientRect()
      engine.setContainerSize(rect.width, rect.height)
    }

    syncSize()
    const observer = new ResizeObserver(syncSize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      engine.detach()
    }
  }, [engine, cursorRef])

  /* ------------------------------------- viewport events → CSS transform */
  useEffect(() => {
    if (!engine) return undefined

    const apply = ({ zoom: scale, offsetX, offsetY }) => {
      const stage = stageRef.current
      if (!stage) return
      stage.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`
    }

    const off = engine.on(EVENTS.VIEWPORT, apply)
    // The engine already fitted during attach(), before this effect ran, so
    // apply the current state once to avoid a blank first frame.
    apply(engine.viewport.toState())

    return off
  }, [engine])

  /* ------------------------------------------- cursor follows the active tool */
  useEffect(() => {
    // Imperative, so a tool can override it mid-drag (grabbing, etc.) without
    // a re-render clobbering the change.
    engine?.setCursor(CURSOR_BY_TOOL[activeTool] ?? 'default')
  }, [engine, activeTool])

  // Window-level, so dropping anywhere in the app works — see useFileDrop.
  const { isDragging } = useFileDrop()

  return (
    <div
      ref={containerRef}
      id="canvas-stage"
      tabIndex={-1}
      // `contain` isolates layout and paint so zooming and panning the document
      // cannot invalidate anything outside the stage — the overlay, the HUD
      // chips and the rest of the shell all stay untouched.
      className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-panel)] [contain:layout_paint] focus:outline-none"
      role="application"
      aria-label={`Drawing canvas: ${doc.name}, ${doc.width} by ${doc.height} pixels`}
    >
      {/* Studio surround: a neutral dark well so the artwork reads brightest. */}
      <div className="absolute inset-0 bg-[radial-gradient(115%_100%_at_50%_0%,#15121f_0%,#0b0913_58%,#07060c_100%)]" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] [background-size:44px_44px]" />

      {/* The document. Sized in document pixels; only the wrapper transforms. */}
      <div
        ref={stageRef}
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{ width: doc.width, height: doc.height }}
      >
        <div
          className="pointer-events-none absolute inset-0 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.09)]"
          aria-hidden="true"
        />
        <canvas ref={compositeRef} className="absolute top-0 left-0" />
        <canvas ref={scratchRef} className="absolute top-0 left-0" />
      </div>

      {/* Screen-space overlay: fills the viewport, ignores the transform. */}
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <HudChip className="top-3 left-3">
        <Icon name="image" size={13} />
        <span className="max-w-[14ch] truncate font-medium text-fg-muted">{doc.name}</span>
        <span className="h-3 w-px bg-white/10" />
        <span className="font-mono tabular-nums">
          {doc.width} × {doc.height}
        </span>
      </HudChip>

      <HudChip className="right-3 bottom-3">
        <Icon name="zoom" size={13} />
        <span className="font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
      </HudChip>

      <HintChip>
        Wheel to zoom · Space or middle-drag to pan · B/P/E/G for brush, pencil, eraser, fill
      </HintChip>

      {/* Drop target. Rendered only while a file is over the window so it
          costs nothing during normal painting. */}
      {isDragging && (
        <div
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-aurora-violet/12 backdrop-blur-[3px]"
          aria-hidden="true"
        >
          <div className="glass-solid flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-aurora-cyan/60 px-8 py-6 text-center">
            <Icon name="image" size={26} className="text-aurora-cyan" />
            <p className="text-[13px] font-semibold text-fg">Drop to open</p>
            <p className="max-w-[24ch] text-[11px] text-fg-subtle">
              An image becomes your document. An <span className="font-mono">.aurora</span> file
              reopens the layered project.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function HudChip({ children, className }) {
  return (
    <div
      className={cn(
        'glass pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px]',
        className,
      )}
    >
      <span className="text-fg-subtle">{children}</span>
    </div>
  )
}

function HintChip({ children }) {
  return (
    <p className="glass pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1.5 text-[10.5px] text-fg-subtle">
      {children}
    </p>
  )
}