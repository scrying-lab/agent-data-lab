import { Model, type Message, type BaseModelConfig, type ModelStreamEvent } from '@strands-agents/sdk'
import { toolsByScenario, type Period, type Scenario } from '../analytics/contracts'

// Replace only the provider. Strands still runs its normal tool-use loop.
export class ScriptedModel extends Model {
  private config: BaseModelConfig = { modelId: 'scripted-control-v1' }
  constructor(private scenario: Scenario, private period: Period = 'both') { super() }
  getConfig() { return this.config }
  updateConfig(config: BaseModelConfig) { this.config = { ...this.config, ...config } }

  async *stream(messages: Message[]): AsyncGenerator<ModelStreamEvent> {
    const toolResult = messages.at(-1)?.content.find(block => block.type === 'toolResultBlock')
    yield { type: 'modelMessageStartEvent', role: 'assistant' }
    if (!toolResult) {
      yield { type: 'modelContentBlockStartEvent', start: { type: 'toolUseStart', name: toolsByScenario[this.scenario], toolUseId: 'read-1' } }
      yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'toolUseInputDelta', input: JSON.stringify({ period: this.period }) } }
      yield { type: 'modelContentBlockStopEvent' }
      yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' }
      return
    }
    const text = toolResult.status === 'error' ? 'The data request was blocked. No chart was produced.' : toolResult.content.filter(c => c.type === 'textBlock').map(c => c.text).join(' ')
    yield { type: 'modelContentBlockStartEvent' }
    yield { type: 'modelContentBlockDeltaEvent', delta: { type: 'textDelta', text } }
    yield { type: 'modelContentBlockStopEvent' }
    yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' }
  }
}
