# R5 — Robot Lab foundation evidence

**Status:** DONE for the R5 shared foundation scope only.

**Plan:** `docs/implementation_plan_ott_v0.2_robot_lab.md` §6 and §8.5.

## Scope delivered

- Robot Lab semantic tokens are now the single shared palette for dark/light themes: steel-cyan system accents, light blue `#6AAAF2`, light red `#F18493`, Robot Lab typography, board lines, focus ring, elevation and motion durations.
- The shared shell uses the original deterministic inline `RobotLabMark` asset. The mark is an accessible SVG and is not an icon-font or platform emoji.
- Board pieces use original deterministic white-glove vector paths for Đấm, Bao and Kéo. Runtime no longer renders internal `R/P/S` type badges. `A1` and `I9` remain canonical playable squares; board orientation behavior is unchanged and turn changes do not rotate the board.
- White-glove glyphs use a dark Robot Lab outline over the light glove fill. Measured outline/body contrast is **7.73:1 blue / 7.57:1 red in light theme** and **8.92:1 blue / 8.30:1 red in dark theme**, above the 3:1 glyph/body floor in 06B §4.1/§14.
- Motion policy is explicit: reduced motion disables ambient and event choreography; low quality disables ambient decoration while preserving state feedback. CSS removes hover/transform effects under reduced motion and mobile keeps stable board/card geometry.
- Shared tactile presentation is applied to buttons, mode cards, panels and board surfaces with bounded hover/pressed elevation, cyan focus rings, Robot Lab grid and mobile breakpoints. No idle turn rotation or gameplay-state delay was introduced.

## Harness and automated evidence

The pre-fix harness asserted the old board implementation still exposed 18 internal piece-type badges and failed to resolve the Robot Lab modules. After the implementation:

- `robotLab.foundation.test.tsx`: **7/7 PASS** (semantic tokens, brand SVG, motion policy, vector glyphs and contrast floor).
- `GameBoard.test.tsx`: **9/9 PASS** (canonical 81-square setup, A1/I9 occupancy, orientation invariants, interaction and 18 white-glove glyphs; no `.board-piece-type`).
- Existing `foundation.test.ts`: **5/5 PASS** (token application, event dedupe and quality-tier behavior).
- Full web suite: **24 files / 80 tests PASS**.
- Workspace typecheck: **PASS** (`corepack pnpm typecheck`).
- Workspace lint: **PASS** (`corepack pnpm lint`).
- Production build: **PASS** (`corepack pnpm build`). The only output is the pre-existing Rollup/Zod annotation warning; no build failure.
- `git diff --check`: **PASS** with line-ending normalization warnings only.

## Changed files

Shared foundation files are `apps/web/src/foundation/tokens.ts`, `motionPolicy.ts`, `RobotLabMark.tsx`, `AmbientArena.tsx`, `apps/web/src/components/board/RobotLabPieceGlyph.tsx`, `PieceGlyph.tsx`, `GameBoard.tsx`, `apps/web/src/styles/globals.css`, `robot-lab.css`, `main.tsx`, `AppLayout.tsx` and their focused tests. Homepage received only the shared Robot Lab label cleanup; its complete composition/copy remains R6.

## Review and boundaries

- Static review confirms no runtime piece emoji/icon-font fallback and no remaining Neon-only shared asset assumption. The remaining `emoji` search hits are historical comments documenting the prohibition.
- Reduced-motion, focus, keyboard board navigation, light/dark token application and responsive CSS are covered by the focused tests/source contract. Physical Chrome Android/Safari iOS screenshots and full cross-page visual QA remain R19 acceptance work and are **NOT RUN** in R5.
- R5 does not claim completion of Homepage (R6), Queue/Waiting (R7), Manual/Referee UI (R8), Workbench/Library (R9), Bot runtime (R10/R11), replay/audit (R13/R17), or final cross-page/device acceptance (R19/R20).
- No push, deploy, paid service, production/shared database migration, or deletion of `.worktrees/` was performed.
