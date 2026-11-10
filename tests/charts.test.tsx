// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react'
import { z } from 'zod'
import { runSchema, tierLabel, type LabRun } from '../agent/run-contract'
import { periods, resultSchema, weekdays, type Result } from '../analytics/contracts'
import { analyze } from '../analytics/compute'
import { fromCSV } from 'arquero'
import recordings from '../fixtures/executions.json'

vi.mock('../src/announce', () => ({ announce: vi.fn() }))
import { announce } from '../src/announce'
import { HourlyChart, WeatherChart, WeekHeatmap, DEFAULT_WEEK_DOMAIN, chartSummary, hourlyStats, weekStats, one, count, clock } from '../src/charts'
import { cividisFrom } from '../src/charts/WeekHeatmap'
import { MARK_CONTRAST, contrast, parseColor, schemeStart } from '../src/charts/contrast'

beforeAll(() => {
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
})
afterEach(() => {
  cleanup()
  vi.mocked(announce).mockClear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

const runs = z.array(runSchema).parse(recordings)
const fixture = (scenario: string): { run: LabRun; result: Result } => {
  const run = runs.find(r => r.scenario === scenario && r.result !== null)
  if (!run) throw Error('no fixture for ' + scenario)
  return { run, result: resultSchema.parse(run.result) }
}
const openNumbers = () => fireEvent.click(screen.getByRole('button', { name: 'Show the numbers' }))
const table = () => screen.getByRole('table')
const rowFor = (label: string) => {
  const header = within(table()).getByRole('rowheader', { name: label })
  return header.closest('tr') as HTMLTableRowElement
}
const svg = (container: HTMLElement) => container.querySelector('.lab-chart__plot svg') as SVGSVGElement

describe('HourlyChart', () => {
  const { run, result } = fixture('hourly')

  it('summary sentence names the working-day peak: 17:00, 525.3, n = 499', () => {
    const summary = chartSummary(result)
    expect(summary).toContain('17:00')
    expect(summary).toContain('525.3')
    expect(summary).toContain('n = 499')
    expect(summary).toContain('2011–2012')
  })

  it('is a figure whose caption, aria-description and table carry the same numbers as the result', () => {
    const { container } = render(<HourlyChart result={result} provenance={run} />)
    const figure = screen.getByRole('figure')
    const caption = figure.querySelector('figcaption')!
    expect(caption.textContent).toContain(chartSummary(result))
    expect(caption.textContent).toContain('Recorded replay')
    expect(caption.textContent).toContain('UCI Bike Sharing, Capital Bikeshare, 2011–2012 · mean rentals per observed hour')
    expect(svg(container).getAttribute('aria-description')).toBe(chartSummary(result))
    expect(svg(container).getAttribute('aria-label')).toMatch(/working days \(solid\) vs nonworking days \(dashed\)/)
    expect(screen.getByText(/a total would favour working days simply because there are more of them/)).toBeTruthy()

    openNumbers()
    expect(screen.getByRole('button', { name: 'Show the numbers' }).getAttribute('aria-expanded')).toBe('true')
    expect(table().querySelector('caption')).toBeTruthy()
    expect(table().querySelectorAll('th[scope="col"]').length).toBe(5)
    for (const p of result.points) {
      const cells = [...rowFor(clock(p.hour!)).querySelectorAll('td')].map(td => td.textContent)
      const offset = p.group === 'Working days' ? 0 : 2
      expect(cells[offset], `${p.group} ${p.hour}`).toBe(one(p.mean))
      expect(cells[offset + 1]).toBe(count(p.n))
    }
    // The prose numbers are exactly the table's numbers.
    expect(rowFor('17:00').querySelectorAll('td')[0].textContent).toBe('525.3')
    expect(rowFor('17:00').querySelectorAll('td')[1].textContent).toBe('499')
  })

  it('draws series 1 solid and series 2 dashed, each named by a direct label', () => {
    document.documentElement.style.setProperty('--series-1', 'rgb(1, 2, 3)')
    document.documentElement.style.setProperty('--series-2', 'rgb(7, 8, 9)')
    const { container } = render(<HourlyChart result={result} provenance={run} />)
    const groups = [...svg(container).querySelectorAll('g[data-mark="line"]')]
    expect(groups.length).toBe(2)
    const style = groups.map(g => ({ stroke: g.getAttribute('stroke'), dash: g.getAttribute('stroke-dasharray') ?? g.querySelector('path')?.getAttribute('stroke-dasharray') ?? null }))
    // Working days (series 1) is the solid line, Nonworking days (series 2) the dashed one, as the key says.
    expect(style.find(s => s.stroke === 'rgb(1, 2, 3)')?.dash).toBeNull()
    expect(style.find(s => s.stroke === 'rgb(7, 8, 9)')?.dash).toBe('7 4')
    expect(screen.getByText('Working days: solid line')).toBeTruthy()
    expect(screen.getByText('Nonworking days: dashed line')).toBeTruthy()
    const texts = [...svg(container).querySelectorAll('text')].map(t => t.textContent)
    expect(texts).toContain('Working days')
    expect(texts).toContain('Nonworking days')
  })

  it('re-reads token colours when the theme changes', async () => {
    document.documentElement.style.setProperty('--series-1', 'rgb(1, 2, 3)')
    const { container } = render(<HourlyChart result={result} provenance={run} />)
    const strokes = () => [...svg(container).querySelectorAll('g[data-mark="line"]')].map(g => g.getAttribute('stroke'))
    expect(strokes()).toContain('rgb(1, 2, 3)')
    await act(async () => {
      document.documentElement.style.setProperty('--series-1', 'rgb(4, 5, 6)')
      document.documentElement.setAttribute('data-theme', 'dark')
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(strokes()).toContain('rgb(4, 5, 6)')
  })
})

describe('WeatherChart', () => {
  const { run, result } = fixture('weather')

  it('flags heavy weather (3 observed hours) as a small sample, visibly', () => {
    render(<WeatherChart result={result} provenance={run} />)
    const heavy = result.points.find(p => p.group === 'Heavy rain or snow')!
    expect(heavy.n).toBe(3)
    expect(screen.getAllByText('Small sample').length).toBeGreaterThan(0)
    expect(screen.getByText(/Too few hours to compare reliably\./)).toBeTruthy()
    expect(screen.getByText(/does not show that weather causes the difference/)).toBeTruthy()
  })

  it('prints n beside every bar, in severity order', () => {
    const { container } = render(<WeatherChart result={result} provenance={run} />)
    const texts = [...svg(container).querySelectorAll('text')].map(t => t.textContent ?? '')
    for (const p of result.points) expect(texts).toContain('n = ' + count(p.n))
    const names = texts.filter(t => /rain|Clear|Mist/.test(t) && !t.startsWith('n ='))
    expect(names).toEqual(['Clear / few clouds', 'Mist / cloudy', 'Light rain or snow', 'Heavy rain or snow · Small sample'])
  })

  it('switches between mean and total, relabels the unit and announces the change', () => {
    const { container } = render(<WeatherChart result={result} provenance={run} />)
    const axis = () => [...svg(container).querySelectorAll('text')].map(t => t.textContent).join(' | ')
    expect(axis()).toContain('Mean rentals per observed hour')
    fireEvent.click(screen.getByRole('radio', { name: 'Total rentals' }))
    expect(announce).toHaveBeenCalledWith('Showing total rentals')
    expect(axis()).toContain('Total rentals (mean × observed hours)')
    expect(screen.getByText(/Unit changed/)).toBeTruthy()
    expect(screen.getByRole('figure').querySelector('figcaption')!.textContent).toContain(chartSummary(result, 'total'))
    fireEvent.click(screen.getByRole('radio', { name: 'Mean per hour' }))
    expect(announce).toHaveBeenLastCalledWith('Showing mean rentals per observed hour')
  })

  it('table numbers equal the result points', () => {
    render(<WeatherChart result={result} provenance={run} />)
    openNumbers()
    for (const p of result.points) {
      const cells = [...rowFor(p.group).querySelectorAll('td')].map(td => td.textContent)
      expect(cells.slice(0, 3)).toEqual([one(p.mean), count(p.n), count(Math.round(p.mean * p.n))])
      expect(cells[3]).toBe(p.n < 30 ? 'Small sample' : '')
    }
    expect(chartSummary(result)).toContain(one(result.points[0].mean))
  })

  it('prints totals as whole numbers of rentals, with no decimal place', () => {
    render(<WeatherChart result={result} provenance={run} />)
    expect(chartSummary(result, 'total')).toContain('2,338,173 over 11,413 observed hours')
    expect(chartSummary(result, 'total')).not.toMatch(/\d\.\d over/)
    openNumbers()
    expect(rowFor('Clear / few clouds').querySelectorAll('td')[2].textContent).toBe('2,338,173')
    expect(rowFor('Heavy rain or snow').querySelectorAll('td')[2].textContent).toBe('223')
  })

  it('says in visible text what n means', () => {
    render(<WeatherChart result={result} provenance={run} />)
    expect(screen.getByText(/n beside each bar = number of hours observed/)).toBeTruthy()
    expect(chartSummary(result)).toMatch(/\(n = [\d,]+ observed hours/)
  })
})

describe('WeekHeatmap', () => {
  const { run, result } = fixture('week')

  it('the busiest hour of the week in 2011–2012 is Tuesday 17:00: 544.3 (n = 104)', () => {
    const max = result.points.reduce((a, b) => (b.mean > a.mean ? b : a))
    expect([max.group, max.hour, one(max.mean), max.n]).toEqual(['Tue', 17, '544.3', 104])
    expect(chartSummary(result)).toContain('The busiest hour of the week is Tuesday at 17:00 with 544.3 mean rentals per observed hour (n = 104 observed hours)')
  })

  it('the fixed colour scale runs from 0 to 680.9, just above the busiest hour of the week in 2011, 2012 or both', () => {
    // Read directly: under jsdom, load.node.ts cannot resolve its file URL. tests/lab.test.ts loads it through loadBikes, which checks its hash.
    const data = fromCSV(readFileSync(join(process.cwd(), 'data', 'hour.csv'), 'utf8'))
    const peaks = periods.map(period => {
      const points = analyze(data, 'week', period).points
      return { period, ...points.reduce((a, b) => (b.mean > a.mean ? b : a)) }
    })
    const top = peaks.reduce((a, b) => (b.mean > a.mean ? b : a))
    expect([top.period, top.group, top.hour, one(top.mean), top.n]).toEqual(['2012', 'Thu', 17, '680.8', 52])
    expect(DEFAULT_WEEK_DOMAIN).toEqual([0, 680.9])
    for (const peak of peaks) expect(DEFAULT_WEEK_DOMAIN[1], peak.period).toBeGreaterThanOrEqual(peak.mean)
    expect(DEFAULT_WEEK_DOMAIN[1] - top.mean).toBeLessThan(0.1)
    // No supported period stretches the scale, so the same colour means the same number in every view.
    for (const period of periods) {
      render(<WeekHeatmap result={analyze(data, 'week', period)} provenance={run} />)
      expect(screen.queryByText('Colour scale changed'), period).toBeNull()
      cleanup()
    }
  })

  it('lays out 7 rows Sun–Sat and 24 hour columns, with a labelled colour legend', () => {
    const { container } = render(<WeekHeatmap result={result} provenance={run} />)
    const plot = svg(container)
    const ticks = [...plot.querySelectorAll('g[data-mark="y-axis tick label"] text')].map(t => t.textContent)
    expect(ticks).toEqual(weekdays)
    expect(weekdays[0]).toBe('Sun')
    expect(plot.querySelectorAll('g[data-mark="cell"] rect').length).toBe(168)
    expect(screen.getByText(/Colour key/)).toBeTruthy()
    expect(container.querySelector('.lab-chart__legend-ramp svg')?.getAttribute('aria-label')).toMatch(/0\.0.*680\.9/)
    expect(screen.queryByText('Colour scale changed')).toBeNull()
    openNumbers()
    for (const p of result.points) {
      const cell = table().querySelector(`td[data-cell="${p.group}-${p.hour}"]`)!
      expect(cell.textContent).toBe(one(p.mean) + 'n ' + count(p.n))
    }
  })

  it('draws a missing cell distinctly from a zero cell', () => {
    const points = weekdays.flatMap(group => Array.from({ length: 24 }, (_, hour) => ({ group, hour, mean: 10 + hour, n: 50 })))
      .filter(p => !(p.group === 'Sun' && p.hour === 3))
      .map(p => (p.group === 'Mon' && p.hour === 4 ? { ...p, mean: 0 } : p))
    const custom = resultSchema.parse({ period: 'both', points, n: 50 * points.length, answer: 'test' })
    const { container } = render(<WeekHeatmap result={custom} provenance={run} />)
    const plot = svg(container)
    const hatched = [...plot.querySelectorAll('rect')].filter(r => (r.getAttribute('fill') ?? r.parentElement?.getAttribute('fill') ?? '').startsWith('url(#'))
    expect(hatched.length).toBe(1)
    expect(plot.querySelector('pattern')).toBeTruthy()
    expect(plot.querySelectorAll('g[data-mark="cell"] rect').length).toBe(168)
    expect(chartSummary(custom)).toContain('1 of 168 hours of the week have no observations')
    expect(chartSummary(custom)).toContain('the quietest is Monday at 04:00 with 0.0')
    expect(chartSummary(custom)).not.toMatch(/weekday/)
    openNumbers()
    expect(table().querySelector('td[data-cell="Sun-3"]')!.textContent).toBe('No data')
    expect(table().querySelector('td[data-cell="Mon-4"]')!.textContent).toBe('0.0n 50')
    expect(screen.getByText(/No data \(no hours observed\): 1 cell$/)).toBeTruthy()
  })

  it('says so when the colour scale changes', () => {
    render(<WeekHeatmap result={result} provenance={run} domain={[0, 800]} />)
    expect(screen.getByText('Colour scale changed')).toBeTruthy()
    cleanup()
    // A hypothetical value above every supported period's peak: the scale stretches and says so.
    const hot = resultSchema.parse({ ...result, points: result.points.map(p => (p.group === 'Fri' && p.hour === 17 ? { ...p, mean: 750 } : p)) })
    render(<WeekHeatmap result={hot} provenance={run} />)
    expect(screen.getByText('Colour scale changed')).toBeTruthy()
    expect(screen.getByText(/above the usual top of the scale/)).toBeTruthy()
  })

  it('swaps to fewer hour ticks under 480px', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 340 })
    try {
      const { container } = render(<WeekHeatmap result={result} provenance={run} />)
      const ticks = [...svg(container).querySelectorAll('g[data-mark="x-axis tick label"] text')].map(t => t.textContent)
      expect(ticks).toEqual(['0', '6', '12', '18', '23'])
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original)
    }
  })
})

describe('ChartFigure frame', () => {
  const hourly = fixture('hourly')

  it('opens with a head band holding the title and the TierLabel, inside the figcaption', () => {
    const { container } = render(<HourlyChart result={hourly.result} provenance={hourly.run} />)
    const caption = screen.getByRole('figure').querySelector('figcaption')!
    const head = caption.querySelector('.lab-chart__head')!
    expect(head.querySelector('.lab-chart__title')?.textContent).toBe('Two rhythms in one day')
    const label = head.querySelector('.lab-tier')!
    expect(label.getAttribute('data-tier')).toBe('replay')
    expect(label.textContent).toBe(tierLabel(hourly.run))
    // The label's icon is decoration; the words carry the meaning.
    expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // One tier label per figure, and no leftover chip.
    expect(container.querySelectorAll('.lab-tier').length).toBe(1)
    expect(container.querySelector('[data-slot="badge"].lab-chart__tier')).toBeNull()
  })

  it('never calls a simulated run a replay: the label and the stat tone follow the run', () => {
    const simulated = { ...hourly.run, tier: 'simulated' as const }
    const { container } = render(<HourlyChart result={hourly.result} provenance={simulated} />)
    const label = container.querySelector('.lab-tier')!
    expect(label.getAttribute('data-tier')).toBe('simulated')
    expect(label.textContent).toBe('Simulated in your browser')
    expect(container.textContent).not.toContain('Recorded replay')
    const tones = [...container.querySelectorAll('.lab-stat')].map(t => t.getAttribute('data-tone'))
    expect(tones).toEqual(['magenta', 'magenta'])
  })

  it('shows two peak stats above the plot, with the same numbers as the summary sentence and the table', () => {
    const { container } = render(<HourlyChart result={hourly.result} provenance={hourly.run} />)
    const tiles = [...container.querySelectorAll('.lab-chart__stats .lab-stat')]
    expect(tiles.map(t => t.getAttribute('data-tone'))).toEqual(['blue', 'blue'])
    const stats = tiles.map(t => ({ value: t.querySelector('.lab-stat__value')!.textContent, label: t.querySelector('.lab-stat__label')!.textContent }))
    expect(stats).toEqual(hourlyStats(hourly.result))
    expect(stats[0]).toEqual({ value: '525.3', label: 'Working days peak · 17:00' })
    for (const stat of stats) expect(chartSummary(hourly.result)).toContain(stat.value)
    // Above the plot: the stats come before the plot in reading order.
    const plot = container.querySelector('.lab-chart__plot')!
    expect(tiles[0].compareDocumentPosition(plot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Computed, not written in: the stats follow the data.
    const shifted = resultSchema.parse({ ...hourly.result, points: hourly.result.points.map(p => (p.group === 'Working days' && p.hour === 8 ? { ...p, mean: 900 } : p)) })
    expect(hourlyStats(shifted)[0]).toEqual({ value: '900.0', label: 'Working days peak · 08:00' })
  })

  it('"Show the numbers" hides the table while closed and shows it while open', () => {
    const { container } = render(<HourlyChart result={hourly.result} provenance={hourly.run} />)
    const button = screen.getByRole('button', { name: 'Show the numbers' })
    const region = container.querySelector('.lab-chart__table-wrap')!
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(region.closest('[hidden]')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Hourly numbers, scrollable' })).toBeNull()
    openNumbers()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(region.closest('[hidden]')).toBeNull()
    expect(screen.getByRole('region', { name: 'Hourly numbers, scrollable' })).toBeTruthy()
    expect(table()).toBeTruthy()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('exposes each plot as one named image: Plot\'s inner mark and axis groups carry no aria-label', () => {
    const { container } = render(<WeekHeatmap result={fixture('week').result} provenance={hourly.run} />)
    const images = [...container.querySelectorAll('.lab-chart__plot > svg, .lab-chart__legend-ramp > svg')]
    expect(images.length).toBe(2)
    for (const image of images) {
      expect(image.getAttribute('role')).toBe('img')
      expect(image.getAttribute('aria-label')).toBeTruthy()
      expect(image.querySelectorAll('[aria-label]').length).toBe(0)
    }
    // The names are kept as data-mark for debugging and tests.
    expect(svg(container).querySelectorAll('g[data-mark]').length).toBeGreaterThan(0)
  })
})

describe('chart stats', () => {
  it('weather stats follow the measure on show, and the selected measure carries a check', () => {
    const { run, result } = fixture('weather')
    const { container } = render(<WeatherChart result={result} provenance={run} />)
    const values = () => [...container.querySelectorAll('.lab-stat')].map(t => [t.querySelector('.lab-stat__value')!.textContent, t.querySelector('.lab-stat__label')!.textContent])
    expect(values()).toEqual([
      [one(result.points.find(p => p.group === 'Clear / few clouds')!.mean), 'Highest · Clear / few clouds'],
      [one(result.points.find(p => p.group === 'Heavy rain or snow')!.mean), 'Lowest · Heavy rain or snow · small sample'],
    ])
    const checked = () => [...container.querySelectorAll('.lab-chart__toggle-item')].filter(b => b.querySelector('.lab-chart__check')).map(b => b.textContent)
    expect(checked()).toEqual(['Mean per hour'])
    fireEvent.click(screen.getByRole('radio', { name: 'Total rentals' }))
    expect(values()[0]).toEqual(['2,338,173', 'Most in total · Clear / few clouds'])
    expect(values()[1]).toEqual(['223', 'Fewest in total · Heavy rain or snow · small sample'])
    expect(checked()).toEqual(['Total rentals'])
    for (const [value] of values()) expect(chartSummary(result, 'total')).toContain(value)
  })

  it('week stats are the busiest and quietest hours the summary names', () => {
    const { result } = fixture('week')
    const [busiest, quietest] = weekStats(result)
    expect(busiest).toEqual({ value: '544.3', label: 'Busiest · Tuesday 17:00' })
    expect(quietest.label).toMatch(/^Quietest · \w+day \d\d:00$/)
    expect(chartSummary(result)).toContain(`the quietest is ${quietest.label.replace('Quietest · ', '').replace(' ', ' at ')} with ${quietest.value}`)
  })
})

describe('WeekHeatmap low end', () => {
  const { run, result } = fixture('week')
  const fills = (container: HTMLElement) => [...svg(container).querySelectorAll('g[data-mark="cell"] rect')]
    .map(r => r.getAttribute('fill') ?? '').filter(f => f.startsWith('rgb'))

  it('keeps every observed cell at 3:1 or more against the dark page, so the small hours never vanish', () => {
    document.documentElement.style.setProperty('--paper', 'rgb(18, 18, 18)')
    const { container } = render(<WeekHeatmap result={result} provenance={run} />)
    const page = parseColor('rgb(18, 18, 18)')!
    const cells = fills(container)
    expect(cells.length).toBe(result.points.length)
    for (const fill of cells) expect(contrast(parseColor(fill)!, page), fill).toBeGreaterThanOrEqual(MARK_CONTRAST)
    // The plain scheme's darkest blue would not clear it on this page.
    expect(contrast(parseColor(cividisFrom(0)(0))!, page)).toBeLessThan(MARK_CONTRAST)
    // The legend ramp is drawn from the same lifted scale.
    const ramp = [...container.querySelectorAll('.lab-chart__legend-ramp rect')].map(r => r.getAttribute('fill') ?? '')
    expect(contrast(parseColor(ramp[0])!, page)).toBeGreaterThanOrEqual(MARK_CONTRAST)
  })

  it('leaves the scheme whole on the light page', () => {
    document.documentElement.style.setProperty('--paper', 'rgb(255, 255, 255)')
    expect(schemeStart(cividisFrom(0), 'rgb(255, 255, 255)')).toBe(0)
    const points = weekdays.flatMap(group => Array.from({ length: 24 }, (_, hour) => ({ group, hour, mean: group === 'Mon' && hour === 4 ? 0 : 100, n: 50 })))
    const custom = resultSchema.parse({ period: 'both', points, n: 50 * points.length, answer: 'test' })
    const { container } = render(<WeekHeatmap result={custom} provenance={run} />)
    expect(fills(container)).toContain(cividisFrom(0)(0))
  })
})

describe('chart source hygiene', () => {
  it('has no hex colour literals in src/charts', () => {
    const dir = join(process.cwd(), 'src', 'charts')
    const files = readdirSync(dir)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8')
      expect(text.match(/#[0-9a-f]{3,8}\b/gi), file).toBeNull()
    }
  })
})
