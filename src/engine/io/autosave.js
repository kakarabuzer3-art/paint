/**
 * Crash-recovery autosave, backed by IndexedDB.
 *
 * Why IndexedDB and not localStorage: a recovery snapshot is a serialised
 * layered document — megabytes of base64 PNG data URLs. localStorage caps out
 * around 5MB and writes synchronously on the main thread, so a snapshot there
 * would jank the UI and simply fail for any real document. IndexedDB stores
 * structured values asynchronously and has room to spare.
 *
 * Every entry point is defensive. Storage can be disabled entirely (Firefox
 * private mode, a hardened enterprise profile), and autosave failing must never
 * break painting — the worst acceptable outcome is that recovery is
 * unavailable, which `isAutosaveSupported()` reports honestly.
 *
 * Nothing here touches `indexedDB` at module scope, so importing this file in
 * Node (unit tests, SSR smoke) stays safe.
 */

const DB_NAME = 'aurora-paint'
const DB_VERSION = 1
const STORE = 'documents'
const DOC_KEY = 'current'

/** How long a snapshot stays recoverable. Beyond this it is dead weight. */
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** True when this browser can persist a snapshot at all. */
export function isAutosaveSupported() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    // Some hardened environments throw on merely touching the global.
    return false
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(error)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Autosave storage is unavailable.'))
    request.onblocked = () => reject(new Error('Autosave storage is blocked by another tab.'))
  })
}

/** Run `work` in a transaction, resolving with the request's result. */
function withStore(mode, work) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        let result
        const tx = db.transaction(STORE, mode)
        try {
          const request = work(tx.objectStore(STORE))
          if (request) request.onsuccess = () => { result = request.result }
        } catch (error) {
          db.close()
          reject(error)
          return
        }
        tx.oncomplete = () => { db.close(); resolve(result) }
        tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Autosave failed.')) }
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Autosave aborted.')) }
      }),
  )
}

/**
 * Persist a recovery snapshot.
 *
 * `project` is the same serialised shape `saveProject` downloads, so restoring
 * is a straight hand-off and there is only one serialisation format to reason
 * about. Returns the timestamp written, or null when storage was unavailable.
 */
export async function saveSnapshot(project) {
  if (!isAutosaveSupported()) return null
  try {
    const savedAt = Date.now()
    await withStore('readwrite', (store) => store.put({ savedAt, project }, DOC_KEY))
    return savedAt
  } catch {
    return null
  }
}

/**
 * Read the recovery snapshot, or null when there is nothing worth offering.
 *
 * Stale and unparseable snapshots are cleared rather than returned: a recovery
 * prompt that offers two-week-old work the user has already moved past from is
 * noise, and a snapshot that fails to parse is worse than none at all.
 */
export async function loadSnapshot() {
  if (!isAutosaveSupported()) return null
  try {
    const record = await withStore('readonly', (store) => store.get(DOC_KEY))
    if (!record?.project) return null

    const age = Date.now() - Number(record.savedAt ?? 0)
    if (!Number.isFinite(age) || age < 0 || age > SNAPSHOT_MAX_AGE_MS) {
      await clearSnapshot()
      return null
    }
    return { savedAt: Number(record.savedAt), project: record.project }
  } catch {
    return null
  }
}

/** Discard the recovery snapshot — called after a real save, or on "Not now". */
export async function clearSnapshot() {
  if (!isAutosaveSupported()) return false
  try {
    await withStore('readwrite', (store) => store.delete(DOC_KEY))
    return true
  } catch {
    return false
  }
}

/** Byte size of the stored snapshot, for the recovery prompt's detail line. */
export function describeSnapshot(project) {
  const layers = Array.isArray(project?.layers) ? project.layers.length : 0
  const width = project?.width ?? 0
  const height = project?.height ?? 0
  return `${width} × ${height} · ${layers} layer${layers === 1 ? '' : 's'}`
}

/** "3 minutes ago" / "2 days ago", for the recovery prompt. */
export function describeAge(savedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000))
  if (seconds < 60) return 'just now'

  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
  ]
  let label = 'minute'
  let size = 60
  for (const [name, span] of units) {
    if (seconds >= span) { label = name; size = span }
  }
  const count = Math.floor(seconds / size)
  return `${count} ${label}${count === 1 ? '' : 's'} ago`
}