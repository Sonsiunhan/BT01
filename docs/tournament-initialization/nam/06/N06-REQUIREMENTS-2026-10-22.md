# N06 — Requirements Snapshot — Revision 2 — 2026-10-22

**Owner:** Nguyễn Tiến Nam
**Status:** Approved for requirements gate; implementation evidence pending
**Gate:** G0 PASS inherited for the N00 requirements snapshot; N06 has its own independent requirements re-review.
**Scope:** SDK/runtime adapter, compatible receipts, and Human–Python Bot Offline consumer.

## Human decisions recorded

1. **Canonical ABI:** expose the minimum stable state required by a Bot:
   - dimensions from the active board profile;
   - active goals;
   - rules version and winConditions;
   - dynamic legalMoves;
   - preserve board, history, and clocks.
   Private/internal metadata is not part of the Bot ABI.
2. **Receipt:** host-generated and immutable. It includes:
   ownerId, botId, revisionId, sourceDigest, ruleVersion,
   sdkVersion, schemaVersion, runtimeVersion, policyVersion,
   phase, matchId, stateVersion, invocationId, timestamp, and
   computeMs.
3. **Python parity:** the consumer accepts the same ABI through camelCase and
   snake_case aliases. choose_move may return either the two-item tuple
   (move, memory) or {move, memory}. The host remains fail-closed and must
   never replace a Python Bot with an AI heuristic.

## Acceptance criteria

### AC-001 — Dynamic dimensions
- Scenario: a valid active rule profile has explicit rows and cols.
- Action: host builds a Bot turn state.
- Expected: ABI contains dimensions.rows and dimensions.cols equal to the active profile.
- Must not: assume a fixed 9×9 board for the ABI.
- Verification: contract test with 9×9 and a non-9×9 profile.
- Priority: Required.

### AC-002 — Active goals
- Scenario: active profile has static, cycle, or seeded goal state.
- Action: host builds a Bot turn state.
- Expected: ABI exposes the active goal projection allowed by the profile.
- Must not: expose private server metadata or an untrusted client goal.
- Verification: contract and state-builder tests for all supported goal modes.
- Priority: Required.

### AC-003 — Rule identity
- Scenario: a match is bound to an immutable rule profile.
- Action: host invokes a Bot.
- Expected: ABI contains the bound ruleVersion and winConditions.
- Must not: allow Bot/client input to replace the bound rule identity.
- Verification: contract test plus mismatch rejection test.
- Priority: Required.

### AC-004 — Dynamic legal moves
- Scenario: a valid profile and board produce legal moves.
- Action: host builds the state and sends it to TS, server Python wrapper, and Offline Python.
- Expected: all consumers receive the same legal move set derived from the active profile.
- Must not: iterate a legacy constant board when dimensions differ.
- Verification: parity fixtures for standard and non-standard dimensions.
- Priority: Required.

### AC-005 — Stable public state boundary
- Scenario: a Bot invocation is serialized.
- Action: host builds the public state.
- Expected: board, history, and clocks remain present with stable semantics.
- Must not: include private source, logs, internal diagnostics, or unrelated authority metadata.
- Verification: schema allowlist/serialization test.
- Priority: Required.

### AC-006 — Complete receipt
- Scenario: host accepts or rejects a Bot invocation.
- Action: host records the invocation receipt.
- Expected: receipt contains ownerId, botId, revisionId, sourceDigest, ruleVersion, sdkVersion, schemaVersion, runtimeVersion, policyVersion, phase, matchId, stateVersion, invocationId, timestamp, and computeMs.
- Must not: omit identity/version fields on error receipts when an invocation was created.
- Verification: contract test for success and bounded failure paths.
- Priority: Required.

### AC-007 — Host authority and immutability
- Scenario: Bot source or client payload includes forged receipt fields.
- Action: host validates and records the result.
- Expected: receipt fields come only from trusted host state and remain immutable.
- Must not: trust owner, hash, runtime, rule, or compute values from Bot output.
- Verification: tampering test and serialized receipt comparison.
- Priority: Required.

### AC-008 — Version/policy compatibility
- Scenario: runtime, SDK, schema, policy, or rule version is unsupported or mismatched.
- Action: host attempts invocation.
- Expected: invocation is rejected with an explicit bounded compatibility status.
- Must not: silently downgrade, reinterpret the state, or run under a different rule.
- Verification: mismatch matrix tests.
- Priority: Required.

### AC-009 — Python ABI aliases
- Scenario: Python Bot reads the state.
- Action: Offline wrapper invokes choose_move.
- Expected: both camelCase and snake_case names are available as aliases for the same values.
- Must not: expose extra private host objects.
- Verification: Python consumer fixture using each naming style.
- Priority: Required.

### AC-010 — Python result forms
- Scenario: Python Bot returns a legal move.
- Action: wrapper serializes its result.
- Expected: both (move, memory) and {move, memory} are accepted and normalized to one host result.
- Must not: accept malformed, non-JSON, or illegal move output.
- Verification: positive and negative runtime harness tests.
- Priority: Required.

### AC-011 — Fail-closed Bot execution
- Scenario: source validation, runtime attestation, output validation, or budget check fails.
- Action: host handles the failure.
- Expected: Bot invocation is rejected or marked blocked according to the explicit status.
- Must not: substitute an AI heuristic, leak traceback/source, or commit an illegal move.
- Verification: security and failure-path tests.
- Priority: Required.

### AC-012 — Runtime isolation remains mandatory
- Scenario: Offline Python is run in the browser.
- Action: host starts the runtime.
- Expected: pinned isolated frame/Worker, no network/filesystem/secrets/application mounts, bounded compute/memory/output.
- Must not: run player Python in the application process or unrestricted native subprocess.
- Verification: existing isolation proof plus N06 adapter integration test.
- Priority: Required.

### AC-013 — Human–Python Offline consumer path
- Scenario: a Human move is accepted and the next Bot turn uses the same active profile.
- Action: host invokes Python Bot Offline.
- Expected: Python receives the canonical ABI, returns a normalized legal move, and the receipt binds the same match/state/rule identity.
- Must not: advance the match when the receipt or state version is stale.
- Verification: end-to-end harness with accepted Human move followed by Python invocation.
- Priority: Required.

### AC-014 — Evidence and compatibility coverage
- Scenario: implementation is proposed for review.
- Action: run focused contract, SDK, runtime, and consumer tests.
- Expected: evidence covers dynamic dimensions/goals/rules/legalMoves, receipt integrity, aliases, tuple/dict results, mismatch and failure paths.
- Must not: call fixtures or static mocks proof of an attested production runtime.
- Verification: named test commands and review report with raw counts.
- Priority: Required.

## Out of scope

- Replacing Python Bot execution with an AI heuristic.
- Changing canonical game rules, tournament lifecycle, or shared database schema.
- Publicly exposing Bot source, private logs, diagnostics, or internal receipt metadata.

## Verification status

The independent requirements review reports **14/14 criteria covered (100%)**, with no unresolved P0/P1 requirement gap. Implementation and runtime evidence remain pending and must be reported separately.