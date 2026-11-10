// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import recordings from '../fixtures/executions.json'
import governanceRecordings from '../fixtures/governance-replays.json'
import { runSchema } from '../agent/run-contract'
import { narrate } from '../content/narration'
import { announce } from '../src/announce'
import { glideMs, usePrefersReducedMotion } from '../src/trace/media'
import { DEV_DISCLOSURE_TITLE, PLAY_INTERVAL_MS, TracePanel, traceTitles } from '../src/trace/TracePanel'

vi.mock('../src/announce', () => ({ announce: vi.fn() }))

const runs = z.array(runSchema).parse(recordings)
const okRun = runs.find(r => r.outcome.status === 'ok')!
const deniedRun = runs.find(r => r.outcome.status === 'denied')!
const governanceRun = z.array(runSchema).parse(governanceRecordings)[0]
const traceCss = readFileSync(join(process.cwd(), 'src/trace/trace.css'), 'utf8')

/** What the mocked system settings report; each test can change them. */
const system = { reducedMotion: true, dark: false, phone: false }

beforeAll(() => {
  // jsdom lacks the layout APIs React Flow measures with.
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  class DOMMatrixReadOnlyMock {
    m22: number
    constructor(transform?: string) { const scale = transform?.match(/scale\(([1-9.])\)/)?.[1]; this.m22 = scale !== undefined ? +scale : 1 }
  }
  ;(globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyMock
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get() { return parseFloat(this.style.height) || 40 } },
    offsetWidth: { configurable: true, get() { return parseFloat(this.style.width) || 240 } },
  })
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? system.reducedMotion
      : query.includes('dark') ? system.dark
      : query.includes('max-width') ? system.phone
      : false,
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
beforeEach(() => vi.mocked(announce).mockClear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Object.assign(system, { reducedMotion: true, dark: false, phone: false })
  delete document.documentElement.dataset.theme
})

