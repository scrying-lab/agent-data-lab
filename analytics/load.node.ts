// Node-only: reads data/hour.csv from disk and checks it is the expected file before any analysis.
// Browser code must never import this module.
import { fromCSV, type ColumnTable } from 'arquero'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** SHA-256 of the UCI Bike Sharing hourly file (CC BY 4.0) this lab was built against. */
export const sourceHash = 'e03de4ee4ef4dc376ac6e04bf829673c6269e8eba5c60fa121640fa2f829504f'

export function loadBikes(): ColumnTable {
  const bytes = readFileSync(new URL('../data/hour.csv', import.meta.url))
  if (createHash('sha256').update(bytes).digest('hex') !== sourceHash) throw Error('Unexpected hour.csv checksum')
  return fromCSV(bytes.toString())
}
