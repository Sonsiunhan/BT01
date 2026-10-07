# V10 / R20 revalidation — 2026-10-05

## Final Guest scoped acceptance — 2026-10-05

Guest Bot Online **GB01–GB06 DONE_SCOPED_LOCAL**, không phải DONE toàn bộ V10/R20. Source cuối: server160/160 và web169/169 PASS zero failures/skips; disposable PostgreSQL17/16 migrations, không mutation production. Browser rebuilt sau frozen-preview fix9/9 PASS, errors=[], measured2026-10-05T12:55:16.771Z; API thật/pinned WASI/fixed fixtures, gồm custom discovery/join UI và optional summary import preview/retry/dedupe không Elo. Review độc lập cuối scoped local PASS tại `robot-lab-visual-reference/v10-independent-review.md`; không còn scoped P0/P1/blocker đã xác định. Xem `docs/guest-bot-online-acceptance.md` cho phạm vi/giới hạn. Offline activation/compatible-memory implementation has since been locally revalidated, but release-grade security/review, visual/CWV/full acceptance, verified production backup, approval riêng cho3 migration Guest và exact-SHA Linux Render release vẫn chưa đạt. Chưa push/deploy/migration production. Addendum này supersede counts và trạng thái Guest/reviewer-unavailable lịch sử bên dưới, không supersede release gate khác.

## Guest Bot Online — separate acceptance

See `docs/guest-bot-online-acceptance.md`: actual DB/server159/159 zero skip,16 migrations disposable only; real built Guest browser8/8 PASS with owned fixed fixtures, no mocks/production mutation; web165/165 prior final event regression + focused9/9 after it. Guest queue/custom, live candidate/reset memory, login/reload ownership, surrender and device-only results implemented. Latest independent reviewer failed due usage limit; do not claim independent final PASS. Overall V10/R20 stays BLOCKED; Offline/visual/CWV/backup/new Guest migration approval/Render exact-SHA release remain separate. Earlier counts/missing-Guest statements below are historical, not latest acceptance.

## Superseding Online preflight/lifecycle continuation — 2026-10-05

Root owns Bot Library/preflight, Online service/adapter/wrapper, app wiring, SDK trusted telemetry, BotOnlinePage and their tests/evidence. No schema/infrastructure change.

- Preflight now actually executes immutable source for both canonical sides. Static-only PASSED metadata is re-tested on selection; absent/busy runtime cannot fabricate validation. Narrow module/builtin facades and sanitized output remain private.
- RED regressions reproduced late selection after countdown, candidate application after terminal, duplicate ticks awaiting pending activation and wall-time cap. Fixed post-await fresh role/match/status checks, admission before await, pending activation fences and persisted ACTIVE_COMPUTE accounting.
- Review IND13/14 added captured match/invocation identity checks in catch/finally, preventing an old fault from aborting/unlocking a new rematch. Shared adapter now enforces synchronous single admission across preflight/turns and releases on every exit; capacity busy retries without author loss.
- Host supervisor starts an independent250/500ms SIGKILL watchdog on a trusted marker; catching Python trace errors cannot disable it. Bootstrap is separately bounded; supervisor overwrites any player computeMs, counting only accepted compute. Node scheduling/IPC latency is not a hard real-time guarantee.
- `v10-online-preflight-runtime.json`: **26/26 PASS, no skips**, pinned Windows Wasmtime/CPython-WASI fixtures plus behavior tests. Includes both-side preflight, API/memory/illegal/compute rejection, caught-timeout loop, C-heavy factorial, cancellation/admission reuse and old-fault/rematch fence. Not Linux/Render rollout evidence.
- BotOnlinePage regressions proved refresh identity clearing valid preflight and repeated failure retaining readiness. Fixed; queue storage only prefills, never grants validation. Focused5/5 PASS; full web155/155 PASS. Typecheck/lint/build pass, existing Zod annotations and500.43kB warning retained.
- Fresh isolated PostgreSQL17 target `ottv2_r20_acceptance_1791183231236`, localhost37762: all13 migrations there only, server144 PASS/6 explicit runtime SKIP. Cluster stopped/retained; no default/shared/production mutation. Separate pinned suite exercised runtime; skips are not represented as PASS.
- Independent review confirms IND09–14 scoped fixes, no new P0/P1 in those remediations. Overall BLOCKED: Guest Bot Online/reconnect, broader Offline adversarial/release security, visual/performance, verified backup and exact-SHA Render release remain open. No arbitrary player files/native Python, automation, production migration, commit/push/deploy.

