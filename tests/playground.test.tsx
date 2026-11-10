// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { tierLabel, type LabRun } from '../agent/run-contract'
import { applyChip, defaultExpected, describeExpected, playgroundBlocks, textsWith, type BlockId, type ExpectedOutcome } from '../content/block-hints'
import { parseAll, parseBlock, stripComments } from '../src/playground/parse'
import { createPlaygroundRunner, loadAgentRuntime, promptFor, type AgentRuntime } from '../src/playground/runner'
import { Playground } from '../src/playground/Playground'
import type { EditorLoader } from '../src/playground/BlockEditor'

vi.mock('../src/announce', () => ({ announce: vi.fn() }))
const { announce } = await import('../src/announce')

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.mocked(announce).mockClear()
  try { window.localStorage.clear() } catch { /* storage may be stubbed */ }
})

/** Keeps every block on the plain textarea, so tests do not depend on CodeMirror in jsdom. */
const noEditor: EditorLoader = () => new Promise(() => {})
const block = (id: BlockId) => playgroundBlocks.find(b => b.id === id)!
const allChips = playgroundBlocks.flatMap(b => b.chips.map(chip => ({ block: b, chip })))
const stackText = /\bat .+\(|JSON5|SyntaxError|ZodError|Error:|\n\s+at /

/** Tokens of the data lines: quoted strings, words, numbers and punctuation. */
const tokens = (text: string) => stripComments(text).match(/'[^']*'|"[^"]*"|[A-Za-z0-9_.$-]+|[{}[\]:,]/g) ?? []

function checkOutcome(run: LabRun, expected: ExpectedOutcome) {
  expect(run.tier).toBe('simulated')
  expect(tierLabel(run)).toBe('Simulated in your browser')
  if (expected.status === 'ok') {
    expect(run.outcome).toEqual({ status: 'ok' })
    expect(run.finalText).toContain(expected.answerIncludes)
    expect(run.ledger).toHaveLength(1)
  } else {
    expect(run.outcome).toEqual({ status: 'denied', code: expected.code })
    expect(run.events).toContainEqual(expect.objectContaining({ kind: 'gate', decision: 'deny', stage: expected.stage, code: expected.code }))
    expect(run.ledger).toEqual([])
  }
}

describe('playground blocks (content/block-hints.ts)', () => {
  it('has the exact default texts, at most three chips per block, and hints taken from the comments', () => {
    expect(block('caller').defaultText).toBe([
      '// WHO IS ASKING. In a real app this comes from sign-in, never from the model.',
      "// Try one word: 'rider-support' -> 'guest' or 'operations-analyst'. Or readsLeft: 0.",
      "{ role: 'rider-support', readsLeft: 1 }",
    ].join('\n'))
    expect(block('requests').defaultText).toBe([
      '// A real model chooses this. Here you do, so every run is repeatable.',
      "// Try: scope 'public' -> 'internal'; metricId -> 'payroll-cost'; period -> '2026-Q3'.",
      "[{ tool: 'getSyntheticMetric',",
      "   input: { metricId: 'trips-completed', period: '2026-Q1', scope: 'public' } }]",
    ].join('\n'))
    for (const b of playgroundBlocks) {
      expect(b.chips.length).toBeLessThanOrEqual(3)
      expect(b.hints).toHaveLength(2)
    }
  })

  it.each(allChips.map(({ block: b, chip }) => [b.id, chip.id, b, chip] as const))('chip %s/%s differs from its default by exactly one token', (_b, _c, b, chip) => {
    const before = tokens(b.defaultText), after = tokens(applyChip(b, chip))
    expect(after).toHaveLength(before.length)
    expect(after.filter((token, i) => token !== before[i])).toHaveLength(1)
    // The comment lines stay exactly as written.
    expect(applyChip(b, chip).split('\n').filter(l => l.startsWith('//'))).toEqual(b.defaultText.split('\n').filter(l => l.startsWith('//')))
  })
})

describe('parse (src/playground/parse.ts)', () => {
  it('accepts both defaults and every chip', () => {
    expect(parseAll(textsWith())).toEqual({
      ok: true,
      values: {
        caller: { role: 'rider-support', readsLeft: 1 },
        requests: [{ tool: 'getSyntheticMetric', input: { metricId: 'trips-completed', period: '2026-Q1', scope: 'public' } }],
      },
    })
    for (const { block: b, chip } of allChips) expect(parseBlock(b.id, applyChip(b, chip)).ok, chip.id).toBe(true)
  })

  it('leaves the role value and the tool input for the gate to judge', () => {
    expect(parseBlock('caller', "{ role: 'root', readsLeft: 3 }")).toEqual({ ok: true, value: { role: 'root', readsLeft: 3 } })
    expect(parseBlock('requests', "[{ tool: 'deleteMetric', input: { anything: [1, 'two'] } }]").ok).toBe(true)
  })

  it('reports a missing closing brace on the line the visitor sees', () => {
    const text = block('caller').defaultText.replace(' }', '')
    const result = parseBlock('caller', text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.line).toBe(3)
      expect(result.error.message).toMatch(/^Line 3: expected a closing brace/)
    }
  })

  const junk: [string, BlockId, string, RegExp][] = [
    ['unquoted word', 'caller', '{ role: guest, readsLeft: 1 }', /^Line 1: “guest” needs quotes/],
    ['a function call', 'caller', '// hi\n{ role: getRole(), readsLeft: 1 }', /^Line 2: .*looks like code/],
    ['an assignment', 'caller', "{ role: (globalThis.pwned = 'yes'), readsLeft: 1 }", /^Line 1: /],
    ['a template string', 'caller', '{ role: `guest`, readsLeft: 1 }', /^Line 1: .*looks like code/],
    ['wrong bracket', 'caller', "{ role: 'guest', readsLeft: 1 ]", /^Line 1: expected a closing brace/],
    ['open quote', 'caller', "{ role: 'guest, readsLeft: 1 }", /^Line 1: a text value is missing its closing quote/],
    ['readsLeft too high', 'caller', "{ role: 'guest', readsLeft: 9 }", /^Line 1: readsLeft must be a whole number from 0 to 3/],
    ['readsLeft not whole', 'caller', "{ role: 'guest', readsLeft: 0.5 }", /^Line 1: readsLeft must be a whole number/],
    ['extra field', 'caller', "{ role: 'guest', readsLeft: 1, admin: true }", /^Line 1: only role and readsLeft belong here/],
    ['NaN', 'caller', "{ role: 'guest', readsLeft: NaN }", /^Line 1: numbers must be ordinary numbers/],
    ['prototype key', 'requests', "[{ tool: 'x', input: { __proto__: { admin: true } } }]", /cannot be used as a name/],
    ['empty block', 'caller', '// only a comment\n   ', /^This block is empty/],
    ['not a list', 'requests', "{ tool: 'x', input: 1 }", /^Line 1: this block must be a list/],
    ['too many requests', 'requests', "[{tool:'a',input:1},{tool:'b',input:1},{tool:'c',input:1},\n{tool:'d',input:1}]", /^Line 2: one run takes at most three requests/],
    ['missing input', 'requests', "[{ tool: 'getSyntheticMetric' }]", /^Line 1: request 1 needs an input/],
    ['two values', 'caller', "{ role: 'a', readsLeft: 1 } { }", /^Line 1: unexpected/],
  ]
  it.each(junk)('rejects %s with a friendly, line-numbered message and no stack text', (_name, id, text, message) => {
    const result = parseBlock(id, text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(message)
      expect(result.error.message).not.toMatch(stackText)
    }
    expect((globalThis as { pwned?: unknown }).pwned).toBeUndefined()
  })

  it('keeps // inside quoted text and ignores block comments', () => {
    expect(parseBlock('caller', "/* note */ { role: 'http://x', readsLeft: 1 } // trailing")).toEqual({ ok: true, value: { role: 'http://x', readsLeft: 1 } })
  })
})

