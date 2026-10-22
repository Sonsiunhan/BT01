# N06 — TDD evidence — 2026-10-22

**Scope:** SDK/runtime adapter, compatible receipts, and Human–Python Bot Offline consumer.
**Requirements gate:** PASS, 14/14 criteria covered (100%), 0 P0/P1 gaps.
**Implementation status:** GREEN for the checked-in contract/SDK/adapter changes. Browser-attested Pyodide execution remains NOT_PROVEN in this environment.

## RED checkpoint

Commit bfdf6e6 (test: add N06 ABI and receipt regressions) added the N06 regression suite before implementation.

Observed RED failures before implementation:

- turn.dimensions was undefined.
- createBotExecutionReceipt was missing.
- Python wrapper did not expose board_dimensions, goal_cells, rule_version, or win_conditions.

## GREEN evidence

Focused N06 command (temporary Vitest alias pointed @ottv2/bot-sdk at the current source):

  node node_modules/vitest/vitest.mjs run tests/unit/n06-bot-abi.unit.test.ts --config .tmp-n06-vitest.config.mts --reporter=verbose

Result: 1 test file passed, 4 tests passed.

The four tests cover:

1. Dynamic dimensions, active goals, rules and legal moves through BotStateDtoSchema.
2. Host-generated frozen receipt with owner, bot, revision, digest, rule, SDK/schema, runtime/policy, phase, match and invocation identity.
3. Python wrapper camelCase/snake_case aliases plus tuple normalization.
4. Runtime tuple normalization, accepted receipt creation, and rejection receipt on ABI mismatch.

Existing runtime gate:

  node node_modules/vitest/vitest.mjs run tests/unit/r3-runtime-harness.unit.test.ts --reporter=verbose

Result: 1 test file passed, 10 tests passed.

Package/type gates:

  node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
  node node_modules/typescript/bin/tsc -p packages/game-rules/tsconfig.json
  node node_modules/typescript/bin/tsc -p packages/bot-sdk/tsconfig.json
  node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit

All commands exited 0.

The server typecheck was attempted but remains blocked by pre-existing dependency resolution errors for csv-parse/sync and xlsx in apps/server/src/modules/roster/roster.service.ts; no N06 error was reported by that command.

## Implemented boundary

- BotStateDtoSchema now accepts bounded dynamic coordinates and requires dimensions, goals, rules, legalMoves, board, clocks and history.
- createBotTurnState derives board coordinates from the active RuleProfile, never from the legacy 9x9 constant.
- Receipts are parsed by the contracts package, created by the host, frozen, and adapter-supplied receipt fields are ignored.
- Online service binds the receipt to owner, bot, revision, source digest, rule, SDK/schema, runtime/policy, match, state and invocation.
- Server and Offline Python wrappers expose the same ABI through camelCase and snake_case aliases and normalize tuple/dict results.
- Offline execution continues through the existing opaque-origin iframe + Worker + pinned Pyodide path and remains fail-closed.

## Runtime limitation

No real browser Pyodide kit/opaque-origin attestation was available in this shell, so AC-012/AC-013 production runtime proof is NOT_PROVEN, not claimed as passed. The existing Offline release gate remains ready: false until the real kit and browser isolation probe run successfully. No AI heuristic fallback was added.