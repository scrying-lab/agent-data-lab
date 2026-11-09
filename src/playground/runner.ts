// Runs the playground's blocks through the real Strands agent loop and gate, in the browser, with
// the simulated model. The agent runtime (Strands SDK, gate, synthetic store) is a separate chunk:
// it is fetched on first focus or pointer over the playground, or on the first Run.
//
// Plain version: what you typed becomes data for one run. The app supplies who is asking; the
// simulated model makes exactly the requests you wrote; the gate decides. Nothing leaves the page.
//
// Developer notes:
// - Only `import type` reaches the agent modules statically, so the main bundle stays small.
// - A run is shown only while it is the newest one (createRunController plus a request counter
//   that also covers runs still waiting for the runtime to load). Older results are discarded.
import type { LabRun } from '../../agent/run-contract'
import type { RunController } from '../../agent/governed-run'
import type { BlockValues, RequestsBlock } from './parse'

export type AgentRuntime = {
  runGoverned: typeof import('../../agent/governed-run').runGoverned
  createRunController: typeof import('../../agent/governed-run').createRunController
  createSimulatedModel: typeof import('../../agent/model-factory').createSimulatedModel
}
export type RuntimeLoader = () => Promise<AgentRuntime>

/** The default loader: two dynamic imports, bundled together as one lazy chunk. */
export const loadAgentRuntime: RuntimeLoader = async () => {
  const [governed, factory] = await Promise.all([import('../../agent/governed-run'), import('../../agent/model-factory')])
  return { runGoverned: governed.runGoverned, createRunController: governed.createRunController, createSimulatedModel: factory.createSimulatedModel }
}

/** `stale`: a newer Run started, so this result must not be shown. `error`: the run could not finish. */
export type RunOutcome = { kind: 'run'; run: LabRun } | { kind: 'stale' } | { kind: 'error' }

export const MAX_TURNS = 4

const short = (value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? ''
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}
const field = (input: unknown, key: string): unknown =>
  input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>)[key] : undefined

/** A plain sentence describing what the simulated model will ask for. Recorded as the run's prompt. */
export function promptFor(requests: RequestsBlock): string {
  return requests.map(({ tool, input }) => {
    const metricId = field(input, 'metricId'), period = field(input, 'period'), query = field(input, 'query')
    if (tool === 'getSyntheticMetric' && metricId !== undefined && period !== undefined) return `What was ${short(metricId)} in ${short(period)}?`
    if (tool === 'searchSyntheticDocs' && query !== undefined) return `What do the documents say about ${short(query)}?`
    return `Use the ${short(tool)} tool.`
  }).join(' ')
}

export type PlaygroundRunner = ReturnType<typeof createPlaygroundRunner>

export function createPlaygroundRunner(load: RuntimeLoader = loadAgentRuntime) {
  let runtime: Promise<AgentRuntime> | undefined
  let controller: RunController | undefined
  let latest = 0
  let cancelledRequest = 0
  let runs = 0

  /** Start loading the agent runtime. Safe to call often; a failed load is retried next time. */
  function prefetch(): Promise<AgentRuntime> {
    if (!runtime) {
      const pending = load()
      runtime = pending
      pending.catch(() => { if (runtime === pending) runtime = undefined })
    }
    return runtime
  }

  async function run(values: BlockValues): Promise<RunOutcome> {
    const request = ++latest
    let agent: AgentRuntime
    try {
      agent = await prefetch()
    } catch {
      return request === latest ? { kind: 'error' } : { kind: 'stale' }
    }
    if (request !== latest) return { kind: 'stale' }
    controller ??= agent.createRunController()
    const token = controller.start()
    if (cancelledRequest === request) controller.cancel()
    const current = () => request === latest && !!controller?.isCurrent(token)
    const requests = values.requests
    try {
      const result = await agent.runGoverned({
        caller: { id: 'visitor', role: values.caller.role },
        prompt: promptFor(requests),
        model: agent.createSimulatedModel(requests),
        tier: 'simulated',
        scenario: 'playground',
        limits: { turns: Math.min(requests.length + 1, MAX_TURNS), reads: values.caller.readsLeft },
        cancelSignal: token.signal,
        runId: `playground-${Date.now().toString(36)}-${++runs}`,
      })
      return current() ? { kind: 'run', run: result } : { kind: 'stale' }
    } catch {
      return current() ? { kind: 'error' } : { kind: 'stale' }
    }
  }

  /** Stop the newest run. If it is still waiting for the runtime, it starts already cancelled. */
  function cancel(): void {
    cancelledRequest = latest
    controller?.cancel()
  }

  /** Make every run in flight stale (its result is discarded) and stop it. Used when a Run press
   *  finds text that does not parse: nothing new starts, and nothing older may show up instead. */
  function invalidate(): void {
    latest++
    controller?.cancel()
  }

  return { prefetch, run, cancel, invalidate }
}
