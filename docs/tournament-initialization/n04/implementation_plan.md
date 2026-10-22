# N04 — Implementation plan

**Owner:** Nguyễn Tiến Nam
**Branch:** `nam-tournament`
**Task:** N04 — Comparator và API version/publish
**Pages:** P04, P05
**Dependencies:** N03, L02
**Requirements gate:** PASS, 20/20 AC (100%), P0/P1/P2 = 0
**Status:** N04-owned DONE/PASS; overall version/publish flow BLOCKED_ON_L05_INTEGRATION

**ECC skills applied:** `ecc:intent-driven-development` (derive acceptance from approved decisions), `ecc:blueprint` (map boundaries and ownership before edits), `ecc:contract-first` (schema/port before route implementation).

## 1. Mục tiêu

Đưa quy tắc phân xử exact-tie thành comparator thuần, có trọng số hữu hạn và thứ tự lexicographic đã chốt; cung cấp hợp đồng và route adapter để liệt kê phiên bản luật, xem diff và gửi yêu cầu publish. N04 không ghi transaction publish canonical; L05 là single writer được gọi qua typed port.

## 2. Quyết định đã chốt

- Thứ tự comparator: `WEIGHTED_MATERIAL → GOAL_DISTANCE (nếu có) → MOBILITY`.
- Trọng số dùng chung cho hai bên, hữu hạn, trong khoảng `0..1000`, tối đa ba chữ số thập phân, không được đồng thời bằng 0; comparator dùng số nguyên đã scale để tránh sai số floating point.
- Material và mobility lớn hơn là tốt hơn. Goal distance nhỏ hơn là tốt hơn; bên reachable thắng bên unreachable; hai bên unreachable mới chuyển criterion tiếp theo.
- Event policy: `NO_LEGAL_MOVE` mặc định `COMPARE_CRITERIA`, có thể là `WIN`, `LOSS` hoặc `DRAW`; vi phạm own-turn là `LOSS`; lỗi hạ tầng là neutral; giới hạn ply/compute do policy snapshot quyết định.
- Exact tie dùng assignment người đi trước/thứ hai thực tế; mặc định `SECOND_MOVER_WINS`. `MANUAL` exact-tie chỉ TA owner được xử lý.
- Version snapshot bất biến; publish có `reason`, `effectiveAt`, exact profile reference/digest, `expectedRevision`, scoped `idempotencyKey`; `effectiveAt` phải không sớm hơn boundary tạo match mới.
- Route canonical: `GET /tournaments/:tournamentId/rule-versions`, `GET /tournaments/:tournamentId/rule-versions/:versionId/diff`, `POST /tournaments/:tournamentId/rule-versions/publish` (the server's existing route style has no `/api` prefix).
- N04 sở hữu comparator contracts, pure comparator và list/diff route adapters. L05 sở hữu canonical publish transaction qua `PublishRuleVersionPort`.

## 3. Phạm vi

### Trong phạm vi

- Schema additive cho comparator policy, metrics, comparison result, version list/diff/publish request-response và common errors.
- Pure comparator không đọc clock, DB, HTTP, UI hoặc actor từ payload.
- Digest/canonical serialization ở boundary để kiểm exact profile ref và idempotency payload.
- Route adapter với authoritative actor check, bounded cursor/limit, common error mapping và typed publish port. Tenant scope, expected-revision CAS, idempotency replay, effectiveAt envelope and old-match pinning are revalidated by the L05 port in its transaction; N04 does not duplicate that writer.
- In-memory fake port/store chỉ để harness route; không coi đây là L05 persistence.
- Tests cho comparator, contract boundaries, route success/empty/error/idempotency delegation và immutable old snapshots.

### Ngoài phạm vi

- Canonical publish transaction, database migration, reservation/effective schedule và match-create pinning thật của L05.
- Manual adjudication ledger/score replay của L08.
- UI P04/P05, Bot readiness, production deployment, shared DB mutation, load/runtime proof.

## 4. Thiết kế và ownership

| File/khu vực | Writer | Nội dung |
|---|---|---|
| `packages/game-rules/src/comparator.ts` | Nam | Pure comparator, metric normalization, exact tie/event outcomes |
| `packages/game-rules/src/index.ts` | Nam | Export additive comparator API |
| `packages/contracts/src/tournament-initialization.ts` hoặc module additive `tournament-rule-versioning.ts` | Nam theo single-writer hợp đồng N04 | Schemas/types; giữ compatibility với L01/N02/N03 |
| `apps/server/src/modules/tournament-versioning/versioning.port.ts` | Nam | `PublishRuleVersionPort`, list/diff read contracts |
| `apps/server/src/modules/tournament-versioning/versioning.route.ts` | Nam | Auth/scope, bounded pagination, error envelope, adapter gọi port |
| `tests/unit/n04-comparator.unit.test.ts` | Nam | Red/green comparator corpus |
| `tests/unit/n04-versioning.route.unit.test.ts` | Nam | Route adapter contract |
| `tests/contract/n04-versioning.contract.test.ts` | Nam | DTO boundary |
| L05 | Long | Canonical publish transaction implementation wired to typed port later |

Không sửa `apps/server/src/modules/tournament-core/*` trong N04 khi chưa có L05 writer. Không sửa shared router/style/UI.

## 5. Hợp đồng observable

### Comparator

`ComparatorPolicy` gồm `criteriaOrder`, `materialWeights` đã scale, `goalDistanceEnabled`, `mobilityEnabled`, `eventPolicies`, `drawEnabled`, `finalTiePolicy`, `manual{timeoutSeconds,fallback}` (timeout bounded 1..3600 giây; mặc định product 300 giây) và policy version. `ComparatorInput` gồm `firstMoverSide`, `metrics.BLUE/RED` (`materialByType`, `goalDistance` + `reachable`, `mobility`), `event` và pinned policy. `ComparisonResult` trả `winnerSide | null`, `reasonCode`, criterion đã quyết định, normalized metrics, first/second mover và `manualRequired`; không nhận winner từ client.

### Version list/diff

- `GET .../rule-versions?cursor=&limit=`: `limit` bounded theo capabilities (mặc định 20, tối đa 100), trả `items`, `nextCursor`, `configRevision` và metadata public; không trả private draft/source.
- `GET .../rule-versions/:versionId/diff?against=`: trả `baseVersionId`, `targetVersionId`, `changes[{path,before,after,impact}]`, `sameDigest`, `oldMatchesUnaffected`; ID ngoài tenant trả `NOT_FOUND` theo disclosure policy.
- `POST .../rule-versions/publish`: body `expectedRevision`, `profileRef`, `profileDigest`, `reason`, `effectiveAt`, `idempotencyKey`; route validates shape/actor and forwards the complete payload to L05, which revalidates tenant, digest, envelope, revision and effective boundary atomically.
- Response publish là `PUBLISHED` với immutable version hoặc `CHANGE_REQUEST_REQUIRED`; N04 không tự commit version.
- Common error envelope giữ mã public hiện có (`UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`); reason chi tiết là `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `OUTSIDE_ENVELOPE` hoặc `EFFECTIVE_AT_INVALID`, với HTTP 409/422 tương ứng.

## 6. Harness → Dev → Test

1. **Harness đỏ:** thêm vectors comparator (mỗi criterion, goal reachable/unreachable, all-zero weights, exact tie/first-second, event policy) và route contract tests (ACL, bounds, empty, diff, publish delegation, idempotency/error mapping).
2. **Contract:** thêm schemas/types và parse boundary; chạy contract tests trước khi implement service.
3. **Pure comparator:** implement integer scaled arithmetic, deterministic reason/criterion, event precedence và exact-tie output; freeze result/policy copies.
4. **Route adapter:** implement list/diff reads và publish typed-port delegation; server derives actor/scope, never trusts actor/role/winner in body.
5. **Compatibility:** run N01/N02/N03/L02 tests and package typechecks; confirm old `TournamentConfigVersion` fixtures parse unchanged.
6. **Review/clean:** inspect permission, race/idempotency delegation, disclosure, copy and diff; remove only newly introduced dead code.

## 7. Acceptance criteria

| ID | Tiêu chí observable | Evidence |
|---|---|---|
| N04-AC01 | Criteria order is deterministic and lexicographic | comparator vectors |
| N04-AC02 | Shared integer-scaled weights, bounded and non-all-zero | validation + vectors |
| N04-AC03 | Material winner uses configured weights | metric vectors |
| N04-AC04 | Reachable goal beats unreachable; lower distance wins | goal vectors |
| N04-AC05 | Mobility counts unique legal pairs and larger wins | mobility vectors |
| N04-AC06 | No-legal-move event follows pinned policy | event vectors |
| N04-AC07 | Draw/own-turn/infrastructure policies do not invent a winner | event vectors |
| N04-AC08 | Actual first/second assignment controls exact tie | tie vectors |
| N04-AC09 | MANUAL exact-tie is flagged TA-only | result contract |
| N04-AC10 | Version metadata is immutable and includes digest/reason/effectiveAt | contract test |
| N04-AC11 | Malformed publish payload is rejected before publish port call; semantic envelope checks remain L05-owned | route/contract test |
| N04-AC12 | Complete effectiveAt value is forwarded unchanged to the L05 port for atomic boundary validation | route test |
| N04-AC13 | L05 conflict is surfaced through the existing public `CONFLICT` envelope with a safe reason detail | route/port contract |
| N04-AC14 | List route has bounded pagination and scoped public metadata | route test |
| N04-AC15 | Diff route returns deterministic changed paths and old-match impact | route test |
| N04-AC16 | Publish route uses exact profile ref/digest and idempotency key | contract/route test |
| N04-AC17 | Same idempotency key and payload replays result | fake-port route test |
| N04-AC18 | Same key and different payload returns IDEMPOTENCY_CONFLICT | fake-port route test |
| N04-AC19 | Actor/tenant ACL denies forged scope and hides foreign IDs | route test |
| N04-AC20 | Existing match snapshots remain unchanged after version publication | immutable snapshot test |

## 8. Verification commands

```text
node_modules/.bin/vitest.cmd run tests/unit/n04-comparator.unit.test.ts tests/unit/n04-versioning.route.unit.test.ts tests/contract/n04-versioning.contract.test.ts
node_modules/.bin/tsc.cmd -p packages/game-rules/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p packages/contracts/tsconfig.json --noEmit
node_modules/.bin/tsc.cmd -p apps/server/tsconfig.json --noEmit
node_modules/.bin/vitest.cmd run --config apps/server/vitest.config.ts test/unit/tournament-l02-foundation.unit.test.ts test/unit/rules-preview.route.unit.test.ts
git diff --check
```

## 9. Completion boundary

N04-owned work is complete when the pure comparator, contracts and injected route adapter have evidence PASS. The overall versioning flow remains `BLOCKED_ON_L05_INTEGRATION` until L05 supplies the canonical transaction proving tenant scope, CAS, idempotency, effectiveAt boundary and old-match immutability. N04 does not claim that persistence boundary as implemented. Chưa push/deploy/merge trong task này nếu chưa có chỉ đạo riêng.
