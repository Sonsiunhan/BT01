# D12 — Final Security Handoff

Status: **D12 COMPLETE — FINAL REVIEW VERIFIED WITH FINDINGS**

D12-A and D12-B are complete as inspection/evidence slices. No production feature fix was applied. D13 was not implemented.

## Evidence

- D12-A report: `D12-A-RESULT-2026-10-24.md`
- D12-A executable evidence: `d12a-executable-evidence.json`
- D12-B report: `D12-B-RESULT-2026-10-24.md`
- D12-B executable evidence: `d12b-executable-evidence.json`
- D12-B runner: `scripts/d12b-retention-audit.mjs`
- D12-B integration test: `apps/server/test/integration/d12b-retention-audit.integration.test.ts`

## Preserved findings

| ID | Severity | Finding | Handoff |
|---|---:|---|---|
| D12-F01 | P1 | P10 TA A can read foreign Tournament B roster data by direct `tournamentId` | Đức / shared roster authorization |
| D12-F02 | P2 | Normal user receives P10 API 403 but administrative shell renders | Sơn UI guard; Đức API coordination |
| D12-F03 | P1 | 90-day terminal tournament-owned cleanup is not enforced | Đức + Long lifecycle/identity boundary |
| D12-F04 | P1 | 365-day audit retention is not configured/enforced | Long/shared audit boundary + Đức retention |
| D12-F05 | P2 | ACK evidence duration is unspecified | Long policy decision + Đức retention |
| D12-F06 | P2 | Activation token TTL is 7 days, while approved policy requires 24 hours | Đức / D05 activation owner |
| D11-F09 | P1 | Token-like free-form audit `reason` is unsanitized | Shared audit boundary / Long remediation |

## Positive evidence

- D12-A permission, direct-ID, public-payload and secret scans passed with D12-F01/F02 recorded without patching them.
- D12-B inclusive 90-day policy boundary was verified for `FINALIZED` and `CANCELLED`.
- Operational staff invitation and roster idempotency cleanup passed before/at/after expiry and was idempotent on replay.
- Expired recovery material was unusable and cleared without changing account lifecycle.
- Shared identity, credential, cross-tournament enrollment and staff references survived Tournament A cleanup.
- Audit append behavior passed; historical audit content remained unchanged while a later domain operation appended a new event.
- Retention evidence contains no raw synthetic token values; Bot-private source/memory payload was not copied into retention-generated audit records.

## Explicit non-claims

- No claim of legal/compliance certification.
- No claim that Nam’s Bot/source/runtime/log retention was executed; it is an owner boundary and remains `NOT RUN` here.
- No claim that D12 findings are fixed. Remediation belongs to the listed owners/D13.
- No shared or production database was mutated, and no commit/push was performed.
