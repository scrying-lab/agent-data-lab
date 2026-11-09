// The only entry point that calls AWS. It records one live run with Amazon Bedrock and writes it to
// private-runs/ (git-ignored) for review before anything is published.
// Region, model IDs and limits come from lab.config.ts; credentials come only from your AWS profile.
// Usage: npm run record:bedrock -- [hourly|weather|week] [--model novaMicro|claudeHaiku] [--gateway]
import { BedrockModel } from '@strands-agents/sdk/models/bedrock'
import { mkdir, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { scenarioSchema } from '../analytics/contracts'
import { labConfig } from '../lab.config'
import { refuseLongLivedCredentials } from './credentials-guard'
import { gatewayModel } from './gateway'
import { recordRun } from './run'

refuseLongLivedCredentials()
const args = process.argv.slice(2)
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const scenario = scenarioSchema.parse(args.find(a => !a.startsWith('--') && a !== flag('--model')) ?? 'hourly')
const modelKey = z.enum(['novaMicro', 'claudeHaiku']).parse(flag('--model') ?? 'novaMicro')
const modelId = labConfig.models[modelKey]
const region = labConfig.aws.region
const maxTokens = labConfig.limits.maxOutputTokensPerTurn

const viaGateway = args.includes('--gateway')
const key = process.env.GATEWAY_API_KEY
if (viaGateway && (!key || region !== 'us-east-1')) throw Error('Set GATEWAY_API_KEY, and keep lab.config.ts on the gateway region us-east-1.')
const model = viaGateway && key
  ? gatewayModel(region, modelId, key)
  : new BedrockModel({ modelId, region, maxTokens, clientConfig: { maxAttempts: 1 } })

const route = viaGateway ? 'gateway' : 'direct'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const run = await recordRun(scenario, labConfig.limits.reads, model, 'both', {
  provider: { kind: 'bedrock', region },
  turns: labConfig.limits.turns,
  runId: [scenario, 'both', labConfig.limits.reads, modelKey, route, stamp].join('-'),
})
const dir = new URL('../private-runs/', import.meta.url)
await mkdir(dir, { recursive: true })
const file = new URL(run.runId + '.json', dir)
await writeFile(file, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' })
console.log(run.outcome.status, run.outcome.code ?? '', '· review the recording in private-runs/' + run.runId + '.json')
