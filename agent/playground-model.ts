// A simulated model for the governance lesson. It plays the model's part from a fixed script, so the
// real Strands agent loop (hooks, gate, tools) can run anywhere, including a visitor's browser,
// without calling any provider.
//
// Plain version: the script says which data requests the "model" makes, one per turn. After the last
// request it writes an answer built only from what the tools handed back. It never makes up a number.
import { Model, type BaseModelConfig, type Message, type ModelStreamEvent } from '@strands-agents/sdk'

/** Malformed tool input: the text is streamed as-is, so the SDK fails to parse it as JSON. */
export type RawInput = { raw: string }
/** One tool request the simulated model makes. `input` is any JSON value, or `{ raw }` for broken JSON. */
export type PlaygroundRequest = { tool: string; input: unknown }
export type PlaygroundOptions = {
  /** End with an empty answer instead of the templated one (exercises EMPTY_FINAL_TEXT). */
  emptyAnswer?: boolean
}

export const PLAYGROUND_MODEL_ID = 'playground-simulated'

/** True for exactly `{ raw: string }`: an object whose only key is `raw` with a string value. */
export function isRawInput(input: unknown): input is RawInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const keys = Object.keys(input)
  return keys.length === 1 && keys[0] === 'raw' && typeof (input as RawInput).raw === 'string'
}

type ToolResultBlockLike = { status: 'success' | 'error'; content: { type: string; text?: string; json?: unknown }[] }

/** Turn the tool results the model received into plain sentences. Numbers come only from those results. */
export function answerFrom(results: ToolResultBlockLike[]): string {
  if (results.length === 0) return 'No data was needed to answer this request.'
  return results.map(describeResult).join(' ')
}

function describeResult(result: ToolResultBlockLike): string {
  const text = result.content.flatMap(c => (c.type === 'textBlock' && c.text ? [c.text] : [])).join(' ').trim()
  // A refusal or failure arrives as one fixed sentence. Repeat it; never add to it.
  if (result.status === 'error') return text || 'The request could not be completed.'
  const payload = result.content.find(c => c.type === 'jsonBlock')?.json ?? parseJson(text)
  if (isRecord(payload) && payload.kind === 'synthetic-metric') {
    const label = String(payload.label), period = String(payload.period), unit = String(payload.unit)
    const observations = Number(payload.observations)
    if (payload.value === null) return `${label} for ${period}: no value yet (synthetic data, ${observations} observations).`
    return `${label} for ${period}: ${Number(payload.value)} ${unit} (synthetic data, ${observations} observations).`
  }
  if (isRecord(payload) && payload.kind === 'synthetic-documents' && Array.isArray(payload.hits)) {
    const titles = payload.hits.map(hit => (isRecord(hit) ? String(hit.title) : '')).filter(Boolean)
    if (titles.length === 0) return 'No synthetic documents matched.'
    return `Found ${titles.length} synthetic document${titles.length === 1 ? '' : 's'}: ${titles.join('; ')}.`
  }
  return 'The tool returned a result this model cannot describe.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function parseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

/**
 * Replaces only the provider. Strands still runs its normal loop: turn k streams request k as a tool
 * use; after the last request (or at once if there are none) it streams the final answer.
 * The turn is worked out from the conversation itself (how many tool results it holds), so the
 * model keeps no hidden state between calls.
 */
export class PlaygroundModel extends Model {
  private config: BaseModelConfig = { modelId: PLAYGROUND_MODEL_ID }
  private readonly script: readonly PlaygroundRequest[]
  constructor(script: readonly PlaygroundRequest[], private readonly options: PlaygroundOptions = {}) {
    super()
    this.script = Object.freeze(script.map(request => Object.freeze({ ...request })))
  }
  getConfig() { return this.config }
  updateConfig(config: BaseModelConfig) { this.config = { ...this.config, ...config } }

  async *stream(messages: Message[]): AsyncGenerator<ModelStreamEvent> {
    const results = messages.flatMap(message => message.content.filter(block => block.type === 'toolResultBlock'))
    const turn = results.length
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    const request = this.script[turn]
    if (request) {
      const input = isRawInput(request.input) ? request.input.raw : JSON.stringify(request.input ?? {})
      yield { type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: request.tool, toolUseId: `call-${turn + 1}` } }
      yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input } }
      yield { type: 'modelContentBlockStopEvent' }
      yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' }
      return
    }
    const text = this.options.emptyAnswer ? '' : answerFrom(results)
    yield { type: 'modelContentBlockStartEvent' }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}
