// Browser harness: runs the governance lesson's real Strands agent loop in this page, with the gate
// in front of every tool call and a simulated model playing the model's part. Nothing leaves the
// page. Choose a preset with ?preset=<scenario id> (default gov-default).
//
// Page contract (used by tests/e2e/harness.spec.ts): window.__harness and the JSON in #result.
import './browser-init'
import { findPreset, runPreset } from '../agent/governed-run'
import { tierLabel, type LabRun } from '../agent/run-contract'

export type HarnessSummary = {
  scenario: string
  tier: LabRun['tier']
  outcome: LabRun['outcome']
  decisions: { tool?: string; decision?: 'allow' | 'deny'; stage?: string; code?: string }[]
  ledgerSize: number
  modelId: string
}

function summarize(run: LabRun): HarnessSummary {
  return {
    scenario: run.scenario,
    tier: run.tier,
    outcome: run.outcome,
    decisions: run.events.filter(e => e.kind === 'gate').map(e => ({ tool: e.tool, decision: e.decision, stage: e.stage, code: e.code })),
    ledgerSize: run.ledger.length,
    modelId: run.provider.modelId,
  }
}

const show = (id: string, text: string) => { const el = document.getElementById(id); if (el) el.textContent = text }

async function main() {
  const id = new URLSearchParams(location.search).get('preset') ?? 'gov-default'
  const preset = findPreset(id)
  if (!preset) throw Error('Unknown preset. Use one of the gov-* scenario ids.')
  const run = await runPreset(preset, { tier: 'simulated' })
  const summary = summarize(run)
  ;(window as unknown as { __harness: HarnessSummary }).__harness = summary
  show('label', tierLabel(run))
  show('answer', run.finalText || '(no answer)')
  show('result', JSON.stringify(summary))
}

main().catch(error => {
  show('result', 'error: ' + (error instanceof Error ? error.message : String(error)))
})
