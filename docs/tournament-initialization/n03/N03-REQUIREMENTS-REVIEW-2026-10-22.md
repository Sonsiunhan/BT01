# N03 — Independent requirements review

**Reviewer:** dedicated Codex requirements-review agent (`/root/n02_requirements_review`)
**Owner:** Nguyễn Tiến Nam
**Date:** 22/10/2026
**Scope:** N03 only — STATIC/CYCLE/SEEDED goal profiles, seed/round replay, Q17/Q18 fixtures, event ordering, occupied-goal semantics, and pause/rejection round invariants.
**Method:** ECC `intent-driven-development`; requirements-only review. No application code, migration, database, or commit was changed by this review.

## Gate result

**N03 requirements gate: PASS.** The four decisions supplied after the first review close the previously open product choices:

1. `goal-prng-v1`: FNV-1a32 domain separation followed by xorshift32; public `seed`, `matchKey`, `side`, and `purpose`; version pinned.
2. `RuleProgress`: pure and immutable.
3. Q17: CYCLE index-0/wrap and no auto-win when the goal ticks onto an occupied cell.
4. Q18: SEEDED deterministic replay, own-occupied candidate filtering, and pause/rejected move do not advance a round.
5. Preview is additive and returns schedule, active goal, round, seed metadata, and reachability.

Raw requirements coverage is **18/18 atomic AC (100%)**, with **0 partial and 0 open** product requirements. There are **0 P0 and 0 P1 product blockers** in the reviewed N03 scope. This is a requirements gate only; it is not implementation, runtime, browser, load, security, or database evidence. The current source still represents N02's pre-N03 implementation boundary, so the implementation gate remains **NOT RUN** until N03 is built and tested.

## Atomic acceptance checklist

| ID | Atomic acceptance criterion | Requirements result | Evidence required during N03 execution |
|---|---|---|---|
| N03-AC01 | `GOAL_REACHED` accepts a per-side `STATIC`, `CYCLE`, or `SEEDED` profile; when the win condition is absent, goal fields have no active effect. | COVERED | Profile validation and no-goal-condition fixture |
| N03-AC02 | STATIC starts at its configured cell; the initial own goal is invalid; an accepted move into the active goal is the only goal win trigger. | COVERED | Initial-goal, legal-move, and goal-win fixtures |
| N03-AC03 | CYCLE requires a finite non-empty ordered cell list and positive `roundInterval`; initial active cell is index 0 and advancement wraps. | COVERED | CYCLE schema, bounds, index-0, and wrap tests |
| N03-AC04 | SEEDED requires a finite non-empty candidate list and positive `roundInterval`; candidates occupied by the same side at initialization are filtered before first sampling. | COVERED | Candidate filtering and empty-filtered-set rejection tests |
| N03-AC05 | SEEDED allows repeated candidates and a one-cell candidate list when the resulting profile is valid; it does not silently invent a distinct-cell requirement. | COVERED | Repeated/one-cell fixtures |
| N03-AC06 | `goal-prng-v1` is pinned to FNV-1a32 domain separation plus xorshift32, with public `seed`, `matchKey`, `side`, and `purpose` inputs. | COVERED | Algorithm/vector corpus and version assertion |
| N03-AC07 | Match/side/purpose streams are independent and deterministic; same inputs replay the same goal sequence, while a changed domain input does not reuse the same stream. | COVERED | Cross-side/purpose and repeated-run vectors |
| N03-AC08 | Public schedule/seed metadata is replayable and safe to expose; any runtime-private seed remains separate and is not returned in public snapshots. | COVERED | DTO/privacy tests and metadata redaction check |
| N03-AC09 | `RuleProgress` is pure/immutable and carries the accepted-ply/round state and per-side active-goal schedule needed for replay. | COVERED | Freeze/no-mutation and value-transition tests |
| N03-AC10 | One round is exactly two accepted plies from the beginning of the match, independent of first side; each side's `roundInterval` is evaluated on that accepted-round boundary. | COVERED | BLUE-first and RED-first cadence fixtures |
| N03-AC11 | Rejected moves, pause, resume, restart/replay without accepted plies, queue/bootstrap, and human-think time do not advance round or goal schedule. | COVERED | Rejected/pause/restart/no-op transition tests |
| N03-AC12 | A goal tick onto an occupied or shared cell does not capture, delete, push, or auto-win; the goal remains a normal board cell. | COVERED | Occupied/shared-goal Q17 fixture |
| N03-AC13 | A subsequent accepted legal move into the currently active goal can produce `GOAL_REACHED`; a stale previous goal cannot. | COVERED | Active-goal transition and stale-goal tests |
| N03-AC14 | Event order is deterministic: deadline late-command rejection precedes commit; an on-time natural win precedes ply-limit, then goal tick; terminal state cannot be overwritten. | COVERED | Boundary race corpus and terminal idempotency tests |
| N03-AC15 | Goal schedule/replay uses committed progress before an invocation; hard compute may stop mid-round without fabricating a completed round. | COVERED | Mid-round committed-snapshot fixture |
| N03-AC16 | Progress transitions are idempotent and no-mutation: replaying the same accepted/rejected/pause event does not double-advance or mutate the prior state. | COVERED | Repeated transition and deep-freeze tests |
| N03-AC17 | Q17 fixture is explicit: CYCLE index 0 → accepted-round advancement → wrap, including an occupied tick with no auto-win/capture. | COVERED | Named Q17 golden fixture |
| N03-AC18 | Q18 fixture is explicit: SEEDED initial filtering → deterministic sequence replay → pause/rejected move with unchanged round, across restart. | COVERED | Named Q18 golden fixture |

