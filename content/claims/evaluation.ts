import type { Claim } from '../claims'

// Evaluation suite claims. "simulated": every case runs with a scripted model and synthetic data
// (plus the UCI hourly file for L-08), never a live provider. Results: evaluation/results.json.
export const claims: Claim[] = [
  {
    id: 'C-SIM-EVAL-ALL-PASS',
    text: 'All 20 evaluation cases pass (8 legitimate, 4 out-of-scope, 4 malformed or injection, 4 failures), plus 3 regressions',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/eval.test.ts', name: 'every stored case passed: all 20 cases plus 3 regressions' },
  },
]
