/**
 * Encode / decode helpers for image files.
 *
 * Every DOM API here is called lazily inside a function — importing this module
 * must stay safe in a plain Node process (unit tests, SSR smoke), so nothing
 * touches `document` at module scope.
 *
 * `OffscreenCanvas` and `<canvas>` disagree about how they hand back encoded
 * bytes (`convertToBlob` vs `toBlob`), and the engine's layer buffers are
 * OffscreenCanvas while an export target may be either. Both paths are handled
 * here so callers only ever see a Blob.
 */

/** Export formats the UI may offer, in menu order. */
export const EXPORT_FORMATS = {
  png: {
    id: 'png',
    label: 'PNG',
    mime: 'image/png',
    extension: 'png',
    // Lossless: a quality slider would be a lie, so the UI hides it.
    supportsQuality: false,
    supportsAlpha: true,
  },
  jpeg: {
    id: 'jpeg',
    label: 'JPEG',
    mime: 'image/jpeg',
    extension: 'jpg',
    supportsQuality: true,
    // JPEG has no alpha; anything transparent flattens to black.
    supportsAlpha: false,
  },
  webp: {
    id: 'webp',
    label: 'WebP',
    mime: 'image/webp',
    extension: 'webp',
    supportsQuality: true,
    supportsAlpha: true,
  },
}

export const DEFAULT_EXPORT_FORMAT = 'png'

/** Resolve a format id to its descriptor, falling back to PNG. */
export function getFormat(id) {
  return EXPORT_FORMATS[id] ?? EXPORT_FORMATS[DEFAULT_EXPORT_FORMAT]
}

/** Image types the Open dialog and drag-and-drop will accept. */
export const IMPORT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}

export function isImportableFile(file) {
  if (!file) return false
  // An empty type happens with some drag sources; the extension check covers it.
  if (file.type) return file.type in IMPORT_TYPES || file.type.startsWith('image/')
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name ?? '')
}

/**
 * Encode a canvas to a Blob.
 *
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 * @param {{ format?: string, quality?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function canvasToBlob(canvas, { format = DEFAULT_EXPORT_FORMAT, quality } = {}) {
  const spec = getFormat(format)
  // Quality is meaningless for PNG, and passing it can make some browsers
  // refuse the encode outright.
  const useQuality = spec.supportsQuality && Number.isFinite(quality)
    ? Math.min(1, Math.max(0, quality))
    : undefined

  if (typeof canvas.convertToBlob === 'function') {
    const options = { type: spec.mime }
    if (useQuality !== undefined) options.quality = useQuality
    return canvas.convertToBlob(options)
  }

  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The browser refused to encode this image.'))),
        spec.mime,
        useQuality,
      )
    })
  }

  throw new Error('This canvas cannot be encoded.')
}

/** Encode a canvas straight to a PNG data URL (used by the project format). */
export function canvasToDataUrl(canvas) {
  if (typeof canvas.toDataURL === 'function') return canvas.toDataURL('image/png')
  throw new Error('This canvas cannot be encoded.')
}
/**
 * Decode a `File`/`Blob` into a drawable image source.
 *
 * `createImageBitmap` is the fast path (decodes off the main thread where
 * supported); the `<img>` fallback covers Safari's older behaviour.
 *
 * @returns {Promise<{ source: CanvasImageSource, width: number, height: number }>}
 */
export async function decodeImageBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // Fall through: some browsers reject exotic types (e.g. SVG) here but
      // still decode them into an <img>.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    // Revoke on the next tick: revoking synchronously can cancel the decode.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Decode a PNG data URL into a drawable image source. */
export async function decodeImageDataUrl(dataUrl) {
  if (typeof Image === 'undefined') throw new Error('Image decoding is unavailable here.')
  const image = await loadImage(dataUrl)
  return { source: image, width: image.naturalWidth, height: image.naturalHeight }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That image could not be decoded.'))
    image.src = src
  })
}

/** Read a file as text (project files). */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.readAsText(file)
  })
}

/**
 * Trigger a browser download.
 *
 * The object URL is revoked on a timer rather than immediately — Safari
 * cancels the download if the URL disappears in the same tick.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = sanitizeFilename(filename)
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Make a string safe for a filename on every OS.
 *
 * Strips path separators and control characters, and keeps Windows' reserved
 * characters out — a download called `a:b.png` is silently renamed or dropped
 * by some browsers, which looks like a broken export.
 */
export function sanitizeFilename(name, fallback = 'artwork') {
  const cleaned = String(name ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)

  return cleaned || fallback
}

/** Build a download filename like `my-artwork@2x.png`. */
export function exportFilename(docName, { format = DEFAULT_EXPORT_FORMAT, scale = 1 } = {}) {
  const spec = getFormat(format)
  const suffix = scale === 1 ? '' : `@${scale}x`
  return `${sanitizeFilename(docName)}${suffix}.${spec.extension}`
}