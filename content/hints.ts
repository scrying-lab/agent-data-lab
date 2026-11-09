// "Elsewhere": the same ideas on AWS, other clouds and open source.
// This lab is AWS-flavoured. Each row names the equivalent on AWS, Google Cloud, Azure and in open
// source, as read in each vendor's own documentation on the date given. It is a reading guide, not a
// compatibility claim. The vendor cells describe the vendors, not the lab: the "aws" cell is the
// equivalent on AWS, not something this lab runs on. What the lab itself uses lives only in the
// optional `inLab` field, and each `inLab` names the repository files that show it. Together they
// name only four things: Amazon Bedrock (through recordings), Strands Agents TypeScript, the lab's
// own gate in governance/policy.ts, and a WSO2 gateway experiment that is not yet verified.
// A cell nobody confirmed says "not confirmed".
//
// match (the badge for the whole row; `matchNote` says where a single cell differs):
//   close        – a close functional match
//   approximate  – a different scope or model
//   unconfirmed  – not confirmed on the date accessed

export type Match = 'close' | 'approximate' | 'unconfirmed'
/** `title` is the link text: vendor and page, so screen readers do not spell out the address. */
export type HintSource = { url: string; title: string; accessed: string }
/** What this lab itself does for a concept, with the repository files that show it. */
export type InLab = { text: string; paths: string[] }

export type Concept = {
  id: string
  concept: string
  /** One sentence for someone who has never written code. */
  plain: string
  /** Only where the lab really uses this; absent otherwise. */
  inLab?: InLab
  aws: string
  google: string
  azure: string
  openSource: string
  match: Match
  /** Where one vendor's cell matches less closely than the badge says. */
  matchNote?: string
  sources: HintSource[]
}

export const notConfirmed = 'not confirmed'
export const accessed = '2026-11-09'
const src = (url: string, title: string): HintSource => ({ url, title, accessed })

