// Every number or capability the public page or README states must be backed by evidence.
// Each lane adds its own file under content/claims/; this module gathers them.
// tests/claims.test.ts fails on duplicate ids, missing evidence, or a "live" claim without a recording.
import { z } from 'zod'

export const claimSchema = z.strictObject({
  id: z.string().regex(/^C-[A-Z0-9]+(-[A-Z0-9]+)*$/),
  text: z.string().min(1),
  /** live: from a real model recording; simulated: from the browser or scripted runs; data: from the UCI dataset. */
  basis: z.enum(['data', 'simulated', 'live']),
  evidence: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('test'), file: z.string(), name: z.string() }),
    z.strictObject({ kind: z.literal('fixture'), file: z.string() }),
  ]),
})
export type Claim = z.infer<typeof claimSchema>

const modules = import.meta.glob<{ claims: Claim[] }>('./claims/*.ts', { eager: true })
export const claims: Claim[] = Object.values(modules).flatMap(m => m.claims)
