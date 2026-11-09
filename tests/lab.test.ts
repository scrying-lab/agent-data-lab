import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { from } from 'arquero'
import { z } from 'zod'
import { analyze } from '../analytics/compute'
import { gateRead } from '../analytics/gate'
import { loadBikes } from '../analytics/load.node.ts'
import { resultSchema, type Result } from '../analytics/contracts'
import { modelText, runSchema, type LabRun } from '../agent/run-contract'
import { ScriptedModel } from '../agent/scripted-model'
import { recordRun } from '../agent/run'

const root = new URL('..', import.meta.url)
const data = loadBikes()
const record = (...args: Parameters<typeof recordRun>) => recordRun(args[0], args[1], args[2], args[3], { table: data, ...args[4] })
const peak = (result: Result, group: string) => [...result.points.filter(p => p.group === group)].sort((a, b) => b.mean - a.mean)[0]
const withoutTime = (run: LabRun, kind: string) => run.events.filter(e => e.kind === kind).map(({ tMs: _t, ...rest }) => rest)

describe('measurement and permission evidence', () => {
  it('divides by observed hours, retaining an observed zero and a sparse group', () => {
    const rows = from([{weathersit:1,cnt:0},{weathersit:1,cnt:10},{weathersit:4,cnt:30}])
    const result = analyze(rows, 'weather', 'both')
    expect(result.points.map(p=>[p.mean,p.n])).toEqual([[5,2],[30,1]])
  })
  it('uses the UCI working-day field, which includes the holiday distinction', () => {
    const rows = from([{workingday:0,weekday:1,hr:8,cnt:20},{workingday:1,weekday:1,hr:8,cnt:80}])
    expect(analyze(rows,'hourly','both').points.map(p=>[p.group,p.mean])).toEqual([['Nonworking days',20],['Working days',80]])
  })
  it('the two year slices account for every observed hour', () => {
    expect(data.numRows()).toBe(17379)
    expect(analyze(data,'week','2011').n + analyze(data,'week','2012').n).toBe(17379)
  })
  it('blocks the same tool request before the data operation', async () => {
    const allowed = await record('weather',1,new ScriptedModel('weather'))
    const denied = await record('weather',0,new ScriptedModel('weather'))
    expect(resultSchema.parse(allowed.result).points.find(p=>p.group.startsWith('Heavy'))?.n).toBe(3)
    expect(denied.result).toBeNull()
    expect(denied.ledger).toEqual([])
    expect(denied.outcome).toEqual({ status: 'denied', code: 'READ_BUDGET_EXHAUSTED' })
    expect(denied.events.map(e=>e.kind)).toEqual(['request','model_turn','tool_requested','gate','tool_result','model_turn','answer','run_closed'])
    expect(denied.events.find(e=>e.kind==='gate')).toMatchObject({ decision: 'deny', stage: 'budget', code: 'READ_BUDGET_EXHAUSTED' })
    expect(withoutTime(allowed,'tool_requested')).toEqual(withoutTime(denied,'tool_requested'))
  })
})

describe('analytics baselines on the full dataset', () => {
  it('hourly: working days peak at 17:00, nonworking days at 13:00', () => {
    const hourly = analyze(data, 'hourly', 'both')
    const working = peak(hourly, 'Working days')
    const nonworking = peak(hourly, 'Nonworking days')
    expect([working.hour, working.mean.toFixed(1), working.n]).toEqual([17, '525.3', 499])
    expect([nonworking.hour, nonworking.mean.toFixed(1), nonworking.n]).toEqual([13, '372.7', 231])
  })
  it('weather: observed hours per category are 11413, 4544, 1419 and 3', () => {
    expect(analyze(data, 'weather', 'both').points.map(p => [p.group, p.n])).toEqual([
      ['Clear / few clouds', 11413], ['Mist / cloudy', 4544], ['Light rain or snow', 1419], ['Heavy rain or snow', 3],
    ])
  })
  it('week: one cell for every weekday and hour', () => {
    expect(analyze(data, 'week', 'both').points).toHaveLength(168)
  })
})

