import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import recordings from '../fixtures/executions.json'
import { denyCodes, operatorText, runSchema, tierLabel, type DenyCode, type LabRun, type RunEvent } from '../agent/run-contract'
import { MAX_WORDS, countWords, narrate, qualifyModel, stageWords, toolGloss } from '../content/narration'
import { toSteps } from '../src/trace/steps'

const fixtures = z.array(runSchema).parse(recordings)
const base = fixtures.find(r => r.outcome.status === 'ok')!

const liveRun: LabRun = runSchema.parse({
  ...base,
  runId: 'live-example',
  tier: 'live',
  provider: { kind: 'bedrock', modelId: 'example.model-v1', region: 'us-east-1' },
})
const simulatedRun: LabRun = runSchema.parse({ ...base, runId: 'sim-example', tier: 'simulated', recordedAt: null })

/** A governance-style refusal for each deny code, so every operatorText is narrated at least once. */
function refusal(code: DenyCode, tier: LabRun['tier']): LabRun {
  const stage = code === 'TOOL_NOT_IN_LESSON' ? 'allowlist' : code === 'SCHEMA_INVALID' ? 'schema' : code === 'CALLER_UNKNOWN' ? 'caller' : code === 'READ_BUDGET_EXHAUSTED' ? 'budget' : 'arguments'
  const tool = code === 'TOOL_NOT_IN_LESSON' ? 'deleteAllRecords' : 'getSyntheticMetric'
  const events: RunEvent[] = [
    { seq: 0, tMs: 0.1, kind: 'request', text: 'Show me the internal revenue metric for last quarter, please.' },
    { seq: 1, tMs: 0.4, kind: 'model_turn', status: 'success', stopReason: 'toolUse' },
    { seq: 2, tMs: 0.5, kind: 'tool_requested', tool, toolUseId: 't1', input: { metric: 'revenue', scope: 'internal' } },
    { seq: 3, tMs: 0.6, kind: 'gate', tool, toolUseId: 't1', decision: 'deny', stage, code },
    { seq: 4, tMs: 0.7, kind: 'tool_result', tool, toolUseId: 't1', status: 'error' },
    { seq: 5, tMs: 0.9, kind: 'model_turn', status: 'success', stopReason: 'endTurn' },
    { seq: 6, tMs: 0.9, kind: 'answer', text: 'That metric is not available to you.' },
    { seq: 7, tMs: 1.0, kind: 'run_closed', status: 'success', stopReason: 'endTurn' },
  ]
  return runSchema.parse({
    ...base, runId: `deny-${code}-${tier}`, lesson: 'governance', scenario: 'gov-' + code.toLowerCase(), tier,
    caller: { role: 'rider-support' }, prompt: events[0].text, events, ledger: [], result: null,
    finalText: 'That metric is not available to you.', outcome: { status: 'denied', code },
  })
}
const tiersUnderTest = ['replay', 'simulated', 'live'] as const
const refusals = denyCodes.flatMap(code => tiersUnderTest.map(tier => refusal(code, tier)))

const allRuns = [...fixtures, liveRun, simulatedRun, ...refusals]
const MODEL_CLAIM = /\bmodel (decided|chose|asks|asked|ask)\b/i
/** "model asked" etc. counts as qualified only when the scripted or simulated model is named. */
const UNQUALIFIED_CLAIM = /(?<!\b(?:scripted|simulated) )\bmodel (decided|chose|asks|asked|ask)\b/i

