# Freeze Checklist – D07‑W1

## Candidate
- **Commit hash / diff ID**: `<Long LD‑06 candidate hash placeholder>`

## Environment Snapshot
- **OS**: Windows (detected at runtime)
- **Node.js version**: `$(node -v)` (to be filled during freeze)
- **Runtime pins**: wasmtime SHA‑256 `<placeholder>`, cpython SHA‑256 `<placeholder>`
- **Database**: Disposable test DB ID `<placeholder>` (not the default `DATABASE_URL`)
- **Config files**: `apps/server/src/config/env.ts` (environment variables listed below)

## Config Snapshot (env vars)
| Variable | Value / Description |
|---|---|
| `NODE_ENV` | `test` |
| `DATABASE_URL` | `postgres://user:pass@localhost:5432/rt-db` (disposable) |
| `OTTO_SECRET` | `<redacted>` (must be provided via CI secret store) |
| `OTTO_CANARY_CRED` | `<redacted>` |
| `OTTO_RUNTIME_PIN_WASMTIME` | `<placeholder>` |
| `OTTO_RUNTIME_PIN_CPYTHON` | `<placeholder>` |

## Freeze Action
- Record the above values in the artifact.
- No code changes performed.
- Commit the freeze checklist (git add & commit) **only after** Long confirms LD‑06 delivery.
