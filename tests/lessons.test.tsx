// @vitest-environment jsdom
// Lesson panels and their content: plain-language limits, honest labels, real paths and sources,
// and commands that match the README.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lessons, modelText, tierLabel, type LabRun } from '../agent/run-contract'
import { gate } from '../governance/policy'
import { lessonContent, lessonList } from '../content/lessons'
import { concepts } from '../content/hints'
import { links } from '../content/links'
import { pairs } from '../examples/pairs'
import { gotchas } from '../examples/gotchas'
import { sourceOf } from '../examples/sources'
import fixtures from '../fixtures/executions.json'

vi.mock('../src/announce', () => ({ announce: vi.fn() }))
import { announce } from '../src/announce'
import { TranslationPanel, verifiedBadge } from '../src/lessons/TranslationPanel'
import { Elsewhere, inLabLabel } from '../src/lessons/Elsewhere'
import { RunForReal, cloneUrl, fallbackCloneUrl, runCommands, liveCommands, noKeysSentence } from '../src/lessons/RunForReal'
import { CompareModels, liveComparisons } from '../src/lessons/CompareModels'
import { LessonGuide } from '../src/lessons/LessonGuide'

// jsdom gives import.meta.url a web origin, so resolve from the project root vitest runs in.
const root = process.cwd()
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const words = (text: string) => text.trim().split(/\s+/).length

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => { cleanup(); vi.mocked(announce).mockClear() })

describe('lesson content', () => {
  it('covers both lessons', () => {
    expect(Object.keys(lessonContent).sort()).toEqual([...lessons].sort())
    expect(lessonList.map(l => l.id)).toEqual([...lessons])
  })

  it.each(lessonList)('$id: summary is at most 80 words', lesson => {
    expect(words(lesson.summary)).toBeLessThanOrEqual(80)
  })

  it.each(lessonList)('$id: the prediction prompt is one question', lesson => {
    expect(lesson.prediction.trim().endsWith('?')).toBe(true)
  })

  it.each(lessonList)('$id: two or three steps on each route', lesson => {
    for (const route of [lesson.beginner, lesson.extension]) {
      expect(route.length).toBeGreaterThanOrEqual(2)
      expect(route.length).toBeLessThanOrEqual(3)
    }
  })

  it.each(lessonList)('$id: every code pointer, and every repository path a step names, exists', lesson => {
    expect(lesson.codePointers.length).toBeGreaterThan(0)
    for (const { path } of lesson.codePointers) expect(existsSync(join(root, path)), path).toBe(true)
    const named = [...lesson.extension.join(' ').matchAll(/\b(?:agent|analytics|governance|fixtures|tests|content|examples|src)\/[\w./-]+\.(?:ts|tsx|json)\b/g)].map(m => m[0])
    expect(named.length).toBeGreaterThan(0)
    for (const path of named) expect(existsSync(join(root, path)), path).toBe(true)
  })

  it('the governance extension step says exactly what the gate does for a rider-support caller', () => {
    const step = lessonContent.governance.extension.find(text => text.includes('payroll-cost'))
    expect(step).toContain('rider-support caller')
    expect(step).toContain('"' + modelText.METRIC_ABOVE_SCOPE + '"')
    expect(modelText.UNKNOWN_METRIC).toBe(modelText.METRIC_ABOVE_SCOPE)
    const caller = { id: 'lesson-check', role: 'rider-support' }
    const internal = gate(caller, 'getSyntheticMetric', { metricId: 'payroll-cost', period: '2026-Q1', scope: 'public' }, 1)
    const missing = gate(caller, 'getSyntheticMetric', { metricId: 'no-such-metric', period: '2026-Q1', scope: 'public' }, 1)
    expect(internal).toMatchObject({ decision: 'deny', code: 'METRIC_ABOVE_SCOPE' })
    expect(missing).toMatchObject({ decision: 'deny', code: 'UNKNOWN_METRIC' })
  })

  it('renders a lesson guide with its prediction and code pointers', () => {
    render(<LessonGuide lesson="governance" />)
    expect(screen.getByRole('heading', { level: 2, name: lessonContent.governance.title })).toBeTruthy()
    expect(screen.getByText(lessonContent.governance.prediction)).toBeTruthy()
    expect(screen.getByText('governance/policy.ts')).toBeTruthy()
  })
})

