import type { Claim } from '../claims'

export const claims: Claim[] = [
  {
    id: 'C-DATA-ROWS',
    text: 'The hourly file has 17,379 observed hours across 2011 and 2012.',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'the two year slices account for every observed hour' },
  },
  {
    id: 'C-DATA-HEAVY-WEATHER',
    text: 'Heavy rain or snow appears in only 3 observed hours.',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'blocks the same tool request before the data operation' },
  },
  {
    id: 'C-SIM-BROWSER-LOOP',
    text: 'The real Strands agent loop runs in the browser with a scripted model and makes no outside requests.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/e2e/harness.spec.ts', name: 'the real Strands agent loop runs in the browser with no outside requests' },
  },
]
