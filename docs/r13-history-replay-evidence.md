# R13 History / Replay / Audit evidence

Date: 2026-10-04 (local workspace)

## Scope

R13 implements the History page output for account and on-device history, explicit Online/AI/Offline/Bot filters, read-only canonical replay controls, public timeline and audit download. It does not claim the R17 public spectator/replay consumer or the R19/R20 device and independent release gates.

## Harness before → after

- The replay harness was initially red because `ReplayPanel` did not exist. After implementation, `apps/web/src/components/history/ReplayPanel.test.tsx` passes 2/2: canonical Blue-bottom orientation, read-only board, Play/Pause/Step and final-board-only fallback.
- The history service harness initially exposed a retry path that dropped `playMode`; the pending record now preserves both the snapshot and mode. `apps/server/test/unit/history.service.unit.test.ts` passes 3/3.
- The audit route harness verifies authenticated delegation, JSON attachment headers and payload delivery. `apps/server/test/unit/history.route.unit.test.ts` passes 1/1.

## Implementation

- `packages/contracts/src/history.ts` defines Bot Online/Bot Offline filters, account/local source, replay moves, sanitized public timeline and retention metadata.
- `packages/contracts/src/match.ts` and `MatchManager` persist move snapshots plus only allowlisted public events. Source, memory, private logs and diagnostics never enter `MatchSnapshot.publicTimeline`.
- Bot terminal outcomes now carry an explicit public N/P/M adjudication (`BOT_LIMIT_CRITERIA` or the published exact-tie `BOT_LIMIT_EXACT_TIE`, with Red winning an exact tie); author faults and infrastructure failures are separate result reasons and do not masquerade as a loss caused by the wrong actor.
- `Match` stores `playMode`; the source-only migration adds the indexed column without touching a database.
- `MatchHistoryService` writes moves/events transactionally with the match, deduplicates retry writes by match id, maps Bot Online separately from normal Online, exposes a legacy final-board-only replay, and serves an owner/participant-scoped audit with 30-day source and 7-day log retention metadata.
- `GET /history/:matchId/audit` returns `application/json` with a deterministic attachment filename. The web page exposes a public-data-only audit download and explains the privacy boundary.
- The History page renders account source badges, a truthful local-device summary section, Online/AI/Offline/Bot filters, replay availability/move counts and a replay modal with fixed orientation. Bot revision activation is recorded as a public revision-number-only timeline marker; Referee pause/resume markers remain available in the same replay timeline.

## Gates

- Server focused history/replay/audit: **4/4 PASS** (3 service + 1 route); Bot Online adjudication harness: **7 PASS / 1 explicit pinned-runtime skip** (8 tests).
- Web focused History/Replay: **3/3 PASS** (1 HistoryPage + 2 ReplayPanel); Result/thumbnail regression: **4/4 PASS**.
- Server full regression after R13 route harness: recorded after this checkpoint.
- Web full regression after R13 local-history integration: recorded after this checkpoint.
- Server and web typecheck: **PASS**.
- Web lint: **PASS**.
- Web production build: **PASS**; only pre-existing Zod/Rollup annotation warnings.
- Prisma schema validation: **PASS** with a synthetic non-connected disposable URL; no migration was executed.
- `git diff --check`: **PASS**; line-ending normalization warnings only.

## Boundaries and review

- Replay uses canonical `@ottv2/game-rules` and never invents a move when persisted moves are missing; legacy rows show the final thumbnail and an explicit fallback message.
- N/P/M is computed by the server-side Bot limit scorer and persisted in the terminal snapshot/history card; the exact-tie rule is covered by the Bot Online harness and is visible in History without exposing Bot source or memory.
- Bot revision timeline activation is covered by the Bot Online harness; only side and revision number are public.
- Aborted/infrastructure outcomes remain neutral in history projection and are not converted into a loss by replay UI.
- Audit output is deliberately public-data-only; account/private logs and Bot source/memory remain outside it. R17 owns broader public spectator consumption.
- Independent BA/QA sign-off and physical Chrome Android/Safari iOS visual evidence are **NOT RUN** here and remain R19/R20 gates.
- No push, deploy, paid service, production/shared database migration or destructive cleanup was performed.

## Status

**DONE for the R13 implementation scope.** Safe next Wave: **R14 — Profiles**.
