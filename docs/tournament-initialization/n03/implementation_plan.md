# N03 — Implementation plan

**Owner:** Nguyễn Tiến Nam
**Branch:** `nam-tournament`
**Task:** N03
**Page:** P04 — Cấu hình luật
**Dependency:** N02 (`2acb2bb`)
**Gate:** G0 requirements PASS; N03 requirements gate PASS (18/18 AC, 100%, 0 P0/P1)
**Status:** DONE — implementation gate PASS; 18/18 AC verified in scope

## 1. Goal

Mở rộng engine và preview contract để goal theo từng bên hỗ trợ `STATIC`, `CYCLE` và `SEEDED`, có tiến trình immutable dựa trên accepted plies, replay seed deterministic và event-order fixtures Q17/Q18.

## 2. Scope

### In scope

- Goal profile discriminated union trong `@ottv2/game-rules` với validation bounded, ordered cycle và own-occupied filtering cho SEEDED.
- `goal-prng-v1`: FNV-1a32 over UTF-8 bytes with explicit domain separators + xorshift32; public `seed`, `matchKey`, `side`, `purpose`; unsigned 32-bit operations, zero-state normalization and rejection sampling to avoid modulo bias.
- Immutable `RuleProgress`: `acceptedPlies`, `roundIndex = floor(acceptedPlies / 2)`, active goal theo side và public seed context.
- Accepted move là nguồn duy nhất tăng progress; rejected move, pause, resume, restart without accepted plies và wall/queue time không tăng round.
- Goal evaluation trước move theo active goal hiện tại; natural win không bị goal tick ghi đè; goal tick lên ô occupied/shared không capture hoặc auto-win.
- Additive N02 preview response: normalized dynamic goals, active goals, progress/seed metadata và per-candidate reachability; không thay legacy L01 contract.
- Named Q17/Q18 fixtures và replay/PRNG vectors.

### Out of scope

- Publish/approval/persistence/migration, comparator/rating/settlement, UI P04, Bot/WASM/runtime receipts, capacity/load proof và production deployment.
- Sửa trực tiếp `apps/server/src/modules/match/match.manager.ts` để đưa pause/clock lifecycle vào engine. L07/L08 là owner của integration; N03 chỉ cung cấp pure progress seam và event-order evidence.
- Thay đổi `TournamentRuleProfileSchema` L01 hoặc legacy match coordinate wire format.

## 3. Canonical decisions

- `STATIC`: một ô cố định; own piece trên goal ban đầu là invalid; không auto-win khi dựng state.
- `CYCLE`: list hữu hạn, không rỗng, theo đúng thứ tự; index ban đầu `0` không được nằm dưới quân own khi `GOAL_REACHED` bật; đổi sau mỗi `roundInterval` full rounds và wrap.
- `SEEDED`: candidates hữu hạn, không rỗng, lặp lại được; lọc ô đang bị own piece chiếm trong layout ban đầu trước lần sample đầu; sau đó sample theo seed schedule.
- Một full round = hai accepted plies từ đầu trận, không phụ thuộc bên đi trước.
- Event order observable: late/deadline reject trước commit; accepted natural win trước progress/goal tick; terminal state không bị ghi đè.
- Q17 = CYCLE index-0/wrap + occupied goal tick không auto-win/capture. Q18 = SEEDED filtering + deterministic replay + pause/rejected no-op round.

## 4. Design and file ownership

### `packages/game-rules`

- `src/types.ts`: add `CycleGoalProfile`, `SeededGoalProfile`, `GoalSeedContext`, `RuleProgress`, progress event types and optional `RuleState.progress`; preserve legacy fixtures that construct `RuleState` without progress.
- `src/goals.ts` (new): pure validation helpers, active-goal resolution, own-occupied filtering, UTF-8 `goal-prng-v1`, `createRuleProgress`, `restartRuleProgress`, `advanceRuleProgress`, committed-snapshot replay and progress replay. Export from `src/index.ts`.
- `src/setup.ts`: validate all goal modes, intervals, bounds, duplicate cells, supported seed policy and filtered SEEDED non-empty result; attach immutable progress for dynamic profiles during initial setup.
- `src/engine.ts`: evaluate the active goal before an accepted move, advance progress only after accepted non-terminal moves, preserve no-auto-win/immutability and legacy STATIC behavior.

### `packages/contracts`

- `src/tournament-rules-preview.ts`: add optional public `seedContext`, additive `progress`, active-goal schedule and per-side/per-candidate reachability schemas; add typed validation/error codes. Keep existing N02 request fields and L01 schemas compatible.

### `apps/server`

- `src/modules/tournament-rules-preview/rules-preview.service.ts`: normalize CYCLE/SEEDED without the N02 unsupported-capability rejection, call real game-rules progress/goal seams, return public metadata only, and keep `runtimeStatus: NOT_CHECKED`.
- Do not edit shared match lifecycle in N03.

### Tests and evidence

