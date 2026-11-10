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
import { TranslationPanel, sideBySideQuery, verifiedBadge, verifiedDetail, verifiedLevel } from '../src/lessons/TranslationPanel'
import { Elsewhere, disclaimer, inLabLabel, matchLevel, vendors } from '../src/lessons/Elsewhere'
import { matchLabel } from '../content/hints'
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
    // Sources sit in closed disclosures; they are still in the page, so include hidden subtrees.
    const links = screen.getAllByRole('link', { hidden: true })
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
    const terms = screen.getAllByRole('term', { hidden: true }).map(t => t.textContent)
    expect(terms.filter(t => t === 'On AWS')).toHaveLength(concepts.length)
    expect(terms.filter(t => t === inLabLabel)).toHaveLength(concepts.filter(c => c.inLab).length)
    expect(inLabLabel).toBe('What this lab uses')
    expect(document.body.textContent).not.toMatch(/In this lab \(AWS\)/)
    expect(terms.some(t => /lab/i.test(t ?? '') && t !== inLabLabel)).toBe(false)
  })

  it('opens with numeral 05 and keeps the disclaimer visible, outside every disclosure', () => {
    const { container } = render(<Elsewhere />)
    expect(screen.getByRole('heading', { level: 2, name: 'The same ideas on other platforms' })).toBeTruthy()
    expect(container.querySelector('.lab-opener__numeral')?.textContent).toBe('05')
    const line = screen.getByText(content => content.includes(disclaimer))
    expect(line.closest('details')).toBeNull()
    expect(line.textContent).toContain('“On AWS” means the equivalent on AWS, not something this lab runs on.')
  })

  it('states each match badge meaning once, with a full square for "Close match" and a half square for "Approximate"', () => {
    const { container } = render(<Elsewhere />)
    const label = screen.getByText('What the badges mean')
    const legend = container.querySelector(`dl[aria-labelledby="${label.id}"]`)!
    expect(legend.closest('details')).toBeNull()
    expect(matchLevel).toEqual({ close: 'full', approximate: 'half', unconfirmed: 'none' })
    for (const m of Object.keys(matchLabel) as (keyof typeof matchLabel)[]) {
      const chip = within(legend as HTMLElement).getByText(matchLabel[m]).closest('.lsn-chip')
      expect(chip?.getAttribute('data-level')).toBe(matchLevel[m])
    }
    for (const chip of container.querySelectorAll('.lsn-chip')) {
      expect(chip.className).toBe('lsn-chip')
      expect(chip.getAttribute('style')).toBeNull()
    }
  })

  it('each concept card shows its badge, "What this lab uses" and "On AWS"; other platforms and sources wait in a closed disclosure', () => {
    const { container } = render(<Elsewhere />)
    const cards = [...container.querySelectorAll<HTMLElement>('li.lsn-concept')]
    expect(cards).toHaveLength(concepts.length)
    concepts.forEach((c, i) => {
      const card = cards[i]
      expect(within(card).getByRole('heading', { level: 3, name: c.concept })).toBeTruthy()
      expect(within(card).getByText(matchLabel[c.match]).closest('.lsn-chip')).toBeTruthy()
      const visibleTerms = [...card.querySelectorAll('.lsn-concept-body > dl dt')].map(t => t.textContent)
      expect(visibleTerms).toEqual(c.inLab ? [inLabLabel, 'On AWS'] : ['On AWS'])
      const more = card.querySelector('details')!
      expect(more.open).toBe(false)
      expect(more.querySelector('summary')?.textContent).toBe('Other platforms and sources')
      const hiddenTerms = [...more.querySelectorAll('dt')].map(t => t.textContent)
      expect(hiddenTerms).toEqual(vendors.slice(1).map(v => v.label))
      for (const s of c.sources) expect(more.querySelector(`a[href="${s.url}"]`)?.textContent).toBe(s.title)
    })
  })

  it('keeps the method note behind its own closed disclosure', () => {
    const { container } = render(<Elsewhere />)
    const method = [...container.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === 'Where each row comes from')!
    expect(method.open).toBe(false)
    expect(method.textContent).toContain('Each vendor row was read from that vendor’s own documentation on 2026-11-09.')
    expect(method.textContent).toContain('A row headed “What this lab uses” says what the lab itself uses and names the files that show it.')
  })
})

