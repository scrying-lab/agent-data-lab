// Non-secret settings for live recording. Credentials never live here or anywhere in the repo:
// sign in with `aws sso login --profile <name>` and run with AWS_PROFILE=<name>.
import { z } from 'zod'

const configSchema = z.strictObject({
  aws: z.strictObject({ region: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/) }),
  /** Bedrock model or inference-profile IDs. Confirmed on the first live call; see docs. */
  models: z.strictObject({
    novaMicro: z.string().min(1),
    claudeHaiku: z.string().min(1),
  }),
  /** Hard limits for every live run. */
  limits: z.strictObject({
    turns: z.number().int().positive().max(5),
    maxOutputTokensPerTurn: z.number().int().positive().max(1024),
    reads: z.number().int().positive().max(3),
  }),
})

export const labConfig = configSchema.parse({
  aws: { region: 'us-east-1' },
  models: {
    novaMicro: 'us.amazon.nova-micro-v1:0',
    claudeHaiku: 'us.anthropic.claude-haiku-5-5',
  },
  limits: { turns: 3, maxOutputTokensPerTurn: 320, reads: 1 },
})
export type LabConfig = typeof labConfig
