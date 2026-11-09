// Send the same route with a deliberately invalid consumer key before any paid rehearsal.
const model = process.env.BEDROCK_MODEL_ID
if (!model) throw Error('Set BEDROCK_MODEL_ID first.')
const response = await fetch('https://localhost:8443/bedrock/v1.0/model/' + encodeURIComponent(model) + '/converse-stream', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'deliberately-invalid' },
  body: JSON.stringify({ messages: [{role:'user',content:[{text:'Reply OK.'}]}], inferenceConfig:{maxTokens:4} }),
})
console.log('Gateway returned HTTP', response.status)
if (![401,403].includes(response.status)) throw Error('Expected a gateway authentication rejection. Check the controller and gateway logs before proceeding.')
