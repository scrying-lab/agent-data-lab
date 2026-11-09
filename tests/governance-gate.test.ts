import { describe, it, expect } from 'vitest'
import { gate, canonicalArgs, createSyntheticStore, sanitizeDocs, sanitizeMetric, NotApprovedError } from '../governance/policy'
import { dataFingerprint } from '../governance/fingerprint.node'
import type { Approval, Caller, GetMetricArgs, SearchDocsArgs } from '../governance/contracts'
import { metrics } from '../governance/synthetic'

const support: Caller = { id: 'u-support', role: 'rider-support' }
const analyst: Caller = { id: 'u-analyst', role: 'operations-analyst' }
const guest: Caller = { id: 'u-guest', role: 'guest' }
const metric = (metricId: string, period = '2026-Q1', scope: 'public' | 'internal' = 'public') => ({ metricId, period, scope })

/** Ask the gate first, as the runner does, and hand back what the store needs. */
function approved<A extends SearchDocsArgs | GetMetricArgs>(caller: Caller, tool: string, input: A) {
  const result = gate(caller, tool, input, 1)
  if (result.decision !== 'allow') throw Error(`expected allow, got ${result.code}`)
  return { args: result.args as A, approval: result.approval }
}
const noApproval = undefined as unknown as Approval

describe('governance gate: allowlist → schema → caller → arguments → budget', () => {
  it('allows a permitted metric, passes only validated arguments on, and binds an approval to them', () => {
    const result = gate(support, 'getSyntheticMetric', metric('trips-completed'), 2)
    expect(result).toEqual({
      decision: 'allow', tool: 'getSyntheticMetric', args: metric('trips-completed'), effectiveScope: 'public',
      approval: { tool: 'getSyntheticMetric', canonicalArgs: '{"metricId":"trips-completed","period":"2026-Q1","scope":"public"}' },
    })
  })
  it.each([
    ['tool outside the lesson (mutation)', support, 'updateSyntheticMetric', metric('trips-completed'), 'allowlist', 'TOOL_NOT_IN_LESSON'],
    ['malformed argument type', support, 'getSyntheticMetric', { metricId: 42, period: '2026-Q1', scope: 'public' }, 'schema', 'SCHEMA_INVALID'],
    ['identity smuggled into arguments', support, 'getSyntheticMetric', { ...metric('trips-completed'), role: 'operations-analyst' }, 'schema', 'SCHEMA_INVALID'],
    ['tool not granted to role', guest, 'getSyntheticMetric', metric('trips-completed'), 'caller', 'TOOL_NOT_GRANTED'],
    ['forged scope', support, 'getSyntheticMetric', metric('maintenance-backlog', '2026-Q1', 'internal'), 'caller', 'SCOPE_NOT_GRANTED'],
    ['unknown metric', support, 'getSyntheticMetric', metric('fleet-teleport-rate'), 'arguments', 'UNKNOWN_METRIC'],
    ['unknown period', support, 'getSyntheticMetric', metric('trips-completed', '2025-Q4'), 'arguments', 'UNKNOWN_PERIOD'],
    ['metric above requested scope', support, 'getSyntheticMetric', metric('maintenance-backlog'), 'arguments', 'METRIC_ABOVE_SCOPE'],
  ] as const)('denies %s at the %s stage', (_label, caller, tool, input, stage, code) => {
    expect(gate(caller, tool, input, 2)).toMatchObject({ decision: 'deny', stage, code })
  })
  it('the same request is allowed for a role that holds the grant', () => {
    expect(gate(analyst, 'getSyntheticMetric', metric('maintenance-backlog', '2026-Q1', 'internal'), 2).decision).toBe('allow')
  })
  it('a valid request still stops when the read budget is spent', () => {
    expect(gate(support, 'getSyntheticMetric', metric('trips-completed'), 0)).toMatchObject({ stage: 'budget', code: 'READ_BUDGET_EXHAUSTED' })
  })
  it('canonicalArgs ignores key order', () => {
    expect(canonicalArgs({ scope: 'public', period: '2026-Q1', metricId: 'x' })).toBe(canonicalArgs({ metricId: 'x', period: '2026-Q1', scope: 'public' }))
  })
})

describe('synthetic store and sanitization', () => {
  it('a public search never touches internal records', async () => {
    const store = createSyntheticStore()
    const { args, approval } = approved(support, 'searchSyntheticDocs', { query: 'incident escalation runbook', scope: 'public' })
    const hits = await store.searchDocs(args, approval)
    expect(hits).toEqual([])
    expect(store.reads).toEqual([{ tool: 'searchSyntheticDocs', classifications: ['public'], resourceIds: [] }])
  })
  it('strips sensitive fields and labels results synthetic', async () => {
    const store = createSyntheticStore()
    const search = approved(support, 'searchSyntheticDocs', { query: 'helmet policy', scope: 'public' })
    const read = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    const docs = sanitizeDocs(await store.searchDocs(search.args, search.approval), 'public')
    const value = sanitizeMetric(await store.getMetric(read.args, read.approval))
    const text = JSON.stringify([docs, value])
    expect(docs.hits.map(h => h.id)).toEqual(['doc-helmet-policy'])
    expect(value).toMatchObject({ synthetic: true, value: 41250, observations: 90 })
    expect(text).not.toMatch(/internalNotes|owner|@northgate\.invalid/)
  })
  it('keeps an empty period distinct from zero', async () => {
    const { args, approval } = approved(support, 'getSyntheticMetric', metric('station-outage-minutes', '2026-Q2'))
    const out = sanitizeMetric(await createSyntheticStore().getMetric(args, approval))
    expect([out.value, out.observations]).toEqual([null, 0])
  })
  it('rejects a corrupted value instead of passing it on', async () => {
    const { args, approval } = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    const raw = await createSyntheticStore('corrupt').getMetric(args, approval)
    expect(() => sanitizeMetric(raw)).toThrow()
  })
  it('the synthetic data is frozen, so a read cannot become a write', () => {
    const before = dataFingerprint()
    const writable = metrics[0].periods['2026-Q1'] as { value: number | null }
    expect(() => { writable.value = 0 }).toThrow(TypeError)
    expect(dataFingerprint()).toBe(before)
  })
})

