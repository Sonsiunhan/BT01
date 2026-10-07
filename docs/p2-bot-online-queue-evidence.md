# P2 — Bot Online queue handoff (ECC)

**Status:** `DONE_SCOPED_LOCAL` for the P2 queue-handoff slice; this is not a claim that R10/V10/R20 or production release is complete.

## Scope used

The repository does not define a P1–P5 table. P2 was therefore constrained to the smallest executable slice implied by the approved flow: `Kiểm tra code → Tìm trận Online → queue admission`, including principal safety and the Bot match-found presentation.

## Harness → Dev → Test

- RED regression: the new queue API harness reproduced a stale Guest `sessionStorage` marker causing an authenticated account to send `X-Expected-Principal: GUEST`.
- Fix: `joinMatchmakingQueue` derives the expected principal from the authoritative `/auth/me` result; stale local Guest markers no longer assert Guest. Guest Bot requests now pin `X-Expected-Principal: GUEST` even if a stale cache lacks its local marker.
- Fix: Bot/Unranked match-found cards show `Không xếp hạng`; only Ranked renders Elo.
- Added focused coverage for account/Guest payloads, server principal binding, and Bot match-found output.

## Evidence

- Web focused: `20/20 PASS` (`matchmakingApi` + `QueuePage`).
- Server focused: `30 PASS / 1 explicit runtime-environment skip` (route, runtime-config, Bot Online, preflight suites).
- Web typecheck, web lint, web production build: `PASS`.
- Server typecheck, server build, artifact-pin gate: `PASS`.
- `git diff --check`: no content errors; only existing Windows line-ending warnings.
- Full web serial run: `45/47` files and `175/177` tests passed; two legacy tests have explicit 5-second test timeouts under the shared serial harness. They pass when isolated/re-run with the resource allowance used by the existing suite. This is recorded as harness instability, not suppressed.

## Review boundary

- No Python source executed in the application process or an unrestricted native subprocess.
- No database mutation, commit, push, deployment or production runtime claim was made.
- Real Render/Linux provider readiness remains outside this local P2 slice and must be evidenced separately.
