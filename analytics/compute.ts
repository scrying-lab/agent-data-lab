// Pure computation for the analytics lesson. Arquero only: no file system and no Node modules,
// so the same code can run in a browser. Reading the CSV from disk lives in load.node.ts.
import { op, type ColumnTable } from 'arquero'
import { weekdays, weatherLabels, resultSchema, type Period, type Point, type Result, type Scenario } from './contracts'

const columns: Record<Scenario, string[]> = { hourly: ['workingday', 'hr'], weather: ['weathersit'], week: ['weekday', 'hr'] }

type Rental = { yr: number; cnt: number }
type Group = { workingday: number; weathersit: number; weekday: number; hr?: number; n: number; mean: number }

function groupLabel(scenario: Scenario, row: Group): string {
  if (scenario === 'weather') return weatherLabels[row.weathersit - 1]
  if (scenario === 'week') return weekdays[row.weekday]
  return row.workingday ? 'Working days' : 'Nonworking days'
}

function describe(p: Point): string {
  const hour = p.hour === null ? '' : ' at ' + String(p.hour).padStart(2, '0') + ':00'
  return p.group + hour + ' averaged ' + p.mean.toFixed(1) + ' rentals per observed hour (n = ' + p.n + ').'
}

/**
 * Groups the observed hours and averages rentals in each group.
 * Each mean divides by the hours actually observed (n), so a sparse group keeps its true, small sample size.
 * Throws if the selection is empty or the result fails its schema.
 */
export function analyze(table: ColumnTable, scenario: Scenario, period: Period): Result {
  const observed = period === 'both'
    ? table
    : table.params({ yr: Number(period) - 2011 }).filter((d: Rental, p: { yr: number }) => d.yr === p.yr)
  const groups = observed.groupby(...columns[scenario]).rollup({ mean: (d: Rental) => op.mean(d.cnt), n: () => op.count() })
  const points: Point[] = (groups.objects() as Group[]).map(row => ({ group: groupLabel(scenario, row), hour: row.hr ?? null, n: row.n, mean: row.mean }))
  if (!points.length) throw Error('No observed hours in this selection')
  const ranked = [...points].sort((a, b) => b.mean - a.mean)
  const answer = scenario === 'hourly'
    ? ['Working days', 'Nonworking days'].flatMap(group => ranked.filter(p => p.group === group).slice(0, 1)).map(describe).join(' ')
    : describe(ranked[0]) + (scenario === 'weather'
      ? ' This is the highest observed category average. Weather and demand can both vary with season and time of day.'
      : ' This is the highest weekday–hour average in the selected period.')
  return resultSchema.parse({ period, points, n: observed.numRows(), answer })
}