const list = () => screen.getByRole('list', { name: 'Steps' })
const stepButtons = () => within(list()).getAllByRole('button')
const current = () => stepButtons().find(b => b.getAttribute('aria-current') === 'step')
const devDisclosure = () => document.querySelector<HTMLDetailsElement>('details.trace-dev')!
/** The graph starts closed: open it from its toggle inside the developer disclosure. */
const openGraph = () => fireEvent.click(screen.getByRole('button', { name: 'Graph of the same steps' }))
/** a comes before b in document order. */
const precedes = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('TracePanel', () => {
  it('renders the step list as an ordered list of buttons labelled "Step N of M"', () => {
    render(<TracePanel run={okRun} />)
    expect(list().tagName).toBe('OL')
    const buttons = stepButtons()
    const m = okRun.events.length
    expect(buttons).toHaveLength(m)
    buttons.forEach((b, i) => {
      expect(b.closest('li')?.parentElement).toBe(list())
      expect(b).toHaveProperty('type', 'button')
      expect(b.textContent).toMatch(new RegExp(`^\\d\\dStep ${i + 1} of ${m}: `))
    })
    expect(screen.getByRole('button', { name: 'Step 4 of 9: Gate allowed one read, Allowed, +23.3 ms' })).toBeTruthy()
    expect(within(list()).getAllByText(/^\+\d+\.\d ms$/)).toHaveLength(m)
  })

  it('has exactly one tab stop in the list and arrow keys move aria-current without announcing', () => {
    render(<TracePanel run={okRun} />)
    const tabStops = () => list().querySelectorAll('[tabindex="0"]')
    expect(tabStops()).toHaveLength(1)
    expect(current()).toBe(stepButtons()[0])

    stepButtons()[0].focus()
    fireEvent.keyDown(stepButtons()[0], { key: 'ArrowDown' })
    expect(current()).toBe(stepButtons()[1])
    expect(document.activeElement).toBe(stepButtons()[1])
    expect(tabStops()).toHaveLength(1)

    fireEvent.keyDown(stepButtons()[1], { key: 'End' })
    expect(current()).toBe(stepButtons()[okRun.events.length - 1])
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(current()).toBe(stepButtons()[0])
    fireEvent.keyDown(stepButtons()[0], { key: 'ArrowUp' })
    expect(current()).toBe(stepButtons()[0])
    fireEvent.click(stepButtons()[3])
    expect(current()).toBe(stepButtons()[3])

    expect(announce).not.toHaveBeenCalled()
  })

  it('shows the selected step’s details: explanation, labelled input and a neutral gate refusal', () => {
    render(<TracePanel run={deniedRun} />)
    fireEvent.click(stepButtons()[2])
    const input = screen.getByRole('region', { name: 'Tool input for step 3' })
    expect(input.tagName).toBe('PRE')
    expect(input.getAttribute('tabindex')).toBe('0')
    expect(JSON.parse(input.textContent!)).toEqual({ period: 'both' })

    fireEvent.click(stepButtons()[3])
    const details = screen.getByRole('heading', { name: /^Step 4 of 8: Gate refused at read budget/ }).closest('section')!
    expect(details.textContent).toContain('READ_BUDGET_EXHAUSTED')
    expect(details.textContent).toContain('budget')
    expect(details.textContent).toContain('Every check passed, but this request had no data reads left.')
    expect(details.querySelector('.trace-decision--refused')).toBeTruthy()
    expect(details.querySelector('.trace-decision--failed')).toBeNull()
  })

  it('renders a visual-only graph: no live regions, no delete hints, no controls inside nodes', () => {
    render(<TracePanel run={okRun} />)
    openGraph()
    const graph = document.querySelector('.react-flow')!
    expect(graph).toBeTruthy()
    expect(graph.getAttribute('aria-label')).toBe('Execution graph — the same steps as the step list')
    expect(graph.querySelectorAll('[aria-live]')).toHaveLength(0)
    const region = graph.closest('.trace-graph')!
    for (const el of region.querySelectorAll('*')) expect(el.textContent ?? '').not.toMatch(/delete/i)
    expect(graph.querySelectorAll('.react-flow__node button')).toHaveLength(0)
    expect(graph.querySelectorAll('[aria-roledescription]')).toHaveLength(0)
    // No tab stops at all inside the picture: not even React Flow's attribution link.
    expect(graph.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])')).toHaveLength(0)
    expect(screen.getByText('Graph drawn with React Flow (MIT licence).')).toBeTruthy()
  })

  it('the graph follows the page theme: data-theme first, then the system setting', () => {
    document.documentElement.dataset.theme = 'dark'
    const { unmount } = render(<TracePanel run={okRun} />)
    openGraph()
    expect(document.querySelector('.react-flow')!.classList.contains('dark')).toBe(true)
    act(() => { document.documentElement.dataset.theme = 'light' })
    unmount()

    render(<TracePanel run={okRun} />)
    openGraph()
    expect(document.querySelector('.react-flow')!.classList.contains('light')).toBe(true)
    cleanup()

    delete document.documentElement.dataset.theme
    system.dark = true
    render(<TracePanel run={okRun} />)
    openGraph()
    expect(document.querySelector('.react-flow')!.classList.contains('dark')).toBe(true)
  })

  it('under reduced motion the graph jumps to a step; otherwise it glides', () => {
    system.reducedMotion = true
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true)
    system.reducedMotion = false
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false)
    expect(glideMs(true)).toBe(0)
    expect(glideMs(false)).toBeGreaterThan(0)
  })

  it('clicking a graph node selects that step; the selected node gets the chosen class', () => {
    render(<TracePanel run={okRun} />)
    openGraph()
    const node = document.querySelector('.react-flow__node[data-id="5"]')!
    fireEvent.click(node)
    expect(current()).toBe(stepButtons()[5])
    expect(document.querySelector('.react-flow__node[data-id="5"]')!.classList.contains('chosen')).toBe(true)
    expect(document.querySelectorAll('.react-flow__node.chosen')).toHaveLength(1)
  })

  it('the graph starts closed, opens from its toggle and can be hidden again', () => {
    render(<TracePanel run={okRun} />)
    const toggle = screen.getByRole('button', { name: 'Graph of the same steps' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.react-flow')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.react-flow')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.react-flow')).toBeNull()
  })

  it('guide Next selects the next list step and announces; Back goes back', () => {
    render(<TracePanel run={okRun} />)
    const sentences = narrate(okRun)
    const guide = screen.getByRole('region', { name: 'Guide' })
    expect(within(guide).getByText(sentences[0])).toBeTruthy()

    fireEvent.click(within(guide).getByRole('button', { name: 'Next' }))
    expect(current()).toBe(stepButtons()[1])
    expect(within(guide).getByText(sentences[1])).toBeTruthy()
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenLastCalledWith(`Step 2 of 9. ${sentences[1]}`)

    fireEvent.click(within(guide).getByRole('button', { name: 'Back' }))
    expect(current()).toBe(stepButtons()[0])
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('Back at the first step stays focusable and does nothing', () => {
    render(<TracePanel run={okRun} />)
    const back = screen.getByRole('button', { name: 'Back' })
    expect(back.getAttribute('aria-disabled')).toBe('true')
    expect(back.hasAttribute('disabled')).toBe(false)
    fireEvent.click(back)
    expect(current()).toBe(stepButtons()[0])
    expect(announce).not.toHaveBeenCalled()
  })

  it('Play toggles aria-pressed, advances every 4.5 s without moving focus, and stops on keydown', () => {
    vi.useFakeTimers()
    render(<TracePanel run={okRun} />)
    const play = screen.getByRole('button', { name: 'Play' })
    expect(play.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(play)
    expect(play.getAttribute('aria-pressed')).toBe('true')

    const focused = document.activeElement
    act(() => { vi.advanceTimersByTime(PLAY_INTERVAL_MS) })
    expect(current()).toBe(stepButtons()[1])
    expect(announce).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(focused)

    fireEvent.keyDown(stepButtons()[1], { key: 'Tab' })
    expect(play.getAttribute('aria-pressed')).toBe('false')
    act(() => { vi.advanceTimersByTime(PLAY_INTERVAL_MS * 2) })
    expect(current()).toBe(stepButtons()[1])
    expect(announce).toHaveBeenCalledTimes(1)
  })

  it('Play stops on pointer input elsewhere in the panel', () => {
    render(<TracePanel run={okRun} />)
    const play = screen.getByRole('button', { name: 'Play' })
    fireEvent.click(play)
    expect(play.getAttribute('aria-pressed')).toBe('true')
    fireEvent.pointerDown(screen.getByRole('heading', { level: 2, name: traceTitles[okRun.lesson] }))
    expect(play.getAttribute('aria-pressed')).toBe('false')
  })

  it('Space or Enter on the Play toggle operate it; Tab away from it stops playback', () => {
    vi.useFakeTimers()
    render(<TracePanel run={okRun} />)
    const play = screen.getByRole('button', { name: 'Play' })
    play.focus()
    fireEvent.click(play)
    expect(play.getAttribute('aria-pressed')).toBe('true')

    // The keydown of a Space or Enter press on the toggle itself must not stop playback.
    fireEvent.keyDown(play, { key: ' ' })
    fireEvent.keyDown(play, { key: 'Enter' })
    expect(play.getAttribute('aria-pressed')).toBe('true')

    fireEvent.keyDown(play, { key: 'Tab' })
    expect(play.getAttribute('aria-pressed')).toBe('false')
    act(() => { vi.advanceTimersByTime(PLAY_INTERVAL_MS * 2) })
    expect(current()).toBe(stepButtons()[0])
    expect(announce).not.toHaveBeenCalled()
  })

  it('renders no live regions of its own and shows the tier label', () => {
    const { container } = render(<TracePanel run={okRun} />)
    expect(container.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')).toHaveLength(0)
    expect(screen.getAllByText('Recorded replay').length).toBe(1)
    // The shared TierLabel, in the head band, replaces the old chip.
    const label = screen.getByText('Recorded replay').closest('.lab-tier')!
    expect(label.getAttribute('data-tier')).toBe('replay')
    expect(label.closest('.trace__head')).toBeTruthy()
    expect(container.querySelector('.trace-tier, [data-slot="badge"]')).toBeNull()
  })

  it('leaves the label to the result card above it when showTier is false, keeping the tier tint', () => {
    const { container } = render(<TracePanel run={okRun} showTier={false} />)
    expect(container.querySelector('.lab-tier')).toBeNull()
    expect(container.querySelector('.trace')!.getAttribute('data-tier')).toBe('replay')
  })

  it('a simulated run is labelled "Simulated in your browser" and never called live', () => {
    const { container } = render(<TracePanel run={{ ...okRun, tier: 'simulated' }} />)
    const label = screen.getByText('Simulated in your browser').closest('.lab-tier')!
    expect(label.getAttribute('data-tier')).toBe('simulated')
    expect(container.querySelector('.trace')!.getAttribute('data-tier')).toBe('simulated')
    expect(container.textContent).not.toMatch(/\blive\b/i)
  })

  it('reads in order: the Guide, the step details, then the developer disclosure with the list and graph', () => {
    const { container } = render(<TracePanel run={okRun} />)
    const guide = screen.getByRole('region', { name: 'Guide' })
    const details = screen.getByRole('heading', { level: 3, name: /^Step 1 of 9: / }).closest('section')!
    const disclosure = devDisclosure()
    expect(precedes(guide, details)).toBe(true)
    expect(precedes(details, disclosure)).toBe(true)
    expect(guide.contains(details) || details.contains(guide)).toBe(false)

    const summary = disclosure.querySelector(':scope > summary')!
    expect(summary.textContent).toBe(DEV_DISCLOSURE_TITLE)
    expect(DEV_DISCLOSURE_TITLE).toBe('Every step with timings (for developers)')
    expect(summary.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull()
    expect(disclosure.contains(list())).toBe(true)
    expect(disclosure.contains(screen.getByRole('button', { name: 'Graph of the same steps' }))).toBe(true)
    expect(guide.contains(list()) || details.contains(list())).toBe(false)

    // Heading levels are unchanged: one h2 for the trace, then h3s for the Guide, the step and the list.
    const outline = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => h.tagName)
    expect(outline).toEqual(['H2', 'H3', 'H3', 'H3'])
    expect(screen.getByRole('heading', { level: 3, name: 'Steps' })).toBeTruthy()
  })

  it('the developer disclosure is open on wider screens and closed on phones, where the Guide still walks the steps', () => {
    const { unmount } = render(<TracePanel run={okRun} />)
    expect(devDisclosure().open).toBe(true)
    unmount()

    system.phone = true
    const { container } = render(<TracePanel run={okRun} />)
    expect(devDisclosure().open).toBe(false)
    expect(container.querySelectorAll('.trace-steps')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { level: 3, name: /^Step 2 of 9: / })).toBeTruthy()
    expect(announce).toHaveBeenCalledTimes(1)
  })

  it('each lesson’s trace has its own title, at heading level 2', () => {
    expect(new Set(Object.values(traceTitles)).size).toBe(Object.keys(traceTitles).length)
    expect(governanceRun.lesson).toBe('governance')
    expect(okRun.lesson).toBe('analytics')
    const { unmount } = render(<TracePanel run={governanceRun} />)
    expect(screen.getByRole('heading', { level: 2, name: traceTitles.governance })).toBeTruthy()
    unmount()
    render(<TracePanel run={okRun} />)
    expect(screen.getByRole('heading', { level: 2, name: traceTitles.analytics })).toBeTruthy()
  })

  it('guide buttons follow the ladder: Next is the one primary, Back tertiary, Play a toggle; ends stay focusable', () => {
    render(<TracePanel run={okRun} />)
    const guide = screen.getByRole('region', { name: 'Guide' })
    const back = within(guide).getByRole('button', { name: 'Back' })
    const next = within(guide).getByRole('button', { name: 'Next' })
    const play = within(guide).getByRole('button', { name: 'Play' })
    expect(next.getAttribute('data-variant')).toBe('primary')
    expect(back.getAttribute('data-variant')).toBe('tertiary')
    expect(play.getAttribute('data-variant')).toBe('toggle')
    expect(guide.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
    fireEvent.keyDown(stepButtons()[0], { key: 'End' })
    expect(next.getAttribute('aria-disabled')).toBe('true')
    expect(next.hasAttribute('disabled')).toBe(false)
  })

  it('a gate decision in the details carries the shared outcome badge; a refusal is neutral', () => {
    render(<TracePanel run={deniedRun} />)
    fireEvent.click(stepButtons()[3])
    const badge = document.querySelector('.trace-details .trace-decision .lab-outcome')!
    expect(badge.getAttribute('data-status')).toBe('denied')
    expect(badge.textContent).toBe('Refused')
  })

  it('styles: the current step is a 6px ink border-left, nodes sit on the raised surface, the Guide is a yellow wash', () => {
    const rule = (selector: string) => {
      const at = traceCss.indexOf('\n' + selector + ' {') // a top-level rule, at the start of a line
      expect(at, selector).toBeGreaterThanOrEqual(0)
      return traceCss.slice(at, traceCss.indexOf('}', at))
    }
    expect(rule('.trace-step')).toContain('border-left: var(--bar-width) solid transparent')
    expect(rule('.trace-step[aria-current="step"]')).toContain('border-left-color: var(--ink)')
    expect(rule('.trace-step[aria-current="step"]')).toContain('background: var(--surface-raised)')
    expect(traceCss).not.toMatch(/inset/)
    expect(traceCss).toContain('--xy-node-background-color: var(--surface-raised)')
    expect(rule('.trace-graph .react-flow__node.trace-node')).toContain('background: var(--surface-raised)')
    expect(rule('.trace-guide')).toContain('border-left: var(--bar-width) solid var(--brand-yellow)')
    expect(rule('.trace-guide')).toContain('background: var(--wash-yellow)')
    // Offset shadows use --shadow-color; disabled buttons keep the ladder's dashed border, never a strikethrough.
    expect(traceCss).not.toMatch(/box-shadow:[^;]*var\(--rule\)/)
    expect(traceCss).not.toMatch(/line-through/)
    expect(traceCss).not.toMatch(/aria-disabled/)
  })

  it('a new run starts again at step 1', () => {
    const { rerender } = render(<TracePanel run={okRun} />)
    fireEvent.click(stepButtons()[4])
    rerender(<TracePanel run={deniedRun} />)
    expect(current()).toBe(stepButtons()[0])
    expect(stepButtons()).toHaveLength(deniedRun.events.length)
  })
})
