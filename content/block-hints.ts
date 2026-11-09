// The playground's editable blocks, as data. The UI renders one panel per entry, so a new block
// (for example the analytics period block) is a new entry here plus a shape in
// src/playground/parse.ts, not a new component.
//
// Plain version: each block is a small piece of plain data a visitor can change, often by one word.
// The "try this" chips each change exactly one word and say what the gate should do.
//
// Developer notes: every expectation below is checked by actually running the real Strands loop
// and gate in tests/playground.test.tsx. Chips apply to the data lines only, never the comments.
import type { DenyCode, Stage } from '../agent/run-contract'

export const blockIds = ['caller', 'requests'] as const
export type BlockId = typeof blockIds[number]

/** What a run should end as. `answerIncludes` is text the simulated model's answer must contain. */
export type ExpectedOutcome =
  | { status: 'ok'; answerIncludes: string; summary: string }
  | { status: 'denied'; stage: Stage; code: DenyCode }

export type BlockChip = Readonly<{
  id: string
  /** Shown on the button after "Try". */
  label: string
  /** The one token in the data lines that changes, and what it becomes. */
  find: string
  replace: string
  /** Spoken after the chip is applied, e.g. "Role set to guest". */
  announcement: string
  /** Expected result when every other block keeps its default text. */
  expected: ExpectedOutcome
}>

/** An extra row in the expected-outcome table that combines chips from several blocks. */
export type ComboRow = Readonly<{ label: string; chips: Partial<Record<BlockId, string>>; expected: ExpectedOutcome }>

export type PlaygroundBlock = Readonly<{
  id: BlockId
  title: string
  /** One or two plain sentences. */
  intro: string
  defaultText: string
  /** The comment lines of the default text, kept visible beside the editor even if the visitor deletes them. */
  hints: readonly string[]
  /** At most three "try this" changes, each one token. */
  chips: readonly BlockChip[]
  combos: readonly ComboRow[]
}>

/** Every block, as written, gives this result. */
export const defaultExpected: ExpectedOutcome = { status: 'ok', answerIncludes: '41250', summary: '41250 trips' }

const callerText = [
  '// WHO IS ASKING. In a real app this comes from sign-in, never from the model.',
  "// Try one word: 'rider-support' -> 'guest' or 'operations-analyst'. Or readsLeft: 0.",
  "{ role: 'rider-support', readsLeft: 1 }",
].join('\n')

const requestsText = [
  '// A real model chooses this. Here you do, so every run is repeatable.',
  "// Try: scope 'public' -> 'internal'; metricId -> 'payroll-cost'; period -> '2026-Q3'.",
  "[{ tool: 'getSyntheticMetric',",
  "   input: { metricId: 'trips-completed', period: '2026-Q1', scope: 'public' } }]",
].join('\n')

/** The `//` comment lines of a block's text, without the slashes. */
export function commentLines(text: string): string[] {
  return text.split('\n').filter(line => line.trimStart().startsWith('//')).map(line => line.trimStart().replace(/^\/\/\s?/, ''))
}

export const playgroundBlocks: readonly PlaygroundBlock[] = Object.freeze([
  {
    id: 'caller',
    title: 'Who is asking',
    intro: 'The app tells the gate who is signed in and how many data reads this request may use. The model cannot change this.',
    defaultText: callerText,
    hints: commentLines(callerText),
    chips: [
      { id: 'guest', label: 'guest', find: "'rider-support'", replace: "'guest'", announcement: 'Role set to guest', expected: { status: 'denied', stage: 'caller', code: 'TOOL_NOT_GRANTED' } },
      { id: 'operations-analyst', label: 'operations-analyst', find: "'rider-support'", replace: "'operations-analyst'", announcement: 'Role set to operations-analyst', expected: defaultExpected },
      { id: 'reads-0', label: 'readsLeft: 0', find: 'readsLeft: 1', replace: 'readsLeft: 0', announcement: 'Reads left set to 0', expected: { status: 'denied', stage: 'budget', code: 'READ_BUDGET_EXHAUSTED' } },
    ],
    combos: [],
  },
  {
    id: 'requests',
    title: 'What the simulated model asks for',
    intro: 'A real model would decide which data to ask for. Here you write its requests, and the gate checks each one before anything is read.',
    defaultText: requestsText,
    hints: commentLines(requestsText),
    chips: [
      { id: 'internal', label: "scope 'internal'", find: "scope: 'public'", replace: "scope: 'internal'", announcement: 'Scope set to internal', expected: { status: 'denied', stage: 'caller', code: 'SCOPE_NOT_GRANTED' } },
      { id: 'payroll-cost', label: 'payroll-cost', find: "'trips-completed'", replace: "'payroll-cost'", announcement: 'Metric set to payroll-cost', expected: { status: 'denied', stage: 'arguments', code: 'METRIC_ABOVE_SCOPE' } },
      { id: 'q3', label: '2026-Q3', find: "'2026-Q1'", replace: "'2026-Q3'", announcement: 'Period set to 2026-Q3', expected: { status: 'denied', stage: 'arguments', code: 'UNKNOWN_PERIOD' } },
    ],
    combos: [
      { label: "operations-analyst (block 1) with scope 'internal'", chips: { caller: 'operations-analyst', requests: 'internal' }, expected: defaultExpected },
    ],
  },
] satisfies PlaygroundBlock[])

export function findBlock(id: BlockId): PlaygroundBlock {
  const block = playgroundBlocks.find(b => b.id === id)
  if (!block) throw Error('Unknown playground block')
  return block
}

/** The block's default text with one chip applied. Only data lines change; comment lines stay as written. */
export function applyChip(block: PlaygroundBlock, chip: BlockChip): string {
  let done = false
  return block.defaultText.split('\n').map(line => {
    if (done || line.trimStart().startsWith('//') || !line.includes(chip.find)) return line
    done = true
    return line.replace(chip.find, chip.replace)
  }).join('\n')
}

/** The default text of every block, with the given chips applied. */
export function textsWith(chips: Partial<Record<BlockId, string>> = {}): Record<BlockId, string> {
  const texts = {} as Record<BlockId, string>
  for (const block of playgroundBlocks) {
    const chip = block.chips.find(c => c.id === chips[block.id])
    texts[block.id] = chip ? applyChip(block, chip) : block.defaultText
  }
  return texts
}

/** "Allowed · 41250 trips" or "Refused · caller · TOOL_NOT_GRANTED". */
export function describeExpected(expected: ExpectedOutcome): string {
  return expected.status === 'ok' ? `Allowed · ${expected.summary}` : `Refused · ${expected.stage} · ${expected.code}`
}
