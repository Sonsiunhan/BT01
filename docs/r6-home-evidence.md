# R6 evidence — Homepage / Room Browser / Friends Preview

## Status

`DONE` for the R6 page scope. This does not claim that the whole Robot Lab plan is complete.

## Harness → implementation

- Pre-fix `HomePage.test.tsx`: 2/2 failed because the Homepage still exposed the Ranked-only CTA, stale copy (`Mở dossier`, `Ghép đối thủ theo Elo`, `SYSTEM-PULSE`, `Không cần hover`) and only the old two-card mode grid.
- Post-fix focused evidence: 5/5 tests pass across Homepage, full RoomBrowser and active-match resume hint.

## Acceptance trace

| Item | Evidence |
|---|---|
| HOME-01 | Robot Lab hero/profile shell keeps the three-column desktop layout, compact account/Guest panel, requested CHAN greeting and Robot Lab vectors. The technical ready strip and false healthy decoration are removed. |
| HOME-02 | `OnlineMatchPanel` exposes `TÌM TRẬN`, `Đấu thường`/`Xếp hạng`, persists a valid account choice, keeps Guest on normal rooms and gives the Ranked login hint. Ranked points to `/queue`; normal points to `/phong-online`. |
| HOME-03 | Home has `Chơi trực tiếp` (`Tập luyện`, `Offline 2P`) and `Đấu chương trình` (`Bot Online`, `Bot Offline`, `Thư viện Bot`) groups. Cards use Robot Lab tactile elevation and responsive 3→2→1 rules. Entry pages are explicit preparation states for R9–R11, not fake runtime execution. |
| HOME-04 | Preview uses `Danh sách Phòng Online` with `Xem tất cả`. `/phong-online` renders the full RoomBrowser with Room ID search, Tất cả/Chơi trực tiếp/Đấu chương trình filters, role badges, explicit empty/error/loading states, load-more and an unclipped 3→2→1 grid. Existing server ACL remains authoritative. |
| HOME-05 | Friends preview now has readable `Tất cả`, `Tìm người chơi` and `Thêm bạn để CHAN!`; Guest copy explains room-link use without inventing a Guest Arena mode. |
| HOME-06 | `activeMatchHint` stores only a non-sensitive room/mode/status hint while a real GameRoom snapshot is active, expires stale client data, clears on leave/terminal state and links back to the server-authoritative GameRoom. Health UI is rendered only for degraded/error states and includes `Thử lại`. |

## Automated gates

- Focused: 3 files / 5 tests PASS (`HomePage`, `RoomBrowser`, `activeMatchHint`).
- Full web: 26 files / 83 tests PASS.
- Workspace typecheck: PASS.
- Workspace lint: PASS (`--max-warnings 0`).
- Production build: PASS; only the pre-existing Rollup/Zod annotation warnings remain.
- `git diff --check`: PASS; only line-ending normalization warnings.
- Local HTTP smoke: `http://localhost:3000/` returned `200` while Vite was running; server was stopped after the read-only check.

## Review limits and boundaries

- Browser MCP visual/axe run was attempted but unavailable because the Windows helper exited with `helper_unknown_error`; therefore screenshot, Core Web Vitals and physical device evidence remain `NOT RUN` and belong to R19.
- R7 owns waiting-room creation/role gating; R8 owns manual Referee controls; R9–R11 replace the explicit Robot Lab entry states with the real private library and isolated Bot runtimes; R12 owns the full Friends/invitation page.
- No push, deploy, paid service, billing, shared/production database migration or destructive cleanup was performed.
