# R20 — Final acceptance evidence

## Final local visual/CWV + cleanup revalidation — 2026-10-05

The requested Robot Lab visual regression and cleanup review were completed locally without deleting active or historical user assets. V0–V10 visual gates pass, including gesture provenance and cache checks; the full CWV route matrix passes **102/102** samples (17 routes × dark/light × mobile/tablet/desktop) with LCP/CLS/INP thresholds, no unexpected console errors, request failures or horizontal overflow. The History route received a real CLS fix: loading/ready summary geometry, local-history region and state region now reserve stable layout space; the CWV harness starts at the mounted route shell and filters only documented Guest 401/SSE teardown noise. Production-build offline service-worker verification passes with all six original white-glove PNGs and local fonts served on a cold offline reload. The deterministic desktop audit remains **7/7 PASS** at 1440×900 with consoleErrors=[], requestFailures=[] and no horizontal overflow.

Cleanup review retained `FriendsPageR12`, `AmbientArena`, `PieceGlyph`/`RobotLabPieceGlyph`, `b3-lobby.css` and all historical evidence because each has active consumers or traceability references. The only obsolete UI symbol found in an active path was the referee invite marker; it is now the text avatar `TT`, so `pnpm release:gate` passes with initial JS **153.3 KB gzip**, total lazy graph **257.5 KB gzip** inside the documented V10 **270 KB** envelope, and VFX/audio source **9.0 KB gzip**. No player Python was executed and no database was mutated.

These are local implementation/release-candidate gates, not proof of production deployment. R20/V10 remains **BLOCKED** until exact-SHA Render evidence and a verified production backup/approved migration execution are attached; Android/iOS physical testing remains WAIVED_BY_USER. No production migration was attempted.

## Offline activation / compatible-memory continuation — 2026-10-05

The Offline path now has a dynamic fail-closed activation gate. After the pinned kit is present, the browser executes a fixed non-player attestation through the real opaque-origin iframe + module Worker path, verifies pinned asset hashes/isolation proof, and requires two successful JSON memory round-trips before `Chạy`/`Từng nước` can be enabled. A failed or changed kit invalidates the gate; there is no server fallback. Bot revisions parse an explicit `# ottv2-memory-schema: <id>` declaration. Memory persists within a revision; a new revision resets by default; preservation requires an explicit opt-in and an exact schema match with the active revision. Restored checkpoints are unready until re-preflighted.

Evidence for this implementation: focused Bot Offline UI **8/8 PASS**, parser regression **2/2 PASS**, full web regression **46 files / 170 tests PASS**, Bot SDK build/typecheck, web typecheck/lint and production build PASS. Built-product activation attestation is **2/2 PASS** (online install + cold reload with network disabled) in `robot-lab-visual-reference/r11-offline-activation-browser.json`; the built Offline consumer is **6/6 PASS** in `v10-offline-consumer.json` (isolated Worker/Pyodide fixture turns, cold restore, pending activation and terminal cleanup). No player Python ran in the application process or an unrestricted native subprocess. This is local implementation/regression evidence only; a broader adversarial security review and independent release sign-off remain required, so **V10/R20 stays BLOCKED / NOT DONE**.

## Offline adversarial runtime addendum — 2026-10-05

The Offline runtime security sub-gate requested for V10/R20 is now evidenced: the real browser compartment harness is **7/7 PASS** (`robot-lab-visual-reference/r11-offline-adversarial-browser.json`) for hostile import/forbidden API/output/timeout rejection without source or secret leakage, memory round-trip/reset and Worker reclaim. The pinned Pyodide cross-origin module-Worker probe is **PROVEN** (`robot-lab-visual-reference/r11-offline-pyodide-adversarial.json`) for watchdog/output quota, capability denial, memory ceiling, deterministic seed, cold cache and cross-origin isolation. No player Python ran in the application process or an unrestricted native subprocess. This closes the adversarial runtime sub-gate; independent final release review, visual/CWV, verified backup, production migration and exact-SHA Render release remain open, so V10/R20 remains blocked.

## Final Guest scoped acceptance — 2026-10-05

