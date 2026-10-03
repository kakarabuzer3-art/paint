import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UiContext } from './context.js'
import { createEditor } from '../../engine/core/EditorController.js'
import { EVENTS } from '../../engine/core/constants.js'
import { DEFAULT_TOOL, TOOLS } from '../data/tools.js'
import {
  DEFAULT_DOC,
  DEFAULT_OPTIONS,
  DEFAULT_PALETTE,
  SEED_RECENT,
} from '../data/defaults.js'

let toastSeq = 0
const MAX_RECENT_COLORS = 12

/** The engine lives outside React state — it owns the pixels. */
const createEngine = (doc) => createEditor({ width: doc.width, height: doc.height, name: doc.name })

/** Tools that paint, so the overlay can show a brush-sized cursor ring. */
const PAINT_TOOLS = new Set(['brush', 'pencil', 'eraser'])

/**
 * Holds every piece of *interface* state for the studio.
 *
 * Deliberately dependency-free: a reducer/state library would add bundle
 * weight for a state shape this small, and the engine (not React) owns the
 * expensive data.
 */
export default function UiProvider({ children }) {
  /* ---- tools ---- */
  const [activeTool, setActiveToolState] = useState(DEFAULT_TOOL)
  const [options, setOptionsState] = useState(DEFAULT_OPTIONS)

  /* ---- colour ---- */
  const [primary, setPrimaryState] = useState('#8b5cf6')
  const [secondary, setSecondaryState] = useState('#0c0a15')
  const [recentColors, setRecentColors] = useState(SEED_RECENT)

  /* ---- engine: one per provider, never inside React state ---- */
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = createEngine(DEFAULT_DOC)
  const engine = engineRef.current

  /* ---- document + view: display mirrors of the engine ---- */
  const [doc, setDocState] = useState(DEFAULT_DOC)
  const [view, setView] = useState(() => engine.viewport.toState())
  const { zoom, fitScale } = view

  /* ---- mirrors of engine history + selection ---- */
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
    entries: [],
  })
  const [selectionState, setSelectionState] = useState({ isEmpty: true, bounds: null, area: 0 })

  /* ---- layers: mirror of the engine stack (populated after attach) ---- */
  const [layers, setLayers] = useState([])
  const activeLayerId = layers.find((layer) => layer.isActive)?.id ?? null

  /* ---- shell chrome ---- */
  const [panels, setPanels] = useState({ rail: true, inspector: true, options: true })
  const [dialogs, setDialogs] = useState({
    palette: false,
    shortcuts: false,
    newDoc: false,
    color: false,
  })
  const [toasts, setToasts] = useState([])

  /**
   * Live pointer position, shared out-of-band via a ref so that pointer
   * movement never re-renders React. StatusBar subscribes with its own rAF
   * loop and writes straight to the DOM.
   */
  const cursorRef = useRef({ x: 0, y: 0, inside: false, pressure: 0 })

  const timersRef = useRef(new Set())
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  /* ------------------------------------------------------------------ tools */
  const setTool = useCallback(
    (id) => {
      if (!TOOLS[id]) return
      setActiveToolState(id)
      // The engine keeps its own active tool; unknown ids fall back to the
      // engine's NullTool until Phase 3 registers them.
      engine.tools.setActive(id)
    },
    [engine],
  )

  const setOption = useCallback((id, value) => {
    setOptionsState((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }))
  }, [])

  const resetOptions = useCallback(() => setOptionsState(DEFAULT_OPTIONS), [])

  /* ----------------------------------------------------------------- colour */
  const rememberColor = useCallback((hex) => {
    const value = String(hex).toLowerCase()
    setRecentColors((prev) => [value, ...prev.filter((c) => c !== value)].slice(0, MAX_RECENT_COLORS))
  }, [])

  const setPrimary = useCallback(
    (hex, { remember = true } = {}) => {
      setPrimaryState(hex)
      if (remember) rememberColor(hex)
    },
    [rememberColor],
  )

  const setSecondary = useCallback(
    (hex, { remember = false } = {}) => {
      setSecondaryState(hex)
      if (remember) rememberColor(hex)
    },
    [rememberColor],
  )

  const swapColors = useCallback(() => {
    // Both reads come from the current render closure — no side effects
    // inside an updater, so StrictMode double-invocation stays harmless.
    setPrimaryState(secondary)
    setSecondaryState(primary)
  }, [primary, secondary])

  const resetColors = useCallback(() => {
    setPrimaryState('#000000')
    setSecondaryState('#ffffff')
  }, [])

  const pushRecent = rememberColor
  const clearRecent = useCallback(() => setRecentColors([]), [])

  /* -------------------------------------------------------------------- view */
  // Zoom lives in the engine's viewport; the UI only mirrors it for readouts.
  const setZoom = useCallback((value) => engine.viewport.setScale(value), [engine])
  const zoomTo = setZoom
  const zoomIn = useCallback(() => engine.viewport.step(1), [engine])
  const zoomOut = useCallback(() => engine.viewport.step(-1), [engine])
  const fitToScreen = useCallback(() => engine.fitToScreen(), [engine])

  const setDoc = useCallback((patch) => engine.setDocument(patch), [engine])

  /* ------------------------------------------------------- engine ↔ UI sync */

  // Exactly one subscription per provider: engine events become React
  // mirrors. Components read `zoom`/`doc`; the engine stays the truth.
  useEffect(() => {
    const offViewport = engine.on(EVENTS.VIEWPORT, (state) => setView(state))
    const offDocument = engine.on(EVENTS.DOCUMENT, (json) =>
      setDocState({ name: json.name, width: json.width, height: json.height }),
    )
    const offHistory = engine.on(EVENTS.HISTORY, setHistoryState)
    const offSelection = engine.on(EVENTS.SELECTION, setSelectionState)
    const offLayers = engine.on(EVENTS.LAYERS, setLayers)

    // Seed the mirrors from the engine's current state (e.g. after StrictMode
    // remount) so the panel is never briefly wrong. Layers are engine-owned —
    // subscribing without this would leave the panel empty until the first edit.
    setHistoryState(engine.historySnapshot())
    setLayers(engine.layerSnapshot())

    return () => {
      offViewport()
      offDocument()
      offHistory()
      offSelection()
      offLayers()
    }
  }, [engine])

  // Tool-dependent engine settings are pushed *in* rather than mirrored out: a
