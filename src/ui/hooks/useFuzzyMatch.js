/**
 * Tiny subsequence fuzzy matcher used by the command palette.
 *
 * Hand-rolled rather than pulling in fuse.js/cmdk: the palette needs to rank
 * ~40 static commands, and a subsequence scorer with a contiguity bonus is
 * ~40 lines — far less than the cost of the dependency. It also returns match
 * indices so the palette can highlight hits (recognition over recall).
 *
 * @param {string} query
 * @param {string} target
 * @returns {{ score: number, indices: number[] } | null} null = no match
 */
export function fuzzyMatch(query, target) {
  const q = query.trim().toLowerCase()
  const t = target.toLowerCase()

  if (!q) return { score: 0, indices: [] }

  // Exact substring (and prefix) always beats a scattered subsequence.
  const at = t.indexOf(q)
  if (at !== -1) {
    const prefixBonus = at === 0 ? 200 : 0
    const contiguityBonus = q.length * 8
    const indices = Array.from({ length: q.length }, (_, i) => at + i)
    return { score: 600 + prefixBonus + contiguityBonus + q.length, indices }
  }

  // Subsequence scan with a penalty for gaps and late first hits.
  const indices = []
  let targetIndex = 0
  let score = 0

  for (const char of q) {
    const found = t.indexOf(char, targetIndex)
    if (found === -1) return null

    const gap = found - targetIndex
    score += gap === 0 ? 6 : gap <= 3 ? 3 : 1

    if (indices.length > 0 && gap === 0) score += 4 // consecutive runs
    indices.push(found)
    targetIndex = found + 1
  }

  score += Math.max(0, 40 - indices[0] * 3) // earlier start = better
  return { score, indices }
}

/**
 * Bonus applied to a recently used command.
 *
 * Sized to sit *between* fuzzy tiers rather than above them: recency should
 * reorder plausible matches, never promote something that does not match the
 * query at all. A gap of 12 means a command used 3 steps ago outranks a
 * scattered-subsequence match but loses to a literal substring hit.
 */
const RECENCY_STEP = 12

/** @param {string} id @param {string[]} recent most-recent-first */
function recencyBoost(id, recent) {
  const index = recent.indexOf(id)
  return index === -1 ? 0 : (recent.length - index) * RECENCY_STEP
}

/**
 * Sort and filter items by their best-matching searchable text.
 *
 * @param {string} query
 * @param {Array<{ keywords: string, ... }>} items
 * @param {string[]} [recent] command ids, most recently used first
 */
export function rankItems(query, items, recent = []) {
  if (!query.trim()) {
    // With no query there is nothing to match, so recency is the only signal
    // that distinguishes results — and a stable sort keeps everything else in
    // its authored group order.
    return items
      .map((item, order) => ({ item, indices: [], boost: recencyBoost(item.id, recent), order }))
      .sort((a, b) => b.boost - a.boost || a.order - b.order)
      .map(({ item, indices }) => ({ item, indices }))
  }

  const results = []
  for (const item of items) {
    const match = fuzzyMatch(query, item.keywords ?? item.label)
    if (match) {
      results.push({ item, ...match, boost: recencyBoost(item.id, recent) })
    }
  }

  return results.sort((a, b) => b.score + b.boost - (a.score + a.boost))
}

/** Split a label into plain/highlighted segments for rendering. */
export function highlightSegments(label, indices) {
  if (!indices?.length) return [{ text: label, hit: false }]

  const segments = []
  let cursor = 0
  const set = new Set(indices)

  let buffer = ''
  let bufferHit = set.has(0)

  for (let i = 0; i < label.length; i += 1) {
    const hit = set.has(i)
    if (hit !== bufferHit) {
      if (buffer) segments.push({ text: buffer, hit: bufferHit })
      buffer = ''
      bufferHit = hit
    }
    buffer += label[i]
    cursor = i
  }
  if (buffer) segments.push({ text: buffer, hit: bufferHit })

  void cursor
  return segments
}