**Raw count:** 18 COVERED / 0 PARTIAL / 0 OPEN = **100% requirements coverage**.

## Source facts versus review assumptions

### Discovered facts

- N02 intentionally parses CYCLE/SEEDED and returns typed `UNSUPPORTED_CAPABILITY`; this is the expected seam for N03 to replace, not a conflicting product decision.
- `packages/game-rules` currently has `GoalProfile = STATIC` only, `RuleState` has no accepted-ply/round/active-goal progress, and `engine.ts` resolves only `staticGoal()`.
- The N02 preview response currently has no active-goal schedule, round-progress, or N03 seed metadata; its `runtimeStatus` is `NOT_CHECKED`.
- The current match manager is shared lifecycle code with pause/clock behavior. N03 must expose a pure progress seam and coordinate integration with the lifecycle owner; it must not infer round advancement from UI ticks or wall time.
- `docs/tournament-initialization/OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md` F36–F42, §10.2, §15, T051–T054, and T057 contain the canonical semantics. The latest N00 review records G0 as requirements-only PASS.

### Explicit assumptions used for this gate

- The four decisions in the parent message are the latest product authority for N03 and supersede the first-review OPEN items.
- FNV-1a32 and xorshift32 are used with their standard unsigned 32-bit operations. The N03 implementation plan must record encoding/constants, zero-state handling, candidate ordering, and unbiased sampling so tests can be exact; these are technical implementation details, not new product questions.
- The existing string-coordinate transport in the additive N02 preview contract remains the compatibility format. N03 may extend it additively; it must not alter the legacy L01 contract or legacy match wire format.

## P0/P1 findings and dependencies

### P0

None in the reviewed requirements. No rule is contradictory or safety-blocking after the four decisions.

### P1 product blockers

None. Q17/Q18, PRNG policy, immutable progress, and additive preview output are now closed.

### P1 implementation risks to carry into the plan

These are execution obligations, not unresolved product choices:

1. Freeze the exact PRNG vectors: UTF-8/domain serialization, FNV offset/multiplier, xorshift shifts, zero-state normalization, deterministic candidate ordering, and rejection/modulo sampling. A named version without vectors is not replay evidence.
2. Keep `RuleProgress` separate from mutable match lifecycle state. Pause/resume/rejection must return the same value or an equivalent immutable value with no round increment.
3. Extend the preview contract additively so CYCLE/SEEDED no longer return N02's `UNSUPPORTED_CAPABILITY` when the profile is otherwise valid. Include schedule, active goal, round index, public seed metadata, and reachability status; keep runtime-private secrets out of the response.
4. Do not silently wire N03 into `apps/server/src/modules/match/match.manager.ts` without the lifecycle owner. The N03 pure seam and fixtures can land first; full server pause/deadline integration must preserve the canonical event order and is a dependent integration concern.
5. Preserve N02/N01 regressions, including both-side legal moves, rectangular boards, strict caps, static reachability, stale/no-mutation behavior, and old L01/legacy match consumers.

## Ownership and dependency boundary

| Area | N03 owns | Later/dependent owner |
|---|---|---|
| Canonical goal types and immutable progress | `packages/game-rules` goal/profile/progress types and pure transitions | Match lifecycle owner integrates accepted-event commits |
| Seed/replay | `goal-prng-v1` vectors, schedule/active-goal replay, Q17/Q18 fixtures | Runtime/SDK consumers reuse public metadata; no private seed leak |
| Preview | Additive typed schedule/round/seed/reachability fields and valid dynamic-goal preview | N04 version/publish and S07/N07 UI integration |
| Event order | Pure deterministic ordering fixtures and terminal no-overwrite checks | L07/L08 server clocks, pause/cancel, and adjudication transaction |
| Bot/runtime | No runtime proof or Python/WASM integration in N03 | N06/N08 |
| Comparator/publish | Not in N03 | N04 |

## Out of scope

- Tournament publish/approval, persistence/migration, quota/reservation, comparator/tie settlement, ratings, bot/WASM runtime receipts, capacity/load proof, browser UI, and production deployment.
- Changing the legacy `TournamentRuleProfileSchema` or legacy `packages/contracts/src/match.ts` coordinate format.
- Inventing new goal modes, event priorities, seed override controls, or a TA per-match seed override.
- Treating a preview, fixture, or deterministic pure harness as proof of server runtime, fairness, or production capacity.

## Final decision

**PASS — N03 requirements-only.** G0 is already PASS at the requirements level, N02 is the declared dependency, and the N03 product contract is now complete at 18/18 AC. The next executable step is the N03 implementation plan/harness. N03 must not be marked DONE until the listed fixtures and focused tests provide actual evidence; the current source facts above are implementation gaps expected to be addressed by that work, not evidence of completion.
