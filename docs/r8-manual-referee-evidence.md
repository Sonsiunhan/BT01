# R8 — Manual Game / Referee evidence

## Status

**DONE for the local R8 Manual Game / Referee scope.** This report covers the visible GameRoom/Spectator controls and the server-authoritative pause/recovery contract. It does not claim the whole Robot Lab plan is complete.

## Output delivered

- GameRoom keeps the canonical Blue-below presentation for Referee and Spectator; player orientation remains fixed to the participant's own side and never rotates on turn changes.
- A designated Referee sees the Robot Lab control card and can choose one public stop category: `Sự cố kỹ thuật`, `Thắc mắc luật`, or `Lý do khác`. The category is submitted to the server and returned in the public match snapshot/event rail.
- `PAUSED` is a centered, focus-trapped, nondismissible overlay. It shows `Trận đấu đã dừng`, public reason, elapsed pause time and frozen-state copy. Players/Spectators never receive a Resume control.
- Referee Resume is compact and keyboard/focus safe with a 44px minimum target. `RESUMING` shows the server timestamp countdown and `Giữ dừng`; infrastructure/player-disconnect blockers do not expose Resume and cannot be cleared by the Referee UI.
- Board move controls, surrender, Ready and revision-changing actions remain disabled by the authoritative non-`PLAYING` state. Settings are locked from the countdown.
- Referee disconnect recovery is visible only while paused: a player may nominate a logged-in account, each player must approve, and the nominated account must explicitly accept. The server atomically updates the room role after consent; Guest, player/spectator conflicts and former-Referee access are rejected.
- SpectatorPage reuses the same read-only pause surface and keeps Blue below. No private Python source, memory, logs or diagnostics are placed in public snapshots or UI.

## Harness → Dev → Test evidence

The pre-fix harness was red because the Referee pause component/API did not exist. The focused UI harness is now green:

- Web R8 component harness: 2 files / 6 tests PASS (`RefereePauseOverlay`, `RefereeReplacementPanel`).
- Browser harness: `tests/e2e/r8-manual-referee.spec.ts` 4/4 PASS, including Chromium 390×844 mobile viewport; R7 waiting-room regression 3/3 PASS.
- Server focused ACL/lifecycle: `referee.route.unit.test.ts` 5/5 PASS; `match.manager.unit.test.ts` 18/18 PASS.
- Full server serial suite: 21 files / 107 tests PASS.
- Workspace unit/contract/integration suite: 16 files / 77 tests PASS.
- Web regression was run in bounded batches: 29 files / 93 tests PASS (including prior R1–R7 coverage and the six new R8 component tests).
- Workspace typecheck PASS; web typecheck PASS; lint PASS; web production build PASS (only pre-existing Rollup/Zod annotation warnings); server `tsc --noEmit` PASS; `git diff --check` PASS with existing Windows line-ending warnings.

## Review and boundaries

- Static review covered server role gates, stale-state rejection, replacement consent, blocker handling, fixed board orientation, public-only reason labels, focus trapping, reduced-motion-safe CSS and mobile layout.
- Physical Chrome Android/Safari iOS testing, screenshot baseline comparison, broad axe/CWV and independent BA/QA review remain **NOT RUN** and belong to R19/R20. The mobile result above is a Chromium viewport harness, not a physical-device claim.
- The root build was intentionally **NOT RUN** because its script invokes Prisma migration against an unverified datasource. No migration, push, deploy, paid service or shared/production database mutation was performed.
- Bot execution, Workbench/Library, offline runtime, replay/audit clients and final release acceptance remain R9–R20 scope.

## Next executable Wave

R9 — Workbench / Library.
