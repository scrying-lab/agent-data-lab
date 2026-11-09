// lab-run/v1 — the one run contract shared by the engine, the evaluation, fixtures and every view.
// Frozen: change it only with a new version, never in place. Lanes propose changes in their report.
import { z } from 'zod'

export const LAB_RUN_VERSION = 'lab-run/v1' as const
export const LAB_EVAL_VERSION = 'lab-eval/v1' as const

/** How a result was produced. Every result on the page carries exactly one of these. */
export const tiers = ['replay', 'simulated', 'live'] as const
export type Tier = typeof tiers[number]

export const lessons = ['analytics', 'governance'] as const
export type Lesson = typeof lessons[number]

/** The gate's stages, in the order they run. */
export const stages = ['allowlist', 'schema', 'caller', 'arguments', 'budget'] as const
export type Stage = typeof stages[number]

/** A gate refusal. The system working as designed, not an error. */
export const denyCodes = [
  'TOOL_NOT_IN_LESSON', 'SCHEMA_INVALID', 'CALLER_UNKNOWN', 'TOOL_NOT_GRANTED', 'SCOPE_NOT_GRANTED',
  'UNKNOWN_METRIC', 'UNKNOWN_PERIOD', 'METRIC_ABOVE_SCOPE', 'READ_BUDGET_EXHAUSTED',
] as const
/** Something went wrong: a tool, the model, or the run itself. */
export const failureCodes = [
  'NOT_APPROVED', 'TOOL_FAILED', 'OUTPUT_INVALID', 'CANCELLED',
  'MODEL_ERROR', 'MODEL_OUTPUT_INVALID', 'EMPTY_FINAL_TEXT', 'TURN_LIMIT',
] as const
export const codes = [...denyCodes, ...failureCodes] as const
export type DenyCode = typeof denyCodes[number]
export type FailureCode = typeof failureCodes[number]
export type Code = typeof codes[number]
export const codeSchema = z.enum(codes)

/**
 * The only text the model ever sees for each code. Fixed strings: raw errors, file paths and
 * validation messages never reach the model. Unknown and above-scope metrics share one sentence,
 * so a refusal cannot reveal whether a restricted metric exists.
 */
export const modelText: Record<Code, string> = {
  TOOL_NOT_IN_LESSON: 'That tool is not available. This agent can only read.',
  SCHEMA_INVALID: 'The request did not match the tool’s published inputs.',
  CALLER_UNKNOWN: 'This request has no recognised caller, so nothing was read.',
  TOOL_NOT_GRANTED: 'Your role cannot use that tool.',
  SCOPE_NOT_GRANTED: 'The requested scope is wider than your role allows.',
  UNKNOWN_METRIC: 'That metric is not available to you.',
  METRIC_ABOVE_SCOPE: 'That metric is not available to you.',
  UNKNOWN_PERIOD: 'There is no data for that period.',
  READ_BUDGET_EXHAUSTED: 'No data reads remain for this request.',
  NOT_APPROVED: 'The tool refused to run without a matching approval.',
  TOOL_FAILED: 'The data service failed. Nothing partial was returned.',
  OUTPUT_INVALID: 'The data service returned a value that failed validation. It was discarded.',
  CANCELLED: 'The request was cancelled.',
  MODEL_ERROR: 'The model could not be reached.',
  MODEL_OUTPUT_INVALID: 'The model produced a malformed request.',
  EMPTY_FINAL_TEXT: 'The model finished without an answer.',
  TURN_LIMIT: 'The run reached its turn limit.',
}

/** Plain-language explanations for the operator view and the narrator. Visitors may see these; the model never does. */
export const operatorText: Record<Code, string> = {
  TOOL_NOT_IN_LESSON: 'The model asked for a tool this lesson does not offer. A read-only agent has no tool that changes anything.',
  SCHEMA_INVALID: 'The request’s shape was wrong: a missing field, an extra field, or the wrong type. It was stopped before any check that depends on its contents.',
  CALLER_UNKNOWN: 'The app could not say who was asking, so the gate refused before comparing any permissions.',
  TOOL_NOT_GRANTED: 'The caller’s role does not include this tool.',
  SCOPE_NOT_GRANTED: 'The request asked for a wider scope than the caller was granted. A request cannot raise its own permissions.',
  UNKNOWN_METRIC: 'No metric has that name. The model is told the same thing as for a restricted metric, so it cannot probe what exists.',
  METRIC_ABOVE_SCOPE: 'The metric exists but is classified above the requested scope.',
  UNKNOWN_PERIOD: 'The metric is visible to this caller, but it has no reporting window for that period.',
  READ_BUDGET_EXHAUSTED: 'Every check passed, but this request had no data reads left.',
  NOT_APPROVED: 'The tool ran without a matching gate approval, so it refused. This guards against the request being changed after it was checked.',
  TOOL_FAILED: 'The data service threw an error. Its details stay in the operator log; the model sees one fixed sentence.',
  OUTPUT_INVALID: 'The data service returned something outside its published output shape, so the value was dropped.',
  CANCELLED: 'The run was stopped before it finished. Nothing after the stop was recorded.',
  MODEL_ERROR: 'The model provider failed before answering.',
  MODEL_OUTPUT_INVALID: 'The model’s tool request was not valid JSON, so no tool ran.',
  EMPTY_FINAL_TEXT: 'The model ended without writing an answer, which counts as a failure, not a reply.',
  TURN_LIMIT: 'The run used every turn it was allowed.',
}

