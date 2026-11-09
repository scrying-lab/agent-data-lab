// Runs one analytics question through a real Strands Agent and records what happened as a
// lab-run/v1 LabRun (agent/run-contract.ts). Only the model is swappable: a scripted model for the
// replays the site shows, or Amazon Bedrock for a live recording (agent/bedrock.ts).
//
// Plain version: the agent asks for a data tool, the lesson's gate checks the request, the tool reads
// hour.csv only if the gate allowed it, and every step lands in the run's event list.
import { Agent, AfterModelCallEvent, AfterToolCallEvent, BeforeInvocationEvent, BeforeToolCallEvent, ModelError, tool, type Message, type Model } from '@strands-agents/sdk'
import type { ColumnTable } from 'arquero'
import { ZodError } from 'zod'
import { analyze } from '../analytics/compute'
import { argsSchema, classification, questions, resourceId, scenarios, toolsByScenario, type Period, type Result, type Scenario } from '../analytics/contracts'
import { gateRead } from '../analytics/gate'
import { loadBikes } from '../analytics/load.node.ts'
import { labConfig } from '../lab.config'
import pkg from '../package.json' with { type: 'json' }
import { LAB_RUN_VERSION, modelText, runSchema, type DenyCode, type FailureCode, type LabRun, type RunEvent } from './run-contract'

/** Who answered. Scripted recordings are replayed on the site; Bedrock recordings are live runs. */
export type Provider = { kind: 'scripted' } | { kind: 'bedrock'; region: string }
export type RecordOptions = {
  provider?: Provider
  /** Model turns allowed for the whole run. Defaults to the lab's limit. */
  turns?: number
  runId?: string
  /** The data to read. Defaults to data/hour.csv, checked against its SHA-256. */
  table?: ColumnTable
}

export const systemPrompt = 'Answer the bike-sharing question using the single matching read tool. Use period both unless a year is requested. If a read is refused, stop and explain. Use only the numbers returned by the tool.'
export const sdkVersion = pkg.dependencies['@strands-agents/sdk']

export function promptFor(scenario: Scenario, period: Period): string {
  return questions[scenario] + (period === 'both' ? '' : ' Use ' + period + ' only.')
}

/** Tool input as stored in the trace: long strings cut, structure kept. */
function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value
  if (value === null || typeof value !== 'object') return value
  if (depth >= 4) return '…'
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item, depth + 1))
  return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key, redact(item, depth + 1)]))
}

function textOf(content: Message['content']): string {
  return content.flatMap(block => (block.type === 'textBlock' && block.text ? [block.text] : [])).join('\n')
}

