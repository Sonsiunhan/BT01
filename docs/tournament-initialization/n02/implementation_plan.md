# N02 — Implementation plan: API validate/preview luật giải

**Owner:** Nguyễn Tiến Nam  
**Task:** N02  
**Trang:** P04 — Cấu hình luật  
**Dependencies:** N01, L01; G0 PASS về requirements  
**Status:** IMPLEMENTED — evidence và giới hạn ở N02-RESULT-2026-10-22.md

## 1. Mục tiêu

Cung cấp endpoint TA có thể gửi bản nháp luật và nhận kết quả validate/preview deterministic từ engine thật. Response phải cho widget P04 biết profile đã chuẩn hóa, lỗi theo field, legal moves của cả hai bên và các check BR-11; preview chỉ đọc, không publish, không reserve quota và không ghi DB.

Independent requirements review N02 đã kiểm tra 12/12 AC (100%), không còn gap P0/P1 yêu cầu. Snapshot policy dùng \`docs/tournament-initialization/N00-DECISIONS-2026-10-21.md\` revision2 và N01 result.

## 2. Phạm vi

### In scope

- Additive typed contracts cho engine rule profile và validate/preview request/response; giữ nguyên \`TournamentRuleProfileSchema\` L01 timing/result policy để không phá consumer.
- Canonical game-rules preview seams:
  - strict tournament validation mode (caps/policy);
  - legal move list theo cả BLUE và RED;
  - basic static-goal reachability.
- Pure preview service + Fastify route:
  \`POST /tournaments/:tournamentId/rule-profile/validate-preview\`
- Server authentication/TA owner + active contract binding + expected tournament revision check.
- Deterministic profile digest, normalized profile, typed errors/warnings/checks.
- Harness/unit tests cho happy path, golden moves, rectangular board, caps/version/unsupported goal, stale revision, auth/scope, no mutation và package typecheck.

### Out of scope

- Publish/approval/config-version mutation, draft persistence, quota/reservation.
- CYCLE/SEEDED goal runtime; preview phải trả \`UNSUPPORTED_CAPABILITY\`.
- Bot/WASM/runtime receipt, settlement, rating, fairness/strategy proof, UI P04 hoàn chỉnh, Prisma migration/load proof.
- Sửa các contract L01 cũ ngoài additive export cần cho N02.

## 3. Contract/API quyết định

### Request

    POST /tournaments/:tournamentId/rule-profile/validate-preview

    {
      "expectedConfigRevision": 3,
      "draftRevision": 7,
      "profile": {
        "schemaVersion": "tournament-rule-profile.v1",
        "engineProfileVersion": "rps-custom-v1",
        "baseTemplateId": "optional-template",
        "sameMovementForBothSides": true,
        "directionSystem": "RELATIVE",
        "profile": { "...": "N01 RuleProfile fields" }
      }
    }

- \`tournamentId\` lấy từ URL; payload không được quyết định actor/role/tenant.
- \`expectedConfigRevision\` đối chiếu server \`Tournament.revision\`; stale request bị từ chối trước preview.
- \`draftRevision\` chỉ là context echo để widget bỏ response cũ.
- \`directionSystem=RELATIVE\` chuẩn hóa vector RED bằng rotate180; \`sameMovementForBothSides\` là builder convenience, output luôn explicit BLUE/RED. \`ABSOLUTE\` giữ vector như input.
- \`profile.version\` chỉ chấp nhận engine versions đã đăng ký (\`rps-v1\`, \`rps-v2\`, \`rps-custom-v1\`); version khác trả lỗi typed.
- Goal STATIC chạy preview; CYCLE/SEEDED parse được nhưng trả \`UNSUPPORTED_CAPABILITY\`, không diễn giải ngầm.
- Fixed RPS capture policy do engine giữ, không nhận capture matrix tùy ý.
- Profile digest do server tính từ canonical normalized JSON.

### Response

    {
      tournamentId, contractId, expectedConfigRevision, draftRevision,
      schemaVersion, engineProfileVersion, capabilitiesVersion,
      profileDigest, normalizedProfile,
      valid,
      errors: [{ path, code, messageKey, message }],
      warnings: [{ path, code, messageKey, message }],
      checks: {
        structural, initialNonTerminal, initialLegalMoves,
        goalReachability, runtime: "NOT_CHECKED"
      },
      legalMovesBySide: { BLUE: [{ from, to }], RED: [{ from, to }] },
      runtimeStatus: "NOT_CHECKED"
    }

Response 200 cho profile domain-invalid nhưng parse được; request shape/auth/revision errors dùng error envelope hiện tại. Không claim fairness/strategy/capacity.

## 4. File ownership

- \`packages/contracts/src/tournament-rules-preview.ts\` (new) và \`packages/contracts/src/index.ts\`: additive Zod/DTO schemas.
- \`packages/game-rules/src/types.ts\`, \`setup.ts\`, \`engine.ts\`, \`index.ts\`: strict preview validation, legal move seam, goal reachability; legacy one-argument validator and old profiles remain compatible.
- \`apps/server/src/modules/tournament-rules-preview/rules-preview.service.ts\` (new): scope reader, canonical profile normalization, engine adapter, digest, typed result.
- \`apps/server/src/modules/tournament-rules-preview/rules-preview.route.ts\` (new): auth, body/path parsing, route errors.
- \`apps/server/src/app.ts\`: register route and injectable service/reader.
- \`tests/contract/tournament-rules-preview.contract.test.ts\` (new).
- \`tests/unit/tournament-rules-preview.service.unit.test.ts\` (new).
- \`apps/server/test/unit/rules-preview.route.unit.test.ts\` (new).
- \`docs/tournament-initialization/n02/N02-RESULT-2026-10-22.md\` after verification.

Do not stage \`AGENTS.md\` or unrelated untracked work.

## 5. Harness first

1. Add failing contract tests for full profile, unknown version, CYCLE/SEEDED typed unsupported, field bounds/caps.
2. Add failing game-rules tests for strict max RAY distance, non-empty win conditions/extinction counts, both-side legal moves and static goal reachability.
3. Add failing service/route tests for golden moves, deterministic digest, TA owner/binding, stale revision, no DB mutation and no payload actor trust.
4. Run focused harness and record red result before implementation.

## 6. Implementation order

1. Add contract schemas and exported types without changing L01 schema.
2. Add game-rules preview seams and strict validation mode; preserve all N01/legacy tests.
3. Implement pure service and scope port; default Prisma reader only reads Tournament + contract binding.
4. Register route and dependency injection in app.
5. Run focused tests, package typechecks, server typecheck, then proportionate contract/unit/integration tests.
6. Review privacy/auth/error/loading contract and clean only new obsolete code.

## 7. Acceptance criteria

- N02-AC01..AC12 from independent review all have passing evidence.
- Engine receives normalized typed RuleProfile; no duplicated movement logic in route.
- Golden legal moves are identical for repeated calls and include both sides on rectangular boards.
- Errors include stable path/code/messageKey for invalid board/layout/counts/movement/goal/win/version/capability.
- Initial non-terminal, each side initial legal move and static goal reachability are explicit checks; no fairness/strategy claim.
- Preview does not mutate profile/state/database and never creates reservation/quota/config version.
- Unauthorized, non-owner, revoked binding, stale revision and forged actor payload are rejected.
- Legacy game-rules and L01 contract tests stay green.
- Runtime/capacity/database mutation/browser UI are reported NOT RUN where not implemented.

## 8. Verification

    node_modules/.bin/vitest.cmd run tests/contract/tournament-rules-preview.contract.test.ts tests/unit/tournament-rules-preview.service.unit.test.ts apps/server/test/unit/rules-preview.route.unit.test.ts tests/unit/l01-harness.unit.test.ts tests/unit/game-rules.unit.test.ts
    node_modules/.bin/tsc.cmd -p packages/contracts/tsconfig.json --noEmit
    node_modules/.bin/tsc.cmd -p packages/game-rules/tsconfig.json --noEmit
    node_modules/.bin/tsc.cmd -p apps/server/tsconfig.json --noEmit

No DB migration or shared/default DATABASE_URL mutation is part of N02.

