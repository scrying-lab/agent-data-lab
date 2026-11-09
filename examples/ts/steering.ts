import { Agent, InterventionActions, tool, type BeforeToolCallEvent, type JSONValue, type Model } from '@strands-agents/sdk'
import { SteeringHandler, ToolLedgerProvider } from '@strands-agents/sdk/vended-interventions/steering'
import { z } from 'zod'
import { ScriptedModel } from './scripted-model'
import { lookupCustomer } from './tool'

const { guide, proceed } = InterventionActions

// Did the ledger record a successful call to this tool?
function succeeded(calls: JSONValue | undefined, toolName: string): boolean {
  if (!Array.isArray(calls)) return false
  return calls.some(call => typeof call === 'object' && call !== null && !Array.isArray(call)
    && call.name === toolName && call.status === 'success')
}

// The workshop's RefundWorkflowHandler, first rule only: look the customer up before any refund.
// Python imports from strands.vended_plugins.steering and returns Guide(reason=...).
// TypeScript imports from vended-interventions/steering and returns guide(feedback).
export class RefundWorkflowHandler extends SteeringHandler {
  readonly name = 'refund-workflow'
  constructor() { super({ contextProviders: [new ToolLedgerProvider()] }) }

  override beforeToolCall(event: BeforeToolCallEvent) {
    if (event.toolUse.name !== 'process_refund') return proceed({ reason: 'Not a refund operation' })
    const ledger = this.getSteeringContext().find(context => context.type === 'toolLedger')
    if (!succeeded(ledger?.calls, 'lookup_customer')) {
      return guide('You must look up the customer with lookup_customer before processing a refund.')
    }
    return proceed({ reason: 'Refund workflow validated' })
  }
}

// A mock refund tool, so the example has something to steer.
export const processRefund = tool({
  name: 'process_refund',
  description: 'Refund an order.',
  inputSchema: z.object({ order_id: z.string(), amount: z.number() }),
  callback: ({ order_id, amount }) => `Refund of $${amount.toFixed(2)} issued for ${order_id}.`,
})

// Runs offline: the scripted model tries the refund too early, is guided, looks up, then refunds.
export async function steeringDemo(model: Model = new ScriptedModel([
  { toolUse: { name: 'process_refund', input: { order_id: 'ORD-5521', amount: 79.99 } } },
  { toolUse: { name: 'lookup_customer', input: { customer_id: 'C-1001' } } },
  { toolUse: { name: 'process_refund', input: { order_id: 'ORD-5521', amount: 79.99 } } },
  { text: '{result}' },
])) {
  // Python passes steering handlers in plugins=[...]; TypeScript passes them in interventions: [...].
  const agent = new Agent({ model, tools: [lookupCustomer, processRefund], interventions: [new RefundWorkflowHandler()], printer: false })
  const result = await agent.invoke("I'm customer C-1001. I want a refund for order ORD-5521.")
  return { agent, result }
}
