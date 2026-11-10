import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { Agent, ModelError, type Message } from '@strands-agents/sdk'
import { pairs, workshop } from '../examples/pairs'
import { gotchas } from '../examples/gotchas'
import { sourceOf } from '../examples/sources'
import { ScriptedModel } from '../examples/ts/scripted-model'
import { lookupCustomer, toolDemo } from '../examples/ts/tool'
import { budgetDemo } from '../examples/ts/budget-hook'
import { invokeOnce, streamEvents } from '../examples/ts/invoke-stream'
import { steeringDemo } from '../examples/ts/steering'
import { tokenize } from '../src/lessons/highlight'

const root = new URL('..', import.meta.url).pathname
const sdkRoot = join(root, 'node_modules/@strands-agents/sdk')
const pyDir = join(root, 'examples/py')
const pyFiles = readdirSync(pyDir).filter(name => name.endsWith('.py'))

// Every tool result in the conversation, in order: which tool, whether it ran, and what it said.
function toolResults(messages: Message[]) {
  const names = new Map<string, string>()
  const results: { name: string; status: string; text: string }[] = []
  for (const message of messages) for (const block of message.content) {
    if (block.type === 'toolUseBlock') names.set(block.toolUseId, block.name)
    if (block.type === 'toolResultBlock') {
      const text = block.content.flatMap(part => (part.type === 'textBlock' ? [part.text] : [])).join(' ')
      results.push({ name: names.get(block.toolUseId) ?? '?', status: block.status, text })
    }
  }
  return results
}

describe('TypeScript examples run with a scripted model', () => {
  it('runs the typed tool and returns its result to the model', async () => {
    const { agent, result } = await toolDemo()
    expect(result.stopReason).toBe('endTurn')
    expect(toolResults(agent.messages)).toEqual([{ name: 'lookup_customer', status: 'success', text: 'Customer: Sarah Johnson\nAccount Status: active' }])
    expect(result.lastMessage.content.find(b => b.type === 'textBlock')?.text).toContain('Account Status: active')
  })

  it('rejects tool input that does not match the Zod schema', async () => {
    const model = new ScriptedModel([
      { toolUse: { name: 'lookup_customer', input: { customer_id: 1001 } } },
      { text: '{result}' },
    ])
    const agent = new Agent({ model, tools: [lookupCustomer], printer: false })
    await agent.invoke('Look up customer 1001.')
    const [only] = toolResults(agent.messages)
    expect(only).toMatchObject({ name: 'lookup_customer', status: 'error' })
  })

  it('the budget hook cancels the second call once the budget is spent', async () => {
    const { agent, result } = await budgetDemo()
    expect(result.stopReason).toBe('endTurn')
    const results = toolResults(agent.messages)
    expect(results.map(r => r.status)).toEqual(['success', 'error'])
    expect(results[0].text).toContain('Sarah Johnson')
    expect(results[1].text).toContain("'lookup_customer' hit the 1-call limit")
    expect(results[1].text).not.toContain('Mike Chen') // the tool never ran for the second customer
  })

  it('invoke returns the final text and stream yields events as they happen', async () => {
    expect(await invokeOnce()).toBe('Your account is active.')
    const { seen, text } = await streamEvents()
    expect(text).toBe('Your account is active.')
    expect(seen).toContain('beforeToolCallEvent')
    expect(seen).toContain('modelStreamUpdateEvent')
    expect(seen.at(-1)).toBe('agentResultEvent')
  })

  it('the steering handler guides an early refund, then lets it through after the lookup', async () => {
    const { agent, result } = await steeringDemo()
    expect(result.stopReason).toBe('endTurn')
    const results = toolResults(agent.messages)
    expect(results.map(r => `${r.name}:${r.status}`)).toEqual(['process_refund:error', 'lookup_customer:success', 'process_refund:success'])
    expect(results[0].text).toContain('You must look up the customer with lookup_customer before processing a refund.')
    expect(results[2].text).toBe('Refund of $79.99 issued for ORD-5521.')
  })

  it('malformed tool-call JSON from a provider ends the run with a ModelError', async () => {
    const model = new ScriptedModel([{ toolUse: { name: 'lookup_customer', input: '{"customer_id": "C-10' } }])
    const agent = new Agent({ model, tools: [lookupCustomer], printer: false })
    await expect(agent.invoke('Look me up.')).rejects.toBeInstanceOf(ModelError)
  })
})

