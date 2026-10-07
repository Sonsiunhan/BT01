# V4 + V8 Robot Lab evidence

Date: 2026-10-05 (Asia/Bangkok)

## Scope

- V4: GameRoom, LocalGame, Spectator, shared board/HUD, referee pause overlay and result surface.
- V8: account self profile and persistent Guest profile presentation.
- Ownership stayed within the approved page/component/style scope. Canonical rules, server permissions, clocks and pause authority were not moved into CSS or client effects.

## Plan → Harness → Dev

The first focused run intentionally failed on the new visual contracts: missing Robot Lab hooks for the board, pause overlay, result, spectator and profile shells (6 failures, 16 passing tests). The implementation then added scoped hooks and `game.css`/`profile.css`, registered from `main.tsx`, without replacing the existing functional components.

The result surface now accepts the already-authoritative final board and renders the existing read-only `FinalPositionThumbnail`; it does not invent a board state. Online and local callers pass their current canonical board only after terminal state.

## Test evidence

- Focused V4/V8 regression: GameBoard (9), RefereePauseOverlay (4), ResultPanel (5), ProfilePage (2), SpectatorPage (2), LocalGamePage (2) = **24/24 PASS**.
- Full web Vitest JSON report: **40 suites / 128 tests PASS**, `v4-v8-vitest.json`.
- Web typecheck: PASS.
- Web lint: PASS (`--max-warnings 0`).
- Web production build: PASS (274 modules). Existing third-party Zod/Rollup annotation warnings remain non-blocking and are not V4/V8 source errors.

## Browser/visual evidence

`scripts/robot-lab-v4-v8-browser-gate.mjs` passed for:

- Dark and Light themes at 1440×900 and 1366×768.
- Game fixture `/room/w1-demo`: Robot Lab game shell, 81 canonical squares, board hook and fixture controls.
- Account profile `/ho-so`: identity, Bot-unranked split and profile shell.
- Dark 375×812 overflow smoke for both routes.

The gate uses an intercepted authenticated fixture for Profile and the existing `w1-demo` fixture route. It is visual evidence, not proof of a live production service, referee race or network reconnect path.

Screenshots are stored under `docs/robot-lab-visual-reference/` with `v4-game-*` and `v8-profile-*` names.

## Review

- Internal review: PASS for scoped composition, canonical orientation hooks, read-only spectator board, pause overlay styling, result thumbnail reuse, responsive layout, keyboard-safe existing controls and Reduced Motion overrides.
- Independent review: **NOT RUN**; no independent reviewer was available. This is intentionally not represented as an independent pass.

## Remaining work

V5 Bot surfaces, V7 History composition, V9 Settings/Auth/Fallback, V10 cross-page visual QA and the production-service/integration evidence listed in the approved plan remain open. No push, deploy or database mutation was performed.
