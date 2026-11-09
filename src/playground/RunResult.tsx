import { CircleCheck, CircleSlash, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { modelText, operatorText, tierLabel, type LabRun } from '../../agent/run-contract'

type Status = LabRun['outcome']['status']
const views: Record<Status, { label: string; Icon: LucideIcon }> = {
  ok: { label: 'Allowed', Icon: CircleCheck },
  // A refusal is the system working as designed, so it is styled neutrally.
  denied: { label: 'Refused', Icon: ShieldCheck },
  failed: { label: 'Failed', Icon: TriangleAlert },
  cancelled: { label: 'Cancelled', Icon: CircleSlash },
}

/** The gate stage that refused the run, if one did. */
export function refusalStage(run: LabRun): string | undefined {
  return run.events.find(e => e.kind === 'gate' && e.decision === 'deny' && e.code === run.outcome.code)?.stage
}

/** One sentence for the status line and the announcement. */
export function outcomeSentence(run: LabRun): string {
  const { status, code } = run.outcome
  if (status === 'ok') return `Allowed. ${run.finalText}`
  if (status === 'denied') return `Refused at the ${refusalStage(run) ?? 'gate'} check (${code}). Nothing was read.`
  if (status === 'cancelled') return 'Cancelled. The run was stopped before it finished.'
  return `Failed (${code}). ${code ? operatorText[code] : ''}`.trim()
}

/** A finished run. Model text is rendered as text only, never as HTML. */
export function RunResult({ run }: { run: LabRun }) {
  const { status, code } = run.outcome
  const { label, Icon } = views[status]
  return (
    <div className="pg-result" data-outcome={status}>
      <p className="pg-tier">{tierLabel(run)}</p>
      <p className="pg-outcome"><Icon aria-hidden="true" size={20} /><strong>{label}</strong></p>
      <p className="pg-label">The simulated model’s answer</p>
      <p className="pg-answer">{run.finalText || 'The simulated model wrote no answer.'}</p>
      {status === 'denied' && code && (
        <div className="pg-operator">
          <p className="pg-label">Operator view</p>
          <p><code>Stopped at {refusalStage(run) ?? 'gate'} · {code}</code></p>
          <p>{operatorText[code]}</p>
          <p>A production app would show people one neutral message, so the cause cannot leak.</p>
          <p className="pg-label">What the model was told</p>
          <p>{modelText[code]}</p>
        </div>
      )}
      {(status === 'failed' || status === 'cancelled') && code && (
        <div className="pg-operator">
          <p className="pg-label">Operator view</p>
          <p><code>{label} · {code}</code></p>
          <p>{operatorText[code]}</p>
        </div>
      )}
      <p className="pg-meta">Data reads: {run.ledger.length}. Took {Math.round(run.elapsedMs)} ms in this page.</p>
    </div>
  )
}