describe('runner (src/playground/runner.ts) with the real Strands loop and gate', () => {
  const cases: [string, Partial<Record<BlockId, string>>, ExpectedOutcome][] = [
    ['defaults', {}, defaultExpected],
    ...allChips.map(({ block: b, chip }) => [`${b.id}/${chip.id}`, { [b.id]: chip.id }, chip.expected] as [string, Partial<Record<BlockId, string>>, ExpectedOutcome]),
    ...playgroundBlocks.flatMap(b => b.combos.map(combo => [combo.label, combo.chips, combo.expected] as [string, Partial<Record<BlockId, string>>, ExpectedOutcome])),
  ]
  it.each(cases)('%s runs to its expected outcome', async (_name, chips, expected) => {
    const parsed = parseAll(textsWith(chips))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const outcome = await createPlaygroundRunner().run(parsed.values)
    expect(outcome.kind).toBe('run')
    if (outcome.kind === 'run') checkOutcome(outcome.run, expected)
  })

  it('builds the run from trusted app state: visitor caller, simulated tier, turn and read limits', async () => {
    const real = await loadAgentRuntime()
    const seen: Parameters<AgentRuntime['runGoverned']>[0][] = []
    const runner = createPlaygroundRunner(async () => ({ ...real, runGoverned: options => { seen.push(options); return real.runGoverned(options) } }))
    const parsed = parseAll(textsWith({ caller: 'reads-0' }))
    if (!parsed.ok) throw Error('defaults must parse')
    await runner.run(parsed.values)
    await runner.run(parsed.values)
    expect(seen[0]).toMatchObject({ caller: { id: 'visitor', role: 'rider-support' }, tier: 'simulated', limits: { turns: 2, reads: 0 } })
    expect(seen[0].prompt).toBe('What was trips-completed in 2026-Q1?')
    expect(seen[0].runId).not.toBe(seen[1].runId)
    expect(promptFor([{ tool: 'a', input: 1 }, { tool: 'b', input: 1 }, { tool: 'c', input: 1 }])).toBe('Use the a tool. Use the b tool. Use the c tool.')
  })

  it('discards a stale run: the first of two runs resolves later and is ignored', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let calls = 0
    const runner = createPlaygroundRunner(async () => ({
      ...real,
      runGoverned: async options => { if (++calls === 1) await held; return real.runGoverned(options) },
    }))
    const parsed = parseAll(textsWith())
    if (!parsed.ok) throw Error('defaults must parse')
    const first = runner.run(parsed.values)
    await new Promise(resolve => setTimeout(resolve, 0))
    const second = await runner.run(parsed.values)
    release()
    expect(second.kind).toBe('run')
    expect(await first).toEqual({ kind: 'stale' })
  })

  it('cancel stops the newest run, even one still waiting for the runtime', async () => {
    const runner = createPlaygroundRunner()
    const parsed = parseAll(textsWith())
    if (!parsed.ok) throw Error('defaults must parse')
    const pending = runner.run(parsed.values)
    runner.cancel()
    const outcome = await pending
    expect(outcome.kind).toBe('run')
    if (outcome.kind === 'run') {
      expect(outcome.run.outcome).toEqual({ status: 'cancelled', code: 'CANCELLED' })
      expect(outcome.run.ledger).toEqual([])
    }
  })

  it('invalidate makes a run in flight stale, even one still waiting for the runtime', async () => {
    const runner = createPlaygroundRunner()
    const parsed = parseAll(textsWith())
    if (!parsed.ok) throw Error('defaults must parse')
    const pending = runner.run(parsed.values)
    runner.invalidate()
    expect(await pending).toEqual({ kind: 'stale' })
    expect((await runner.run(parsed.values)).kind).toBe('run')
  })

  it('reports a runtime that fails to load as an error and retries the load next time', async () => {
    let attempts = 0
    const real = await loadAgentRuntime()
    const runner = createPlaygroundRunner(async () => { if (++attempts === 1) throw Error('offline'); return real })
    const parsed = parseAll(textsWith())
    if (!parsed.ok) throw Error('defaults must parse')
    expect(await runner.run(parsed.values)).toEqual({ kind: 'error' })
    expect((await runner.run(parsed.values)).kind).toBe('run')
  })
})

