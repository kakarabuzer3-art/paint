/**
 * Colour maths — pure functions, zero React, zero DOM.
 *
 * Lives in lib/ (not ui/) deliberately: the canvas engine needs exactly the
 * same conversions for the eyedropper, flood fill tolerance and gradient
 * stops, so this module is the single implementation for both layers.
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const HEX3 = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
const HEX6 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
const HEX8 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i

/** '#abc' | 'abc' | '#aabbcc' | '#aabbccdd' -> '#aabbcc' | null */
export function normalizeHex(input) {
  if (typeof input !== 'string') return null

  const value = input.trim()

  const short = value.match(HEX3)
  if (short) {
    const [, r, g, b] = short
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const long = value.match(HEX6)
  if (long) return `#${long[1]}${long[2]}${long[3]}`.toLowerCase()

  const withAlpha = value.match(HEX8)
  if (withAlpha) return `#${withAlpha[1]}${withAlpha[2]}${withAlpha[3]}`.toLowerCase()

  return null
}

/** '#aabbcc' -> { r: 170, g: 187, b: 204 } */
export function hexToRgb(hex) {
  const normalized = normalizeHex(hex) ?? '#000000'
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

/** { r, g, b } -> '#aabbcc' */
export function rgbToHex({ r, g, b }) {
  const toHex = (channel) =>
    clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** { r, g, b } -> { h: 0-360, s: 0-100, v: 0-100 } */
export function rgbToHsv({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  }
}

/** { h, s, v } (0-360, 0-100, 0-100) -> { r, g, b } */
export function hsvToRgb({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const val = clamp(v, 0, 100) / 100

  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c

  let rgb
  if (hue < 60) rgb = [c, x, 0]
  else if (hue < 120) rgb = [x, c, 0]
  else if (hue < 180) rgb = [0, c, x]
  else if (hue < 240) rgb = [0, x, c]
  else if (hue < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  }
}

export const hexToHsv = (hex) => rgbToHsv(hexToRgb(hex))
export const hsvToHex = (hsv) => rgbToHex(hsvToRgb(hsv))

/**
 * Parse any CSS colour string the app can produce.
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
export function parseColor(input) {
  if (typeof input !== 'string') return null

  const asHex = normalizeHex(input)
  if (asHex) return { ...hexToRgb(asHex), a: 1 }

  const fn = input.trim().match(RGB_FN)
  if (fn) {
    const alphaRaw = fn[4]
    const alpha = alphaRaw?.endsWith('%')
      ? parseFloat(alphaRaw) / 100
      : alphaRaw
        ? parseFloat(alphaRaw)
        : 1
    return {
      r: clamp(Math.round(parseFloat(fn[1])), 0, 255),
      g: clamp(Math.round(parseFloat(fn[2])), 0, 255),
      b: clamp(Math.round(parseFloat(fn[3])), 0, 255),
      a: clamp(alpha, 0, 1),
    }
  }

  return null
}

/** WCAG relative luminance — used to pick readable text over a swatch. */
export function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** '#000000' or '#ffffff' — whichever stays readable on the given colour. */
export function readableInkOn(hex) {
  return relativeLuminance(hexToRgb(hex)) > 0.45 ? '#000000' : '#ffffff'
}

/** Linear blend between two hex colours. `t` = 0 returns `a`. */
export function mixHex(a, b, t) {
  const from = hexToRgb(a)
  const to = hexToRgb(b)
  const ratio = clamp(t, 0, 1)
  return rgbToHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  })
}

/** rgba() string for canvas fill/stroke usage. */
export function toRgbaString(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}