// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { tierLabel, type LabRun } from '../agent/run-contract'
import { App } from '../src/App'
import { analyticsRuns, exampleName, governanceExamples, governanceRuns, parseRuns, useLessonRun, type LessonRunController } from '../src/shell'
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
        expect(card.querySelectorAll('.shell-tier')).toHaveLength(1)
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
  })

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
    const hero = () => document.querySelector('.shell-hero')!.textContent!
    const footer = () => document.querySelector('.shell-footer')!.textContent!
    const { unmount } = render(<App />)
    expect(hero()).toContain('saved recordings')
    expect(hero()).not.toContain('simulated model')
    expect(footer()).toContain('No AI model is called on this page.')
    unmount()

    render(<App governancePlayground={<p>Playground goes here</p>} />)
    expect(hero()).toContain('no AI model is called here')
    expect(hero()).toContain('the playground runs that same code just now, with a simulated model')
    expect(hero()).not.toMatch(/runs in your browser from saved recordings/)
    expect(footer()).not.toMatch(/recordings only/i)
    const description = readFileSync(join(process.cwd(), 'index.html'), 'utf8').match(/name="description" content="([^"]*)"/)![1]
    expect(description).not.toMatch(/recorded runs play|recordings only/i)
    expect(description).toContain('no AI model is called on this page')
  })
})

describe('third-party licences', () => {
  it('public/NOTICE.txt equals NOTICE byte for byte', () => {
    const notice = readFileSync(join(process.cwd(), 'NOTICE'))
    const served = readFileSync(join(process.cwd(), 'public', 'NOTICE.txt'))
    expect(served.equals(notice)).toBe(true)
  })
})
