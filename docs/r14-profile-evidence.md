# R14 — Profile evidence

## Scope and visible output

R14 adds the approved Robot Lab profile split:

- Authenticated self/public profiles keep avatar and identity dominant, label Ranked Elo explicitly, and render Bot results in a separate `ĐẤU BOT · KHÔNG XẾP HẠNG` panel.
- Bot wins/losses are calculated from finished `Match.playMode = BOT` records only. Aborted/infrastructure rows and manual matches are excluded; the result never mutates human Elo.
- Public profile payloads expose only safe identity, Ranked stats, Bot aggregate stats, relationship/presence fields and recent Ranked form. Full name, credentials and Bot Library/source are not returned.
- Unauthenticated `/ho-so` falls back to the persistent browser Guest identity only after an authoritative HTTP 401. It shows local history and `Đăng nhập để đồng bộ`; it does not render a rank badge or account Library shortcut. A server outage is shown as an error instead of being silently treated as Guest.
- Authenticated profiles expose the account-only `Mở thư viện Bot` shortcut. Guest history remains local and the existing dirty-form guard remains in place.

## Harness → Dev → Test

The pre-fix web harness was intentionally red: 2 tests failed because a 401 profile request rendered `Cần đăng nhập` and account profiles had no Bot panel. After implementation:

- `apps/web/src/pages/ProfilePage.test.tsx`: **2/2 PASS**.
- `apps/server/test/unit/auth-profile.unit.test.ts`: **1/1 PASS**, including exclusion of aborted/manual rows and public privacy assertions.
- Server unit suite: **23 files, 113 passed, 3 explicit runtime-environment skips**.
- Web suite: **35 files, 110 passed** in a serial one-worker run.
- Contracts typecheck, server/web typecheck, web ESLint, server build (including R3 artifact/provider gates), web production build, Prisma schema validation and `git diff --check`: **PASS**. Web build contains only existing Zod/Rollup annotation warnings; diff check contains only Windows line-ending warnings.

## Review and boundary

Static review covered 401-only Guest fallback, account-vs-Guest permissions, public payload privacy, Bot-vs-Ranked separation, dirty edit guard, Vietnamese copy, keyboard-native links/buttons, responsive profile card layout and Robot Lab styling. No Python is executed by this feature.

The existing integration suite was not used as a DONE claim because the configured local `ottv2_dev` database is not an identified disposable target and is missing the approved R4, R9 and R13 migrations (`prisma migrate status` is read-only evidence). The suite therefore produced environment/schema failures; no migration or database mutation was performed. Physical devices, screenshot/axe/CWV evidence and independent BA/QA review remain R19/R20 gates.

No push, deployment, paid service, shared/production database mutation or destructive cleanup was performed.
