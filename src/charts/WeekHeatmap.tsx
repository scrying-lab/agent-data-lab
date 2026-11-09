import { useCallback, useId, useMemo } from 'react'
import * as Plot from '@observablehq/plot'
import { weekdays, type Point, type Result } from '../../analytics/contracts'
import { ChartFigure, type Provenance } from './ChartFigure'
import { PlotMount } from './PlotMount'
import { useChartColors } from './hooks'
import { MEAN_UNIT, clock, count, one, sourceLabel } from './format'
import { HOURS, weekSummary } from './summary'

/**
 * The fixed colour scale: 0 to just above the busiest hour of the week in any period the lab
 * supports (2011, 2012 or both). The busiest is Thursday 17:00 in 2012, 680.85 mean rentals
 * per observed hour (n = 52), rounded up to one decimal. Both years pooled peak lower, at
 * Tuesday 17:00 (544.3). Fixed so that the same colour means the same number in every view.
 */
export const DEFAULT_WEEK_DOMAIN: readonly [number, number] = [0, 680.9]

type Cell = { day: string; hour: number; point: Point | null }
const SVG = 'http://www.w3.org/2000/svg'

/** The colour scale in use, and whether it differs from the fixed default. Data above the top extends it. */
export function effectiveDomain(result: Result, domain: readonly [number, number]) {
  const max = Math.max(...result.points.map(p => p.mean))
  const scale: [number, number] = [domain[0], Math.max(domain[1], max)]
  const changed = scale[0] !== DEFAULT_WEEK_DOMAIN[0] || scale[1] !== DEFAULT_WEEK_DOMAIN[1]
  return { scale, changed, extended: max > domain[1], max }
}

/**
 * Seven rows (Sun–Sat), 24 hour columns, Plot's cividis scheme on a fixed domain.
 * Hours with no observations are drawn with a diagonal hatch and read "No data" in the table: never zero.
 */
