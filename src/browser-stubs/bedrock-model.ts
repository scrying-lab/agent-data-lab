// Browser builds replace the SDK's Bedrock model with this stub. The public site never calls
// a model provider: every browser Agent gets the scripted model from the lab's model factory.
// If anything constructs a Bedrock model in the browser, it fails loudly instead of reaching AWS.
export class BedrockModel {
  constructor() {
    throw new Error('BedrockModel is not available in the browser build. Live model calls run only from a cloned repo with your own AWS setup.')
  }
}
