# Agent handbook

Agent Data Lab is a public, forkable TypeScript lab about AWS Strands Agents. A small agent answers questions about the UCI bike-sharing data behind a gate that checks every tool call before any read. The main page plays recorded replays (scripted model); only `harness.html` runs the real Strands loop in the browser. Real Amazon Bedrock runs are recorded separately and labelled as recordings. The subject is agent infrastructure: governance, honest evidence, evaluation, safe hosting.

## Commands

- `npm ci` installs exact versions. Do not change dependencies without the owner's approval.
- `npm run check` is the gate: typecheck, lint, unit tests, build + bundle check, generic public-safety scan.
- `npm run e2e` runs Playwright against the built site (run `npm run build` first).
- `npm run record` regenerates scripted recordings. `npm run record:bedrock` is a live run: owner only, needs `aws sso login` plus AWS_PROFILE, AWS_REGION and BEDROCK_MODEL_ID, costs money.

## Where things live

| Path | Purpose |
|---|---|
| `agent/run-contract.ts` | `lab-run/v1` and `lab-eval/v1`: stages, codes, model text, labels. Frozen |
| `agent/` | Strands runner, scripted model, Bedrock recorder, credentials guard |
| `governance/` | Gate (`governance/policy.ts`), tool contracts, synthetic data |
| `analytics/` | UCI measurements (Arquero) |
| `src/` | React site; `src/announce.tsx` owns the one live region |
| `content/claims/` | Every public number with its evidence |
| `content/links.ts` | Every public link |
| `fixtures/` | Saved runs |
| `docs/` | Traceability, references, release pattern |
| `tests/` | Vitest; `tests/e2e/` is Playwright |
| `scripts/public-safety.mjs` | Public-safety scan |

## Non-negotiables

1. No secrets. Never read, create or print .env files, keys or tokens. Live runs use short-lived sign-in only.
2. The repo is public: no absolute local paths, machine names, personal emails or account IDs. Never mention private projects. Run `npm run scan:generic`; the owner runs the full scan before publishing.
3. `agent/run-contract.ts` is frozen. Import from it; propose changes as a new version.
4. Every public number or capability needs a claim in `content/claims/` with evidence (`tests/contracts.test.ts`).
5. Label honestly: Recorded replay, Simulated in your browser, Recorded live run (`tierLabel()`). Never call simulated or replayed work live.
6. One live region: use `announce()` from `src/announce.tsx`, never a new aria-live or role=status.
7. Never write first-person reflections for the owner. The README "Purpose" section is theirs.
8. Plain language for non-technical readers, precise detail for developers.

## Links (housekeeping)

`content/links.ts` is the single source of truth for public URLs: repository, hosted site, article, dataset, Strands docs, workshops. Unknown ones are null. `tests/docs.test.ts` fails if README.md or `docs/references.md` uses a URL not listed there, or if a placeholder survives after its URL is set. It runs inside `npm run check`; there is no CI yet, so run the gate yourself before reporting work. Visitors never need to know about it.

## Releases

Follow `docs/releasing.md` and add every user-visible change to `CHANGELOG.md` under [Unreleased].

## Reporting work

- Separate **observed** (you ran it and saw the result) from **inferred** (you expect it).
- List every command with its counts, e.g. "vitest: 42 passed, 0 failed".
- Say what you did not check and why.
- Give branch, commit SHA and files changed.
- Put changes needed outside your files in an open request, not an edit.
