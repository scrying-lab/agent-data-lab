// The guide's narration: one plain-language sentence for every recorded event in a lab-run/v1 run.
//
// Rules (tests/narration.test.ts checks every one):
// - Deterministic: the same run always gives the same sentences.
// - Exactly one sentence per event, each at most 25 words.
// - The first sentence starts with tierLabel(run), so the guide and the result label always agree.
// - Honesty: only a live run may say the model "chose", "decided", "asks" or "asked" on its own. A replay
//   says "the scripted model"; a run in the visitor's browser says "the simulated model".
// - Gate refusals quote operatorText[code] and name the gate stage in plain words.
// - Tool names are glossed on first use, e.g. "the metric reader (getSyntheticMetric)".
import {
  modelText, operatorText, tierLabel,
  type Code, type LabRun, type RunEvent, type Stage, type Tier,
} from '../agent/run-contract'

export const MAX_WORDS = 25

/** Plain-language names for the lab's tools. Any other name is glossed as a tool the lesson does not offer. */
export const toolGloss: Record<string, string> = {
  compareHourlyPatterns: 'the hourly pattern reader',
  summarizeWeatherConditions: 'the weather summary reader',
  getWeekdayHourMatrix: 'the weekday-by-hour reader',
  searchSyntheticDocs: 'the document search',
  getSyntheticMetric: 'the metric reader',
}
const unknownToolGloss = 'a tool this lesson does not offer'

/** The gate's stages in plain words, as in "the read budget check". */
export const stageWords: Record<Stage, string> = {
  allowlist: 'allowed tools',
  schema: 'input shape',
  caller: 'caller',
  arguments: 'arguments',
  budget: 'read budget',
}

export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length

/**
 * Contract text written for the operator view says "The model asked ...". Outside a live run
 * that would claim a real model chose something, so the narrator names the scripted or simulated model.
 */
export function qualifyModel(text: string, tier: Tier): string {
  if (tier === 'live') return text
  const who = tier === 'replay' ? 'scripted' : 'simulated'
  return text.replace(/\b([Tt])he model (asked|chose|decided)\b/g, (_m, t: string, verb: string) => `${t}he ${who} model ${verb}`)
}

/** First sentence of a longer explanation, used only when the whole text would break the word limit. */
const firstSentence = (s: string) => s.split(/(?<=[.!?])\s+/)[0]

/**
 * Quote text after `before`, cut so the whole sentence fits the word limit: all of it when it fits,
 * else its first sentence, else its first words. An ellipsis marks anything left out (the details panel has it all).
 */
function quoteToFit(before: string, text: string): string {
  const room = Math.max(1, MAX_WORDS - countWords(before))
  const whole = text.trim()
  if (countWords(whole) <= room) return `${before} “${whole}”`
  const first = firstSentence(whole)
  const words = first.split(/\s+/).filter(Boolean)
  // The separate ellipsis counts as a word, hence `<`.
  if (words.length < room) return `${before} “${first} …”`
  return `${before} “${words.slice(0, room).join(' ').replace(/[.,:;!?]$/, '')}…”`
}

/** The first candidate that fits the word limit; the last one is cut to fit as a final guard. */
function fit(...candidates: string[]): string {
  for (const c of candidates) if (countWords(c) <= MAX_WORDS) return c
  const words = candidates[candidates.length - 1].split(/\s+/).filter(Boolean)
  return words.slice(0, MAX_WORDS).join(' ').replace(/[.,:;]?$/, '…')
}

/**
 * Who acted, worded for the tier. Only the live wording may say the model chose; the others never
 * claim a real model's choice. The step list and details panel (src/trace/steps.ts) use it too.
 */
export function modelPhrase(tier: Tier) {
  if (tier === 'replay') return { lead: 'In this recording, the scripted model', ref: 'the scripted model' }
  if (tier === 'simulated') return { lead: 'The simulated model', ref: 'the simulated model' }
  return { lead: 'The model', ref: 'the model' }
}

/** A short, readable summary of a redacted tool input, e.g. period “both”. Empty when it has no simple fields. */
function describeInput(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ''
  const parts = Object.entries(input as Record<string, unknown>)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, 2)
    .map(([k, v]) => `${k} “${String(v).split(/\s+/).slice(0, 4).join(' ')}”`)
  return parts.join(' and ')
}

const stopReasonWords: Record<string, string> = {
  maxTokens: 'because it reached its output limit',
  stopSequence: 'at a stop marker',
  contentFiltered: 'because the provider filtered the content',
  guardrailIntervened: 'because a guardrail stepped in',
}

/** `lead` is the tier label that opens the first sentence; empty for every later sentence. */
type Ctx = { run: LabRun; seen: Set<string>; lead: string }

function toolName(tool: string | undefined, ctx: Ctx): string {
  if (!tool) return 'a tool'
  const gloss = toolGloss[tool] ?? unknownToolGloss
  if (ctx.seen.has(tool)) return gloss
  ctx.seen.add(tool)
  return `${gloss} (${tool})`
}

/** The code a refused or failed tool call carried: on the event itself, or on the gate event for the same call. */
function codeFor(e: RunEvent, run: LabRun): Code | undefined {
  if (e.code) return e.code
  const gate = run.events.find(g => g.kind === 'gate' && g.toolUseId !== undefined && g.toolUseId === e.toolUseId && g.code)
  return gate?.code
}

