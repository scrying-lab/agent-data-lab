import { useId, type ReactNode } from 'react'
import type { LabRun } from '../../agent/run-contract'
import { announce } from '../announce'
import { TracePanel } from '../trace/TracePanel'
import { DEFAULT_GOVERNANCE_SCENARIO, exampleName, governanceRuns } from './data'
import { LessonIntro } from './LessonIntro'
import { MissingRecording } from './MissingRecording'
import { ResultCard } from './ResultCard'
import type { LessonRunController } from './useLessonRun'

export const GOVERNANCE_ID = 'lesson-governance'

type Props = {
  /** Which run is shown. Lift it with useLessonRun so the playground can set it too. */
  controller: LessonRunController
  /**
   * The editable playground, rendered where the editable blocks belong. When it is not given,
   * nothing is rendered in its place.
   */
  playground?: ReactNode
  /** The recorded examples; defaults to fixtures/governance-replays.json. */
  runs?: readonly LabRun[]
}

/** Lesson 1: the gate in front of every tool call, shown through recorded examples. */
export function GovernanceLesson({ controller, playground, runs = governanceRuns }: Props) {
  const headingId = useId()
  const examplesHeadingId = useId()
  const selectId = useId()
  const fallback = runs.find(r => r.scenario === DEFAULT_GOVERNANCE_SCENARIO) ?? runs[0] ?? null
  const shown = controller.run ?? fallback
  const recorded = shown ? runs.find(r => r.runId === shown.runId) : undefined

  function choose(scenario: string) {
    const run = runs.find(r => r.scenario === scenario)
    if (!run) return
    if (controller.show(run)) announce(`Showing recorded example: ${exampleName(scenario)}.`)
  }

  return (
    <section id={GOVERNANCE_ID} className="shell-section shell-lesson" aria-labelledby={headingId}>
      <LessonIntro lesson="governance" kicker="Lesson 1 · Governance" title="Who gets to read what?" headingId={headingId} />

      {playground && <div className="shell-playground">{playground}</div>}

      <div className="shell-examples">
        <h3 id={examplesHeadingId} className="shell-subtitle">Recorded examples</h3>
        <p className="shell-prose">
          Each example is a saved run of the same agent and gate, asked by a different invented person or with a
          different trick. Pick one to see what the gate decided.
        </p>
        {runs.length > 0 ? (
          <div className="shell-field">
            <label htmlFor={selectId} className="shell-field-label">Recorded example</label>
            <select
              id={selectId}
              className="shell-select"
              value={recorded ? recorded.scenario : ''}
              onChange={event => choose(event.target.value)}
            >
              {!recorded && <option value="" disabled>Your own run (shown below)</option>}
              {runs.map(r => <option key={r.runId} value={r.scenario}>{exampleName(r.scenario)}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      {shown ? (
        <div className="shell-run">
          <ResultCard run={shown} />
          <TracePanel run={shown} />
        </div>
      ) : (
        <MissingRecording what="the governance lesson" command="npm run record:governance" />
      )}
    </section>
  )
}
