import type { Claim } from '../claims'

export const claims: Claim[] = [
  {
    id: 'C-DATA-WEEK-PEAK',
    text: 'The busiest hour of the week in 2011–2012 is Tuesday at 17:00, with 544.3 rentals per observed hour (n = 104 observed hours).',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/charts.test.tsx', name: 'the busiest hour of the week in 2011–2012 is Tuesday 17:00: 544.3 (n = 104)' },
  },
  {
    id: 'C-DATA-WEEK-SCALE',
    text: 'The weekly heatmap’s colour scale runs from 0 to 680.9, just above the busiest hour of the week in any period the lab offers (Thursday at 17:00 in 2012, 680.8 rentals per observed hour, n = 52), so the same colour means the same number for 2011, 2012 and both years.',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/charts.test.tsx', name: 'the fixed colour scale runs from 0 to 680.9, just above the busiest hour of the week in 2011, 2012 or both' },
  },
  {
    id: 'C-DATA-WEATHER-SMALL-SAMPLE',
    text: 'Heavy rain or snow has 3 observed hours, so the weather chart flags it as a small sample (fewer than 30 hours).',
    basis: 'data',
    evidence: { kind: 'test', file: 'tests/charts.test.tsx', name: 'flags heavy weather (3 observed hours) as a small sample, visibly' },
  },
]
