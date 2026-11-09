import { Agent, BeforeInvocationEvent, BeforeToolCallEvent, type Model } from '@strands-agents/sdk'
import { ScriptedModel } from './scripted-model'
import { lookupCustomer } from './tool'

// Python passes hooks=[RateLimiterHook()] to the Agent constructor.
// TypeScript has no hooks option: call agent.addHook after construction (as here), or wrap the
// callbacks in a Plugin whose initAgent calls addHook and pass it as plugins: [...].
// The Plugin is the closest match to Python's HookProvider.
export function addCallBudget(agent: Agent, maxCalls: number) {
  const counts = new Map<string, number>()
  agent.addHook(BeforeInvocationEvent, () => counts.clear()) // a fresh budget for every invocation
  agent.addHook(BeforeToolCallEvent, event => {
    const name = event.toolUse.name
    const used = (counts.get(name) ?? 0) + 1
    counts.set(name, used)
    if (used > maxCalls) {
      // Python sets event.cancel_tool; TypeScript sets event.cancel.
      // The string becomes the tool's error result, so the model reads why it was stopped.
      event.cancel = `'${name}' hit the ${maxCalls}-call limit. Do NOT call this tool again.`
    }
  })
}

// Runs offline: the scripted model asks for the same tool twice with a budget of one call.
// The first call runs; the second is cancelled before the tool executes.
export async function budgetDemo(model: Model = new ScriptedModel([
  { toolUse: { name: 'lookup_customer', input: { customer_id: 'C-1001' } } },
  { toolUse: { name: 'lookup_customer', input: { customer_id: 'C-1002' } } },
  { text: 'I stopped there. {result}' },
])) {
  const agent = new Agent({ model, tools: [lookupCustomer], printer: false })
  addCallBudget(agent, 1)
  const result = await agent.invoke('Look up customers C-1001 and C-1002.')
  return { agent, result }
}
