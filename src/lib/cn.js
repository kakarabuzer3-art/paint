/**
 * Tiny class-name joiner. Accepts strings, arrays, objects (key => truthy)
 * and falsy values, then joins the survivors with a single space.
 *
 * Deliberately hand-rolled instead of pulling in clsx/tailwind-merge —
 * the app has a strict 2-runtime-dependency budget.
 *
 * @param {...unknown} parts
 * @returns {string}
 */
export function cn(...parts) {
  let out = ''

  for (const part of parts) {
    if (!part) continue

    if (typeof part === 'string' || typeof part === 'number') {
      out += (out ? ' ' : '') + part
      continue
    }

    if (Array.isArray(part)) {
      const nested = cn(...part)
      if (nested) out += (out ? ' ' : '') + nested
      continue
    }

    if (typeof part === 'object') {
      for (const key of Object.keys(part)) {
        if (part[key]) out += (out ? ' ' : '') + key
      }
    }
  }

  return out
}

export default cn