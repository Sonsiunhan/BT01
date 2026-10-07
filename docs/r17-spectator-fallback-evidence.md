# R17 — Spectator / Error fallback / public match consumer

## Status

**DONE for the local R17 implementation scope.** This report does not claim the independent R19/R20 release review, physical-device matrix, axe/CWV or deployment.

## Visible output and boundaries

- Spectator consumes the server-provided `publicTimeline` from the initial snapshot, resync snapshot and live SSE payloads. Public entries show only safe labels, sequence/side and Bot revision number; private Bot source, memory, logs and diagnostics are never rendered.
- The public board uses the canonical `viewSide="BLUE"`, has no interaction side, and every cell remains disabled. Spectators do not receive player commands or a Resume control.
- Referee pause state is visible to spectators with a non-dismissible elapsed-time overlay. The room exit link remains available while paused; reconnect and resync status can continue without unlocking gameplay.
- The spectator fallback distinguishes a server-unavailable response from a forbidden/full/missing room response and never prints upstream messages, error codes or stack traces.
- The 404 fallback now uses the original Robot Lab mark and preserves the safe lobby action. Existing app render/routing boundaries remain safe and diagnostic-free. Offline kit readiness remains a separate local surface with explicit “không tự chuyển sang server” guidance.

## Harness → Dev → Test evidence

Harness was RED before the change: the new spectator page test could render the public board and pause overlay, but failed because the public `BOT_REVISION_APPLIED` timeline entry and accepted move were not visible. The implementation then added deterministic public-timeline conversion and merged it for snapshot/resync/SSE updates.

- Focused R17 web suite: **3/3 PASS** (`SpectatorPage.test.tsx` 2, `NotFoundPage.test.tsx` 1).
- Full web regression: **39 files / 120 tests PASS** in a one-worker run.
- Focused server spectator authorization/revocation suite: **19/19 PASS**.
- Full server regression: **26 files passed, 1 skipped; 126 passed, 3 explicit runtime-environment skips**.
- Web typecheck: PASS.
- Server typecheck: PASS.
- Web lint (`--max-warnings 0`): PASS.
- Web production build: PASS (266 modules); only the pre-existing Rollup/Zod annotation warnings remain.
- Server build plus R3 artifact pin/provider probe: PASS.
- `git diff --check`: PASS; only expected Windows line-ending warnings.

Commands used:

```text
corepack pnpm --filter @ottv2/web exec vitest run src/pages/SpectatorPage.test.tsx src/pages/NotFoundPage.test.tsx
corepack pnpm --filter @ottv2/server exec vitest run --config vitest.config.ts --maxWorkers=1 test/unit/spectator-authorization.unit.test.ts
corepack pnpm --filter @ottv2/web exec vitest run --maxWorkers=1
corepack pnpm --filter @ottv2/server exec vitest run --config vitest.config.ts --maxWorkers=1
corepack pnpm --filter @ottv2/web typecheck
corepack pnpm --filter @ottv2/web lint
corepack pnpm --filter @ottv2/web build
corepack pnpm --filter @ottv2/server typecheck
corepack pnpm --filter @ottv2/server build
git diff --check
```

## Acceptance mapping

- **SPEC-01 PASS:** canonical Blue-bottom board, public moves/revisions/thinking surface, disabled selection/commands, timeline privacy boundary.
- **SPEC-02 PASS:** pause overlay, elapsed time, reconnect/resync and usable Rời phòng; spectator has no Resume action; server revocation remains enforced by the existing 19-test suite.
- **FALL-01 PASS:** Robot Lab 404 mark/action, recoverable spectator service error with retry, fatal app/routing boundaries without stack/false health, and separate Offline kit missing guidance.

## Review and non-claims

Static review covered fixed orientation, read-only semantics, role separation, public/private timeline fields, Vietnamese copy, retry/leave actions, pause focus behavior and reduced-motion-compatible existing overlay behavior. No Python ran in the application process or an unrestricted native subprocess. No migration, shared/production database mutation, push, deploy or paid service was used.

Independent BA/QA review, physical Chrome Android/Safari iOS, screenshot baseline, axe/CWV and broad cross-page release matrix remain **NOT RUN** and belong to R19/R20.

Safe next Wave: **R18 — shared accessibility / visual QA preparation**.
