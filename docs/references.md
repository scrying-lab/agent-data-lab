# Sources and design choices

Where the ideas, data and components in this lab come from, and why some were chosen over others.
Licences for everything that ships are listed in [NOTICE](../NOTICE).

## Strands Agents workshop (AWS Houston User Group)

The Houston AWS User Group event page lists Fabricio Flores as the presenter and links the workshop,
the slide deck, the SDK repository and post-event instructions.

What this lab takes from it:

- **Typed tools** as the starting point for an agent.
- **The agent loop versus the production services around it**: the loop decides which tool to call;
  identity, gateways, evaluation and hosting sit outside it.
- **The return path** for tools, hooks and evaluation, as shown in the public Python workshop.

Links: [event resources](https://main.d2vu7hxgv1aq23.amplifyapp.com/) ·
[AWS sample notebooks (MIT-0)](https://github.com/aws-samples/sample-strands-agents-hands-on-workshop) ·
[Strands TypeScript quickstart](https://strandsagents.com/docs/user-guide/sdk/quickstart/typescript/)

## AI gateway session (AWS and WSO2)

The session separates four concerns: a model proxy, an MCP proxy, local versus AWS-hosted proxies,
and identity and lifecycle management.

How the lab uses that map:

- The first infrastructure experiment routes model access through a local gateway to AWS
  (`infra/wso2/`). It has not been verified end to end.
- The analytical tools currently run inside Strands, not behind a gateway.
- An MCP proxy, token exchange, OpenChoreo deployment and Agent Manager evaluation are later experiments.

Links: [WSO2 AI gateway release v1.2.0](https://github.com/wso2/api-platform/releases/tag/ai-gateway%2Fv1.2.0) ·
[WSO2 guide to the Amazon Bedrock provider](https://wso2.com/api-platform/docs/ai-gateway/next/gateway-artifacts/llm-provider/supported-providers/aws-bedrock/)

## Dataset

Hadi Fanaee-T, *Bike Sharing* (2013), UCI Machine Learning Repository: hourly Capital Bikeshare
observations from 2011 and 2012. The included `data/hour.csv` is unmodified. The lab's own tables
group its rows and report mean rentals and the number of observed hours behind each mean.
The original research is Fanaee-T and João Gama, *Event labeling combining ensemble detectors and
background knowledge*.

Links: [dataset and research (DOI)](https://doi.org/10.24432/C5W894) ·
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Interface components

- **Tabs.** The lab uses the official shadcn Tabs component, built on Radix, for its keyboard behaviour.
  The source is vendored with its utility import adapted for this repository.
- **Layout reference.** The official shadcn dashboard block is a useful reference for placing charts
  near tables. The lab needs only one result panel, so it is not used directly.
- **Considered, not used.** The Animated Tabs component on 21st.dev (MIT) offers a sliding highlight
  and resizing panels. It stays a design reference: stable labels make the two views easier to find.

Links: [shadcn Tabs source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tabs.tsx) ·
[shadcn MIT notice](shadcn-LICENSE.txt) ·
[shadcn blocks](https://ui.shadcn.com/blocks) ·
[21st.dev Animated Tabs](https://21st.dev/@kuratlielia/components/tabs)
