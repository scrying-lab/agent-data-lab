import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { claims, claimSchema } from '../content/claims'
import { codes, denyCodes, modelText, operatorText, tierLabel } from '../agent/run-contract'
import { labConfig } from '../lab.config'

const root = new URL('..', import.meta.url).pathname

describe('lab-run/v1 contract', () => {
  it('gives every code fixed model text and a plain explanation', () => {
    for (const code of codes) {
      expect(modelText[code], code).toBeTruthy()
      expect(operatorText[code], code).toBeTruthy()
      expect(modelText[code], code).not.toMatch(/\/|Error:|ZodError/)
    }
  })
  it('tells the model the same thing for unknown and restricted metrics, so refusals cannot reveal what exists', () => {
    expect(modelText.UNKNOWN_METRIC).toBe(modelText.METRIC_ABOVE_SCOPE)
  })
  it('keeps refusals and failures in separate vocabularies', () => {
    expect(new Set(codes).size).toBe(codes.length)
    expect(denyCodes).not.toContain('TOOL_FAILED')
  })
  it('labels every result by how it was produced', () => {
    expect(tierLabel({ tier: 'replay', provider: { kind: 'scripted', modelId: 'scripted' }, recordedAt: null })).toBe('Recorded replay')
    expect(tierLabel({ tier: 'simulated', provider: { kind: 'scripted', modelId: 'scripted' }, recordedAt: null })).toBe('Simulated in your browser')
    expect(tierLabel({ tier: 'live', provider: { kind: 'bedrock', modelId: 'm', region: 'us-east-1' }, recordedAt: '2026-11-12T10:00:00Z' }))
      .toBe('Recorded live run · Amazon Bedrock · m · us-east-1 · 2026-11-12')
  })
  it('keeps live limits within the lab’s bounds', () => {
    expect(labConfig.limits).toEqual({ turns: 3, maxOutputTokensPerTurn: 320, reads: 1 })
  })
})

describe('claims registry', () => {
  it('has at least one claim and unique ids', () => {
    expect(claims.length).toBeGreaterThan(0)
    expect(new Set(claims.map(c => c.id)).size).toBe(claims.length)
  })
  it('backs every claim with evidence that exists', () => {
    for (const claim of claims) {
      claimSchema.parse(claim)
      const file = root + claim.evidence.file
      expect(existsSync(file), `${claim.id}: ${claim.evidence.file}`).toBe(true)
      if (claim.evidence.kind === 'test') expect(readFileSync(file, 'utf8'), `${claim.id}: test "${claim.evidence.name}"`).toContain(claim.evidence.name)
    }
  })
  it('never calls something live without a live recording', () => {
    for (const claim of claims.filter(c => c.basis === 'live')) {
      expect(claim.evidence.file, claim.id).toMatch(/^fixtures\/live\//)
    }
  })
})
