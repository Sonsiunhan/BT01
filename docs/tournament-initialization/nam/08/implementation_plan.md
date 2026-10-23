# N08 — Implementation plan — Runtime proof và P16 Bot readiness

## Goal

Deliver P16 as a real server-authoritative readiness surface for `BOT_VS_BOT` tournaments and prove the same N06 ABI/receipt through Offline Người–Python Bot and Bot–Bot consumers. `HUMAN_ONLINE` remains `NOT_REQUIRED`. Source, memory, private logs and raw provider diagnostics never cross the readiness boundary.

## Current source and gap baseline

- `BotLibraryService.testRevision` already validates source and invokes an isolated harness, but uses the legacy initial profile and owner-only flow; it cannot bind a tournament target or record a trusted readiness result.
- `TournamentEnrollmentSchema` currently has only `NOT_REQUIRED | READY | INVALID | MISSING`, and `CoreDraftService.enrollParticipant` incorrectly defaults Bot–Bot enrollment to `READY`.
- Lifecycle/readiness already reads `botReadinessStatus`; N08 will make that projection fail closed and add a canonical target/job/receipt reference without changing match rules.
- Wasmtime/CPython-WASI adapter already fails closed on missing artifacts, hash mismatch, provider busy/crash and hard compute/output limits. Runtime proof must use the real pinned artifacts under the disposable runtime worktree; no player Python runs in the app process.

## Ownership and files

N08 owns:

- `packages/contracts/src/bot-readiness.ts` and its export (additive contract only; inspect consumers before edit)
- `apps/server/src/modules/tournament-bot-readiness/**`
- `apps/web/src/features/admin/bot-readiness/**`
- route registration in `apps/server/src/app.ts` and `apps/web/src/app/routes.tsx` only where required
- `tests/contract/n08-bot-readiness.contract.test.ts`, `tests/unit/n08-bot-readiness.unit.test.ts`, focused server tests, and browser evidence
- this plan, requirements review/result report

Do not change game-rules, match settlement, existing N06 receipt semantics, or unrelated shared styles. If a shared contract conflict appears, stop and record the requested additive change before overwriting another owner’s work.

## Canonical contract

Add one zod contract containing:

- public item states `NOT_SUBMITTED | PENDING | CHECKING | READY | INCOMPATIBLE | BLOCKED_INFRA | STALE`
- safe reason codes and retry metadata
- target context summary (opaque ref plus version/digest metadata that is safe to expose)
- selection/recheck commands with `expectedEnrollmentRevision` and idempotency key
- enqueue/job view with `QUEUED | CHECKING | SUCCEEDED | BOT_REJECTED | BLOCKED_INFRA | STALE | CANCELLED`
- terminal receipt projection (`receiptId`, outcome, safe code, timing), never source/log/diagnostic
- bounded list filter, stable order, cursor/page limits and empty response

Normalize legacy storage `MISSING → NOT_SUBMITTED` and `INVALID → INCOMPATIBLE`; contract tests reject legacy values in serialized responses.

## Harness before implementation

1. Add a failing unit/contract regression for Bot–Bot enrollment not becoming `READY` before selection.
2. Add failing service tests for selection ownership/CAS, idempotency and stale target result.
3. Add failure fixtures for bot policy rejection versus provider unavailable; assert sanitized receipt projection.
4. Add an integration harness with a deterministic `IsolatedRuntimeAdapter` for contract behavior only, then a separate real Wasmtime/CPython-WASI probe using pinned artifacts. The deterministic adapter is not runtime proof.

## Development slices

1. Contract and normalization: update enrollment projection at the canonical server boundary; preserve old match pins and `HUMAN_ONLINE` semantics.
2. Readiness service: build server target context, principal/grant checks, selection command, recheck enqueue, idempotency/CAS and in-process recovery to `BLOCKED_INFRA` after restart. Commit pinned revision/status/receipt reference atomically under the tournament store lock; never write READY on partial failure.
3. Runtime bridge: call the existing isolated harness with target ABI, persist only trusted receipt/result reference, classify Bot policy failures as `INCOMPATIBLE` and provider failures as `BLOCKED_INFRA`.
4. Routes: add list/detail, selection, recheck enqueue and job polling with safe envelopes, pagination bounds and ACL. Route errors must distinguish forbidden, conflict/stale, retryable infrastructure and validation.
5. P16 UI: add the admin route/page with metadata-only table, status filter, target versions, safe reason, retry action and job progress. Implement loading/empty/forbidden/error/blocked/stale/success, keyboard semantics, focus targets and 24×24 CSS-pixel controls; clear cached rows on principal/tournament scope change.
6. Offline proofs: run real Human–Python Bot and Bot–Bot accepted turns through N06 state/receipt ABI. Record environment, artifact hashes, measured compute and any unavailable gate.

## Verification gates

- Focused contract/unit/server tests: all N08 ACs, including race/idempotency, legacy mapping, privacy leak assertions and no-fake-READY.
- `pnpm test:unit`, contract tests, typecheck, lint, build.
- Real runtime probe: pinned Wasmtime/CPython-WASI artifacts, hard compute/output/memory fault fixtures, no mutation of shared/production DB.
- Browser QA: P16 route at desktop/mobile, authenticated role scope, loading/error/blocked/retry, keyboard/focus and axe checks. No screenshot-only PASS.
- Review: permissions, stale target races, retry/recovery, source privacy, lifecycle integration, theme/viewport and failure paths.

## DONE / BLOCKED rules

N08 is DONE only when implementation, tests, runtime proof, browser evidence and review pass all mandatory ACs. If runtime artifacts, hard-cap measurement or browser environment is unavailable, record the exact evidence as BLOCKED and do not claim DONE; code may still be committed as candidate with the gate status explicit.
