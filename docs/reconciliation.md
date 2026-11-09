# Reconciliation · November 9, 2026

Compares the project requirements with what the code actually does. "Evidence" lists only checks run on November 9 unless marked otherwise. This is a proposal: nothing below supersedes an earlier decision without review.

## Proposed structure

Two lessons, one agent pattern, separate allowlists.

- **Analytics lesson (keep as is).** Three UCI read tools (`compareHourlyPatterns`, `summarizeWeatherConditions`, `getWeekdayHourMatrix`) with a one-read budget. Historical measurements.
- **Governance lesson (new).** Exactly two synthetic-domain read tools: `searchSyntheticDocs(query, scope)` and `getSyntheticMetric(metricId, period, scope)`. A fictional operator, Northgate Cycle Co-op, with three fictional roles.

The two required governance tools are not folded into the analytics agent. A five-tool agent would blur two different lessons: "a tool computes a trustworthy number" and "a gate decides who may read what".

## Requirement table

| Requirement | Observed implementation | Evidence | Next change |
|---|---|---|---|
| TypeScript Strands invocation | `agent/run.ts` runs `Agent.invoke` with SDK 1.24.0 and a scripted provider | `npm test`: 5 original tests pass | Reuse the same pattern for the governance runner |
| Two typed read-only tools | Not present before today. Contracts now in `governance/contracts.ts` | Zod schemas for input and sanitized output | Wire them into a Strands runner (`agent/governed-run.ts`) |
| Boundary order: schema → caller → arguments → execution → sanitization | Analytics lesson: one hook checks tool name, period and budget. Governance: `gate()` in `governance/policy.ts` implements allowlist → schema → caller → arguments → budget | Gate hardened: unknown and prototype roles refused, period oracle closed, approvals bound to the exact request (tests/governance-gate.test.ts) | Wire `gate()` into the governed runner |
| Caller identity from trusted state | Analytics lesson has no caller concept. Governance `Caller` is a parameter, never parsed from tool input | Test: a `role` field in tool arguments is rejected at the schema stage | Runner takes the caller from application state and freezes it |
| Proof of denial by reads, not prose | Analytics: asserts `result === null` and event labels. Governance: store keeps a read ledger | Test: a public search touches no internal record | Every denial case asserts an empty ledger |
| Response sanitization | Analytics returns the answer string. Governance maps raw records through output schemas | Tests: sensitive fields stripped; corrupted value rejected; empty period kept as `null`, not `0` | Replace raw SDK error text with fixed codes (see SDK findings) |
| 20-case evaluation suite (8/4/4/4) | 5 analytics tests. No case file | — | Write `evaluation/cases.ts` with stable IDs and a stored results file |
| Versioned run contract | `Run` type in `analytics/contracts.ts`, unversioned | — | Done: `lab-run/v1` in `agent/run-contract.ts`, used by the analytics lesson and its fixtures |
| Replay without credentials | `dist/lab.html` replays six scripted SDK runs | `npm run build` passes | Add governance fixtures once the runner exists |
| Three charts | Hourly line, weather bars, weekday × hour heatmap in `src/Chart.tsx` | Rendered at the November 4 pause (not rechecked today) | Missing: total vs mean toggle, weather sample-count beside value, missing-vs-zero cells, fixed comparison domain, calculation check |
| Persistent question surface, tool/log/eval views | Select boxes and two tabs (Visualization, Output) | — | Increment 2 |
| Stale-run guard, retry and cancellation in UI | Not present. Replay is synchronous | — | Increment 2: a run sequence token so old results cannot overwrite a new run |
| Live Bedrock tool call and denial | Transport in `agent/bedrock.ts`. Never succeeded | No valid AWS session at the time of writing | Increment 3. Needs a fresh sign-in |
| WSO2 allow/deny | Pinned v1.2.0 setup in `infra/wso2/`. Provider registration disconnected | Not rechecked today | Increment 4. Diagnose the disconnect first |
| License, notices, publication checklist | Dataset attribution and shadcn notice present. No project license | — | Owner decision |

## SDK behaviour checked today (Strands TypeScript 1.24.0)

A throwaway script drove a scripted provider through edge cases. These results shape the gate design.

| Situation | What the SDK did | Consequence for the lab |
|---|---|---|
| Tool input fails the Zod schema | `BeforeToolCallEvent` fires first. The tool result then carries the raw Zod error text | The gate validates in the hook and cancels with a fixed code, so raw validation text never reaches the model |
| Unknown tool name | Hook fires with `event.tool === undefined`. Result says "not found in registry" | The gate denies at the `allowlist` stage |
| Tool callback throws | Raw error message ("secret /etc/path") goes back into the conversation | Catch in the callback and rethrow a fixed failure code |
| Provider stream throws | `invoke()` rejects with `ModelError` | Runner records `failure: { stage: 'model' }` |
| Provider emits invalid tool-input JSON | `invoke()` rejects with `ModelError`. No hook fires | Recorded as a malformed-model-output failure |
| `cancelSignal` fires during a tool | `stopReason: 'cancelled'`; tool sees its `cancelSignal` | Tools must honour `ctx.cancelSignal`; runner closes its event log so late results cannot be appended |
| Empty final text | `stopReason: 'endTurn'` with no content | Runner treats it as a failure, not an answer |

## Not yet verified

Live Bedrock, the WSO2 route and policy, token usage from a real provider, deployment, and costs. Nothing in this document claims they work.
