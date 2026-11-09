// The analytics lesson's own vocabulary: questions, tool names, tool inputs and the result shape.
// The run itself (events, ledger, outcome) uses the shared lab-run/v1 contract in agent/run-contract.ts.
// Browser-safe: zod only, no Node modules.
import { z } from 'zod'

export const scenarios = ['hourly', 'weather', 'week'] as const
export type Scenario = typeof scenarios[number]
export const scenarioSchema = z.enum(scenarios)

export const questions: Record<Scenario, string> = {
  hourly: 'How does hourly demand change on working days?',
  weather: 'How do rentals vary with the weather?',
  week: 'Which weekday and hour see the most rentals?',
}

export const toolsByScenario = {
  hourly: 'compareHourlyPatterns',
  weather: 'summarizeWeatherConditions',
  week: 'getWeekdayHourMatrix',
} as const satisfies Record<Scenario, string>

/** The one file every analytics tool reads, and how it is classified in the read ledger. */
export const resourceId = 'hour.csv'
export const classification = 'public'

export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const weatherLabels = ['Clear / few clouds', 'Mist / cloudy', 'Light rain or snow', 'Heavy rain or snow']

export const periods = ['both', '2011', '2012'] as const
export type Period = typeof periods[number]
/** Every analytics tool takes exactly one input: the period to read. */
export const argsSchema = z.strictObject({ period: z.enum(periods) })

export const pointSchema = z.strictObject({
  group: z.string(),
  hour: z.number().int().min(0).max(23).nullable(),
  mean: z.number().nonnegative(),
  n: z.number().int().positive(),
})
/** The validated payload a successful read returns. It becomes LabRun.result. */
export const resultSchema = z.strictObject({
  period: z.enum(periods),
  points: z.array(pointSchema).nonempty(),
  n: z.number().int().positive(),
  answer: z.string(),
})
export type Result = z.infer<typeof resultSchema>
export type Point = z.infer<typeof pointSchema>
