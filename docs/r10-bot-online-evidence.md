# R10 Bot Online — execution evidence

Status: **DONE** (all R10-owned Bot Online acceptance gates have passing local evidence; cross-wave browser/device and final release gates remain owned by R19/R20).

## Scope delivered

- `@ottv2/contracts` defines a source-free `BotOnlineSnapshot`, public Bot slot/revision state, equal limits, selection/upload/step payloads and runtime-state vocabulary.
- `BotOnlineService` owns setup, mandatory PASSED revision selection, one pending revision per slot, next-owned-turn activation, private memory/checkpoint references, deterministic seed derivation, legal-move validation through `@ottv2/game-rules`, authoritative commit through `MatchManager.move`, terminal invalid-output adjudication and fail-closed cancellation/provider errors.
- `InMemoryBotOnlineStatePersistence` is test-only; `FileBotOnlineStatePersistence` is available behind `MATCH_PERSISTENCE_DIR` for an explicitly provisioned single-host filesystem. Source and private logs never enter public snapshots.
- Routes: `GET/POST /bot-online/:roomId`, `/select`, `/upload`, `/ready`, `/step`. Referee Start/Stop is wired to Bot scheduler start and in-flight cancellation.
- Matchmaking now has a separate `BOT` queue mode. It is unranked, matches only against other Bot entries, admits account principals only, creates a `playMode: BOT` room with two players, and routes the found room through the tested-revision attachment screen. Ranked queue behavior remains isolated.
- `Wasmtime/CPython-WASI` is wired as an opt-in production adapter through pinned artifact paths and SHA-256 environment pins. Missing paths, mismatched artifacts, supervisor failure, cancellation and quota traps fail closed; no native Python runner is used.
- `/dau-chuong-trinh/online` is now a Robot Lab preparation page: account gate, bot/revision selection, mandatory preflight, custom Bot room creation, independent Referee/Spectator toggles and truthful runtime safety copy. Both the creator and a player joining an existing Bot room pass through the same tested-revision gate before entering the waiting room; a host who chose the distinct Referee role stays on the referee waiting-room surface and is never asked to occupy a player slot. `GameRoomPage` renders Bot rooms read-only and shows active/pending/thinking/limit/revision notices in a public strategy rail; its Ready action uses the Bot lifecycle endpoint and then refreshes the canonical Match snapshot.

## Harness → Test evidence

- Before implementation, Bot Online routes/service/page were absent; R9 explicitly recorded Bot Online as a remaining scope.
- `apps/server/test/unit/bot-online.service.unit.test.ts`: **7/7 PASS with pinned runtime** — mandatory PASSED revision, source-free public snapshot and legal commit; latest-pending replacement/terminal upload; private checkpoint restoration; stale-checkpoint fence; real pinned Wasmtime/CPython-WASI service commit; no-provider fail-closed without Bot loss; referee pause cancellation with no late commit.
- `apps/server/test/unit/wasmtime.adapter.unit.test.ts`: **2/2 PASS with pinned runtime** — real isolated player turn and cancellation reclaim.
- `apps/server/test/unit/matchmaking.manager.unit.test.ts`: **9/9 PASS** — separate Bot queue admission, unranked Bot room commit, Ranked isolation, Guest denial and existing cancellation/race gates.
- `scripts/r10-bot-restart-probe.mjs`: **PASS** — two separate Node processes restore a durable match and Bot checkpoint; an artificially advanced checkpoint is fenced after restart (`runtimeState=UNAVAILABLE`, sequence/stateVersion unchanged), with no duplicate commit.
- `apps/web/src/pages/BotOnlinePage.test.tsx`: **2/2 PASS** — preflight is required before room creation and before attaching a Bot to an existing room; Robot Lab preparation states are visible.
- Server unit suite after R10 changes: **24 files / 118 tests PASS; 3 explicit runtime-env skips** (bounded one-worker run).
- Web focused Queue/Bot Online suite: **16/16 PASS**; full bounded web regression: **31 files / 99 tests PASS**.
- Package/server/web typecheck: **PASS**. Web lint: **PASS**. Server build (including the existing R3 artifact/probe gate): **PASS**. Web build: **PASS** with only existing Rollup/Zod annotation warnings. `git diff --check`: **PASS** with Windows line-ending warnings only.

## Acceptance result

- BOTON-01: **PASS** — mandatory preflight, custom room, separate unranked Bot queue, free two-entry admission, two-Ready and countdown path; Ranked and Guest admission remain isolated.
- BOTON-02: **PASS for R10-owned UI/runtime contract** — read-only board, fixed own HUD, active/pending/upload/thinking rail, public source-free moves, owner-only private data and mobile drawer CSS. Physical-device screenshots and browser-level SSE visual matrix are explicitly R19/R20 gates.
- BOTON-03: **PASS** — latest pending replacement, next-owned-turn activation, terminal/late upload rejection, pause cancellation, reconnect restore and state-version fencing are covered; a late provider result cannot commit.
- BOTON-04: **PASS** — equal per-turn/global limits, deterministic seeds, pinned isolated provider turn, cancellation reclaim and author-vs-infrastructure distinction are evidenced. Runtime remains fail-closed when pins are absent or wrong.
- BOTON-05: **PASS** — durable File checkpoint, two-process restart probe, crash-window stale checkpoint fence, bounded restore and no duplicate move. Render Free ephemeral storage is not advertised as restart durable.

## Review / remaining work

Static review covered actor ownership, queue-mode separation, revision races, private payload boundaries, fixed board orientation, Vietnamese copy, reduced motion inheritance, referee cancellation, restart fences and no native/unrestricted Python execution. Independent BA/QA final review, real Render hardware Bot turn, browser SSE/device matrix and release screenshots remain cross-wave R19/R20 gates. No push/deploy/database migration was performed.

Runtime configuration for a real deployment is explicit: set `BOT_WASMTIME_PATH`, `BOT_CPYTHON_WASI_DIR`, `BOT_WASMTIME_SHA256`, `BOT_CPYTHON_WASM_SHA256` and an optional `BOT_RUNTIME_WORK_DIR`; if any required value is absent or fails verification the Bot runtime is unavailable rather than silently falling back. Render Free's ephemeral disk is not a durable checkpoint provider.
