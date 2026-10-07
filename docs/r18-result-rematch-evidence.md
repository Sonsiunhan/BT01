# R18 — Result / Rematch evidence

Date: 2026-10-04 (Asia/Bangkok)

## Scope

R18 closes the Result/Rematch boundary for manual and Bot matches. The result surface keeps a clear win/loss/neutral outcome, renders the authoritative reason and public Bot N/P/M adjudication, shows Ranked Elo only for Ranked results, and keeps rematch server-authoritative. A rematch receives a new `matchId`, resets pause/replacement state, swaps player sides, and starts in `WAITING_READY`; Bot private moves, pending revisions, memory and commit fences are reset before the new match can run.

## Harness → implementation

The pre-fix harness was intentionally RED for three defects:

- ResultPanel showed the generic “Bạn đã mất toàn bộ quân.” for a losing Bot limit result instead of the published limit reason.
- Result duration was derived from `endedAt - startedAt` and therefore counted a Referee pause.
- A Bot Online session was keyed only by room and retained old moves, pending revision and private memory after both players accepted a rematch.

The implementation adds `resultMetrics`, passes canonical `MatchSnapshot.moves`/pause data into ResultPanel, renders public N/P/M plus fault responsibility, resets MatchManager pause/replacement fields, and fences BotOnlineService sessions by authoritative `matchId`.

## Acceptance evidence

- RESULT-01: PASS. ResultPanel covers FINISHED/ABORTED, every `MatchResultReason`, both player perspectives, event-based victory/defeat effects, and neutral interruption without false winner/Elo. Reduced-motion behavior remains delegated to the existing presentation policy.
- RESULT-02: PASS. Ranked Elo is conditional on Ranked and non-neutral outcome; Bot limit/fault/infrastructure reasons include the public N/P/M adjudication; `calculateActiveDurationSeconds` subtracts pause intervals/aggregate pause time; canonical MatchSnapshot remains the source for ResultPanel, History and public audit.
- RESULT-03: PASS. Rematch requires both player requests, creates a new match fence, swaps sides, resets Ready/countdown/board/clocks and Referee pause/replacement state, and Bot sessions clear moves/pending revisions/memory/commit fences. Late upload remains pending-only and cannot auto-start the next round; Referee rooms still require valid Referee Start after both Ready.

## Tests and gates

- Harness-focused web: **2 files / 6 tests PASS** (`ResultPanel.test.tsx`, `resultMetrics.test.ts`), including public N/P/M privacy copy and a 10-second match with a 3-second pause producing 7 active seconds.
- Harness-focused server: **2 files / 27 tests PASS, 1 explicit pinned-runtime skip** (`bot-online.service.unit.test.ts`, `match.manager.unit.test.ts`), including rematch move/pending/memory reset and pause/replacement reset.
- Full web regression: **40 files / 123 tests PASS**.
- Full server regression: **26 files / 128 passed / 3 explicit runtime-environment skips**.
- Web typecheck: PASS. Server typecheck: PASS. Web lint: PASS.
- Web production build: PASS (267 transformed modules; existing Zod/Rollup annotation warnings only).
- Server production build: PASS; artifact pin tests and R3 provider probe PASS.
- `git diff --check`: PASS; only existing Windows line-ending normalization warnings.

## Safety and boundaries

Public Result/History/Audit data contains reason, side and N/P/M only; Bot source, private memory, private logs and diagnostics are not exposed. No player Python ran in the application process or an unrestricted native subprocess. No database migration, shared/production database mutation, push, deploy, paid service or billing action was performed.

Independent final BA/QA, physical Android/iOS, screenshot baseline, axe/CWV and broad cross-page release matrix are **NOT RUN** and remain R19/R20 gates. R18 is locally DONE; the next executable Wave is R19.
