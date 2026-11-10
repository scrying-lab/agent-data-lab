import type { LucideIcon } from 'lucide-react'
import { FlaskConical, History, Radio } from 'lucide-react'
import type { Tier } from '../../../agent/run-contract'
import './TierLabel.css'

const icons: Record<Tier, LucideIcon> = { replay: History, simulated: FlaskConical, live: Radio }

/**
 * The one label that says how a result was made: an icon cell in the tier's hue, then the label
 * text on a soft gradient, inside a 2px rule. Pass the text from tierLabel(run) as children,
 * unchanged; the label never rewrites or recases it. Not interactive.
 */
export function TierLabel({ tier, children, className }: { tier: Tier; children: string; className?: string }) {
  const Icon = icons[tier]
  return (
    <span className={className ? `lab-tier ${className}` : 'lab-tier'} data-tier={tier}>
      <span className="lab-tier__cell"><Icon aria-hidden="true" focusable="false" /></span>
      <span className="lab-tier__text">{children}</span>
    </span>
  )
}