export const eventKinds = ['request', 'model_turn', 'tool_requested', 'gate', 'tool_executed', 'tool_result', 'answer', 'run_closed'] as const
export type EventKind = typeof eventKinds[number]

export const eventSchema = z.strictObject({
  seq: z.number().int().nonnegative(),
  tMs: z.number().nonnegative(),
  kind: z.enum(eventKinds),
  tool: z.string().optional(),
  toolUseId: z.string().optional(),
  /** Tool input after redaction (long strings cut, structure kept). */
  input: z.unknown().optional(),
  decision: z.enum(['allow', 'deny']).optional(),
  stage: z.enum(stages).optional(),
  code: codeSchema.optional(),
  status: z.enum(['success', 'error']).optional(),
  resourceIds: z.array(z.string()).optional(),
  rows: z.number().int().nonnegative().optional(),
  stopReason: z.string().optional(),
  text: z.string().optional(),
})
export type RunEvent = z.infer<typeof eventSchema>

export const ledgerEntrySchema = z.strictObject({
  tool: z.string(),
  classifications: z.array(z.string()),
  resourceIds: z.array(z.string()),
})

export const usageSchema = z.strictObject({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
})

export const runSchema = z.strictObject({
  contractVersion: z.literal(LAB_RUN_VERSION),
  runId: z.string().min(1),
  lesson: z.enum(lessons),
  /** Stable preset or scenario id, e.g. "hourly" or "gov-forged-scope". */
  scenario: z.string().min(1),
  tier: z.enum(tiers),
  provider: z.strictObject({
    kind: z.enum(['scripted', 'bedrock']),
    modelId: z.string().min(1),
    region: z.string().optional(),
  }),
  sdkVersion: z.string().min(1),
  /** ISO date for recordings; null for runs made in the visitor's browser. */
  recordedAt: z.string().nullable(),
  /** The caller comes from trusted application state, never from the model. Null for the analytics lesson. */
  caller: z.strictObject({ role: z.string() }).nullable(),
  prompt: z.string(),
  events: z.array(eventSchema).min(1),
  /** Every protected read that actually happened. A refusal must leave this empty. */
  ledger: z.array(ledgerEntrySchema),
  /** The lesson's validated result payload, or null when nothing was read. */
  result: z.unknown().nullable(),
  finalText: z.string(),
  outcome: z.strictObject({
    status: z.enum(['ok', 'denied', 'failed', 'cancelled']),
    code: codeSchema.optional(),
  }),
  usage: usageSchema.nullable(),
  elapsedMs: z.number().nonnegative(),
})
export type LabRun = z.infer<typeof runSchema>

/** The single label for a result. Also the first words of the narration, so both always agree. */
export function tierLabel(run: Pick<LabRun, 'tier' | 'provider' | 'recordedAt'>): string {
  if (run.tier === 'replay') return 'Recorded replay'
  if (run.tier === 'simulated') return 'Simulated in your browser'
  const parts = ['Recorded live run', run.provider.kind === 'bedrock' ? 'Amazon Bedrock' : run.provider.kind, run.provider.modelId]
  if (run.provider.region) parts.push(run.provider.region)
  if (run.recordedAt) parts.push(run.recordedAt.slice(0, 10))
  return parts.join(' · ')
}

// ---- lab-eval/v1: stored evaluation results ----
export const evalCategories = ['legitimate', 'out-of-scope', 'malformed-injection', 'failure', 'regression'] as const

export const evalCaseResultSchema = z.strictObject({
  id: z.string().regex(/^(L|O|M|F|R)-\d{2}$/),
  category: z.enum(evalCategories),
  title: z.string(),
  callerRole: z.string().nullable(),
  request: z.string(),
  expected: z.strictObject({
    tool: z.string().nullable(),
    decision: z.enum(['allow', 'deny', 'none']),
    stage: z.enum(stages).optional(),
    code: codeSchema.optional(),
    outcome: z.enum(['ok', 'denied', 'failed', 'cancelled']),
  }),
  observed: z.strictObject({
    decisions: z.array(z.strictObject({ tool: z.string(), decision: z.enum(['allow', 'deny']), stage: z.enum(stages).optional(), code: codeSchema.optional() })),
    ledgerSize: z.number().int().nonnegative(),
    outcome: z.enum(['ok', 'denied', 'failed', 'cancelled']),
    code: codeSchema.optional(),
  }),
  sideEffects: z.literal('none'),
  pass: z.boolean(),
  reason: z.string(),
})

export const evalResultsSchema = z.strictObject({
  contractVersion: z.literal(LAB_EVAL_VERSION),
  sdkVersion: z.string(),
  /** SHA-256 over the gate, runner, cases and lockfile, so stale results are detectable. */
  inputsHash: z.string().regex(/^[0-9a-f]{64}$/),
  cases: z.array(evalCaseResultSchema),
  summary: z.strictObject({ total: z.number().int(), passed: z.number().int() }),
})
export type EvalResults = z.infer<typeof evalResultsSchema>
