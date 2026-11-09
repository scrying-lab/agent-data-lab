// Records the governance lesson's replays: every preset in agent/governed-run.ts run once through the
// real Strands loop with the simulated model and the gate. No network, no AWS, no cost.
// Usage: node --import tsx agent/record-governance.ts [recordedAt ISO time]
//
// Output is deterministic apart from timings (tMs, elapsedMs): recordedAt is fixed, run ids are the
// preset ids, and the simulated model's answers are templated from the tool results.
import { rename, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { governancePresets, runPreset } from './governed-run'
import type { LabRun } from './run-contract'

/** Fixed so re-recording does not churn the fixture. Pass a new time to mark a deliberate re-record. */
const DEFAULT_RECORDED_AT = '2026-11-09T00:00:00.000Z'
const recordedAt = z.iso.datetime().parse(process.argv[2] ?? DEFAULT_RECORDED_AT)

const runs: LabRun[] = []
for (const preset of governancePresets) {
  const run = await runPreset(preset, { tier: 'replay', provider: { kind: 'scripted' }, recordedAt, runId: preset.id })
  runs.push(run)
  console.log(run.runId.padEnd(22), run.outcome.status.padEnd(9), (run.outcome.code ?? '').padEnd(22), run.ledger.length, 'reads')
}
const file = new URL('../fixtures/governance-replays.json', import.meta.url)
const temp = new URL('./governance-replays-' + process.pid + '.tmp', file)
await writeFile(temp, JSON.stringify(runs, null, 2) + '\n')
await rename(temp, file)
console.log(runs.length, 'runs written to fixtures/governance-replays.json')
