// The single source of truth for every public link: README, docs, the site and announcements.
// tests/docs.test.ts fails if README.md or docs/references.md use a web address not listed here,
// and checks that each placeholder is replaced everywhere once its address is known.
// null means "not known yet". Never guess an address; fill it in when it exists.

export const links = {
  project: {
    /** Public source repository. null until the repository is published. */
    repository: 'https://github.com/scrying-lab/agent-data-lab' as string | null,
    /** Clone address used in the setup steps. */
    repositoryClone: 'https://github.com/scrying-lab/agent-data-lab.git' as string | null,
    /** Hosted lab. null until the site is deployed; README links to its "Try it" section meanwhile. */
    site: 'https://scrying-lab.github.io/agent-data-lab/' as string | null,
    /** The owner's article that introduces the project (the primary written resource). null until published. */
    article: 'https://ianmitch.dev/notes/the-human-part-is-the-hard-part' as string | null,
    /** The owner's personal website. null until the owner supplies it. */
    ownerWebsite: 'https://ianmitch.dev' as string | null,
  },
  data: {
    bikeSharingDoi: 'https://doi.org/10.24432/C5W894',
  },
  strands: {
    typescriptQuickstart: 'https://strandsagents.com/docs/user-guide/sdk/quickstart/typescript/',
  },
  inspiration: {
    houstonWorkshopResources: 'https://main.d2vu7hxgv1aq23.amplifyapp.com/',
    awsWorkshopRepository: 'https://github.com/aws-samples/sample-strands-agents-hands-on-workshop',
    wso2GatewayRelease: 'https://github.com/wso2/api-platform/releases/tag/ai-gateway%2Fv1.2.0',
    wso2BedrockProvider: 'https://wso2.com/api-platform/docs/ai-gateway/next/gateway-artifacts/llm-provider/supported-providers/aws-bedrock/',
  },
  components: {
    shadcnTabsSource: 'https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tabs.tsx',
    shadcnBlocks: 'https://ui.shadcn.com/blocks',
    animatedTabsReference: 'https://21st.dev/@kuratlielia/components/tabs',
  },
  licences: {
    ccBy4: 'https://creativecommons.org/licenses/by/4.0/',
    ccBy4LegalCode: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    mit: 'https://opensource.org/license/mit',
  },
  tools: {
    keepAChangelog: 'https://keepachangelog.com/en/1.1.0/',
    semanticVersioning: 'https://semver.org/spec/v2.0.0.html',
    nodeJs: 'https://nodejs.org/',
  },
} as const
