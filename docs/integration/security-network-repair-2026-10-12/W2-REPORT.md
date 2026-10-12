# W2 report — command scope, operation IDs, room lock cleanup

Date: 2026-10-12  
Candidate branch: `codex/security-network-repair`  
Commits: `e5da0de`, `9ffb3e0`, `547d892`, `810b73d`  
Base: `test-v0.2@277c627b78586639e40366e2ab6f544d93da69aa`

## Scope completed

- Command ledger lookup is scoped by the composite `(targetId, principalId, commandId, operation)` key. The previous global `commandId` fallback was removed, so an ACK from another principal or room cannot be returned.
- Stored outcomes carry the payload fingerprint. Reusing the same scoped command UUID with another MOVE payload returns `CONFLICT` with exact reason `COMMAND_ID_REUSED` before a second mutation.
- Prisma durable reads require the full scope and compare the persisted `payloadDigest` before returning an ACK; the memory fallback follows the same rule.
- MOVE payload fingerprints are SHA-256 over the canonical `{from,to,stateVersion}` object.
- Client MOVE operations use a per-operation UUID through `X-Command-Id`; `X-OTT-Request: 1` remains only a request/CSRF marker. The server no longer promotes that marker to a command ID, and non-UUID legacy markers are ignored.
- Room lock cleanup now compares and removes the queued promise token, including completed failures and concurrent requests.
- Added focused regressions for scoped isolation, payload reuse, commit behavior, and lock-chain cleanup.

## Evidence

| Check | Result |
|---|---|
| LONG-03 same command/different payload | PASS — `COMMAND_ID_REUSED`, no second mutation |
| LONG-04 30 failed joins release room locks | PASS — 0 retained entries |
| LONG-05 constant CSRF marker cannot be operation ID | PASS — third move advances state |
| LONG-06 principal/target ledger isolation | PASS |
| Reconnect clock probe | PASS — 30,000/30,000 ms preserved |
| Focused server unit tests | PASS — 5 files, 55 tests |
| Server typecheck | PASS |
| Web typecheck | PASS |
| Web HTTP-client Vitest | NOT RUN — web package has no Vitest config |

LONG-01 (async UNKNOWN commit) and LONG-02 (engine setup count) remain baseline failures and are outside W2. They are not represented as fixed by this report.

## Skills applied

- `ecc:git-workflow`: kept the candidate isolated, made a reversible local commit, and did not push or merge shared branches.
- `ecc:security-review`: removed cross-scope ACK lookup and enforced payload identity before idempotent replay.
- `ecc:production-audit`: used the explicit LONG harness and focused regression evidence, recording unavailable gates honestly.

## Next gate

W2 is locally complete. Review the candidate diff and then proceed to the next approved Wave. `test-v0.2` and `main` were not changed.
