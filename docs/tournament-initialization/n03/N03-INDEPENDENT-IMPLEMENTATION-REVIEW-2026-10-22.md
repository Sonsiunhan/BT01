# N03 — Independent implementation review

**Reviewer:** dedicated Codex implementation-review agent (`/root/n02_requirements_review`)
**Owner:** Nguyễn Tiến Nam
**Date:** 22/10/2026
**Branch reviewed:** `nam-tournament`
**Scope:** N03 goal/progress/event-order implementation, additive preview contract/service, focused fixtures and regression evidence.
**Method:** ECC `intent-driven-development` and the repository Plan → Harness → Dev → Test → Review gate. No code, migration, or commit was changed by this review.

## Decision

**PASS — N03 implementation gate.** The three P1 findings from the previous review were remediated and independently rechecked:

- `fnv1a32()` now processes pinned UTF-8 bytes and candidate selection uses rejection sampling.
- CYCLE index 0 is rejected when it is initially occupied by that side's own piece and `GOAL_REACHED` is active.
- Q17 now starts with a valid index-0 goal, advances to an occupied current-board cell at round 1, asserts no auto-win/capture, and includes the explicit `CONTINUE` event-order result.
- UTF-8, RED-first, dynamic accepted/stale-goal, restart, wall-time/queue-time no-op, and committed mid-round replay evidence were added.

Raw implementation coverage is **18/18 atomic AC (100%)**, with **0 PARTIAL and 0 OPEN**. P0 findings: **0**. P1 findings: **0** in the N03 scope. N03 is complete in scope; this does not claim production match-lifecycle integration, runtime capacity, fairness, settlement, browser UI, or deployment.

## Evidence executed

Commands run after the remediation:

```text
node_modules/.bin/vitest.cmd run tests/unit/n03-q17-q18.unit.test.ts tests/unit/tournament-goals.unit.test.ts tests/unit/tournament-rules-preview.unit.test.ts tests/unit/tournament-rules-preview.service.unit.test.ts tests/contract/tournament-rules-preview.contract.test.ts
  5 files, 19 tests passed

node_modules/.bin/vitest.cmd run tests/contract/tournament-l01.contract.test.ts tests/unit/l01-harness.unit.test.ts tests/unit/game-rules.unit.test.ts tests/unit/l01-w3-entropy.unit.test.ts
  4 files, 58 tests passed

node_modules/.bin/tsc.cmd -p packages/game-rules/tsconfig.json --noEmit
  passed

node_modules/.bin/tsc.cmd -p packages/contracts/tsconfig.json --noEmit
  passed

node_modules/.bin/tsc.cmd -p apps/server/tsconfig.json --noEmit
  passed

node_modules/.bin/vitest.cmd run --config vitest.config.ts test/unit/rules-preview.route.unit.test.ts
  from apps/server: 1 file, 2 tests passed

git diff --check
  passed (only expected line-ending warnings)
```

The server package junction now targets `D:\BT01\packages\game-rules`, and the server typecheck succeeds against the rebuilt package declarations. The root game-rules junction still points to an external worktree, but the root Vitest configuration uses source aliases and all specified tests pass; no implementation failure was observed from that stale root link.

## AC-by-AC result

| AC | Result | Evidence |
|---|---|---|
| N03-AC01 | COVERED | `GoalProfile` union, bounded validator, dynamic contract parsing, and `GOAL_REACHED` gating. |
| N03-AC02 | COVERED | Static accepted-goal, no setup auto-win, and own-static-goal rejection tests remain green. |
| N03-AC03 | COVERED | CYCLE index 0, positive interval, wrap, and initial own-occupied index-0 rejection are implemented and covered by Q17/validator tests. |
| N03-AC04 | COVERED | SEEDED own-occupied filtering, empty filtered-set rejection, positive interval, and first sampling are covered. |
| N03-AC05 | COVERED | Repeated and one-cell SEEDED candidates are explicitly tested and remain valid. |
| N03-AC06 | COVERED | `goal-prng-v1` uses UTF-8 FNV-1a32, xorshift32, pinned policy, rejection sampling, and independent golden vectors. |
| N03-AC07 | COVERED | Same public seed context replays identically; side/purpose domains produce separate deterministic streams. |
| N03-AC08 | COVERED | Preview returns public seed/matchKey/policy metadata and tests assert no runtime-secret leakage. |
| N03-AC09 | COVERED | `RuleProgress` and nested active-goal/seed context are immutable; transitions return new values. |
| N03-AC10 | COVERED | `roundIndex = floor(acceptedPlies / 2)` is covered for BLUE-first and RED-first engine sequences. |
| N03-AC11 | COVERED | Rejected move, pause, resume, restart, wall time, and queue time leave progress unchanged; only accepted moves advance it. |
| N03-AC12 | COVERED | Corrected Q17 uses a valid cycle index 0 and verifies an occupied goal tick leaves the piece, board and match non-terminal. |
| N03-AC13 | COVERED | Dynamic accepted move wins on the current active goal; a previous goal does not win after the schedule advances. |
| N03-AC14 | COVERED | Deadline rejection, natural win, ply limit, goal tick and terminal-lock precedence are covered by direct event-order fixtures. |
| N03-AC15 | COVERED | `replayRuleProgressFromCommitted` preserves a one-ply committed snapshot when compute stops and advances only on a later accepted event. |
| N03-AC16 | COVERED | Replay ignores non-accepted events, keeps prior progress unchanged, and returns frozen progress values. |
| N03-AC17 | COVERED | Named Q17 covers valid CYCLE index 0, accepted-round advancement/wrap, occupied goal tick and `CONTINUE`. |
| N03-AC18 | COVERED | Named Q18 covers SEEDED filtering, deterministic restart/replay and pause/rejected/wall/queue no-op behavior. |

**Raw count:** 18 COVERED / 0 PARTIAL / 0 OPEN = **100% implementation coverage**.

## Scope and ownership review

The implementation matches the approved boundary:

- `packages/game-rules/src/goals.ts` owns goal candidate filtering, UTF-8 PRNG, immutable progress/replay, and pure event precedence.
- `packages/game-rules/src/types.ts`, `setup.ts`, `engine.ts`, and `index.ts` add dynamic goal/progress support while preserving legacy fields and behavior.
- `packages/contracts/src/tournament-rules-preview.ts` adds seed context, progress, reachability and dynamic-goal schemas without changing the L01 contract.
- `apps/server/src/modules/tournament-rules-preview/rules-preview.service.ts` previews CYCLE/SEEDED through the real engine seams and returns public metadata only.
- Tests cover Q17/Q18, PRNG, validation, current/stale goal behavior, replay, preview response, auth/revision/no-mutation behavior and legacy regressions.

No unauthorized match-manager, Prisma, runtime, publish, comparator, or UI changes were observed in the N03 scoped implementation. The working tree contains unrelated pre-existing changes and worktrees; they were excluded from this review.

## Boundaries retained

- L07/L08 still own production match-manager pause/clock persistence and server commit integration. N03 provides the pure progress and event-order seam and does not claim lifecycle integration.
- N04 owns comparator/version/publish; N06/N08 own runtime/SDK evidence. Capacity, fairness, settlement, browser UI and deployment remain out of scope.
- `runtimeStatus: NOT_CHECKED` remains honest in preview responses; deterministic fixtures do not claim production runtime proof.

## Final

**PASS — N03 implementation is DONE in scope.** Focused N03 evidence, N01/N02/L01 regressions, route tests, package/server typechecks and diff checks all pass. The task is ready for the parent handoff and the next dependent task.
