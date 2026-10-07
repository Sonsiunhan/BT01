# Robot Lab visual rebuild — V1 evidence

Date: 2026-10-05

## Scope

V1 implements the shared visual foundation only: reference tokens, local typography, deterministic robot/brand assets, motion policy, persisted theme bootstrap, and the application shell navigation. Page-specific compositions remain owned by V2–V9.

## Harness → Dev

- Red harness: `src/foundation/robotLab.foundation.test.tsx` initially failed because the implementation still exposed the old light player values (`#6AAAF2` / `#F18493`) while the approved Robot Lab reference requires `#1957B8` / `#B13244`.
- Fix: aligned `foundation/tokens.ts` and the CSS semantic aliases to the approved Robot Lab palette; set the approved 190ms interaction motion and a black piece outline that satisfies the existing 3:1 white-glove contrast gate.

## Focused evidence

- `corepack pnpm --filter @ottv2/web exec vitest run src/foundation/robotLab.foundation.test.tsx src/theme/ThemeProvider.test.tsx` — PASS, 14/14 tests.
- `corepack pnpm --filter @ottv2/web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 --reporter=dot` — PASS, 40 files / 128 tests.
- `corepack pnpm --filter @ottv2/web typecheck` — PASS.
- `corepack pnpm --filter @ottv2/web lint` — PASS, zero warnings.
- `corepack pnpm --filter @ottv2/web build` — PASS, 269 modules. Existing third-party Zod/Rollup annotation warnings are non-fatal and outside the app source.

## Browser evidence

`node scripts/robot-lab-v1-browser-gate.mjs` — PASS.

The gate checks the running local frontend at `http://localhost:3000` in Dark and Light at 1440×900 and 1366×768, and checks Reduced Motion. It verifies:

- exact semantic background/surface values from the approved reference;
- `data-theme` resolution and saved theme bootstrap;
- local Be Vietnam Pro readiness (no Google Fonts network dependency);
- six shell links: Sảnh, Xưởng Bot, Đấu trường, Bạn bè, Lịch sử, Hồ sơ;
- Robot Lab wordmark presence, 190ms motion token, and no header overflow;
- Reduced Motion marker is active under the browser preference.

Captured artifacts:

- `v1-shell-dark-1440.png`
- `v1-shell-dark-1366.png`
- `v1-shell-light-1440.png`
- `v1-shell-light-1366.png`

## Review and boundaries

Internal visual/browser review passed for the V1 shell. Independent reviewer evidence is **NOT_RUN** (no independent reviewer was available). The full-body `RobotLabHost` asset is implemented and tested as a reusable foundation component; its Home/Room placement is deliberately deferred to the owning V2/V4 page waves. No push, deploy, or database mutation was performed.
