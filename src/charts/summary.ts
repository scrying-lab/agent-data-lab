// One-sentence summaries built from the validated analytics result. The same sentence is the
// visible caption and the chart's aria-description, and it formats numbers exactly as the
// "Show the numbers" table does, so prose and table can be checked against each other in tests.
import { weatherLabels, weekdays, type Point, type Result, type Scenario } from '../../analytics/contracts'
import { MEAN_UNIT, SMALL_SAMPLE, clock, count, dayName, one, periodLabel } from './format'

export type Measure = 'mean' | 'total'
export const HOURLY_SERIES = ['Working days', 'Nonworking days'] as const
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Total rentals in a group: its mean per observed hour times the hours observed. */
export const total = (p: Point): number => p.mean * p.n
/** A total is a whole number of rentals: round away floating-point noise and print it as a count. */
export const totalText = (p: Point): string => count(Math.round(total(p)))
export const measureOf = (p: Point, measure: Measure): number => (measure === 'total' ? total(p) : p.mean)
export const isSmallSample = (p: Point): boolean => p.n < SMALL_SAMPLE

const highest = (points: Point[], value: (p: Point) => number = p => p.mean) =>
  points.reduce((best, p) => (value(p) > value(best) ? p : best))
const lowest = (points: Point[], value: (p: Point) => number = p => p.mean) =>
  points.reduce((least, p) => (value(p) < value(least) ? p : least))

/** Which lesson a result belongs to, read from its own groups (results do not carry a scenario). */
export function scenarioOf(result: Result): Scenario {
  if (result.points.every(p => p.hour === null)) return 'weather'
  if (result.points.every(p => weekdays.includes(p.group))) return 'week'
  return 'hourly'
}

/** Weather categories in severity order, then any unexpected group in data order. */
export function weatherOrder(result: Result): string[] {
  const present = new Set(result.points.map(p => p.group))
  const known = weatherLabels.filter(label => present.has(label))
  return [...known, ...[...present].filter(group => !weatherLabels.includes(group))]
}

export function hourlySummary(result: Result): string {
  const peaks = HOURLY_SERIES.flatMap(series => {
    const points = result.points.filter(p => p.group === series && p.hour !== null)
    return points.length ? [highest(points)] : []
  })
  if (!peaks.length) return `No hourly observations for ${periodLabel(result.period)}.`
  const [first, ...rest] = peaks.map((p, i) =>
    i === 0
      ? `${p.group} peak at ${clock(p.hour ?? 0)} with ${one(p.mean)} ${MEAN_UNIT} (n = ${count(p.n)} observed hours)`
      : `${p.group.toLowerCase()} peak at ${clock(p.hour ?? 0)} with ${one(p.mean)} (n = ${count(p.n)})`)
  return [first, ...rest].join('; ') + `, ${periodLabel(result.period)}.`
}

export function weatherSummary(result: Result, measure: Measure = 'mean'): string {
  const value = (p: Point) => measureOf(p, measure)
  const top = highest(result.points, value)
  const bottom = lowest(result.points, value)
  const small = (p: Point) => (isSmallSample(p) ? ', a small sample' : '')
  const lead = measure === 'total'
    ? `${top.group} has the most rentals in total, ${totalText(top)} over ${count(top.n)} observed hours`
    : `${top.group} is highest at ${one(top.mean)} ${MEAN_UNIT} (n = ${count(top.n)} observed hours${small(top)})`
  if (bottom === top) return `${lead}, ${periodLabel(result.period)}.`
  const tail = measure === 'total'
    ? `${bottom.group} the fewest, ${totalText(bottom)} over ${count(bottom.n)} observed hours${small(bottom)}`
    : `${bottom.group} lowest at ${one(bottom.mean)} (n = ${count(bottom.n)}${small(bottom)})`
  return `${lead}; ${tail}, ${periodLabel(result.period)}.`
}

export function weekSummary(result: Result): string {
  const cells = result.points.filter(p => p.hour !== null && weekdays.includes(p.group))
  if (!cells.length) return `No day-and-hour observations for ${periodLabel(result.period)}.`
  const top = highest(cells)
  const bottom = lowest(cells)
  const slots = weekdays.length * HOURS.length
  const missing = slots - new Set(cells.map(p => p.group + ' ' + p.hour)).size
  const gaps = missing ? `; ${missing} of ${slots} hours of the week have no observations` : ''
  return `The busiest hour of the week is ${dayName(top.group)} at ${clock(top.hour ?? 0)} with ${one(top.mean)} ${MEAN_UNIT} (n = ${count(top.n)} observed hours); `
    + `the quietest is ${dayName(bottom.group)} at ${clock(bottom.hour ?? 0)} with ${one(bottom.mean)} (n = ${count(bottom.n)})${gaps}, ${periodLabel(result.period)}.`
}

/**
 * A headline number above the plot. `value` is formatted exactly as the summary sentence and the
 * table format it, and `label` names what it is (kept short: it is set in the label role).
 */
export type Stat = { value: string; label: string }

/** Each series' peak hour, the same points the summary sentence names. */
export function hourlyStats(result: Result): Stat[] {
  return HOURLY_SERIES.flatMap(series => {
    const points = result.points.filter(p => p.group === series && p.hour !== null)
    if (!points.length) return []
    const peak = highest(points)
    return [{ value: one(peak.mean), label: `${series} peak · ${clock(peak.hour ?? 0)}` }]
  })
}

/** The highest and lowest weather category for the measure on show, as the summary sentence names them. */
export function weatherStats(result: Result, measure: Measure = 'mean'): Stat[] {
  if (!result.points.length) return []
  const value = (p: Point) => measureOf(p, measure)
  const top = highest(result.points, value)
  const bottom = lowest(result.points, value)
  const shown = (p: Point) => (measure === 'total' ? totalText(p) : one(p.mean))
  const small = (p: Point) => (isSmallSample(p) ? ' · small sample' : '')
  const [most, least] = measure === 'total' ? ['Most in total', 'Fewest in total'] : ['Highest', 'Lowest']
  const stats = [{ value: shown(top), label: `${most} · ${top.group}${small(top)}` }]
  if (bottom !== top) stats.push({ value: shown(bottom), label: `${least} · ${bottom.group}${small(bottom)}` })
  return stats
}

/** The busiest and quietest hour of the week, as the summary sentence names them. */
export function weekStats(result: Result): Stat[] {
  const cells = result.points.filter(p => p.hour !== null && weekdays.includes(p.group))
  if (!cells.length) return []
  const top = highest(cells)
  const bottom = lowest(cells)
  const at = (p: Point) => `${dayName(p.group)} ${clock(p.hour ?? 0)}`
  return [
    { value: one(top.mean), label: `Busiest · ${at(top)}` },
    { value: one(bottom.mean), label: `Quietest · ${at(bottom)}` },
  ]
}

/** The headline numbers for any analytics result. */
export function chartStats(result: Result, measure: Measure = 'mean'): Stat[] {
  const scenario = scenarioOf(result)
  if (scenario === 'weather') return weatherStats(result, measure)
  if (scenario === 'week') return weekStats(result)
  return hourlyStats(result)
}

/** The one-sentence summary for any analytics result: the chart's caption and aria-description. */
export function chartSummary(result: Result, measure: Measure = 'mean'): string {
  const scenario = scenarioOf(result)
  if (scenario === 'weather') return weatherSummary(result, measure)
  if (scenario === 'week') return weekSummary(result)
  return hourlySummary(result)
}
