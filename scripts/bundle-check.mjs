#!/usr/bin/env node
// Checks the built site after `vite build`:
// 1. No chunk references Node built-ins, Vite's browser-external shim, or an AWS endpoint.
// 2. The lazily loaded agent runtime stays within its gzip budget.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { builtinModules } from 'node:module'

const dist = new URL('../dist/', import.meta.url)
const manifestPath = new URL('.vite/manifest.json', dist)
if (!existsSync(manifestPath)) { console.error('bundle-check: dist/.vite/manifest.json missing. Run vite build first.'); process.exit(2) }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const assets = new URL('assets/', dist)
const files = readdirSync(assets).filter(f => f.endsWith('.js'))
if (files.length === 0) { console.error('bundle-check: no JavaScript chunks found. That is not a pass.'); process.exit(3) }

const forbidden = [
  ['vite-browser-external', /__vite-browser-external/],
  ['node-protocol-import', /\bfrom\s*["']node:|import\(\s*["']node:/],
  ['bare-builtin-import', new RegExp(`(?:from\\s*|import\\(\\s*)["'](?:${builtinModules.filter(m => !m.startsWith('_')).map(m => m.replace('/', '\\/')).join('|')})["']`)],
  ['aws-endpoint', /amazonaws\.com/],
  ['bedrock-runtime-client', /bedrock-runtime/i],
]
const hits = []
for (const file of files) {
  const text = readFileSync(new URL(file, assets), 'utf8')
  for (const [id, re] of forbidden) if (re.test(text)) hits.push(`${file} [${id}]`)
}

// Budget for the agent runtime: every chunk reachable from the harness entry (the same
// Strands runtime the lab's playground lazy-loads), excluding chunks the main page also needs eagerly.
const BUDGET_KB = 340
const gz = (file) => gzipSync(readFileSync(new URL(file, dist))).length
const reach = (key, seen = new Set()) => {
  if (seen.has(key) || !manifest[key]) return seen
  seen.add(key)
  for (const next of [...(manifest[key].imports ?? []), ...(manifest[key].dynamicImports ?? [])]) reach(next, seen)
  return seen
}
const harnessKey = Object.keys(manifest).find(k => k.endsWith('harness.html'))
let runtimeBytes = 0
if (harnessKey) for (const key of reach(harnessKey)) runtimeBytes += gz(manifest[key].file)
const totalBytes = files.reduce((sum, f) => sum + gzipSync(readFileSync(new URL(f, assets))).length, 0)

console.log(`bundle-check: ${files.length} chunk(s), ${(totalBytes / 1024).toFixed(1)} KB gzip total; agent runtime ${(runtimeBytes / 1024).toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`)
if (!harnessKey) hits.push('manifest [harness entry missing]')
if (runtimeBytes / 1024 > BUDGET_KB) hits.push(`agent runtime [over budget: ${(runtimeBytes / 1024).toFixed(1)} KB]`)
if (hits.length) { console.error(`bundle-check: ${hits.length} problem(s)`); for (const h of hits) console.error('  ' + h); process.exit(1) }
console.log('bundle-check: 0 problems')