Guest Bot Online **GB01–GB06 DONE_SCOPED_LOCAL**, không phải DONE toàn bộ V10/R20. Source cuối: server160/160 và web169/169 PASS zero failures/skips; disposable PostgreSQL17/16 migrations, không mutation production. Browser rebuilt sau frozen-preview fix9/9 PASS, errors=[], measured2026-10-05T12:55:16.771Z; API thật/pinned WASI/fixed fixtures, gồm custom discovery/join UI và optional summary import preview/retry/dedupe không Elo. Review độc lập cuối scoped local PASS tại `robot-lab-visual-reference/v10-independent-review.md`; không còn scoped P0/P1/blocker đã xác định. Xem `docs/guest-bot-online-acceptance.md` cho phạm vi/giới hạn. Offline activation/compatible-memory implementation is now separately evidenced locally; broader Offline security/release, visual/CWV/full acceptance, verified production backup, approval riêng cho3 migration Guest và exact-SHA Linux Render release vẫn chưa đạt. Chưa push/deploy/migration production. Addendum này supersede counts và trạng thái Guest/reviewer-unavailable lịch sử bên dưới, không supersede release gate khác.

## Guest Bot Online workstream riêng — 2026-10-05

> Historical intermediate snapshot; superseded by “Final Guest scoped acceptance” above.

Guest implementation và acceptance được tách tại `docs/guest-bot-online-acceptance.md`. Real isolated PostgreSQL17/full server159/159 PASS zero skip,16 migrations local-only; pinned WASI integration gồm Guest paired queue, custom/Ready/turn/r2 activation/reset memory và ownership sau login. Built real-API browser8/8 PASS; full web165/165 PASS trước regression storage-event mới, focused9/9 PASS sau sửa. Review độc lập cuối Guest không hoàn tất do usage limit, không ghi PASS. R20 vẫn BLOCKED, không production migration/push/deploy; Guest3 migration mới cần approval/backup riêng. Đây là addendum supersede tuyên bố Guest chưa có implementation/DB runtime SKIP trong lịch sử bên dưới, không supersede các release/Offline/visual/CWV gate còn mở.

## Authoritative continuation — 2026-10-05 (database and cold Offline consumer)

> Historical intermediate snapshot; superseded for Guest counts by the final scoped acceptance above. Its Offline/release boundary remains applicable.

R20 remains **BLOCKED**. The local database provisioning obstacle has been solved safely with a new PostgreSQL 17 localhost-only temporary cluster, never the default/dev/shared/production database. Real DB integration 13/13 PASS; full server 132 PASS / 3 explicit runtime SKIP. All 13 migrations applied only to the disposable target; temporary clusters stopped, data retained. See `robot-lab-visual-reference/v10-isolated-db.json`, `v10-db-integration.json`, `v10-server-acceptance.json`.

Built-product fixed-fixture Offline consumer 6/6 PASS including fresh-document cold Offline reload, pending restore/activation and author-fault terminal cleanup (`v10-offline-consumer.json`). No player files executed. API/health network diagnostics are retained. Temporary activation was explicitly local-only and has been restored fail-closed. Later storage transaction-commit repair has focused 13/13 PASS but is not included in that browser run. Cache boundary regression 6/6 PASS.

Source metadata privacy leak, restored pending Run guard, pending checkpoint persistence and premature IndexedDB save acknowledgement fixed with regression evidence. See latest `v10-harness-report.md` for measured scope. Guest Bot Online and real Online preflight remain unfinished; full visual/performance, verified backup and exact-SHA Render release gates remain open. No push/deploy or production migration. Physical Android/iOS stays WAIVED_BY_USER, not PASS. This section supersedes older database NOT RUN statements below.

Final full frontend **152/152 PASS** with zero failed/skipped, lint zero warnings, TypeScript/build PASS. Cache allowlist further tightened after RED private-JSON regression; Node **6/6 PASS**. Built Offline browser6 predates the last transaction-helper and cache-allowlist changes. Third-party annotation and 500.43 kB entry warnings remain; no release performance PASS is implied.

## Latest continuation — 2026-10-05

> Historical intermediate snapshot; superseded by the final Guest and desktop baseline addenda above.

Frontend 150/150 PASS; focused race/reset/preflight tests 15/15 PASS; candidate browser runtime harness 19 named cases PASS including expected rejections. Lint/typecheck/build/diff checks pass. Offline isolated adapter/preflight/bounded results and Guest local library implemented. Independent source review confirms IND06/07/08 fixed but overall BLOCKED. Detailed scope: `robot-lab-visual-reference/v10-harness-report.md` and `v10-independent-review.md`.

