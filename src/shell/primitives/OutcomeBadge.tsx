import type { LucideIcon } from 'lucide-react'
import { CircleCheck, CircleSlash, ShieldCheck, TriangleAlert } from 'lucide-react'
import './OutcomeBadge.css'

export type OutcomeStatus = 'ok' | 'denied' | 'failed' | 'cancelled'

/** The word and icon for each outcome. A refusal is neutral: the gate working as designed. */
export const outcomeWords: Record<OutcomeStatus, string> = { ok: 'Allowed', denied: 'Refused', failed: 'Failed', cancelled: 'Cancelled' }
const icons: Record<OutcomeStatus, LucideIcon> = { ok: CircleCheck, denied: ShieldCheck, failed: TriangleAlert, cancelled: CircleSlash }

/** An outcome as a fill, a 2px border in the outcome colour, an icon and the word. Never colour alone. */
export function OutcomeBadge({ status, className }: { status: OutcomeStatus; className?: string }) {
  const Icon = icons[status]
  return (
    <span className={className ? `lab-outcome ${className}` : 'lab-outcome'} data-status={status}>
      <Icon aria-hidden="true" focusable="false" />
      <span className="lab-outcome__word">{outcomeWords[status]}</span>
    </span>
  )
}