describe('<Playground />', () => {
  /** The outcome word in the result card only; the presets table shows outcome badges too. */
  const RESULT_WORD = { selector: '.pg-result .lab-outcome__word' }
  const editorFor = (title: string) => screen.getByRole('textbox', { name: `${title} (editable data)` }) as HTMLTextAreaElement

  it('renders the section, both blocks, hints and chips; Run with defaults shows Allowed, 41250 and one tier label', async () => {
    const onRun = vi.fn()
    render(<Playground onRun={onRun} loadEditor={noEditor} />)
    const section = screen.getByRole('region', { name: 'Change one word. Run the real loop.' })
    expect(within(section).getByRole('group', { name: 'Who is asking' })).toBeTruthy()
    expect(within(section).getByRole('group', { name: 'What the simulated model asks for' })).toBeTruthy()
    const caller = editorFor('Who is asking')
    expect(caller.value).toBe(block('caller').defaultText)
    for (const id of caller.getAttribute('aria-describedby')!.split(' ')) expect(document.getElementById(id), id).toBeTruthy()
    expect(document.getElementById(caller.getAttribute('aria-describedby')!.split(' ')[0])!.textContent).toContain('In a real app this comes from sign-in')
    expect(screen.getAllByRole('button', { name: /^Try / })).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByText('Allowed', RESULT_WORD)
    expect(screen.getAllByText(/41250/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Simulated in your browser')).toHaveLength(1)
    expect(announce).toHaveBeenCalledWith('Running…')
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Allowed\. .*41250/))
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(onRun.mock.calls[0][0]).toMatchObject({ tier: 'simulated', outcome: { status: 'ok' }, caller: { role: 'rider-support' } })
  })

  it('shows a refusal neutrally with the operator view and what the model was told', async () => {
    render(<Playground loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try guest' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByText('Refused', RESULT_WORD)
    expect(screen.getByText('Stopped at caller · TOOL_NOT_GRANTED')).toBeTruthy()
    expect(screen.getByText('A production app would show people one neutral message, so the cause cannot leak.')).toBeTruthy()
    expect(screen.getByText('What the model was told')).toBeTruthy()
    expect(screen.getAllByText('Your role cannot use that tool.').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Simulated in your browser')).toHaveLength(1)
  })

  it('activating a chip sets the block text and calls announce()', () => {
    render(<Playground loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try guest' }))
    expect(editorFor('Who is asking').value).toBe(applyChip(block('caller'), block('caller').chips[0]))
    expect(announce).toHaveBeenCalledWith('Role set to guest')
    fireEvent.click(screen.getByRole('button', { name: 'Try 2026-Q3' }))
    expect(announce).toHaveBeenCalledWith('Period set to 2026-Q3')
  })

  it('a parse error keeps the draft, sets aria-invalid, focuses the error summary and links to the block', async () => {
    render(<Playground loadEditor={noEditor} />)
    const caller = editorFor('Who is asking')
    const draft = "{ role: 'guest', readsLeft: 1"
    fireEvent.change(caller, { target: { value: draft } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const title = await screen.findByText('Fix 1 problem before running')
    const summary = title.closest('.pg-error-summary') as HTMLElement
    await waitFor(() => expect(document.activeElement).toBe(summary))
    expect(caller.value).toBe(draft)
    expect(caller.getAttribute('aria-invalid')).toBe('true')
    expect(editorFor('What the simulated model asks for').getAttribute('aria-invalid')).toBeNull()
    const link = within(summary).getByRole('link', { name: /Who is asking: Line 1: expected a closing brace/ })
    expect(link.getAttribute('href')).toBe('#' + caller.id)
    fireEvent.click(link)
    expect(document.activeElement).toBe(caller)
    expect(screen.queryByText('Simulated in your browser')).toBeNull()
    expect(announce).toHaveBeenCalledWith('Nothing ran. 1 block needs fixing.')

    // Fixing the text clears the error as the visitor types.
    fireEvent.change(caller, { target: { value: draft + ' }' } })
    expect(caller.getAttribute('aria-invalid')).toBeNull()
  })

  it('Ctrl+Enter inside an editor runs', async () => {
    render(<Playground loadEditor={noEditor} />)
    fireEvent.keyDown(editorFor('What the simulated model asks for'), { key: 'Enter', ctrlKey: true })
    await screen.findByText('Allowed', RESULT_WORD)
  })

  it('a stale run’s result never replaces a newer one', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let calls = 0
    const runner = createPlaygroundRunner(async () => ({
      ...real,
      runGoverned: async options => { if (++calls === 1) await held; return real.runGoverned(options) },
    }))
    const onRun = vi.fn()
    render(<Playground onRun={onRun} runner={runner} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try guest' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' })) // first: guest, held back
    await waitFor(() => expect(calls).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Reset this block: Who is asking' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' })) // second: defaults
    await screen.findByText('Allowed', RESULT_WORD)
    await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getByText('Allowed', RESULT_WORD)).toBeTruthy()
    expect(screen.queryByText('Refused', RESULT_WORD)).toBeNull()
    expect(screen.queryByText('Cancelled', RESULT_WORD)).toBeNull()
    expect(onRun).toHaveBeenCalledTimes(1)
    expect(onRun.mock.calls[0][0].caller).toEqual({ role: 'rider-support' })
  })

  it('Cancel while running shows Cancelled and offers Retry', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const runner = createPlaygroundRunner(async () => ({ ...real, runGoverned: async options => { await held; return real.runGoverned(options) } }))
    render(<Playground runner={runner} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    release()
    await screen.findByText('Cancelled', RESULT_WORD)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(announce).toHaveBeenCalledWith('Cancelled. The run was stopped before it finished.')
  })

  it('keyboard focus stays on the control after Cancel and after Retry', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const runner = createPlaygroundRunner(async () => ({ ...real, runGoverned: async options => { await held; return real.runGoverned(options) } }))
    render(<Playground runner={runner} loadEditor={noEditor} />)
    const slot = screen.getByRole('button', { name: 'Cancel' })
    expect(slot.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(slot) // inactive: nothing happens
    expect(screen.queryByText('Running…')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(slot.getAttribute('aria-disabled')).toBeNull()
    slot.focus()
    fireEvent.click(slot)
    await act(async () => { release(); await held })
    await screen.findByText('Cancelled', RESULT_WORD)
    expect(slot.isConnected).toBe(true)
    expect(document.activeElement).toBe(slot)
    expect(slot.textContent).toContain('Retry')

    fireEvent.click(slot) // Retry: the runtime is no longer held back, so this run finishes
    expect(document.activeElement).toBe(slot)
    await screen.findByText('Allowed', RESULT_WORD)
    expect(document.activeElement).toBe(slot)
    expect(slot.getAttribute('aria-disabled')).toBe('true')
    expect(slot.textContent).toContain('Cancel')
  })

  it('a parse error while an earlier run is still going discards that run', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let calls = 0
    const runner = createPlaygroundRunner(async () => ({ ...real, runGoverned: async options => { calls++; await held; return real.runGoverned(options) } }))
    const onRun = vi.fn()
    render(<Playground onRun={onRun} runner={runner} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(calls).toBe(1))
    const caller = editorFor('Who is asking')
    fireEvent.change(caller, { target: { value: '{ role: guest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByText('Fix 1 problem before running')
    await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getByText('Fix 1 problem before running')).toBeTruthy()
    expect(screen.queryByText('Allowed', RESULT_WORD)).toBeNull()
    expect(screen.queryByText('Cancelled', RESULT_WORD)).toBeNull()
    expect(screen.queryByText('Simulated in your browser')).toBeNull()
    expect(onRun).not.toHaveBeenCalled()
    expect(document.querySelector('.pg-status')!.textContent).toBe('Nothing ran. 1 block needs fixing.')
    expect(caller.value).toBe('{ role: guest')
    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('a runtime that cannot load leaves an error status and Retry, never raw error text', async () => {
    const runner = createPlaygroundRunner(async () => { throw Error('chunk failed at /assets/x.js') })
    render(<Playground runner={runner} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByText(/The run could not finish/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/chunk failed|\/assets\//)
  })

  it('Reset restores only its own block', () => {
    render(<Playground loadEditor={noEditor} />)
    fireEvent.change(editorFor('Who is asking'), { target: { value: "{ role: 'guest', readsLeft: 0 }" } })
    fireEvent.change(editorFor('What the simulated model asks for'), { target: { value: '[]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset this block: What the simulated model asks for' }))
    expect(editorFor('What the simulated model asks for').value).toBe(block('requests').defaultText)
    expect(editorFor('Who is asking').value).toBe("{ role: 'guest', readsLeft: 0 }")
  })

  it('the plain-text toggle is remembered, and survives a localStorage that throws', () => {
    const { unmount } = render(<Playground loadEditor={noEditor} />)
    const toggle = screen.getByRole('button', { name: 'Plain text editor' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    unmount()
    render(<Playground loadEditor={noEditor} />)
    expect(screen.getByRole('button', { name: 'Plain text editor' }).getAttribute('aria-pressed')).toBe('true')
    cleanup()

    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    try {
      render(<Playground loadEditor={noEditor} />)
      const blocked = screen.getByRole('button', { name: 'Plain text editor' })
      expect(blocked.getAttribute('aria-pressed')).toBe('false')
      fireEvent.click(blocked)
      expect(blocked.getAttribute('aria-pressed')).toBe('true')
      expect(editorFor('Who is asking').value).toBe(block('caller').defaultText)
    } finally {
      spy.mockRestore()
    }
  })

  it('upgrades to CodeMirror when it loads, with label, description and no Tab capture', async () => {
    render(<Playground />)
    const host = await waitFor(() => {
      const found = document.querySelector('[data-editor="codemirror"] .cm-content')
      expect(found).toBeTruthy()
      return found as HTMLElement
    }, { timeout: 5000 })
    expect(host.getAttribute('aria-label')).toMatch(/\(editable data\)$/)
    expect(host.getAttribute('aria-describedby')!.split(' ').length).toBe(2)
    expect(host.getAttribute('aria-keyshortcuts')).toBe('Control+Enter Meta+Enter')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    host.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
  })

  it('keeps the textarea when the visitor focuses it before CodeMirror arrives, then upgrades on blur', async () => {
    let resolve!: (m: Awaited<ReturnType<EditorLoader>>) => void
    const pending = new Promise<Awaited<ReturnType<EditorLoader>>>(r => { resolve = r })
    render(<Playground loadEditor={() => pending} />)
    const caller = editorFor('Who is asking')
    caller.focus()
    fireEvent.change(caller, { target: { value: "{ role: 'guest', readsLeft: 1 }" } })
    await act(async () => { resolve(await import('../src/playground/codemirror')) })
    expect(document.activeElement).toBe(caller)
    expect(caller.isConnected).toBe(true)
    act(() => { caller.blur(); fireEvent.blur(caller) })
    await waitFor(() => expect(document.querySelectorAll('[data-editor="codemirror"]').length).toBe(2))
    expect(document.querySelector('[data-editor="codemirror"] .cm-content')!.textContent).toContain("role: 'guest'")
  })
})

describe('playground layout: button ladder, presets table and result card', () => {
  const RESULT_WORD = { selector: '.pg-result .lab-outcome__word' }

  it('Run is the only primary (yellow) control; Cancel, Reset and the toggle use their own rungs', () => {
    render(<Playground loadEditor={noEditor} />)
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run.classList.contains('lab-btn--primary')).toBe(true)
    expect(document.querySelectorAll('.pg .lab-btn--primary')).toHaveLength(1)

    const slot = screen.getByRole('button', { name: 'Cancel' })
    expect(slot.classList.contains('lab-btn--cancel')).toBe(true)
    expect(slot.getAttribute('data-action')).toBe('cancel')
    expect(slot.querySelector('svg.lucide-square')).toBeTruthy()

    for (const b of playgroundBlocks) {
      const reset = screen.getByRole('button', { name: `Reset this block: ${b.title}` })
      expect(reset.classList.contains('lab-btn--tertiary')).toBe(true)
      expect(reset.classList.contains('lab-btn--sm')).toBe(false) // a full 44px target
      expect(reset.querySelector('svg.lucide-rotate-ccw')).toBeTruthy()
    }
    for (const chip of screen.getAllByRole('button', { name: /^Try / })) expect(chip.classList.contains('lab-btn--tertiary')).toBe(true)
  })

  it('the plain-text toggle is one borderless toggle above the blocks, with a Square or SquareCheck icon and aria-pressed', () => {
    render(<Playground loadEditor={noEditor} />)
    const toggle = screen.getByRole('button', { name: 'Plain text editor' })
    expect(toggle.classList.contains('lab-btn--toggle')).toBe(true)
    expect(toggle.closest('.pg-blocks-head')).toBeTruthy()
    expect(toggle.closest('.pg-controls')).toBeNull()
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.querySelector('svg.lucide-square')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.querySelector('svg.lucide-square-check')).toBeTruthy()
    expect(toggle.querySelector('svg.lucide-square')).toBeNull()
    expect(announce).toHaveBeenCalledWith('Plain text editor on')
    expect(screen.getAllByRole('button', { name: 'Plain text editor' })).toHaveLength(1)
  })

  it('after a cancel the slot turns into a neutral Retry (data-action="retry")', async () => {
    const real = await loadAgentRuntime()
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const runner = createPlaygroundRunner(async () => ({ ...real, runGoverned: async options => { await held; return real.runGoverned(options) } }))
    render(<Playground runner={runner} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const slot = screen.getByRole('button', { name: 'Cancel' })
    expect(slot.getAttribute('data-action')).toBe('cancel')
    fireEvent.click(slot)
    release()
    await screen.findByText('Cancelled', RESULT_WORD)
    expect(slot.getAttribute('data-action')).toBe('retry')
    expect(slot.querySelector('svg.lucide-rotate-ccw')).toBeTruthy()
  })

  it('every Expected cell shows an outcome badge with the reason below, and still reads exactly as describeExpected()', () => {
    render(<Playground loadEditor={noEditor} />)
    const reasonOf = (e: ExpectedOutcome) => e.status === 'ok' ? e.summary : `${e.stage} · ${e.code}`
    for (const b of playgroundBlocks) {
      const table = within(screen.getByRole('group', { name: b.title })).getByRole('table')
      const rows = within(table).getAllByRole('row').slice(1)
      const expected = [defaultExpected, ...b.chips.map(c => c.expected), ...b.combos.map(c => c.expected)]
      expect(rows).toHaveLength(expected.length)
      rows.forEach((row, i) => {
        const cell = row.querySelectorAll('td')[1]
        expect(cell.textContent).toBe(describeExpected(expected[i]))
        const badge = cell.querySelector('.lab-outcome')!
        expect(badge.getAttribute('data-status')).toBe(expected[i].status)
        // A summary is plain language; only the stage and reason code are set as code.
        const reason = cell.querySelector(expected[i].status === 'ok' ? 'span.pg-summary' : 'code.pg-reason')!
        expect(reason.textContent).toBe(reasonOf(expected[i]))
        if (expected[i].status === 'ok') expect(cell.querySelector('code')).toBeNull()
        // The reason comes after the badge, never inside it.
        expect(badge.contains(reason)).toBe(false)
        expect(badge.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      })
      // No yellow in the table: only Run is primary.
      expect(table.querySelector('.lab-btn--primary')).toBeNull()
    }
  })

  it('the result card shows the honest tier label (TierLabel from tierLabel(run)) and an outcome badge in its head band', async () => {
    const onRun = vi.fn()
    render(<Playground onRun={onRun} loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByText('Allowed', RESULT_WORD)
    const run = onRun.mock.calls[0][0] as LabRun
    const head = document.querySelector('.pg-result-head') as HTMLElement
    expect(within(head).getByRole('heading', { level: 3, name: 'Result' })).toBeTruthy()
    const tier = head.querySelector('.lab-tier')!
    expect(tier.getAttribute('data-tier')).toBe('simulated')
    expect(tier.textContent).toBe(tierLabel(run))
    expect(tier.textContent).not.toMatch(/live/i)
    expect(head.querySelector('.lab-outcome')!.getAttribute('data-status')).toBe('ok')
    expect(document.querySelector('.pg-tier')).toBeNull() // the v1.0 chip is gone
    expect(screen.getByRole('group', { name: 'Result' })).toBeTruthy()
  })

  it('never adds a live region of its own', async () => {
    render(<Playground loadEditor={noEditor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try guest' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByText('Refused', RESULT_WORD)
    expect(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')).toHaveLength(0)
  })
})

describe('CodeMirror token theme (src/playground/codemirror.ts)', () => {
  // WCAG relative luminance, read straight from tokens.css, so the editor's colours stay tied to the tokens.
  const channel = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255) }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const css = readFileSync(join(process.cwd(), 'src/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const block = (selector: string) => { const at = css.indexOf(selector); return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at)) }
  const vars = (body: string): Record<string, string> => Object.fromEntries([...body.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)].map(m => [m[1], m[2]]))
  const light = vars(block(':root {'))
  const themes = { light, dark: { ...light, ...vars(block(':root[data-theme="dark"] {')) } }

  it('colours comments, strings and keys with CSS variables only, each at least 4.5:1 on --surface-raised in both themes', async () => {
    const { tokenStyle } = await import('../src/playground/codemirror')
    const rules = tokenStyle.module!.getRules()
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    const used = [...new Set([...rules.matchAll(/color:\s*var\(--([a-z0-9-]+)\)/g)].map(m => m[1]))]
    expect(used).toEqual(expect.arrayContaining(['ink-muted', 'text-blue', 'text-magenta']))
    for (const [name, tokens] of Object.entries(themes)) {
      for (const token of used) {
        expect(tokens[token], `${name}: --${token}`).toBeTruthy()
        expect(ratio(tokens[token], tokens['surface-raised']), `${name}: --${token} on --surface-raised`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('highlights the default block text: comment, string and key spans get distinct classes from the token theme', async () => {
    render(<Playground />)
    const content = await waitFor(() => {
      const found = document.querySelector('[data-editor="codemirror"] .cm-content')
      expect(found).toBeTruthy()
      return found as HTMLElement
    }, { timeout: 5000 })
    const { tokenStyle } = await import('../src/playground/codemirror')
    const rules = tokenStyle.module!.getRules()
    const classOf = (text: string) => [...content.querySelectorAll('span')].find(s => s.textContent === text)?.className ?? ''
    const comment = classOf(content.querySelector('.cm-line')!.textContent!)
    const string = classOf("'rider-support'")
    const key = classOf('role')
    for (const c of [comment, string, key]) expect(c, 'a highlighted span').not.toBe('')
    expect(new Set([comment, string, key]).size).toBe(3)
    expect(classOf('readsLeft'), 'every name before a colon is a key').toBe(key)
    for (const c of [comment, string, key]) expect(rules).toContain('.' + c.split(' ')[0])
  })
})
