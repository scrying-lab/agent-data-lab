// The evaluation suite's own tests: the stored results are valid, complete, passing and current,
// and the suite can fail (red proof), so a green result means something.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { configureLogging } from '@strands-agents/sdk'
import { evalResultsSchema, type EvalResults } from '../agent/run-contract'
import { cases, computeInputsHash, installedSdkVersion, runEvaluation } from '../evaluation/cases'
import type * as Policy from '../governance/policy'
import { importedPackages, lockedClosure, readLockfile } from '../evaluation/inputs'

const stored: EvalResults = evalResultsSchema.parse(JSON.parse(readFileSync(new URL('../evaluation/results.json', import.meta.url), 'utf8')))

/** Timing may differ between runs; nothing else may. lab-eval/v1 stores none today, but strip any that appear. */
function untimed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(untimed)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(elapsedMs|tMs)$/.test(key)).map(([key, v]) => [key, untimed(v)]))
  }
  return value
}
const count = (results: EvalResults, category: string) => results.cases.filter(c => c.category === category).length
const prefixes = { legitimate: 'L', 'out-of-scope': 'O', 'malformed-injection': 'M', failure: 'F', regression: 'R' } as const

beforeAll(() => {
  // The failure cases make the SDK log errors on purpose; keep test output readable.
  configureLogging({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} })
})

describe('stored evaluation results (evaluation/results.json)', () => {
  it('stored results parse as lab-eval/v1', () => {
    expect(stored.contractVersion).toBe('lab-eval/v1')
    expect(stored.summary).toEqual({ total: stored.cases.length, passed: stored.cases.filter(c => c.pass).length })
    for (const c of stored.cases) expect(c.sideEffects, c.id).toBe('none')
  })
  it('holds 8 legitimate, 4 out-of-scope, 4 malformed or injection and 4 failure cases, plus 3 regressions, with stable IDs', () => {
    expect(count(stored, 'legitimate')).toBe(8)
    expect(count(stored, 'out-of-scope')).toBe(4)
    expect(count(stored, 'malformed-injection')).toBe(4)
    expect(count(stored, 'failure')).toBe(4)
    expect(count(stored, 'regression')).toBe(3)
    expect(stored.cases).toHaveLength(23)
    expect(stored.cases.map(c => c.id)).toEqual([
      'L-01', 'L-02', 'L-03', 'L-04', 'L-05', 'L-06', 'L-07', 'L-08',
      'O-01', 'O-02', 'O-03', 'O-04', 'M-01', 'M-02', 'M-03', 'M-04',
      'F-01', 'F-02', 'F-03', 'F-04', 'R-01', 'R-02', 'R-03',
    ])
    expect(cases.map(c => c.id)).toEqual(stored.cases.map(c => c.id))
    for (const c of stored.cases) expect(c.id.charAt(0), c.id).toBe(prefixes[c.category])
  })
  it('every stored case passed: all 20 cases plus 3 regressions', () => {
    const failed = stored.cases.filter(c => !c.pass).map(c => `${c.id}: ${c.reason}`)
    expect(failed).toEqual([])
    expect(stored.summary).toEqual({ total: 23, passed: 23 })
  })
  it('records what happened, not just a verdict: refusals read nothing and name their stage and code', () => {
    for (const c of stored.cases.filter(c => c.observed.outcome === 'denied')) {
      expect(c.observed.ledgerSize, c.id).toBe(0)
      expect(c.observed.decisions, c.id).toContainEqual({ tool: c.expected.tool, decision: 'deny', stage: c.expected.stage, code: c.expected.code })
    }
    expect(stored.cases.find(c => c.id === 'M-04')?.observed.ledgerSize).toBe(1)
    expect(stored.cases.find(c => c.id === 'F-01')?.observed.decisions).toEqual([])
  })
  it('the stored inputsHash matches the current gate, runner, cases and the locked packages they load', () => {
    expect(stored.inputsHash, 'stale: run node --import tsx evaluation/run.ts').toBe(computeInputsHash())
    expect(stored.sdkVersion).toBe(installedSdkVersion())
  })
})

