# R16 — Auth / Guest fallback / session boundaries

## Status

**DONE for the local R16 acceptance scope.** This evidence does not claim the independent R19/R20 release review, physical-device matrix, axe/CWV or deployment.

## Visible output and boundaries

- Login, Register and Forgot Password share the Robot Lab auth shell and solid OTT v2 wordmark. Existing Vietnamese labels, inline validation, pending/error states, password visibility control and one-time recovery-code acknowledgement remain intact.
- Login accepts only same-origin in-app `returnTo` paths. External, protocol-relative, control-character and authentication-loop targets fall back to the profile route; query/hash state is preserved for safe drafts and filters.
- Account-required Workbench, Bot Online, Queue, Room, Friends, Profile, Settings and expired-session paths carry a safe return path. The Bot Workbench draft selection remains in session storage and is not exposed to another principal.
- `/ho-so` remains usable as a persistent local Guest profile after an authoritative 401. Guest normal play is not replaced by a login wall; account-only actions explain the required sign-in.
- Existing Guest history import remains explicit and idempotent: after account login, the user chooses `Đồng bộ` or `Để sau`; import failure keeps local data and shows retryable Vietnamese feedback.
- Server room/match authentication pins an ongoing Guest member to the Guest principal when an account cookie appears later; Guest cannot be silently re-bound to the account.

## Harness → Dev → Test evidence

Harness was RED before the change: the login return test failed and the safe-return utility was absent. After implementation:

- Focused auth/return URL tests: **6/6 PASS** (`AuthPages.test.tsx` 4, `returnUrl.test.ts` 2).
- Guest principal/server focused test: **5/5 PASS**, including Guest room continuity after a later account cookie.
- Frontend regression: **38 files / 118 tests PASS**, serial one-worker run.
- Server regression: **26 files / 126 tests PASS**, with **3 explicit runtime-environment skips**; no unreported failure.
- Web typecheck: PASS.
- Server typecheck: PASS.
- Web lint (`--max-warnings 0`): PASS.
- Web production build: PASS (266 modules); only pre-existing Rollup/Zod annotation warnings.
- Server build plus R3 artifact pin/probe gate: PASS.
- `git diff --check`: PASS; only expected Windows line-ending warnings.

Commands used:

```text
corepack pnpm --filter @ottv2/web exec vitest run --maxWorkers=1 src/pages/AuthPages.test.tsx src/services/auth/returnUrl.test.ts
corepack pnpm --filter @ottv2/server exec vitest run --config vitest.config.ts --maxWorkers=1 test/unit/guest-principal.unit.test.ts
corepack pnpm --filter @ottv2/web test -- --maxWorkers=1
corepack pnpm --filter @ottv2/server test -- --maxWorkers=1
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/server typecheck
corepack pnpm --filter @ottv2/web lint
corepack pnpm --filter @ottv2/web build
corepack pnpm --filter @ottv2/server build
git diff --check
```

## Review and non-claims

Static review covered same-origin redirect validation, auth-loop prevention, Guest/account principal boundaries, import privacy, session-expiry return, Vietnamese copy, keyboard/native form semantics, pending/error paths and preservation of the existing recovery-code contract. No Python was executed in the application process or an unrestricted native subprocess. No migration, shared/production database mutation, push, deploy or paid service was used.

Independent final BA/QA review, physical Chrome Android/Safari iOS, screenshot baseline, axe/CWV and broad cross-page matrix remain **NOT RUN** and belong to R19/R20.

Safe next Wave: **R17 — Spectator / Error fallback / public replay consumption**.