describe('the analytics gate', () => {
  const request = { scenario: 'week' as const, tool: 'getWeekdayHourMatrix', input: { period: 'both' }, readsRemaining: 1 }
  it('runs allowlist, then schema, then budget, and the first failure decides', () => {
    expect(gateRead({ ...request, tool: 'summarizeWeatherConditions', input: { period: 'nope' }, readsRemaining: 0 })).toMatchObject({ stage: 'allowlist', code: 'TOOL_NOT_IN_LESSON' })
    expect(gateRead({ ...request, input: { period: 'nope' }, readsRemaining: 0 })).toMatchObject({ stage: 'schema', code: 'SCHEMA_INVALID' })
    expect(gateRead({ ...request, input: { period: 'both', caller: 'admin' } })).toMatchObject({ stage: 'schema', code: 'SCHEMA_INVALID' })
    expect(gateRead({ ...request, readsRemaining: 0 })).toMatchObject({ stage: 'budget', code: 'READ_BUDGET_EXHAUSTED' })
    expect(gateRead(request)).toEqual({ decision: 'allow', period: 'both' })
  })
  it('gives the model only the fixed sentence for each refusal', () => {
    expect(gateRead({ ...request, readsRemaining: 0 })).toMatchObject({ modelText: modelText.READ_BUDGET_EXHAUSTED })
  })
  it('an available read still requires the scenario’s tool, but any valid period is allowed', async () => {
    const mismatch = await record('week',1,new ScriptedModel('weather'))
    const otherYear = await record('week',1,new ScriptedModel('week','2011'))
    expect(mismatch.outcome).toEqual({ status: 'denied', code: 'TOOL_NOT_IN_LESSON' })
    expect(mismatch.ledger).toEqual([])
    expect(otherYear.outcome).toEqual({ status: 'ok' })
    expect(otherYear.ledger).toEqual([{ tool: 'getWeekdayHourMatrix', classifications: ['public'], resourceIds: ['hour.csv'] }])
    expect(resultSchema.parse(otherYear.result)).toMatchObject({ period: '2011', n: 8645 })
  })
})

describe('recorded fixtures', () => {
  const fixtures = z.array(runSchema).parse(JSON.parse(readFileSync(new URL('fixtures/executions.json', root), 'utf8')))
  it('every fixture parses as lab-run/v1 and is labelled a replay', () => {
    expect(fixtures).toHaveLength(6)
    for (const run of fixtures) {
      expect(run.lesson, run.runId).toBe('analytics')
      expect(run.tier, run.runId).toBe('replay')
      expect(run.provider.kind, run.runId).toBe('scripted')
      expect(run.usage, run.runId).toBeNull()
    }
  })
  it('a blocked fixture has an empty ledger and a null result', () => {
    const blocked = fixtures.filter(r => r.outcome.status === 'denied')
    expect(blocked).toHaveLength(3)
    for (const run of blocked) {
      expect(run.ledger, run.runId).toEqual([])
      expect(run.result, run.runId).toBeNull()
      expect(run.events.some(e => e.kind === 'tool_executed'), run.runId).toBe(false)
    }
  })
  it('an allowed fixture records exactly one public read of hour.csv and a valid result', () => {
    for (const run of fixtures.filter(r => r.outcome.status === 'ok')) {
      expect(run.ledger, run.runId).toEqual([{ tool: run.events.find(e => e.kind === 'tool_executed')?.tool, classifications: ['public'], resourceIds: ['hour.csv'] }])
      expect(resultSchema.safeParse(run.result).success, run.runId).toBe(true)
    }
  })
})

describe('browser code stays free of Node modules', () => {
  const files = (dir: URL): URL[] => readdirSync(dir).flatMap(name => {
    const url = new URL(name, dir)
    return statSync(url).isDirectory() ? files(new URL(name + '/', dir)) : [url]
  })
  it('no file under src/, and none of the browser-safe analytics modules, imports node:', () => {
    const browser = [...files(new URL('src/', root)), ...['compute.ts', 'contracts.ts', 'gate.ts'].map(f => new URL('analytics/' + f, root))]
    for (const file of browser) expect(readFileSync(file, 'utf8'), file.pathname.split('/').slice(-2).join('/')).not.toMatch(/from ['"](node:|[^'"]*load\.node)/)
  })
})
