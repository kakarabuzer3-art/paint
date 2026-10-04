# Aurora Paint

A premium glassmorphism creative-studio app for drawing, built on the HTML5
Canvas API with **React + JSX** and **Tailwind CSS v4**. Original Aurora Glass
UI: translucent panels, soft aurora gradients, refined typography, and a canvas
that stays the visual centrepiece.

## Features

**16 tools** — Rect Select `V`, Lasso `L`, Magic Wand `W`, Move `M`, Transform `Y`,
Brush `B`, Pencil `P`, Eraser `E`, Paint Bucket `G`, Eyedropper `I`, Rectangle `R`,
Ellipse `O`, Line `N`, Text `T`, Zoom `Z`, Pan `H`.

- **Drawing** — a brush engine with cached tips keyed by colour, size and
  hardness, residual-based spacing so stroke density stays uniform at any
  frame rate, and exponential smoothing on the input path. Plus anti-aliased
  shapes, 15° line snapping (hold Shift), and a flood fill with tolerance.
- **Selection** — rectangular, freehand lasso and magic wand, all backed by a
  `Uint8Array` mask with live bounds. Cut, copy, paste-as-layer, invert and
  delete, every one undoable.
- **Layers** — per-layer `OffscreenCanvas`, opacity, all 16 Canvas 2D blend
  modes, reorder, duplicate, lock and hide. Composited only when something
  actually changes.
- **Text** — multi-line, live-tracking, fill or stroke, committed to the active
  layer as a single undoable step.
- **History** — bounded undo/redo with *two* limits: a step cap and a memory
  budget, because one full-canvas operation on a 4K layer is ~33 MB. The history
  panel can scrub to any point in the stack.
- **Files** — import PNG/JPEG/WebP as a layer or as a whole document; save and
  reopen layered work as `.aurora` projects (JSON plus lossless per-layer PNGs);
  export flattened PNG/JPEG/WebP at any scale, with transparency where the
  format supports it.
- **Productivity** — command palette (`Ctrl+K`) with fuzzy matching and learned
  recency, crash-recovery autosave to IndexedDB, recent colours, and a full
  keyboard-driven workflow.
- **Accessibility** — skip link, landmark roles, trapped focus in dialogs, live
  regions for tool changes and toasts, `prefers-reduced-motion`, and full
  `forced-colors` (High Contrast) support.

## Quick start

```bash
npm install       # 2 runtime deps: react, react-dom
npm run dev       # http://localhost:5173
npm test          # every suite below, in order
npm run check     # verify every relative import resolves
npm run pure      # colour maths, history stack, fuzzy matcher (no DOM)
npm run engine    # Viewport / dirty-rect / document-model unit assertions
npm run engine-dom# attach + compositing + pointer + wheel + file I/O (fake DOM)
npm run smoke     # render the whole tree on the server and assert landmarks
npm run build     # check + production build
```

The suite runs in about a second and needs no test framework: each script is a
plain ES module that throws on the first failed `assert`. That keeps the runtime
dependency count at two and means `node scripts/pure-smoke.mjs` is directly
debuggable from a terminal.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Research + architecture | done |
| 1 | React/Tailwind foundation + UI shell | done |
| 2 | Canvas engine (3 surfaces, viewport, pointer router) | done |
| 3 | Core drawing tools | done |
| 4 | Selection + transform + undo/redo | done |
| 5 | Layers + Text | done |
| 6 | Import/export + file features | done |
| 7 | Smart productivity features | done |
| 8 | Visual polish + performance + accessibility | done |
| 9 | Final testing + competition demo polish | done |

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
4. **The `LAYERS` event always carries `layerSnapshot()`** (an array). Never emit
   `document.toJSON()` on that channel: the panel calls `.find()` on it, so an
   object payload white-screens the app. Structure changes already publish
   through `DocumentModel.onStructureChange`.
5. **`src/engine/io/**` never touches the DOM at module scope.** Encoding and
   decoding call `document`/`URL` lazily inside functions, so the engine still
   imports cleanly in Node for the unit and SSR tests.

## Layout

```
src/
  lib/        pure helpers shared by UI and engine (cn, color)
  engine/          ← no React imports, ever
    core/      EditorController, Viewport, DocumentModel, Layer, RenderScheduler,
               EventBus, pixelCanvas, constants
    render/    Compositor, ScratchRenderer, OverlayRenderer, CanvasFactory,
               dirtyRect, floodFill, handles
    io/        codec (PNG/JPEG/WebP encode + decode), project (the `.aurora`
               save format: JSON + per-layer lossless PNG data URLs),
               autosave (IndexedDB crash-recovery snapshots)
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
    hooks/    fuzzy matcher, keyboard router, file drop, file picker
    components/
      common/     Button, IconButton, Tooltip, Slider, Modal, Toaster…
      layout/     AppShell, TopBar, LeftToolRail, OptionsBar, Inspector, StatusBar
      canvas/     CanvasStage (hosts the three surfaces)
      color/      ColorPicker + ColorPanel
      layers/     LayerPanel
      palette/    CommandPalette + command registry
      dialogs/    New document, shortcuts, colour, export, recovery
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

## Known limitations

Stated plainly, because a demo that oversells is worse than one that doesn't.

- **The canvas is not fully keyboard-operable.** Everything *around* it is: the
  skip link lands focus on it, it is announced with `role="application"` and a
  descriptive label, and every action is reachable from the command palette. But
  drawing a stroke still requires a pointer, and there is no synthesised
  alternative.
- **The React tree re-renders on every document change.** `useUi()` returns a
  single context object, so any state change re-renders all consumers. Painting
  itself is unaffected — pointer position never enters React state, and the
  compositor runs outside it entirely — but the chrome does re-render on each
  history tick. Splitting the context per slice would fix it at the cost of
  touching every component.
- **Recovery is one snapshot, not a version history.** Autosave keeps the latest
  `.aurora` payload in IndexedDB and offers it on the next launch. It does not
  keep the ten previous ones, so it protects against a crash, not against
  "I overwrote that five minutes ago".
- **Export flattens.** Layers, masks and blend modes are baked into a single
  raster; only `.aurora` preserves the layer stack.
- **Autosave is browser-local.** Clearing site data discards recovery, and it
  does not sync across devices.
