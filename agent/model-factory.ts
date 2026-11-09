// The one place browser code gets a model from.
//
// Plain version: in the browser the model is always simulated. A script plays the model's part, so
// nothing is sent anywhere and nothing costs money. Real models (Amazon Bedrock) are created only by
// Node scripts the owner runs on their own machine (agent/bedrock.ts); they never ship to the page.
import { PlaygroundModel, type PlaygroundOptions, type PlaygroundRequest } from './playground-model'

/** Build the simulated model for a script of tool requests. Always a PlaygroundModel. */
export function createSimulatedModel(script: readonly PlaygroundRequest[], options: PlaygroundOptions = {}): PlaygroundModel {
  return new PlaygroundModel(script, options)
}
