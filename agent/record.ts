// Records the six scripted runs the site replays: three questions, each with one read allowed and
// with no reads allowed. No network, no AWS. Usage: npm run record [-- 2011|2012]
import { rename, writeFile } from 'node:fs/promises'
import { argsSchema, scenarios } from '../analytics/contracts'
import { loadBikes } from '../analytics/load.node.ts'
import type { LabRun } from './run-contract'
import { recordRun } from './run'
import { ScriptedModel } from './scripted-model'

const period = argsSchema.shape.period.parse(process.argv[2] ?? 'both')
const table = loadBikes()
const runs: LabRun[] = []
for (const scenario of scenarios) {
  for (const budget of [1, 0]) {
    const run = await recordRun(scenario, budget, new ScriptedModel(scenario, period), period, { table })
    runs.push(run)
    console.log(run.runId, run.outcome.status, run.outcome.code ?? '', run.ledger.length, 'reads')
  }
}
const file = new URL('../fixtures/executions.json', import.meta.url)
const temp = new URL('./executions-' + process.pid + '.tmp', file)
await writeFile(temp, JSON.stringify(runs, null, 2) + '\n')
await rename(temp, file)
console.log(runs.length, 'runs written to fixtures/executions.json')
