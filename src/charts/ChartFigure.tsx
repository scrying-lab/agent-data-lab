import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { tierLabel, type LabRun, type Tier } from '../../agent/run-contract'
import { Button } from '../components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import { StatTile, TierLabel, type StatTone } from '../shell/primitives'
import type { Stat } from './summary'
import './charts.css'

export type Provenance = Pick<LabRun, 'tier' | 'provider' | 'recordedAt'>

/** Stat tiles follow provenance: blue for replays, magenta for simulated runs (spec §2b). */
const toneFor = (tier: Tier): StatTone => (tier === 'simulated' ? 'magenta' : 'blue')

type Props = {
  /** Short display title, e.g. "Two rhythms in one day". */
  title: string
  /** The one-sentence data summary; also the chart's aria-description. */
  summary: string
  /** Visible source / period / aggregation line. */
  source: string
  /** The run that produced the numbers. Its tierLabel() is shown once, on the figure. */
  provenance: Provenance
  /** The headline numbers above the plot, computed from the same points as the summary sentence. */
  stats: readonly Stat[]
  /** Optional controls (e.g. the weather measure toggle), placed above the plot. */
  controls?: ReactNode
  /** The plot and any notes that belong under it. */
  children: ReactNode
  /** Accessible name of the scrollable table region. */
  tableLabel: string
  table: ReactNode
}

/**
 * The frame shared by the three charts: one 2px frame around a <figure>. Its <figcaption> opens
 * with a head band (the title and the TierLabel on the surface tint), then the summary sentence
 * and the source line. Below it: the peak stats, any controls, the plot, and a "Show the numbers"
 * disclosure with a real table, hidden while the disclosure is closed. Nothing is available only
 * on hover.
 */
export function ChartFigure({ title, summary, source, provenance, stats, controls, children, tableLabel, table }: Props) {
  const [open, setOpen] = useState(false)
  const tone = toneFor(provenance.tier)
  return (
    <figure className="lab-chart">
      <figcaption className="lab-chart__caption">
        <span className="lab-chart__head">
          <span className="lab-chart__title">{title}</span>
          <TierLabel tier={provenance.tier} className="lab-chart__tier">{tierLabel(provenance)}</TierLabel>
        </span>
        <span className="lab-chart__summary">{summary}</span>
        <span className="lab-chart__source">{source}</span>
      </figcaption>
      <div className="lab-chart__body">
        {stats.length > 0 && (
          <div className="lab-chart__stats">
            {stats.map(stat => <StatTile key={stat.label} value={stat.value} label={stat.label} tone={tone} className="lab-chart__stat" />)}
          </div>
        )}
        {controls}
        {children}
        <Collapsible open={open} onOpenChange={setOpen} className="lab-chart__numbers">
          <CollapsibleTrigger asChild>
            <Button variant="tertiary" className="lab-chart__button">
              <ChevronDown aria-hidden="true" className="lab-chart__chevron" />
              Show the numbers
            </Button>
          </CollapsibleTrigger>
          {/* Mounted for the trigger's aria-controls, but hidden until opened (forceMount alone never hides it). */}
          <CollapsibleContent forceMount hidden={!open}>
            {/* Focusable so keyboard users can scroll a wide table inside the frame instead of the page. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="lab-chart__table-wrap" role="region" aria-label={tableLabel} tabIndex={0}>
              {table}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </figure>
  )
}
