# V0 — Inventory và delta trước Dev

Reference: ba HTML gốc, hash và ảnh Light/Dark trong manifest.json; network bị chặn khi render HTML, font fallback có khai báo. Reference capture chưa phải pixel acceptance của font. Ảnh app local là before-layout sau sửa Dark default, không dùng làm target. Bản gốc được giữ nguyên.

| Routes (aliases vẫn giữ) | R tasks | V owner | Delta / functional risk |
|---|---|---|---|
| `/`, `/home`, `/phong-online` | HOME-01–06 | V2 | Hero orb/boxed robot, profile trái, CTA riêng và cả hai nhóm mode; cần reference layout/tabs/context CTA; queue thường chưa có backend route |
| `/queue` | QUEUE-01–04 | V3 | Search stage dùng panel Robot Lab; Cancel/race/resync giữ contract |
| `/phong/:roomId`, `/room/:roomId`, `/game/:roomId` pregame | ROOM-01–05 | V3 | Slots/Ref/Spec/config như reference; inspect public Ref-host restriction |
| Cùng room routes active + `/ai`, `/offline` | GAME-01–02, REF-01–04, LOCAL-01–02 | V4 | Board/HUD/layout/white-glove/motion; canonical geometry/orientation và handoff |
| `/spectate/:roomId` | SPEC-01–02 | V4 | Shared arena/public events; role changes/pause/leave |
| Result trong Online/local/Bot | RESULT-01–02 | V4 | Outcome/NPM/rematch/reason privacy; finite celebration |
| `/bot-lab` | BOTLIB-01–04 | V5 | Three-region reference, Guest local library missing, handoff use selection inspect |
| `/dau-chuong-trinh/online` | BOTON-01–05 | V5 | Prep, quotas/runtime presets, pending/hot-update/logs/recovery; account gate violates Guest scope |
| `/dau-chuong-trinh/offline` | LOCAL-03–05 | V5 | Two slots, view controls, cache/restore; no source/privacy regression |
| `/ban-be`, `/friends` | FRIEND-01–04 | V6 | Unified panels/invitation states; actual router imports FriendsPage, trace wrapper before deletion |
| `/lich-su`, `/history`, `/history/:matchId` | HIST-01–04 | V7 | Filter/source/read-only replay/revision and pause timeline/audit |
| `/ho-so`, `/profile/:username` | PROF-01–03 | V8 | Identity/stats and relationship/privacy; public vs local Guest |
| `/cai-dat`, `/settings` | SET-01–03 | V9 | Theme/motion controls + cache/diagnostics/local-data confirmation |
| Login/Register/Forgot VN + EN aliases, `/guest`, `/guest/play` | AUTH-01–03, LOCAL-01 | V9 | Forms/session recovery/import; legacy Guest route redirects Offline |
| `*`, errors/loading/modals/toasts | FALL-01 | V9 | Reference assets/actions/focus; no stack/outage/cache confusion |

Backend source audit: matchmaking.route.ts, bot-library.route.ts and bot-online.route.ts call account `auth.authenticate`; Guest Bot and ordinary Guest queue are therefore backend dependencies, not CSS omissions alone. Record failing authorization harness before changing them in VIS-FUNC-01/02. No database migration or runtime architecture rewrite is implied.

Cleanup ownership: globals.css + b3-lobby.css + robot-lab.css currently layer Home/hero selectors; V1/V2 must remove only old selectors whose consumers are replaced. Existing RobotLabMark remains used for auth/fallback/header until those consumers migrate. RobotLabHost is a distinct full-body illustration, not a duplicate mark. Historical R evidence and user work are preserved.

## V0 closure evidence (2026-10-04)

V0 is complete as a reference/harness wave. It does not claim that V1–V10 UI work or runtime behavior is complete.

- `scripts/robot-lab-v0-harness.mjs` runs in isolated Playwright contexts, denies network except pinned in-memory font bytes, and performs read-only GET/capture against the local service.
- `scripts/robot-lab-v0-verify.mjs` is the fail-closed verifier. It checks the three immutable source hashes, selected Robot Lab/white-glove variants, font loading, route/state coverage, theme checks, inventory completeness and screenshot artifacts.
- `manifest.json` records 3 immutable sources, 24 reference states (Home routes + Direct/Bot tab + board + lobby/referee/observer), 28 application before-route captures, 4 fresh/Light/Dark/System checks and PASS gates.
- `inventory.json` records 18 feature rows. Every row has task IDs, route aliases, visible states, API/module ownership, focused test/harness evidence and owning V wave.
- `font-manifest.json` and `fonts/*.ttf` pin the public Be Vietnam Pro and Space Grotesk bytes used by the original reference. The originals remain outside the repository and their SHA-256 values are recorded; no reference HTML was modified.
- `v0-harness-report.md` records the two pre-green harness failures (hidden-variant selector and source-specific font assertion) and their corrective reruns. This is harness evidence, not a functional acceptance claim.

V0 acceptance: **PASS**. V1 remains the next executable wave; no V1 task is marked complete by this reference evidence.
