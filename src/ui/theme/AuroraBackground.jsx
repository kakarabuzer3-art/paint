/**
 * The aurora field that every glass panel refracts.
 *
 * Performance notes (why it is built this way):
 *   - Only 4 gradient blobs, all animated with `transform` alone, so the
 *     whole layer is composited on the GPU and never repaints.
 *   - `filter: blur()` is applied once to a static element, not animated.
 *   - The layer is `pointer-events-none` and `aria-hidden`: it is decoration.
 *   - Motion is disabled wholesale by the global prefers-reduced-motion rule
 *     in index.css — no JS branch needed here.
 */
export default function AuroraBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      {/* Base wash so the void is never flat black. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#191430_0%,#0b0916_55%,#07060c_100%)]" />

      {/* Aurora blobs */}
      <div className="animate-aurora-drift absolute -top-[22%] -left-[12%] h-[62vmax] w-[62vmax] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgb(139_92_246/0.42),transparent_62%)] blur-[70px]" />
      <div className="animate-aurora-drift-slow absolute -top-[18%] right-[-16%] h-[58vmax] w-[58vmax] rounded-full bg-[radial-gradient(circle_at_60%_40%,rgb(34_211_238/0.30),transparent_64%)] blur-[80px]" />
      <div className="animate-aurora-drift absolute bottom-[-24%] left-[18%] h-[54vmax] w-[54vmax] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgb(232_121_249/0.22),transparent_66%)] blur-[90px]" />
      <div className="animate-aurora-drift-slow absolute bottom-[-14%] right-[8%] h-[40vmax] w-[40vmax] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgb(45_212_191/0.22),transparent_68%)] blur-[72px]" />

      {/* Fine grain + vignette: stops large gradients from banding. */}
      <div className="absolute inset-0 opacity-[0.5] mix-blend-soft-light [background-image:repeating-linear-gradient(0deg,rgb(255_255_255/0.022)_0px,rgb(255_255_255/0.022)_1px,transparent_1px,transparent_3px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_50%,transparent_45%,rgb(0_0_0/0.55)_100%)]" />
    </div>
  )
}