describe('Elsewhere hints', () => {
  const required = ['model-access', 'ai-gateway', 'agent-runtime', 'guardrails', 'tracing', 'agent-sdk', 'mcp-proxying']

  it('includes every required concept once', () => {
    const ids = concepts.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of required) expect(ids).toContain(id)
  })

  it.each(concepts)('$id: every source is https with an access date', c => {
    expect(c.sources.length).toBeGreaterThanOrEqual(1)
    for (const s of c.sources) {
      expect(s.url).toMatch(/^https:\/\/[^\s]+$/)
      expect(s.accessed).toBe('2026-11-09')
    }
  })

  it.each(concepts)('$id: never claims the lab was tested on another platform', c => {
    for (const text of [c.concept, c.plain, c.aws, c.google, c.azure, c.openSource]) expect(text).not.toMatch(/\btested\b/i)
  })

  it('says plainly how guardrails differ from this gate', () => {
    expect(concepts.find(c => c.id === 'guardrails')?.plain).toBe('Guardrails check what is said; this gate checks what the agent is allowed to do.')
  })

  it.each(concepts)('$id: every source has short readable link text, not its address', c => {
    for (const s of c.sources) {
      expect(s.title).toMatch(/^[^:]+: \S/)
      expect(s.title).not.toMatch(/https?:|www\.|\.com\b/)
    }
  })

  it('names only what the lab really uses, each with files that exist', () => {
    const withLab = concepts.filter(c => c.inLab).map(c => c.id).sort()
    expect(withLab).toEqual(['agent-sdk', 'ai-gateway', 'model-access', 'tool-call-gate'])
    for (const c of concepts) for (const path of c.inLab?.paths ?? []) expect(existsSync(join(root, path)), path).toBe(true)
    expect(concepts.find(c => c.id === 'ai-gateway')?.inLab?.text).toMatch(/not been verified/)
    expect(concepts.find(c => c.id === 'tool-call-gate')?.inLab?.paths).toContain('governance/policy.ts')
    expect(concepts.find(c => c.id === 'agent-sdk')?.inLab?.text).toContain('TypeScript SDK 1.24.0')
    expect(concepts.find(c => c.id === 'model-access')?.inLab?.text).toMatch(/^Amazon Bedrock, only through recordings/)
  })

  it('says the AI gateway is a close match except on AWS', () => {
    const gateway = concepts.find(c => c.id === 'ai-gateway')
    expect(gateway?.match).toBe('close')
    expect(gateway?.matchNote).toMatch(/On AWS it is a published pattern and guidance, not a managed product/)
  })

  it('renders every concept with its sources as readable links', () => {
    render(<Elsewhere />)
    expect(screen.getByText('This lab is AWS-flavoured; here is the same idea elsewhere.')).toBeTruthy()
    for (const c of concepts) expect(screen.getByRole('heading', { level: 3, name: c.concept })).toBeTruthy()
    const links = screen.getAllByRole('link')
    for (const s of concepts.flatMap(c => c.sources)) {
      const link = links.find(a => a.getAttribute('href') === s.url)
      expect(link, s.url).toBeTruthy()
      expect(link?.textContent).toBe(s.title)
    }
    expect(screen.getAllByText('Not confirmed').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/\btested\b/i)
  })

  it('heads the AWS column "On AWS" and speaks about the lab only in "What this lab uses" rows', () => {
    render(<Elsewhere />)
    const terms = screen.getAllByRole('term').map(t => t.textContent)
    expect(terms.filter(t => t === 'On AWS')).toHaveLength(concepts.length)
    expect(terms.filter(t => t === inLabLabel)).toHaveLength(concepts.filter(c => c.inLab).length)
    expect(inLabLabel).toBe('What this lab uses')
    expect(document.body.textContent).not.toMatch(/In this lab \(AWS\)/)
    expect(terms.some(t => /lab/i.test(t ?? '') && t !== inLabLabel)).toBe(false)
  })
})