// cursor ring or a zoom direction never justifies a React re-render.
  useEffect(() => {
    // Tools read options on every stroke; this stays a property read.
    engine.getOptions = () => options

    engine.cursorPreview = () => {
      const size = options.size ?? 0
      return {
        radius: size / 2,
        show: PAINT_TOOLS.has(activeTool) && size >= 2,
        crosshair: !PAINT_TOOLS.has(activeTool),
      }
    }
    engine.zoomDirection = options.zoomPreset ?? 'in'
    engine.invalidateOverlay()
  }, [engine, activeTool, options])

  /* ---------------------------------------------------------------- feedback */
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (toast) => {
      const id = ++toastSeq
      const entry = {
        id,
        tone: toast.tone ?? 'info',
        title: toast.title ?? '',
        message: toast.message ?? '',
      }
      // Cap the stack so notifications never crowd the canvas.
      setToasts((prev) => [...prev.slice(-3), entry])

      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        dismissToast(id)
      }, toast.duration ?? 3200)

      timersRef.current.add(timer)
      return id
    },
    [dismissToast],
  )

  // Colours and user-facing feedback, handed to the engine so it never has to
  // import UI state. Declared here because it depends on pushToast above.
  useEffect(() => {
    engine.getColors = () => ({ primary, secondary })
    engine.notice = (title, message) => pushToast({ title, message, tone: 'warning' })
    engine.onPickColor = (hex) => setPrimary(hex, { remember: true })
  }, [engine, primary, secondary, pushToast, setPrimary])

  /* --------------------------------------------------- selection + history */

  const undo = useCallback(() => {
    if (!engine.history.canUndo) {
      pushToast({ title: 'Nothing to undo', tone: 'info', duration: 1800 })
      return
    }
    engine.undo()
  }, [engine, pushToast])

  const redo = useCallback(() => {
    if (!engine.history.canRedo) {
      pushToast({ title: 'Nothing to redo', tone: 'info', duration: 1800 })
      return
    }
    engine.redo()
  }, [engine, pushToast])

  const jumpHistory = useCallback((index) => engine.jumpHistory(index), [engine])

  const copy = useCallback(() => engine.copySelection({ cut: false }), [engine])
  const cut = useCallback(() => engine.copySelection({ cut: true }), [engine])
  const paste = useCallback(() => engine.pasteClipboard({ asNewLayer: true }), [engine])
  const deleteSelection = useCallback(() => engine.deleteSelection(), [engine])
  const selectAll = useCallback(() => engine.selectAll(), [engine])
  const deselect = useCallback(() => engine.deselect(), [engine])
  const invertSelection = useCallback(() => engine.invertSelection(), [engine])

  /* ------------------------------------------------------------------ layers */
  /* Layer mutations go through the engine's command API, so every one of
     them is undoable and the panel can never drift from the document. */
  const selectLayer = useCallback(
    (id) => {
      engine.document.selectLayer(id)
    },
    [engine],
  )

  const toggleLayerVisibility = useCallback(
    (id) => {
      const layer = engine.document.getLayer(id)
      if (layer) engine.setLayerPropsCommand(id, { visible: !layer.visible }, 'Toggle layer visibility')
    },
    [engine],
  )

  const toggleLayerLock = useCallback(
    (id) => {
      const layer = engine.document.getLayer(id)
      if (layer) engine.setLayerPropsCommand(id, { locked: !layer.locked }, 'Lock layer')
    },
    [engine],
  )

  const setLayerOpacity = useCallback(
    (id, value) => {
      engine.setLayerPropsCommand(id, { opacity: value }, 'Layer opacity')
    },
    [engine],
  )

  const setLayerBlend = useCallback(
    (id, value) => {
      engine.setLayerPropsCommand(id, { blendMode: value }, 'Layer blend mode')
    },
    [engine],
  )

  const renameLayer = useCallback(
    (id, name) => {
      engine.setLayerPropsCommand(id, { name }, 'Rename layer')
    },
    [engine],
  )

  const addLayer = useCallback(() => {
    const layer = engine.addLayerCommand({}, 'Add layer')
    pushToast({ title: 'Layer added', tone: 'success' })
    return layer
  }, [engine, pushToast])

  const duplicateLayer = useCallback(
    (id) => {
      const layer = id ? engine.duplicateLayerCommand(id) : null
      if (layer) pushToast({ title: 'Layer duplicated', tone: 'success' })
    },
    [engine, pushToast],
  )

  const deleteLayer = useCallback(
    (id) => {
      const removed = id ? engine.deleteLayerCommand(id) : false
      if (removed) pushToast({ title: 'Layer deleted', tone: 'info' })
      else pushToast({ title: 'Cannot delete', message: 'A document needs at least one layer.', tone: 'warning' })
    },
    [engine, pushToast],
  )

  const moveLayer = useCallback(
    (id, direction) => {
      engine.moveLayerCommand(id, direction)
    },
    [engine],
  )

  /* ------------------------------------------------------------------ chrome */
  const togglePanel = useCallback((name) => {
    setPanels((prev) => ({ ...prev, [name]: !prev[name] }))
  }, [])

  const openDialog = useCallback((name) => {
    setDialogs((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
  }, [])

  const closeDialog = useCallback((name) => {
    setDialogs((prev) => (prev[name] ? { ...prev, [name]: false } : prev))
  }, [])

  const closeAllDialogs = useCallback(() => {
    setDialogs((prev) =>
      prev.palette || prev.shortcuts || prev.newDoc || prev.color
        ? { palette: false, shortcuts: false, newDoc: false, color: false }
        : prev,
    )
  }, [])

  const anyDialogOpen = useMemo(() => Object.values(dialogs).some(Boolean), [dialogs])

  const value = useMemo(
    () => ({
      /* tools */
      activeTool,
      setTool,
      options,
      setOption,
      resetOptions,
      /* colour */
      primary,
      secondary,
      setPrimary,
      setSecondary,
      swapColors,
      resetColors,
      recentColors,
      pushRecent,
      clearRecent,
      palette: DEFAULT_PALETTE,
      /* engine: pixels live here, never in React state */
      engine,
      /* document + view */
      doc,
      setDoc,
      zoom,
      setZoom,
      zoomIn,
      zoomOut,
      zoomTo,
      fitScale,
      fitToScreen,
      /* layers */
      layers,
      activeLayerId,
      selectLayer,
      toggleLayerVisibility,
      toggleLayerLock,
      setLayerOpacity,
      setLayerBlend,
      addLayer,
      duplicateLayer,
      deleteLayer,
      renameLayer,
      moveLayer,
      /* chrome */
      panels,
      togglePanel,
      dialogs,
      openDialog,
      closeDialog,
      closeAllDialogs,
      anyDialogOpen,
      /* feedback */
      toasts,
      pushToast,
      dismissToast,
      /* out-of-band */
      cursorRef,
      /* selection + history (mirrors of engine state) */
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      historyEntries: historyState.entries,
      undo,
      redo,
      jumpHistory,
      copy,
      cut,
      paste,
      deleteSelection,
      selectAll,
      deselect,
      invertSelection,
      selection: selectionState,
    }),
    [
      activeTool, setTool, options, setOption, resetOptions,
      primary, secondary, setPrimary, setSecondary, swapColors, resetColors,
      recentColors, pushRecent, clearRecent,
      doc, engine, setDoc, zoom, setZoom, zoomIn, zoomOut, zoomTo, fitScale, fitToScreen,
      layers, activeLayerId, selectLayer, toggleLayerVisibility, toggleLayerLock,
      setLayerOpacity, setLayerBlend, addLayer, duplicateLayer, deleteLayer, renameLayer, moveLayer,
      panels, togglePanel, dialogs, openDialog, closeDialog, closeAllDialogs, anyDialogOpen,
      toasts, pushToast, dismissToast,
      historyState, selectionState, undo, redo, jumpHistory,
      copy, cut, paste, deleteSelection, selectAll, deselect, invertSelection,
    ],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}