import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UiContext } from './context.js'
import { createEditor } from '../../engine/core/EditorController.js'
import { EVENTS } from '../../engine/core/constants.js'
import { DEFAULT_TOOL, TOOLS } from '../data/tools.js'
import useFilePicker from '../hooks/useFilePicker.js'
import {
  downloadBlob,
  exportFilename,
  isImportableFile,
  readFileAsText,
  sanitizeFilename,
} from '../../engine/io/codec.js'
import { PROJECT_EXTENSION } from '../../engine/io/project.js'
import {
  clearSnapshot,
  isAutosaveSupported,
  loadSnapshot,
  saveSnapshot,
} from '../../engine/io/autosave.js'
import {
  DEFAULT_DOC,
  DEFAULT_OPTIONS,
  DEFAULT_PALETTE,
  SEED_RECENT,
} from '../data/defaults.js'

let toastSeq = 0
const MAX_RECENT_COLORS = 12

/**
 * How long the document must sit still before a recovery snapshot is written.
 *
 * Long enough that a burst of strokes collapses into a single serialisation,
 * short enough that closing the tab a moment after drawing is usually safe.
 */
const AUTOSAVE_DEBOUNCE_MS = 2000

/**
 * How many recently used commands the palette remembers.
 *
 * Six is roughly one screenful of results: enough to build a muscle memory
 * shortcut, few enough that the list still changes as the session progresses.
 */
const MAX_RECENT_COMMANDS = 6
const RECENT_COMMANDS_KEY = 'aurora.recentCommands'

/** Simple/Advanced preference. Anything other than '0' means simple. */
const SIMPLE_MODE_KEY = 'aurora.simpleMode'

function readSimpleMode() {
  try {
    if (typeof localStorage === 'undefined') return true
    // Absent key = a first visit, which gets Simple.
    return localStorage.getItem(SIMPLE_MODE_KEY) !== '0'
  } catch {
    return true
  }
}

/**
 * Command recency survives a reload.
 *
 * Recency that resets every refresh is nearly useless — the whole point is to
 * promote what *this* user reaches for, and that preference is stable over
 * weeks. localStorage is right here (a handful of short ids, well under the
 * quota) unlike the document snapshots, which go to IndexedDB.
 *
 * Reads are defensive: storage can throw in a hardened profile, and a missing
 * recency list is never worth breaking the palette over.
 */
function readRecentCommands() {
  try {
    if (typeof localStorage === 'undefined') return []
    const parsed = JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id) => typeof id === 'string').slice(0, MAX_RECENT_COMMANDS)
  } catch {
    return []
  }
}

/** The engine lives outside React state — it owns the pixels. */
const createEngine = (doc) => createEditor({ width: doc.width, height: doc.height, name: doc.name })

/** Tools that paint, so the overlay can show a brush-sized cursor ring. */
const PAINT_TOOLS = new Set(['brush', 'pencil', 'eraser'])

/**
 * Route a dropped or picked file to the right operation.
 *
 * `.aurora` files reopen the layered document; everything else is an image.
 * Drag-and-drop and the Open dialog must agree, so the decision lives here
 * rather than being re-implemented at each call site.
 */
