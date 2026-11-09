// Side-by-side Python and TypeScript examples for people who learned Strands in Python.
// The Python side is adapted from the AWS sample workshop (MIT-0) at a pinned commit.
// The TypeScript side targets @strands-agents/sdk 1.24.0.
//
// verified says how far each TypeScript file is checked:
//   executed   – tests/translation.test.ts runs it with a scripted model and checks the outcome
//   compiled   – it type-checks, but nothing runs it (for example, it would call a paid provider)
//   names-only – only the imported names were checked against the installed SDK

export const workshop = {
  repo: 'https://github.com/aws-samples/sample-strands-agents-hands-on-workshop',
  commit: '243a08d788dcb1589023a95d35afbf1270acfd0a',
  license: 'MIT-0',
} as const

export const sdk = {
  name: '@strands-agents/sdk',
  version: '1.24.0',
  repo: 'https://github.com/strands-agents/harness-sdk',
} as const

export type Verified = 'executed' | 'compiled' | 'names-only'

export type Pair = {
  id: string
  title: string
  /** Repository-relative path of the TypeScript file. */
  tsFile: string
  /** Repository-relative path of the Python file. */
  pyFile: string
  /** One plain sentence on what changes from Python to TypeScript. */
  whatChanges: string
  verified: Verified
}

export const pairs: Pair[] = [
  {
    id: 'tool',
    title: 'Define a tool',
    tsFile: 'examples/ts/tool.ts',
    pyFile: 'examples/py/tool.py',
    whatChanges: 'Python reads the tool name, arguments and description from the decorated function; TypeScript passes them to tool() explicitly, with a Zod schema for the input.',
    verified: 'executed',
  },
  {
    id: 'budget-hook',
    title: 'Cap tool calls with a hook',
    tsFile: 'examples/ts/budget-hook.ts',
    pyFile: 'examples/py/budget_hook.py',
    whatChanges: 'Python hands a HookProvider to the Agent constructor and sets event.cancel_tool; TypeScript calls agent.addHook after construction (or wraps the hooks in a Plugin passed as plugins: [...]) and sets event.cancel.',
    verified: 'executed',
  },
  {
    id: 'invoke-stream',
    title: 'Invoke and stream an agent',
    tsFile: 'examples/ts/invoke-stream.ts',
    pyFile: 'examples/py/invoke_stream.py',
    whatChanges: 'Python calls agent(...) and a default handler prints the stream; TypeScript awaits agent.invoke(...) or loops over agent.stream(...) with printer: false.',
    verified: 'executed',
  },
  {
    id: 'steering',
    title: 'Steer a tool call',
    tsFile: 'examples/ts/steering.ts',
    pyFile: 'examples/py/steering.py',
    whatChanges: 'Python passes a SteeringHandler in plugins and returns Guide(reason=...); TypeScript passes it in interventions, overrides beforeToolCall and returns guide(feedback).',
    verified: 'executed',
  },
  {
    id: 'provider-swap',
    title: 'Swap the model provider',
    tsFile: 'examples/ts/provider-swap.ts',
    pyFile: 'examples/py/provider_swap.py',
    whatChanges: 'Both languages change one constructor line, but TypeScript 1.24 has no Ollama class, so the alternative shown is OpenAI.',
    verified: 'compiled',
  },
]
