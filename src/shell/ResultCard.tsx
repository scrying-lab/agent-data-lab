import { useId, type ReactNode } from 'react'
import { ArrowDown, Check, CircleSlash, CircleX, Shield } from 'lucide-react'
import { operatorText, tierLabel, type Code, type LabRun, type RunEvent } from '../../agent/run-contract'

export const RUN_FOR_REAL_ID = 'run-for-real'

const outcomes: Record<LabRun['outcome']['status'], { Icon: typeof Check; text: string; tone: string }> = {
  ok: { Icon: Check, text: 'Answered', tone: 'ok' },
  denied: { Icon: Shield, text: 'Refused by the gate', tone: 'refused' },
  failed: { Icon: CircleX, text: 'Failed', tone: 'failed' },
  cancelled: { Icon: CircleSlash, text: 'Cancelled', tone: 'refused' },
}

export const productionNote =
  'In production, also write each refusal to an audit log that people can review. The model still sees only the one fixed sentence.'

type Denial = Required<Pick<RunEvent, 'stage' | 'code'>> & Pick<RunEvent, 'tool'>

/** Every request the gate refused in this run, in order. */
export function denialsOf(run: LabRun): Denial[] {
  return run.events.flatMap(e => (e.kind === 'gate' && e.decision === 'deny' && e.stage && e.code ? [{ stage: e.stage, code: e.code, tool: e.tool }] : []))
}

function StopLine({ stage, code }: { stage: string; code: Code }) {
  return (
    <div className="shell-stop">
      <p className="shell-stop__line">Stopped at <code>{stage}</code> · <code>{code}</code></p>
      <p>{operatorText[code]}</p>
    </div>
  )
}

type Props = {
  run: LabRun
  /** Lesson-specific lines placed after the answer, e.g. "no data was read". */
  children?: ReactNode
}

/**
 * One result: its single tier label, the outcome as icon plus words, the question and the answer.
 * A refusal also says where the gate stopped it and why, in the same neutral style: it is the
 * system working as designed. Every card links to the commands for running the lab yourself.
 */
export function ResultCard({ run, children }: Props) {
  const headingId = useId()
  const outcome = outcomes[run.outcome.status]
  const denials = denialsOf(run)
  const scripted = run.provider.kind === 'scripted'
  const failureCode = run.outcome.status !== 'denied' && run.outcome.status !== 'ok' ? run.outcome.code : undefined

  return (
    <article className="shell-result" aria-labelledby={headingId} data-outcome={run.outcome.status}>
      <div className="shell-result__head">
        <h3 id={headingId} className="shell-result__title">Result</h3>
        <span className="shell-tier" data-tier={run.tier}>{tierLabel(run)}</span>
      </div>

      <p className={'shell-outcome shell-outcome--' + outcome.tone}>
        <outcome.Icon aria-hidden="true" />
        <span>{outcome.text}{run.outcome.status === 'denied' ? ': nothing was read' : ''}</span>
      </p>

      <dl className="shell-result__facts">
        {run.caller && (
          <div>
            <dt>Asked as</dt>
            <dd><code>{run.caller.role}</code> <span className="shell-muted">(set by the app, never by the AI)</span></dd>
          </div>
        )}
        <div>
          <dt>Question</dt>
          <dd>{run.prompt}</dd>
        </div>
        <div>
          <dt>Data reads</dt>
          <dd>{run.ledger.length === 0 ? 'None' : run.ledger.map(l => l.resourceIds.join(', ')).join('; ')}</dd>
        </div>
      </dl>

      <figure className="shell-answer">
        <blockquote>
          <p>{run.finalText}</p>
        </blockquote>
        <figcaption>
          {scripted ? 'Answer written by a scripted stand-in for the AI model.' : 'Answer written by ' + run.provider.modelId + '.'}
        </figcaption>
      </figure>

      {denials.length > 0 && (
        <div className="shell-refusal">
          {run.outcome.status === 'ok' && (
            <p className="shell-refusal__intro">{denials.length === 1 ? 'One request in this run was refused:' : 'Some requests in this run were refused:'}</p>
          )}
          {denials.map((d, i) => <StopLine key={i} stage={d.stage} code={d.code} />)}
          <p className="shell-note"><strong>Production note.</strong> {productionNote}</p>
        </div>
      )}
      {failureCode && (
        <div className="shell-stop">
          <p className="shell-stop__line">Failure · <code>{failureCode}</code></p>
          <p>{operatorText[failureCode]}</p>
        </div>
      )}

      {children}

      <p className="shell-result__more">
        <a href={'#' + RUN_FOR_REAL_ID}>Run this yourself<ArrowDown aria-hidden="true" /></a>
      </p>
    </article>
  )
}
