// Node-only. Uses node:crypto, so it must never be imported by browser code; policy.ts stays
// free of node: imports so the gate can run in the visitor's browser.
import { createHash } from 'node:crypto'
import { docs, metrics, roles } from './synthetic'

/** Fingerprint of all synthetic data, used to prove a run had no side effects. */
export function dataFingerprint(): string {
  return createHash('sha256').update(JSON.stringify({ docs, metrics, roles })).digest('hex')
}
