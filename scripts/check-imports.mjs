/**
 * Static import-resolution check.
 *
 * Relative-path mistakes (one too few or too many `../`) are the single most
 * common build failure in a no-alias project like this one. Running this
 * before every `vite build` surfaces ALL of them at once instead of one
 * bundle error at a time.
 *
 * Usage: node scripts/check-imports.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.cwd(), 'src')
const files = []

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(m?[jt]sx?)$/.test(entry)) files.push(full)
  }
}

walk(root)

const PATTERNS = [/from\s*['"](\.[^'"]+)['"]/g, /\bimport\s*['"](\.[^'"]+)['"]/g]

const missing = []
let checked = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const specs = new Set()

  for (const pattern of PATTERNS) {
    let match
    pattern.lastIndex = 0
    while ((match = pattern.exec(source)) !== null) specs.add(match[1])
  }

  for (const spec of specs) {
    checked += 1
    const target = resolve(dirname(file), spec)
    if (!existsSync(target)) missing.push(`${relative(process.cwd(), file)}  ->  ${spec}`)
  }
}

if (missing.length > 0) {
  console.error(`\n${missing.length} unresolved import(s):`)
  for (const line of missing) console.error(`  ${line}`)
  process.exit(1)
}

console.log(`OK — ${files.length} modules, ${checked} relative imports all resolve.`)