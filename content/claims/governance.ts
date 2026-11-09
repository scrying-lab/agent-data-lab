import type { Claim } from '../claims'

// Governance lesson claims. All are "simulated": they come from runs with a scripted model and
// synthetic data, never from a live provider.
export const claims: Claim[] = [
  {
    id: 'C-SIM-GOV-REFUSAL-NO-READS',
    text: 'In every recorded governance refusal, nothing was read: the read ledger is empty and there is no result.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'a refusal leaves an empty ledger and a null result, and the model sees only the fixed sentence' },
  },
  {
    id: 'C-SIM-GOV-FIXED-ERROR-TEXT',
    text: 'When the data service fails, the model sees one fixed sentence; no file path or raw error appears anywhere in the run.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'store fault "throw" fails with TOOL_FAILED and no path text anywhere in the run' },
  },
  {
    id: 'C-SIM-GOV-CALLER-TRUSTED',
    text: 'Who is asking comes from the app. Nothing the model sends can change the caller or widen their permissions.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'the caller cannot be changed by anything the model sends' },
  },
  {
    id: 'C-SIM-GOV-TAMPER-REFUSED',
    text: 'A request changed after the gate approved it is refused by the data service, and nothing is read.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'R-03 end to end: a hook after the gate %s is refused with NOT_APPROVED and nothing is read' },
  },
  {
    id: 'C-SIM-GOV-INJECTION',
    text: 'A retrieved document that tells the assistant to read payroll data does not get it read: only the public search happens.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'injection preset: the hostile document is read once from public scope, and the payroll request it plants is refused' },
  },
  {
    id: 'C-SIM-GOV-REPLAYS',
    text: 'The governance lesson has 10 recorded replays: 3 that read data and 7 refusals that together cover all five gate stages.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/governed-run.test.ts', name: 'the fixture has 10 replays: 3 that read data and 7 refusals covering all five gate stages' },
  },
  {
    id: 'C-SIM-GOV-BROWSER-GATE',
    text: 'The real Strands agent loop runs in the browser with the gate in front of every tool call; a forged scope is refused there and nothing is read.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/e2e/harness.spec.ts', name: 'the gate refuses a forged scope in the browser and nothing is read' },
  },
]
