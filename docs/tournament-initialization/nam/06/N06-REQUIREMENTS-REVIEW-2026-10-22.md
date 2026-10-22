# N06 — Independent Requirements Review — 2026-10-22

**Reviewer:** Codex requirements-review agent (/root/n06_requirements_review)
**Scope:** N06 only — SDK/runtime adapter and compatibility receipts
**Authority:** AGENTS.md, docs/team-handoff/module-bot-programming/WORKING-AGREEMENT.md, docs/tournament-initialization/support/DELIVERY-TASKS.json
**Review mode:** source/docs inspection only; no application, database, production or runtime mutation.

## Conclusion

**HOLD — requirements gate not passed.**

N06 has a clear high-level deliverable, but the observable contract is not complete enough to approve an implementation plan. The current source still exposes a legacy state shape and a test-only adapter boundary. The required dimensions/goals/rules/legalMoves ABI and the required owner/hash/rule/SDK/runtime receipt are not defined as one authoritative contract. There are no P0 gaps identified, but there are **P1 gaps** in the boundary contract and compatibility proof.

**Raw checklist:** 4 PASS / 2 PARTIAL / 8 OPEN = **4/14 covered (28.57%)**.
**P0 gaps:** 0.
**P1 gaps:** R-005, R-006, R-007, R-008, R-009, R-010, R-011, R-012.

This is a requirements verdict, not an implementation or runtime-safety verdict.

## Evidence reviewed

- docs/tournament-initialization/support/DELIVERY-TASKS.json — N06 title, dependencies, pages and deliverable.
- packages/contracts/src/bot-abi.ts
- packages/bot-sdk/src/types.ts, state.ts, runtime.ts, version.ts, manifest.ts
- packages/game-rules/src/types.ts, coordinates.ts
- apps/web/src/services/bot-offline/offlineCompartment.ts
- apps/web/src/services/bot-offline/offlineCompartment.worker.js
- apps/web/src/services/bot-offline/botOfflineRunner.ts
- apps/server/src/modules/bot-library/bot-library.service.ts
- apps/server/src/modules/bot-online/python.runner.ts
- existing Bot runtime/offline tests

## Checklist

| ID | Required observable criterion | Status | Evidence / gap |
|---|---|---|---|
| R-001 | N06 scope is bounded to SDK/runtime adapter, receipts, and Human–Python Bot Offline consumer; no AI heuristic replacement | PASS | Delivery task explicitly names these boundaries; current Offline path remains Python-oriented and fail-closed. |
| R-002 | N04 and L01 are present before N06 work | PASS | origin/main/nam-tournament contains N04 and L01 history; no dependency is missing. |
| R-003 | N00/G0 requirements snapshot exists | PASS | docs/tournament-initialization/support/N00-REVIEW-2026-10-22.md records G0 PASS for the N00 snapshot only. |
| R-004 | Runtime security invariants remain fail-closed and no source/traceback is exposed | PASS | offlineCompartment.ts requires verified kit; worker returns bounded error codes; runtime.ts rejects unsafe profiles and invalid output. This does not prove production runtime feasibility. |
| R-005 | One canonical ABI exposes board dimensions from the active rule profile, with explicit rows/cols semantics | OPEN / P1 | BotStateDtoSchema and BotTurnState have no dimensions. createBotTurnState uses legacy BOARD_COORDINATES, so the active profile is not represented at the bot boundary. |
| R-006 | ABI exposes active goals/goal progress and seed context needed by a Bot | OPEN / P1 | RuleProfile supports goalProfiles and seedContext, but neither BotStateDto nor BotTurnState carries them; Python worker receives no goal information. |
| R-007 | ABI exposes the active rules/rule profile and immutable version | OPEN / P1 | BotTurnState has sdkVersion and schemaVersion only; no rule profile/version or win-condition payload is passed to the consumer. |
| R-008 | legalMoves is generated from the active dynamic board/profile and is identical across TS SDK, server wrapper and Offline Python consumer | OPEN / P1 | publicMoves() iterates legacy BOARD_COORDINATES; worker merely aliases legalMoves to legal_moves. No dynamic profile adapter or parity fixture exists. |
| R-009 | No hardcoded 9×9 assumption affects N06 ABI/runtime | OPEN / P1 | packages/game-rules/src/coordinates.ts intentionally retains legacy constants, but N06 SDK state builder directly consumes BOARD_COORDINATES; this makes custom board dimensions impossible at the ABI boundary. Required compatibility adapter/allowlist is unspecified. |
| R-010 | Canonical receipt schema includes server-owned owner, source/content hash, rule version, SDK version and runtime version | OPEN / P1 | No BotReceipt contract exists. BotRevision has sourceDigest, sdkVersion, schemaVersion, but no runtime version or per-invocation owner/rule receipt; owner is removed from public revision. |
| R-011 | Receipt fields are host-generated, immutable and cannot be supplied/overwritten by Bot source or client | OPEN / P1 | Current BotInvocationResult contains only move/memory/optional computeMs; no receipt creation/validation boundary or owner authority is defined. |
| R-012 | Compatibility matrix and failure semantics are observable for Human–Python Bot Offline | OPEN / P1 | Existing Offline tests prove fail-closed before runtime verification, not a real state/receipt compatibility path. No fixtures define old/new ABI, runtime mismatch, rule mismatch, receipt mismatch, or expected BLOCKED/INVALID outcomes. |
| R-013 | A real adapter/harness proves the same ABI through accepted Human move → Python Bot Offline invocation | PARTIAL | Opaque iframe + Worker + pinned Pyodide path exists, but it currently receives the legacy state shape and only test harness validation; no N06 adapter proof for dimensions/goals/rules/receipt. |
| R-014 | Acceptance evidence covers dynamic board, goal/rule propagation, receipt integrity and Python consumer parity | OPEN / P1 | Existing tests cover source/runtime security and legacy legal move validation; no N06-specific contract, parity, receipt or end-to-end evidence exists. |

