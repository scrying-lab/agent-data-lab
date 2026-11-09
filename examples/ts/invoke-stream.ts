import { Agent, type Model } from '@strands-agents/sdk'
import { ScriptedModel } from './scripted-model'
import { lookupCustomer } from './tool'

const script = () => new ScriptedModel([
  { toolUse: { name: 'lookup_customer', input: { customer_id: 'C-1001' } } },
  { text: 'Your account is active.' },
])

// Python: agent("...") blocks and the default callback handler prints the reply as it streams.
// TypeScript: every call is async. printer: false turns off the console printer,
// so your code decides what to show.

// 1) Invoke: wait for the whole answer.
export async function invokeOnce(model: Model = script()) {
  const agent = new Agent({ model, tools: [lookupCustomer], printer: false })
  const result = await agent.invoke("Hi, I'm customer C-1001. Is my account active?")
  // Content blocks are class instances with a `type`, not dicts: check the type, then read `.text`.
  return result.lastMessage.content.flatMap(block => (block.type === 'textBlock' ? [block.text] : [])).join('')
}

// 2) Stream: react to each event as it happens (text deltas, tool calls, hook events).
export async function streamEvents(model: Model = script()) {
  const agent = new Agent({ model, tools: [lookupCustomer], printer: false })
  const seen: string[] = []
  let text = ''
  for await (const event of agent.stream("Hi, I'm customer C-1001. Is my account active?")) {
    seen.push(event.type)
    if (event.type === 'modelStreamUpdateEvent' && event.event.type === 'modelContentBlockDeltaEvent' && event.event.delta.type === 'textDelta') {
      text += event.event.delta.text
    }
  }
  return { seen, text }
}
