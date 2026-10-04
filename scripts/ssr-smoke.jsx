/**
 * Render the whole application tree on the server and assert the key
 * landmarks are present.
 *
 * Why this exists: `vite build` only proves the code *compiles*. This catches
 * render-time failures that would otherwise only surface in a browser console
 * — hooks called outside a provider, undefined values read during render,
 * portals created unconditionally, and so on. It runs with zero extra
 * dependencies (react-dom/server ships with react-dom).
 *
 * Usage: npm run smoke
 */
import { writeFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import App from '../src/App.jsx'

const html = renderToString(<App />)

// React emits <!-- --> markers between adjacent text expressions during SSR,
// so assert against comment-stripped markup (otherwise "3 layers" would be
// rendered as 3<!-- --> <!-- -->layers and fail spuriously).
const flat = html.replace(/<!--.*?-->/g, '')

const markers = [
  ['brand', 'Aurora'],
  ['document name', 'Untitled artwork'],
  ['active tool', 'Brush'],
  ['tool options', 'Hardness'],
  ['save state', 'No unsaved changes'],
  ['inspector colour', 'Studio palette'],
  // Layers are supplied by the engine after attach, so SSR renders the
  // section shell rather than rows — assert the shell, not the data.
  ['inspector layers section', 'Layers'],
  ['history empty state', 'scrub back through your work'],
  // Phase 8 accessibility landmarks.
  ['skip link', 'Skip to canvas'],
  ['canvas application role', 'role="application"'],
  ['canvas focus target', 'id="canvas-stage"'],
  // Simple mode hides advanced sliders by default, so the collapsed options
  // bar and the mode label are the proof it is actually on.
  ['simple mode label', 'Simple'],
  ['material picker', 'Material'],
  // Proof the clay conversion reached the rendered tree, not just the stylesheet:
  // .glass would still appear here if any component had been missed.
  ['clay panel class', 'clay-2'],
  ['clay chip class', 'clay '],
  // With no material applied the picker must say so rather than inventing a
  // name. ("Marker" only appears once the menu is opened, which SSR cannot do.)
  ['material shows custom when unmatched', 'Custom'],
]

/**
 * Substrings that must be ABSENT.
 *
 * Positive assertions alone cannot catch a regression that *adds* something.
 * These three are the failures worth catching silently: a component left on
 * .glass, Simple mode quietly reverting, or the advanced controls creeping
 * back into the default view.
 */
const forbidden = [
  ['glass classes fully removed', 'glass'],
  ['simple mode hides advanced sliders', 'Smoothing'],
  ['simple mode hides spacing', 'Spacing'],
]

const missing = markers.filter(([, value]) => !flat.includes(value))
const present = forbidden.filter(([, value]) => flat.includes(value))

const dump = () => {
  try {
    writeFileSync(new URL('../.smoke/rendered.html', import.meta.url), html)
    console.error('Rendered markup written to .smoke/rendered.html')
  } catch {
    /* best effort — the assertions themselves still matter */
  }
}

if (missing.length > 0 || present.length > 0) {
  // Dump the rendered markup so the failure is inspectable, not a guess.
  dump()
}

if (missing.length > 0) {
  console.error(`SSR smoke FAILED — missing ${missing.length} marker(s):`)
  for (const [label, value] of missing) console.error(`  - ${label}: "${value}"`)
}

if (present.length > 0) {
  console.error(`SSR smoke FAILED — ${present.length} forbidden string(s) rendered:`)
  for (const [label, value] of present) console.error(`  - ${label}: "${value}"`)
}

if (missing.length > 0 || present.length > 0) process.exit(1)

console.log(
  `SSR smoke OK — ${html.length} bytes rendered; ` +
    `${markers.length}/${markers.length} markers present, ` +
    `${forbidden.length}/${forbidden.length} forbidden strings absent.`,
)