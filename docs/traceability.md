# Traceability

Maps each requirement to where it is built and what proves it. Status reflects the repository, not intentions.

| Requirement | Where | Evidence | Status |
|---|---|---|---|
| Real Strands TypeScript agent loop | `agent/run.ts`, `src/harness.ts` | `tests/lab.test.ts`; `tests/e2e/harness.spec.ts` (Chromium, mobile WebKit) | Done |
| Two read-only governance tools | `governance/contracts.ts` | `tests/governance-gate.test.ts` | Contracts done; runner in progress |
| Gate order: allowlist → schema → caller → arguments → budget | `governance/policy.ts` | `tests/governance-gate.test.ts` | Done |
| Caller identity from trusted state, never model arguments | `governance/policy.ts`, `agent/governed-run.ts` | schema-stage test for smuggled identity | Done in the gate; runner in progress |
| Denial proven by an empty read ledger, not by prose | `agent/run-contract.ts` (`ledger`) | evaluation cases | In progress |
| One versioned run contract for engine, fixtures, evaluation and views | `agent/run-contract.ts` (`lab-run/v1`) | `tests/contracts.test.ts` | Done |
| Fixed model-facing text; raw errors never reach the model | `agent/run-contract.ts` (`modelText`) | `tests/contracts.test.ts` | Done |
| Every result labelled replay, simulated or live | `tierLabel()` in `agent/run-contract.ts` | `tests/contracts.test.ts` | Done |
| 20 evaluation cases (8 legitimate, 4 out-of-scope, 4 malformed or injection, 4 failures), plus regressions | `evaluation/` | `npm run eval` | Planned |
| Three charts with tables, labels and honest sample sizes | `src/` | chart tests | Partly done |
| Two or three editable blocks, parsed as data, never executed | `src/playground/` | parity and keyboard tests | Planned |
| Python → TypeScript translation | `examples/` | `tests/translation.test.ts` | Done |
| Accessibility: keyboard, screen reader, reduced motion, 390 px | `src/` | axe and keyboard specs | Planned |
| No credentials in the repository or the built site | `.env.example`, `lab.config.ts`, `agent/credentials-guard.ts`, `scripts/bundle-check.mjs` | `tests/repo-hygiene.test.ts`; bundle check | Done |
| Strict Content-Security-Policy, no outside requests | `vite.config.ts` | `tests/e2e/harness.spec.ts` | Done |
| Live Bedrock runs (two models) | `agent/bedrock.ts` | recorded fixtures under `fixtures/live/` | Planned (needs AWS setup) |
| WSO2 gateway allow and deny | `infra/wso2/`, `agent/gateway.ts` | gateway logs and recorded 401/403 | Not verified |
| Attribution and licences | `NOTICE`, `LICENSE`, `docs/references.md` | review | Done |
