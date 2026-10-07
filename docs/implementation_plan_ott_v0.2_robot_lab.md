# OTT v2 v0.2 — Robot Lab implementation plan

## 0. Status, approval and scope

**Visual correction 2026-10-04:** user confirmed 1A/2A/3A: match the original Robot Lab HTML and six supplied screenshots, adapt layout for real features, use two Home tabs with context-specific hero/CTA, default new browser profiles to Dark while preserving saved Light/System, interaction-driven motion and original white gloves. The detailed visual delta/ownership/acceptance plan is [implementation_plan_robot_lab_visual_rebuild.md](./implementation_plan_robot_lab_visual_rebuild.md), Waves V0–V10. This is the latest visual contract; existing R evidence does not certify visual fidelity. R20 remains open until the visual rebuild and remaining acceptance gates pass. Physical Android/iOS remains WAIVED_BY_USER.

| Field | Value |
|---|---|
| Product decision date | 2026-10-02, Asia/Bangkok |
| Approval | User: “Duyệt” |
| Approval interpretation | Recommended 79–86A accepted together; 1–78 already recorded. This is not eight individual answer submissions. |
| Local execution | APPROVED; Wave checkpoints required |
| Implementation status | IN PROGRESS; not 100% |
| New plan identity | R0–R20; do not confuse with historical B0–B14 |
| Baseline inspected | main, 674d943; existing untracked `.worktrees/` preserved |
| Remote operations | Push/deploy/shared or production DB migration require separate approval |
| Success definition | 100% of accepted scope implemented with evidence; no silent deferred feature |

This plan extends functionality and replaces the old visual direction; it is not merely a recolor of 06B. New features: Guest in ordinary Online modes, Python Bot Online/Offline, private Workbench/revisions, deterministic Bot adjudication, optional Referee in custom Online rooms. Existing manual modes remain.

Preserve `implementation_plan_frontend_v0.2.md` and B0–B14 reports. Their checks describe an older scope and must not be reused to claim this scope complete. The old missing physical-device sign-off remains missing until new evidence exists.

Required lifecycle: **Plan → Harness → Dev → Test → Review → Clean Rubbish Code**. The root `AGENTS.md` defines the working agreement.

### 0.1 Precedence

1. Latest explicit user decisions and this approved decision log.
2. Canonical OTT rules, except the explicit Bot limit adjudication extension below.
3. Shared contracts/server authority for state, roles, clocks and actions.
4. Existing SRS/network/06 requirements that are not explicitly overridden.
5. 06B and old plan only for still-valid behavior, audio/accessibility/performance principles.

Never “fix” a conflict by silently returning to Neon Esports Arena, Guest Arena, rotating-per-turn, letter glyphs or client-side Online Python authority.

### 0.2 Not authorized / not included

- No paid runner/service, billing upgrade, production push/deploy, database migration or provider account creation without separate approval.
- No full tournament registration/bracket/multi-room command center in this release. Custom rooms support tournament organization.
- No new CTF board/game rules, native Python desktop runner, native library execution, cosmetics shop or integrated source editor.
- No referees in matchmaking queues, Ranked or Offline in this phase.
- No referee undo/time edit/source access/arbitrary winner override.
- No promise of 24/7 availability on free hosting or browser-level hard CPU/RAM security guarantees.

## 1. Approved decision ledger

| IDs | Locked output / behavior |
|---|---|
| 1–4 | Keep manual play; add Bot Online and Bot Offline. Guest plays regular Online/create/join/AI/manual Offline/Bot modes; Ranked requires account. One generated Guest name per browser profile, persistent through reload/tabs/matches. CTF is programming-competition inspiration, not a rules replacement. |
| 5–8 | Valid new Python revision activates at the next OWN turn, not mid-computation. Browser runtime/cache for Offline. Bot receives public board/legal moves/turn/time/history plus private memory. Cancel defect: click leaves user searching/unresponsive. |
| 9–12 | Online is Home's main CTA. Separate Chơi trực tiếp / Đấu chương trình groups; mode cards 3→2→1 columns. Short slogan; one needed sentence/card. Tactile lift/press, stable idle. Interactive title largest; data value largest in data cards. |
| 13–16 | Solid OTT monogram plus RPS hints and contextual wordmarks. Keep OTT v2/Oẳn Tù Tì names; CHAN only in requested phrases. Normal status strip removed; short actionable incident banner with Thử lại, auto-clear. Vietnamese player copy; diagnostics/help separated. |
| 17–24 | Guest local history and room-link invitations; durable account social/profile features require login. Bot modes unranked with separate queues/rooms. One `.py`, `choose_move(state, memory)` returns move+JSON memory, versioned SDK/sample/tested standard-library allowlist. Online trusted isolated server runner. Active bot exception/illegal move/own budget violation loses immediately; candidate failure preserves current bot; infrastructure fault is not author fault. Workbench upload/sample/docs/test/read-only source/revisions/private logs; sources private. |
| 25–32 | Home normal/ranked selector remembers last valid choice; Guest normal only. Intentional Queue exit cancels on authoritative ack; if matching already won, open assigned room. Bot validated before Ready; both Ready before start. Board read-only in Bot match; strategy rail/mobile drawer. Memory persists within revision, new revision resets unless explicitly compatible and selected. One latest valid pending; equal limits. Per-turn plus finite whole-match limits. Offline two independent slots, test/Ready/run/pause/step/speed, persistent session, fixed board. |
| 33–40 | Unified History with explicit local/account sources and manual/Bot filters. Import old Guest Arena as manual two-player local, not Bot. New replay from actual accepted moves/revision timeline; old final-board fallback. Profile manual/Bot-unranked tabs; private Library separate. Friends Incoming/Sent/Search and valid room invitations; Guest code/link only. Settings appearance/audio/motion/account/privacy plus Bot/cache/local data. Safe auth return/draft preservation/import selection. Spectator public data only, canonical Blue below. |
| 41–48 | Free-only, no paid provider/trial dependence. Bot limit uses explicit winner rule below. Guest principal stays pinned through an ongoing match even after login. Checkpoint each committed turn; bounded infrastructure recovery; failure neutral. Account Library until owner deletion; Guest Library local; temporary server match source30d/private logs7d; live memory removed after terminal. Late upload cannot change terminal match, explicit Library save allowed. Offline pause at safe turn boundary, Step exactly one turn, restored paused; cache missing keeps data/no server fallback. Workbench three clear regions/full states/mobile sections. |
| 49–56 | Lexicographic N/P/M, full-round limit boundary, RED wins exact tie by published rule. One Bot Online match admitted initially, finite wait/cancel and infrastructure capacity gate. External free DB candidate can be proposed, not migrated automatically. Home four rooms 2×2 with Xem tất cả. Bot public/private code/link/password, preset visible before Ready. Pregame missing/leaving resets Ready/countdown; disconnected pregame slot60s; owner tab need not remain open after Bot starts. |
| 57–60 | Latest choice supersedes earlier hybrid: **ROBOT LAB**. Original friendly robot at Home/onboarding/empty states only. Idle stable, motion tied to interaction/events; reduced/low static. Primary card/hero depth6–8px, information panel3–4px, no whole-board 3D tilt. |
| 61–64 | Neutral ceramic 9×9 cell board, pale Blue/Red round pucks82–88%, bevel2–3px. Original white-glove ✊/✋/✌️-style gestures with dark contour, deterministic assets, no visible Đ/B/K and no OS emoji-color filter in final product. Mechanical bounded movement/capture; remove excessive neon/glitch/shatter/aurora. |
| 65–70 | Bot rematch uses last active revisions, explicit selection before Ready, swaps sides/resets memory; no pending auto-start. Library export/delete/storage quotas and active-reference guards. True offline cold start requires full shell/routes/assets/fonts/runtime/template cache, version pin and restore. Started Bot continues when owner leaves UI if infrastructure available, Home Resume card/no second conflicting match. Every page actor/state/theme/viewport/keyboard/motion/contrast evidence; independent BA/QA and real device evidence. Whole local plan approved at DUYỆT; remote changes separately approved. |
| 71–74 | Custom ONLINE manual+Bot optional Referee and optional Spectator, independent toggles. 2 players+max1ref+Nspec; exclusive roles. Ref logged-in appointed account, not necessarily admin; Guest never Ref. Host chooses Player or Ref at creation; Ref host leaves two player slots open. Invitee accepts appointment; host is management capability, not fourth match role. |
| 75–78 | Both Ready/valid Bot/ref present then Ref Start; no Fast Ready bypass. No Ref means no manual Stop. Stop server-atomic, locks gameplay/Ready/countdown/match revision updates, freezes both clocks+active-duration cap. All roles nondismissible pause popup/elapsed time; spectator may leave. Cancel unfinished Bot invocation, discard late output; Resume same pinned active revision/pre-turn memory/seed with full budget, not author fault; no pending activation merely due Resume. |
| 79–82 | Resume3s countdown, same board/side/turn; Ref may Giữ dừng; unrelated blockers remain. Paused update cannot modify active/pending, explicit Library save distinct from application. Ref disconnect auto-pause, slot60s, recovery/replacement within5min from loss, no auto-resume. Only while paused: one player nominates logged-in replacement, both players approve, replacement accepts; atomically revoke old Ref. |
| 83–86 | Manual pause max10min each/30min cumulative, warn before expiry, neutral abort not auto-resume/winner. Ref only Start/Stop/Resume + short reason category; no surrender while paused. Robot Lab centered pause, elapsed, actor/reason; Ref-only compact Resume≥44px target, canonical Ref/Spec. Settings locked from countdown. Public audit/replay Start/Stop/Resume/replacement/durations, download without private code/memory/log; no bracket system. |

### 1.1 Exact Home copy

| Remove | Replacement / rule |
|---|---|
| NEON ESPORTS ARENA · 9×9 | Remove |
| Ghép đối thủ theo Elo | Remove |
| Standalone Phòng đấu eyebrow | Remove; do not remove necessary navigation to actual rooms |
| Danh sách cập nhật trực tiếp | Remove |
| QUICK DEPLOY; Không cần hover | Remove |
| SYSTEM-PULSE ONLINE API · Database · Realtime | Remove from normal UI; diagnostics only |
| Header Đã kết nối next to OTT v2 | Remove when healthy |
| Mở dossier | Xem hồ sơ |
| Old greeting | Chào {username}. Bạn đã sẵn sàng CHAN chưa? |
| AI/Normal luyện đọc thế cờ | Tập luyện |
| Long public-room description | Danh sách Phòng Online |
| Hãy là người đầu tiên mở 1 trận Unranked | Bạn hãy tạo phòng đầu tiên |
| Chưa có phòng Public nào | Chưa có Phòng đấu nào |
| Thêm người chơi để gửi lời mời vào phòng | Thêm bạn để CHAN! |

Tìm người chơi, Tất cả and every game CTA must be readable in Light and Dark, including hover/disabled/focus. Do not rename modes or rules to CHAN.

## 2. Global visible-output contract

| Area | Required output |
|---|---|
| Palette | Graphite/navy Robot Lab shell in Dark; ceramic/light gray shell in Light. Cyan system actions; pale Blue #D7EAFF/Red #FFE0E5 starting values on pucks with darker side rims. Final token tuning must pass measured contrast. Side colors not generic decoration. |
| Geometry | Clear mechanical base edges and restrained bevels. CTA/hero6–8px depth, information3–4px, puck2–3px. Readable flat faces; no idle floating, bounce or elastic. |
| Type | Be Vietnam Pro or existing verified Vietnamese display font, title20–24desktop/18–20mobile, body14–16, captions≥12. No clipped diacritics. Data clocks tabular. |
| Motion | Hover lift≤4px, press lower2px, optional fine-pointer card tilt≤3°,140–180ms. No hover dependency/touch tilt. Event effects cosmetic, no per-turn board spin; Reduced/Low static feedback. |
| Board | 81 normal square cells, tokens centered; A1/I9 playable and initially occupied. Ceramic neutral board, subtle grid, target bracket does not occlude puck. Online own side+HUD below fixed; manual AI/Offline/Bot Offline canonical; Ref/Spec Blue below. |
| Pieces | Original white-filled gloved gesture vectors, dark contour, cuff, three distinct shapes, round pale pucks82–88%. Side motif as non-color cue. Accessible Vietnamese names, no visible Đ/B/K. Distinguishable28px; graphic contrast≥3:1. |
| Actions | ≥44×44 effective targets except board cells (explicit mitigation). Title/CTA first-read; low contrast or disabled state cannot be indistinguishable from active action. Keyboard focus retained. |
| Robot/brand | Original non-IP-copying robot in Hero/onboarding/empty-state; not over every card or board. Solid monogram, compact OTT v2 header, full Oẳn Tù Tì wordmark Auth; light/dark favicon family. |
| Shell | Same header/navigation/dialog/button/form language across pages. Healthy tech status hidden. Short incident banner only when action affected; retry then auto-clear when recovered. No private stack/connection URLs/secrets. |
| Audio | Existing lazy shared AudioContext, SFX visual counterparts, music opt-in OFF, attribution and budget retained. Pause mutes gameplay loops; reconnect/Resume does not replay prior captures. |

White-glyph preview CSS filters are illustrative only. Old visual previews are not production assets, production contracts or approval to publish an obsolete visualization.

## 3. State, authority and architecture

### 3.1 Core invariants

- Canonical board/legal moves/winner stay in `game-rules`; share one move enumerator with N/P/M scorer. No duplicate UI heuristic.
- Room ID identifies a persistent room; match ID identifies one round/rematch. Every action checks actor, current role, match ID/version and epoch as applicable.
- Queue generation has stable ID and monotonic sequence. Matching terminal event cannot become older than search ticks. Cancel/match resolution returns authoritative outcome; UI never invents rollback.
- Public snapshots contain only public metadata/state. Private bot source/memory/logs use owner-bound APIs; never fan out through public SSE.
- Referee role is independent of BLUE/RED viewerSide and host flag. No referee action accepted through player/host authority alone.
- Separate role grant/invite from room password. Invitations bind room/role/intended principal/expiry/one-use; no self-assignment URL.
- Settings lock at COUNTDOWN; resets back to waiting invalidate Ready when players/ref/config change. Terminal match cannot be paused/resumed/updated or resurrected.
- Central scheduler owns advancement; client count/number of SSE subscribers must not multiply game progression or change clock accounting.
- Sources/logs/checkpoints need durable storage for recoverable Online Bot. Current in-memory-only room/match is not proof of restart recovery.

