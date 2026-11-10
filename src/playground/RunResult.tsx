import { modelText, operatorText, tierLabel, type LabRun } from '../../agent/run-contract'
import { OutcomeBadge, TierLabel, outcomeWords } from '../shell/primitives'

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

/**
 * A finished run, as a card: a head band with the title, the tier label and the outcome badge, then
 * the answer and, for a refusal or failure, the operator view. Model text is rendered as text only,
 * never as HTML. The tier label always comes from tierLabel(run), so a simulated run is never
 * called live.
 */
export function RunResult({ run, titleId }: { run: LabRun; titleId: string }) {
  const { status, code } = run.outcome
  const word = outcomeWords[status]
  return (
    <div className="pg-result" data-outcome={status}>
      <div className="pg-result-head">
        <h3 id={titleId} className="pg-result-title">Result</h3>
        <div className="pg-result-badges">
          <TierLabel tier={run.tier}>{tierLabel(run)}</TierLabel>
          <OutcomeBadge status={status} />
        </div>
      </div>
      <div className="pg-result-body">
        <div className="pg-label">The simulated model’s answer</div>
        <p className="pg-answer">{run.finalText || 'The simulated model wrote no answer.'}</p>
        {status === 'denied' && code && (
          <div className="pg-operator">
            <div className="pg-label">Operator view</div>
            <p><code>Stopped at {refusalStage(run) ?? 'gate'} · {code}</code></p>
            <p>{operatorText[code]}</p>
            <p>A production app would show people one neutral message, so the cause cannot leak.</p>
            <div className="pg-label">What the model was told</div>
            <p>{modelText[code]}</p>
          </div>
        )}
        {(status === 'failed' || status === 'cancelled') && code && (
          <div className="pg-operator">
            <div className="pg-label">Operator view</div>
            <p><code>{word} · {code}</code></p>
            <p>{operatorText[code]}</p>
          </div>
        )}
        <p className="pg-meta">Data reads: {run.ledger.length}. Took {Math.round(run.elapsedMs)} ms in this page.</p>
      </div>
    </div>
  )
}
