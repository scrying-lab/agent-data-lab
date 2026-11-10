import { useId } from 'react'
import { modelText, type LabRun } from '../../agent/run-contract'
import { stageWords } from '../../content/narration'
import { OutcomeBadge, type OutcomeStatus } from '../shell/primitives'
import { formatTime, glossTool, type Step, type Tone } from './steps'

// A scrollable <pre> must be reachable by keyboard so its overflow can be scrolled (WCAG 2.1.1).
const SCROLLABLE_TAB_STOP = 0

/** A step's tone as an outcome badge. A refusal is neutral: the gate working as designed. */
const badgeStatus: Record<Exclude<Tone, 'neutral'>, OutcomeStatus> = { ok: 'ok', refused: 'denied', failed: 'failed' }

/**
 * Everything recorded for the selected step: a plain explanation first, then the exact data.
 * Unboxed on the panel's paper; only a gate decision gets a tint, with a bar in its outcome colour.
 */
export function StepDetails({ run, step, total }: { run: LabRun; step: Step; total: number }) {
  const headingId = useId()
  const e = step.event
  return (
    <section className="trace-details" aria-labelledby={headingId}>
      <h3 id={headingId} className="trace-details__title">
        Step {step.index + 1} of {total}: {step.label}
      </h3>
      <p className="trace-details__explain">{step.explanation}</p>

      <dl className="trace-facts">
        <div><dt>Event</dt><dd><code>{e.kind}</code> · seq {e.seq}</dd></div>
        <div><dt>Time</dt><dd>{formatTime(e.tMs)} from the start of the run</dd></div>
        {e.tool && <div><dt>Tool</dt><dd>{glossTool(e.tool)} (<code>{e.tool}</code>)</dd></div>}
      </dl>

      {e.kind === 'gate' && (
        <div className={'trace-decision trace-decision--' + step.tone}>
          <p className="trace-decision__head">
            {step.tone !== 'neutral' && <OutcomeBadge status={badgeStatus[step.tone]} />}
            {e.decision === 'allow' ? 'Every gate check passed' : `Stopped at the ${e.stage ? stageWords[e.stage] : 'gate'} check`}
          </p>
          {e.decision !== 'allow' && (
            <dl className="trace-facts">
              {e.stage && <div><dt>Stage</dt><dd><code>{e.stage}</code> ({stageWords[e.stage]})</dd></div>}
              {step.code && <div><dt>Code</dt><dd><code>{step.code}</code></dd></div>}
              {step.code && <div><dt>What the model was told</dt><dd>{modelText[step.code]}</dd></div>}
            </dl>
          )}
        </div>
      )}

      {e.input !== undefined && (
        <figure className="trace-json">
          <figcaption>Tool input, as recorded (long text is shortened)</figcaption>
          <pre role="region" aria-label={`Tool input for step ${step.index + 1}`} tabIndex={SCROLLABLE_TAB_STOP}>
            {JSON.stringify(e.input, null, 2)}
          </pre>
        </figure>
      )}

      <Output step={step} run={run} />
    </section>
  )
}

function Output({ step, run }: { step: Step; run: LabRun }) {
  const e = step.event
  if (step.tone === 'failed') {
    return <div className="trace-decision trace-decision--failed"><p className="trace-decision__head"><OutcomeBadge status="failed" />{step.code ? <code>{step.code}</code> : 'Failure'}</p></div>
  }
  if (e.kind === 'tool_executed') {
    return (
      <dl className="trace-facts">
        {e.rows !== undefined && <div><dt>Rows read</dt><dd>{e.rows.toLocaleString('en-US')}</dd></div>}
        {e.resourceIds?.length ? <div><dt>Sources</dt><dd>{e.resourceIds.join(', ')}</dd></div> : null}
      </dl>
    )
  }
  if (e.kind === 'answer') return <blockquote className="trace-answer">{e.text || run.finalText}</blockquote>
  if (e.kind === 'run_closed') {
    return (
      <dl className="trace-facts">
        <div><dt>Outcome</dt><dd>{run.outcome.status}{run.outcome.code ? ` (${run.outcome.code})` : ''}</dd></div>
        <div><dt>Data reads in the ledger</dt><dd>{run.ledger.length}</dd></div>
        <div><dt>Run time</dt><dd>{formatTime(run.elapsedMs).slice(1)}</dd></div>
      </dl>
    )
  }
  return null
}