### 3.2 Referee room state machine

| State | Entry / permitted actions | Gate / next state |
|---|---|---|
| WAITING_READY | Join/invite/select validated bot; player Ready; host pregame config/ref appointment | Ref-enabled requires2 players Ready+validated bot+accepted present Ref; Ref Start. Ref-disabled uses2Ready flow. |
| COUNTDOWN | Fresh3s server timestamp; config frozen | At end, all start gates still valid then PLAYING. Pregame player leave/missing cancels Ready/countdown. Ref Stop may pause countdown. |
| PLAYING | Manual moves or trusted bot commits; owner uploads valid candidate for next own turn; surrender permitted | Normal OTT win/author bot fault immediate; Ref Stop serialized against moves/deadlines → PAUSED. |
| PAUSED | Public view/reconnect/elapsed pause/audit; Ref-only Resume request; no moves/Ready/surrender/revision change | Resume while any unrelated blocker remains is REJECTED, retaining REFEREE pause; no latent Resume request. Ref must click again after blockers clear. A valid request enters RESUMING. |
| RESUMING | Fresh3s, clocks/gameplay still frozen; Ref Giữ dừng permitted | If complete and safe → prior game phase/turn; pending activation rules unchanged. Stop returns PAUSED. |
| FINISHED | Read result/replay/explicit rematch selection | New match ID for rematch; no old control command can affect it. |
| ABORTED | Neutral cause, evidence preserved; no Elo/win/loss invented | Explicit new match only. |

Store phase-before-pause so COUNTDOWN resume cannot pretend the match previously started. Ready/start gates remain valid; mid-play resume must not re-Ready or swap sides. Multiple pause reasons compose; clearing INFRA_RECOVERY or reconnect cannot clear REFEREE or execute an earlier rejected Resume. Config lock refers to ROOM/game preset and roles, not the user's theme/audio/motion preferences.

### 3.3 Stop/Resume ordering, Bot cancellation and timers

1. Serialize Stop with move commit/result/deadline. Account elapsed active time at the authoritative transition. A result committed before Stop remains terminal; Stop does not restore expired time.
2. On Stop, retain committed board/stateVersion, currentTurn, last active revision, pre-turn memory+deterministic seed and remaining game clocks. Invalidate invocation epoch; kill/reclaim cancelled computation; late output cannot commit/log/mutate memory.
3. No private partial computation is persisted across cancellation. Resume reruns same uncommitted turn with full per-invocation allowance because cancellation was referee-originated, not author failure. Pending is not activated at Resume; normal next-own-turn boundary applies.
4. Board+accepted move+memory+revision activation checkpoint commit atomically. Failover/restart use leases/fencing; never double-commit or roll back an acknowledged move.
5. UI elapsed pause derives from server pause timestamp/server-time offset, not a browser-only timer. Reconnect snapshot includes roles, pause reasons, actor, timestamps, cumulative duration and restoration phase.

| Timer | Start / behavior | Deadline precedence |
|---|---|---|
| Gameplay clocks/per-turn compute/active match cap | Run only active gameplay; freeze on pause/resume countdown/infrastructure recovery | Existing normal win/author fault committed before Pause takes precedence |
| Resume countdown |3s after valid Ref Resume and all other gates clear; gameplay stays locked | New Stop/blocker cancels countdown; never implicit resume on reconnect |
| Ref slot reservation |60s from confirmed Ref disconnect; match auto-paused | During reservation old Ref can reconnect; replacement allowed after60s |
| Ref absence recovery | Absolute5min from first disconnect; reconnect flapping does not reset it while absence unresolved | Expires even if current/manual pause has a longer allowance → ABORTED neutral |
| Deliberate Referee stop allowance (manual AND Bot custom modes) |10min each continuous referee pause, total30min/match | Includes the resumed preparation time while game frozen; no reset by duplicate Stop/reconnect/replacement. At either expiry neutral abort, never Resume. |
| Manual Player disconnect | Existing SRS30s wall-clock grace, independent of referee pause; gameplay clocks frozen | SRS NET-REC005: single missing player forfeits with DISCONNECT_TIMEOUT; both expired → ABORTED. No grace reset via Ref Stop/Resume. If both absent, resolve the bounded remaining player grace before selecting forfeit versus both-expired abort. |
| Started Bot owner UI disconnect | Does not start manual-player forfeiture timer | Autonomous bot execution continues while infrastructure permits; match principal/strategy ownership remains pinned |
| Infrastructure recovery | Bounded policy defined in R3/R4, no author penalty | Cannot indefinitely extend all other independent room safety deadlines |

Warnings before manual expiry at60s/10s remaining; copy describes neutral cancellation, not imminent player loss. Completed game result wins over later deadline callback. Automated callback checks current matchId/epoch/status before changing state.

**Named R4 baseline defect:** current MatchManager does not freeze clocks during player grace and always aborts neutrally on disconnect expiry. This conflicts with SRS TIMER005/NET-REC001–005. R4 must fix/test canonical single-player forfeit versus both-expired neutral abort, including Ref pause composition. Do not call the current implementation the correct product rule. The earliest applicable terminal deadline wins; Ref slot60s is a reservation boundary, not a terminal or auto-resume event.

If both manual players are disconnected with different grace deadlines, first expiry remains pending while the other bounded grace resolves: opponent reconnects within their grace → missing expired player forfeits; opponent also expires → neutral abort. A principal whose own grace expired cannot restore late. Test staggered deadlines, not only simultaneous disconnection. Ref Resume cannot renew either deadline.

Replacement: nomination only while paused; both pinned player principals consent; replacement logged account accepts, cannot be one of players. Atomic transfer revokes old Ref endpoints and open control stream. Old Ref may receive public access only via a separate allowed spectator grant; disabled spectators does not block the valid new Ref. Consent is scoped to proposed account/current match/epoch and expires with recovery deadline.

### 3.4 Guest identity and compatibility

- Generate pronounceable/random Vietnamese-safe display name once, persist opaque Guest credential locally/server session, share across tabs via storage channel. Name is not authentication; browser-supplied identity cannot impersonate account or another Guest.
- Account vs Guest permission is explicit server principal type; account Ranked/Elo/social durability only. Guest can normal queue/create/join/watch/manual/Bot ordinary modes; no Ref.
- Pin participating principal for the duration of a match. Mid-match login does not steal source ownership or allow another active match. After completion, optional local data import is previewed/deduplicated; private Python upload requires separate consent.
- Remove Guest Arena from Home and new mode selection. Keep legacy `/guest` entry and `/guest/play` data/URL compatibility as Guest onboarding/manual Offline redirect, not a duplicate new mode. Import old GUEST sessions/history as manual Offline2P; no data deletion merely due rename.

### 3.5 Python SDK/revision contract

| Item | Required contract |
|---|---|
| Upload | Single UTF-8 `.py`; finite byte quota, parse/SDK validation and bounded isolated test before Ready. Never eval source in Node. |
| Entry | `choose_move(state, memory)`; versioned JSON-compatible state with canonical coordinates, own side, public board/legal moves/turn/clock/history; returns one legal move plus JSON memory. |
| Memory | Owner-only finite serialized bytes/depth; persists same revision. Reset new revision by default; explicit preserve only declared compatible schema. |
| Revision | Immutable source digest/owner/sdkVersion/schema/status. Active turn pins revision+seed. One latest valid pending; rejected candidate does not replace active/pending. |
| Limits | Equal visible preset before Ready: source/memory/output/log/upload/preflight/per-turn/whole-game limits. Single admission initially. Rate-limit rejection preserves existing data. |
| Errors | Active exception/illegal result/own compute breach → immediate loss; rejected new file leaves active unchanged. Infrastructure/referee cancellation not author error. |
| Privacy | Opponent/ref/spec sees public name/revision/think state/moves, not source/memory/private log. Download/export owner authorization. |
| Retention | Library owner-managed; match temp source30d, log7d; live memory removed at terminal, including later recovery checkpoint cleanup. Access denied at expiry even if deletion job delayed. Replay public moves remains usable. |

Retention anchors: temporary match sources are protected while the match is active and expire30days from terminal `endedAt`; private log entries expire7days from creation. Account Library retention is independent. Terminal memory/checkpoint-private-memory removal is immediate at logical access level, then garbage-collected; no later recovery reads it. R3/R4 manifest records these anchors; do not expire the active pinned source mid-match.

R3 must freeze **numeric** SDK limits and measured preset in a checked-in manifest before R9/R10 implementation sign-off. They are engineering feasibility outputs, not unspecified product choices delegated to UI agents. Do not fabricate a performance pass or silently lower scope when free hardware cannot satisfy the gate.

### 3.6 Winner at Bot limits

Only valid Bot matches use this new adjudication; manual OTT outcomes unchanged. At finite limit, finish a complete Blue/Red round within bounded per-turn allowance. Normal victory and author fault win immediately; infrastructure failure is neutral, never RED tiebreak.

| Criterion | Exact definition |
|---|---|
| N | Remaining own pieces; ROCK/PAPER/SCISSORS all value1 |
| P | `8 - min(Chebyshev distance of own piece to enemy goal)`; ignores blockers; BLUE enemy goalI9, RED enemy goalA1. Extinction already terminal before this comparison. |
| M | Number of distinct legal `(from,to)` pairs as if that side had the turn, using canonical engine. No friendly/same-type/countercapture/out-of-board moves. |
| Ordering | Lexicographic N, then P, then M; not weighted sum |
| Exact tie | RED, the second mover, wins by explicitly published priority rule. Do not present this as proof of superior intelligence or established balance. |

R3 fixtures include mirror boards, equal tuples, single criterion differences, goals, extinction, full-round boundary and both side assignments. Result/Replay show the criterion values and reason; no human Elo awarded.

### 3.7 Free-only runtime gates

Proposed Online candidate: trusted Node scheduler + separate trusted Wasmtime supervisor running isolated CPython-WASI per turn, no unrestricted native Python subprocess or Docker-in-Docker. Pin build/stdlib/assets/licenses. No network/secrets/application mounts; minimal readonly stdlib/own source; bounded fuel/epoch/memory/table/instance/stack/I/O plus outside watchdog for host calls. Server validates and commits output.

This is a **candidate, not proven runtime**. Before production code execution R3 must demonstrate syntax+SDK compatibility, deterministic seeds/allowlist, infinite loop/OOM/sleep/output flood/path traversal/network/secrets isolation, cancellation, kill/reclaim, same budget fairness, resource admission and normal API headroom on actual free-class hardware. Provider current terms/availability must be reverified. If the gate fails, report evidence and seek an architecture decision; no paid fallback or fake Bot production success.

Offline candidate: Pyodide with worker in a credential-free isolated compartment and narrow JSON bridge. Same-origin Worker alone is NOT a security sandbox: network/storage must be denied and renderer credentials/source outside the intended payload unreachable. Pin compiler/runtime/SDK, limit message/output/memory values, watchdog terminate. Browser environment has no server-equivalent hard resource guarantees; explain accurately. Full offline cache includes app shell, lazy routes, fonts, images, templates and runtime; test cold launch with network fully disabled after warm-up.

Free Render service can sleep/restart and use ephemeral disk. Durable database/provider selection and quotas must be checked, backup/restore tested in a disposable environment. No shared/production migration until approved. Existing free Postgres/provider limits cannot be assumed permanent. Unit mocks cannot prove durability on restart.

