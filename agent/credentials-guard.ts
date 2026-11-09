// Live recording runs only with short-lived AWS credentials (an SSO profile or an assumed role).
// The AWS SDK would otherwise silently prefer a Bedrock bearer token, or a long-lived access key,
// if one happens to be present in the environment.
export function refuseLongLivedCredentials(env: Record<string, string | undefined> = process.env): void {
  if (env.AWS_BEARER_TOKEN_BEDROCK) {
    throw new Error('Refusing to run: AWS_BEARER_TOKEN_BEDROCK is set. Use `aws sso login` and AWS_PROFILE instead of Bedrock API keys.')
  }
  if (env.AWS_ACCESS_KEY_ID && !env.AWS_SESSION_TOKEN) {
    throw new Error('Refusing to run: a long-lived AWS access key is set. Use `aws sso login` and AWS_PROFILE, or temporary credentials with a session token.')
  }
}
