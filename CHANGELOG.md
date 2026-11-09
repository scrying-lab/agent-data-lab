# Changelog

All notable changes to Agent Data Lab are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). How a release is prepared and published:
[docs/releasing.md](docs/releasing.md).

Each entry says what changed in plain words first, then names the files for developers.
Results are described by how they were produced: recorded replay, simulated in your browser,
or recorded live run. Nothing is called live unless a real model produced it.

## [Unreleased]

Planned for later releases: live recordings on Amazon Bedrock with two models side by side, a third
editable block for the analytics lesson, and a verified WSO2 gateway experiment.

## [1.0.0] - 2026-11-09

The first public release: a small AI agent built with AWS Strands Agents (TypeScript), with a gate that
checks every tool call before any data is read, running in your browser.

### Added

- **Governance lesson: "Who gets to read what?"** A gate checks every tool call in a fixed order
  (allowlist, schema, caller, arguments, read budget) over invented data for a fictional bike-share
  operator. A read ledger proves that a refusal read nothing. Who is asking comes from the app, never
  from the model (`governance/`, `agent/governed-run.ts`).
- **The real agent loop in your browser.** The Strands agent loop and the gate run on the page with a
  simulated model playing the model's part. Nothing leaves the page and no keys exist
  (`agent/model-factory.ts`, `agent/playground-model.ts`).
- **A playground with two editable blocks.** Change who is asking, or what the simulated model asks
  for, often by one word, and run it again. Edits are read as data and checked, never run as code
  (`src/playground/`, `content/block-hints.ts`).
- **Ten recorded governance examples** covering every gate stage, including a forged scope and a
  retrieved document that tries to escalate (`fixtures/governance-replays.json`).
- **Analytics lesson: "What the bike data says."** Three questions about hourly Capital Bikeshare
  rentals (2011–2012, UCI dataset) answered by read-only tools, with six recorded replays
  (`analytics/`, `agent/run.ts`, `fixtures/executions.json`).
- **Three charts you can trust.** Hourly patterns, weather and a weekly heatmap, each with a table of
  the exact numbers, sample sizes in plain words, a warning for small samples, and a colour scale that
  stays fixed across periods (`src/charts/`).
- **A trace you can follow three ways.** A step list for keyboards and screen readers, a graph, and a
  guide that narrates the run in plain language and never claims a model chose something unless a real
  model ran (`src/trace/`, `content/narration.ts`).
- **Evaluation: 20 cases plus 3 regressions,** all passing, with stored results that fail the build if
  they go stale. Cases check gate decisions, reads and side effects, not just the wording
  (`evaluation/`, `npm run eval`).
- **From Python to TypeScript.** Four side-by-side pairs from the Strands workshop, each labelled by how
  it was checked, plus the things that trip up Python developers (`examples/`).
- **The same idea elsewhere.** Where the AWS pieces have equivalents on Google Cloud, Azure and open
  source, with sources (`content/hints.ts`).
- **Run it for real.** Clone the repository and run everything with no account; record a live run with
  your own AWS sign-in (`npm run record:bedrock`). A successful live recording has not been verified yet.
- **Safety for a public repository.** A strict Content-Security-Policy, browser stubs that keep AWS code
  off the page, a bundle check, a public-safety scan, CI that deploys only when every check passes, and
  a guard that refuses Bedrock API keys and long-lived AWS keys (`vite.config.ts`, `scripts/`,
  `.github/workflows/`, `agent/credentials-guard.ts`).
- **Accessible by default.** Keyboard operable, one announcer for screen readers, light and dark themes
  from one contrast-tested token file, checked with axe in real browsers (`src/tokens.css`).
- **Documentation.** A README for three kinds of reader, an agent handbook (`AGENTS.md`), licences (MIT
  for code, CC BY 4.0 for lessons and docs), third-party notices (`NOTICE`) and a release pattern
  (`docs/releasing.md`).

### Not verified in this release

- Live runs on Amazon Bedrock (the recorder exists; no successful run has been recorded yet).
- The WSO2 AI gateway experiment (`infra/wso2/`).
