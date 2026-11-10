import type { ReactNode } from 'react'
import './StatTile.css'

export type StatTone = 'blue' | 'magenta'

/** A number with its label on a tinted tile. The tone follows provenance: blue for replays, magenta for simulated runs. */
export function StatTile({ value, label, tone, className }: { value: ReactNode; label: ReactNode; tone: StatTone; className?: string }) {
  return (
    <div className={className ? `lab-stat ${className}` : 'lab-stat'} data-tone={tone}>
      <span className="lab-stat__value">{value}</span>
      <span className="lab-stat__label">{label}</span>
    </div>
  )
}