describe('TranslationPanel', () => {
  it('renders one focusable code region per source file, with the file’s text', () => {
    render(<TranslationPanel />)
    const regions = screen.getAllByRole('region').filter(r => /^(Python|TypeScript): /.test(r.getAttribute('aria-label') ?? ''))
    expect(regions).toHaveLength(pairs.length * 2)
    for (const pair of pairs) {
      for (const [lang, file] of [['Python', pair.pyFile], ['TypeScript', pair.tsFile]] as const) {
        const region = screen.getByRole('region', { name: lang + ': ' + file })
        expect(region.getAttribute('tabindex')).toBe('0')
        expect(region.querySelector('pre > code')?.textContent).toBe(sourceOf(file))
      }
    }
  })

  it('shows what changes and the badge that matches each pair’s verification', () => {
    render(<TranslationPanel />)
    for (const pair of pairs) {
      const article = screen.getByRole('article', { name: pair.title })
      expect(within(article).getByText(pair.whatChanges)).toBeTruthy()
      expect(within(article).getByText(verifiedBadge[pair.verified])).toBeTruthy()
      for (const other of Object.values(verifiedBadge).filter(b => b !== verifiedBadge[pair.verified])) {
        expect(within(article).queryByText(other)).toBeNull()
      }
    }
  })

  it('lists every gotcha behind a disclosure and cites the workshop commit', () => {
    render(<TranslationPanel />)
    const trigger = screen.getByRole('button', { name: 'Things that trip up Python developers' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    for (const g of gotchas) expect(screen.getByText(g.title)).toBeTruthy()
    expect(screen.getByText('243a08d788dcb1589023a95d35afbf1270acfd0a')).toBeTruthy()
  })
})

describe('RunForReal', () => {
  // Commands the README does not show yet; see the lane report's open requests. Not asserted until it does.
  // README on main shows them; this check runs again after the merge.
  const all = [...runCommands, ...liveCommands]

  it('every command the panel shows appears in the README verbatim', () => {
    expect(all.length).toBeGreaterThanOrEqual(7)
    for (const command of all) expect(readme, command).toContain(command)
  })

  it('reads the clone address from content/links.ts, with the documented fallback until it is set', () => {
    const project: Record<string, unknown> = links.project
    const fromLinks = typeof project.repositoryClone === 'string' ? project.repositoryClone : null
    expect(cloneUrl()).toBe(fromLinks ?? fallbackCloneUrl)
    expect(runCommands[0]).toBe('git clone ' + cloneUrl())
    if (fromLinks) expect(fromLinks).toBe(fallbackCloneUrl)
  })

  it('records a real run with exactly the README command', () => {
    expect(liveCommands).toContain('AWS_PROFILE=your-profile npm run record:bedrock -- hourly --model novaMicro')
  })

  it('two panels on one page never share an id', () => {
    render(<><RunForReal /><RunForReal /><Elsewhere /><Elsewhere /><TranslationPanel /><LessonGuide lesson="governance" /><LessonGuide lesson="governance" /></>)
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const el of document.querySelectorAll('[aria-labelledby]')) {
      expect(document.getElementById(el.getAttribute('aria-labelledby') ?? '')).toBeTruthy()
    }
  })

  it('shows the commands in order in a copyable block, and announces a copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<RunForReal />)
    const block = screen.getByRole('region', { name: 'Commands to run the lab' })
    expect(block.querySelector('pre')?.textContent).toBe(runCommands.join('\n'))
    expect(screen.getByText(noKeysSentence)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /copy commands to run the lab/i }))
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Commands copied'))
    expect(writeText).toHaveBeenCalledWith(runCommands.join('\n'))
  })

  it('keeps the real-model commands behind a disclosure', () => {
    render(<RunForReal />)
    expect(screen.queryByRole('region', { name: 'Commands for a real model' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'With a real model (your own AWS account)' }))
    const block = screen.getByRole('region', { name: 'Commands for a real model' })
    expect(block.querySelector('pre')?.textContent).toBe(liveCommands.join('\n'))
  })
})

