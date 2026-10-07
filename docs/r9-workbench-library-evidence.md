# R9 — Workbench / Private Bot Library evidence

## Status

`DONE` for the local R9 Workbench/Library scope. This checkpoint does not claim Bot Online/Offline execution; those runtime, authoritative commit and recovery gates remain R10/R11.

## Visible output

- `/bot-lab` is now a Robot Lab Workbench with three explicit regions:
  - **Danh sách bot**: account-owned bot list, revision chips, immutable digest/SDK/schema metadata, active/pending labels when supplied by the server, quota usage and empty state.
  - **Nạp chiến thuật**: `.py` file selection, bot naming, SDK sample/template, allowlist and visible equal-budget limits. Saving a candidate is explicit and never silently applies it to a match.
  - **Kiểm tra và nhật ký riêng**: status, digest, validation message, SDK preflight, read-only source view, private test log, download/export, delete and explicit Dùng Online/Dùng Offline actions.
- Mobile collapses the three regions into a readable single column without hiding actions. Primary targets retain the Robot Lab 44px interaction floor through shared button styles.
- Vietnamese states cover empty, loading, invalid source, ready, preflight pass/fail, quota, owner ACL and active-reference deletion conflict. Library source is retained until the owner deletes it; temporary match source expiry is disclosed separately.

## Server/API implementation

- `packages/contracts/src/bot-library.ts` defines public revision/list/source/test/SDK schemas. Public list and event payloads never contain `sourceText`.
- `apps/server/src/modules/bot-library/bot-library.service.ts` performs the real `@ottv2/bot-sdk` static SDK preflight, SHA-256 digest, 64 KiB source gate, 256 KiB library quota, immutable revision numbering, owner-bound source access, active/pending deletion guard and SDK documentation/template response. It does not execute Python.
- `apps/server/src/modules/bot-library/bot-library.route.ts` exposes account-only private routes for list, upload, new revision, source, preflight test and deletion. Guest and other-account access are rejected without source enumeration.
- Prisma source models/migration were added for account-owned `BotLibrary`/`BotRevision`; schema was generated and validated with a synthetic URL only. No migration was run against any database.
- `apps/server/src/app.ts` registers the private service/route seam for production Prisma and test in-memory adapters.

## Harness and gates

- Red harness before implementation: missing server module and missing Workbench route/component.
- Focused server ACL/preflight/active-reference suite: **3/3 PASS**.
- Full server serial suite: **22 files / 110 tests PASS**.
- Workspace unit/contract/integration suite: **16 files / 77 tests PASS**.
- Focused Workbench UI suite: **3/3 PASS** (including Guest → account login path).
- Bounded web regression suite: **29 files / 93 tests PASS**.
- Chromium browser Workbench E2E: **1/1 PASS** (three regions, private source reveal and explicit Online action).
- Workspace typecheck, server typecheck, web lint, web production build and `git diff --check`: **PASS**. Build emitted only pre-existing Rollup/Zod annotation warnings; diff check emitted Windows line-ending notices.
- Prisma schema validation: **PASS** with a non-connected synthetic `DATABASE_URL`; no migration or database mutation.

## Review and boundaries

Static review covered owner ACL, source privacy, no Python execution in the application process, revision/quota/delete races, explicit Library-vs-match application copy, keyboard-visible controls, mobile layout and reduced motion inheritance. Physical devices, axe/CWV visual baseline and independent BA/QA review remain **NOT RUN** and belong to R19/R20. Bot runtime execution, durable turn commit and restart recovery remain R10/R11. Root `pnpm build` remains intentionally **NOT RUN** because it invokes Prisma migration against an unverified datasource. No push, deploy, paid service or shared/production DB mutation was performed.

## Changed files

- `packages/contracts/src/bot-library.ts`, `packages/contracts/src/index.ts`
- `apps/server/src/modules/bot-library/bot-library.service.ts`, `bot-library.route.ts`, `apps/server/src/app.ts`
- `apps/server/test/unit/bot-library.route.unit.test.ts`
- `apps/web/src/services/bot-library/botLibraryApi.ts`
- `apps/web/src/pages/BotWorkbenchPage.tsx`, `BotWorkbenchPage.test.tsx`, `apps/web/src/app/router.tsx`, `apps/web/src/styles/robot-lab.css`
- `prisma/schema.prisma`, `prisma/migrations/20261004000000_r9_bot_library/migration.sql`
- `tests/e2e/r9-bot-workbench.spec.ts`

Safe next Wave: **R10 — Bot Online preparation / Match**.
