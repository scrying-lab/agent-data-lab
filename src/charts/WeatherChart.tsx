import { useCallback, useId, useMemo, useState } from 'react'
import * as Plot from '@observablehq/plot'
import type { Point, Result } from '../../analytics/contracts'
import { announce } from '../announce'
import { Badge } from '../components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { ChartFigure, type Provenance } from './ChartFigure'
import { PlotMount } from './PlotMount'
import { useChartColors } from './hooks'
import { MEAN_UNIT, SMALL_SAMPLE, SMALL_SAMPLE_TEXT, TOTAL_UNIT, count, one, sourceLabel } from './format'
import { isSmallSample, measureOf, totalText, weatherOrder, weatherSummary, type Measure } from './summary'

const ROW = 56
const compact = new Intl.NumberFormat('en-US', { notation: 'compact' })
const axisLabel: Record<Measure, string> = {
  mean: 'Mean rentals per observed hour',
  total: 'Total rentals (mean × observed hours)',
}
const spoken: Record<Measure, string> = {
  mean: 'Showing mean rentals per observed hour',
  total: 'Showing total rentals',
}

/**
 * Rentals by weather category, in severity order, as horizontal bars with n printed beside every bar.
 * A toggle switches between the mean per observed hour and the total (mean × n).
 */
export function WeatherChart({ result, provenance }: { result: Result; provenance: Provenance }) {
  const colors = useChartColors()
  const [measure, setMeasure] = useState<Measure>('mean')
  const labelId = useId()
  const order = useMemo(() => weatherOrder(result), [result])
  const points = useMemo(() => order.map(group => result.points.find(p => p.group === group)).filter((p): p is Point => !!p), [order, result])
  const small = points.filter(isSmallSample)
  const summary = weatherSummary(result, measure)

  const render = useCallback((width: number) => {
    const value = (p: Point) => measureOf(p, measure)
    const name = (p: Point) => p.group + (isSmallSample(p) ? ' · Small sample' : '')
    return Plot.plot({
      width,
      height: order.length * ROW + 44,
      marginLeft: 8,
      marginRight: 84,
      marginTop: 8,
      marginBottom: 40,
      style: { background: 'transparent', color: 'currentColor', fontFamily: 'var(--font-mono)', fontSize: '11px' },
      x: { label: axisLabel[measure], grid: true, ticks: width < 480 ? 3 : 5, tickFormat: (d: number) => compact.format(d), labelAnchor: 'left', labelArrow: 'none' },
      y: { domain: order, axis: null, padding: 0 },
      marks: [
        Plot.barX(points, { x: value, y: 'group', fill: colors.series1, insetTop: 24, insetBottom: 8 }),
        // Category names sit above their bars so long names never squeeze the plot at 320px.
        Plot.text(points, { x: 0, y: 'group', text: name, textAnchor: 'start', dx: 4, dy: -12, fill: 'currentColor', fontWeight: 600 }),
        Plot.text(points, { x: value, y: 'group', text: (p: Point) => 'n = ' + count(p.n), textAnchor: 'start', dx: 6, dy: 8, fill: 'currentColor' }),
        Plot.ruleX([0]),
      ],
      ariaLabel: 'Bar chart: ' + (measure === 'total' ? TOTAL_UNIT : MEAN_UNIT) + ' by weather category, from clear to heavy rain or snow',
      ariaDescription: summary,
    })
  }, [points, order, measure, colors, summary])

  const choose = (next: string) => {
    if (next !== 'mean' && next !== 'total') return // a single toggle group reports '' when the pressed item is pressed again
    if (next === measure) return
    setMeasure(next)
    announce(spoken[next])
  }

  return (
    <ChartFigure
      title="Riding through the weather"
      summary={summary}
      source={sourceLabel(result.period, measure === 'total' ? TOTAL_UNIT + ' (mean × observed hours)' : MEAN_UNIT)}
      provenance={provenance}
      controls={
        <div className="lab-chart__controls">
          <span id={labelId} className="lab-chart__control-label">Measure</span>
          <ToggleGroup type="single" value={measure} onValueChange={choose} aria-labelledby={labelId} className="lab-chart__toggle">
            <ToggleGroupItem value="mean" className="lab-chart__toggle-item">Mean per hour</ToggleGroupItem>
            <ToggleGroupItem value="total" className="lab-chart__toggle-item">Total rentals</ToggleGroupItem>
          </ToggleGroup>
        </div>
      }
      tableLabel="Weather numbers, scrollable"
      table={
        <table className="lab-chart__table">
          <caption>Rentals by weather category, in order of severity</caption>
          <thead>
            <tr>
              <th scope="col">Weather</th>
              <th scope="col">Mean per observed hour</th>
              <th scope="col">Observed hours (n)</th>
              <th scope="col">Total rentals</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.group}>
                <th scope="row">{p.group}</th>
                <td>{one(p.mean)}</td>
                <td>{count(p.n)}</td>
                <td>{totalText(p)}</td>
                <td>{isSmallSample(p) ? 'Small sample' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <PlotMount render={render} />
      <p className="lab-chart__key">n beside each bar = number of hours observed in that weather</p>
      {measure === 'total' && (
        <p className="lab-chart__note lab-chart__note--unit">
          Unit changed: the bars now show total rentals, not a mean. Categories with more observed hours look bigger
          simply because there were more of them.
        </p>
      )}
      {small.map(p => (
        <p key={p.group} className="lab-chart__flag">
          <Badge variant="outline" className="lab-chart__flag-badge">Small sample</Badge>
          <span>{p.group}: only {count(p.n)} observed hours (fewer than {SMALL_SAMPLE}). {SMALL_SAMPLE_TEXT}</span>
        </p>
      ))}
      <p className="lab-chart__note">
        This compares observations. It does not show that weather causes the difference: season and time of day
        change along with the weather.
      </p>
    </ChartFigure>
  )
}
