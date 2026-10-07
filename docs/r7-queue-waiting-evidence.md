# R7 — Queue / Waiting Room evidence

## Scope and ownership

R7 covers the Queue search stage, custom-room creation controls, extracted Waiting Room presentation, role-aware Ready/Start gating, Referee invitation entry, spectator capacity presentation, and the member-scoped room-detail role seam. R8 remains the owner of the visible in-match Referee stop/resume controls; R9–R11 remain the owners of real Bot runtime execution.

Changed R7 files:

- `apps/web/src/components/rooms/CreateRoomForm.tsx`
- `apps/web/src/components/rooms/WaitingRoom.tsx`
- `apps/web/src/components/rooms/RoomBrowser.tsx`
- `apps/web/src/pages/QueuePage.tsx`
- `apps/web/src/pages/GameRoomPage.tsx`
- `apps/web/src/services/rooms/roomApi.ts`
- `apps/web/src/services/rooms/matchApi.ts`
- `apps/web/src/styles/b3-lobby.css`
- `apps/server/src/modules/room/room.route.ts`
- R7 unit/browser harness files under `apps/web/src/...`, `apps/server/test/unit/`, and `tests/e2e/r7-queue-waiting.spec.ts`

## Harness → implementation

Before implementation, the new RoomBrowser harness was red because the create modal had no Manual/Bot, Referee or Spectator controls, and the WaitingRoom harness could not import the missing module. The post-fix focused harness is green:

- RoomBrowser + WaitingRoom: **4/4 PASS**.
- QueuePage: **17/17 PASS**, including the static search-stage regression and authoritative cancel/resync cases.
- Server room/referee lifecycle: **18/18 PASS** in `room.manager.unit.test.ts` and `referee.route.unit.test.ts`, including all four independent Referee/Spectator toggle combinations.
- Authenticated room-detail role route: **1/1 PASS**. `/rooms/:roomId` now serializes the authenticated `PLAYER`/`REFEREE`/`SPECTATOR` role; the UI fails closed when `viewerSide` is `null` without a server Referee role.

## Observable output and authority

- Queue uses a calm Robot Lab search stage (`GIAI ĐOẠN TÌM TRẬN`) with elapsed time, rating and range; the old decorative radar rings are no longer rendered. Match-found copy is Vietnamese and points to the server-owned Ready/countdown flow.
- Create Room exposes independent Manual/Bot, Public/Private/password, timer, Referee and Spectator choices. The invalid Public + host-Referee combination is blocked in the form and remains validated by the server contract.
- Waiting Room shows two player slots, a distinct single Referee slot, spectator count/capacity, room code/copy, and role-specific actions. A player never receives the Referee Start button. An appointed Referee sees Start only after both players are Ready; the actual transition is still the server `POST /matches/:roomId/referee/start` decision.
- Referee invite errors are handled without unhandled promise rejections; the invite form only closes after an acknowledged success.
- No client-side URL/payload role elevation, Python execution, deployment or database migration was introduced.

## Automated evidence

| Gate | Result |
|---|---|
| Focused web R7 tests | PASS — 3 files / 17 tests |
| Full web unit suite | PASS — 27 files / 87 tests |
| Server unit suite | PASS — 18 files / 93 tests |
| Workspace unit tests | PASS — 11 files / 66 tests |
| Contract tests | PASS — 4 files / 10 tests |
| Workspace typecheck | PASS |
| Web lint | PASS |
| Web production build | PASS — Vite build; only existing Rollup/Zod annotation warnings |
| Server TypeScript compile | PASS |
| R7 browser E2E | PASS — 3/3 Chromium tests (queue stage, Referee Start, player no-Start) |
| R1 queue browser regression after R6 CTA copy update | PASS — 2/2 tests (run as focused cases) |
| `git diff --check` | PASS — line-ending normalization warnings only |

The root `corepack pnpm build` command was **NOT RUN** because its server build script invokes `prisma migrate deploy` against the configured datasource, which is not independently verified as disposable. The safe web build and server compile above provide the R7 code/build gate without touching a shared or production database. A disposable-database build gate remains an explicit release/environment task.

## Review and boundaries

Static review checked Vietnamese product copy, mobile layout, reduced-motion compatibility inherited from Robot Lab, role separation, fail-closed Referee controls, and server-authoritative start/Ready behavior. No independent reviewer was available in this turn; independent review is therefore **NOT RUN**, not claimed as PASS. Physical Android/iOS visual evidence, broad cross-page axe/CWV and full release matrix remain R19/R20 scope.

## Status

**R7 DONE for its local Queue/Waiting Room acceptance scope, with the root build/disposable-database and independent-review boundaries explicitly open.** Safe next Wave: **R8 — Manual Game / visible Referee controls**.