function sentence(e: RunEvent, ctx: Ctx): string {
  const { run } = ctx
  const tier = run.tier
  const m = modelPhrase(tier)
  switch (e.kind) {
    case 'request': {
      const role = run.caller ? `, signed in as ${run.caller.role},` : ''
      return quoteToFit(`${ctx.lead}A visitor${role} asked:`, e.text || run.prompt)
    }
    case 'model_turn': {
      if (e.status === 'error') {
        const why = e.code ? qualifyModel(operatorText[e.code], tier) : 'The model call failed.'
        return fit(`The model turn failed: ${why}`, `The model turn failed: ${firstSentence(why)}`, 'The model turn failed before it finished.')
      }
      if (e.stopReason === 'toolUse') {
        return tier === 'live'
          ? 'The model chose to pause its turn and ask for a tool.'
          : `${m.lead} paused its turn to request a tool.`
      }
      if (e.stopReason === 'endTurn' || !e.stopReason) {
        return tier === 'live' ? 'The model chose to finish its turn.' : `${m.lead} finished its turn.`
      }
      const why = stopReasonWords[e.stopReason] ?? 'for a reason the provider reported'
      return `${m.lead} ended its turn ${why}.`
    }
    case 'tool_requested': {
      const tool = toolName(e.tool, ctx)
      const input = describeInput(e.input)
      const withInput = input ? ` with ${input}` : ''
      if (tier === 'live') return fit(`The model chose to ask for ${tool}${withInput}.`, `The model chose to ask for ${tool}.`)
      if (tier === 'simulated') {
        return fit(
          `The simulated model asked for ${tool}${withInput}; you chose what it asks for.`,
          `The simulated model asked for ${tool}${withInput}.`,
          `The simulated model asked for ${tool}.`,
        )
      }
      return fit(`${m.lead} asked for ${tool}${withInput}.`, `${m.lead} asked for ${tool}.`)
    }
    case 'gate': {
      if (e.decision === 'allow') return 'The gate approved this request: every check passed, so the tool may read data once.'
      const where = e.stage ? `at the ${stageWords[e.stage]} check` : 'before any read'
      if (!e.code) return `The gate refused the request ${where}, so nothing was read.`
      const why = qualifyModel(operatorText[e.code], tier)
      return fit(
        `The gate refused ${where}. ${why}`,
        `Refused ${where}: ${why}`,
        `The gate refused ${where}. ${firstSentence(why)}`,
      )
    }
    case 'tool_executed': {
      const tool = toolName(e.tool, ctx)
      if (e.status === 'error') {
        const code = codeFor(e, run)
        const why = code ? qualifyModel(operatorText[code], tier) : 'it reported an error.'
        return fit(`${cap(tool)} failed: ${why}`, `${cap(tool)} failed: ${firstSentence(why)}`, `${cap(tool)} failed.`)
      }
      const rows = e.rows !== undefined ? `${e.rows.toLocaleString('en-US')} rows` : 'its data'
      const from = e.resourceIds?.length === 1 ? ` from the file ${e.resourceIds[0]}` : e.resourceIds?.length ? ` from ${e.resourceIds.length} sources` : ''
      return fit(`${cap(tool)} read ${rows}${from}.`, `${cap(tool)} read ${rows}.`)
    }
    case 'tool_result': {
      if (e.status === 'error') {
        const code = codeFor(e, run)
        if (!code) return `Instead of data, ${m.ref} received a fixed refusal sentence.`
        return quoteToFit(`Instead of data, ${m.ref} received one fixed sentence:`, modelText[code])
      }
      return `The tool’s result went back to ${m.ref} as data.`
    }
    case 'answer': {
      const text = e.text?.trim() || run.finalText.trim()
      if (!text) return `${cap(m.ref)} wrote no answer.`
      const lead = tier === 'replay' ? 'In this recording, the scripted model wrote:' : `${cap(m.ref)} wrote:`
      return quoteToFit(lead, text)
    }
    case 'run_closed': {
      const code = e.code ?? run.outcome.code
      if (e.status === 'error' || run.outcome.status === 'failed' || run.outcome.status === 'cancelled') {
        const why = code ? qualifyModel(operatorText[code], tier) : 'it did not finish.'
        return fit(`The run closed with a failure: ${why}`, `The run closed with a failure: ${firstSentence(why)}`, 'The run closed with a failure.')
      }
      const reads = run.ledger.length
      const ledger = reads === 0 ? 'the read ledger is empty, so no data was read' : `the read ledger records ${reads} data ${reads === 1 ? 'read' : 'reads'}`
      return run.outcome.status === 'denied'
        ? `The run closed after a refusal; ${ledger}.`
        : `The run closed with an answer; ${ledger}.`
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * One sentence per event, in order. The first starts with the run's tier label,
 * e.g. "Recorded replay. A visitor asked: “How do rentals vary with the weather?”".
 */
export function narrate(run: LabRun): string[] {
  const ctx: Ctx = { run, seen: new Set(), lead: '' }
  return run.events.map((e, i) => {
    if (i > 0) { ctx.lead = ''; return sentence(e, ctx) }
    // The tier label is fixed; the rest of the first sentence shrinks to fit the word limit.
    ctx.lead = `${tierLabel(run)}. `
    return e.kind === 'request' ? sentence(e, ctx) : fit(ctx.lead + sentence(e, ctx), ctx.lead.trim())
  })
}
