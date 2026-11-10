// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { tierLabel, type LabRun } from '../agent/run-contract'
import { App } from '../src/App'
import { lessonContent, lessonList } from '../content/lessons'
import { analyticsRuns, baseLabel, exampleName, governanceExamples, governanceRuns, parseRuns, sectionIndex, useLessonRun, type LessonRunController } from '../src/shell'
import { readStoredTheme, THEME_KEY } from '../src/shell/theme'

const TIER_WORDS = /Recorded replay|Simulated in your browser|Recorded live run/g

beforeAll(() => {
  // jsdom lacks the layout APIs that Observable Plot and React Flow measure with.
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  class DOMMatrixReadOnlyMock { m22 = 1 }
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock)
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get() { return 40 } },
    offsetWidth: { configurable: true, get() { return 240 } },
  })
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  try { window.localStorage.clear() } catch { /* stubbed in one test */ }
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

const governanceSection = () => document.getElementById('lesson-governance')!
const analyticsSection = () => document.getElementById('lesson-analytics')!
const exampleSelect = () => within(governanceSection()).getByLabelText('Recorded example') as HTMLSelectElement
const resultCards = () => [...document.querySelectorAll<HTMLElement>('article.shell-result')]
const radio = (scope: HTMLElement, name: string) => within(scope).getByRole('radio', { name })
const chooseExample = (name: string) => {
  const scenario = governanceExamples.find(e => e.name === name)!.scenario
  fireEvent.change(exampleSelect(), { target: { value: scenario } })
}
const chartTitle = () => analyticsSection().querySelector('.lab-chart__title')?.textContent ?? null

describe('page shell', () => {
  it('has one h1 and a heading outline with no skipped levels', () => {
    render(<App />)
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    const levels = headings.map(h => Number(h.tagName[1]))
    expect(levels.filter(l => l === 1)).toHaveLength(1)
    expect(levels[0]).toBe(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level, `heading ${i}: ${headings[i].textContent}`).toBeLessThanOrEqual(levels[i - 1] + 1)
    })
  })

  it('has exactly one live region in the whole page, and the skip link comes first', () => {
    render(<App />)
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    const firstFocusable = document.querySelector('a[href], button, select, input, textarea, [tabindex]:not([tabindex="-1"])')
    expect(firstFocusable?.textContent).toBe('Skip to the lab')
    expect(firstFocusable?.getAttribute('href')).toBe('#lab')
    expect(document.getElementById('lab')?.tagName).toBe('MAIN')
  })

  it('shows exactly one tier label on every result card, for every recorded example', () => {
    render(<App />)
    const check = () => {
      const cards = resultCards()
      expect(cards).toHaveLength(2)
      for (const card of cards) {
        expect(card.textContent!.match(TIER_WORDS), card.textContent!).toHaveLength(1)
        expect(card.querySelectorAll('.lab-tier')).toHaveLength(1)
        expect(card.querySelector('.shell-result__head .lab-tier')).toBeTruthy()
        expect(card.querySelectorAll('.shell-result__head .lab-outcome')).toHaveLength(1)
        expect(within(card).getByRole('link', { name: 'Run this yourself' }).getAttribute('href')).toBe('#run-for-real')
      }
    }
    for (const run of governanceRuns) {
      chooseExample(exampleName(run.scenario))
      check()
      expect(resultCards()[0].textContent).toContain(tierLabel(run))
    }
    fireEvent.click(radio(analyticsSection(), 'Block all reads'))
    check()
  }, 60_000) // ten whole-page re-renders; under heavy machine load this alone took 44 s

  it('explains a refusal: stage, code, the operator sentence and a production note', () => {
    render(<App />)
    chooseExample('Forged scope')
    const card = resultCards()[0]
    expect(card.textContent).toContain('Stopped at caller · SCOPE_NOT_GRANTED')
    expect(card.textContent).toContain('A request cannot raise its own permissions.')
    expect(card.textContent).toContain('Production note.')
    expect(card.textContent).toContain('Refused by the gate: nothing was read')
    expect(card.textContent).toContain('Recorded replay')
    expect(document.getElementById('run-for-real')).toBeTruthy()
  })

  it('says no data was read when analytics reads are blocked, and shows no chart', () => {
    render(<App />)
    expect(chartTitle()).toBe('Two rhythms in one day')
    fireEvent.click(radio(analyticsSection(), 'Block all reads'))
    expect(within(analyticsSection()).getByText('No data was read')).toBeTruthy()
    expect(chartTitle()).toBeNull()
  })
})