Offline production release activation stays fail-closed after local built-product/cold-reload acceptance; broader adversarial security/release review is still open. Guest Bot Online remains unfinished. Disposable DB integration NOT RUN after human declined provisioning (“ko”); no dev/production fallback. Visual/performance acceptance, verified backup and exact-SHA Render deployment remain unmet. No production migration, commit, push or deploy. R20 is not DONE. Android/iOS WAIVED_BY_USER, not PASS. This section supersedes historical counts and claims below.

**Status: BLOCKED — local gates pass, mandatory release evidence is unavailable.**

## Harness → Dev → Test

R20 first exposed one real web lifecycle defect: `LocalGamePage` left the Offline handoff timeout alive after component teardown, producing an unhandled `window is not defined` exception in Vitest. The timer is now owned by a ref and cancelled on unmount (and before replacement), so late callbacks cannot update a torn-down component.

After the fix:

- Web unit/component: **40 files / 123 tests PASS**, with no unhandled errors.
- Server regression: **26 files / 128 tests PASS / 3 explicit runtime-environment skips** (`wasmtime.adapter.unit.test.ts`).
- Workspace typecheck: **PASS**.
- Workspace lint: **PASS**.
- Web production build: **PASS**; only existing Zod/Rollup `@__PURE__` annotation warnings remain.
- Server TypeScript compile: **PASS** (run without Prisma migration).
- R3 artifact pin tests: **2/2 PASS**; provider probe: **PASS**.
- Browser E2E on a clean Playwright-managed Vite dev harness: **43/43 PASS**.
- Browser matrix covered 320×640, 375×812, 768×1024, 1366×768 and 1920×1080; no horizontal overflow.
- `git diff --check`: **PASS**; only Windows line-ending warnings.
- Lighthouse lab audit (local Vite dev harness, desktop and emulated 390×844 mobile): accessibility **100** and SEO **100** on both; Best Practices **96**. The audit also reported API-console errors because no backend was attached to the isolated web-only harness. Those errors are harness evidence, not a release pass.
- The lab audit identified and fixed the visible-brand accessible-name mismatch (`OTT v2` is now included in the logo label), and the document head now has a Vietnamese description plus a valid `robots.txt`. Web tests, typecheck, lint and production build were rerun after these changes and remained green.
- Chrome DevTools lab traces (emulated only, no throttling/CrUX): latest mobile LCP **679 ms**, CLS **0.06**, TTFB **9 ms**; prior desktop trace LCP **723 ms**, CLS **0.02**, TTFB **9 ms**. These values are diagnostic lab measurements and are **not** a Core Web Vitals release report.
- A read-only check of `https://ott-v2.onrender.com/` during this continuation returned Render Free's cold-start `Application loading` interstitial for more than 20 seconds rather than the product shell. No production Lighthouse/CWV claim is made from that response.

The first preview attempt produced 10 false-negative E2E results because Playwright reused a stale production preview on port 4173. The stale process was stopped, the clean dev harness was started, and the complete 43-test suite passed. No product failure is inferred from that stale-harness run.

## Review and release gates

The following mandatory R20 gates remain **NOT RUN/INCONCLUSIVE**, so R20 cannot be marked DONE:

- Independent BA/QA final verdict with an attached review artifact.
- Screenshot baseline comparison across the accepted pages/themes/viewports (current baseline is captured, but no approved reference diff exists).
- Core Web Vitals measurement and release threshold report.

Physical Chrome Android and Safari iOS execution is **WAIVED_BY_USER** for this continuation and is not represented as a pass. Automated local browser emulation is not represented as physical-device evidence, and this agent cannot self-certify an independent human review.

## Safety boundaries

- No push, deployment, paid service, billing action or shared/production database migration was performed.
- No player Python ran in the application process or an unrestricted native subprocess.
- Existing user changes and `.worktrees/` were preserved.

**Next action:** obtain the three remaining external release artifacts (independent review, approved visual comparison and release-grade CWV), attach their results, rerun the final traceability review, then mark R20 DONE and request/perform the separately authorized push to `origin/main`.

## Revalidation — 2026-10-04 21:14 Asia/Bangkok

