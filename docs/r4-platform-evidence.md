# R4 — Match lifecycle / room roles / durable persistence evidence

**Status: DONE for the R4 platform scope.** Later Bot execution, Referee UI, replacement UI and replay pages remain owned by their declared Waves; they are not silently counted as R4 completion.

## Scope executed

- Added shared room contracts for manual/Bot custom rooms, independent Referee/Spectator toggles, host role, and one-use Referee invitations.
- Added server-side Referee ACL and lifecycle endpoints: Start, Stop, Resume and Hold/Pause. Referee is an account role separate from player/host management; Guest cannot be Referee.
- Added PAUSED/RESUMING match states, server-side clock freezing, three-second resume preparation, Referee disconnect pause, central one-scheduler-per-match advancement, and spectator/player SSE cleanup.
- Corrected the named R4 disconnect defect: clocks freeze during a player's grace window; one expired player forfeits to the connected opponent; both expired players produce a neutral abort.
- Added independent player grace handling while a Referee pause or resume preparation is active, plus continuous 10-minute and cumulative 30-minute Referee pause caps with neutral `SERVER_INTERRUPTION` abort.
- Added a `MatchPersistence` seam, deterministic in-memory adapter, and atomic `FileMatchPersistence` with exclusive locking, fsync+rename, monotonic fencing, checkpoint/event recovery, and the opt-in `MATCH_PERSISTENCE_DIR` configuration. Prisma move/checkpoint/event models and a **source-only** migration are included; the migration was not applied to any shared or production database.
- Added same-process session logout/expiry stream revocation without per-event database polling.

## Harness: before → after

The new focused harness was intentionally run against the pre-fix behavior first:

- A player disconnect during the 30-second grace incorrectly reduced the active clock (30,000 → 20,000 ms).
- A single expired player incorrectly ended as neutral `ABORTED` instead of the opponent winning by `DISCONNECT_TIMEOUT`.
- Two independent expiries did not follow the required single-forfeit/both-expired split.

After the implementation, the focused MatchManager harness covers 18 cases, including those regressions, Referee Start/Stop/Resume/Hold gates, pause freeze and caps, pause-time player grace, checkpoint + move restore, and one scheduler for multiple subscribers. Additional route ACL and auth session-revocation harnesses cover the permission and stream-lifecycle boundaries.

## Evidence actually run

| Gate | Result |
|---|---|
| `corepack pnpm --filter @ottv2/server test` | PASS — 20 files / 100 tests (the command includes existing `.env`-backed auth integration; its database target was not independently certified as disposable, so this is not production-database evidence) |
| `corepack pnpm --filter @ottv2/web test` | PASS — 23 files / 72 tests |
| `corepack pnpm --filter @ottv2/contracts build` | PASS |
| `corepack pnpm --filter @ottv2/server typecheck` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm lint` | PASS |
| `corepack pnpm build` | PASS; existing Rollup/Zod annotation warnings only |
| `corepack pnpm exec prisma validate --schema prisma/schema.prisma` | PASS; validation only, no migration |
| `node scripts/r4-restart-probe.mjs` | PASS — two separate Node processes restored the committed move/checkpoint/event sequence and turn |
| `git diff --check` | PASS; only line-ending normalization warnings |

The process-restart probe is a real atomic FileMatchPersistence exercise on an explicitly disposable temporary directory. It is not a claim that Render Free's ephemeral filesystem survives an instance restart. The Prisma migration is source-only and no shared/production database was mutated.

## Later-wave boundaries

- R8 owns visible Referee pause overlay, replacement/consent UX and device/browser matrix.
- R10/R11 own Bot execution, authoritative commit and crash-window integration.
- R13/R17 own replay and public audit clients.
- PostgreSQL migration remains source-only until a separately approved disposable target is provided.

No push, deploy, paid service, shared/production database migration, or deletion of user/worktree changes was performed.
