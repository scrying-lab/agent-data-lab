import { Model, type BaseModelConfig, type Message, type ModelStreamEvent } from '@strands-agents/sdk'

// A stand-in provider for the examples. It plays a fixed script instead of calling a real model,
// so every example runs offline, for free, and the same way every time. Strands still runs its
// normal agent loop around it: tool lookup, hooks, interventions and tool results are all real.
//
// Each turn is either a tool request or a final text reply. In a text reply, {result} is replaced
// by the text of the most recent tool result, so you can see what the tool (or a hook) said.
// A tool `input` given as a string is sent as raw JSON text, which lets a test send malformed JSON.
export type ScriptTurn =
  | { toolUse: { name: string; input: Record<string, unknown> | string } }
  | { text: string }

export class ScriptedModel extends Model {
  private config: BaseModelConfig = { modelId: 'scripted-example' }
  private turn = 0
  constructor(private readonly script: ScriptTurn[]) { super() }
  getConfig() { return this.config }
  updateConfig(config: BaseModelConfig) { this.config = { ...this.config, ...config } }

  async *stream(messages: Message[]): AsyncGenerator<ModelStreamEvent> {
    const next = this.script[this.turn] ?? { text: '(end of script)' }
    this.turn += 1
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    if ('toolUse' in next) {
      const { name, input } = next.toolUse
      yield { type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name, toolUseId: 'call-' + this.turn } }
      yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: typeof input === 'string' ? input : JSON.stringify(input) } }
      yield { type: 'modelContentBlockStopEvent' }
      yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' }
      return
    }
    const text = next.text.replace('{result}', lastToolResultText(messages))
    yield { type: 'modelContentBlockStartEvent' }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}

function lastToolResultText(messages: Message[]): string {
  const result = messages.at(-1)?.content.find(block => block.type === 'toolResultBlock')
  if (!result) return ''
  return result.content.flatMap(part => (part.type === 'textBlock' ? [part.text] : [])).join(' ')
}
