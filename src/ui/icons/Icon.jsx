import { cn } from '../../lib/cn.js'

/**
 * Inline SVG icon set.
 *
 * Hand-rolled rather than importing an icon library: the app keeps a
 * 2-runtime-dependency budget (react + react-dom), and a single inlined
 * sprite avoids a network request plus a large unused-glyph payload.
 *
 * All glyphs share a 24x24 viewBox and inherit `currentColor`, so they can be
 * styled and animated with plain Tailwind utilities.
 */
const ICONS = {
  /* ---------------- Tools ---------------- */
  cursor: <path d="M6 3 19 11 13.2 12.4 16.4 18.8 13.8 20 10.7 13.6 6 17.6Z" />,

  lasso: (
    <>
      <path d="M12 4.6c4.3 0 7.8 2.2 7.8 4.9s-3.5 4.9-7.8 4.9-7.8-2.2-7.8-4.9S7.7 4.6 12 4.6Z" />
      <path d="M9.4 14.1 8.6 17.6" />
      <circle cx="8.4" cy="19.6" r="1.5" />
    </>
  ),

  magicWand: (
    <>
      <path d="M3.6 20.4 12.4 11.6" />
      <path d="M11.2 10.4 13.6 12.8" />
      <path d="M14.8 4.2v3.4M13.1 5.9h3.4" />
      <path d="M19.8 9.6v2.6M18.5 10.9h2.6" />
      <path d="M17.6 4.6v1.8M16.7 5.5h1.8" />
    </>
  ),

  move: (
    <>
      <path d="M12 3.4v17.2M3.4 12h17.2" />
      <path d="M12 3.4 9.6 5.8M12 3.4l2.4 2.4M12 20.6 9.6 18.2M12 20.6l2.4-2.4" />
      <path d="M3.4 12 5.8 9.6M3.4 12l2.4 2.4M20.6 12l-2.4-2.4M20.6 12l-2.4 2.4" />
    </>
  ),

  brush: (
    <>
      <path d="M9.2 11.4 7.3 13.3a2.6 2.6 0 0 0 0 3.7l2.3 2.3a2.6 2.6 0 0 0 3.7 0l1.9-1.9" />
      <path d="M14.4 12.2 18 8.6a2.6 2.6 0 0 0 0-3.7l-1.4-1.4a2.6 2.6 0 0 0-3.7 0l-3.6 3.6z" />
      <path d="M9.6 16.6 6 20.2" />
    </>
  ),

  pencil: (
    <>
      <path d="M4.2 19.8 4.8 16.2 16.6 4.4a2.1 2.1 0 0 1 3 3L7.8 19.2Z" />
      <path d="M14.6 6.4 17.6 9.4M4.8 16.2 7.8 19.2" />
    </>
  ),

  eraser: (
    <>
      <path d="M9.3 4.4 4.4 9.3a1.6 1.6 0 0 0 0 2.3l6.9 6.9a1.6 1.6 0 0 0 2.3 0l4.9-4.9a1.6 1.6 0 0 0 0-2.3l-6.9-6.9a1.6 1.6 0 0 0-2.3 0Z" />
      <path d="M12.9 7.9 19.5 14.5M8.6 20.6h11.8" />
    </>
  ),

  fill: (
    <>
      <path d="M10.4 3.6 4.6 9.4a1.5 1.5 0 0 0 0 2.1l5.7 5.7a1.5 1.5 0 0 0 2.1 0l5.8-5.8z" />
      <path d="M20.4 14.4c0 0 1.8 2.3 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-1.1 1.8-3.4 1.8-3.4Z" />
    </>
  ),

  eyedropper: (
    <>
      <path d="M14.6 4.7a2.7 2.7 0 0 1 3.8 3.8l-1.5 1.5-3.8-3.8z" />
      <path d="M13.1 6.2 6.2 13.1" />
      <path d="M6.2 13.1 4 20l6.9-2.2z" />
      <path d="M6.2 13.1 8.4 15.3" />
    </>
  ),

  text: <path d="M5 5.4h14M12 5.4v13.2M9.2 18.6h5.6" />,

  shape: (
    <>
      <rect x="3.2" y="8.2" width="10.6" height="10.6" rx="1.8" />
      <circle cx="15.2" cy="8.8" r="5.6" />
    </>
  ),

  line: (
    <>
      <path d="M4.6 19.4 19.4 4.6" />
      <circle cx="4.6" cy="19.4" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19.4" cy="4.6" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),

  ellipse: <circle cx="12" cy="12" r="8.2" />,

  zoom: (
    <>
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M15.4 15.4 21 21M8 10.6h5.2M10.6 8v5.2" />
    </>
  ),

  hand: (
    <>
      <path d="M8.6 12.4V6.2a1.6 1.6 0 0 1 3.2 0v4.6" />
      <path d="M11.8 10.8V5a1.6 1.6 0 0 1 3.2 0v5.8" />
      <path d="M15 11.4V7a1.6 1.6 0 0 1 3.2 0v7.2a7.2 7.2 0 0 1-7.2 7.2h-.6a6 6 0 0 1-4.8-2.4L3.6 15a1.7 1.7 0 0 1 2.6-2.1L8.6 15" />
    </>
  ),

  layers: (
    <>
      <path d="M12 3.4 20.8 8 12 12.6 3.2 8z" />
      <path d="M3.2 12.4 12 17 20.8 12.4" />
      <path d="M3.2 16.4 12 21 20.8 16.4" />
    </>
  ),

  help: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.6" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),

  /* ---------------- Actions ---------------- */
  undo: (
    <>
      <path d="M4.4 8.6h9.1a5.4 5.4 0 0 1 0 10.8H8" />
      <path d="M8.2 4.4 4.2 8.6l4 4.2" />
    </>
  ),

  redo: (
    <>
      <path d="M19.6 8.6h-9.1a5.4 5.4 0 0 0 0 10.8H16" />
      <path d="M15.8 4.4 19.8 8.6l-4 4.2" />
    </>
  ),

  newFile: (
    <>
      <path d="M13.6 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.4z" />
      <path d="M13.6 3.2v5.2h5" />
      <path d="M12 11.8v6M9 14.8h6" />
    </>
  ),

  folder: (
    <>
      <path d="M3.6 19.4V6.6A1.6 1.6 0 0 1 5.2 5h3.9l2 2.6h6.1a1.6 1.6 0 0 1 1.6 1.6v2" />
      <path d="M3.6 19.4 6 12.4h15.2L18.8 19.4z" />
    </>
  ),

  save: (
    <>
      <path d="M4.6 3.6h11.6L20.4 7.8v12.6H4.6z" />
      <path d="M8.2 3.6v5.6h7.2V3.6M7.6 20.4v-7h8.8v7" />
    </>
  ),

  download: (
    <>
      <path d="M12 3.4v11.2M7.4 10.2 12 14.8l4.6-4.6" />
      <path d="M4.4 17.4v1.6a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-1.6" />
    </>
  ),

  image: (
    <>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2" />
      <circle cx="8.6" cy="9.6" r="1.7" />
      <path d="M4.2 17.4 9.4 12.4l4.4 4.4 2.9-2.5 3.7 3.7" />
    </>
  ),

  copy: (
    <>
      <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2" />
      <path d="M5.6 15.4a2 2 0 0 1-2-2v-7.8a2 2 0 0 1 2-2h7.8a2 2 0 0 1 2 2" />
    </>
  ),

  trash: (
    <>
      <path d="M4.4 6.6h15.2M9.2 6.6V4.6a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v2" />
      <path d="M6.4 6.6 7.4 20a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l1-13.4" />
      <path d="M10.4 10.4v7.4M13.6 10.4v7.4" />
    </>
  ),

  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  minus: <path d="M5.4 12h13.2" />,
  x: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
  check: <path d="M5 12.6 9.8 17.4 19 7" />,

  eye: (
    <>
      <path d="M2.6 12S6.1 6.6 12 6.6 21.4 12 21.4 12 17.9 17.4 12 17.4 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  eyeOff: (
    <>
      <path d="M4.4 8.1C3.2 9.4 2.6 12 2.6 12s3.5 5.4 9.4 5.4c1.5 0 2.8-.3 3.9-.8" />
      <path d="M9.9 6.9A9.9 9.9 0 0 1 12 6.6c5.9 0 9.4 5.4 9.4 5.4a17 17 0 0 1-2.6 3.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 20 20 4" />
    </>
  ),

  lock: (
    <>
      <rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2" />
      <path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8" />
    </>
  ),

  unlock: (
    <>
      <rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2" />
      <path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0" />
    </>
  ),

  chevronDown: <path d="M6 9.6 12 15.6 18 9.6" />,
  chevronRight: <path d="M9.6 6 15.6 12 9.6 18" />,
  chevronLeft: <path d="M14.4 6 8.4 12 14.4 18" />,

  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M15.6 15.6 20.6 20.6" />
    </>
  ),

  sliders: (
    <>
      <path d="M4 7.4h9.4M19.6 7.4h.6M4 12h3.4M13.6 12h6.6M4 16.6h9.4M19.6 16.6h.6" />
      <circle cx="16.4" cy="7.4" r="2" />
      <circle cx="11" cy="12" r="2" />
      <circle cx="16.4" cy="16.6" r="2" />
    </>
  ),

  maximize: (
    <path d="M4 9.2V5.6A1.6 1.6 0 0 1 5.6 4H9.2M14.8 4h3.6A1.6 1.6 0 0 1 20 5.6v3.6M20 14.8v3.6a1.6 1.6 0 0 1-1.6 1.6h-3.6M9.2 20H5.6A1.6 1.6 0 0 1 4 18.4v-3.6" />
  ),

  grip: (
    <>
      <circle cx="9.4" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="17.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="17.6" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),

  sparkle: (
    <>
      <path d="M12 3.6 13.6 9.2 19.2 10.8 13.6 12.4 12 18 10.4 12.4 4.8 10.8 10.4 9.2z" />
      <path d="M18.4 16.4v2.4M17.2 17.6h2.4" />
    </>
  ),

  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.4" />
      <circle cx="12" cy="8.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),

  alert: (
    <>
      <path d="M12 4.2 21 19.4H3z" />
      <path d="M12 10v4.4" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),

  mouse: (
    <>
      <rect x="7" y="3.2" width="10" height="17.6" rx="5" />
      <path d="M12 7.4v3.4" />
    </>
  ),

  droplet: <path d="M12 3.6c3 4 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 3-6 6-10z" />,

  contrast: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill="currentColor" stroke="none" />
    </>
  ),

  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.4 2.2" />
    </>
  ),

  palette: (
    <>
      <path d="M12 3.6c4.8 0 8.6 3.4 8.6 7.7 0 2.3-1.7 3.7-3.5 3.7h-1.7a2 2 0 0 0-1.6 3.2c.4.5.6 1.1.6 1.8 0 1-1 1.8-2.5 1.8-4.8 0-8.6-3.9-8.6-9.1S7.2 3.6 12 3.6Z" />
      <circle cx="8.4" cy="10.4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),

  keyboard: (
    <>
      <rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2" />
      <path d="M6 10h.01M9.4 10h.01M12.8 10h.01M16.2 10h.01M18.6 10h.01M6 13.6h.01M7.6 14.2h8.8" />
    </>
  ),

  expand: (
    <>
      <path d="M4.4 9V5.6a1.2 1.2 0 0 1 1.2-1.2H9M15 4.4h3.4a1.2 1.2 0 0 1 1.2 1.2V9M19.6 15v3.4a1.2 1.2 0 0 1-1.2 1.2H15M9 19.6H5.6a1.2 1.2 0 0 1-1.2-1.2V15" />
      <path d="M12 9.4v5.2M9.4 12h5.2" />
    </>
  ),

  crop: (
    <>
      <path d="M6.4 2.6v15h15" />
      <path d="M2.6 6.4h15v15" />
    </>
  ),

  flipH: (
    <>
      <path d="M12 3.4v17.2" strokeDasharray="2.6 2.6" />
      <path d="M8.6 7.4 4 12l4.6 4.6zM15.4 7.4 20 12l-4.6 4.6z" />
    </>
  ),

  flipV: (
    <>
      <path d="M3.4 12h17.2" strokeDasharray="2.6 2.6" />
      <path d="M7.4 8.6 12 4l4.6 4.6zM7.4 15.4 12 20l4.6-4.6z" />
    </>
  ),

  rotate: (
    <>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1" />
      <path d="M20.6 3.6v5.4h-5.4" />
    </>
  ),

  textAlign: <path d="M4 6.4h16M4 12h10M4 17.6h13" />,

  grid: (
    <>
      <rect x="3.6" y="3.6" width="7" height="7" rx="1.4" />
      <rect x="13.4" y="3.6" width="7" height="7" rx="1.4" />
      <rect x="3.6" y="13.4" width="7" height="7" rx="1.4" />
      <rect x="13.4" y="13.4" width="7" height="7" rx="1.4" />
    </>
  ),
}

/**
 * @param {object} props
 * @param {keyof typeof ICONS} props.name
 * @param {number} [props.size]
 * @param {number} [props.strokeWidth]
 * @param {string} [props.className]
 */
export default function Icon({ name, size = 18, strokeWidth = 1.6, className, ...rest }) {
  const glyph = ICONS[name] ?? ICONS.help

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  )
}

export const ICON_NAMES = Object.keys(ICONS)