describe('TranslationPanel', () => {
  // The pair switches layout at 768px. jsdom has no layout, so tests choose the width through matchMedia.
  const withWidth = (wide: boolean) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: wide && query === sideBySideQuery, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    return () => { window.matchMedia = original }
  }
  const triggerOf = (pair: (typeof pairs)[number]) =>
    within(screen.getByRole('article', { name: pair.title })).getByRole('button', { name: pair.title })

  it('opens with the section numeral, kicker and h2, with the numeral hidden from assistive technology', () => {
    const { container } = render(<TranslationPanel />)
    expect(screen.getByRole('heading', { level: 2, name: 'Python → TypeScript' })).toBeTruthy()
    expect(screen.getByText('For Python developers').tagName).toBe('P')
    expect(container.querySelector('.lab-opener__numeral')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.lab-opener__numeral')?.textContent).toBe('04')
  })

  it('keeps one focusable code region per source file in the page, with the file’s text, even while closed', () => {
    const { container } = render(<TranslationPanel />)
    const regions = [...container.querySelectorAll('[role="region"]')].filter(r => /^(Python|TypeScript): /.test(r.getAttribute('aria-label') ?? ''))
    expect(regions).toHaveLength(pairs.length * 2)
    for (const pair of pairs) {
      for (const [lang, file] of [['Python', pair.pyFile], ['TypeScript', pair.tsFile]] as const) {
        const matching = regions.filter(r => r.getAttribute('aria-label') === lang + ': ' + file)
        expect(matching, file).toHaveLength(1)
        expect(matching[0].getAttribute('tabindex')).toBe('0')
        expect(matching[0].querySelector('pre > code')?.textContent).toBe(sourceOf(file))
      }
    }
  })

  it('keeps the heading outline: one h3 per pair and an h4 for each language', () => {
    const { container } = render(<TranslationPanel />)
    for (const pair of pairs) expect(screen.getByRole('heading', { level: 3, name: pair.title })).toBeTruthy()
    const h4s = [...container.querySelectorAll('h4')].map(h => h.textContent)
    expect(h4s.filter(t => t === 'Python')).toHaveLength(pairs.length)
    expect(h4s.filter(t => t === 'TypeScript')).toHaveLength(pairs.length)
  })

  it('states each badge meaning once, above the pairs, and only for badges in use', () => {
    render(<TranslationPanel />)
    const label = screen.getByText('What the badges mean')
    expect(label.matches('h1, h2, h3, h4, h5, h6')).toBe(false)
    const legend = document.querySelector(`dl[aria-labelledby="${label.id}"]`)!
    expect(legend).toBeTruthy()
    const used = [...new Set(pairs.map(p => p.verified))]
    for (const v of Object.keys(verifiedBadge) as (keyof typeof verifiedBadge)[]) {
      expect(screen.queryAllByText(verifiedDetail[v])).toHaveLength(used.includes(v) ? 1 : 0)
    }
    expect(legend.compareDocumentPosition(screen.getByRole('list', { name: 'Python and TypeScript pairs' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('indexes every pair as a card with its title, evidence chip and what changes', () => {
    render(<TranslationPanel />)
    const cards = within(screen.getByRole('list', { name: 'Python and TypeScript pairs' })).getAllByRole('listitem')
    expect(cards).toHaveLength(pairs.length)
    pairs.forEach((pair, i) => {
      const card = cards[i]
      expect(within(card).getByRole('button', { name: pair.title })).toBeTruthy()
      expect(within(card).getByText(pair.whatChanges)).toBeTruthy()
      expect(within(card).getByText(verifiedBadge[pair.verified])).toBeTruthy()
      for (const other of Object.values(verifiedBadge).filter(b => b !== verifiedBadge[pair.verified])) {
        expect(within(card).queryByText(other)).toBeNull()
      }
    })
  })

  it('evidence chips are never coloured: a full square for "Runs in tests", a half square for "Type-checked"', () => {
    const { container } = render(<TranslationPanel />)
    expect(verifiedLevel).toEqual({ executed: 'full', compiled: 'half', 'names-only': 'none' })
    const chips = [...container.querySelectorAll('.lsn-chip')]
    expect(chips.length).toBeGreaterThan(pairs.length)
    for (const chip of chips) {
      const level = chip.getAttribute('data-level')
      const glyph = chip.querySelector('svg')!
      expect(glyph.getAttribute('aria-hidden')).toBe('true')
      const filled = [...glyph.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === 'currentColor')
      expect(filled.map(r => r.getAttribute('width'))).toEqual(level === 'full' ? ['10.5'] : level === 'half' ? ['5.25'] : [])
      expect(chip.getAttribute('style')).toBeNull()
      expect(chip.className).toBe('lsn-chip')
    }
    for (const pair of pairs) {
      const chip = within(screen.getByRole('article', { name: pair.title })).getByText(verifiedBadge[pair.verified]).closest('.lsn-chip')
      expect(chip?.getAttribute('data-level')).toBe(verifiedLevel[pair.verified])
    }
  })

  it('opens one pair at a time, starting with the first', () => {
    render(<TranslationPanel />)
    const [first, second] = pairs
    expect(triggerOf(first).getAttribute('aria-expanded')).toBe('true')
    for (const pair of pairs.slice(1)) expect(triggerOf(pair).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'Python: ' + second.pyFile })).toBeNull()
    fireEvent.click(triggerOf(second))
    expect(triggerOf(second).getAttribute('aria-expanded')).toBe('true')
    expect(triggerOf(first).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('region', { name: 'Python: ' + second.pyFile })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Python: ' + first.pyFile })).toBeNull()
  })

  it('choosing a card opens its pair, marks the card current and moves focus to the pair’s heading button', async () => {
    render(<TranslationPanel />)
    const pair = pairs[3]
    const card = within(screen.getByRole('list', { name: 'Python and TypeScript pairs' })).getByRole('button', { name: pair.title })
    expect(card.getAttribute('aria-current')).toBeNull()
    fireEvent.click(card)
    await waitFor(() => expect(document.activeElement).toBe(triggerOf(pair)))
    expect(triggerOf(pair).getAttribute('aria-expanded')).toBe('true')
    expect(card.getAttribute('aria-current')).toBe('true')
    expect(triggerOf(pairs[0]).getAttribute('aria-expanded')).toBe('false')
    // Choosing the open pair again keeps it open and still moves focus.
    card.focus()
    fireEvent.click(card)
    expect(document.activeElement).toBe(triggerOf(pair))
    expect(triggerOf(pair).getAttribute('aria-expanded')).toBe('true')
  })

  it('below 768px, the open pair shows Python and TypeScript as tabs with one tab stop', () => {
    const restore = withWidth(false)
    try {
      render(<TranslationPanel />)
      const article = screen.getByRole('article', { name: pairs[0].title })
      const tablist = within(article).getByRole('tablist', { name: 'Language for ' + pairs[0].title })
      const [python, typescript] = within(tablist).getAllByRole('tab')
      expect([python.textContent, typescript.textContent]).toEqual(['Python', 'TypeScript'])
      expect(python.getAttribute('aria-selected')).toBe('true')
      expect([python.tabIndex, typescript.tabIndex]).toEqual([0, -1])
      expect(within(article).getByRole('region', { name: 'Python: ' + pairs[0].pyFile })).toBeTruthy()
      expect(within(article).queryByRole('region', { name: 'TypeScript: ' + pairs[0].tsFile })).toBeNull()
      // Arrow keys move the selection and the focus (automatic activation); the tab stop follows.
      python.focus()
      fireEvent.keyDown(python, { key: 'ArrowRight' })
      expect(typescript.getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(typescript)
      expect([python.tabIndex, typescript.tabIndex]).toEqual([-1, 0])
      expect(within(article).getByRole('region', { name: 'TypeScript: ' + pairs[0].tsFile })).toBeTruthy()
      expect(within(article).queryByRole('region', { name: 'Python: ' + pairs[0].pyFile })).toBeNull()
      fireEvent.keyDown(typescript, { key: 'Home' })
      expect(python.getAttribute('aria-selected')).toBe('true')
      fireEvent.click(typescript)
      expect(typescript.getAttribute('aria-selected')).toBe('true')
      // Each panel is named by its tab and, holding a focusable code region, is not a Tab stop itself.
      for (const panel of article.querySelectorAll('[role="tabpanel"]')) {
        expect(panel.hasAttribute('tabindex')).toBe(false)
        expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.getAttribute('role')).toBe('tab')
      }
    } finally { restore() }
  })

  it('from 768px, the open pair shows Python and TypeScript side by side, without tabs', () => {
    const restore = withWidth(true)
    try {
      render(<TranslationPanel />)
      const article = screen.getByRole('article', { name: pairs[0].title })
      expect(within(article).queryByRole('tablist')).toBeNull()
      expect(within(article).getByRole('heading', { level: 4, name: 'Python' })).toBeTruthy()
      expect(within(article).getByRole('heading', { level: 4, name: 'TypeScript' })).toBeTruthy()
      expect(within(article).getByRole('region', { name: 'Python: ' + pairs[0].pyFile })).toBeTruthy()
      expect(within(article).getByRole('region', { name: 'TypeScript: ' + pairs[0].tsFile })).toBeTruthy()
    } finally { restore() }
  })

  it('colours code only through token classes and keeps the source text exact', () => {
    const { container } = render(<TranslationPanel />)
    const spans = [...container.querySelectorAll('.lsn-code span')]
    expect(spans.length).toBeGreaterThan(0)
    for (const span of spans) {
      expect(span.className).toMatch(/^lsn-tok-(comment|string|keyword)$/)
      expect(span.getAttribute('style')).toBeNull()
    }
    expect(container.querySelector('.lsn-tok-comment')).toBeTruthy()
    expect(container.querySelector('.lsn-tok-string')).toBeTruthy()
    expect(container.querySelector('.lsn-tok-keyword')).toBeTruthy()
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

  it('puts the clone-and-run commands first, under a label, with Copy as the one primary button', () => {
    const { container } = render(<RunForReal />)
    expect(screen.getByRole('heading', { level: 2, name: 'Run it for real' })).toBeTruthy()
    expect(container.querySelector('.lab-opener__numeral')?.textContent).toBe('06')
    const step = screen.getByText('On your computer').parentElement!
    expect(within(step).getByRole('region', { name: 'Commands to run the lab' })).toBeTruthy()
    const copy = within(step).getByRole('button', { name: /copy commands to run the lab/i })
    expect(copy.getAttribute('data-variant')).toBe('primary')
    expect(screen.getByRole('button', { name: 'With a real model (your own AWS account)' }).getAttribute('data-variant')).toBe('tertiary')
    const order = [step, screen.getByRole('button', { name: 'With a real model (your own AWS account)' })]
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the safety line is a "Why it matters" callout, after the commands', () => {
    render(<RunForReal />)
    const line = screen.getByText(noKeysSentence)
    const callout = line.closest('.lab-callout')!
    expect(callout.getAttribute('data-kind')).toBe('why')
    expect(within(callout as HTMLElement).getByText('Why it matters').tagName).toBe('P')
    const commands = screen.getByRole('region', { name: 'Commands to run the lab' })
    expect(commands.compareDocumentPosition(callout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    // Each column carries the one shared tier label, marked live, with its text unchanged.
    for (const [column, run] of [[columns[0], a], [columns[1], b]] as const) {
      const label = column.querySelector('.lab-tier')!
      expect(label.getAttribute('data-tier')).toBe('live')
      expect(label.textContent).toBe(tierLabel(run))
    }
    expect(document.querySelector('.lsn-kicker')).toBeNull()
  })
})