describe('regressions', () => {
  it('R-01: a restricted metric gives the same refusal for every period, so periods cannot be probed', () => {
    const q1 = gate(support, 'getSyntheticMetric', metric('payroll-cost', '2026-Q1'), 2)
    const q2 = gate(support, 'getSyntheticMetric', metric('payroll-cost', '2026-Q2'), 2)
    expect(q1).toMatchObject({ decision: 'deny', stage: 'arguments', code: 'METRIC_ABOVE_SCOPE' })
    expect(q2).toMatchObject({ decision: 'deny', stage: 'arguments', code: 'METRIC_ABOVE_SCOPE' })
  })
  it.each(['nobody', 'toString', 'constructor', '__proto__', 'hasOwnProperty'])('R-02: role %j is refused as CALLER_UNKNOWN without throwing', role => {
    const caller = { id: 'u-x', role } as unknown as Caller
    let result: unknown
    expect(() => { result = gate(caller, 'getSyntheticMetric', metric('trips-completed'), 2) }).not.toThrow()
    expect(result).toMatchObject({ decision: 'deny', stage: 'caller', code: 'CALLER_UNKNOWN' })
  })
  it('R-03: arguments changed after approval are refused with NOT_APPROVED and nothing is read', async () => {
    const store = createSyntheticStore()
    const { args, approval } = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    const tampered = { ...args, metricId: 'payroll-cost', scope: 'internal' as const }
    await expect(store.getMetric(tampered, approval)).rejects.toMatchObject({ code: 'NOT_APPROVED' })
    expect(store.reads).toEqual([])
  })
  it('R-03: a direct store call with no approval is refused with NOT_APPROVED and nothing is read', async () => {
    const store = createSyntheticStore()
    await expect(store.getMetric(metric('payroll-cost', '2026-Q1', 'internal'), noApproval)).rejects.toBeInstanceOf(NotApprovedError)
    await expect(store.searchDocs({ query: 'incident runbook', scope: 'internal' }, noApproval)).rejects.toMatchObject({ code: 'NOT_APPROVED' })
    expect(store.reads).toEqual([])
  })
  it('R-03: an approval built outside the gate, or for another tool, or used twice, is refused', async () => {
    const store = createSyntheticStore()
    const args = metric('payroll-cost', '2026-Q1', 'internal')
    const forged: Approval = { tool: 'getSyntheticMetric', canonicalArgs: canonicalArgs(args) }
    await expect(store.getMetric(args, forged)).rejects.toMatchObject({ code: 'NOT_APPROVED' })
    const search = approved(support, 'searchSyntheticDocs', { query: 'helmet', scope: 'public' })
    await expect(store.getMetric(metric('trips-completed'), search.approval)).rejects.toMatchObject({ code: 'NOT_APPROVED' })
    const read = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    await store.getMetric(read.args, read.approval)
    await expect(store.getMetric(read.args, read.approval)).rejects.toMatchObject({ code: 'NOT_APPROVED' })
    expect(store.reads).toHaveLength(1)
  })
  it('R-04: the gate hands back frozen arguments, so they cannot be edited after approval', () => {
    const { args } = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    expect(Object.isFrozen(args)).toBe(true)
    expect(() => { (args as { metricId: string }).metricId = 'payroll-cost' }).toThrow(TypeError)
  })
  it('R-04: a metric request edited in place while the store waits still reads only what was approved', async () => {
    const store = createSyntheticStore('slow', 20)
    const { args, approval } = approved(support, 'getSyntheticMetric', metric('trips-completed'))
    const live: GetMetricArgs = { ...args } // same content, so it matches the approval, but editable
    const pending = store.getMetric(live, approval)
    live.metricId = 'payroll-cost'
    live.scope = 'internal'
    expect(sanitizeMetric(await pending)).toMatchObject({ metricId: 'trips-completed', value: 41250 })
    expect(store.reads).toEqual([{ tool: 'getSyntheticMetric', classifications: ['public'], resourceIds: ['trips-completed'] }])
  })
  it('R-04: a search edited in place while the store waits still reads only what was approved', async () => {
    const store = createSyntheticStore('slow', 20)
    const { args, approval } = approved(support, 'searchSyntheticDocs', { query: 'incident escalation runbook', scope: 'public' })
    const live: SearchDocsArgs = { ...args }
    const pending = store.searchDocs(live, approval)
    live.scope = 'internal'
    expect(await pending).toEqual([])
    expect(store.reads).toEqual([{ tool: 'searchSyntheticDocs', classifications: ['public'], resourceIds: [] }])
  })
  it('R-03: an analyst with the grant can still read an internal metric', async () => {
    const store = createSyntheticStore()
    const { args, approval } = approved(analyst, 'getSyntheticMetric', metric('payroll-cost', '2026-Q1', 'internal'))
    const out = sanitizeMetric(await store.getMetric(args, approval))
    expect(out).toMatchObject({ metricId: 'payroll-cost', value: 612400 })
    expect(store.reads).toEqual([{ tool: 'getSyntheticMetric', classifications: ['internal'], resourceIds: ['payroll-cost'] }])
  })
})
