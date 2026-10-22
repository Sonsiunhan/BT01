# N06 — SDK/runtime adapter và receipts tương thích

**Status:** Approved requirements gate; implementation in progress
**Owner:** Nguyễn Tiến Nam
**Requirements:** [N06-REQUIREMENTS-2026-10-22.md](./N06-REQUIREMENTS-2026-10-22.md)
**Independent review:** 14/14 covered, 100%, no P0/P1 gaps.

## Goal

Đưa một ABI Bot state tối thiểu nhưng động (dimensions, goals, rules, legalMoves), receipt do host tạo và parity Python cho cả Online wrapper và Offline sandbox, giữ fail-closed.

## Ownership and dependency order

1. **Contract first** — `packages/contracts/src/bot-abi.ts`, `packages/contracts/src/index.ts`.
   Define one canonical schema for dynamic coordinates/state and immutable execution receipts.
2. **SDK adapter** — `packages/bot-sdk/src/types.ts`, `state.ts`, `runtime.ts`, `receipt.ts`, `index.ts`.
   Build state from the active `RuleProfile`, normalize trusted receipts, and reject stale/mismatched versions.
3. **Consumers** — `apps/server/src/modules/bot-online/bot-online.service.ts`, `python.runner.ts`, `apps/web/src/services/bot-offline/offlineCompartment.worker.js`, `botOfflineRunner.ts`.
   Pass the same state shape, aliases, tuple/dict results, and receipt context; do not execute Python in the app process.
4. **Harness/evidence** — `tests/unit/r3-bot-sdk.unit.test.ts`, new N06 contract/compatibility tests, focused Offline runner tests, and `docs/tournament-initialization/nam/06/N06-TDD-EVIDENCE.md`.

No shared schema, database, tournament lifecycle, or UI route changes are in scope. Existing user changes outside these files remain untouched.

## Acceptance mapping

| Criterion | Implementation | Evidence |
|---|---|---|
| AC-001–005 | Contract + `createBotTurnState` dynamic profile projection | Contract/state tests with 9×9 and non-9×9 profiles |
| AC-006–008 | Host receipt schema/helper and version/mismatch checks | Receipt success/rejection/tamper matrix |
| AC-009–010 | Python aliases and tuple/dict normalization | Worker/runner compatibility fixtures |
| AC-011–012 | Existing fail-closed harness retained and exercised | Runtime security regression tests |
| AC-013–014 | Offline consumer path and evidence report | Human→Python harness fixture, focused tests, typechecks |

## TDD sequence

1. Add contract/state/receipt/parity tests and run the targeted test files to capture a genuine RED result.
2. Implement the smallest contract and SDK changes, then rerun the same targets for GREEN.
3. Integrate server and Offline consumers; rerun focused consumer tests.
4. Run package typechecks, relevant server/web tests, `git diff --check`, and record skipped/unavailable real-runtime gates explicitly.

## Security and compatibility invariants

- Receipt identity/version/compute fields come only from trusted host context; Bot output cannot overwrite them.
- Coordinate validation accepts the bounded extended board range; legacy 9×9 remains a profile fallback, never the ABI iteration source.
- Python source runs only through the existing Wasmtime/Pyodide isolation boundaries; no native Python or heuristic fallback.
- Offline runtime remains `NOT_PROVEN/BLOCKED` when kit/attestation is unavailable.
- Public snapshots never include source, memory, private logs, or internal receipt metadata.