The requested R20 continuation re-ran the local regression gates after the accessibility/metadata fixes: web **40 files / 123 tests PASS** (the first concurrent run exposed one resource-contention timeout; the focused test and the subsequent sequential full run both passed), workspace typecheck **PASS**, workspace lint **PASS**, and web production build **PASS**. Server typecheck and build/provider gates also **PASS**; server unit tests were not rerun because this workspace has no identified disposable database target, so the prior R19 server evidence is retained rather than overstated. The clean-harness browser result is **43/43 PASS**.

## R20 desktop revalidation — 2026-10-04

The approved scope for this continuation is desktop/local verification. The user explicitly waived physical Chrome Android and Safari iOS testing; those checks are recorded as **WAIVED_BY_USER**, not as a pass.

- R20 visual convergence changed the Homepage hero to a visible accessible Robot Lab host, reduced pointer/magnetic movement to the approved subtle range, strengthened mechanical card/CTA hierarchy, and made the 3→2→1 mode grid explicit. See `apps/web/src/pages/HomePage.tsx` and `apps/web/src/styles/robot-lab.css`.
- The Workbench load path now ignores an `AbortSignal` cancellation during React/dev teardown instead of surfacing a false “Không thể kết nối tới máy chủ” banner. The regression remains covered by `BotWorkbenchPage.test.tsx`; the final desktop capture shows the intended three-region empty Workbench state.
- The deterministic Playwright desktop harness captured seven representative pages at **1440×900**: Homepage, Bot Workbench, Bot Online, Bot Offline, History, Friends and Settings. The manifest is `docs/r20-desktop-baselines/manifest.json`; every page reports `scrollWidth = viewportWidth = 1440`, `consoleErrors = []`, and the only 401 responses are the expected unauthenticated Guest `/auth/me` probes (`expectedGuestAuth401 = 18`; Workbench is intentionally captured with an account fixture to exercise its three-region output).
- The final manifest records `requestFailures = []`; the small `expectedNavigationAborts` list is only teardown from moving to the next screenshot page.
- Focused continuation rerun after the Workbench abort guard: `BotWorkbenchPage.test.tsx` plus `LocalGamePage.test.tsx` = **2 files / 5 tests PASS**. The deterministic scope and remaining gate rules are summarized in [`docs/r20-desktop-ui-audit.md`](./r20-desktop-ui-audit.md).
- This is a newly captured baseline set. No approved reference screenshots were available for pixel/diff comparison, so screenshot acceptance remains **INCONCLUSIVE**, not PASS.
- No Core Web Vitals release report or independent BA/QA artifact is present. Existing lab LCP/CLS values remain diagnostic only.

R20 therefore remains **BLOCKED** only on the independent BA/QA verdict, an approved screenshot comparison (or explicit acceptance of this baseline), and a release-grade Core Web Vitals report. Android/iOS physical testing is not a blocker for this user-approved desktop scope, but it is not represented as executed evidence.

## Superseding independent product review — 2026-10-05

Latest continuation: isolated Online preflight and IND09–14 lifecycle/supervisor fixes have26/26 PASS, zero skips (`robot-lab-visual-reference/v10-online-preflight-runtime.json`), independently source/evidence reviewed. Full web155/155 PASS; disposable DB server144 PASS/6 runtime SKIP, separately exercised by pinned suite. Cluster stopped/retained. Preparation validation survives metadata refresh, is revoked on failure and is never inferred from cached queue data. See superseding V10 harness report for RED cases, scope and retained warnings. Guest Online, compatible memory, full Offline/visual/performance and backup/exact-SHA Render release remain open. R20 is not DONE; no push/deploy or production mutation.

The above historical statement that only external artifacts remain is superseded. Authorized independent BA/QA review (`robot-lab-visual-reference/v10-independent-review.md`) found actual P0/P1 product gaps: production Offline sandbox is not the R3 probe compartment, Guest Bot/local library is missing, Offline preflight is static-only and finite match/adjudication rules are absent, and dormant abort/timer lifecycle is unsafe. Offline execution is now fail-closed with source/checkpoint preserved; this mitigates exposure but does not complete the feature. See `robot-lab-visual-reference/v10-harness-report.md` for repairs, tests and release prerequisites. R20 remains BLOCKED; no commit/push/deploy or production migration performed. Android/iOS remains WAIVED_BY_USER.
