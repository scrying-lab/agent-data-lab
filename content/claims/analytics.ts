import type { Claim } from '../claims'

export const claims: Claim[] = [
  {
    id: 'C-DATA-HOURLY-PEAKS',
    text: 'On working days rentals peak at 17:00 (525.3 per observed hour, n = 499); on nonworking days at 13:00 (372.7, n = 231).',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'hourly: working days peak at 17:00, nonworking days at 13:00' },
  },
  {
    id: 'C-DATA-WEATHER-COUNTS',
    text: 'Observed hours by weather: 11,413 clear, 4,544 mist, 1,419 light rain or snow, 3 heavy rain or snow.',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'weather: observed hours per category are 11413, 4544, 1419 and 3' },
  },
  {
    id: 'C-DATA-WEEK-CELLS',
    text: 'The weekly view has 168 weekday-hour cells.',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'week: one cell for every weekday and hour' },
  },
  {
    id: 'C-SIM-REPLAY-DENIAL',
    text: 'Every blocked recording has an empty read ledger and no result.',
    basis: 'simulated',
    evidence: { kind: 'test', file: 'tests/lab.test.ts', name: 'a blocked fixture has an empty ledger and a null result' },
  },
]
