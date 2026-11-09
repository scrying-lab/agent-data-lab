// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { z } from 'zod'
import recordings from '../fixtures/executions.json'
import { runSchema } from '../agent/run-contract'
import { narrate } from '../content/narration'
import { announce } from '../src/announce'
import { glideMs, usePrefersReducedMotion } from '../src/trace/media'
import { PLAY_INTERVAL_MS, TracePanel } from '../src/trace/TracePanel'

vi.mock('../src/announce', () => ({ announce: vi.fn() }))

const runs = z.array(runSchema).parse(recordings)
const okRun = runs.find(r => r.outcome.status === 'ok')!
const deniedRun = runs.find(r => r.outcome.status === 'denied')!

/** What the mocked system settings report; each test can change them. */
const system = { reducedMotion: true, dark: false }

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
    matches: query.includes('reduce') ? system.reducedMotion : query.includes('dark') ? system.dark : false,
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
beforeEach(() => vi.mocked(announce).mockClear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Object.assign(system, { reducedMotion: true, dark: false })
  delete document.documentElement.dataset.theme
})

const list = () => screen.getByRole('list', { name: 'Steps' })
const stepButtons = () => within(list()).getAllByRole('button')
const current = () => stepButtons().find(b => b.getAttribute('aria-current') === 'step')

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
    expect(document.querySelector('.react-flow')!.classList.contains('dark')).toBe(true)
    act(() => { document.documentElement.dataset.theme = 'light' })
    unmount()

    render(<TracePanel run={okRun} />)
    expect(document.querySelector('.react-flow')!.classList.contains('light')).toBe(true)
    cleanup()

    delete document.documentElement.dataset.theme
    system.dark = true
    render(<TracePanel run={okRun} />)
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
    const node = document.querySelector('.react-flow__node[data-id="5"]')!
    fireEvent.click(node)
    expect(current()).toBe(stepButtons()[5])
    expect(document.querySelector('.react-flow__node[data-id="5"]')!.classList.contains('chosen')).toBe(true)
    expect(document.querySelectorAll('.react-flow__node.chosen')).toHaveLength(1)
  })

  it('the graph can be hidden', () => {
    render(<TracePanel run={okRun} />)
    const toggle = screen.getByRole('button', { name: 'Graph of the same steps' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
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
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'What happened, step by step' }))
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
  })

  it('a new run starts again at step 1', () => {
    const { rerender } = render(<TracePanel run={okRun} />)
    fireEvent.click(stepButtons()[4])
    rerender(<TracePanel run={deniedRun} />)
    expect(current()).toBe(stepButtons()[0])
    expect(stepButtons()).toHaveLength(deniedRun.events.length)
  })
})