describe('what the inputsHash covers', () => {
  const lock = readLockfile()
  const packages = importedPackages()
  const closure = lockedClosure(lock, packages).map(([key]) => key)
  // Bump one locked entry's version and integrity, leaving everything else as it is.
  const bump = (key: string) => ({ packages: { ...lock.packages, [key]: { ...lock.packages[key], version: '999.0.0', integrity: 'sha512-changed' } } })

  it('covers the agent SDK, the schema library and the data library, and what they depend on', () => {
    for (const name of ['@strands-agents/sdk', 'zod', 'arquero']) expect(closure, name).toContain(`node_modules/${name}`)
    expect(closure.length).toBeGreaterThan(packages.length)
  })
  it('leaves out page-only packages the evaluation never loads', () => {
    for (const name of ['lucide-react', 'react', 'react-dom', '@observablehq/plot', '@codemirror/view', '@xyflow/react']) {
      expect(closure, name).not.toContain(`node_modules/${name}`)
    }
  })
  it('does not change when a page-only package is updated', () => {
    expect(computeInputsHash(bump('node_modules/lucide-react'), packages)).toBe(computeInputsHash(lock, packages))
  })
  it('changes when the SDK or anything it depends on is updated', () => {
    const transitive = closure.find(key => !packages.some(name => key === `node_modules/${name}`))!
    for (const key of ['node_modules/@strands-agents/sdk', transitive]) {
      expect(computeInputsHash(bump(key), packages), key).not.toBe(computeInputsHash(lock, packages))
    }
  })
})

describe('fresh evaluation run', () => {
  it('a fresh run matches the stored results, apart from timing', async () => {
    const fresh = await runEvaluation()
    expect(untimed(fresh)).toEqual(untimed(stored))
  }, 60_000)
})

describe('red proof: the suite can fail', () => {
  it('red proof: with a gate that allows everything, every out-of-scope case fails', async () => {
    // Swap governance/policy's gate for a broken one, for this test only. It allows whatever the real
    // gate allows; otherwise it retries as the most privileged role; otherwise it allows anyway with an
    // approval the store never issued. The runner and the cases are loaded fresh against it.
    vi.resetModules()
    vi.doMock('../governance/policy', async importOriginal => {
      const actual = await importOriginal<typeof Policy>()
      const brokenGate: typeof actual.gate = (caller, tool, input, readsLeft) => {
        const real = actual.gate(caller, tool, input, readsLeft)
        if (real.decision === 'allow') return real
        const escalated = actual.gate({ id: caller.id, role: 'operations-analyst' }, tool, input, Math.max(readsLeft, 1))
        if (escalated.decision === 'allow') return escalated
        return {
          decision: 'allow', tool: tool as 'getSyntheticMetric', args: input as never, effectiveScope: 'internal',
          approval: Object.freeze({ tool: tool as 'getSyntheticMetric', canonicalArgs: actual.canonicalArgs(input) }),
        }
      }
      return { ...actual, gate: brokenGate }
    })
    try {
      const broken = await import('../evaluation/cases')
      const results = await broken.runEvaluation(broken.cases.filter(c => c.category !== 'legitimate'))
      const outOfScope = results.cases.filter(c => c.category === 'out-of-scope')
      expect(outOfScope).toHaveLength(4)
      for (const c of outOfScope) {
        expect(c.pass, c.id).toBe(false)
        expect(c.observed.decisions.every(d => d.decision === 'allow'), c.id).toBe(true)
      }
      // The broken gate let a forged scope through to a real internal read (O-03).
      expect(results.cases.find(c => c.id === 'O-03')?.observed.ledgerSize).toBe(1)
      expect(results.summary.passed).toBeLessThan(results.summary.total)
    } finally {
      vi.doUnmock('../governance/policy')
      vi.resetModules()
    }
  }, 60_000)
})
