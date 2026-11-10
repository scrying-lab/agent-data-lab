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

## [1.1.1] - 2026-11-09

### Changed

- The icon library is updated to lucide-react 1.70. Two icons draw their tick slightly
  differently (the check in a circle and in a square); nothing else on the page changes
  (`package.json`, `NOTICE`).
- Dependabot no longer proposes major updates of Node's type definitions, which follow the
  Node version the lab runs on (`.github/dependabot.yml`).

## [1.1.0] - 2026-11-09

A design pass for readability in light and dark. The lesson text, what each label means, the
gate's checks and the agent code are unchanged.

### Changed

- **A clearer, calmer page in light and dark.** Headings, labels and body text now look different from
  each other. Space Grotesk, a modern sans serif, is used only for labels, buttons and numbers; the
  serif headings and the body text are unchanged. The yellow accent is softer, with blue and magenta
  tints added to group related parts of the page. Dark mode has its own colours rather than inverted
  light ones. Every colour pair is contrast-tested in both themes (`src/tokens.css`,
  `tests/tokens.test.ts`).
- **Result labels are real labels.** "Recorded replay", "Simulated in your browser" and "Recorded live
  run" each have their own colour and icon, and an outcome badge (Allowed, Refused, Failed, Cancelled)
  sits beside them (`src/shell/primitives/`).
- **Buttons show what matters most.** Run is the one yellow button in its row; Cancel has a soft red
  tint; Reset and the editor toggle step back (`src/components/ui/button.tsx`).
- The dark browser toolbar colour matches the dark page (`index.html`).
- **A page you can scan.** A row of numbered links under the introduction jumps to each section, and
  every section opens with its number, a short label and one line on why it matters. The lessons'
  introductions are split into short fact tiles, and the "predict" question stands out as a callout
  (`src/shell/`, `content/lessons.ts`).
- **Two clear places in the governance lesson.** "Try it yourself" (pink tint) holds the editable
  blocks; "Watch saved runs" (blue tint) holds the recorded examples, the result and its trace. Each
  result shows its label once (`src/shell/GovernanceLesson.tsx`).
- **Playground controls.** A clear yellow Run, a soft red Cancel and a quieter Reset. The plain-text
  editor switch sits above the blocks. The presets table shows an outcome badge for each preset, and
  the editor colours keys, text and comments in both themes (`src/playground/`).
- **The trace starts with the Guide.** The plain-language Guide comes first. The step list with
  timings and the graph are under "Every step with timings (for developers)", closed on phones. Each
  lesson's trace has its own title (`src/trace/`).
- **Charts.** Each chart shows its label and its two peak numbers above the plot (`src/charts/`).
- **Python → TypeScript.** Cards list every pair. One pair opens at a time, and phones switch between
  Python and TypeScript with tabs. "Elsewhere" shows concept cards, with other platforms and sources
  behind "show more". "Run it for real" ends with a "Why it matters" note (`src/lessons/`).

### Fixed

- "Show the numbers" under a chart now really hides the table when closed (`src/charts/`).
- The site now serves the full licence of the bundled Space Grotesk font next to `NOTICE.txt`
  (`public/licenses/`, `NOTICE`).
- In dark mode, the quietest hours of the weekly heatmap no longer disappear into the background
  (`src/charts/WeekHeatmap.tsx`).

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
