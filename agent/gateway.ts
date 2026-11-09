import { NodeHttpHandler } from '@smithy/node-http-handler'
import { BedrockModel } from '@strands-agents/sdk/models/bedrock'

// The Strands Bedrock adapter owns message conversion and event-stream decoding.
// Only the gateway receives the consumer key. WSO2 owns upstream AWS signing.
export function gatewayModel(region: string, modelId: string, key: string) {
  const endpoint = new URL('https://localhost:8443/bedrock/v1.0')
  class ConsumerTransport extends NodeHttpHandler {
    override handle(...[request, options]: Parameters<NodeHttpHandler['handle']>) {
      if (request.hostname !== endpoint.hostname || request.port !== Number(endpoint.port)
        || request.protocol !== 'https:' || request.method !== 'POST'
        || !request.path.startsWith(endpoint.pathname + '/model/') || !request.path.endsWith('/converse-stream')) {
        throw Error('Unexpected gateway destination or operation.')
      }
      for (const name of Object.keys(request.headers)) {
        if (name.toLowerCase() === 'authorization' || name.toLowerCase().startsWith('x-amz-')) delete request.headers[name]
      }
      request.headers['x-api-key'] = key
      return super.handle(request, options)
    }
  }
  return new BedrockModel({ modelId, region, maxTokens: 320, clientConfig: {
    endpoint: endpoint.href, maxAttempts: 1,
    // SDK signing placeholders are removed by ConsumerTransport before transmission.
    credentials: { accessKeyId: 'LOCAL_GATEWAY_ONLY', secretAccessKey: 'LOCAL_GATEWAY_ONLY' },
    requestHandler: new ConsumerTransport({ connectionTimeout: 5000, requestTimeout: 60000 }),
  } })
}
