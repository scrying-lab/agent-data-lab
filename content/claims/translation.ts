import type { Claim } from '../claims'

// One claim per Python-to-TypeScript pair that tests/translation.test.ts actually runs.
// All of them run with a scripted model, so they are simulated, never live.
const evidence = (name: string) => ({ kind: 'test' as const, file: 'tests/translation.test.ts', name })

export const claims: Claim[] = [
  {
    id: 'C-TRANSLATE-TOOL',
    text: 'The TypeScript tool example runs with a scripted model: the agent calls the Zod-typed tool and gets its result back.',
    basis: 'simulated',
    evidence: evidence('runs the typed tool and returns its result to the model'),
  },
  {
    id: 'C-TRANSLATE-BUDGET-HOOK',
    text: 'The TypeScript budget hook example runs with a scripted model: once the one-call budget is spent, the next tool call is cancelled before the tool runs.',
    basis: 'simulated',
    evidence: evidence('the budget hook cancels the second call once the budget is spent'),
  },
  {
    id: 'C-TRANSLATE-INVOKE-STREAM',
    text: 'The TypeScript invoke and stream example runs with a scripted model: invoke returns the final text and stream yields events as they happen.',
    basis: 'simulated',
    evidence: evidence('invoke returns the final text and stream yields events as they happen'),
  },
  {
    id: 'C-TRANSLATE-STEERING',
    text: 'The TypeScript steering example runs with a scripted model: a refund tried before the customer lookup is guided back, then allowed after the lookup.',
    basis: 'simulated',
    evidence: evidence('the steering handler guides an early refund, then lets it through after the lookup'),
  },
]
