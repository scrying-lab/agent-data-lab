// Readable labels and plain explanations for each recorded event. The list, the graph and the
// details panel all use these, so the three views always describe a step the same way.
// Labels never contain tool identifiers: the details panel shows those, next to their gloss.
import { denyCodes, modelText, operatorText, type Code, type LabRun, type RunEvent } from '../../agent/run-contract'
import { modelPhrase, qualifyModel, stageWords, toolGloss } from '../../content/narration'

/** How a step ended. Refused is neutral (the gate working as designed); only failed means something broke. */
export type Tone = 'neutral' | 'ok' | 'refused' | 'failed'

export type Step = {
  index: number
  event: RunEvent
  label: string
  explanation: string
  tone: Tone
  /** The refusal or failure code that applies to this step, if any. */
  code?: Code
}

export const glossTool = (tool?: string) => (tool ? toolGloss[tool] ?? 'a tool this lesson does not offer' : 'a tool')

/** Time since the run started, as text: "+7.6 ms". */
export const formatTime = (tMs: number) =>
  '+' + tMs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ms'

function codeFor(e: RunEvent, run: LabRun): Code | undefined {
  if (e.code) return e.code
  if (e.kind !== 'tool_result' && e.kind !== 'tool_executed') return undefined
  return run.events.find(g => g.kind === 'gate' && g.toolUseId !== undefined && g.toolUseId === e.toolUseId)?.code
}

function describe(e: RunEvent, run: LabRun): Omit<Step, 'index' | 'event'> {
  const code = codeFor(e, run)
  // Operator text is written for any tier; outside a live run it must not claim a real model chose anything.
  const why = (c: Code) => qualifyModel(operatorText[c], run.tier)
  // Same honesty rule as the guide: only a live run names "the model" as the one acting.
  const m = modelPhrase(run.tier)
  const actor = run.tier === 'replay' ? 'Scripted model' : run.tier === 'simulated' ? 'Simulated model' : 'Model'
  switch (e.kind) {
    case 'request':
      return { label: 'Question received', explanation: 'The visitor’s question was sent to the agent.', tone: 'neutral' }
    case 'model_turn':
      if (e.status === 'error') return { label: 'Model turn failed', explanation: code ? why(code) : 'The model call failed.', tone: 'failed', code }
      return e.stopReason === 'toolUse'
        ? {
            label: run.tier === 'live' ? 'Model asks for data' : `${actor} requests data`,
            explanation: `${m.lead} ended its turn with a tool request instead of an answer.`,
            tone: 'neutral',
          }
        : { label: `${actor} turn ended`, explanation: `${m.lead} finished its turn.`, tone: 'neutral' }
    case 'tool_requested':
      return { label: 'Tool requested', explanation: `A request to use ${glossTool(e.tool)} was recorded. Nothing has been read yet: the gate checks the request first.`, tone: 'neutral' }
    case 'gate':
      if (e.decision === 'allow') return { label: 'Gate allowed one read', explanation: 'The gate checked the request and every check passed, so the tool received a single-use approval to read once.', tone: 'ok' }
      return {
        label: e.stage ? `Gate refused at ${stageWords[e.stage]}` : 'Gate refused',
        explanation: code ? why(code) : 'The gate refused the request, so nothing was read.',
        tone: 'refused', code,
      }
    case 'tool_executed':
      if (e.status === 'error') return { label: 'Tool failed', explanation: code ? why(code) : 'The tool reported an error.', tone: 'failed', code }
      return {
        label: 'Data read',
        explanation: `${capitalise(glossTool(e.tool))} read ${e.rows !== undefined ? e.rows.toLocaleString('en-US') + ' rows' : 'its data'}${e.resourceIds?.length ? ' from ' + e.resourceIds.join(', ') : ''}.`,
        tone: 'ok',
      }
    case 'tool_result':
      if (e.status === 'error') {
        return {
          label: code && isDeny(code) ? 'Refusal sent to model' : 'Error sent to model',
          explanation: code ? `Instead of data, ${m.ref} received one fixed sentence: “${modelText[code]}”` : `Instead of data, ${m.ref} received a fixed sentence.`,
          tone: code && !isDeny(code) ? 'failed' : 'refused', code,
        }
      }
      return { label: 'Result returned', explanation: `The tool’s validated result went back to ${m.ref}.`, tone: 'neutral' }
    case 'answer':
      return { label: 'Answer written', explanation: e.text || run.finalText || `${capitalise(m.ref)} wrote no answer.`, tone: 'neutral' }
    case 'run_closed': {
      const failed = e.status === 'error' || run.outcome.status === 'failed' || run.outcome.status === 'cancelled'
      const runCode = e.code ?? run.outcome.code
      return failed
        ? { label: 'Run closed with a failure', explanation: runCode ? why(runCode) : 'The run did not finish.', tone: 'failed', code: runCode }
        : { label: 'Run closed', explanation: `The run finished. The read ledger records ${run.ledger.length} data ${run.ledger.length === 1 ? 'read' : 'reads'}.`, tone: 'neutral' }
    }
  }
}

const isDeny = (code: Code) => (denyCodes as readonly string[]).includes(code)
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function toSteps(run: LabRun): Step[] {
  return run.events.map((event, index) => ({ index, event, ...describe(event, run) }))
}

/** Where a step sits on the run's timeline, as fractions of the whole run, for the decorative waterfall bar. */
export function waterfall(run: LabRun, index: number): { start: number; width: number } {
  const end = Math.max(run.elapsedMs, ...run.events.map(e => e.tMs), 0.001)
  const t = run.events[index].tMs
  const next = run.events[index + 1]?.tMs ?? end
  return { start: t / end, width: Math.max(next - t, 0) / end }
}
