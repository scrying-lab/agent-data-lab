import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { tierLabel, type LabRun } from '../../agent/run-contract'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible'
import './charts.css'

export type Provenance = Pick<LabRun, 'tier' | 'provider' | 'recordedAt'>

type Props = {
  /** Short display title, e.g. "Two rhythms in one day". */
  title: string
  /** The one-sentence data summary; also the chart's aria-description. */
  summary: string
  /** Visible source / period / aggregation line. */
  source: string
  /** The run that produced the numbers. Its tierLabel() is shown once, on the figure. */
  provenance: Provenance
  /** Optional controls (e.g. the weather measure toggle), placed above the plot. */
  controls?: ReactNode
  /** The plot and any notes that belong under it. */
  children: ReactNode
  /** Accessible name of the scrollable table region. */
  tableLabel: string
  table: ReactNode
}

/**
 * The frame shared by the three charts: a <figure> whose <figcaption> carries the title, the
 * tier label, the summary sentence and the source line; then the plot; then a "Show the numbers"
 * disclosure with a real table. Nothing is available only on hover.
 */
export function ChartFigure({ title, summary, source, provenance, controls, children, tableLabel, table }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <figure className="lab-chart">
      <figcaption className="lab-chart__caption">
        <span className="lab-chart__heading">
          <span className="lab-chart__title">{title}</span>
          <Badge variant="outline" className="lab-chart__tier">{tierLabel(provenance)}</Badge>
        </span>
        <span className="lab-chart__summary">{summary}</span>
        <span className="lab-chart__source">{source}</span>
      </figcaption>
      {controls}
      {children}
      <Collapsible open={open} onOpenChange={setOpen} className="lab-chart__numbers">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="lab-chart__button">
            <ChevronDown aria-hidden="true" className="lab-chart__chevron" />
            Show the numbers
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount>
          {/* Focusable so keyboard users can scroll a wide table inside the frame instead of the page. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="lab-chart__table-wrap" role="region" aria-label={tableLabel} tabIndex={0}>
            {table}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </figure>
  )
}
