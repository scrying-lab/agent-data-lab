// Runs the evaluation suite and stores its results. No network, no AWS, no cost: every case uses
// the scripted model and the synthetic data. Usage: node --import tsx evaluation/run.ts
//
// Prints a table (ID | category | expected | observed | pass), writes evaluation/results.json in
// lab-eval/v1 (validated by evalResultsSchema), and exits non-zero if any case failed.
import { rename, writeFile } from 'node:fs/promises'
import { configureLogging } from '@strands-agents/sdk'
import { formatTable, runEvaluation } from './cases'

// The failure cases break things on purpose, and the SDK logs those errors with their stack traces.
// Keep only each log line's message so the console never shows raw error objects or local paths.
const message = (...args: unknown[]) => console.error('[sdk] ' + String(args[0]))
configureLogging({ debug: () => {}, info: () => {}, warn: message, error: message })

const results = await runEvaluation()
console.log(formatTable(results))
console.log(`\n${results.summary.passed}/${results.summary.total} cases passed (SDK ${results.sdkVersion}, inputs ${results.inputsHash.slice(0, 12)})`)

const file = new URL('./results.json', import.meta.url)
const temp = new URL('./results-' + process.pid + '.tmp', import.meta.url)
await writeFile(temp, JSON.stringify(results, null, 2) + '\n')
await rename(temp, file)
console.log('Results written to evaluation/results.json')

if (results.summary.passed !== results.summary.total) process.exitCode = 1