This section supersedes static-only Online preflight claims and older counts below, not the remaining acceptance boundaries.

### Offline adversarial runtime addendum — 2026-10-05

The earlier wording that listed broader Offline adversarial security as open is superseded for the runtime-security sub-gate. The real compartment harness is **7/7 PASS** in `r11-offline-adversarial-browser.json`, and the pinned Pyodide cross-origin module-Worker probe is **PROVEN** in `r11-offline-pyodide-adversarial.json`: hostile import/forbidden API/output/timeout rejection, no source or secret leakage, memory round-trip/reset, Worker reclaim, watchdog, output quota, capability denial, fixed memory ceiling, deterministic seed, cold cache and cross-origin isolation all pass. Independent final release review, visual/performance, verified backup and exact-SHA Render release remain open.

## Latest measured continuation — isolated database and built Offline consumer

This section supersedes older NOT RUN database claims and candidate-only Offline consumer claims below. V10/R20 remain **BLOCKED**, not DONE.

- Created a new localhost-only PostgreSQL 17 temporary cluster; all 13 migrations applied only there. Repeatable harness: `scripts/robot-lab-v10-isolated-db.mjs`. Its target, directory, stopped state and non-production boundary are recorded in `v10-isolated-db.json`; retained data is not deleted. The earlier manual acceptance cluster was also stopped.
- Real database integration **13/13 PASS** (`v10-db-integration.json`); full server **132 PASS / 3 explicit runtime SKIP** (`v10-server-acceptance.json`). Source ownership, active deletion guard and app reconstruction against the same persisted database are tested; this is not crash-recovery evidence.
- A failing integration regression exposed private Prisma `sourceText` leaking through revision metadata. `BotRevisionSchema.parse` now serializes only contract fields, preserving the owner-only source endpoint.
- Built-app, real isolated Python fixture consumer **6/6 PASS** (`v10-offline-consumer.json`): two-slot preflight, commit/checkpoint, fresh-document cold Offline restore/preflight/step, pending persistence before another turn, restored pending Run/Pause activation, author-fault loss with terminal memory cleanup. No player files executed. API/health 404 and offline connection diagnostics are retained, not hidden or described as a clean production-console pass.
- Cold reload exposed missing lazy precache and `Vary: Origin` mismatches. Build now emits a validated public-only asset manifest; service worker precaches shell/fonts/build assets. Public static cache matches ignore Vary, while API/SSE/cross-origin exclusion remains. Node cache regression **6/6 PASS**.
- Resume incorrectly required the old active slot Ready when a replacement had passed preflight; fixed without resetting the board. Pending changes now checkpoint before the next move.
- A separate RED regression proved IndexedDB save acknowledged request success before transaction commit. Storage now resolves only on commit, rejects aborts, and clones Bot checkpoints before asynchronous database opening. Focused storage/Offline UI **13/13 PASS**. The six browser cases above ran before this last transaction-helper change; no browser rerun of that change is implied.
- Final full frontend **152/152 PASS**, zero failed/skipped (`v10-vitest.json`); lint zero warnings and TypeScript/production build PASS. Zod annotations and 500.43 kB entry warning remain, not a CWV pass. Independent cache review prompted another failing regression: private `.json` outside `/api/` was eligible. Fetch now allows only explicit public `/assets/`, `/fonts/` and five runtime paths; expanded cache suite **6/6 PASS**. The prior consumer browser run predates this final allowlist tightening too.
- Human allowed temporary local activation for fixed fixtures only. Activation was restored to `ready:false`, and the temporary preview stopped. This is not approval to activate the production runtime.

