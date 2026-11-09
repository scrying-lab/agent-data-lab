import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync, execFileSync } from 'node:child_process'
import { refuseLongLivedCredentials } from '../agent/credentials-guard'

const root = new URL('..', import.meta.url).pathname
const scanner = join(root, 'scripts/public-safety.mjs')

describe('configuration never carries secrets', () => {
  it('.env.example holds variable names and comments only', () => {
    const lines = readFileSync(join(root, '.env.example'), 'utf8').split('\n')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line, `line: ${line}`).toMatch(/^(#.*|[A-Z][A-Z0-9_]*=)?$/)
      expect(line.startsWith('VITE_'), `browser-exposed name: ${line}`).toBe(false)
    }
  })

  it('live recording refuses Bedrock bearer tokens and long-lived access keys', () => {
    expect(() => refuseLongLivedCredentials({ AWS_BEARER_TOKEN_BEDROCK: 'x' })).toThrow(/bearer|Bedrock API keys/i)
    expect(() => refuseLongLivedCredentials({ AWS_ACCESS_KEY_ID: 'x' })).toThrow(/long-lived/)
    expect(() => refuseLongLivedCredentials({ AWS_ACCESS_KEY_ID: 'x', AWS_SESSION_TOKEN: 'y' })).not.toThrow()
    expect(() => refuseLongLivedCredentials({ AWS_PROFILE: 'lab' })).not.toThrow()
  })
})

describe('public-safety scanner', () => {
  const scan = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'lab-scan-'))
    try {
      execFileSync('git', ['init', '-q'], { cwd: dir })
      for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
      execFileSync('git', ['add', '.'], { cwd: dir })
      return spawnSync('node', [scanner, '--generic-only'], { cwd: dir, encoding: 'utf8' })
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }
  const home = '/' + 'Users' + '/someone/project'
  const key = 'AKIA' + 'ABCDEFGHIJKLMNOP'

  it('catches planted leaks and reports rule ids, not the matched text', () => {
    const result = scan({ 'notes.md': `path ${home}\nkey ${key}\n` })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/home-path-mac/)
    expect(result.stderr).toMatch(/aws-key-id/)
    expect(result.stderr).not.toContain(key)
  })

  it('passes clean files and ignores long decimal numbers', () => {
    const result = scan({ 'data.json': '{"mean": 90.79999999999997, "n": 499}\n' })
    expect(result.status, result.stderr).toBe(0)
  })

  it('refuses to pass when it scanned nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lab-scan-'))
    try {
      execFileSync('git', ['init', '-q'], { cwd: dir })
      expect(spawnSync('node', [scanner, '--generic-only'], { cwd: dir }).status).toBe(3)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
