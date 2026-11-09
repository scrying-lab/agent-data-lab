// The analytics lesson's gate. It runs before any data is read, in a fixed order:
//   1. allowlist: only the current question's tool may run
//   2. schema:    the input must be exactly { period: 'both' | '2011' | '2012' }
//   3. budget:    at least one data read must remain
// The first failing stage refuses the call, and the model only ever sees modelText for its code.
// Any valid period is allowed: asking about one year instead of both is a narrower question, not a breach.
// Browser-safe: no Node modules.
import { modelText, type DenyCode, type Stage } from '../agent/run-contract'
import { argsSchema, toolsByScenario, type Period, type Scenario } from './contracts'

export type GateStage = Extract<Stage, 'allowlist' | 'schema' | 'budget'>
export type GateRequest = { scenario: Scenario; tool: string; input: unknown; readsRemaining: number }
export type GateDecision =
  | { decision: 'allow'; period: Period }
  | { decision: 'deny'; stage: GateStage; code: DenyCode; modelText: string }

function deny(stage: GateStage, code: DenyCode): GateDecision {
  return { decision: 'deny', stage, code, modelText: modelText[code] }
}

export function gateRead({ scenario, tool, input, readsRemaining }: GateRequest): GateDecision {
  if (tool !== toolsByScenario[scenario]) return deny('allowlist', 'TOOL_NOT_IN_LESSON')
  const args = argsSchema.safeParse(input)
  if (!args.success) return deny('schema', 'SCHEMA_INVALID')
  if (readsRemaining < 1) return deny('budget', 'READ_BUDGET_EXHAUSTED')
  return { decision: 'allow', period: args.data.period }
}
