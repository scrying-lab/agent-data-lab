// What the stored evaluation results depend on, as one hash.
//
// The stored results (evaluation/results.json) carry an inputsHash, and tests/eval.test.ts fails when
// it no longer matches, so stale results cannot sit in the repository. The hash covers:
// - the gate, the governed runner and the cases (the files below), and
// - the locked packages the evaluation actually loads: the npm packages its source files import,
//   directly or through other local files, plus everything those packages depend on, as recorded
//   in package-lock.json (version and integrity).
// A package the evaluation never loads, such as the icon library or the chart library, is left
// out, so updating it does not mark the results stale. The fresh-run test in tests/eval.test.ts
// still re-runs every case on every check.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Source files whose text is hashed directly. */
export const hashedSources = ['governance/policy.ts', 'agent/governed-run.ts', 'evaluation/cases.ts'] as const

/** Where the walk over local imports starts: the evaluation's own entry points. */
const ENTRY_POINTS = ['evaluation/cases.ts', 'evaluation/run.ts']

type LockEntry = {
  version?: string
  integrity?: string
  link?: boolean
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
export type Lockfile = { packages: Record<string, LockEntry> }

const IMPORT = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g
const builtins = new Set(builtinModules)

function specifiers(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(IMPORT)) found.push(m[1] ?? m[2] ?? m[3])
  return found
}

function resolveLocal(fromFile: string, spec: string): string | null {
  const base = normalize(join(dirname(fromFile), spec))
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(join(ROOT, candidate))) return candidate
  }
  return null
}

/** The npm package name of a bare import: "zod" from "zod/v4", "@scope/pkg" from "@scope/pkg/sub". */
function packageName(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/** The npm packages the evaluation's source files import, following local imports to the end. */
export function importedPackages(entries: readonly string[] = ENTRY_POINTS): string[] {
  const seen = new Set<string>()
  const packages = new Set<string>()
  const queue = [...entries]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of specifiers(readFileSync(join(ROOT, file), 'utf8'))) {
      if (spec.startsWith('.')) {
        const local = resolveLocal(file, spec)
        if (local) queue.push(relative(ROOT, join(ROOT, local)))
      } else if (!spec.startsWith('node:') && !builtins.has(spec)) {
        packages.add(packageName(spec))
      }
    }
  }
  return [...packages].sort()
}

/** Where npm installed `name` as seen from the package at `from`: the nearest node_modules up the tree. */
function locate(lock: Lockfile, from: string, name: string): string | null {
  let dir = from
  for (;;) {
    const key = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`
    if (lock.packages[key]) return key
    if (!dir) return null
    const up = dir.lastIndexOf('/node_modules/')
    dir = up === -1 ? '' : dir.slice(0, up)
  }
}

/** Every locked package the given packages load, with its version and integrity, sorted by location. */
export function lockedClosure(lock: Lockfile, roots: readonly string[]): Array<[string, string, string]> {
  const keep = new Map<string, LockEntry>()
  const queue: string[] = []
  for (const name of roots) {
    const key = locate(lock, '', name)
    if (key) queue.push(key)
  }
  while (queue.length) {
    const key = queue.pop()!
    if (keep.has(key)) continue
    const entry = lock.packages[key]
    keep.set(key, entry)
    const deps = { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies }
    for (const name of Object.keys(deps)) {
      const found = locate(lock, key, name)
      if (found) queue.push(found)
    }
  }
  return [...keep].sort(([a], [b]) => a.localeCompare(b)).map(([key, e]) => [key, e.version ?? '', e.integrity ?? ''])
}

export function readLockfile(): Lockfile {
  return JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as Lockfile
}

export function computeInputsHash(lock: Lockfile = readLockfile(), packages: readonly string[] = importedPackages()): string {
  const hash = createHash('sha256')
  for (const file of hashedSources) {
    hash.update(file + '\0').update(readFileSync(join(ROOT, file), 'utf8').replace(/\r\n/g, '\n')).update('\0')
  }
  hash.update('locked packages\0').update(JSON.stringify(lockedClosure(lock, packages))).update('\0')
  return hash.digest('hex')
}