describe('Python snippets', () => {
  it('there is one Python file per pair and nothing else', () => {
    expect(pyFiles.sort()).toEqual(pairs.map(p => p.pyFile.replace('examples/py/', '')).sort())
  })

  it('every Python file names the pinned workshop commit, its original path and MIT-0', () => {
    expect(workshop.commit).toMatch(/^[0-9a-f]{40}$/)
    for (const name of pyFiles) {
      const header = readFileSync(join(pyDir, name), 'utf8').split('\n').slice(0, 3).join('\n')
      expect(header, name).toContain(`# Source: ${workshop.repo}/blob/${workshop.commit}/samples/`)
      expect(header, name).toMatch(/# Original file: samples\/\S+\.py/)
      expect(header, name).toContain('MIT-0')
    }
  })

  it('every Python file is short (25 lines or fewer)', () => {
    for (const name of pyFiles) {
      expect(readFileSync(join(pyDir, name), 'utf8').trimEnd().split('\n').length, name).toBeLessThanOrEqual(25)
    }
  })

  const python = spawnSync('python3', ['--version'], { encoding: 'utf8' })
  const hasPython = python.status === 0
  if (!hasPython) console.warn('NOTICE: python3 is not available, so the Python syntax check was skipped.')
  it.skipIf(!hasPython)('every Python file compiles (python3 -m py_compile)', () => {
    // Compile copies in a temporary folder so no __pycache__ lands in the repository.
    const dir = mkdtempSync(join(tmpdir(), 'lab-py-'))
    try {
      for (const name of pyFiles) {
        copyFileSync(join(pyDir, name), join(dir, name))
        const result = spawnSync('python3', ['-I', '-m', 'py_compile', join(dir, name)], { encoding: 'utf8' })
        expect(result.status, `${name}: ${result.stderr}`).toBe(0)
      }
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('pair metadata', () => {
  it('points at files that exist and whose source is available for display', () => {
    expect(new Set(pairs.map(p => p.id)).size).toBe(pairs.length)
    for (const pair of pairs) {
      for (const file of [pair.tsFile, pair.pyFile]) {
        expect(existsSync(join(root, file)), file).toBe(true)
        expect(sourceOf(file)).toBe(readFileSync(join(root, file), 'utf8'))
      }
      expect(pair.whatChanges.trim().split(/(?<=[.!?])\s+/), pair.id).toHaveLength(1)
    }
  })

  it('marks a pair executed only when this file runs its TypeScript example', () => {
    const thisFile = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const pair of pairs.filter(p => p.verified === 'executed')) {
      expect(thisFile, pair.id).toContain(`from '../${pair.tsFile.replace(/\.ts$/, '')}'`)
    }
  })
})

describe('gotchas', () => {
  it('each gotcha is still true of the installed SDK', () => {
    expect(gotchas.length).toBeGreaterThan(0)
    for (const gotcha of gotchas) {
      const text = readFileSync(join(sdkRoot, gotcha.evidence.file), 'utf8')
      expect(new RegExp(gotcha.evidence.matches).test(text), `${gotcha.id}: ${gotcha.evidence.file}`).toBe(true)
      if (gotcha.evidence.lacks) expect(text, gotcha.id).not.toContain(gotcha.evidence.lacks)
      for (const extra of gotcha.evidence.also ?? []) {
        const extraText = readFileSync(join(sdkRoot, extra.file), 'utf8')
        expect(new RegExp(extra.matches).test(extraText), `${gotcha.id}: ${extra.file}`).toBe(true)
      }
    }
  })

  it('the installed SDK is the version the examples were written for', () => {
    expect(JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8')).version).toBe('1.24.0')
  })
})

describe('code colouring on the page', () => {
  it('every listing keeps its exact text when split into coloured tokens', () => {
    for (const pair of pairs) {
      for (const [file, language] of [[pair.pyFile, 'python'], [pair.tsFile, 'typescript']] as const) {
        const tokens = tokenize(sourceOf(file), language)
        expect(tokens.map(t => t.text).join(''), file).toBe(sourceOf(file))
        expect(tokens.some(t => t.kind === 'keyword'), file).toBe(true)
      }
    }
  })

  it('marks comments, strings and keywords, and leaves names alone', () => {
    expect(tokenize('def f(x):  # note\n    return "a#b"', 'python')).toEqual([
      { text: 'def', kind: 'keyword' }, { text: ' f(x):  ' }, { text: '# note', kind: 'comment' },
      { text: '\n    ' }, { text: 'return', kind: 'keyword' }, { text: ' ' }, { text: '"a#b"', kind: 'string' },
    ])
    expect(tokenize("const url = 'http://x' // why\nreturned", 'typescript')).toEqual([
      { text: 'const', kind: 'keyword' }, { text: ' url = ' }, { text: "'http://x'", kind: 'string' },
      { text: ' ' }, { text: '// why', kind: 'comment' }, { text: '\nreturned' },
    ])
    expect(tokenize('print(f"{name}") """doc\nmore"""', 'python').filter(t => t.kind === 'string').map(t => t.text)).toEqual(['f"{name}"', '"""doc\nmore"""'])
  })
})
