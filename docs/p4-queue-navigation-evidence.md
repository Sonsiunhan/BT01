# P4 — Queue navigation cancellation race (ECC)

**Status:** `DONE_SCOPED_LOCAL`

## Scope

P4 closes the same-path navigation gap after P3: changing queue mode through the query string must be treated as leaving the active queue. The destination cannot load a second admission while the current queue cancellation is still unconfirmed.

## Harness → Dev → Test

- RED regression: `blocks query-mode navigation until the current queue is cancelled` observed `/queue?mode=BOT` before the deferred cancellation response was acknowledged.
- GREEN fix: `QueuePage` now compares `pathname`, `search`, and `hash` in the React Router blocker. Any meaningful route change waits for authoritative cancellation; a committed match still wins the race and is never cancelled as queued.
- Independent review found a second generation race: after the first cancellation, the terminal flag and cancelled snapshot could suppress or reconcile a newly selected mode incorrectly. A second RED regression, `resets the admission generation after a mode change and cancels the new queue`, reproduced the stale-generation/orphan risk.
- GREEN fix: each `queueMode` effect generation now resets `terminalNavigation`, clears `latest`, and enters loading before acquiring the next admission. The new queue is therefore reconciled independently and a later navigation cancels that queue by its own `queueId`.

## Evidence

- QueuePage focused suite: **18/18 PASS**.
- P3/P4 related web regression (Queue, Bot Online, matchmaking API): **34/34 PASS**.
- Web typecheck: **PASS**.
- Web lint (`--max-warnings 0`): **PASS**.
- Web production build: **PASS**; only existing dependency annotation and chunk-size warnings.
- `git diff --check`: **PASS** (only existing Windows line-ending warnings).

## Review boundary

- Cancellation remains server-authoritative; no client navigation state is treated as proof of cancellation.
- Match-found snapshots are not cancelled after the server has committed a match; the existing generation/status reconciliation remains intact.
- No database mutation, Python execution, commit, push or deployment was performed.

Independent security review: **PASS (scoped-local)** after the reset fix. The reviewer verified the new-generation queue ID, second-navigation cancellation, server-authoritative cancellation and no auth/API or source/privacy exposure in this slice. This evidence is scoped-local only and is not a production/release sign-off.
