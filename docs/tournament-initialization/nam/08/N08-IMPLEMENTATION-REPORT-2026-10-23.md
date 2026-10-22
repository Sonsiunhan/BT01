# N08 implementation report

## Delivered

- Added canonical public readiness contract in `packages/contracts/src/bot-readiness.ts` and exported it from the package.
- Added server owned `BotReadinessService` with owner authorization, enrollment CAS, idempotency payload binding, stale/withdrawn/expired guards, safe receipts, bounded list filtering/cursors, job lookup and Offline proof execution.
- Added endpoints for selection, recheck jobs, readiness list and Offline Human–Python / Bot–Bot proofs.
- Removed the fake `READY` default for `BOT_VS_BOT`; a new enrollment starts as legacy `MISSING`, which maps to public `NOT_SUBMITTED`.
- Added the P16 admin status page with semantic filtering, focus/live-region feedback, empty/error states and a link from tournament detail.

## Evidence

- Requirements review: 18/18 acceptance items, 100% coverage, 0 P0/P1 gaps. Hash is recorded in `N08-INDEPENDENT-REQUIREMENTS-REVIEW-2026-10-22.md`.
- Harness and focused implementation tests: 7 tests passed in `n08-bot-readiness.contract.test.ts` and `n08-bot-readiness.unit.test.ts`.
- Existing lifecycle/admission/concurrency regression: 17 tests passed in L05, L06 and L09 suites.
- Real Wasmtime + CPython-WASI probe passed on 2026-10-23 using the pinned artifacts in `D:\BT01\.worktrees\w1-runtime-artifacts`: move `a1 → a2`, compute `20.96ms`, isolation `WASMTIME_SUPERVISOR`, network/filesystem disabled. Artifact SHA-256 values were checked before execution.

## Gates still blocked

- Browser gate is NOT RUN: the clean worktree has no installed web dependencies and the local Vite start failed before serving the page (`@tailwindcss/vite` unavailable). No browser pass is claimed.
- Full server typecheck/build is NOT RUN in this worktree for the same dependency-resolution reason; contract typecheck passed, and focused Vitest suites passed using the repository's installed test runner.

N08 remains **IN PROGRESS / BLOCKED on browser and full dependency gates**, not DONE, until those environment gates are available.
