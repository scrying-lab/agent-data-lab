import { useId, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import type { LabRun } from '../../agent/run-contract'
import { questions, scenarios, type Result, type Scenario } from '../../analytics/contracts'
import { HourlyChart, WeatherChart, WeekHeatmap } from '../charts'
import { CompareModels } from '../lessons/CompareModels'
import { TracePanel } from '../trace/TracePanel'
import { ChoiceGroup } from './ChoiceGroup'
import { allRecordings, analyticsResult, analyticsRuns, findAnalyticsRun, permissionLabels, permissions, type Permission } from './data'
import { LessonIntro } from './LessonIntro'
import { MissingRecording } from './MissingRecording'
import { ResultCard } from './ResultCard'

export const ANALYTICS_ID = 'lesson-analytics'

const questionOptions = scenarios.map(value => ({ value, label: questions[value] }))
const permissionOptions = permissions.map(value => ({ value, label: permissionLabels[value] }))

function Chart({ scenario, result, run }: { scenario: Scenario; result: Result; run: LabRun }) {
  if (scenario === 'hourly') return <HourlyChart result={result} provenance={run} />
  if (scenario === 'weather') return <WeatherChart result={result} provenance={run} />
  return <WeekHeatmap result={result} provenance={run} />
}

type Props = {
  /** The analytics recordings; defaults to fixtures/executions.json. */
  runs?: readonly LabRun[]
  /** Everything CompareModels may compare; it shows only recorded live runs. */
  recordings?: readonly unknown[]
}

/** Lesson 2: three questions about real bike rentals, each recorded once allowed and once blocked. */
export function AnalyticsLesson({ runs = analyticsRuns, recordings = allRecordings }: Props) {
  const headingId = useId()
  const [scenario, setScenario] = useState<Scenario>('hourly')
  const [permission, setPermission] = useState<Permission>('allow')
  const run = findAnalyticsRun(runs, scenario, permission)
  const result = run && run.outcome.status === 'ok' ? analyticsResult(run) : null
  const label = permissionLabels[permission].toLowerCase()

  return (
    <section id={ANALYTICS_ID} className="shell-section shell-lesson" aria-labelledby={headingId}>
      <LessonIntro lesson="analytics" numeral="03" kicker="Lesson 2 · Analytics" title="What the bike data says" headingId={headingId} />

      <div className="shell-controls">
        <ChoiceGroup label="Question" options={questionOptions} value={scenario} onChange={setScenario} />
        <ChoiceGroup label="Tool permission" options={permissionOptions} value={permission} onChange={setPermission} />
      </div>

      {run ? (
        <div className="shell-run">
          <ResultCard run={run}>
            {run.outcome.status === 'denied' && (
              <div className="shell-blocked">
                <p className="shell-blocked__title"><ShieldOff aria-hidden="true" />No data was read</p>
                <p>
                  The gate refused the tool request before the bike-sharing file was opened, so there are no numbers
                  and no chart for this run. Choose “{permissionLabels.allow}” to see the recording that read the data.
                </p>
              </div>
            )}
          </ResultCard>
          {run.outcome.status === 'ok' && (result ? (
            <div className="shell-figure">
              <Chart scenario={scenario} result={result} run={run} />
            </div>
          ) : (
            <MissingRecording what={`the chart for this question (the saved result failed its check)`} command="npm run record" />
          ))}
          <CompareModels runs={recordings} />
          <TracePanel run={run} showTier={false} />
        </div>
      ) : (
        <MissingRecording what={`this question with “${label}”`} command="npm run record" />
      )}
    </section>
  )
}