Remaining implementation: Guest Bot Online ownership/reconnect, real isolated Online revision preflight, complete runtime/release acceptance and compatible-memory behavior. Remaining release evidence: visual/performance closure, verified production backup, exact-SHA Render deploy/health. No production migration, commit, push or deploy. Historical work and unrelated user changes preserved.

## Latest continuation (supersedes historical counts/gaps below)

Implemented the opaque-origin iframe/Worker Offline adapter with verified runtime bytes, actual engine memory bounds, restricted module facades and scoped watchdog/cancellation. Removed its obsolete worker after consumer audit. The earlier candidate-only wording is superseded by the built-product activation/cold-reload evidence recorded below; production release activation is still not authorized.

Offline now has candidate runtime preflight, single-flight execution, revision/source/terminal fences, next-own-turn pending activation, bounded computation/moves, author-fault outcomes and N/P/M adjudication with Red final tie-break. Reset/terminal paths reclaim state. The activation gate is now dynamic and fail-closed: a fixed attestation must pass through the real opaque-origin iframe/Worker path, pinned asset/isolation checks and a two-turn memory round-trip; the built-product online-install + cold-reload browser gate is 2/2 PASS (`r11-offline-activation-browser.json`), and the built consumer is 6/6 PASS (`v10-offline-consumer.json`). Compatible-memory selection is covered by Bot Offline UI regression 8/8 and parser regression 2/2. Guest Workbench now has a private transactional IndexedDB library, immutable revision numbering, quota checks and export/clear/source handoff. Guest Bot Online remains incomplete; account permissions were not weakened.

- Full frontend: **150/150 PASS**, `v10-vitest.json`; focused continuation **15/15 PASS** (behavior mocks are not security proof).
- Browser candidate harness: **19 named cases PASS**, `v10-offline-runtime.json`; ten expected rejections are asserted negative cases. Frozen Python fixtures only. Includes memory/seed, compute cancellation, replacement, Offline execution and actual Guest IndexedDB reload/quota checks. Not built-product/cold UI acceptance.
- Final lint (zero warnings), typecheck/build and diff check PASS. Zod annotations and 500.43 kB entry warning retained; release performance gate remains open.
- Independent reviewer source-confirmed IND06/07/08 fixed, no new P0 reported; did not independently rerun focused tests. Overall verdict **BLOCKED**, not release approval. Previous 43/43 fixture browser run is historical.

DB integration **NOT RUN**: CREATE DATABASE unavailable; human declined provisioning (“ko”). Neither a waiver nor permission to use dev/shared/production instead. Backup unverified; no production migration, commit, push or deploy. Remaining: Guest Bot Online final scope/release, safe DB integration, visual/performance acceptance, verified backup and exact-SHA Render deployment/health. Offline activation/compatible-memory implementation is locally evidenced above but remains subject to the broader release security gate. User changes, old evidence and worktrees preserved.

## Historical continuation evidence

Status: **BLOCKED**, not DONE. Independent BA/QA review is authorized and completed: `v10-independent-review.md`. Push authorization is conditional on real DONE.

## Plan / ownership

Root owns sequential V10 queue/contracts/routes, Workbench handoff, shell cache, scoped contrast fixes, DB test guard and evidence. Reviewer owns only its review artifact. No automation restarted.

## Harness → Dev

- Ordinary UNRANKED Guest/account queue failed a new matching regression; now mode-separated queue ignores Elo for ordinary games, creates manual Unranked rooms, and rejects Guest Ranked. Guest queue read/cancel ownership survives account login. A rollback regression also caught orphaned ordinary rooms; waiting Unranked cleanup now covers manual rooms.
- Workbench Online/Offline actions failed navigation tests because they only showed toast. They now navigate with owned bot/revision IDs. Online resolves selection without auto-Ready; Offline imports into one explicit unready slot and does not overwrite an active checkpoint.
- Shell-cache red test reproduced stale HTML after release. Shell is now network-first with Offline fallback; APIs/SSE/cross-origin remain excluded.
- Axe reproduced board-coordinate, active-turn/danger-button and Home CTA-secondary-copy contrast failures. Scoped ink/opacity fixes address measured failures, without disabling axe.
- Independent review found production Offline worker differs from the hardened R3 fixture. Red runner test lacked a security gate. Runner now rejects before kit/Worker creation. UI static validation does not grant Ready; restore clears Ready and New/Run/Step are disabled. Source/memory/checkpoint/export remain preserved. **Mitigation only:** sandbox integration is not complete; dormant old worker/lifecycle code remains unverified.