Research anchors (verify again during R3): [Render Free](https://render.com/docs/free), [Render Docker](https://render.com/docs/docker), [Wasmtime security](https://docs.wasmtime.dev/security.html), [interrupting Wasm](https://docs.wasmtime.dev/examples-interrupting-wasm.html), [CPython WASI](https://devguide.python.org/getting-started/setup-building/#wasi), [Pyodide Worker](https://pyodide.org/en/stable/usage/webworker.html), [Pyodide deployment](https://pyodide.org/en/stable/usage/downloading-and-deploying.html).

## 4. Page-by-page implementation tasks

Every row also inherits Section5 state matrix and accessibility/permission rules. “UI ready” cannot substitute for its backend dependency.

### 4.1 Homepage / Room Browser

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| HOME-01 | Compact OTT v2 header, profile/account or persistent Guest identity; requested greeting; original Robot host illustration and short slogan | No deleted status/copy; content unclipped in both themes; R6 |
| HOME-02 | Main Online TÌM TRẬN, compact Đấu thường/Xếp hạng selection, remembered valid choice; Guest login hint only for Ranked | No Guest normal gate; normal/ranked separate queues; R2/R6 |
| HOME-03 | Chơi trực tiếp cards: Tập luyện, Offline2P; Đấu chương trình cards: Online, Offline, Thư viện/Workbench entry;3→2→1 grid | Title most prominent, one sentence, tactile block; no Guest Arena card; R6 |
| HOME-04 | Four room cards2×2, public mode/ID/player/ref/spec metadata. Xem tất cả opens `/phong-online`: full room grid3→2→1, room-ID search, All/Manual/Bot mode filter, Tạo phòng, explicit load-more/loading/empty/error. Page scroll, not a clipped Home internal list. Private rooms found only via permitted exact code/access flow. | Stable ordering while interacting, capacity+private ACL not UI-only; R6/R7; root owns route integration |
| HOME-05 | Friends preview with readable Tất cả/Tìm người chơi and Thêm bạn để CHAN!; Guest room-link path | Private presence respects account policy; R6/R12 |
| HOME-06 | Active match Resume card; actionable outage banner only if affected | No false online health, no second conflicting game; R4/R6 |

### 4.2 Queue / Match Found

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| QUEUE-01 | Searching → Cancelling → acknowledged Cancelled/Home; retry/error; matched-vs-cancel outcome | Sequence/generation/races, duplicate cancel blocked; R1 |
| QUEUE-02 | Back/Home/intentional route exit cancels active search; transient connection loss resyncs | No silently orphaned queue; committed match opens correct room; R1/R7 |
| QUEUE-03 | Robot Lab clear search stage, compact useful elapsed/rating only when relevant; Bot capacity wait distinct from opponent wait | Guest/no Elo not fake rating; no excess radar/glitch; R7 |
| QUEUE-04 | Public matched opponent/name/side and3s server countdown; Ready gate still enforced | No repeated VS after reconnect/no phantom start; R7 |

### 4.3 Custom room creation / Waiting Room

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| ROOM-01 | Mode/manual-Bot, public/private/password, preset, independent Ref/Spec toggles, spectator capacity; role choice if Ref-enabled | Four toggle combinations; Ref enabled+Spec disabled valid; R4/R7 |
| ROOM-02 | Two player slots plus separate single Ref slot and spectator row; role-tagged invite/code/copy | Ref host has two empty player slots; no arbitrary third player; R7 |
| ROOM-03 | Ref invite accept/decline/expiry/presence; host only management flag | API denies self-elevation, Guest Ref, Player+Ref; R4/R7 |
| ROOM-04 | Two Ready+valid Bot+capacity+Ref presence gate; Ref Bắt đầu, no FastReady bypass | Missing/leave resets gates; no-Ref normal twoReady path; R4/R7 |
| ROOM-05 | Config locks at countdown; room full/password/offline/errors; pregame60s reservation | Race final slot/role grant, idempotent invite/start; R4/R7 |

### 4.4 Online manual Game / Referee

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| GAME-01 | Ceramic board, fixed own-side below/HUD, clear turn/clock/move rail; minimal header/mobile drawer | A1/I9 occupancy/canonical mapping/keyboard; R5/R8 |
| GAME-02 | Distinct select/legal/capture/blocked states, bounded mechanical slide/impact, no idle breathing/ring loops | Semantic accepted events only; Reduced/Low static; R5/R8 |
| REF-01 | Ref screen canonical Blue below; public event rail+Start/Stop controls, no private strategy fields | Direct API permission tests for all roles; R4/R8 |
| REF-02 | Centered Trận đấu đã dừng, Ref/reason, elapsed; compact Resume only for Ref; all other roles wait | Nondismissible/focus-safe, clock frozen,≥44px Resume; R8 |
| REF-03 |3s Resume preparation and Giữ dừng, reconnect/resync paused, finite recovery/replacement consent | No auto-resume or clearing unrelated reasons; R4/R8 |
| REF-04 | Group reason options Sự cố kỹ thuật / Thắc mắc luật / Lý do khác; no private incident detail needed | Escaped public labels; audit stores accepted actor/time/duration; R4/R8 |

### 4.5 Workbench / Private Library

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| BOTLIB-01 | Left private bot/revision list; center Upload/Dùng bot mẫu; right test/legal preview/private log; mobile tabs/sections | Empty/uploading/validating/invalid/ready/testing/pass/fail/storage errors; R9 |
| BOTLIB-02 | Read-only source, download/export/delete; SDK docs and copyable template, use Online/Offline | No integrated IDE; owner ACL, no opponent/ref source leak; R4/R9 |
| BOTLIB-03 | Immutable version digest/SDK/schema, active/pending labels, explicit reset/preserve compatible memory | Duplicate/out-of-order requests cannot overwrite confirmed newer version; R4/R9 |
| BOTLIB-04 | Quotas/expiry/delete-active-reference warnings; candidate failure/Library save vs match application explicit | No source auto-upload at login; source retention access denies on expiry; R4/R9 |

### 4.6 Bot Online preparation / Match

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| BOTON-01 | Choose valid bot/revision+mandatory test → queue or create/join →2Ready → start/countdown | No invalid Ready; separate unranked queue, free capacity admission; R10 |
| BOTON-02 | Read-only board and fixed own HUD; active/pending/upload/thinking panel; public moves and owner-only log tabs | Mobile drawer; no click-to-play; public events contain no private payload; R10 |
| BOTON-03 | New candidate test then latest pending next own turn; late/paused upload explicit non-application | Race pause/result/newversion/terminal/reconnect tested; R4/R10 |
| BOTON-04 | Per-turn+global cap visible, deterministic adjudication/result, Ref capability reused for custom Bot | Fuel/time fairness/no author penalty for infrastructure/ref cancellation; R3/R4/R10 |
| BOTON-05 | Tab leave/Home Resume without implicit surrender; durable checkpoint bounded recovery | Restart crash-window fencing and no duplicate moves; not in-memory mock evidence; R4/R10 |

### 4.7 AI / Offline2P / Bot Offline / Guest compatibility

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| LOCAL-01 | Unified Guest identity and same manual mode choices, compatibility redirect/import old Guest Arena | No duplicate new game mode or loss of old local data; R2/R11 |
| LOCAL-02 | AI/Offline2P same Robot board/clock/result, fixed canonical view; handoff identifies next side without rotation | No fake server/reconnect, local clock/storage recovery; R11 |
| LOCAL-03 | Bot Blue/Red independent file/sample/test/Ready slots; Run/Pause/Step/Speed observation controls | Pause safe boundary/Step exactly1 turn; visible distinction from immediate Online Ref Stop; R11 |
| LOCAL-04 | Local board/revision/memory checkpoint; restore paused; export/clear/quota recovery | No automatic restart/server fallback; SDK/revision pinned across runtime update; R11 |
| LOCAL-05 | Download Offline kit, progress/readiness/version/update controls; missing/evicted cache guidance | Cold launch and lazy-route navigation network disabled; private data not broadly cached; R3/R11 |

### 4.8 Friends / Invitations

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| FRIEND-01 | Bạn bè / Lời mời nhận / Đã gửi / Tìm người chơi; large name/avatar, readable presence+actions | Contrast/name dominance and stale realtime handling; R12 |
| FRIEND-02 | Invite Manual/Bot room and role-specific Ref invite when host permitted; expiry/accept/reject states | Does not bypass Bot validity/Ref acceptance/Ready or role/password ACL; R4/R12 |
| FRIEND-03 | Guest invitation by room code/link; explain account-only durable friends | No fake persisted friend account for Guest; R2/R12 |
| FRIEND-04 | Accessible more/block menu, consequences consistent Profile; state-appropriate empty robot small | Keyboard/focus restore/privacy/block-policy; R12 |

### 4.9 History / Replay / Audit download

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| HIST-01 | Account/local source badge; filters All/manualOnline/AI/manualOffline/BotOnline/BotOffline/result/Ranked | Deduplicated imports; neutral abort not shown as loss; R13 |
| HIST-02 | Read-only canonical thumbnail/detail; actual moves Play/Pause/Step; Bot revision timeline and Ref pause timeline | New replay uses persisted moves; old history clear final-board-only fallback; R4/R13 |
| HIST-03 | Cap result N/P/M values+RED tie rule, author-fault vs infrastructure/ref expiry distinctions | Winner agrees engine; no fabricated skill assessment; R3/R13 |
| HIST-04 | Download public match audit; private logs only owner inside retention | No source/memory/private diagnose in JSON/export; expired source does not break replay; R13 |

### 4.10 Self/Public Profile

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| PROF-01 | Avatar/identity dominant; manual Elo/rank stats separate Bot unranked stats, recent matches | Bot never changes human Elo; no rank for Guest; R14 |
| PROF-02 | Self edit states/dirty guard; public relationship/presence respect privacy | Public payload avoids private Library/Guest credentials; R14 |
| PROF-03 | Guest local identity/history/login; account-private Library shortcut | Mid-game login preserves original match principal; R2/R14 |

### 4.11 Settings / Diagnostics / Local data

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| SET-01 | Theme/system/effects/audio/motion preview; no neon-only assumptions | Reload persists, auto-downgrade, Low/Reduced honor all manual paths; R15 |
| SET-02 | Account/privacy/block list; Bot offline kit/runtime version/cache status; diagnostics collapsed | Technical information not Home decoration/private leak; R15 |
| SET-03 | Clear/export local data with exact list Guest identity/save/history/Library/cache; confirmation | Clear does not silently destroy unrelated authenticated cloud data; safe active-session guards; R15 |

### 4.12 Login / Register / Forgot / Recovery

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| AUTH-01 | Shared solid full wordmark and Robot Lab form shell, readable labels/pending/error/password toggle | Recovery code one-time/acknowledged, username+code recovery unchanged; R16 |
| AUTH-02 | Safe in-app return URL and preserve bot draft; selected local import after login | No open redirect, auto source upload/queue/Ready/start; ongoing Guest principal pinned; R2/R16 |
| AUTH-03 | Guest normal-play route retained without login wall; account-needed actions clear | Error/outage/retry/mobile/keyboard/privacy evidence; R16 |

### 4.13 Spectator / Not Found / Error boundary

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| SPEC-01 | Canonical Blue-bottom public manual/Bot board and moves/revisions/thinking; no selection | Role revocation closes existing streams; no source/memory/logs; R1/R4/R17 |
| SPEC-02 | Pause/resume overlay, elapsed/reconnect/result, Rời phòng usable while paused | Spectators disabled still permits valid Ref; no Resume for spec; R17 |
| FALL-01 | Robot Lab404/recoverable/fatal error with safe next action, no stack/false connection health | Offline kit missing vs server unreachable distinct; R17 |

### 4.14 Results / Rematch

| ID | Task / visible output | Acceptance / owner Wave |
|---|---|---|
| RESULT-01 | Clear win/loss, neutral aborted, reason and compact stats; one event-based Robot Lab celebration | Not same full Neon firework design; Reduced/Low static, no false winner; R18 |
| RESULT-02 | Ranked-only Elo; Bot N/P/M cap/fault reason; pause duration excluded from active duration | Public audit and History agree canonical result; R18 |
| RESULT-03 | Explicit rematch Ready flow, swap sides, Bot last active revisions/reset memory; valid Ref approval still required | Pending/late uploads do not autostart next game; new match fencing; R18 |

## 5. Mandatory state matrix for every page

Record applicability explicitly, not “N/A” to avoid missing behavior:

- Actor: account Player BLUE/RED, Guest Player, Ref, account/Guest Spec, Host capability, denied outsider, blocked/private/expired session.
- Entry: direct URL/alias/navigation/reload/reconnect/auth return/import.
- State: loading/empty/ready/pending/error/retry/offline/degraded/stale/resync/terminal; pause/resuming wherever match visible.
- Permissions: UI hides/disables controls AND server rejects direct forbidden API calls. Open-stream revocation exercised, not only initial auth.
- Theme: Light/Dark/System; hover/focus/pressed/disabled contrast; identity motif without color.
- Viewport:320,375,768tablet,1366desktop,1920wide; mobile portrait+landscape/safe areas. No hidden action under bottom nav/drawer.
- Accessibility: native inputs/labels/error associations/focus trap+restore/keyboard/board roving navigation/screen-reader semantics; no every-second noisy elapsed announcements.
- Motion/audio: Normal/Reduced/Low, hidden tab pause/cleanup/no duplicated replayed SFX; no clock/input delay.
- Exit: intent vs transient disconnect, queue cancellation ack, local dirty/data save, started Bot continues under approved infrastructure limitations.
- Evidence: tests/assertions/screenshots/traces, real-device outcomes or NOT RUN; source-before/after, files changed, exact commands, reviewer verdict.

## 6. Ordered Waves and exit gates

Tasks belong to their page Wave even when dependent backend work is centralized. Do not silently broaden an R1 repair into Guest/ref/Bot architecture.

| Order | Wave | Scope / file ownership | Dependencies | Exit gate |
|---:|---|---|---|---|
|0|R0 — Plan/Governance/Baseline|This plan, AGENTS, decision/task trace, baseline evidence|Approval|Published plan; independent BA review findings resolved; baseline recorded, not falsified|
|1|R1 — Existing Queue/Realtime defects|QueuePage+queue service/manager/routes/tests; room spectator lease+match SSE route/tests|R0 executable plan|Regression fails before fix, passes after; focused+full tests/typecheck/lint/build; no Guest/Bot coupling|
|2|R2 — Guest/duplicate-mode repair|Principal/normal-queue auth seam, Guest identity, legacy routes/storage/import, root router integration|R1|Account Ranked unchanged; Guest normal modes valid; legacy data retained; no impersonation|
|3|R3 — Bot feasibility/SDK/scorer Harness|Isolated runtime harness, versioned SDK+numeric limit manifest, N/P/M helper/tests, free resource measurements|R0; can research alongsideR1/R2|Security/compatibility/free-headroom gate; artifact/license; exact preset frozen; no fake runtime pass|
|4|R4 — Shared contract/server platform|contracts, room roles/invites, match lifecycle/scheduler/pause/epochs, durable checkpoint/replay/store, service API seams, migration SOURCE|R2 + relevantR3 gates|ACL/race/restart/timer tests; approved DB environment for migration testing; provider deployment still not authorized|
|5|R5 — Robot Lab foundation|shared tokens/UI shell/brand/assets/board/glyph/motion/audio/quality/release-style rules|R1; interface fromR4 can be fixed before full backend completion|All shared state/assets/mobile/contrast/motion tests; no remaining old art assumptions|
|6|R6 — Homepage|HomePage/Home components/RoomBrowser presentation/FriendsPreview interface|R2,R4 interfaces,R5|HOME01–06 + state matrix|
|7|R7 — Queue/Waiting Room|Queue presentation and extracted waiting/create-room modules|R1,R4,R5,R6 room-entry interface|QUEUE/ROOM outputs; Start/Ready/role gating E2E|
|8|R8 — Manual Game/Referee|GameRoom manual/ref view, Ref popup/control service UI; shared match lifecycle onlyR4 owner|R4,R5,R7|GAME/REF outputs; pause/move/timeout/reconnect/replace matrix|
|9|R9 — Workbench/Library|new Workbench/Library routes/components/private API client|R3,R4,R5|BOTLIB outputs; actual preflight/private SDK usage, not fixture-only production|
|10|R10 — Bot Online|Bot setup/queue/game observer+strategy panels|R3,R4,R7,R8,R9|BOTON outputs incl real isolated execution, revision races and durable recovery|
|11|R11 — AI/Offline/Bot Offline|LocalGame/Guest compatibility, isolated browser runner/full offline kit/controller/storage|R2,R3,R5,R9|LOCAL outputs; full network-disabled cold-start, actual bot turns and paused restore|
|12|R12 — Friends/Invitations|Friends page/social components, role-mode invitation UI|R2,R4,R5,R7 API/interface|FRIEND outputs; privacy/invite expiry/access|
|13|R13 — History/Replay|History page/thumbnail/replay+public audit client|R3,R4,R5; event schemas frozen|HIST outputs; real persisted replay, legacy fallback and retention|
|14|R14 — Profiles|Profile page/profile components/public-account vs Guest views|R2,R4,R5,R12 relationship interface|PROF outputs; no private Library/public leakage|
|15|R15 — Settings|Settings/preferences/diagnostics/cache/local-data controls|R2,R3,R4,R5,R11 actual cache service|SET outputs; actual cache lifecycle/delete guards|
|16|R16 — Auth|Auth pages/forms/return/draft/import presentation|R2,R4,R5|AUTH outputs; recovery regression/mid-game principal pin|
|17|R17 — Spectator/Fallback|Spectator page/NotFound/ErrorBoundary/public match consumer|R1,R4,R5; match pause schema|SPEC/FALL outputs; no private data/action privileges|
|18|R18 — Result/Rematch|ResultPanel/result services/round-boundary integration|R3,R4,R8,R10,R11,R13|RESULT outputs, every reason+both side perspectives, explicit rematch|
|19|R19 — Cross-page QA/cleanup|E2E/axe/visual/performance/browser compatibility/dead-code audit|R6–R18|No regression/P0/P1; real evidence; cleanup traced to consumers|
|20|R20 — Final acceptance|Traceability/evidence/review/release report|R19 + runtime/storage/device evidence|Every accepted item PASS; independent final BA/QA; missing evidence prevents100%|

R4 implementation may prepare PostgreSQL migration source but must not execute it against the existing DATABASE_URL without identifying and approving target. If a shared/production change is necessary, stop only that dependency, report its exact migration/backup plan and request approval; continue independent safe local work.

### 6.1 Fastest parallel execution batches

| Batch | Parallel work | Start requirement / serialization |
|---|---|---|
|A|R1-Queue + R1-Spectator revocation; R3 research/harness design|R0 plan saved; disjoint owned files. No promiseR3 gate is already passed.|
|B|R2 Guest functional repair + R3 measured runtime/scorer; R5 asset/token work|R1 verified. Root ownsrouter/contracts; agree R4 interfaces before page code.|
|C|R4 backend platform + finishR5 isolated presentation|R2 principal+R3 SDK/security decisions frozen. One lifecycle/contract writer; no page worker edits thosefiles.|
|D|R6 Home + R9 Workbench + R12 Friends + R13 History + R14 Profile + R16 Auth + R17 Spectator/Fallback|Their dependencies/real API contracts ready. R12↔R14 relationship UI interface fixed; R13↔R17 public event interface fixed. Root integrates routes/services after workers finish. R15 presentation may be prototyped but not implemented/sign-off with fake cache data.|
|E|R7 Queue/Waiting + R11 Local/Offline|R6 creation interface+R9 validated version service ready. R11 uses shared board without editing R5 source in parallel.|
|F|R8 Manual/Referee + R15 Settings; separately completed-page review|R7+server control ready; R11 actual cache API ready forR15. R8 owns GameRoom extraction; no Bot worker editing samefile.|
|G|R10 Bot Online + R18 isolated Result UI tests/components|R8 and all real Bot gates ready; R18 lifecycle/rematch integration waitsR10/R11/R13.|
|H|R18 integration → R19 → R20|Sequential acceptance; no “allDONE” before integration evidence.|

Number of windows is not permission to share file ownership. A worker with a blocked dependency must not ship mocked success. Parallel table is an execution graph, not a claim that Waves can run from the current baseline without prerequisites.

### 6.2 Shared file integration rules

| Shared resource | Exclusive owner / rule |
|---|---|
| contracts/index/schema files | R4 platform integrator; R3 contributes SDK/scorer module via agreed boundary |
| match.manager/room.manager/match routes | R4 lifecycle owner after R1 revocation hotfix accepted; no simultaneous page writes |
| router/routes/AppLayout/auth context | Root integration; page workers add self-contained modules and request route registration |
| global CSS/tokens/brand/GameBoard/PieceGlyph | R5 owner; per-page styles scoped outside global source |
| Prisma schema/migrations/generated client | Platform owner; no automatic shared DB mutation |
| auth/Guest principal lifecycle | R2 owner, R4 role APIs consume it; do not duplicate guest logic in pages |
| SDK/limit manifest/scorer | R3 owner, immutable versioned inputs consumed byOnline/Offline/UI |
| offline cache/controller/storage | R11 owner; Settings uses exposed safe service, not direct cache deletion |
| history persistence/public replay/private logs | R4 store owner; R13/R17 clients consume separate schemas |
| release scripts/tests shared fixtures | Root QA integration; update old neon-only acceptance to explicit Robot Lab decision, not weaken actual behavior tests |

Worker prompt pattern: “Read AGENTS.md and docs/implementation_plan_ott_v0.2_robot_lab.md; execute R… only when its dependencies pass; declare owned files; run Harness→Dev→Test→Review→Clean; report evidence; no push/deploy/DB migration.”

Prepared documentation, statically typed interfaces or a mock UI are not DONE for a Wave that requires a real dependency. Fresh local disposable Harness database creation/testing is a normal approved implementation step when its URL/identity are explicit and verified disposable. Existing local/shared/production database targets and migration of data still need separate approval.

## 7. Harness and verification strategy

### 7.1 R1 regression set

- Search ticks then MATCH_FOUND: both participants' sequence increases; frontend accepts terminal event after ticks, ignores stale/duplicate/other queue generation events.
- Cancel success, repeated Cancel, Cancel vs committed match, failed cancel/recovery, pending join+exit, deliberate route exit and effect cleanup/remount; no hidden orphan queue or involuntary surrender.
- Temporary SSE disconnect/resync does not itself imply deliberate queue exit; account session/queue identity accurately retained.
- Spectator explicit leave closes every existing stream for that user in that room, blocks subsequent sends/ticks; room deletion and Spec→Player transition revoke lease; another room/user unaffected. R1 preserves existing reconnect lease behavior on transport close and metrics cleanup runs once. This hotfix is not sign-off against SRS SPEC004/NET-REC006: R4 must reconcile prompt disconnect presence/slot release and explicit rejoin, without introducing an unlimited spectator reservation.
- R1 role revocation is not a claim that account logout/session expiry stream revocation is solved. R4 must connect auth session lifecycle/expiry to active stream authorization without per-event DB lastUsedAt writes.
- SSE origin configuration must not hardcode localhost for arbitrary deployment origins; test normal CORS policy rather than allowing `*` with credentials.

### 7.2 Required platform/security tests

- All4 Ref/Spec toggle combinations,2players+1ref+capacity, Guest refusals, illegal simultaneous roles, private password notrolegrant, appointment invitation expiry/single use/concurrent claim.
- NoFastReady, outsider/Spec/Player/Host-only direct Stop/Resume/Start denied; formerRef loses controls and live stream privilege.
- Pause vs legal move, timeout, result, upload, revision activation and late compute output; epoch fences; duplicate commands idempotent; old match control cannot affect rematch.
-10min/30min vs60s/5min timer precedence; reconnect flapping/replacement/duplicate Stop cannot renew safety deadlines; pauses excluded from game budgets; no auto-resume on recovery.
- Crash after compute/before commit/after commit/before broadcast; committed move+memory consistency; cannot doubleplay or leak private logs to public listeners.
- Active author fault distinct from infrastructure/referee cancellation; no fake default move when sandbox fails.
- Retention/quota/export/delete ownership, access expires before GC, replay independent of expired sources.

### 7.3 Test commands and safe boundaries

| Purpose | Existing command |
|---|---|
| Workspace unit/contracts/integration | `corepack pnpm test` |
| Server tests | `corepack pnpm --filter @ottv2/server test` |
| Web tests | `corepack pnpm --filter @ottv2/web test` |
| Full typecheck | `corepack pnpm typecheck` |
| Lint | `corepack pnpm lint` |
| Production build | `corepack pnpm build` |
| Browser E2E | `corepack pnpm test:e2e` |
| Release static gate | `corepack pnpm release:gate` |

**Safe baseline:** `corepack pnpm test:unit`, `corepack pnpm test:contract`, `corepack pnpm --filter @ottv2/server test test/unit`, and web tests. The full server test command above includes `test/integration/auth.integration.test.ts`, which loads `.env` and creates/deletes accounts: NEVER run it against the default unverified DATABASE_URL. First add/use explicit disposable TEST_DATABASE_URL/preflight protection and verify target; integration evidence otherwise remains NOT RUN. Root health integration uses an injected database stub and can be run by exact file when approved; broad integration commands are not presumed safe.

Use the installed package manager/runtime version; record environment failures honestly. A skipped integration test is not PASS. Do not run production smoke scripts against an external URL or DB mutating test without scoped authorization. New tests should be deterministic/fake-timer/in-memory where appropriate, plus real runtime/restart/cache evidence at relevant gates. SPA route/back blocking can await Cancel acknowledgment; browser hard reload/close cannot guarantee an awaited network request and requires an explicit server lease/cleanup policy, not an invented guarantee from a UI blocker.

### 7.4 Per-Wave report format

1. Wave/task IDs and exact scope.
2. Files changed and source-before/after behavior.
3. Harness reproduction before fix and passing evidence after fix.
4. State/actor/theme/viewport coverage, visual screenshots when visible output changed.
5. Commands and outcomes, including failures/skips/NOT RUN.
6. Contract/runtime/database dependencies and unmet gates.
7. Independent reviewer findings and disposition; unavailable reviewer remains NOT RUN.
8. Removed obsolete code/assets and preserved legacy data/URLs.
9. Status: DONE/IN PROGRESS/BLOCKED and safe next Wave.

## 8. Completion and tracking

| Wave | Initial status | Evidence |
|---|---|---|
|R0|DONE|Plan and AGENTS saved; independent BA artifact review PASS with no P0/P1; safe baseline recorded; approval interpretation disclosed|
|R1|DONE|Queue/Spectator implementation, focused regressions, full safe gates, browser smoke and independent final review PASS; broad auth/database integration remains explicitly outside R1|
|R2|DONE|Guest principal/duplicate-mode repair, focused server/web/contract/browser evidence, atomic cross-tab lock and independent BA/security review PASS|
|R3|DONE|SDK/state/scorer harness and frozen numeric protocol pass; Wasmtime/CPython-WASI and Pyodide probes pass with readonly/sentinel, per-turn reset, whole-match, single-admission, cross-origin fixtures, local four-guest API-under-load capacity and public license evidence; Render Free `/diagnostics/r3/provider` returns HTTP 200 `PROVEN` on Linux x64 with all checks and four-fixture admission scheduler passing. Production Bot runner/commit/restart integration remains R9/R10/R11 scope and is not claimed here|
|R4|DONE|R4 platform contracts/roles/ACL, corrected disconnect+pause rules, central scheduler, atomic FileMatchPersistence with process restart probe, session revocation and source-only migration are evidenced in `docs/r4-platform-evidence.md`. R8/R10/R11/R13/R17 own later UI/Bot/replay boundaries|
|R5|DONE|Robot Lab shared tokens, shell, original brand/glyph assets, board presentation, motion/quality policy and release-style rules are evidenced in `docs/r5-foundation-evidence.md`; page-specific Waves and device QA remain open|
|R6|DONE|Homepage / Room Browser / Friends Preview evidence in §8.6|
|R7|DONE|Queue / Waiting Room evidence in [`docs/r7-queue-waiting-evidence.md`](./r7-queue-waiting-evidence.md); root DB-touching build and independent review remain explicitly bounded|
|R8|DONE|Manual Game / Referee evidence in [`docs/r8-manual-referee-evidence.md`](./r8-manual-referee-evidence.md); physical devices, independent review and broad R19/R20 release gates remain bounded|
|R9|DONE|Workbench / Private Bot Library evidence in [`docs/r9-workbench-library-evidence.md`](./r9-workbench-library-evidence.md); Bot Online/Offline runtime remains R10/R11|
|R10|DONE|Bot Online preparation, separate unranked Bot queue, read-only observer/strategy rail, revision fencing, pinned Wasmtime/CPython-WASI execution, private checkpoint persistence, two-process restart fencing and fail-closed cancellation are evidenced in [`docs/r10-bot-online-evidence.md`](./r10-bot-online-evidence.md). Browser/device visual matrix and independent final BA/QA remain R19/R20 gates.|
|R11|DONE|AI/Offline/Guest compatibility and Bot Offline evidence in [`docs/r11-bot-offline-evidence.md`](./r11-bot-offline-evidence.md); physical-device and independent final review remain R19/R20 gates|
|R12|DONE|Friends/invitations evidence in [`docs/r12-friends-invitations-evidence.md`](./r12-friends-invitations-evidence.md); independent review, physical devices and R19/R20 release matrix remain bounded|
|R13|DONE|History/Replay/Audit evidence in [`docs/r13-history-replay-evidence.md`](./r13-history-replay-evidence.md); independent review, physical devices and R19/R20 release matrix remain bounded|
|R14|DONE|Profiles evidence in [`docs/r14-profile-evidence.md`](./r14-profile-evidence.md)|
|R15|DONE|Settings/local data evidence in [`docs/r15-settings-evidence.md`](./r15-settings-evidence.md)|
|R16|DONE|Auth/Guest boundary evidence in [`docs/r16-auth-evidence.md`](./r16-auth-evidence.md)|
|R17|DONE|Spectator/public timeline/error fallback evidence in [`docs/r17-spectator-fallback-evidence.md`](./r17-spectator-fallback-evidence.md)|
|R18|DONE|Result/Rematch evidence in [`docs/r18-result-rematch-evidence.md`](./r18-result-rematch-evidence.md); R19/R20 device, independent review and final release gates remain open|
|R19|DONE|Cross-page QA/cleanup evidence in [`docs/r19-cross-page-qa-evidence.md`](./r19-cross-page-qa-evidence.md): representative 30/30 and full 43/43 browser E2E, 320–1920 viewport matrix, axe zero serious/critical violations, web 40/123, server 128 pass with 3 explicit runtime skips, typecheck/lint/build/provider gates pass. Physical devices, screenshots/CWV and independent final BA/QA remain R20 gates|
|R20|BLOCKED|Desktop implementation/local gates and the deterministic 1440×900 baseline pass; the user explicitly waived physical Chrome Android/Safari iOS checks. Independent BA/QA, approved screenshot comparison and release-grade CWV artifacts remain open; no push is authorized until the remaining gates pass|

**R20 scope amendment (2026-10-04):** The user waived physical Chrome Android and Safari iOS testing for this execution and requested desktop-first acceptance. The waiver is recorded as `WAIVED_BY_USER`, not as a device-test pass; it does not waive independent final review, approved visual comparison or release-grade performance evidence.

### 8.1 R1 execution report — Existing Queue/Realtime defects

**Scope:** ranked Queue cancellation/navigation/reconciliation, spectator stream revocation and SSE CORS/cleanup, plus the data-router prerequisite for an authoritative SPA navigation blocker. No Guest, Bot, Referee, database migration or deployment work was included.

**Changed files:** `apps/server/src/modules/matchmaking/matchmaking.manager.ts`, `apps/server/src/modules/matchmaking/matchmaking.route.ts`, `apps/server/src/modules/match/match.route.ts`, `apps/server/src/modules/room/room.manager.ts`, their focused server tests, `apps/web/src/pages/QueuePage.tsx`, `apps/web/src/pages/queueState.ts`, `apps/web/src/services/matchmaking/matchmakingApi.ts`, `apps/web/src/services/matchmaking/queueAdmission.ts`, focused web tests, `apps/web/src/app/App.tsx`, `apps/web/src/app/App.test.tsx`, and `tests/e2e/r1-queue-recovery.spec.ts`.

**Before → after harness evidence:**

- Spectator regression before the fix: 14 failing / 1 passing. After the fix: 19/19 focused authorization/cleanup tests pass.
- Queue reducer/exit/reconnect harnesses were red before the fix. After the fix: 12 QueuePage cases pass, including server-ACK cancellation, failed cancellation recovery, matched-vs-cancel, foreign generation, stale sequence, StrictMode admission and transient resync. The server race harness is 9/9 focused manager/route tests, including completed-request SSE delivery, delayed commit reservation, create-room failure tombstone, and post-room lock rollback.
- Browser R1 harness: 2/2 pass. The existing frontend smoke suite: 23/23 pass; combined browser run: 25/25 pass. The browser tests use mocked API responses and therefore do not prove production server/database behavior.

**Automated gate evidence:** server unit 13 files / 63 tests PASS; web unit 21 files / 67 tests PASS; workspace unit 9 files / 49 tests PASS; contracts 4 files / 9 tests PASS; workspace typecheck PASS; lint PASS; production build PASS. Browser smoke + R1 Queue regression: 25/25 PASS, including native `page.goBack()` after SPA navigation. The build emitted existing Rollup/Zod annotation warnings only. `git diff --check` PASS with only line-ending normalization warnings.

**Behavior now enforced:** Queue Back/in-app exit waits for authoritative cancellation and does not hide a failed cancellation; one admission survives StrictMode/remount; stale/foreign queue events are ignored and reconnect resyncs from the server; matched queues are not cancelled as if still queued; spectator leave, room deletion and Spectator→Player transition revoke all same-actor streams; every spectator event/tick rechecks authorization; SSE uses configured CORS instead of a hard-coded localhost origin; stream cleanup and timers are idempotent.

**Independent review:** final read-only BA/security review PASS with no P0/P1/P2 remaining in the Queue/Spectator scope. Reviewer confirmed reservation generation fencing, deferred commit failure tombstones/events, partial-lock rollback, SSE request-complete/response-close cleanup and real browser Back coverage. Review did not rerun commands; the PASS counts above are the recorded execution evidence.

**Known boundary:** the temporary SSE transport-close lease behavior is intentionally preserved for R1 and is not SRS SPEC004/NET-REC006 sign-off. Auth logout/session expiry revocation, scheduler centralization, prompt disconnect slot release/rejoin policy, durable restart recovery, broad auth/database integration and physical-device/runtime gates remain R4 or later. The safe full server test command was not run because it includes `.env`-backed auth tests that create/delete database records; this does not block the approved R1 safe gates.

**Status:** **DONE.** Safe next Wave is R2 (Guest/duplicate-mode repair) after this R1 checkpoint; R3 research may proceed independently as described in the parallel table. R4 still owns the explicitly listed lifecycle/database boundaries.

### 8.2 R2 execution report — Guest / duplicate-mode repair

**Scope:** Guest as an unauthenticated principal for ordinary Online/custom rooms and local manual modes; Ranked remains account-only; legacy Guest routes/storage/import remain compatible without deleting old data. No Bot runtime, Referee controls, migration, push or deployment work was included.

**Harness before → after:**

- Web local-storage harness was red because a new browser profile returned no Guest profile (`null`); after the fix it creates one deterministic Vietnamese-safe label from the opaque browser-profile id and returns the same value on repeated reads (2/2).
- Home harness was red because the selectable “Guest Arena” card still existed; after the fix it is absent from the mode selection (Home 2/2).
- Server Guest principal harness covers opaque cookie session issuance, account-token precedence, invalid-Guest-cookie fallback, unique server principal IDs even for repeated client ids, custom-room admission and Ranked denial (4 tests PASS).
- Legacy browser compatibility harness covers `/guest/play → /offline` and readonly stable generated Guest name (2/2 PASS).

**Implementation:** `AuthService` now issues bounded in-memory opaque Guest sessions with explicit `principal: GUEST`; room/match routes accept account-or-Guest only for non-Ranked rooms, pin a participating Guest when an account login cookie appears, and fall back to a valid account when a stale Guest cookie is present. Matchmaking still uses account authentication unchanged. `/guest/session` sets an HttpOnly `ottv2_guest` cookie. `GuestSetupPage` is retained as onboarding only, `/guest/play` redirects to `/offline`, Home no longer exposes a duplicate Guest mode, `LocalGamePage` accepts only AI/Offline active modes, and legacy `GUEST` history/session records remain importable. A one-time migration marker copies an old Guest session to Offline2P without deleting the source. `ensureGuestSession()` is used for normal room create/join/spectate flows with Web Locks or an atomic, non-expiring IndexedDB ownership record; a competing tab waits only for the current critical section and then fails closed, never stealing an in-flight lock. Account actions continue when Guest bootstrap is unavailable and the server decides the authoritative account/Guest permission. The client cache refreshes before expiry.

**Automated evidence:** server unit 14 files / 67 tests PASS; web unit 23 files / 72 tests PASS; workspace unit/contract 13 files / 59 tests PASS; focused Guest server tests 4/4 PASS; focused Guest web/storage/lock tests 6/6 PASS; contract Guest tests 2/2 PASS; repository typecheck PASS; lint PASS; production build PASS with existing Rollup/Zod annotation warnings only; R2 browser 3/3 PASS including an actual two-page Chromium IndexedDB contention harness with Web Locks disabled; B13/B14 browser smoke 7/7 PASS; combined R2+B13+B14 browser run 10/10 PASS; `git diff --check` PASS with line-ending normalization warnings only.

**Security/compatibility boundaries:** Guest sessions are process-local and are reissued after server restart; the local name remains stable, while the server token is HttpOnly and server-generated and client id is never used to reissue a token. Ranked queue and Ranked room/match access remain account-only. Guest history import still requires an authenticated account and is deduplicated; no old local record is deleted by the route rename. Normal Online is covered here through custom room create/join/watch; a distinct ordinary matchmaking queue is not present in the current API and remains an explicit R4/R7 dependency. Browser multi-tab was exercised by a lock unit harness, not a physical multi-device test. Full auth logout/session-expiry stream revocation, durable Guest sessions across server restart, database-backed Guest history ownership, Bot/Referee runtime and real-device evidence remain R4/R9–R20 scope.

**Independent review:** final read-only BA/security review **PASS** after the IndexedDB ownership/fail-closed correction and account-action fallback. Earlier findings (clientId token reissue, stale Guest shadowing account, legacy-session resurrection, racy localStorage/CAS lease, expiry/ownership stealing) were rechecked against the final source and resolved; no remaining P0–P2 finding was reported in R2 scope.

**Status:** **DONE.** Safe next Wave is R3 (Bot feasibility/SDK/scorer harness) or the approved R4 dependency path; overall plan remains IN PROGRESS because R3–R20 are not complete. R2 does not claim ordinary matchmaking queue, durable Guest sessions, Bot runtime, Referee controls, deployment or production DB work.

### 8.3 R3 execution report — Bot feasibility / SDK / scorer harness

**Scope:** Freeze the Bot state/revision contract, static source gate, N/P/M limit adjudicator and equal numeric limits; measure the local free-only runtime prerequisites and establish the security adapter boundary. This Wave does not wire Bot execution into Online/Offline gameplay and never executes player Python in the application process or an unrestricted native subprocess.

**Changed files:** `packages/bot-sdk/package.json`, `packages/bot-sdk/tsconfig.json`, `packages/bot-sdk/src/{index,version,manifest,types,state,source-validation,scorer,runtime}.ts`, `docs/r3-bot-limit-manifest.json`, `docs/r3-runtime-feasibility.md`, `docs/r3-runtime-artifacts.json`, `docs/r3-runtime-notices.md`, `docs/licenses/{Apache-2.0,MPL-2.0,PSF-2.0,MIT}.txt`, `docs/r3-runtime-evidence.json`, `docs/robot_lab_wave_status.json`, `scripts/r3-runtime-measure.mjs`, `scripts/r3-wasmtime-probe.mjs`, `scripts/r3-pyodide-probe.mjs`, `apps/server/test/r3-api-headroom.ts`, `apps/server/test/r3-api-under-wasmtime-load.ts`, `apps/web/eslint.config.js`, checked-in `apps/web/public/pyodide/{pyodide.mjs,pyodide.asm.js,pyodide.asm.wasm,python_stdlib.zip,pyodide-lock.json,README.md,NOTICE.md,licenses/*}`, `tests/unit/r3-bot-sdk.unit.test.ts`, `tests/unit/r3-runtime-harness.unit.test.ts`, root `package.json` build:packages registration.

**Harness before → after:**

- Before: the R3 SDK/scorer test could not resolve the required package (`Cannot find module ../../packages/bot-sdk/src/index.js`).
- After: canonical JSON-safe state/legal-move publication, UTF-8/size/entrypoint/import/forbidden-API/loop preflight, SHA-256 source digest, immutable SDK/schema metadata, N/P/M lexicographic scoring, exact RED tie rule, complete-round boundary, mirrored sides, goal progress and extinction fixtures all pass in 7 SDK/scorer tests.
- Before: no runtime safety boundary existed. After: 10 runtime harness tests prove no adapter means `NOT_PROVEN`/`RuntimeNotProvenError`, test adapters are never advertised as production Ready, unknown or unsafe profiles are rejected, invalid source never reaches an adapter, cancellation and late-result fencing are fail-closed, legal moves/output/memory bytes/depth/non-finite/cycle checks are enforced, and the 32-level memory boundary is covered.
- Measurement probe `node scripts/r3-runtime-measure.mjs` records Node v24.13.0, Windows x64, 8 CPUs, 8,299,257,856 total bytes and 1,434,116,096 free bytes at the 2026-10-02T18:30:48.365Z host snapshot. Wasmtime/CPython-WASI are pinned probe artifacts outside the host PATH; Pyodide 0.27.3 assets are checked in. `playerCodeExecuted:false`. Free memory is a volatile host observation, not a capacity guarantee.

**Runtime evidence:** latest probes and their exact assertions are recorded in [`r3-runtime-evidence.json`](./r3-runtime-evidence.json). Wasmtime/CPython-WASI passes the pre-execution hash pin, allowlisted environment, supplied-sentinel readonly boundary including unlink/rename denial, path traversal, network, loop/sleep/memory/output limits, cancellation, reclaim, deterministic seeds, independent per-turn timeout/reset, SDK-shaped `choose_move`/state/memory calls for 60 rounds per side, single admission and loopback supervisor headroom. A local capacity harness runs four pinned guests outside Fastify while 24 sequential and four concurrent `/health` requests remain successful. A disposable Fastify `/health` probe passes 12 sequential and two concurrent requests under a 512 MiB Node heap cap. Pyodide passes warm ABI, offline cold reload, deterministic seed, output/watchdog, bridge/import denial and actual ABI/output/watchdog fixtures in a distinct-origin sandboxed iframe that cannot read the parent DOM/cookie. Both probes execute fixed fixtures only (`playerCodeExecuted:false`); no production scheduler, commit, restart recovery or player upload is enabled.

**Automated evidence:** focused R3 tests 17/17 PASS (including NFKC fullwidth reflection rejection); full safe workspace unit/contract 15 files / 76 tests PASS; Bot SDK build/typecheck/lint PASS; repository typecheck/lint/build and `git diff --check` are recorded below after the final run. The local four-guest Fastify-under-Wasmtime-load harness passes with no database mutation, and public bundle license files are hash-recorded in `r3-runtime-evidence.json`. No production Bot Online/Offline path, provider scheduler, restart recovery, database migration, paid service or player-code execution was introduced.

**Security/runtime boundary:** the manifest [`docs/r3-bot-limit-manifest.json`](./r3-bot-limit-manifest.json) freezes equal protocol limits and records the pinned probes as verified while the Wave review remains open; this remains feasibility evidence for later R9/R10/R11 integration, not permission to execute arbitrary player code in production. The adapter remains fail-closed (`NOT_PROVEN` without an explicit isolated adapter; `TEST_ADAPTER_ONLY` for tests), and private source/memory/logs are not exposed. Local free-class simulation and independent fixture review pass. The single Render Free Web Service now provides public API/SPA, CORS, bounded headroom and rollout evidence, but the actual isolated Bot runner, scheduler, commit path and restart recovery remain unproven and are not enabled. Pinned runtime license texts are checked in under `docs/licenses/` and copied into the public Pyodide bundle; optional Pyodide lock-catalog packages are not shipped. Official references, notices and free Render constraints are recorded in [`docs/r3-runtime-feasibility.md`](./r3-runtime-feasibility.md) and [`docs/r3-runtime-notices.md`](./r3-runtime-notices.md).

**Independent review:** the read-only BA/security review rechecked the final fixture boundary and found no P0/P1 in the compatibility scope; NFKC normalization, supplied-sentinel binding, readonly unlink/rename, SDK-shaped whole-match, per-turn reset, cross-origin fixtures and license metadata are evidenced. It correctly keeps provider free-class hardware/scheduler/restart evidence open because local simulation is not provider evidence. No production Bot readiness is claimed.

**Status:** **DONE —** R3 feasibility exit gate is now evidenced by the public Render provider report: pinned artifacts, ABI/environment/filesystem/network boundaries, path traversal, loop/sleep/memory/output limits, cancellation/reclaim, deterministic seed behavior, per-turn reset, 120-turn whole-match, single-admission and API headroom all pass; the four-fixture provider scheduler also passes serial admission. This does not claim Bot Online/Offline product readiness: authoritative commit, durable checkpoint/restart recovery, upload/privacy API and browser/device flows remain R9/R10/R11 acceptance gates.

Update this table with real evidence as work completes. Do not mark R3 security approved from documentation reading, R4 recovery approved from in-memory mocks, R11 Offline approved from warm tab tests, or R20 complete without device and independent review evidence.

### 8.4 R4 execution report — Match lifecycle, room roles and durable recovery

**Status: DONE for R4 platform scope.** The platform contracts, authoritative room-role ACL, lifecycle/pause/disconnect rules, scheduler and durable persistence seam are evidenced in [`docs/r4-platform-evidence.md`](./r4-platform-evidence.md). Later Referee UI/device/replacement, Bot execution and replay/audit clients remain in their declared Waves.

**Implemented:** custom-room Manual/Bot and Referee/Spectator contracts; one-use account-only Referee invite/accept/decline/leave ACL; Referee Start/Stop/Resume/Hold endpoints; server PAUSED/RESUMING state; central one-scheduler-per-match advancement; fixed player-side disconnect grace semantics; Referee pause disconnect composition and pause caps; source-only Prisma move/checkpoint/event models and migration; deterministic in-memory persistence seam; atomic FileMatchPersistence with exclusive locking, fsync+rename, monotonic fencing and checkpoint/event restore; and session logout/expiry stream revocation.

**Harness:** the pre-fix harness reproduced clock consumption during a disconnect grace and incorrect neutral single-player expiry. The post-fix harness has 18 MatchManager cases, 3 route ACL cases, 2 auth session-revocation cases, and a two-process restart probe covering single-forfeit/both-expired, pause clock freeze, pause-time grace, pause caps, Referee gates, checkpoint/move restore, scheduler deduplication and atomic recovery.

**Automated evidence:** server 20 files/100 tests PASS, web 23 files/72 tests PASS, contracts/server/workspace typecheck PASS, lint PASS, production build PASS with existing Rollup/Zod warnings, Prisma validate PASS without migration, process restart probe PASS, and `git diff --check` PASS with line-ending warnings. The server suite includes existing `.env`-backed auth integration; its database target was not independently certified disposable, so it is not presented as production-database evidence.

**Boundary:** R8 owns visible Referee pause overlay, replacement/consent UX and device matrix; R10/R11 own Bot execution/authoritative commit/crash integration; R13/R17 own replay and public audit clients. PostgreSQL migration is source-only. No push, deploy, paid provider or shared/production database migration was performed.

### 8.5 R5 execution report — Robot Lab foundation

**Status: DONE for R5 shared foundation scope.** The Robot Lab visual contract is now implemented as shared tokens, shell presentation, original SVG brand/glyph assets, canonical board treatment, explicit motion/quality policy and responsive/release-style rules. The full R5 evidence is recorded in [`docs/r5-foundation-evidence.md`](./r5-foundation-evidence.md).

**Harness before → after:** the pre-fix board harness still observed 18 internal `R/P/S` type badges and the Robot Lab foundation modules were absent. After the fix, the focused Robot Lab foundation suite is 7/7, the canonical GameBoard suite is 9/9, and the existing shared foundation suite is 5/5. The focused harness verifies A1/I9 occupancy/orientation invariants, no piece-type badges, 18 deterministic white-glove glyphs, semantic palette keys, RobotLabMark accessibility, reduced/low motion policy and the 3:1 glyph/body contrast floor. Measured outline/body contrast is 7.73:1/7.57:1 in light blue/red and 8.92:1/8.30:1 in dark blue/red.

**Implementation:** `DESIGN_TOKENS` and `globals.css` now publish the Robot Lab dark/light palette, light blue `#6AAAF2`, light red `#F18493`, steel-cyan accents, elevations, focus and motion tokens. `RobotLabMark` replaces the shared header brand glyph. `RobotLabPieceGlyph` supplies original white-glove vectors for Đấm/Bao/Kéo; `PieceGlyph` delegates to it and `GameBoard` no longer renders internal type letters. `resolveMotionPolicy` and `AmbientArena` enforce reduced-motion/low-quality behavior; `robot-lab.css` adds bounded mechanical card/button/board feedback and mobile-safe geometry.

**Automated evidence:** web 24 files/80 tests PASS; workspace typecheck PASS; lint PASS; production build PASS with only the pre-existing Rollup/Zod annotation warning; `git diff --check` PASS with line-ending normalization warnings. No migration, deployment, push, paid service or shared/production database mutation was performed.

**Review and boundary:** static review found no runtime piece emoji/icon-font fallback or Neon-only shared asset assumption. Physical Chrome Android/Safari iOS screenshots and cross-page visual QA remain **NOT RUN** and belong to R19. R6 owns the complete Homepage output/copy; R7/R8 own Queue/Manual/Referee page behavior; R9–R11 own Workbench/Bot runtime; R13/R17 own replay/audit; R19/R20 own full device and final acceptance gates. R5 is not a claim that the overall Robot Lab plan is 100% complete.

### 8.6 R6 execution report — Homepage / Room Browser / Friends Preview

**Status: DONE for R6 page scope.** Evidence is recorded in [`docs/r6-home-evidence.md`](./r6-home-evidence.md). The Homepage now follows the Robot Lab direction: compact profile/Guest identity, requested CHAN greeting, one primary Online entry with a remembered valid queue choice, grouped manual/program cards, a non-clipped full Room Browser route and readable Friends preview. The technical ready strip and the header's always-on “Đã kết nối” decoration were removed; outage feedback appears only when degraded/error state affects the page.

**Harness before → after:** the pre-fix Homepage harness failed 2/2 on the Ranked-only CTA, stale copy and missing mode groups. The focused R6 suite now passes 5/5: two Homepage cases, one full RoomBrowser filter/load-more case and two active-match resume-hint cases. The full web suite passes 26 files/83 tests.

**Implementation:** `OnlineMatchPanel` routes Guest normal play to `/phong-online` and account Ranked to `/queue`, persisting only a valid account selection. `RoomBrowser` has preview/full variants, mode filters, Room ID search, role metadata, load-more and explicit state copy; `/phong-online` is wired through the root router. `FriendsPreview` uses the approved Vietnamese copy. `activeMatchHint` is a non-sensitive, expiring client resume hint fed by a real GameRoom snapshot and never replaces server authorization. Robot Lab card hierarchy and 3→2→1 responsive rules were added as scoped lobby CSS; no Python runtime was executed.

**Automated evidence:** workspace typecheck PASS, lint PASS, production build PASS with only the pre-existing Rollup/Zod annotation warnings, and `git diff --check` PASS with line-ending warnings. Local read-only HTTP smoke returned 200. Browser MCP screenshot/axe/CWV execution was attempted but unavailable because the Windows helper exited with `helper_unknown_error`; physical device and screenshot baselines remain **NOT RUN** and are owned by R19.

**Boundary:** R7 owns waiting-room creation/role gates, R8 owns visible Referee controls, R9–R11 own the real Workbench/Bot runtimes and replace the explicit preparation entry states, and R12 owns full Friends/invitation flows. No push, deploy, paid service or shared/production database mutation was performed.

### 8.7 R7 execution report — Queue / Waiting Room

**Status: DONE for the local R7 Queue/Waiting Room scope.** Full evidence is recorded in [`docs/r7-queue-waiting-evidence.md`](./r7-queue-waiting-evidence.md).

The Queue now presents a calm Robot Lab search stage with truthful Ranked metrics and Vietnamese match-found/transition copy; the decorative radar rings were removed. The extracted `CreateRoomForm` exposes Manual/Bot, Public/Private/password, timer, independent Referee and Spectator toggles, spectator capacity, and host role selection with Public-host-Referee validation. `WaitingRoom` renders two player slots, a separate Referee slot, spectator count/capacity, room-code copy, role tags and server-gated Ready/Start states. Referee invite failures no longer produce unhandled promise rejections.

The room-detail endpoint is now member-scoped so the frontend receives the authoritative viewer role. This closes the `viewerSide === null` ambiguity shared by Referee and Spectator: only a server-provided `role: REFEREE` + `isReferee: true` can expose the pre-game Start control; the client fails closed otherwise. Server ACL, capacity, Referee presence and no-FastReady behavior remain authoritative in R4 lifecycle code.

**Harness and gates:** The pre-fix RoomBrowser/WaitingRoom harness was red (missing controls/module); the post-fix focused web harness is 3 files/17 tests PASS. Full web is 27 files/87 tests PASS; server unit is 18 files/93 tests PASS, including all four Referee/Spectator toggle combinations; workspace unit is 11 files/66 tests PASS; contracts are 4 files/10 tests PASS; workspace typecheck, web lint, web production build, server TypeScript compile and `git diff --check` PASS. A new Chromium R7 browser harness is 3/3 PASS (queue stage, Referee Start, player no-Start), and the corrected R1 queue browser regression is 2/2 PASS. The root build was not run because it invokes Prisma migration against an unverified datasource; no database mutation occurred.

**Review/boundary:** Static review covered role fail-closed behavior, Vietnamese copy, responsive waiting-room layout, reduced-motion inheritance and server-authoritative commands. Independent review, physical device screenshots, broad axe/CWV and full release matrix remain NOT RUN and belong to R19/R20. R8 owns visible in-match Referee stop/resume controls; R9–R11 own real Bot runtime integration.

### 8.8 R8 execution report — Manual Game / Referee

**Status: DONE for the local R8 Manual Game / Referee scope.** Full evidence is recorded in [`docs/r8-manual-referee-evidence.md`](./r8-manual-referee-evidence.md).

GameRoom now exposes server-authoritative Referee Stop with the approved public reason groups, a centered focus-trapped nondismissible pause overlay, elapsed pause time, Referee-only Resume, the three-second RESUMING preparation and Referee `Giữ dừng`. Players and Spectators remain read-only; clocks, board moves, surrender, Ready and revision-changing actions stay locked in every non-PLAYING state. The public event rail records pause/resume events without exposing private Bot source, memory or logs. Referee and Spectator views keep canonical Blue below and never rotate on turn changes.

Referee disconnect recovery is now a real consent path: while paused, a player nominates an account, both players approve, and the nominated account explicitly accepts. The server checks account/Guest and player/Spectator role boundaries, expiry and stale state, atomically updates the room role, and closes the former Referee's control stream on the replacement event. Public snapshots contain only the replacement status/IDs and pause category needed for the flow.

**Harness and gates:** the focused R8 web harness is 2 files / 6 tests PASS; Chromium browser R8 is 4/4 PASS, including 390×844; R7 browser regression is 3/3 PASS. Server focused Referee ACL is 5/5 PASS, MatchManager is 18/18 PASS, the full server serial suite is 21 files / 107 tests PASS, workspace unit/contract/integration is 16 files / 77 tests PASS, and bounded web regression is 29 files / 93 tests PASS. Workspace typecheck, web typecheck, lint, web build, server `tsc --noEmit` and `git diff --check` pass. The web build retains only the pre-existing Rollup/Zod annotation warnings; diff check retains Windows line-ending warnings.

**Review/boundary:** static review covered role ACL, replacement consent, stale-state races, blocker handling, fixed orientation, Vietnamese public copy, focus safety, reduced motion and mobile layout. Physical Chrome Android/Safari iOS, screenshot baseline/axe/CWV and independent BA/QA review remain NOT RUN and belong to R19/R20. The root build remains intentionally NOT RUN because it invokes Prisma migration against an unverified datasource; no migration, push, deploy, paid service or shared/production DB mutation was performed. R9 owns Workbench/Library; R10/R11 own Bot runtime; R13/R17 own replay/audit clients.

### 8.9 R9 execution report — Workbench / Private Library

**Status: DONE for the local R9 Workbench/Private Library scope.** Full evidence is recorded in [`docs/r9-workbench-library-evidence.md`](./r9-workbench-library-evidence.md).

`/bot-lab` now renders the approved three-region Robot Lab Workbench: private bot/revision list, explicit upload/sample/preflight surface, and a private inspector with read-only source, digest/SDK/schema metadata, test log, export/delete and explicit Online/Offline selection. Empty, upload, invalid, ready, preflight pass/fail, quota and active-reference conflict states are visible; source is never included in public list payloads. Account Library retention is owner-managed, while temporary match expiry is disclosed separately.

The server route/service uses `@ottv2/bot-sdk`'s real static validator and frozen manifest for preflight, computes immutable SHA-256 revision digests, enforces source/quota limits and owner ACL, prevents deleting active/pending revisions, and exposes SDK docs/template. Guests and other accounts cannot enumerate or read source. No Python is executed in the application process. Prisma `BotLibrary`/`BotRevision` source models and a non-applied migration are prepared for the durable account library; no database target was mutated.

**Harness and gates:** the pre-fix server and web Harness were red because the private module and Workbench route were absent. Post-fix focused server ACL/preflight/active-reference tests are 3/3 PASS; focused Workbench UI tests are 3/3 PASS (including Guest → account login path); the browser Workbench E2E is 1/1 PASS; full server serial suite is 22 files/110 tests PASS; workspace unit/contract/integration is 16 files/77 tests PASS; bounded web regression is 29 files/93 tests PASS. Workspace/server typecheck, web lint, web build, Prisma schema validation with a synthetic URL and `git diff --check` pass. Web build retains only existing Rollup/Zod annotation warnings; no migration was run.

**Review/boundary:** static review covered source privacy, account ACL, revision/quota/delete races, Library-vs-match application copy, keyboard/mobile layout and reduced-motion inheritance. Physical devices, screenshot baseline/axe/CWV and independent BA/QA remain NOT RUN for R19/R20. Bot Online isolated execution, match commit/revision races and durable recovery remain R10; Bot Offline runtime/cache/paused restore remains R11. Root `pnpm build` remains intentionally NOT RUN because it invokes Prisma migration against an unverified datasource. No push, deploy, paid service or shared/production DB mutation was performed.

### 8.10 R10 execution report — Bot Online

**Status: DONE.** The local Bot Online product seam and the separate unranked Bot queue are implemented and evidenced in [`docs/r10-bot-online-evidence.md`](./r10-bot-online-evidence.md). Account owners choose a PASSED revision, create or join an Unranked Bot room with independent Referee/Spectator toggles, and enter a read-only observer surface with public strategy state. The server accepts only tested revisions, maintains one pending candidate per Bot, applies the latest candidate at the next owned turn, commits only legal moves through `MatchManager`, cancels in-flight work on Referee pause, wires a pinned Wasmtime/CPython-WASI adapter, and persists private references/memory through an explicit checkpoint adapter without leaking source/memory/private logs.

The R10 service Harness is 7/7 with pinned runtime, the adapter Harness is 2/2, Bot queue admission is 9/9, the bounded server regression is 24 files/118 tests (3 explicit runtime-env skips), the focused Queue/Bot Online web suite is 16/16 and the bounded full web regression is 31 files/99 tests. Package/server/web typecheck, web lint, server build including the R3 artifact/probe gate, web build and `git diff --check` pass. The two-process restart probe passes with a stale-checkpoint fence. No Python player source was executed in an application process or native unrestricted subprocess; the real pinned adapter runs only in the Wasmtime supervisor.

**Cross-wave gates:** browser-level SSE/device visual evidence, independent BA/QA final review and real Render hardware observation remain R19/R20 release gates. R10 itself is complete locally and still fails closed when required runtime pins are absent; no push/deploy/paid service/shared database migration was performed.

### 8.11 R11 execution report — AI / Offline / Bot Offline

**Status: DONE for the R11 acceptance scope.** Full evidence is recorded in [`docs/r11-bot-offline-evidence.md`](./r11-bot-offline-evidence.md).

The existing Guest/AI/Offline 2P routes remain compatible and local-only. Legacy Guest storage is migrated without deletion, Guest identity remains stable, and `LocalGamePage` uses the canonical rule engine/clock/result path with fixed Blue orientation and a visible two-person handoff. The former Bot Offline preparation route is now a real two-slot Robot Lab controller: Blue and Red independently load a sample or `.py` file, run SDK preflight, become Ready, and observe a read-only board with Run/Pause/Step/Speed controls. Pause waits at a safe turn boundary and Step commits exactly one turn.

The browser runner validates source with `@ottv2/bot-sdk`, executes only in a module Worker using the pinned public Pyodide kit, and fails closed on missing kit, invalid source, timeout, worker error or illegal move. Board/revision/memory/history/clocks are checkpointed locally after each turn; reload restores the checkpoint paused. The Offline kit reports `r11-pyodide-0.27.3`, progress/readiness and missing-cache guidance. Its Cache Storage/service worker allow-list contains only public runtime/shell assets and excludes API, SSE and private Bot data; there is no online fallback.

**Harness and gates:** the focused R11 suite is 3 files/9 tests PASS (including forced quota failure), the full bounded web regression is 33 files/105 tests PASS; web typecheck, R11 ESLint scope, production web build and `git diff --check` pass. The production build transformed 261 modules and emitted only the existing Rollup/Zod annotation warnings. Browser evidence shows two real Pyodide Worker turns committed, a paused checkpoint restore, and a production-preview deep-route cold navigation with DevTools network Offline, kit 5/5 and the Robot Lab page still available. Checkpoint export is local JSON and storage quota/unavailable errors fail visibly with export/clear recovery guidance. No Python player source ran in the application process or a native unrestricted subprocess.

**Review/boundary:** static review covered local storage compatibility, fail-closed runner/cache behavior, source/privacy boundaries, fixed orientation and Vietnamese copy. An independent reviewer was not available in this turn and is therefore not claimed as PASS. Physical Android/iOS, screenshot baseline, axe/CWV and cross-page final acceptance remain R19/R20 gates. No migration, push, deploy, paid service or shared/production database mutation was performed. Safe next Wave is R12.

### 8.12 R12 execution report — Friends / Invitations

**Status: DONE for the R12 implementation scope.** Full evidence is recorded in [`docs/r12-friends-invitations-evidence.md`](./r12-friends-invitations-evidence.md).

The canonical Friends page now provides four accessible tabs (Bạn bè, Lời mời, Đã gửi, Tìm người chơi), dominant identity/presence cards, keyboard-safe more/block actions with focus restore, a small Robot Lab empty-state, explicit stale-presence disclosure/retry, and responsive mobile stacking. The invite composer separates Người chơi from Trọng tài; player invitations explicitly choose Chơi trực tiếp or Đấu chương trình and the server verifies the room's authoritative mode before issuing a one-use invitation. Referee inbox/list/accept/decline is account-bound and reuses the authoritative room ACL; Guest cannot acquire the Referee role. Room invite cards expose mode and expiry, and expired actions are removed rather than left actionable. Social presence SSE now uses the configured CORS allowlist instead of a hard-coded localhost origin.

**Harness/gates:** focused Friends UI 5/5 PASS; focused server RoomManager/room route/Referee/SocialService/configured CORS presence route 23/23 PASS; full web regression 33 files/106 tests PASS; full server regression 24 files passed, 1 skipped, 122 passed with 3 explicit runtime-environment skips; contracts/web/server typecheck PASS; web lint PASS; web production build PASS with only existing Zod/Rollup annotation warnings. No Prisma migration, push, deployment, paid service or shared/production database mutation was performed.

Static review covered privacy/block policy, Guest/account boundaries, ACL/expiry/race paths, Vietnamese copy, keyboard focus, stale realtime and mobile layout. Independent review and physical-device/browser visual matrix are **NOT RUN** in this turn and remain R19/R20 gates. Safe next Wave is **R13 (History / Replay / Audit download)**.

### 8.13 R13 execution report — History / Replay / Audit

**Status: DONE for the R13 implementation scope.** Full evidence is recorded in [`docs/r13-history-replay-evidence.md`](./r13-history-replay-evidence.md).

The History page now distinguishes account history from on-device summaries, exposes the approved Online/AI/Offline/Bot filters, labels replay availability and keeps aborted/infrastructure outcomes neutral. Match snapshots persist canonical moves and an allowlisted public timeline; the History service writes them with the match, deduplicates retry writes without losing `playMode`, maps Bot Online separately and provides an explicit final-board-only fallback for legacy rows. Bot terminal outcomes expose server-authoritative N/P/M criteria, the published Red-wins-exact-tie rule, and separate author-fault/infrastructure reasons. The read-only Replay panel uses the canonical rules engine, fixed Blue-bottom orientation and Play/Pause/Step controls. The authenticated audit route downloads JSON containing only public match data, replay/timeline and retention metadata; private Bot source, memory, diagnostics and logs are excluded.

**Harness and gates:** focused server history/replay/audit tests are **4/4 PASS** (service projection/privacy, retention and download headers), and the Bot Online adjudication harness is **7 PASS / 1 explicit pinned-runtime skip** (8 tests). Focused web History/Replay tests are **3/3 PASS**; Result/thumbnail regression is **4/4 PASS**. Full server regression is **25 files / 124 passed / 3 explicit runtime-environment skips**. Full web regression is **34 files / 108 passed** in a serial one-worker run after a parallel resource-timeout was reproduced and the affected LocalGamePage file independently passed 2/2. Server and web typecheck, web lint, web production build and `git diff --check` pass; the build has only pre-existing Zod/Rollup annotation warnings and diff check has only Windows line-ending warnings. Prisma schema validation passes against a synthetic non-connected disposable URL; the R13 source-only migration was not applied.

**Review/boundary:** static review covered read-only replay, canonical orientation, local/account source copy, neutral abort handling, owner/participant authorization and public/private data separation. Independent BA/QA review and physical Chrome Android/Safari iOS evidence are **NOT RUN** here and remain R19/R20 gates. R17 owns broader public spectator/replay consumption. No push, deployment, paid service, shared/production database migration or destructive cleanup was performed.

**Safe next Wave:** **R14 — Profiles.**

### 8.14 R14 execution report — Profiles

**Status: DONE for the R14 implementation scope.** Full evidence is recorded in [`docs/r14-profile-evidence.md`](./r14-profile-evidence.md).

Self/public profiles now keep identity/avatar dominant, label Ranked Elo separately from Bot results, and expose a safe aggregate `botStats` computed only from finished Bot matches. Aborted/infrastructure and manual rows are excluded, and Bot results never update human Elo. Public payloads continue to omit full name, credentials, private Library/source and Guest identity data. The account profile exposes an account-only Bot Library shortcut while the Guest profile never does.

Unauthenticated `/ho-so` falls back to the persistent local Guest identity only for an authoritative 401, shows local history plus `Đăng nhập để đồng bộ`, and never invents rank. Server outage/other errors stay visible instead of silently becoming Guest. Existing ProfileForm dirty-navigation protection and social relationship/presence privacy remain intact.

**Harness/gates:** pre-fix web harness 2 tests red; post-fix Profile UI 2/2 PASS and server Bot-stat/privacy unit 1/1 PASS. Full web regression is 35 files/110 tests PASS; server unit regression is 23 files/113 passed with 3 explicit runtime-environment skips. Contracts/server/web typecheck, web lint, server build with R3 artifact/provider gates, web build, Prisma validation and diff check pass (only existing Zod/Rollup and Windows line-ending warnings). The local integration database is not an identified disposable target and is missing R4/R9/R13 migrations; integration was therefore not used as a DONE claim and no migration was executed.

**Review/boundary:** static review covers Guest 401 fallback, account-vs-Guest ACL, public privacy, Bot/Ranked separation, dirty guard, Vietnamese copy, keyboard semantics and responsive Robot Lab layout. Independent BA/QA, physical-device visual evidence, screenshot/axe/CWV and broad cross-page acceptance remain R19/R20 gates. No push, deployment, paid service, shared/production database mutation or destructive cleanup was performed.

**Safe next Wave:** **R15 — Settings / Diagnostics / Local data.**

### 8.15 R15 execution report — Settings / Diagnostics / Local data

**Status: DONE for the local R15 implementation scope.** Full evidence is recorded in [`docs/r15-settings-evidence.md`](./r15-settings-evidence.md).

Settings now exposes the Robot Lab-compatible appearance/audio controls plus explicit `Chẩn đoán` and `Dữ liệu` tabs. Diagnostics reports the pinned Offline kit version, cache readiness and missing-cache guidance; technical browser details stay collapsed and are not rendered as Home decoration or public room data. Local-data controls export only a `LOCAL_DEVICE_ONLY` JSON payload containing Guest identity, local saves/history, Bot Offline session and cache status, and clear those device stores only after confirmation. Account profile, Elo, cloud history and account Bot Library are not called or deleted. Active local sessions and running Bot Offline state fail closed with a visible recovery message.

**Harness/gates:** the pre-fix R15 harness was red with 3 failures (2 Settings outputs plus the missing local-data service). Post-fix focused Settings/local-data harness is **2 files / 5 tests PASS**; full web regression is **37 files / 115 tests PASS**. Web typecheck, ESLint (`--max-warnings 0`), production build and `git diff --check` pass; the build retains only the pre-existing Zod/Rollup annotation warnings. No server API, Prisma migration, shared database, push or deploy was touched.

**Review/boundary:** static review covers local/cloud privacy separation, active-session guards, cache lifecycle, collapsed diagnostics, Vietnamese copy, keyboard button semantics, pending states, responsive action wrapping and Reduced Motion/quality guidance. Physical devices, screenshot baseline, axe/CWV and independent BA/QA final review remain **NOT RUN** and are owned by R19/R20. Safe next Wave: **R16 — Auth / Guest fallback / session boundaries**.

### 8.16 R16 execution report — Auth / Guest fallback / session boundaries

**Status: DONE for the local R16 acceptance scope.** Full evidence is recorded in [`docs/r16-auth-evidence.md`](./r16-auth-evidence.md).

Login, Register and Forgot Password now share the Robot Lab auth shell with the solid OTT v2 wordmark while preserving the existing Vietnamese form labels, inline validation, pending/error states, password visibility control and one-time recovery-code acknowledgement. Login accepts only a same-origin in-app `returnTo`; external, protocol-relative, control-character and authentication-loop targets fail closed, while safe query/hash state is preserved for Workbench drafts and filters. Account-required Workbench, Bot Online, Queue, Room, Friends, Profile, Settings and expired-session paths now carry safe return context where a return is meaningful.

Guest normal play remains available without a login wall. `/ho-so` falls back to the persistent local Guest profile only on an authoritative 401 and keeps local history/rank boundaries explicit. Existing Guest history import remains an explicit `Đồng bộ`/`Để sau` choice after account login and retains local data on failure. Server room/match authentication pins an ongoing Guest member to the Guest principal if an account cookie is later added, preventing silent identity rebinding.

**Harness and gates:** the pre-fix Harness was RED because the login-return assertion failed and the safe-return module was absent; the post-fix focused auth/return suite is **6/6 PASS** and the Guest principal suite is **5/5 PASS**. Full web regression is **38 files / 118 tests PASS**. Full server regression is **26 files / 126 passed / 3 explicit runtime-environment skips**. Web/server typecheck, web lint, web build (266 modules), server build with R3 artifact/provider gates and `git diff --check` pass. The build retains only pre-existing Zod/Rollup annotation warnings and diff check only Windows line-ending warnings.

Static review covered same-origin redirect validation, auth-loop prevention, Guest/account principal boundaries, import privacy, session-expiry return, Vietnamese copy, keyboard/native form semantics and pending/error paths. Independent BA/QA, physical Android/iOS, screenshot baseline, axe/CWV and broad cross-page release matrix remain **NOT RUN** and are owned by R19/R20. No Python ran in the application process or an unrestricted native subprocess; no migration, shared/production database mutation, push, deployment or paid service was performed.

**Safe next Wave:** **R17 — Spectator / Error fallback / public replay consumption**.

### 8.17 R17 execution report — Spectator / Error fallback / public match consumer

**Status: DONE for the local R17 implementation scope.** Full evidence is recorded in [`docs/r17-spectator-fallback-evidence.md`](./r17-spectator-fallback-evidence.md).

Spectator now consumes the server-provided public timeline from initial snapshots, resync snapshots and live SSE payloads. It renders only public labels, sequence/side and Bot revision numbers; private Bot source, memory, logs and diagnostics remain outside the public consumer. The board stays canonical with Xanh at the bottom, has no interaction side, and every cell is disabled. Referee pause state remains visible with elapsed time and no spectator Resume action, while Rời phòng and reconnect/resync behavior remain available.

The spectator error surface distinguishes unavailable service from forbidden/full/missing rooms and does not expose upstream messages, codes or stack traces. The 404 fallback now uses the Robot Lab mark; the existing app render/routing fallback and Offline kit missing guidance remain safe and distinct.

The pre-fix R17 harness was RED because public `BOT_REVISION_APPLIED` and accepted-move timeline entries were not shown. Post-fix focused web coverage is **3/3 PASS**; full web regression is **39 files / 120 tests PASS**. The focused spectator authorization/revocation suite is **19/19 PASS**; full server regression is **26 files passed, 1 skipped; 126 passed, 3 explicit runtime-environment skips**. Web/server typecheck, web lint, web build (266 modules), server build with R3 artifact/provider gates and `git diff --check` pass. Existing Rollup/Zod annotation warnings and Windows line-ending warnings are unchanged.

Static review covers fixed orientation, read-only role permissions, public/private timeline boundaries, pause/reconnect/leave actions, Vietnamese copy and safe fallback paths. No Python ran in the application process or an unrestricted native subprocess; no migration, shared/production database mutation, push, deployment or paid service was performed. Independent BA/QA, physical Android/iOS, screenshot baseline, axe/CWV and broad cross-page release matrix remain **NOT RUN** and belong to R19/R20. Safe next Wave: **R18 — Result / Rematch**.

### 8.18 R18 execution report — Result / Rematch

**Status: DONE for the local R18 implementation scope.** Full evidence is recorded in [`docs/r18-result-rematch-evidence.md`](./r18-result-rematch-evidence.md).

ResultPanel now presents clear win/loss/neutral outcomes for every canonical result reason and both player perspectives. Bot limit, author-fault and infrastructure results show the public N/P/M adjudication and fault side without exposing source, memory, private logs or diagnostics. Ranked Elo remains restricted to non-neutral Ranked results, and the result duration subtracts authoritative Referee pause time from the active match duration. Celebration effects remain event-based and respect the existing Reduced/Low motion policy.

Rematch remains an explicit two-player Ready flow. MatchManager creates a new `matchId`, resets board/clocks/Ready/countdown, swaps sides, clears rating/result state and clears all Referee pause/replacement fields. BotOnlineService now fences its private session against that match ID; on a new round it clears old moves, pending revision, memory, in-flight commit fences and runtime timing, remaps slots to the swapped sides and persists the new fence. Late uploads remain pending-only and cannot auto-start a new round; Referee rooms still require valid Referee approval/start.

The RED harness captured the losing Bot-reason copy, pause-inclusive duration and stale Bot rematch state. GREEN evidence is **2 focused web files / 6 tests PASS**, **2 focused server files / 27 tests PASS with 1 explicit pinned-runtime skip**, full web **40 files / 123 tests PASS**, and full server **26 files / 128 passed / 3 explicit runtime-environment skips**. Web/server typecheck, web lint, web build (267 modules), server build with R3 artifact/provider gates and `git diff --check` pass. Only existing Rollup/Zod annotation and Windows line-ending warnings remain.

No Python ran in the application process or an unrestricted native subprocess; no migration, shared/production database mutation, push, deployment, paid service or billing action was performed. Independent final BA/QA, physical Android/iOS, screenshot baseline, axe/CWV and broad cross-page release matrix remain **NOT RUN** and are R19/R20 gates. Safe next Wave: **R19 — Cross-page QA / cleanup**.

### 8.19 R19 execution report — Cross-page QA / cleanup

**Status: DONE for the local R19 scope.** Full evidence is recorded in [`docs/r19-cross-page-qa-evidence.md`](./r19-cross-page-qa-evidence.md).

The RED harness started with 16 failures in the 30-test representative browser matrix. R19 fixed the WCAG contrast tokens, made API fixtures independent of whether the browser ran against the Vite dev origin or same-origin preview, completed the current History/Friends/Referee-invite fixture contract, and restored the Homepage internal room-list scroll surface without hiding returned rooms. The GREEN representative matrix is **30/30 PASS**; the full `tests/e2e` suite is **43/43 PASS**.

The browser matrix covers **320×640, 375×812, 768×1024, 1366×768 and 1920×1080** with no horizontal overflow. Axe WCAG 2A/2AA representative scans report **zero serious/critical violations**. Web unit/component tests are **40 files / 123 tests PASS**; server unit/integration tests are **26 files / 128 PASS with 3 explicit runtime-environment skips**. Workspace typecheck, lint, production build, R3 artifact pin tests and provider probe all pass; only the existing Rollup/Zod annotation warnings remain.

Review preserved fixed board orientation, Vietnamese copy, role/ACL boundaries, Guest/account separation and private Bot source/memory/log privacy. No Python ran in the application process or an unrestricted native subprocess; no migration, shared/production database mutation, push, deployment, paid service or billing action was performed. Independent BA/QA, physical Chrome Android/Safari iOS, screenshot baseline and Core Web Vitals remain **NOT RUN** and are explicit R20 gates. Safe next Wave: **R20 — Final acceptance**.

### 8.20 R20 execution report — Final acceptance

**Status: BLOCKED.** The available local gates pass and the complete report is recorded in [`docs/r20-final-acceptance-evidence.md`](./r20-final-acceptance-evidence.md), but R20's mandatory security/release evidence is not available.

**Continuation 2026-10-05:** Guest Bot Online GB01–GB06 is now accepted as a separate scoped local workstream: server **160/160 PASS**, web **169/169 PASS**, rebuilt real-API browser **9/9 PASS** and independent scoped review **PASS**. Desktop baseline harness was corrected for same-origin Guest endpoints and rerun with seven 1440×900 routes, `consoleErrors=[]`, `notFoundResponses=[]`, `requestFailures=[]` and no horizontal overflow. These artifacts strengthen local V10 evidence but do not close R20: Offline production release activation remains fail-closed pending its explicit security/release gate; approved visual comparison, release-grade CWV, verified production backup, separate approval for the three new Guest migrations and exact-SHA Linux Render evidence remain outstanding.

**Continuation 2026-10-05 — Offline activation/compatible-memory implementation:** `BotOfflinePage` now performs a dynamic, fail-closed activation check after the pinned Offline kit is present. The check executes a fixed non-player attestation through the real opaque-origin sandboxed iframe + module Worker path, verifies the pinned asset hashes and isolation proof, and requires a two-turn JSON memory round-trip before controls can become Ready/Run. It never executes player Python as the attestation fixture. Bot revisions carry an explicit `# ottv2-memory-schema: <id>` declaration; same-revision memory persists, a new revision resets by default, and preservation is available only after the player explicitly opts in and the schema matches the active revision. Restored snapshots remain unready until re-preflighted. Local evidence: Bot Offline focused UI **8/8 PASS** (including preserve/reset compatibility), full web regression **46 files / 170 tests PASS**, built-product attestation **2/2 PASS** including cold reload with network disabled, built Offline consumer **6/6 PASS**, Bot SDK build/typecheck, web typecheck/lint and production build PASS. This implementation does **not** by itself close R20: production release activation remains fail-closed until the broader adversarial security gate and independent release review are recorded.

The R20 harness first caught a real `LocalGamePage` Offline handoff timer leak: an unmounting component could receive a late `setTimeout` callback and produce an unhandled `window is not defined` error. The timer is now cancelled on unmount and before replacement. GREEN evidence is **web 40 files / 123 tests PASS with no unhandled errors**, **server 26 files / 128 tests PASS with 3 explicit runtime-environment skips**, workspace typecheck PASS, lint PASS, web build PASS, server TypeScript compile PASS, R3 artifact/provider gates PASS, `git diff --check` PASS, and **full Playwright E2E 43/43 PASS** on a clean Vite dev harness across 320×640, 375×812, 768×1024, 1366×768 and 1920×1080.

**Adversarial runtime continuation 2026-10-05:** The real Offline compartment harness is **7/7 PASS** in [`r11-offline-adversarial-browser.json`](./robot-lab-visual-reference/r11-offline-adversarial-browser.json): hostile import/forbidden API/output/timeout rejection without source/secret leakage, compatible memory round-trip plus explicit reset, and fresh invocation after timed-out Worker reclaim. The pinned Pyodide cross-origin module-Worker probe is **PROVEN** in [`r11-offline-pyodide-adversarial.json`](./robot-lab-visual-reference/r11-offline-pyodide-adversarial.json), covering watchdog/output quota, capability denial, fixed memory ceiling, deterministic seed, cold cache and cross-origin isolation. This closes the Offline adversarial runtime sub-gate; independent final review, visual/CWV, backup/migration and exact-SHA Render release evidence remain required for R20.

The desktop revalidation also fixed a Workbench teardown race: an aborted initial load from React/dev cleanup no longer becomes a false “Không thể kết nối tới máy chủ” error. The focused Workbench suite is **3/3 PASS**; the continuation rerun of Workbench plus LocalGame is **2 files / 5 tests PASS**. The sequential web suite is **40/40 files, 123/123 tests PASS**, and the full E2E rerun remains **43/43 PASS**.

The first preview run reused a stale production preview on port 4173 and produced 10 harness-origin false negatives; after stopping that process and rerunning on a clean dev harness, all 43 browser tests passed. This is recorded as harness evidence, not a product regression.

The final local continuation also ran Chrome DevTools Lighthouse/performance checks against an isolated Vite harness. Accessibility and SEO scored 100 on desktop and emulated 390×844 mobile (Best Practices 96); the visible-brand accessible-name mismatch was fixed, and the document now includes a Vietnamese description and valid `robots.txt`. Emulated lab traces measured latest mobile LCP 679 ms / CLS 0.06 / TTFB 9 ms and prior desktop LCP 723 ms / CLS 0.02 / TTFB 9 ms. These are diagnostic lab measurements only: the backend was intentionally absent from that web-only harness, so console API errors cannot be treated as product failures or as Core Web Vitals release evidence.

A read-only request to the Render Free URL during this continuation remained on Render's cold-start `Application loading` interstitial for more than 20 seconds. It is recorded as hosting-state evidence only; no production Lighthouse/CWV result is inferred.

The deterministic desktop harness captured seven pages at 1440×900 with no horizontal overflow, no unexpected request failures and no console errors; the manifest records expected Guest 401 probes and navigation teardown aborts separately. The companion audit is recorded in [`docs/r20-desktop-ui-audit.md`](./r20-desktop-ui-audit.md). This is a new baseline capture, not a comparison against an approved reference image.

Guest Bot Online has an independent scoped PASS in `docs/robot-lab-visual-reference/v10-independent-review.md`; the final whole-system BA/QA verdict, approved screenshot comparison and release-grade Core Web Vitals remain **NOT RUN/INCONCLUSIVE**. The user explicitly waived physical Chrome Android/Safari iOS execution for this desktop-first continuation; the waiver is recorded, not treated as a device-test pass. Automated browser emulation cannot substitute for independent-human evidence, so R20 is not DONE and no push/deploy/database migration was performed. Safe next action is to attach the remaining whole-system review, approved visual comparison and release-grade CWV artifacts, then request the separately authorized push to `origin/main`.

### Final100% gate

- Every HOME/QUEUE/ROOM/GAME/REF/BOTLIB/BOTON/LOCAL/FRIEND/HIST/PROF/SET/AUTH/SPEC/FALL/RESULT acceptance item passes.
- Every accepted1–86 decision maps to implementation/test evidence; interpretation79–86 disclosed.
- Guest normal Online works; Ranked account-only; old local data retained; no duplicate Guest Arena mode.
- Online and Offline actually execute isolated Python under pinned SDK/limits and approved free architecture; no paid fallback; known hosting limitations visible.
- Ref pause/replacement/resume/timers and Bot hot-update/cancellation/memory/terminal interleavings verified.
- Board/pieces/orientation/copy/Robot Lab assets consistent across every page and both themes; no old art gate masquerading as new acceptance.
- Unit/contract/server/web/typecheck/lint/build/E2E/security/performance/cache/restart gates pass with no unacknowledged skipped dependency.
- Desktop/browser matrix evidence, independent BA/QA final verdict, no P0/P1 or unapproved deferred scope. Physical Android/iOS is `WAIVED_BY_USER` for this execution and is not claimed as PASS.
- Push/deploy/production DB migration are separate approved operations after local sign-off, not automatically included in DONE.

**R12 evidence addendum:** the focused server suite, including the configured CORS presence-route regression, records **23/23 PASS**; broader regression counts and explicit runtime-environment skips remain unchanged.

Until all conditions hold, report the percentage/item count supported by evidence or simply IN PROGRESS. Never say100% because the plan was approved or a build succeeded.