export async function recordRun(scenario: Scenario, budget: number, model: Model, period: Period = 'both', options: RecordOptions = {}): Promise<LabRun> {
  const provider = options.provider ?? { kind: 'scripted' }
  const table = options.table ?? loadBikes()
  const prompt = promptFor(scenario, period)
  const start = performance.now()
  const elapsed = () => Math.round((performance.now() - start) * 10) / 10
  const events: RunEvent[] = []
  const log = (event: Omit<RunEvent, 'seq' | 'tMs'>) => { events.push({ seq: events.length, tMs: elapsed(), ...event }) }

  let readsRemaining = budget
  let firstDenial: DenyCode | undefined
  let toolFailure: FailureCode | undefined
  let result: Result | null = null
  const ledger: LabRun['ledger'] = []
  /** toolUseId -> the exact tool and period the gate allowed. A tool runs only with a matching approval. */
  const approvals = new Map<string, { tool: string; period: Period }>()

  const tools = scenarios.map(key => tool({
    name: toolsByScenario[key],
    description: questions[key] + ' period both covers 2011 and 2012.',
    inputSchema: argsSchema,
    callback: ({ period: selected }, context) => {
      const name = toolsByScenario[key]
      const toolUseId = context?.toolUse.toolUseId ?? ''
      const approval = approvals.get(toolUseId)
      approvals.delete(toolUseId)
      if (!approval || approval.tool !== name || approval.period !== selected) {
        toolFailure ??= 'NOT_APPROVED'
        throw Error(modelText.NOT_APPROVED)
      }
      try {
        result = analyze(table, key, selected)
      } catch (error) {
        const code = error instanceof ZodError ? 'OUTPUT_INVALID' : 'TOOL_FAILED'
        toolFailure ??= code
        throw Error(modelText[code])
      }
      ledger.push({ tool: name, classifications: [classification], resourceIds: [resourceId] })
      log({ kind: 'tool_executed', tool: name, toolUseId, resourceIds: [resourceId], rows: result.n })
      return result.answer
    },
  }))

  const agent = new Agent({ model, tools, printer: false, systemPrompt })
  agent.addHook(BeforeInvocationEvent, () => { log({ kind: 'request', text: prompt }) })
  agent.addHook(AfterModelCallEvent, event => {
    if (!event.stopData) { log({ kind: 'model_turn', status: 'error' }); return }
    const { stopReason, message } = event.stopData
    log({ kind: 'model_turn', status: 'success', stopReason })
    const text = textOf(message.content)
    if (stopReason === 'endTurn' && text) log({ kind: 'answer', text })
  })
  agent.addHook(BeforeToolCallEvent, event => {
    const { name, toolUseId, input } = event.toolUse
    log({ kind: 'tool_requested', tool: name, toolUseId, input: redact(input) })
    const decision = gateRead({ scenario, tool: name, input, readsRemaining })
    if (decision.decision === 'deny') {
      firstDenial ??= decision.code
      log({ kind: 'gate', tool: name, toolUseId, decision: 'deny', stage: decision.stage, code: decision.code })
      event.cancel = decision.modelText
      return
    }
    readsRemaining -= 1
    approvals.set(toolUseId, { tool: name, period: decision.period })
    log({ kind: 'gate', tool: name, toolUseId, decision: 'allow' })
  })
  agent.addHook(AfterToolCallEvent, event => {
    log({ kind: 'tool_result', tool: event.toolUse.name, toolUseId: event.toolUse.toolUseId, status: event.result.status })
  })

  let response: Awaited<ReturnType<Agent['invoke']>> | undefined
  let modelFailed = false
  try {
    response = await agent.invoke(prompt, { limits: { turns: options.turns ?? labConfig.limits.turns } })
  } catch (error) {
    if (!(error instanceof ModelError)) throw error
    modelFailed = true
  }
  const stopReason = response?.stopReason
  log({ kind: 'run_closed', status: modelFailed ? 'error' : 'success', ...(stopReason ? { stopReason } : {}) })
  const finalText = response && stopReason === 'endTurn' ? textOf(response.lastMessage.content) : ''

  const outcome: LabRun['outcome'] =
    modelFailed ? { status: 'failed', code: 'MODEL_ERROR' }
    : toolFailure ? { status: 'failed', code: toolFailure }
    : stopReason === 'limitTurns' ? { status: 'failed', code: 'TURN_LIMIT' }
    : firstDenial && ledger.length === 0 ? { status: 'denied', code: firstDenial }
    : !finalText ? { status: 'failed', code: 'EMPTY_FINAL_TEXT' }
    : { status: 'ok' }

  const usage = provider.kind === 'scripted' ? null : response?.metrics?.accumulatedUsage
  return runSchema.parse({
    contractVersion: LAB_RUN_VERSION,
    runId: options.runId ?? scenario + '-' + period + '-' + budget,
    lesson: 'analytics',
    scenario,
    tier: provider.kind === 'scripted' ? 'replay' : 'live',
    provider: { kind: provider.kind, modelId: model.getConfig().modelId ?? 'unknown', ...(provider.kind === 'bedrock' ? { region: provider.region } : {}) },
    sdkVersion,
    recordedAt: new Date().toISOString(),
    caller: null,
    prompt,
    events,
    ledger,
    result: ledger.length ? result : null,
    finalText,
    outcome,
    usage: usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens } : null,
    elapsedMs: elapsed(),
  })
}
