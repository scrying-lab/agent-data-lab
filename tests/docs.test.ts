// Housekeeping checks for the public documentation. They keep README, the agent handbook,
// licences and links consistent so drift is caught by `npm run check`, not by a visitor.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { links } from '../content/links'
import { claims } from '../content/claims'

const root = new URL('..', import.meta.url).pathname
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const withoutCodeBlocks = (markdown: string) => markdown.replace(/```[\s\S]*?```/g, '')

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')
const headings = (markdown: string) =>
  [...withoutCodeBlocks(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].trim())

/** Targets of inline links [text](target) and reference definitions [id]: target. */
function linkTargets(markdown: string): string[] {
  const text = withoutCodeBlocks(markdown)
  const inline = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1])
  const defined = [...text.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)].map(m => m[1])
  return [...inline, ...defined]
}

/** Every web address in a text, without trailing punctuation. */
const webAddresses = (text: string) =>
  [...text.matchAll(/https?:\/\/[^\s)<>\]"'`]+/g)].map(m => m[0].replace(/[.,;:]+$/, ''))

function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(flatten)
  return []
}
const knownLinks = new Set(flatten(links))

// Built from parts so this file never matches the public-safety scanner's own rules.
const slash = '/'
const localPath = [
  new RegExp(slash + 'Users' + slash + '[^' + slash + '\\s]+' + slash),
  new RegExp(slash + 'home' + slash + '[^' + slash + '\\s]+' + slash),
  /[A-Z]:\\Users\\/,
]

const publicDocs = ['README.md', 'AGENTS.md', 'CHANGELOG.md', 'NOTICE', 'LICENSE-DOCS.md', 'docs/references.md', 'docs/releasing.md']

describe('agent handbook', () => {
  it('AGENTS.md exists and fits in 4096 bytes', () => {
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true)
    expect(statSync(join(root, 'AGENTS.md')).size).toBeLessThanOrEqual(4096)
  })

  it('every repository path AGENTS.md names in backticks exists', () => {
    const tokens = [...read('AGENTS.md').matchAll(/`([^`\s]+)`/g)].map(m => m[1])
    const paths = tokens.filter(t => /^[\w.@/-]+$/.test(t) && !t.startsWith('@') && (t.endsWith('/') || /\.(ts|tsx|mjs|js|json|md|csv|html|txt)$/.test(t)))
    expect(paths.length).toBeGreaterThan(5)
    for (const path of paths) expect(existsSync(join(root, path)), path).toBe(true)
  })

  it('CLAUDE.md is exactly one line pointing at AGENTS.md', () => {
    expect(read('CLAUDE.md').replace(/\n$/, '')).toBe('@AGENTS.md')
  })
})

describe('README', () => {
  const readme = read('README.md')

  it('has every required section', () => {
    const found = headings(readme)
    for (const required of [
      'What is this?', 'Who is this for', 'Try it', 'How to use the lab', 'What you\'ll learn',
      'How it works', 'Run it yourself', 'Purpose', 'Releases', 'Credits and licences',
    ]) expect(found, required).toContain(required)
  })

  it('follows the Mermaid diagram with a plain-text description for screen-reader users', () => {
    const after = readme.split('```mermaid')[1]?.split('```')[1] ?? ''
    expect(after.trim().startsWith('**The same diagram in words.**')).toBe(true)
  })

  it('leaves the Purpose section to the owner: headings and bracketed prompts only', () => {
    const purpose = readme.split(/^## Purpose$/m)[1].split(/^## /m)[0]
    const lines = purpose.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<!--'))
    for (const line of lines) expect(line, line).toMatch(/^(### .+|\[[^\]]+\])$/)
  })

  it('references only image files that exist', () => {
    for (const [, src] of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      expect(/^https?:/.test(src) || existsSync(join(root, src)), src).toBe(true)
    }
  })

  it('ties each claim marker to a registered claim', () => {
    const ids = new Set(claims.map(c => c.id))
    const markers = [...readme.matchAll(/<!-- claim: (C-[A-Z0-9-]+) -->/g)].map(m => m[1])
    expect(markers.length).toBeGreaterThan(0)
    for (const id of markers) expect(ids.has(id), id).toBe(true)
  })
})

describe('relative links resolve', () => {
  for (const doc of ['README.md', 'CHANGELOG.md', 'LICENSE-DOCS.md', 'docs/references.md', 'docs/releasing.md']) {
    it(doc, () => {
      const text = read(doc)
      const anchors = new Set(headings(text).map(slug))
      for (const target of linkTargets(text)) {
        if (/^(https?:|mailto:)/.test(target)) continue
        const [file, anchor] = target.split('#')
        if (!file) { expect(anchors.has(anchor), `${doc}: #${anchor}`).toBe(true); continue }
        const resolved = normalize(join(dirname(doc), file))
        expect(existsSync(join(root, resolved)), `${doc}: ${target}`).toBe(true)
      }
    })
  }
})

describe('public links', () => {
  it('every web address in the public docs is registered in content/links.ts', () => {
    for (const doc of publicDocs) {
      for (const url of webAddresses(read(doc))) expect(knownLinks.has(url), `${doc}: ${url}`).toBe(true)
    }
  })

  it('README uses the hosted address once it is known, and the placeholder until then', () => {
    const tryIt = read('README.md').match(/^\[try-it\]:\s*(\S+)/m)?.[1]
    expect(tryIt).toBe(links.project.site ?? '#try-it')
  })
})

describe('public docs stay safe and licensed', () => {
  it('contain no absolute local paths', () => {
    for (const doc of [...publicDocs, 'CLAUDE.md', 'LICENSE']) {
      const text = read(doc)
      for (const re of localPath) expect(re.test(text), doc).toBe(false)
    }
  })

  it('licence the code under MIT and the docs under CC BY 4.0', () => {
    expect(read('LICENSE')).toMatch(/^MIT License\n\nCopyright \(c\) 2026 Ian Mitchell\n/)
    expect(read('LICENSE-DOCS.md')).toContain(links.licences.ccBy4LegalCode)
  })

  it('keep an Unreleased section above the newest release in the changelog', () => {
    const changelog = read('CHANGELOG.md')
    const unreleased = changelog.indexOf('## [Unreleased]')
    expect(unreleased).toBeGreaterThan(-1)
    expect(changelog.indexOf('## [1.0.0]')).toBeGreaterThan(unreleased)
  })
})