describe('CompareModels', () => {
  const replays = fixtures as unknown as LabRun[]
  const hourly = replays.find(r => r.scenario === 'hourly')!
  const weather = replays.find(r => r.scenario === 'weather')!
  const asLive = (run: LabRun, modelId: string): LabRun => ({
    ...run, runId: run.runId + '-' + modelId, tier: 'live',
    provider: { kind: 'bedrock', modelId, region: 'us-east-1' }, recordedAt: '2026-11-09T00:00:00.000Z',
  })
  const asReplay = (run: LabRun, modelId: string): LabRun => ({
    ...run, runId: run.runId + '-replay-' + modelId, tier: 'replay', provider: { kind: 'scripted', modelId },
  })

  it('renders nothing without live runs', () => {
    expect(render(<CompareModels runs={replays} />).container.innerHTML).toBe('')
    expect(render(<CompareModels runs={[]} />).container.innerHTML).toBe('')
  })

  it('renders nothing for replay runs, even from two different models', () => {
    const runs = [asReplay(hourly, 'model-a'), asReplay(hourly, 'model-b')]
    expect(runs[0].provider.modelId).not.toBe(runs[1].provider.modelId)
    expect(liveComparisons(runs)).toEqual([])
    expect(render(<CompareModels runs={runs} />).container.innerHTML).toBe('')
  })

  it('renders nothing when the two models answered different scenarios', () => {
    expect(hourly.scenario).not.toBe(weather.scenario)
    const runs = [asLive(hourly, 'model-a'), asLive(weather, 'model-b')]
    expect(liveComparisons(runs)).toEqual([])
    expect(render(<CompareModels runs={runs} />).container.innerHTML).toBe('')
  })

  it('renders nothing when the prompt differs, even in the same scenario', () => {
    const runs = [asLive(hourly, 'model-a'), { ...asLive(hourly, 'model-b'), prompt: hourly.prompt + ' Please.' }]
    expect(render(<CompareModels runs={runs} />).container.innerHTML).toBe('')
  })

  it('renders nothing when one model has two runs but no other model does', () => {
    const runs = [asLive(hourly, 'model-a'), { ...asLive(hourly, 'model-a'), runId: 'second-a' }]
    expect(render(<CompareModels runs={runs} />).container.innerHTML).toBe('')
  })

  it('renders nothing when a requested model has no live run for that question', () => {
    const runs = [asLive(hourly, 'model-a'), asLive(hourly, 'model-c')]
    expect(render(<CompareModels runs={runs} models={['model-a', 'model-b']} />).container.innerHTML).toBe('')
  })

  it('same scenario, two models: two columns, each labelled with exactly its tierLabel', () => {
    const a = asLive(hourly, 'model-a'), b = asLive(hourly, 'model-b')
    render(<CompareModels runs={[...replays, a, b, asLive(weather, 'model-c')]} />)
    expect(screen.getByRole('heading', { level: 3, name: hourly.prompt })).toBeTruthy()
    const columns = screen.getAllByRole('article')
    expect(columns).toHaveLength(2)
    expect(columns[0].getAttribute('aria-label')).toBe(tierLabel(a))
    expect(columns[1].getAttribute('aria-label')).toBe(tierLabel(b))
    expect(within(columns[0]).getAllByText(tierLabel(a))).toHaveLength(1)
    expect(within(columns[1]).getByRole('heading', { level: 4, name: 'model-b' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('Recorded replay')
    expect(document.body.textContent).not.toContain('model-c')
  })
})
