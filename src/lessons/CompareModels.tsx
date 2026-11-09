import { useId } from 'react'
import { runSchema, tierLabel, type LabRun } from '../../agent/run-contract'
import '../tokens.css'
import './lessons.css'

const outcomeWords: Record<LabRun['outcome']['status'], string> = {
  ok: 'Answered',
  denied: 'Refused by the gate (nothing read)',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

/** Live runs that asked exactly the same thing: same lesson, same scenario, same prompt. One run per model. */
export type Comparison = { lesson: LabRun['lesson']; scenario: string; prompt: string; runs: LabRun[] }

/**
 * Groups valid lab-run/v1 runs with tier 'live' by (lesson, scenario, prompt), keeping the first run
 * for each model in each group. Returns only groups with runs from two or more different models; with
 * `models`, only groups that have every one of those models, and only those columns, in that order.
 * Replays and simulated runs never count, so a comparison cannot present them as live.
 */
export function liveComparisons(runs: readonly unknown[], models?: readonly string[]): Comparison[] {
  const groups = new Map<string, { lesson: LabRun['lesson']; scenario: string; prompt: string; byModel: Map<string, LabRun> }>()
  for (const candidate of runs) {
    const parsed = runSchema.safeParse(candidate)
    if (!parsed.success || parsed.data.tier !== 'live') continue
    const run = parsed.data
    const key = JSON.stringify([run.lesson, run.scenario, run.prompt])
    let group = groups.get(key)
    if (!group) {
      group = { lesson: run.lesson, scenario: run.scenario, prompt: run.prompt, byModel: new Map() }
      groups.set(key, group)
    }
    if (!group.byModel.has(run.provider.modelId)) group.byModel.set(run.provider.modelId, run)
  }
  const comparisons: Comparison[] = []
  for (const { byModel, ...question } of groups.values()) {
    const picked = models ? models.map(id => byModel.get(id)) : [...byModel.values()]
    if (picked.length < 2 || picked.some(run => run === undefined)) continue
    comparisons.push({ ...question, runs: picked as LabRun[] })
  }
  return comparisons
}

function ComparisonView({ comparison }: { comparison: Comparison }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{comparison.prompt}</h3>
      <div className="lsn-compare-grid">
        {comparison.runs.map(run => (
          <article key={run.runId} className="lsn-compare-col" aria-label={tierLabel(run)}>
            <span className="lsn-kicker">{tierLabel(run)}</span>
            <h4>{run.provider.modelId}</h4>
            <p><strong>Outcome:</strong> {outcomeWords[run.outcome.status]}{run.outcome.code ? ' · ' + run.outcome.code : ''}</p>
            <p>{run.finalText}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/**
 * Recorded live runs side by side, one column per model, only where two or more models were asked
 * exactly the same question in the same lesson and scenario. Renders nothing otherwise.
 */
export function CompareModels({ runs, models }: { runs: readonly unknown[]; models?: readonly string[] }) {
  const titleId = useId()
  const comparisons = liveComparisons(runs, models)
  if (comparisons.length === 0) return null

  return (
    <section className="lsn-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>Compare models</h2>
      <p>The same question, recorded with each model. You are reading recordings, not watching live calls.</p>
      {comparisons.map(c => <ComparisonView key={JSON.stringify([c.lesson, c.scenario, c.prompt])} comparison={c} />)}
    </section>
  )
}