## Tests / evidence

- Full web result: `v10-vitest.json`; final summary below is authoritative for count.
- Server unit: 23 files PASS / 1 skipped; 119 tests PASS / 3 skipped. Runtime skips are not proof of real pinned runtime.
- Packages build, web/server typecheck, web lint and web production build passed during continuation. Zod annotation and ~500KB entry-chunk warnings are retained; performance gate remains open.
- Browser fixture suite previously passed 43/43. Later full rerun failed on Home CTA contrast and loading time; sequential rerun isolated the real contrast defect and it was fixed. Final rerun below supersedes this intermediate failure. Fixtures do not prove production services/runtime.
- `v10-offline-assets.json`: production cold manual Offline reload PASS; six original PNGs/nine fonts cached and all 18 board pieces load in a fresh offline page. No player Python executed.
- Node shell-cache and exact gesture/provenance checks PASS; `git diff --check` PASS.

## Database / release boundaries

An early server test command expanded unexpectedly into auth fixtures against **local ottv2_dev**. It was not production, but this is not "no DB mutation". Integration now requires explicitly named localhost disposable DBs (`ottv2_test_*` / `ottv2_r20_acceptance_*`).

Provisioning a new disposable acceptance DB failed with PostgreSQL `42501` (no CREATE DATABASE privilege); no existing DB was migrated by that gate. Mutable integration remains BLOCKED.

The three proposed production SQL migrations were inspected: lifecycle tables, Bot library/revisions, replay fields/indexes are additive. Human approval requires inspection **and verified backup**. No backup has been verified here, so no production migration, commit, push or deploy was performed. Local build is not Render evidence.

## Remaining repairs in order

| ID | Work | Required acceptance |
|---|---|---|
| IND-01/04 | Integrate isolated Offline compartment, then replace dormant unsafe path; repair abort/timer reclamation | Actual product-path capability denial, resource limits, determinism, abort/replacement and Offline adversarial tests |
| IND-03 | Real isolated preflight; finite per-turn/whole-match budgets, author-fault losses and agreed N/P/M tie-break | Invalid/illegal/timeout/repetition/recovery cases yield correct finite results; infra failure is not a bot loss |
| IND-02 / VIS-FUNC-01 | Guest local library and authorized Guest Bot Online ownership/reconnect | Real Guest/account/API integration and privacy tests, not account-only fixtures or weakened authentication |
| DB-GATE | Identified disposable test DB | Migration/integration PASS without dev/shared/production mutation |
| VIS-QA/R20 | Approved-reference visual comparison, release performance measurement and independent re-review | No open implementation blockers and accepted visual/performance evidence |
| RELEASE | Verified backup, SQL compatibility, authorized final push and Render deployment/health for exact SHA | Actual production success, not inferred from Git push |

Historical R3/R11 DONE entries do not prove the failing product paths. Old evidence/user changes/worktrees are preserved. Physical Android/iOS is human-waived, not PASS.

## Final gate summary

- Web full regression: **141/141 PASS**, `v10-vitest.json`.
- Web lint: **PASS**, max-warnings 0. Final web build/typecheck: **PASS**, 285 modules.
- Browser final sequential run: **43/43 PASS** (1.6m). Intermediate failures are retained above; final run was not concurrent with build/unit regression. This is fixture/local-browser evidence, not proof of Bot runtime/production services.
- Shell cache + exact original gesture tests: **4/4 PASS**.
- Independent final source check confirms restored Ready cleared and execution actions disabled, but verdict remains **BLOCKED** for unimplemented sandbox/Guest Bot/Offline rules and dormant runner lifecycle.
- Root-owned temporary preview on port 4174 stopped after Offline asset verification; the user frontend on port 3000 was not intentionally stopped. No user/worktree data deleted.