export function WeekHeatmap({ result, provenance, domain = DEFAULT_WEEK_DOMAIN }: {
  result: Result
  provenance: Provenance
  /** Colour scale [min, max] in mean rentals per observed hour. Defaults to DEFAULT_WEEK_DOMAIN. */
  domain?: readonly [number, number]
}) {
  const colors = useChartColors()
  const patternId = 'lab-no-data-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const summary = weekSummary(result)
  const { scale, changed, extended, max } = effectiveDomain(result, domain)
  const [low, high] = scale
  const cells = useMemo<Cell[]>(() => weekdays.flatMap(day => HOURS.map(hour => ({
    day, hour, point: result.points.find(p => p.group === day && p.hour === hour) ?? null,
  }))), [result])
  const missing = cells.filter(c => !c.point).length
  const color = useMemo<Plot.ScaleOptions>(() => ({ type: 'linear', scheme: 'cividis', domain: [low, high], clamp: true }), [low, high])

  const render = useCallback((width: number) => {
    const narrow = width < 480
    const hatch: Plot.RenderFunction = (_index, _scales, _values, _dimensions, context) => {
      const doc = context.document
      const defs = doc.createElementNS(SVG, 'defs')
      const pattern = doc.createElementNS(SVG, 'pattern')
      pattern.setAttribute('id', patternId)
      pattern.setAttribute('patternUnits', 'userSpaceOnUse')
      pattern.setAttribute('width', '6')
      pattern.setAttribute('height', '6')
      pattern.setAttribute('patternTransform', 'rotate(45)')
      const ground = doc.createElementNS(SVG, 'rect')
      ground.setAttribute('width', '6')
      ground.setAttribute('height', '6')
      ground.setAttribute('fill', colors.paper)
      const stripe = doc.createElementNS(SVG, 'line')
      stripe.setAttribute('x1', '0')
      stripe.setAttribute('y1', '0')
      stripe.setAttribute('x2', '0')
      stripe.setAttribute('y2', '6')
      stripe.setAttribute('stroke', colors.ink)
      stripe.setAttribute('stroke-width', '2')
      pattern.append(ground, stripe)
      defs.append(pattern)
      return defs
    }
    const observed = cells.filter(c => c.point)
    const empty = cells.filter(c => !c.point)
    return Plot.plot({
      width,
      height: 7 * 30 + 52,
      marginLeft: 40,
      marginRight: 8,
      marginTop: 8,
      marginBottom: 40,
      padding: 0,
      style: { background: 'transparent', color: 'currentColor', fontFamily: 'var(--font-mono)', fontSize: '11px' },
      x: { label: 'Hour of day', domain: HOURS, ticks: narrow ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23], labelAnchor: 'center', labelArrow: 'none' },
      y: { label: null, domain: weekdays },
      color,
      marks: [
        hatch,
        Plot.cell(observed, { x: 'hour', y: 'day', fill: (c: Cell) => c.point?.mean, inset: 0.5 }),
        Plot.cell(empty, { x: 'hour', y: 'day', fill: `url(#${patternId})`, stroke: colors.ink, strokeWidth: 1, inset: 1 }),
      ],
      ariaLabel: `Heatmap: ${MEAN_UNIT} by day of the week (rows, Sunday to Saturday) and hour of day (columns)`,
      ariaDescription: summary,
    })
  }, [cells, colors, patternId, summary, color])

  const renderLegend = useCallback((width: number) => {
    const steps = Array.from({ length: 64 }, (_, i) => ({ a: low + ((high - low) * i) / 64, b: low + ((high - low) * (i + 1)) / 64 }))
    return Plot.plot({
      width: Math.min(width, 360),
      height: 46,
      marginLeft: 12,
      marginRight: 20,
      marginTop: 4,
      marginBottom: 24,
      style: { background: 'transparent', color: 'currentColor', fontFamily: 'var(--font-mono)', fontSize: '11px' },
      x: { domain: [low, high], ticks: 4, label: null },
      y: { axis: null, domain: [0, 1] },
      color,
      marks: [Plot.rect(steps, { x1: 'a', x2: 'b', y1: 0, y2: 1, fill: (s: { a: number; b: number }) => (s.a + s.b) / 2 })],
      ariaLabel: `Colour key: dark blue is ${one(low)}, yellow is ${one(high)} ${MEAN_UNIT}`,
    })
  }, [low, high, color])

  const byCell = (day: string, hour: number) => cells.find(c => c.day === day && c.hour === hour)?.point ?? null
  return (
    <ChartFigure
      title="A week of bike rentals"
      summary={summary}
      source={sourceLabel(result.period)}
      provenance={provenance}
      tableLabel="Day and hour numbers, scrollable"
      table={
        <table className="lab-chart__table lab-chart__table--grid">
          <caption>Mean rentals per observed hour, with observed hours (n), by hour (rows) and day of the week (columns). “No data” means no hour was observed; it is not zero.</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              {weekdays.map(day => <th key={day} scope="col">{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <th scope="row">{clock(hour)}</th>
                {weekdays.map(day => {
                  const p = byCell(day, hour)
                  return (
                    <td key={day} data-cell={day + '-' + hour}>
                      {p ? <>{one(p.mean)}<span className="lab-chart__n">n {count(p.n)}</span></> : 'No data'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <PlotMount render={render} />
      <div className="lab-chart__legend">
        <p className="lab-chart__legend-title">Colour key · {MEAN_UNIT}, {one(low)} to {one(high)}</p>
        <div className="lab-chart__legend-row">
          <PlotMount render={renderLegend} className="lab-chart__legend-ramp" />
          <span className="lab-chart__key-item"><span className="lab-chart__swatch lab-chart__swatch--none" aria-hidden="true" />No data (no hours observed){missing ? `: ${missing} ${missing === 1 ? 'cell' : 'cells'}` : ''}</span>
        </div>
      </div>
      {changed && (
        <p className="lab-chart__flag">
          <span className="lab-chart__flag-badge">Colour scale changed</span>
          <span>
            {extended
              ? `This period's busiest hour (${one(max)}) is above the usual top of the scale, so colours now run from ${one(low)} to ${one(high)}.`
              : `Colours here run from ${one(low)} to ${one(high)} instead of the usual ${one(DEFAULT_WEEK_DOMAIN[0])} to ${one(DEFAULT_WEEK_DOMAIN[1])}.`}
            {' '}The same colour does not mean the same number as in other views.
          </span>
        </p>
      )}
    </ChartFigure>
  )
}