describe('narrate(run)', () => {
  it('is deterministic for every fixture', () => {
    for (const run of fixtures) expect(narrate(run)).toEqual(narrate(structuredClone(run)))
    expect(narrate(fixtures[0])).toMatchInlineSnapshot(`
      [
        "Recorded replay. A visitor asked: “How does hourly demand change on working days?”",
        "In this recording, the scripted model paused its turn to request a tool.",
        "In this recording, the scripted model asked for the hourly pattern reader (compareHourlyPatterns) with period “both”.",
        "The gate approved this request: every check passed, so the tool may read data once.",
        "The hourly pattern reader read 17,379 rows from the file hour.csv.",
        "The tool’s result went back to the scripted model as data.",
        "In this recording, the scripted model finished its turn.",
        "In this recording, the scripted model wrote: “Working days at 17:00 averaged 525.3 rentals per observed hour (n = 499). …”",
        "The run closed with an answer; the read ledger records 1 data read.",
      ]
    `)
  })

  it.each(allRuns.map(r => [r.runId, r] as const))('%s: one sentence per event, each at most 25 words', (_id, run) => {
    const sentences = narrate(run)
    expect(sentences).toHaveLength(run.events.length)
    for (const s of sentences) {
      expect(s.trim().length, 'empty sentence').toBeGreaterThan(0)
      expect(countWords(s), s).toBeLessThanOrEqual(MAX_WORDS)
    }
  })

  it.each(allRuns.map(r => [r.runId, r] as const))('%s: the first sentence starts with tierLabel(run)', (_id, run) => {
    expect(narrate(run)[0].startsWith(tierLabel(run) + '.')).toBe(true)
  })

  it('never claims an unqualified model choice outside a live run', () => {
    for (const run of allRuns.filter(r => r.tier !== 'live')) {
      for (const s of narrate(run)) expect(s, `${run.runId}: ${s}`).not.toMatch(UNQUALIFIED_CLAIM)
    }
  })

  it('a live run may say the model chose', () => {
    const sentences = narrate(liveRun)
    expect(sentences.some(s => MODEL_CLAIM.test(s) && UNQUALIFIED_CLAIM.test(s))).toBe(true)
    expect(sentences.join(' ')).not.toMatch(/scripted|simulated/)
  })

  it('names the scripted model in replays and the simulated model in browser runs', () => {
    expect(narrate(fixtures[0]).join(' ')).toMatch(/In this recording, the scripted model asked for/)
    const sim = narrate(simulatedRun).join(' ')
    expect(sim).toMatch(/The simulated model asked for/)
    expect(sim).toMatch(/you chose what it asks for/)
  })

  it('refusal sentences quote operatorText and name the stage in plain words', () => {
    for (const run of [...fixtures.filter(r => r.outcome.status === 'denied'), ...refusals]) {
      const sentences = narrate(run)
      const i = run.events.findIndex(e => e.kind === 'gate' && e.decision === 'deny')
      const gate = run.events[i]
      const text = qualifyModel(operatorText[gate.code!], run.tier)
      // Long operator texts would break the word limit; then the first sentence of the text is quoted in full.
      const quoted = sentences[i].includes(text) ? text : text.split(/(?<=[.!?])\s+/)[0]
      expect(sentences[i], `${run.runId}`).toContain(quoted)
      expect(sentences[i]).toContain(`the ${stageWords[gate.stage!]} check`)
    }
  })

  it('quotes the full operatorText whenever it fits the word limit', () => {
    const run = fixtures.find(r => r.outcome.code === 'READ_BUDGET_EXHAUSTED')!
    expect(narrate(run).join(' ')).toContain(operatorText.READ_BUDGET_EXHAUSTED)
  })

  it('glosses every tool name on first use and never shows a bare identifier', () => {
    for (const run of allRuns) {
      const sentences = narrate(run)
      const tools = [...new Set(run.events.map(e => e.tool).filter((t): t is string => !!t))]
      for (const tool of tools) {
        const mentions = sentences.filter(s => s.includes(tool))
        expect(mentions.length, `${run.runId}: ${tool} never glossed`).toBeGreaterThan(0)
        const gloss = toolGloss[tool] ?? 'a tool this lesson does not offer'
        expect(mentions[0]).toContain(`${gloss} (${tool})`)
        for (const s of sentences) {
          const bare = s.replaceAll(`(${tool})`, '')
          expect(bare.includes(tool), `bare identifier in: ${s}`).toBe(false)
        }
      }
    }
  })
})

describe('toSteps(run) honesty', () => {
  it('never claims an unqualified model choice in step labels or explanations outside a live run', () => {
    for (const run of allRuns.filter(r => r.tier !== 'live')) {
      for (const step of toSteps(run)) {
        expect(step.label, `${run.runId} step ${step.index + 1}`).not.toMatch(UNQUALIFIED_CLAIM)
        // The answer step shows the run's own final text, which is the model's words, not the lab's claim.
        if (step.event.kind === 'answer') continue
        expect(step.explanation, `${run.runId} step ${step.index + 1}`).not.toMatch(UNQUALIFIED_CLAIM)
      }
    }
  })

  it('names the scripted model in replays, the simulated model in browser runs, and the model only when live', () => {
    const toolTurn = (run: LabRun) => toSteps(run).find(s => s.event.kind === 'model_turn' && s.event.stopReason === 'toolUse')!
    expect(toolTurn(fixtures[0]).label).toBe('Scripted model requests data')
    expect(toolTurn(fixtures[0]).explanation).toMatch(/^In this recording, the scripted model /)
    expect(toolTurn(simulatedRun).label).toBe('Simulated model requests data')
    expect(toolTurn(simulatedRun).explanation).toMatch(/^The simulated model /)
    expect(toolTurn(liveRun).label).toBe('Model asks for data')
    expect(toSteps(liveRun).map(s => s.label + ' ' + s.explanation).join(' ')).not.toMatch(/scripted|simulated/)
  })
})
