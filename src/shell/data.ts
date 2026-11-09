// The saved runs the page plays, checked against lab-run/v1 one by one. A recording that fails the
// check is left out, so the page shows "recording missing" for that one result instead of crashing.
import { runSchema, type LabRun, type Lesson } from '../../agent/run-contract'
import { resultSchema, type Result, type Scenario } from '../../analytics/contracts'
import executions from '../../fixtures/executions.json'
import governanceReplays from '../../fixtures/governance-replays.json'

/** Keeps only the items that are valid lab-run/v1 runs for `lesson`, in their original order. */
export function parseRuns(raw: readonly unknown[], lesson: Lesson): LabRun[] {
  return raw.flatMap(item => {
    const parsed = runSchema.safeParse(item)
    return parsed.success && parsed.data.lesson === lesson ? [parsed.data] : []
  })
}

/** Every saved recording, unparsed: CompareModels does its own validation. */
export const allRecordings: readonly unknown[] = [...(executions as unknown[]), ...(governanceReplays as unknown[])]
export const analyticsRuns: LabRun[] = parseRuns(executions as unknown[], 'analytics')

// ---- Analytics lesson ----

export const permissions = ['allow', 'block'] as const
export type Permission = typeof permissions[number]
export const permissionLabels: Record<Permission, string> = { allow: 'Allow one read', block: 'Block all reads' }

/** "Allow one read" is the recording that read data; "Block all reads" is the recording the gate refused. */
export function findAnalyticsRun(runs: readonly LabRun[], scenario: Scenario, permission: Permission): LabRun | undefined {
  const wanted = permission === 'allow' ? 'ok' : 'denied'
  return runs.find(r => r.scenario === scenario && r.outcome.status === wanted)
}

/** The run's analytics result, or null when nothing was read or the payload fails its schema. */
export function analyticsResult(run: LabRun): Result | null {
  const parsed = resultSchema.safeParse(run.result)
  return parsed.success ? parsed.data : null
}

// ---- Governance lesson ----

/** Plain names for the recorded governance examples, in the order the selector lists them. */
export const governanceExamples: readonly { scenario: string; name: string }[] = [
  { scenario: 'gov-default', name: 'Default: support staff asks for a public metric' },
  { scenario: 'gov-analyst-internal', name: 'Analyst reads an internal metric' },
  { scenario: 'gov-guest-tool', name: 'Guest asks for a metric' },
  { scenario: 'gov-forged-scope', name: 'Forged scope' },
  { scenario: 'gov-restricted-metric', name: 'Restricted metric' },
  { scenario: 'gov-unknown-period', name: 'A period with no data' },
  { scenario: 'gov-smuggled-role', name: 'Role smuggled into the request' },
  { scenario: 'gov-mutation', name: 'Request to delete data' },
  { scenario: 'gov-budget', name: 'No reads left' },
  { scenario: 'gov-injection', name: 'Injection in a retrieved document' },
]

export function exampleName(scenario: string): string {
  return governanceExamples.find(e => e.scenario === scenario)?.name ?? scenario
}

/** Governance replays in selector order; any replay without a plain name follows, under its id. */
export function orderGovernanceRuns(runs: readonly LabRun[]): LabRun[] {
  const rank = (r: LabRun) => {
    const i = governanceExamples.findIndex(e => e.scenario === r.scenario)
    return i === -1 ? governanceExamples.length : i
  }
  return [...runs].sort((a, b) => rank(a) - rank(b))
}

export const governanceRuns: LabRun[] = orderGovernanceRuns(parseRuns(governanceReplays as unknown[], 'governance'))
export const DEFAULT_GOVERNANCE_SCENARIO = 'gov-default'
