# R19 — Cross-page QA / cleanup evidence

**Status: DONE for the local R19 scope.** R20 final acceptance is intentionally still open.

## Scope and harness

R19 covered the shared Robot Lab shell, Homepage/Room Browser, History, Friends, Settings, Auth, Game/Result/Rematch, Spectator, Queue/Waiting Room, Bot Workbench/Online/Offline, Guest and Not Found routes. The first representative run was RED: **16/30 browser tests failed**. The failures were reduced to two real harness/product defects: light-theme muted text and cyan tokens below WCAG AA, and hard-coded E2E API origins that did not work against the same-origin preview server. History/Friends fixtures also omitted the account/referee-invite contract, and Homepage preview rendered only four rooms without the promised internal scroll surface.

## Implemented fixes

- Darkened the light Robot Lab `--text-muted` token to `#4B646E` and `--system-cyan` to `#06747D` in the TypeScript token source and CSS fallback. This clears the observed 4.30/4.49 contrast failures with margin above 4.5:1.
- Made the Homepage preview render the returned room list inside `.room-grid-scroll`; the full browser keeps its explicit load-more limit. This preserves a bounded panel without silently hiding returned rooms.
- Made E2E API fixtures host-agnostic and path-based, while allowing document navigation to continue. Added the account History fixture and `/rooms/referee/invites` fixture required by the current page contract.
- Updated the Room Browser unit assertion to verify the new scroll contract instead of asserting the container is absent.

## GREEN evidence

| Gate | Evidence |
|---|---|
| Representative cross-page browser matrix | **30/30 PASS**: B13 axe/keyboard/reduced-motion/responsive, B14 route/theme gates, frontend smoke for History, Result/Rematch, fixed BLUE/RED perspective, Spectator, Friends, Homepage room scroll and Settings |
| Full E2E regression | **43/43 PASS** across `tests/e2e` on Chromium with the local Vite dev server |
| Responsive viewports | **320×640, 375×812, 768×1024, 1366×768, 1920×1080**; no horizontal overflow in the B13 screen matrix |
| Accessibility | Axe WCAG 2A/2AA representative public/auth/recovery, History/Friends/Settings/Guest and Game screens: **0 serious/critical violations** |
| Web unit/component | **40 files / 123 tests PASS** |
| Server unit/integration | **26 files / 128 tests PASS; 3 explicit runtime-environment skips** (Wasmtime adapter tests remain intentionally skipped when the pinned runtime environment is unavailable) |
| Type/lint/build | Workspace typecheck PASS, lint PASS, production build PASS; R3 artifact pin/provider gates PASS |

## Review and boundaries

- Fixed orientation, Vietnamese copy, role-gated controls, Guest/account boundaries, public/private Bot data separation and Reduced Motion behavior were covered by the existing route tests and the R19 matrix.
- No player Python ran in the application process or an unrestricted native subprocess.
- No database migration, shared/production database mutation, push, deployment, paid service or billing action was performed.
- Independent BA/QA sign-off, physical Chrome Android/Safari iOS testing, screenshot baseline and Core Web Vitals remain **NOT RUN** and are explicit R20 gates. The local browser evidence does not claim those gates.

## Changed files

- `apps/web/src/components/rooms/RoomBrowser.tsx`
- `apps/web/src/foundation/tokens.ts`
- `apps/web/src/styles/globals.css`
- `apps/web/src/components/rooms/RoomBrowser.test.tsx`
- `tests/e2e/b13-cross-cutting.spec.ts`
- `tests/e2e/frontend.smoke.spec.ts`

**Safe next Wave:** R20 — Final acceptance.
