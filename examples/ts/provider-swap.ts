import { Agent } from '@strands-agents/sdk'
import { BedrockModel } from '@strands-agents/sdk/models/bedrock'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'
import { lookupCustomer } from './tool'

// Compile-only. The lab type-checks this file but never runs it: running it would call a paid
// provider and needs credentials. Each provider lives under its own import path.
//
// Python: BedrockModel(model_id="...") or OllamaModel(host=..., model_id="llama3.1").
// TypeScript 1.24 has no Ollama class, so the alternative shown here is OpenAI.
// The OpenAI provider also needs the separate `openai` package, which this lab does not install.

export function bedrockAgent() {
  const model = new BedrockModel({ modelId: 'amazon.nova-pro-v1:0' })
  return new Agent({ model, tools: [lookupCustomer], printer: false })
}

export function openAIAgent() {
  // The one line that changes. With no apiKey option, the provider reads OPENAI_API_KEY from the environment.
  const model = new OpenAIModel({ modelId: 'gpt-5.4' })
  return new Agent({ model, tools: [lookupCustomer], printer: false })
}