export function isProjectFile(file) {
  return Boolean(file) && /\.aurora$/i.test(file.name ?? '')
}

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
    export: false,
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

  /**
   * Apply a whole material bundle in one update.
   *
   * Merged rather than replacing, because a material only names the options it
   * cares about — applying "Charcoal" must not silently reset the blend mode or
   * anything else the user set up. One setState call also means the options bar
   * never renders a half-applied material.
   */
  const setOptions = useCallback((patch) => {
    setOptionsState((prev) => ({ ...prev, ...patch }))
  }, [])

  /**
   * Simple mode: show only the controls that change what a mark looks like.
   *
   * Defaults to *on*. That default is the whole decision — a first-time visitor
   * who lands on eight sliders has no way to know which three matter, and the
   * usual response to an unclear interface is to leave. Someone who wants the
   * rest can switch to Advanced once and never look back, which costs them one
   * click; starting them in Advanced costs every first session its attention.
   *
   * Persisted because it is a preference about the person, not the document, and
   * a mode that resets on every reload would be re-argued every reload.
   */
  const [simpleMode, setSimpleModeState] = useState(readSimpleMode)

  const setSimpleMode = useCallback((value) => {
    setSimpleModeState(value)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SIMPLE_MODE_KEY, value ? '1' : '0')
      }
    } catch {
      // Persistence is a nicety; failing to store it must not break the toggle.
    }
  }, [])

  const toggleSimpleMode = useCallback(() => setSimpleMode(!simpleMode), [setSimpleMode, simpleMode])

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

  /* ------------------------------------------------- command recency (Phase 7) */

  const [recentCommands, setRecentCommands] = useState(readRecentCommands)

  /**
   * Record that a command was run, most recent first.
   *
   * Called from the palette only. Running the same command twice does not
   * promote it twice — repeating an action is not a stronger signal of
   * preference than reaching for it once.
   */
  const noteCommand = useCallback((id) => {
    if (!id) return
    setRecentCommands((prev) => {
      const next = [id, ...prev.filter((entry) => entry !== id)].slice(0, MAX_RECENT_COMMANDS)
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next))
        }
      } catch {
        // A quota or privacy failure only costs us persistence next reload.
      }
      return next
    })
  }, [])

  const clearRecentCommands = useCallback(() => {
    setRecentCommands([])
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(RECENT_COMMANDS_KEY)
    } catch {
      // See noteCommand.
    }
  }, [])

  /* -------------------------------------------------------------------- view */
  // Zoom lives in the engine's viewport; the UI only mirrors it for readouts.
  const setZoom = useCallback((value) => engine.viewport.setScale(value), [engine])
  const zoomTo = setZoom
  const zoomIn = useCallback(() => engine.viewport.step(1), [engine])
  const zoomOut = useCallback(() => engine.viewport.step(-1), [engine])
  const fitToScreen = useCallback(() => engine.fitToScreen(), [engine])

  /** Replacing the document invalidates any clipboard payload it held. */
  const setDoc = useCallback(
    (patch) => {
      setHasClipboard(false)
      return engine.setDocument(patch)
    },
    [engine],
  )

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

  const paste = useCallback(() => engine.pasteClipboard({ asNewLayer: true }), [engine])
  const deleteSelection = useCallback(() => engine.deleteSelection(), [engine])
  const selectAll = useCallback(() => engine.selectAll(), [engine])

  /**
   * Whether the engine holds anything to paste.
   *
   * The engine's clipboard is a plain field with no change event, so this is
   * tracked here as a mirror — the palette needs it to decide whether "Paste"
   * is a real option or a dead key. Set on copy/cut, cleared when the document
   * is replaced, since the pixels that clipboard refers to no longer exist.
   */
  const [hasClipboard, setHasClipboard] = useState(false)

  const copyToClipboard = useCallback(() => {
    const ok = engine.copySelection({ cut: false })
    if (ok) setHasClipboard(true)
    return ok
  }, [engine])

  const cutToClipboard = useCallback(() => {
    const ok = engine.copySelection({ cut: true })
    if (ok) setHasClipboard(true)
    return ok
  }, [engine])
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

  /* ----------------------------------------------------------------- files */

  /* ---- file operations live here: they need the engine, a toast, and to know
         whether the change is worth a "you will lose work" warning. ---- */

  const [isDirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  /**
   * The history length at the moment of the last save.
   *
   * Comparing against a stored save point rather than latching `true` on the
   * first edit is what makes undo behave correctly: paint three strokes, save,
   * then undo twice lands back on the saved point, and the document is *not*
   * dirty. A latched boolean would still claim unsaved changes for a document
   * identical to the one on disk.
   */
  const savedLengthRef = useRef(0)
  const entryCount = historyState.entries.length

  /**
   * Recovery is best-effort and invisible until it is needed.
   *
   * `status` is what the status bar reads: 'idle' while there is nothing to say,
   * 'saving' during the debounce, 'saved' once a snapshot is on disk, and
   * 'unavailable' if storage refused. Declared here because `markSaved` resets
   * it, and hooks cannot be reordered to fix a reference that runs earlier.
   */
  const [recovery, setRecovery] = useState({ status: 'idle', savedAt: null })
  const autosaveRef = useRef(0)

  useEffect(() => {
    setDirty(entryCount !== savedLengthRef.current)
  }, [entryCount])

  /** Mark the current document as saved and drop its recovery snapshot. */
  const markSaved = useCallback(() => {
    savedLengthRef.current = historyState.entries.length
    setDirty(false)
    setLastSavedAt(Date.now())
    // Cancel any in-flight autosave: letting it land would re-create the very
    // snapshot we are about to delete, and the next launch would then offer to
    // "recover" a document the user has already saved.
    window.clearTimeout(autosaveRef.current)
    setRecovery({ status: 'idle', savedAt: null })
    void clearSnapshot()
  }, [historyState.entries.length])

  /* ------------------------------------------------------- autosave/recovery */

  // Look for a snapshot left behind by a previous session. Runs once on mount;
  // the document is blank at that point, so there is nothing to lose by
  // checking.
  useEffect(() => {
    let cancelled = false
    loadSnapshot().then((record) => {
      if (!cancelled && record) {
        setRecovery({
          status: 'offered',
          savedAt: record.savedAt,
          project: record.project,
        })
      }
    })
    return () => { cancelled = true }
  }, [])

  /**
   * Debounced snapshot writer.
   *
   * Waiting for an idle gap matters more than it looks: serialising a layered
   * document to base64 is real work, and doing it per stroke would drop frames
   * while the user is actively painting. Two seconds of quiet is long enough to
   * never notice, short enough to survive an accidental tab close.
   */
  const writeSnapshot = useCallback(() => {
    if (!isDirty || !isAutosaveSupported()) return
    setRecovery((prev) => (prev.status === 'saving' ? prev : { ...prev, status: 'saving' }))
    window.clearTimeout(autosaveRef.current)
    autosaveRef.current = window.setTimeout(async () => {
      const savedAt = await saveSnapshot(engine.snapshotProject())
      setRecovery(
        savedAt
          ? { status: 'saved', savedAt }
          : // Storage refused. Say so rather than pretending recovery is armed.
            { status: 'unavailable', savedAt: null },
      )
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [engine, isDirty])

  // Re-arm the timer whenever the document moves away from the save point.
  useEffect(() => {
    if (isDirty) writeSnapshot()
  }, [isDirty, entryCount, writeSnapshot])

  // Clear the timer on unmount so a pending write cannot fire into a dead tree.
  useEffect(() => () => window.clearTimeout(autosaveRef.current), [])

  /**
   * Run a file operation, turning any thrown Error into a readable toast.
   *
   * Every browser file API can fail for reasons the user cannot see (a decode
   * error, a revoked permission), and an unhandled rejection here would look
   * like the app silently doing nothing.
   */
  const runFileOp = useCallback(
    async (operation, { success, failure = 'That did not work' }) => {
      try {
        const result = await operation()
        if (success) pushToast({ title: success, tone: 'success' })
        return result
      } catch (error) {
        pushToast({
          title: failure,
          message: error?.message ?? 'Something went wrong.',
          tone: 'warning',
          duration: 5000,
        })
        return null
      }
    },
    [pushToast],
  )

  /* --------------------------------------------------- recovery user actions */

  /**
   * Load a snapshot the user chose to recover.
   *
   * Declared after `runFileOp` deliberately: the callback closes over it, and
   * referencing it earlier would hit the temporal dead zone on first render.
   */
  const recoverSnapshot = useCallback(
    () =>
      runFileOp(async () => {
        const project = recovery.project
        if (!project) throw new Error('There is no recovery snapshot to load.')
        await engine.loadProject(JSON.stringify(project))
        markSaved()
        setRecovery({ status: 'idle', savedAt: null })
        return true
      }, {
        success: 'Recovered your unsaved work',
        failure: 'That snapshot could not be recovered',
      }),
    [engine, markSaved, recovery.project, runFileOp],
  )

  /** Dismiss the recovery prompt and delete the snapshot for good. */
  const dismissRecovery = useCallback(async () => {
    setRecovery({ status: 'idle', savedAt: null })
    await clearSnapshot()
  }, [])

  /** Discard the snapshot and start from a clean document. */
  const startFresh = useCallback(async () => {
    await dismissRecovery()
    setDoc(DEFAULT_DOC)
    fitToScreen()
  }, [dismissRecovery, fitToScreen, setDoc])

  /** Import an image on top of the current artwork as a new layer. */
  const importImageFile = useCallback(
    (file) =>
      runFileOp(() => engine.importImageFile(file), {
        success: `Imported ${file?.name ?? 'image'}`,
        failure: 'That image could not be imported',
      }),
    [engine, runFileOp],
  )

  /** Open an image as a whole new document, replacing what is on screen. */
  const openImageFile = useCallback(
    (file) =>
      runFileOp(async () => {
        await engine.openImageFile(file)
        // A brand-new document: the old clipboard refers to pixels that are gone.
        setHasClipboard(false)
        return true
      }, {
        success: `Opened ${file?.name ?? 'image'}`,
        failure: 'That image could not be opened',
      }),
    [engine, runFileOp],
  )

  /** Save the layered document as a `.aurora` project file. */
  const saveProject = useCallback(
    () =>
      runFileOp(async () => {
        const project = engine.snapshotProject()
        const blob = new Blob([JSON.stringify(project)], {
          type: 'application/json',
        })
        downloadBlob(blob, `${sanitizeFilename(engine.document.name)}.${PROJECT_EXTENSION}`)
        markSaved()
        return project
      }, {
        success: 'Project saved',
        failure: 'The project could not be saved',
      }),
    [engine, markSaved, runFileOp],
  )

  /** Load a `.aurora` project, replacing the current document. */
  const openProjectFile = useCallback(
    (file) =>
      runFileOp(async () => {
        const text = await readFileAsText(file)
        await engine.loadProject(text)
        // loadProject clears history, so the save point moves to zero with it —
        // an opened project starts clean, with nothing to recover.
        markSaved()
        // The clipboard held pixels from the old document, which no longer
        // exists — offering to paste them would insert a stale payload.
        setHasClipboard(false)
        return true
      }, {
        success: `Opened ${file?.name ?? 'project'}`,
        failure: 'That project could not be opened',
      }),
    [engine, markSaved, runFileOp],
  )

  /**
   * Route a file to the right operation.
   *
   * `.aurora` files reopen the layered project; anything else opens as an
   * image document. Drag-and-drop, the Open button and the Ctrl+O shortcut all
   * funnel through here so the three can never disagree about a file type.
   */
  const openFile = useCallback(
    (file) => {
      if (!file) return
      if (isProjectFile(file)) openProjectFile(file)
      else if (isImportableFile(file)) openImageFile(file)
      else pushToast({ title: 'That file type cannot be opened', tone: 'warning' })
    },
    [openProjectFile, openImageFile, pushToast],
  )

  // One hidden input for the whole app: the Open button, the command palette
  // and the keyboard shortcut all trigger this same element.
  const { open: openFilePicker, inputProps } = useFilePicker(openFile)

  /**
   * Encode the flattened document and hand it to the browser.
   *
   * @param {object} [options] format / quality / scale / transparent
   */
  const exportImageFile = useCallback(
    (options = {}) =>
      runFileOp(async () => {
        const { blob, filename } = await engine.exportImage(options)
        downloadBlob(blob, filename)
        return filename
      }, {
        success: `Exported ${exportFilename(engine.document.name, options)}`,
        failure: 'The image could not be exported',
      }),
    [engine, runFileOp],
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
      Object.values(prev).some(Boolean)
        ? { palette: false, shortcuts: false, newDoc: false, color: false, export: false }
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
      setOptions,
      resetOptions,
      simpleMode,
      setSimpleMode,
      toggleSimpleMode,
      simpleMode, setSimpleMode, toggleSimpleMode,
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
      recentCommands,
      noteCommand,
      clearRecentCommands,
      /* files */
      isDirty,
      lastSavedAt,
      openFile,
      openFilePicker,
      importImageFile,
      openImageFile,
      openProjectFile,
      saveProject,
      exportImageFile,
      /* recovery */
      recovery,
      recoverSnapshot,
      dismissRecovery,
      startFresh,
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
      copy: copyToClipboard,
      cut: cutToClipboard,
      paste,
      deleteSelection,
      selectAll,
      deselect,
      invertSelection,
      selection: selectionState,
      hasClipboard,
    }),
    [
      activeTool, setTool, options, setOption, setOptions, resetOptions,
      simpleMode, setSimpleMode, toggleSimpleMode,
      primary, secondary, setPrimary, setSecondary, swapColors, resetColors,
      recentColors, pushRecent, clearRecent,
      recentCommands, noteCommand, clearRecentCommands,
      doc, engine, setDoc, zoom, setZoom, zoomIn, zoomOut, zoomTo, fitScale, fitToScreen,
      layers, activeLayerId, selectLayer, toggleLayerVisibility, toggleLayerLock,
      setLayerOpacity, setLayerBlend, addLayer, duplicateLayer, deleteLayer, renameLayer, moveLayer,
      isDirty, lastSavedAt,
      openFile, openFilePicker,
      importImageFile, openImageFile, openProjectFile, saveProject, exportImageFile,
      recovery, recoverSnapshot, dismissRecovery, startFresh,
      panels, togglePanel, dialogs, openDialog, closeDialog, closeAllDialogs, anyDialogOpen,
      toasts, pushToast, dismissToast,
      historyState, selectionState, hasClipboard, undo, redo, jumpHistory,
      copyToClipboard, cutToClipboard, paste, deleteSelection, selectAll, deselect, invertSelection,
    ],
  )

  return (
    <>
      <UiContext.Provider value={value}>{children}</UiContext.Provider>

      {/* The app's single file input, rendered beside the provider rather than
          inside any panel: the top bar, the command palette and the keyboard
          shortcut all reach it through `openFilePicker`, so there is exactly
          one `accept`, one reset rule and one place to reason about files. */}
      <input {...inputProps} aria-label="Open a file" tabIndex={-1} />
    </>
  )
}