## Blocking decisions required before implementation planning

1. **Canonical ABI shape:** exact field names/types for dimensions, goals, rules, legalMoves; whether rules is a full immutable RuleProfile or a reduced public projection.
2. **Goal projection:** active goal only vs full profile + seed context; what Python is allowed to know.
3. **Receipt identity:** exact owner identifier (guest/user principal), hash input (source, state, invocation or all), and whether receipt is per revision, per invocation, or both.
4. **Runtime version:** exact pinned value and mismatch behavior (BLOCKED, INVALID, or another explicit state).
5. **Legacy compatibility:** whether legacy 9×9 consumers receive an adapter projection or must migrate; explicit no-hardcoded-9 acceptance.
6. **Failure and privacy semantics:** whether receipts are public to observers/referees or server/audit-only, and what fields are redacted.
7. **Proof boundary:** what constitutes a real Human–Python Bot Offline pass and which browser/runtime environment is authorized.

Until these are closed and independently re-reviewed, N06 must remain **HOLD / IN REVIEW**. Do not mark N06 DONE or claim the runtime adapter is production-ready.

## Revision 2 — re-review after Nam decisions

Nam supplied and approved all three blocking decision groups:

- the minimum stable ABI is dimensions, active goals, rules version/winConditions and dynamic legalMoves, while preserving board/history/clocks and excluding private metadata;
- the host-generated immutable receipt fields are ownerId, botId, revisionId, sourceDigest, ruleVersion, sdkVersion/schemaVersion, runtimeVersion/policyVersion, phase, matchId/stateVersion/invocationId, timestamp and computeMs;
- Python parity includes camelCase and snake_case aliases, tuple or object result forms, and fail-closed execution without heuristic substitution.

The reviewer converted these decisions into N06-REQUIREMENTS-2026-10-22.md revision 2 with 14 observable acceptance criteria. Re-review result:

**PASS — requirements gate only.** Raw counts: **14/14 COVERED (100%)**, 0 PARTIAL, 0 OPEN; P0 gaps: 0; P1 requirement gaps: 0. The checklist is now stable enough to plan and implement.

This PASS does not claim that the ABI, receipt, adapter, Offline consumer, or runtime tests are implemented. Those are implementation evidence items for the next workflow stages.