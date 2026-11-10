import { tierLabel, type LabRun, type Tier } from '../../agent/run-contract'

/** The words tierLabel() starts with for each tier, taken from the contract so they cannot drift. */
export function baseLabel(tier: Tier): string {
  const sample: Pick<LabRun, 'tier' | 'provider' | 'recordedAt'> = { tier, provider: { kind: 'bedrock', modelId: 'model' }, recordedAt: null }
  return tierLabel(sample).split(' · ')[0]
}
