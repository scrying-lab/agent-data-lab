import { Agent, tool, type Model } from '@strands-agents/sdk'
import { z } from 'zod'
import { ScriptedModel } from './scripted-model'

// Mock data, as in the workshop. Nothing here is a real customer.
const customers: Record<string, { name: string; accountStatus: string }> = {
  'C-1001': { name: 'Sarah Johnson', accountStatus: 'active' },
  'C-1002': { name: 'Mike Chen', accountStatus: 'active' },
}

// Python reads the name, arguments and description from the decorated function.
// TypeScript spells them out: a name, a description, and a Zod schema for the input.
// The input keeps the snake_case key `customer_id`, so the model sees the same tool in both languages.
export const lookupCustomer = tool({
  name: 'lookup_customer',
  description: 'Look up a customer by their ID.',
  inputSchema: z.object({ customer_id: z.string().describe('The customer ID (e.g. C-1001)') }),
  callback: ({ customer_id }) => {
    const customer = customers[customer_id]
    if (!customer) return `No customer found with ID ${customer_id}`
    return `Customer: ${customer.name}\nAccount Status: ${customer.accountStatus}`
  },
})

// Runs offline with the scripted model: one tool request, then a reply that quotes the tool result.
export async function toolDemo(model: Model = new ScriptedModel([
  { toolUse: { name: 'lookup_customer', input: { customer_id: 'C-1001' } } },
  { text: 'Here is what I found. {result}' },
])) {
  const agent = new Agent({ model, tools: [lookupCustomer], printer: false, systemPrompt: 'You are a customer service agent.' })
  const result = await agent.invoke("Hi, I'm customer C-1001. Can you look me up?")
  return { agent, result }
}
