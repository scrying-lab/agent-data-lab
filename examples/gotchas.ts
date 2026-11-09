// Things a Python Strands learner will trip over in the TypeScript SDK (@strands-agents/sdk 1.24.0).
// Each entry names the installed SDK file that shows it. tests/translation.test.ts reads that file
// and fails if the text is gone, so a future SDK upgrade cannot silently make an entry wrong.

export type Gotcha = {
  id: string
  /** What trips people up, in one plain line. */
  title: string
  python: string
  typescript: string
  evidence: {
    /** Path inside the installed package, node_modules/@strands-agents/sdk/. */
    file: string
    /** A regular expression the file must match. */
    matches: string
    /** Optional text the file must NOT contain. */
    lacks?: string
    /** Optional further checks, each a file and a regular expression it must match. */
    also?: { file: string; matches: string }[]
  }
}

export const gotchas: Gotcha[] = [
  {
    id: 'options-object',
    title: 'The Agent takes one options object with camelCase keys.',
    python: 'Agent(tools=[...], system_prompt="...")',
    typescript: "new Agent({ tools: [...], systemPrompt: '...' })",
    evidence: { file: 'dist/src/agent/agent.d.ts', matches: 'systemPrompt\\?: SystemPrompt' },
  },
  {
    id: 'tool-name',
    title: 'tool() needs an explicit name; nothing is read from a function name or docstring.',
    python: '@tool on a function; the name and description come from the function',
    typescript: "tool({ name: 'lookup_customer', description: '...', inputSchema: z.object({...}), callback })",
    evidence: { file: 'dist/src/tools/zod-tool.d.ts', matches: 'The name of the tool \\*/\\s*name: string;' },
  },
  {
    id: 'add-hook',
    title: 'There is no hooks option. Call agent.addHook after construction, or pass a Plugin in plugins: [...].',
    python: 'Agent(hooks=[MyHookProvider()])',
    typescript:
      'agent.addHook(BeforeToolCallEvent, event => { ... }), or a Plugin whose initAgent(agent) calls agent.addHook, passed as new Agent({ plugins: [new MyPlugin()] }). The Plugin is the closest match to HookProvider.',
    evidence: {
      file: 'dist/src/agent/agent.d.ts',
      matches: 'addHook<T extends HookableEvent>\\(',
      lacks: 'hooks?:',
      also: [
        { file: 'dist/src/agent/agent.d.ts', matches: 'plugins\\?: Plugin\\[\\];' },
        { file: 'dist/src/plugins/plugin.d.ts', matches: 'initAgent\\(agent: LocalAgent\\): void \\| Promise<void>;' },
      ],
    },
  },
  {
    id: 'cancel',
    title: 'A hook stops a tool call with event.cancel, not cancel_tool.',
    python: 'event.cancel_tool = "reason"',
    typescript: "event.cancel = 'reason'",
    evidence: { file: 'dist/src/hooks/events.d.ts', matches: 'cancel: boolean \\| string;', lacks: 'cancel_tool' },
  },
  {
    id: 'async',
    title: 'Calling the agent is async.',
    python: 'result = agent("...")',
    typescript: "const result = await agent.invoke('...')",
    evidence: { file: 'dist/src/agent/agent.d.ts', matches: 'invoke\\(args: InvokeArgs, options\\?: InvokeOptions\\): Promise<AgentResult>' },
  },
  {
    id: 'printer',
    title: 'The agent prints to the console by default; turn it off with printer: false.',
    python: 'Agent(callback_handler=None)  # as in the workshop\'s multi-agent sample',
    typescript: 'new Agent({ printer: false })',
    evidence: { file: 'dist/src/agent/agent.d.ts', matches: 'Defaults to true\\.\\s*\\*/\\s*printer\\?: boolean;' },
  },
  {
    id: 'content-blocks',
    title: 'Message content blocks are class instances, not dicts.',
    python: 'block["text"]',
    typescript: "block.type === 'textBlock' ? block.text : ''",
    evidence: { file: 'dist/src/types/messages.d.ts', matches: 'export declare class TextBlock implements' },
  },
  {
    id: 'malformed-tool-json',
    title: 'Malformed tool-call JSON from a provider ends the run with a ModelError.',
    python: 'Not compared: this lab checks the TypeScript behaviour only',
    typescript: "try { await agent.invoke('...') } catch (e) { if (e instanceof ModelError) ... }",
    evidence: { file: 'dist/src/models/model.js', matches: "new ModelError\\('unable to parse tool input JSON'" },
  },
  {
    id: 'tool-use-rewrite',
    title: 'A hook that runs after yours can rewrite the tool name or input after your check ran.',
    python: 'event.tool_use',
    typescript:
      'event.toolUse can be changed. Hooks run by { order } (lower first), and hooks with the same order run in registration order. To check the final toolUse, register with { order: HookOrder.SDK_LAST } or higher.',
    evidence: {
      file: 'dist/src/hooks/registry.js',
      matches: 'lower order first, same order preserves registration order',
      also: [
        { file: 'dist/src/hooks/events.d.ts', matches: 'Mutate \\{@link toolUse\\} in place, or replace it wholesale' },
        { file: 'dist/src/hooks/types.d.ts', matches: 'readonly SDK_LAST: 100;' },
      ],
    },
  },
  {
    id: 'steering-interventions',
    title: 'Steering handlers go in interventions, not plugins, and guide() takes feedback.',
    python: 'Agent(plugins=[MySteeringHandler()]) and Guide(reason="...")',
    typescript: "new Agent({ interventions: [new MySteeringHandler()] }) and guide('...')",
    evidence: { file: 'dist/src/agent/agent.d.ts', matches: 'interventions\\?: InterventionHandler\\[\\];' },
  },
  {
    id: 'node-22',
    title: 'The SDK needs Node.js 22 or newer.',
    python: 'The workshop notebooks run on a Python 3 kernel',
    typescript: 'Node.js >= 22',
    evidence: { file: 'package.json', matches: '"node": ">=22\\.0\\.0"' },
  },
  {
    id: 'no-ollama',
    title: 'There is no Ollama model class in the TypeScript SDK.',
    python: 'from strands.models import OllamaModel',
    typescript: 'No OllamaModel; providers include bedrock, anthropic, openai, google and vercel',
    evidence: { file: 'package.json', matches: '"\\./models/openai"', lacks: 'models/ollama' },
  },
]
