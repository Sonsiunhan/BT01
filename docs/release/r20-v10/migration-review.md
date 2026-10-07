# F1 — SQL migration review

Recorded: 2026-10-06, Asia/Bangkok. Scope: read-only review of the six migrations listed in docs/release/r20-v10/candidate.json. No production SQL was executed.

## Static result

All six files match the SHA-256 values recorded in the F0 candidate manifest. The review found no DROP, TRUNCATE, or DELETE statement and no explicit BEGIN/COMMIT. The three Guest migrations are additive ownership/index changes. The two index migrations use CREATE INDEX CONCURRENTLY; they must be rehearsed with the pinned Prisma/PostgreSQL versions and must never be replaced by ordinary indexes merely to make a build green.

| Migration | SHA-256 | Static result | Production disposition |
|---|---|---|---|
| 20261003000000_r4_match_lifecycle | f972aeeed45e86192f9149dfa80b9fd1afd165ace1d53e13b37a5548052f1897 | 45 lines; no destructive statement | Previously conditionally approved; backup and rehearsal required |
| 20261004000000_r9_bot_library | 5b64b99562adb38a486bc6952c5e46dd3d5b04827e15e2c2cead2c2b623ba8d1 | 40 lines; account ownership FK/indexes | Previously conditionally approved; backup and rehearsal required |
| 20261004093000_r13_history_replay | 84d2cbfd5293df6b528ad69e3dba2a3defa817d81aea74996e0411d167efcdab | 6 lines; nullable/default additive fields | Previously conditionally approved; backup and rehearsal required |
| 20261005000000_guest_bot_online | fc7b84db090c01f84a294b1ee65d3202a9d0a33c414a4007e2dea49285889238 | 22 lines; GuestSession, nullable account owner, Guest FK and NOT VALID XOR check | Exact production scope approval still required |
| 20261005000100_guest_bot_name_index | 09112eaf5ab3c076c0cae8cc4df0ffa6899972945e3749bae6be3645464f2d0f | 2 lines; CREATE UNIQUE INDEX CONCURRENTLY | Exact production scope approval and rehearsal required |
| 20261005000200_guest_bot_updated_index | 44f8451fa500c9b350b637744dbaae2aa16ac8ca2ec6d9f10b3f8f97a5c44bd3 | 2 lines; CREATE INDEX CONCURRENTLY | Exact production scope approval and rehearsal required |

## Compatibility questions still open

1. Query the target production _prisma_migrations ledger read-only before choosing the migration set. The candidate currently has six migrations after the origin/main baseline; this is not proof that all six are pending in production. The disposable populated rehearsal passed with representative User/Match/MatchPlayer rows; it does not substitute for this production read.
2. Before applying 20261005000000_guest_bot_online, check existing BotLibrary rows satisfy exactly one owner after the nullable/Guest expansion. The NOT VALID check intentionally avoids a historical scan; violations must be measured and resolved in a separately approved operation.
3. After the concurrent indexes, check pg_index.indisvalid and pg_index.indisready, and verify the unique Guest name invariant with a duplicate query.
4. Do not use prisma migrate resolve to hide a failed or partial migration. Record the failed statement and inspect the schema first.

## Rehearsal evidence

`docs/release/r20-v10/migration-rehearsal.json` records a fresh-cluster pass, a second idempotence pass, and a populated legacy-data pass. The populated run preserved `u-old`, `m-old`, and `mp-old`, observed `Match.playMode = MANUAL`, valid Guest indexes, and the intentionally `NOT VALID` owner check. This is local evidence only.

## Review verdict

PASS_SQL_STATIC_LOCAL_AND_POPULATED_REHEARSAL. This is not production approval. Production remains blocked until the exact migration scope is approved, a fresh production backup is hashed and privately restored, and the production migration ledger is checked read-only.
