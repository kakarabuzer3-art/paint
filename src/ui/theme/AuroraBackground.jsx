/**
 * The aurora field that every clay panel refracts.
 *
 * Performance notes (why it is built this way):
 *   - Only 4 gradient blobs, all animated with `transform` alone, so the
 *     whole layer is composited on the GPU and never repaints.
 *   - `filter: blur()` is applied once to a static element, not animated.
 *   - The layer is `pointer-events-none` and `aria-hidden`: it is decoration.
 *   - Motion is disabled wholesale by the global prefers-reduced-motion rule
 *     in index.css — no JS branch needed here.
 */
/**
 * The matte backdrop the clay panels sit on.
 *
 * Replaces the old four-blob aurora field. Clay has no refraction to play off,
 * so the depth here comes from one soft top-down gradient rather than glowing
 * orbs — which also deletes a permanent cost: four 40-90px `filter: blur()`
 * layers animating on the compositor for the entire life of the page.
 *
 * Static, so it paints once and then never again.
 */
export default function AuroraBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      {/* A single soft key light from above, the same direction as the clay
          shadow pairs, so background and panels agree about where the light
          is. That consistency is most of what makes the relief read. */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_85%_at_50%_-12%,#221c33_0%,#15121e_48%,#0b0a11_100%)]" />

      {/* A whisper of warmth low-left keeps the lower panels from sinking into
          an undifferentiated black. Static — no drift, no blur filter. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_8%_105%,rgb(139_92_246/0.10),transparent_70%)]" />

      {/* Vignette: pulls focus toward the canvas. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_48%,rgb(0_0_0/0.5)_100%)]" />
    </div>
  )
}