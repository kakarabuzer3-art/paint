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
  ['status bar', 'Autosave ready'],
  ['inspector colour', 'Studio palette'],
  // Layers are supplied by the engine after attach, so SSR renders the
  // section shell rather than rows — assert the shell, not the data.
  ['inspector layers section', 'Layers'],
  ['history empty state', 'scrub back through your work'],
]

const missing = markers.filter(([, value]) => !flat.includes(value))

if (missing.length > 0) {
  // Dump the rendered markup so the failure is inspectable, not a guess.
  try {
    writeFileSync(new URL('../.smoke/rendered.html', import.meta.url), html)
    console.error('Rendered markup written to .smoke/rendered.html')
  } catch {
    /* best effort — the assertions below still matter */
  }

  console.error(`SSR smoke FAILED — missing ${missing.length} marker(s):`)
  for (const [label, value] of missing) console.error(`  - ${label}: "${value}"`)
  process.exit(1)
}

console.log(
  `SSR smoke OK — ${html.length} bytes rendered; ${markers.length}/${markers.length} markers present.`,
)