describe('theme control', () => {
  const themeRadio = (name: string) => within(document.querySelector('header')!).getByRole('radio', { name })

  it('sets data-theme and color-scheme on <html>, and System removes them', () => {
    render(<App />)
    const html = document.documentElement
    expect(themeRadio('System').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(themeRadio('Dark'))
    expect(html.getAttribute('data-theme')).toBe('dark')
    expect(html.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark')
    fireEvent.click(themeRadio('Light'))
    expect(html.getAttribute('data-theme')).toBe('light')
    expect(html.style.colorScheme).toBe('light')
    fireEvent.click(themeRadio('System'))
    expect(html.hasAttribute('data-theme')).toBe(false)
    expect(html.style.colorScheme).toBe('')
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('remembers the choice for the next visit', () => {
    window.localStorage.setItem(THEME_KEY, 'dark')
    render(<App />)
    expect(themeRadio('Dark').getAttribute('aria-checked')).toBe('true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('still works when localStorage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    expect(readStoredTheme()).toBe('system')
    render(<App />)
    fireEvent.click(themeRadio('Dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(themeRadio('Dark').getAttribute('aria-checked')).toBe('true')
  })
})

describe('lesson state', () => {
  it('switching the analytics question changes the chart without resetting the governance example', () => {
    render(<App />)
    chooseExample('Forged scope')
    expect(chartTitle()).toBe('Two rhythms in one day')

    fireEvent.click(radio(analyticsSection(), 'How do rentals vary with the weather?'))
    expect(chartTitle()).not.toBe('Two rhythms in one day')
    expect(analyticsSection().querySelector('.lab-chart')).toBeTruthy()
    expect(exampleSelect().value).toBe('gov-forged-scope')
    expect(resultCards()[0].textContent).toContain('SCOPE_NOT_GRANTED')

    fireEvent.click(radio(analyticsSection(), 'Which weekday and hour see the most rentals?'))
    expect(exampleSelect().value).toBe('gov-forged-scope')
  })

  it('renders a message, not a crash, when a recording is missing or invalid', () => {
    const withoutWeather = analyticsRuns.filter(r => !(r.scenario === 'weather' && r.outcome.status === 'ok'))
    render(<App analyticsRuns={withoutWeather} governanceRuns={[]} />)
    fireEvent.click(radio(analyticsSection(), 'How do rentals vary with the weather?'))
    expect(within(analyticsSection()).getByText('Recording missing')).toBeTruthy()
    expect(within(governanceSection()).getByText('Recording missing')).toBeTruthy()
    expect(parseRuns([{ contractVersion: 'lab-run/v1', runId: 'broken' }, null, 'x'], 'analytics')).toEqual([])
  })

  it('shows a run from outside (the playground slot) without resetting other state', () => {
    let controller: LessonRunController | undefined
    function Harness() {
      const governance = useLessonRun()
      controller = governance
      return <App governance={governance} governancePlayground={<p>Playground goes here</p>} />
    }
    render(<Harness />)
    expect(within(governanceSection()).getByText('Playground goes here')).toBeTruthy()
    fireEvent.click(radio(analyticsSection(), 'Block all reads'))

    const base = governanceRuns.find(r => r.scenario === 'gov-default')!
    const simulated: LabRun = { ...base, runId: 'gov-default-run-1', tier: 'simulated', recordedAt: null }
    act(() => { controller!.show(simulated) })
    const card = resultCards()[0]
    expect(card.textContent!.match(TIER_WORDS)).toEqual(['Simulated in your browser'])
    expect(exampleSelect().value).toBe('')
    expect(radio(analyticsSection(), 'Block all reads').getAttribute('aria-checked')).toBe('true')

    let shown = true
    act(() => { shown = controller!.show({ ...simulated, tier: 'made-up' } as unknown as LabRun) })
    expect(shown).toBe(false)
    expect(resultCards()[0].textContent).toContain('Simulated in your browser')
  })

  it('renders nothing in the playground slot when no playground is given', () => {
    render(<App />)
    expect(governanceSection().querySelector('.shell-playground')).toBeNull()
  })

  it('never says the page is recordings only once the playground is mounted', () => {
    // The provenance sentence lives in the 01 opener; the hero keeps one lede.
    const labelsOpener = () => document.querySelector('#labels .lab-opener')!.textContent!
    const hero = () => document.querySelector('.shell-hero')!.textContent!
    const footer = () => document.querySelector('.shell-footer')!.textContent!
    const { unmount } = render(<App />)
    expect(labelsOpener()).toContain('saved recordings')
    expect(labelsOpener()).not.toContain('simulated model')
    expect(hero()).not.toMatch(/saved recordings|simulated model/)
    expect(document.querySelectorAll('.shell-hero__lede')).toHaveLength(1)
    expect(footer()).toContain('No AI model is called on this page.')
    unmount()

    render(<App governancePlayground={<p>Playground goes here</p>} />)
    expect(labelsOpener()).toContain('no AI model is called here')
    expect(labelsOpener()).toContain('the playground runs that same code just now, with a simulated model')
    expect(labelsOpener()).not.toMatch(/runs in your browser from saved recordings/)
    expect(hero()).not.toMatch(/saved recordings|recordings only/i)
    expect(footer()).not.toMatch(/recordings only/i)
    const description = readFileSync(join(process.cwd(), 'index.html'), 'utf8').match(/name="description" content="([^"]*)"/)![1]
    expect(description).not.toMatch(/recorded runs play|recordings only/i)
    expect(description).toContain('no AI model is called on this page')
  })
})

describe('page structure (v1.1)', () => {
  const headingTexts = () => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => h.textContent!.trim())

  it('the hero is followed by an index of the six numbered sections, each pointing at a section on the page', () => {
    render(<App />)
    const nav = document.querySelector('.shell-hero nav[aria-label="Sections"]')!
    expect(nav).toBeTruthy()
    const chips = [...nav.querySelectorAll('a')]
    expect(chips.map(a => a.querySelector('.shell-index__num')!.textContent)).toEqual(['01', '02', '03', '04', '05', '06'])
    expect(chips.map(a => a.getAttribute('href'))).toEqual(sectionIndex.map(s => s.href))
    for (const chip of chips) {
      expect(document.getElementById(chip.getAttribute('href')!.slice(1)), chip.textContent!).toBeTruthy()
      // The numeral is decoration; the accessible name is the section name.
      expect(chip.querySelector('.shell-index__num')!.getAttribute('aria-hidden')).toBe('true')
    }
    // Every navigation landmark has its own name.
    const names = [...document.querySelectorAll('nav')].map(n => n.getAttribute('aria-label') ?? document.getElementById(n.getAttribute('aria-labelledby')!)!.textContent)
    expect(new Set(names).size).toBe(names.length)
  })

  it('opens the labels, both lessons and the credits with a section opener; only credits has no numeral', () => {
    render(<App />)
    const expected: [string, string | null][] = [['labels', '01'], ['lesson-governance', '02'], ['lesson-analytics', '03'], ['credits', null]]
    for (const [id, numeral] of expected) {
      const opener = document.getElementById(id)!.querySelector('.lab-opener')!
      expect(opener, id).toBeTruthy()
      expect(opener.querySelector('h2'), id).toBeTruthy()
      expect(opener.querySelector('.lab-opener__numeral')?.textContent ?? null, id).toBe(numeral)
      // Kickers and numerals are never headings.
      const kicker = opener.querySelector('.lab-opener__kicker')!
      expect(kicker.tagName, id).toBe('P')
      expect(headingTexts()).not.toContain(kicker.textContent!.trim())
    }
    expect(document.querySelector('#lesson-governance .lab-opener__kicker')!.textContent).toBe('Lesson 1 · Governance')
    expect(document.querySelector('#lesson-analytics .lab-opener__kicker')!.textContent).toBe('Lesson 2 · Analytics')
  })

  it('shows the three labels in three tinted columns, with the live note in the live column', () => {
    render(<App />)
    const items = [...document.querySelectorAll<HTMLElement>('#labels .shell-labels__item')]
    expect(items.map(i => i.dataset.tier)).toEqual(['replay', 'simulated', 'live'])
    for (const item of items) {
      const labels = item.querySelectorAll<HTMLElement>('.lab-tier')
      expect(labels).toHaveLength(1)
      expect(labels[0].dataset.tier).toBe(item.dataset.tier)
      expect(labels[0].textContent).toBe(baseLabel(item.dataset.tier as 'replay' | 'simulated' | 'live'))
    }
    expect(items[2].textContent).toContain('Live recordings with real models are planned for a later release')
    expect(items[0].textContent).not.toContain('Live recordings with real models')
    expect(document.querySelector('#labels')!.textContent!.match(/Live recordings with real models/g)).toHaveLength(1)
  })

  it.each(lessonList)('$id: the fact tiles hold every sentence of the summary, word for word, once', lesson => {
    const facts = [...lesson.facts].sort((a, b) => lesson.summary.indexOf(a.text) - lesson.summary.indexOf(b.text))
    for (const fact of lesson.facts) expect(lesson.summary).toContain(fact.text)
    expect(facts.map(f => f.text).join(' ')).toBe(lesson.summary)
    expect(new Set(lesson.facts.map(f => f.label)).size).toBe(lesson.facts.length)
  })

  it('renders each lesson summary as fact tiles, then the predict callout', () => {
    render(<App />)
    expect(lessonContent.governance.facts.map(f => f.label)).toEqual(['Who asks', 'Order', 'Refusal', 'Data'])
    for (const [section, lesson] of [[governanceSection(), lessonContent.governance], [analyticsSection(), lessonContent.analytics]] as const) {
      const tiles = [...section.querySelectorAll('.shell-facts > .shell-fact')]
      expect(tiles.map(t => t.querySelector('dt')!.textContent)).toEqual(lesson.facts.map(f => f.label))
      expect(tiles.map(t => t.querySelector('dd')!.textContent)).toEqual(lesson.facts.map(f => f.text))
      const predict = section.querySelector('.lab-callout[data-kind="predict"]')!
      expect(predict.textContent).toContain('Before you look, predict')
      expect(predict.textContent).toContain(lesson.prediction)
      expect(section.querySelector('.shell-facts')!.compareDocumentPosition(predict) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('puts the playground in a "Try it yourself" zone tinted Simulated, and the saved runs in a Replay zone', () => {
    render(<App governancePlayground={<p>Playground goes here</p>} />)
    const zones = [...governanceSection().querySelectorAll<HTMLElement>('.shell-zone')]
    expect(zones).toHaveLength(2)
    const [tryIt, watch] = zones
    expect(tryIt.dataset.tier).toBe('simulated')
    expect(tryIt.querySelector('.shell-zone__kicker')!.textContent).toBe('Try it yourself')
    // Zones carry a kicker and a tint, never a tier label of their own: each result has one label.
    expect(tryIt.querySelector(':scope > .shell-zone__head .lab-tier')).toBeNull()
    expect(within(tryIt).getByText('Playground goes here')).toBeTruthy()

    expect(watch.dataset.tier).toBe('replay')
    expect(watch.querySelector('.shell-zone__kicker')!.textContent).toBe('Watch saved runs')
    expect(watch.querySelector(':scope > .shell-zone__head .lab-tier')).toBeNull()
    // The result card holds the run's one label; the trace under it does not repeat it.
    expect(watch.querySelectorAll('.lab-tier')).toHaveLength(1)
    expect(watch.querySelector('article.shell-result .lab-tier')!.textContent).toBe('Recorded replay')
    // In order: the selector, then the result card, then the trace.
    const select = within(watch).getByLabelText('Recorded example')
    const card = watch.querySelector('article.shell-result')!
    const trace = watch.querySelector('section.trace')!
    expect(select.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.compareDocumentPosition(trace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('never labels the visitor\'s own simulated run as a saved run', () => {
    let controller: LessonRunController | undefined
    function Harness() {
      const governance = useLessonRun()
      controller = governance
      return <App governance={governance} governancePlayground={<p>Playground goes here</p>} />
    }
    render(<Harness />)
    const base = governanceRuns.find(r => r.scenario === 'gov-default')!
    act(() => { controller!.show({ ...base, runId: 'gov-default-run-2', tier: 'simulated', recordedAt: null }) })
    const watch = governanceSection().querySelectorAll<HTMLElement>('.shell-zone')[1]
    expect(watch.dataset.tier).toBe('simulated')
    expect(watch.querySelector('.shell-zone__kicker')!.textContent).toBe('Your own run')
    expect(watch.querySelector(':scope > .shell-zone__head')!.textContent).not.toMatch(/Recorded replay|Watch saved runs/)
    expect(resultCards()[0].dataset.tier).toBe('simulated')
  })

  it('the result card title is the card-title role and its header holds the tier label and outcome badge', () => {
    render(<App />)
    chooseExample('Forged scope')
    const card = resultCards()[0]
    const head = card.querySelector('.shell-result__head')!
    expect(head.querySelector('h3.shell-result__title')!.textContent).toBe('Result')
    expect(head.querySelector('.lab-tier')!.textContent).toBe('Recorded replay')
    const badge = head.querySelector<HTMLElement>('.lab-outcome')!
    expect(badge.dataset.status).toBe('denied')
    expect(badge.textContent).toBe('Refused')
    expect(badge.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    // No v1.0 chip-class tier labels anywhere in the shell.
    expect(document.querySelectorAll('.shell-tier')).toHaveLength(0)
  })
})

describe('third-party licences', () => {
  it('public/NOTICE.txt equals NOTICE byte for byte', () => {
    const notice = readFileSync(join(process.cwd(), 'NOTICE'))
    const served = readFileSync(join(process.cwd(), 'public', 'NOTICE.txt'))
    expect(served.equals(notice)).toBe(true)
  })
  it('serves the bundled font\'s full OFL licence, byte for byte as the package ships it', () => {
    const shipped = readFileSync(join(process.cwd(), 'node_modules', '@fontsource-variable', 'space-grotesk', 'LICENSE'))
    const served = readFileSync(join(process.cwd(), 'public', 'licenses', 'space-grotesk-OFL.txt'))
    expect(served.equals(shipped)).toBe(true)
    expect(readFileSync(join(process.cwd(), 'NOTICE'), 'utf8')).toContain('licenses/space-grotesk-OFL.txt')
  })
})
