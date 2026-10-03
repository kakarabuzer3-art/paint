/**
 * Creates a document-resolution pixel canvas.
 *
 * Prefers OffscreenCanvas (Baseline since March 2023): it decouples pixel
 * storage from the DOM and keeps layer memory out of the document, and it is
 * transferable to a worker later without copying. Falls back to a detached
 * <canvas> only where OffscreenCanvas is missing.
 *
 * This module never touches the DOM at import time, so `core/` stays safe to
 * import in a plain Node process (unit tests, SSR).
 */
export function createPixelCanvas(width, height) {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))

  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  return makeFallback(w, h)
}

/** Detached DOM canvas fallback (document.size in device pixels). */
function makeFallback(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** True when `canvas` can hand pixels back synchronously as ImageData. */
export function supportsImageData(canvas) {
  return typeof canvas?.getContext === 'function'
}