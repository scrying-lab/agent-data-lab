// The two lessons in plain language: what each one is about, a question to answer before running,
// a short route for newcomers and one for developers, and where the code lives.
// Every statement here describes code that exists in this repository. tests/lessons.test.tsx checks
// the summary length, that each prediction is a question, and that every code pointer exists.
import { modelText, type Lesson } from '../agent/run-contract'

export type CodePointer = {
  /** Repository-relative path. */
  path: string
  /** What a reader finds there, in one plain sentence. */
  what: string
}

export type LessonContent = {
  id: Lesson
  title: string
  /** At most 80 words, for someone who has never written code. */
  summary: string
  /** One question the visitor answers in their head before running. Ends with a question mark. */
  prediction: string
  /** Two or three steps for a newcomer. */
  beginner: string[]
  /** Two or three steps for a developer. */
  extension: string[]
  codePointers: CodePointer[]
}

export const lessonContent: Record<Lesson, LessonContent> = {
  analytics: {
    id: 'analytics',
    title: 'Ask the bike data a question',
    summary:
      'A small AI agent answers a question about real bike rentals in Washington, DC. It cannot open the data by itself: it has to ask for a tool. Before the tool runs, a gate checks that the tool fits the question, that the request has the right shape, and that a data read is still left. Only then is the data read and charted. What you watch is a saved recording made with a scripted stand-in for the AI model.',
    prediction: 'If you block all data reads and play the same question, what will the agent say, and will any data be read?',
    beginner: [
      'Pick a question and play the recording. Follow the trace from the request to the written answer.',
      'Switch the tool permission to block all reads and play it again. Find the step where the gate refuses, and check that no data was read.',
      'Open "Show the numbers" under the chart and compare the numbers in the table with the ones in the answer.',
    ],
    extension: [
      'Read analytics/gate.ts: three checks run in a fixed order (allowlist, schema, budget), and the first one that fails refuses with the fixed sentence from modelText in agent/run-contract.ts.',
      'Read recordRun in agent/run.ts, then run npm run record. It regenerates the scripted recordings in fixtures/executions.json; each run is checked against runSchema before it is saved.',
      'Write a test that calls gateRead with the tool for a different question, or with an extra input field, and assert the stage and code it returns.',
    ],
    codePointers: [
      { path: 'agent/run.ts', what: 'Runs one question through a real Strands agent and records every step as a lab-run/v1 run.' },
      { path: 'analytics/gate.ts', what: 'The analytics gate: allowlist, then schema, then read budget.' },
      { path: 'analytics/contracts.ts', what: 'The questions, the one tool each question may use, and the shape of a valid request.' },
      { path: 'analytics/compute.ts', what: 'The measurements the tools compute from the bike-sharing file.' },
      { path: 'fixtures/executions.json', what: 'The saved recordings the page plays back.' },
      { path: 'agent/run-contract.ts', what: 'The shared run format, the fixed sentences the model sees, and the result labels.' },
    ],
  },
  governance: {
    id: 'governance',
    title: 'Who may read what',
    summary:
      'An agent for an invented bike co-op, Northgate Cycle Co-op, can search its documents and look up its figures. All of this data is made up. Who is asking comes from the app, never from the AI, and each role may see different things. A gate checks every request in a fixed order before anything is read. A refusal is the system working as designed: nothing is read, and the AI is told one fixed sentence.',
    prediction: 'If the AI asks for a figure on behalf of a guest, at which check do you expect the gate to stop it?',
    beginner: [
      'Read the five checks in order: allowed tool, correct shape, known caller, permitted arguments, read budget. The first check that fails stops the request.',
      'Compare the three invented roles: a guest can only search public documents; rider support can also look up public figures; an operations analyst can see internal ones too.',
      'For any refusal, look at the list of reads that happened. It should be empty, which shows that nothing was read.',
    ],
    extension: [
      'Read gate() in governance/policy.ts. On allow it returns frozen arguments and a single-use approval; the store created by createSyntheticStore needs both, as in store.getMetric(result.args, result.approval).',
      'Read the R-03 regression tests in tests/governance-gate.test.ts: a store call without a matching approval throws with code NOT_APPROVED and records no read.',
      `Add a test of your own in tests/governance-gate.test.ts: a rider-support caller asking, with scope public, for payroll-cost (an internal metric) and for a metric that does not exist must both hear "${modelText.METRIC_ABOVE_SCOPE}", so a refusal cannot reveal which metrics exist.`,
    ],
    codePointers: [
      { path: 'governance/policy.ts', what: 'The gate, the single-use approvals and the synthetic store with its read ledger.' },
      { path: 'governance/contracts.ts', what: 'The two read tools, their exact inputs and their cleaned-up outputs.' },
      { path: 'governance/synthetic.ts', what: 'The invented documents, figures and roles. Clearly labelled synthetic.' },
      { path: 'tests/governance-gate.test.ts', what: 'Tests for every check and the regressions found so far.' },
      { path: 'agent/run-contract.ts', what: 'The refusal codes, the fixed sentences the model sees, and the plain explanations for people.' },
    ],
  },
}

export const lessonList: LessonContent[] = [lessonContent.analytics, lessonContent.governance]
