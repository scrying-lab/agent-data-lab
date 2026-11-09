#!/usr/bin/env node
// Public-safety scan. Run before anything leaves this machine.
//
//   node scripts/public-safety.mjs                       tracked files in the working tree
//   node scripts/public-safety.mjs --history --ref public  every commit reachable from a ref, plus author emails
//   node scripts/public-safety.mjs --generic-only        skip private terms (CI, contributors); publication refuses this mode
//
// Private terms live OUTSIDE the repository, one per line, in the file named by LAB_DENYLIST.
// A missing denylist fails closed unless --generic-only is passed. Matches are reported by rule id,
// never by the matched text, so logs cannot leak the denylist.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const genericOnly = flag('--generic-only')
const history = flag('--history')
const ref = option('--ref', 'HEAD')
const since = option('--since', null) // scan only commits after this one (e.g. the repository's initial commit made on GitHub)
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 })

// Built from parts so this file never matches its own rules.
const slash = '/'
const generic = [
  ['home-path-mac', new RegExp(slash + 'Users' + slash + '[^' + slash + '\\s]+' + slash)],
  ['home-path-linux', new RegExp(slash + 'home' + slash + '[^' + slash + '\\s]+' + slash)],
  ['home-path-windows', /[A-Z]:\\Users\\/],
  ['agent-attachments', new RegExp('\\.' + 'codex' + slash)],
  ['aws-key-id', new RegExp('\\b(AKIA|ASIA|ABSK)[A-Z0-9]{16}\\b')],
  ['aws-account-arn', /arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:\d{12}:/],
  // A standalone 12-digit number (an AWS account ID), but not part of a longer decimal like 90.79999999999997.
  ['aws-account-id', /(?<![0-9.])[0-9]{12}(?![0-9.])/],
  ['private-key', new RegExp('-----BEGIN [A-Z ]*PRIVATE ' + 'KEY-----')],
  // A literal 40-character secret value, not a pass-through like ${VAR} or credentials["..."].
  ['aws-secret-literal', new RegExp('aws_secret_access_' + 'key["\']?\\s*[=:]\\s*["\']?[A-Za-z0-9/+]{40}\\b', 'i')],
  ['bedrock-bearer', new RegExp('AWS_BEARER_TOKEN_' + 'BEDROCK\\s*=\\s*\\S')],
]

let privateTerms = []
if (!genericOnly) {
  const path = process.env.LAB_DENYLIST
  if (!path || !existsSync(path)) {
    console.error('public-safety: LAB_DENYLIST is not set or missing. Failing closed. Use --generic-only only for contributor checks.')
    process.exit(2)
  }
  privateTerms = readFileSync(path, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (privateTerms.length === 0) { console.error('public-safety: denylist is empty. Failing closed.'); process.exit(2) }
}
const rules = [
  ...generic,
  ...privateTerms.map((term, i) => ['denylist#' + (i + 1), new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')]),
]

const self = 'scripts/public-safety.mjs'
const skip = (path) => path === self || path === 'package-lock.json'
const hits = []
const scanText = (where, text) => {
  const lines = text.split('\n')
  for (const [id, re] of rules) lines.forEach((line, n) => { if (re.test(line)) hits.push(`${where}:${n + 1} [${id}]`) })
}

let files = 0, commits = 0
if (!history) {
  for (const path of git('ls-files', '-z').split('\0').filter(Boolean)) {
    if (skip(path) || !existsSync(path)) continue
    const buf = readFileSync(path)
    if (buf.includes(0)) continue // binary
    files++
    scanText(path, buf.toString('utf8'))
  }
} else {
  const shas = git('rev-list', since ? `${since}..${ref}` : ref).split('\n').filter(Boolean)
  const allowedEmail = /(@users\.noreply\.github\.com|^noreply@github\.com)$/
  for (const sha of shas) {
    commits++
    const [author, committer] = git('show', '-s', '--format=%ae%n%ce', sha).trim().split('\n')
    for (const email of [author, committer]) if (!allowedEmail.test(email)) hits.push(`${sha.slice(0, 7)} author/committer email [non-noreply]`)
    scanText(`${sha.slice(0, 7)}:message`, git('show', '-s', '--format=%B', sha))
    for (const path of git('ls-tree', '-r', '--name-only', '-z', sha).split('\0').filter(Boolean)) {
      if (skip(path)) continue
      const text = git('show', `${sha}:${path}`)
      if (text.includes('\0')) continue
      files++
      scanText(`${sha.slice(0, 7)}:${path}`, text)
    }
  }
}

const mode = genericOnly ? 'generic-only' : `generic + ${privateTerms.length} private terms`
console.log(`public-safety: ${history ? `${commits} commit(s) from ${ref}` : 'working tree'}, ${files} file(s) scanned, ${rules.length} rules (${mode})`)
if (files === 0) { console.error('public-safety: zero files scanned. That is not a pass.'); process.exit(3) }
if (hits.length) { console.error(`public-safety: ${hits.length} hit(s)`); for (const h of hits) console.error('  ' + h); process.exit(1) }
console.log('public-safety: 0 hits')
