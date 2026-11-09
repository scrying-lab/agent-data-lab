import { useCallback, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import type { Point, Result } from '../../analytics/contracts'
import { ChartFigure, type Provenance } from './ChartFigure'
import { PlotMount } from './PlotMount'
import { useChartColors } from './hooks'
import { MEAN_UNIT, MEAN_VS_TOTAL, clock, count, one, sourceLabel } from './format'
import { HOURLY_SERIES, HOURS, hourlySummary } from './summary'

const NARROW = 480
const short: Record<string, string> = { 'Working days': 'Working', 'Nonworking days': 'Nonworking' }

/**
 * Working vs nonworking days, mean rentals per observed hour for each hour 0–23.
 * Series 1 is a solid line, series 2 dashed, and each is named by a label at its end,
 * so the chart never relies on colour alone.
 */
export function HourlyChart({ result, provenance }: { result: Result; provenance: Provenance }) {
  const colors = useChartColors()
  const summary = hourlySummary(result)
  const series = useMemo(() => HOURLY_SERIES.map((name, i) => ({
    name,
    stroke: i === 0 ? colors.series1 : colors.series2,
    dash: i === 0 ? undefined : '7 4',
    points: result.points.filter(p => p.group === name && p.hour !== null).sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0)),
  })).filter(s => s.points.length), [result, colors])

  const render = useCallback((width: number) => {
    const narrow = width < NARROW
    const ends = series.map(s => s.points[s.points.length - 1])
    const order = [...ends].sort((a, b) => b.mean - a.mean)
    const top = Math.max(1, ...series.flatMap(s => s.points.map(p => p.mean)))
    const marks: Plot.Markish[] = [Plot.ruleY([0])]
    for (const s of series) {
      const peak = s.points.reduce((best, p) => (p.mean > best.mean ? p : best))
      const end = s.points[s.points.length - 1]
      // End labels: the higher series sits above its line end, the lower one below, so they never collide.
      const dy = ends.length > 1 ? (order[0] === end ? -9 : 9) : 0
      marks.push(
        Plot.lineY(s.points, { x: 'hour', y: 'mean', stroke: s.stroke, strokeWidth: 2.5, strokeDasharray: s.dash }),
        Plot.dot([peak], { x: 'hour', y: 'mean', fill: s.stroke, r: 4 }),
        Plot.text([peak], { x: 'hour', y: 'mean', text: (p: Point) => one(p.mean), dy: -11, fill: 'currentColor', fontWeight: 600 }),
        Plot.text([end], { x: 'hour', y: 'mean', text: () => (narrow ? short[s.name] ?? s.name : s.name), dx: 6, dy, textAnchor: 'start', fill: 'currentColor', fontWeight: 600 }),
      )
    }
    return Plot.plot({
      width,
      height: 300,
      marginLeft: 44,
      marginRight: narrow ? 78 : 112,
      marginTop: 24,
      marginBottom: 40,
      style: { background: 'transparent', color: 'currentColor', fontFamily: 'var(--font-mono)', fontSize: '11px' },
      x: { label: 'Hour of day', domain: [0, 23], ticks: narrow ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23], labelAnchor: 'center', labelArrow: 'none' },
      // Headroom above the highest peak keeps its value label clear of the axis label.
      y: { label: 'Mean rentals per observed hour', grid: true, domain: [0, top * 1.15], nice: true, ticks: 5, labelArrow: 'none' },
      marks,
      ariaLabel: 'Line chart: ' + MEAN_UNIT + ' by hour of day, ' + series.map(s => s.name.toLowerCase()).join(' (solid) vs ') + (series.length > 1 ? ' (dashed)' : ''),
      ariaDescription: summary,
    })
  }, [series, summary])

  const byHour = (name: string, hour: number) => result.points.find(p => p.group === name && p.hour === hour)
  return (
    <ChartFigure
      title="Two rhythms in one day"
      summary={summary}
      source={sourceLabel(result.period)}
      provenance={provenance}
      tableLabel="Hourly numbers, scrollable"
      table={
        <table className="lab-chart__table">
          <caption>Mean rentals per observed hour and observed hours (n), by hour of day</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              {HOURLY_SERIES.flatMap(name => [
                <th key={name + '-mean'} scope="col">{name}: mean</th>,
                <th key={name + '-n'} scope="col">{name}: n</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <th scope="row">{clock(hour)}</th>
                {HOURLY_SERIES.flatMap(name => {
                  const p = byHour(name, hour)
                  return [
                    <td key={name + '-mean'}>{p ? one(p.mean) : 'No data'}</td>,
                    <td key={name + '-n'}>{p ? count(p.n) : '0'}</td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <PlotMount render={render} />
      <p className="lab-chart__key">
        <span className="lab-chart__key-item"><span className="lab-chart__line" aria-hidden="true" />Working days: solid line</span>
        <span className="lab-chart__key-item"><span className="lab-chart__line lab-chart__line--dashed" aria-hidden="true" />Nonworking days: dashed line</span>
      </p>
      <p className="lab-chart__note">{MEAN_VS_TOTAL}</p>
    </ChartFigure>
  )
}
