# Aurora Paint

A premium glassmorphism creative-studio app for drawing, built on the HTML5
Canvas API with **React + JSX** and **Tailwind CSS v4**. Original Aurora Glass
UI: translucent panels, soft aurora gradients, refined typography, and a canvas
that stays the visual centrepiece.

## Quick start

```bash
npm install       # 2 runtime deps: react, react-dom
npm run dev       # http://localhost:5173
npm test          # import check + engine maths + engine integration + SSR render
npm run check     # verify every relative import resolves
npm run engine    # Viewport / dirty-rect / document-model unit assertions
npm run engine-dom# attach + compositing + pointer + wheel assertions (fake DOM)
npm run smoke     # render the whole tree on the server and assert landmarks
npm run build     # check + production build
```

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Research + architecture | done |
| 1 | React/Tailwind foundation + UI shell | done |
| 2 | Canvas engine (3 surfaces, viewport, pointer router) | done |
| 3 | Core drawing tools | done |
| 4 | Selection + transform + undo/redo | done |
| 5 | Layers + Text | pending |
| 6 | Import/export + file features | pending |
| 7 | Smart productivity features | pending |
| 8 | Visual polish + performance + accessibility | pending |
| 9 | Final testing + competition demo polish | pending |

## Architecture rules (do not break these)

1. **`src/engine/**` is pure JavaScript — no React imports.** Pixels and the
   document model live there; React owns interface state only (tool, options,
   colours, panels). A stroke must never trigger a React render — pointer
   position is shared through `cursorRef` and read by a rAF loop.
2. **Three DOM canvases, always** (composite / scratch / overlay), with each
   document layer held in its own `OffscreenCanvas`. Zoom and pan are CSS
   `transform`s on the wrapper, never canvas resizes.
3. **Relative imports only** (no alias). Depth is `../../../lib` from
   `src/ui/components/<area>/file.jsx` — run `npm run check` after adding files.

## Layout

```
src/
  lib/        pure helpers shared by UI and engine (cn, color)
  engine/          ← no React imports, ever
    core/      EditorController, Viewport, DocumentModel, Layer, RenderScheduler,
               EventBus, pixelCanvas, constants
    render/    Compositor, ScratchRenderer, OverlayRenderer, CanvasFactory,
               dirtyRect, floodFill, handles
    brush/     BrushEngine — cached brush tips + spacing/smoothing sampler
    history/   Command, HistoryStack, commands (pixel patches + structure)
    selection/ SelectionManager (Uint8Array mask + bounds), ops (extract/clear/stamp)
    tools/     Tool, ToolManager, StrokeTool (brush/pencil/eraser), FillTool,
               EyedropperTool, ShapeTool (+EllipseTool), LineTool, SelectTool,
               LassoTool, MagicWandTool, MoveTool, TransformTool, PanTool,
               ZoomTool, NullTool
    input/     PointerRouter, WheelRouter
  ui/
    state/    UiProvider + context (interface state only; engine is exposed, not copied)
    data/     tool registry, defaults, shortcuts  (single source of truth)
    hooks/    fuzzy matcher, keyboard router
    components/
      common/     Button, IconButton, Tooltip, Slider, Modal, Toaster…
      layout/     AppShell, TopBar, LeftToolRail, OptionsBar, Inspector, StatusBar
      canvas/     CanvasStage (hosts the three surfaces)
      color/      ColorPicker + ColorPanel
      layers/     LayerPanel
      palette/    CommandPalette + command registry
      dialogs/    New document, shortcuts, colour
scripts/      check-imports.mjs, engine-smoke.mjs, engine-dom-smoke.mjs, ssr-smoke.jsx
```

## How rendering works

```
document pixels        viewport pixels
┌────────────────┐    ┌──────────────────────┐
│ composite      │    │ overlay (cursor ring)│
│  = flattened   │    │  sized to viewport   │
│    layer stack │    │  DPR-scaled, crisp   │
├────────────────┤    └──────────────────────┘
│ scratch        │     both inside the transformed wrapper:
│  = in-flight   │     transform: translate(offset) scale(zoom)
│    previews    │     ← GPU, no re-rasterisation
└────────────────┘
```

- Zoom and pan are a **CSS transform on the wrapper**, never a canvas resize,
  so the backing stores stay at document resolution and panning is one style write.
- Layers live in their own `OffscreenCanvas`; the compositor blits the visible
  stack only when a layer commits, reorders, or history rewinds.
- Scratch is cleared per interaction frame and carries only live previews.
- One `requestAnimationFrame` loop coalesces every invalidation.

## Dependency budget

Runtime: `react`, `react-dom` — everything else (icons, colour maths, fuzzy
matching, IndexedDB access, dialogs) is hand-rolled on purpose. Adding a
dependency requires a genuine need that a few lines of code cannot cover.