export const concepts: Concept[] = [
  {
    id: 'model-access',
    concept: 'Model access',
    plain: 'The service that lets a program send text to an AI model and get an answer back.',
    inLab: {
      text: 'Amazon Bedrock, only through recordings: the optional recorder (npm run record:bedrock) calls it through the Strands BedrockModel class in the account of whoever runs it and saves the run. This page plays recordings and runs a simulated model; it never calls a real model.',
      paths: ['agent/bedrock.ts', 'package.json'],
    },
    aws: 'Amazon Bedrock, through the Strands BedrockModel class',
    google: 'Gemini Developer API, or Gemini on Agent Platform (formerly Vertex AI) through the Gen AI SDK with vertexai: true',
    azure: 'Foundry Models; the Azure OpenAI v1 endpoint works with the standard OpenAI client',
    openSource: 'Ollama’s OpenAI-compatible endpoint; the vLLM OpenAI-compatible server',
    match: 'close',
    sources: [
      src('https://strandsagents.com/docs/user-guide/sdk/model-providers/', 'Strands Agents: Model providers'),
      src('https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/sdks/overview', 'Google Cloud: Agent Platform SDKs overview'),
      src('https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle', 'Microsoft: Azure OpenAI API version lifecycle'),
      src('https://docs.ollama.com/api/openai-compatibility', 'Ollama: OpenAI compatibility'),
      src('https://docs.vllm.ai/en/latest/serving/online_serving/', 'vLLM: Online serving'),
    ],
  },
  {
    id: 'ai-gateway',
    concept: 'AI gateway',
    plain: 'A checkpoint in front of AI models that controls who may call them, limits how much they use, and logs usage.',
    inLab: {
      text: 'An experiment with the WSO2 AI Gateway in front of Amazon Bedrock. It has not been verified end to end.',
      paths: ['infra/wso2/provider.yaml', 'agent/gateway.ts'],
    },
    aws: 'No managed product: the Multi-Provider Generative AI Gateway guidance (LiteLLM on ECS or EKS), or an Amazon API Gateway pattern from an AWS blog',
    google: 'Apigee AI gateway: LLMTokenQuota and PromptTokenLimit policies, semantic cache',
    azure: 'Azure API Management AI gateway: llm-token-limit, token metrics, LLM logging',
    openSource: 'LiteLLM proxy; Kong AI Gateway; Envoy AI Gateway, now called Agent Router; WSO2 AI Gateway',
    match: 'close',
    matchNote: 'A close match on Google Cloud, on Azure and in open source. On AWS it is a published pattern and guidance, not a managed product, so that cell is only approximate.',
    sources: [
      src('https://docs.aws.amazon.com/solutions/multi-provider-generative-ai-gateway-on-aws/', 'AWS: Multi-Provider Generative AI Gateway on AWS'),
      src('https://aws.amazon.com/blogs/architecture/building-an-ai-gateway-to-amazon-bedrock-with-amazon-api-gateway/', 'AWS Architecture Blog: Building an AI gateway to Amazon Bedrock with Amazon API Gateway'),
      src('https://wso2.com/api-platform/docs/ai-gateway/1.1.0/overview/', 'WSO2: AI Gateway overview (1.1.0)'),
      src('https://wso2.com/api-platform/docs/ai-gateway/1.2.0/token-based-rate-limiting/', 'WSO2: AI Gateway token-based rate limiting (1.2.0)'),
      src('https://docs.cloud.google.com/apigee/docs/api-platform/get-started/ai-capabilities', 'Google Cloud: Apigee AI capabilities'),
      src('https://docs.cloud.google.com/apigee/docs/api-platform/tutorials/using-ai-token-policies', 'Google Cloud: Using Apigee AI token policies'),
      src('https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities', 'Microsoft: AI gateway capabilities in Azure API Management'),
      src('https://docs.litellm.ai/docs/simple_proxy', 'LiteLLM: Proxy server (AI gateway)'),
      src('https://developer.konghq.com/ai-gateway/', 'Kong: AI Gateway'),
      src('https://aigateway.envoyproxy.io/', 'Envoy AI Gateway: home page'),
    ],
  },
  {
    id: 'agent-runtime',
    concept: 'Managed agent runtime',
    plain: 'A cloud service that hosts and runs an agent for you, so you do not manage the servers.',
    aws: 'Amazon Bedrock AgentCore Runtime and Harness',
    google: 'Agent Runtime (formerly Vertex AI Agent Engine): full ADK integration for Python and Go; custom containers allowed',
    azure: 'Microsoft Foundry Agent Service: prompt agents, hosted containers, Responses API',
    openSource: 'No direct equivalent: you run the container yourself, for example with Docker or Kubernetes',
    match: 'approximate',
    sources: [
      src('https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html', 'AWS: What is Amazon Bedrock AgentCore'),
      src('https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime', 'Google Cloud: Agent Runtime'),
      src('https://google.github.io/adk-docs/deploy/agent-engine/', 'Google ADK: Deploy to Agent Engine'),
      src('https://learn.microsoft.com/en-us/azure/foundry/agents/overview', 'Microsoft: Foundry Agent Service overview'),
    ],
  },
  {
    id: 'guardrails',
    concept: 'Guardrails and content safety',
    plain: 'Guardrails check what is said; this gate checks what the agent is allowed to do.',
    aws: 'Amazon Bedrock Guardrails, also usable on its own through ApplyGuardrail; Strands BedrockGuardrailConfig',
    google: 'Model Armor: prompt injection and jailbreak detection, sensitive data, malicious URLs; inspect or block',
    azure: 'Azure AI Content Safety: Prompt Shields, groundedness, protected material; enforced through Foundry guardrails',
    openSource: 'Gateway plugins: Kong AI Prompt Guard, LiteLLM guardrails, WSO2 guardrails',
    match: 'approximate',
    sources: [
      src('https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-independent-api.html', 'AWS: Use the ApplyGuardrail API'),
      src('https://docs.cloud.google.com/model-armor/overview', 'Google Cloud: Model Armor overview'),
      src('https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview', 'Microsoft: Azure AI Content Safety overview'),
      src('https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/jailbreak-detection', 'Microsoft: Prompt Shields'),
      src('https://developer.konghq.com/ai-gateway/', 'Kong: AI Gateway'),
      src('https://docs.litellm.ai/docs/simple_proxy', 'LiteLLM: Proxy server (AI gateway)'),
      src('https://wso2.com/api-platform/learn/ai-gateway-vs-api-gateway/', 'WSO2: AI gateway vs API gateway'),
    ],
  },
  {
    id: 'tool-call-gate',
    concept: 'Tool-call governance (this lab’s gate)',
    plain: 'A set of checks that decides, before anything runs, whether the agent may use a tool with these exact inputs.',
    inLab: {
      text: 'A gate in the lab’s own code checks, in order: allowlist, schema, caller, arguments, budget. It is a teaching model, not a product.',
      paths: ['governance/policy.ts'],
    },
    aws: 'Amazon Bedrock AgentCore Policy is the nearest AWS service',
    google: notConfirmed,
    azure: notConfirmed,
    openSource: 'Strands vended-interventions/cedar; per-tool limits in Kong or LiteLLM',
    match: 'approximate',
    sources: [
      src('https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html', 'AWS: What is Amazon Bedrock AgentCore'),
      src('https://docs.litellm.ai/docs/simple_proxy', 'LiteLLM: Proxy server (AI gateway)'),
      src('https://developer.konghq.com/ai-gateway/', 'Kong: AI Gateway'),
    ],
  },
  {
    id: 'tracing',
    concept: 'Tracing and observability',
    plain: 'A step-by-step record of what the agent did and how long each step took, so people can check it afterwards.',
    aws: 'OpenTelemetry from Strands (setupTracer, OTLP) into AgentCore Observability or CloudWatch through ADOT',
    google: 'Cloud Trace and Cloud Logging through the Agents CLI',
    azure: 'API Management LLM logging into Application Insights; Foundry tracing ' + notConfirmed,
    openSource: 'OpenTelemetry with Langfuse’s OTLP endpoint; the OpenTelemetry GenAI semantic conventions',
    match: 'close',
    sources: [
      src('https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability-configure.html', 'AWS: Configure AgentCore Observability'),
      src('https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime', 'Google Cloud: Agent Runtime'),
      src('https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities', 'Microsoft: AI gateway capabilities in Azure API Management'),
      src('https://langfuse.com/integrations/native/opentelemetry', 'Langfuse: OpenTelemetry integration'),
      src('https://opentelemetry.io/docs/specs/semconv/gen-ai/', 'OpenTelemetry: Semantic conventions for generative AI'),
    ],
  },
  {
    id: 'agent-sdk',
    concept: 'Agent SDK',
    plain: 'A code library that runs the agent loop: ask the model, run the tool it picks, and repeat until there is an answer.',
    inLab: {
      text: 'Strands Agents, TypeScript SDK 1.24.0.',
      paths: ['package.json'],
    },
    aws: 'Strands Agents',
    google: 'Agent Development Kit (ADK) for Python, TypeScript, Go, Java and Kotlin',
    azure: notConfirmed,
    openSource: 'Strands and ADK are both open source',
    match: 'approximate',
    sources: [
      src('https://strandsagents.com/docs/user-guide/sdk/model-providers/', 'Strands Agents: Model providers'),
      src('https://adk.dev/', 'ADK: Agent Development Kit'),
    ],
  },
  {
    id: 'mcp-proxying',
    concept: 'MCP proxying',
    plain: 'A middle layer that offers existing services to agents as tools through the Model Context Protocol (MCP), and can control who uses them.',
    aws: 'AgentCore Gateway (turns APIs and Lambda functions into MCP tools and fronts MCP servers); AgentCore Policy intercepts tool calls',
    google: 'Apigee MCP proxies, which expose APIs as MCP tools',
    azure: 'API Management MCP server exposure and governance; Foundry MCP through the AI gateway (preview)',
    openSource: 'LiteLLM MCP gateway; Kong ai-mcp-proxy; Envoy AI Gateway (Agent Router) MCP; WSO2 MCP proxy',
    match: 'close',
    sources: [
      src('https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html', 'AWS: What is Amazon Bedrock AgentCore'),
      src('https://wso2.com/api-platform/docs/ai-gateway/1.1.0/overview/', 'WSO2: AI Gateway overview (1.1.0)'),
      src('https://docs.cloud.google.com/apigee/docs/api-platform/apigee-mcp/apigee-mcp-overview', 'Google Cloud: Apigee MCP overview'),
      src('https://learn.microsoft.com/en-us/azure/api-management/mcp-server-overview', 'Microsoft: MCP servers in Azure API Management'),
      src('https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/governance', 'Microsoft: Govern tools in Foundry Agent Service'),
      src('https://docs.litellm.ai/docs/simple_proxy', 'LiteLLM: Proxy server (AI gateway)'),
      src('https://developer.konghq.com/ai-gateway/', 'Kong: AI Gateway'),
      src('https://aigateway.envoyproxy.io/', 'Envoy AI Gateway: home page'),
    ],
  },
]

export const matchLabel: Record<Match, string> = {
  close: 'Close match',
  approximate: 'Approximate',
  unconfirmed: 'Not confirmed',
}