- `tests/unit/tournament-goals.unit.test.ts` (new): PRNG vectors, cycle/seeded schedules, filtering, progress immutability and replay.
- `tests/unit/tournament-rules-preview.unit.test.ts`: dynamic goal validation and active-goal behavior.
- `tests/unit/tournament-rules-preview.service.unit.test.ts`: additive preview response, deterministic digest/no mutation, dynamic reachability and no private seed leak.
- `tests/contract/tournament-rules-preview.contract.test.ts`: additive request/response compatibility.
- `tests/unit/n03-q17-q18.unit.test.ts` (new): named Q17/Q18 fixtures and event-order/no-op pause/rejection cases.
- Existing N01/N02/L01 tests remain regression fences.

## 5. Harness → Dev sequence

1. **Harness red:** add failing vectors/fixtures for CYCLE index-0/wrap, SEEDED filtering/replay, occupied goal no-op, accepted-round cadence and pause/rejection no-op; add preview contract assertions.
2. **Goal/progress implementation:** implement `goals.ts`, typed progress and validation; freeze every returned profile/progress/state; keep PRNG constants and candidate ordering explicit in vectors.
3. **Engine integration:** make `applyMove` use the pre-move active goal and advance progress only after accepted plies; ensure a stale goal cannot win and a goal tick cannot mutate board state.
4. **Preview integration:** add dynamic goals and public progress metadata to the additive N02 response; preserve auth/scope/revision checks and runtime NOT_CHECKED.
5. **Focused verification:** run N03, N02, N01 and legacy game-rules tests, package typechecks and diff checks. Record environment-sensitive unrelated failures separately.

## 6. Acceptance criteria

| ID | Observable criterion | Evidence |
|---|---|---|
| N03-AC01 | STATIC/CYCLE/SEEDED parse and validate with bounded fields; absent `GOAL_REACHED` has no active goal effect | contract + validator tests |
| N03-AC02 | STATIC starts at configured cell; own initial goal is rejected; accepted move into current goal wins | goal/engine fixture |
| N03-AC03 | CYCLE starts index 0, advances after K full rounds and wraps | Q17 golden fixture |
| N03-AC04 | SEEDED filters own-occupied initial candidates; empty filtered set rejects; repeated/one-cell candidates remain valid | Q18 + validation tests |
| N03-AC05 | `goal-prng-v1` produces exact deterministic vectors with independent side/purpose streams | PRNG corpus |
| N03-AC06 | Progress is immutable; one round is exactly two accepted plies | progress unit tests |
| N03-AC07 | Rejected moves, pause/resume and wall/queue time do not advance progress | Q18/no-op fixtures |
| N03-AC08 | Goal tick onto occupied/shared cell does not capture/delete/push/auto-win | Q17 fixture |
| N03-AC09 | Active goal is evaluated before move; stale previous goal cannot win; terminal state is not overwritten | engine event-order tests |
| N03-AC10 | Replay/restart from public seed context reproduces accepted plies, round and active goals without mutation | replay vectors |
| N03-AC11 | Preview returns dynamic goal schedule, active goals, progress/seed metadata and reachability without private runtime secrets | contract/service tests |
| N03-AC12 | N01/N02/L01 legacy behavior and contracts remain green | regression suite + typecheck |
| N03-AC13 | A later accepted legal move uses the current active goal; a stale previous goal cannot win | dynamic engine fixture |
| N03-AC14 | A late command is rejected before commit; on-time natural win precedes ply limit, then goal tick; terminal state is locked | event-order fixture |
| N03-AC15 | Replay starts from committed progress and preserves a mid-round snapshot when no accepted ply commits | committed-snapshot fixture |
| N03-AC16 | Replaying accepted/rejected/pause/time events is idempotent and does not mutate prior progress | deep-freeze/replay tests |
| N03-AC17 | Q17 explicitly covers valid CYCLE index-0, accepted-round advancement/wrap and occupied goal tick | named Q17 fixture |
| N03-AC18 | Q18 explicitly covers SEEDED filtering, deterministic restart/replay and pause/rejected no-op | named Q18 fixture |

## 7. Verification commands

```text
node_modules/.bin/vitest.cmd run tests/unit/n03-q17-q18.unit.test.ts tests/unit/tournament-goals.unit.test.ts tests/unit/tournament-rules-preview.unit.test.ts tests/unit/tournament-rules-preview.service.unit.test.ts tests/contract/tournament-rules-preview.contract.test.ts
node_modules/.bin/vitest.cmd run tests/contract/tournament-l01.contract.test.ts tests/unit/l01-harness.unit.test.ts tests/unit/game-rules.unit.test.ts tests/unit/l01-w3-entropy.unit.test.ts
node_modules/.bin/tsc.cmd -p packages/game-rules/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p packages/contracts/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p apps/server/tsconfig.json --noEmit
node_modules/.bin/vitest.cmd run --config apps/server/vitest.config.ts test/unit/rules-preview.route.unit.test.ts
git diff --check
```

## 8. Known boundaries

- This plan proves deterministic pure engine/preview behavior only. It does not prove server pause/clock integration, runtime capacity, fairness, settlement or production readiness.
- N03 must not be marked DONE when any mandatory focused test, typecheck or contract regression is NOT RUN/FAILED.
