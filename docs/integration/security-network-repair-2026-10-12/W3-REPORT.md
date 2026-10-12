# W3 report — privacy, security assertions và integration review

Ngày: 2026-10-12  
Candidate branch: `codex/security-network-repair`  
Base: `test-v0.2@277c627b78586639e40366e2ab6f544d93da69aa`  
Phạm vi: W3 của candidate repair; không push, không merge `test-v0.2` hoặc `main`.

## Thay đổi đã thực hiện

- Error envelope dùng allowlist bounded cho `AppError.details`; chỉ giữ các trường vận hành an toàn, bỏ source/input/stack/token/cookie và cấu trúc lồng nhau. Error logger ghi `publicCode`, status và loại lỗi, không ghi nguyên object lỗi.
- Thêm regression test `apps/server/test/unit/error-handler.unit.test.ts` với canary riêng tư để kiểm tra cả response boundary.
- Sửa tám assertion security-core theo API engine thật (`result.error.code`).
- Bổ sung kiểm thử hard-cap 50.000 bucket và TTL expiry của `AuthThrottle` bằng fake clock; test thật sự chạm cap và cùng instance sau thời gian hết hạn.
- Sửa hai seed phòng dùng `crypto.randomInt`, loại nguồn ngẫu nhiên yếu khỏi path tạo phòng và làm regression crypto-random pass.
- CSRF integration test dùng route thật `POST /auth/logout`, môi trường test với database dummy explicit và kiểm tra status/reason cụ thể; không dùng default `DATABASE_URL`.
- Thêm `w3-security-probe.mts` và artifact `w3-security-probes.json` cho Fastify inject + dummy database. Probe chạy các nhánh valid CSRF, thiếu marker, origin xấu và public error redaction.

## Evidence

| Gate | Kết quả |
|---|---|
| SEC-06 — public error/log privacy | **PASS** — canary `W3_PRIVATE_CANARY` và private source không xuất hiện; safe `reason` vẫn giữ |
| SEC-08 — security-core assertions/crypto seed | **PASS** — 28 security-core tests |
| SEC-10 — CSRF route/config | **PASS** — 5 integration tests; probe POS 204, NEG 403, evil origin 403 với `CSRF_ORIGIN_NOT_ALLOWED` |
| W3 root focused suite | **PASS** — 2 files, 33 tests |
| Server redaction test | **PASS** — 1 test |
| W2 ledger/room regression after W3 | **PASS** — 5 files, 46 tests |
| Server typecheck | **PASS** |
| Web typecheck | **PASS** |
| `git diff --check` | **PASS** |

Commands đã chạy:

```text
node apps/server/node_modules/tsx/dist/cli.mjs w3-security-probe.mts
node node_modules/vitest/vitest.mjs run --config vitest.w3.config.ts tests/unit/security-core.unit.test.ts tests/integration/csrf.integration.test.ts --reporter=default
cd apps/server; node node_modules/vitest/vitest.mjs run --config vitest.config.ts test/unit/error-handler.unit.test.ts --reporter=default
cd apps/server; node node_modules/vitest/vitest.mjs run --config vitest.config.ts test/unit/command-ledger.unit.test.ts test/unit/commit.memory.unit.test.ts test/unit/commit.prisma.unit.test.ts test/unit/room.manager.unit.test.ts test/unit/room.route.unit.test.ts --reporter=default
node node_modules/typescript/bin/tsc -p apps/server/tsconfig.json --noEmit --pretty false
node node_modules/typescript/bin/tsc -b apps/web/tsconfig.json --pretty false
git diff --check
```

`vitest.w3.config.ts` chỉ là cấu hình kiểm thử candidate, alias `zod` tới dependency đã có trong `apps/server/node_modules`; không thay đổi dependency production hay junction `node_modules` dùng chung.

## Settlement và các gate chưa đạt

- Đã review đường `settle`/`MatchHistoryService.record`: khóa process-local theo `roomId:stateVersion`, rating finalize có guard durable và history record idempotent. W3 không thêm đường double-settle mới. Đây **không** phải bằng chứng exactly-once bền vững qua restart; LONG-01/LD04 vẫn BLOCKED.
- SEC-04/SEC-05 và LONG-07 vẫn **BLOCKED/known fail**: chính sách NAT/quota chưa chốt, không wire `AbuseLimiter` mới và không hạ existing controls.
- SEC-07/SEC-09/LONG-09 vẫn **BLOCKED/NOT RUN**: mixed adversarial load/provider/live harness chưa có evidence thật.
- Các gate runtime Python/sandbox, descriptor/setup, SSE/backpressure, crash/backup/retention và isolated DB thuộc W4/G, chưa được tuyên bố PASS trong W3.

## Skills đã áp dụng

- `ecc:security-review`: thiết kế allowlist privacy, kiểm tra CSRF/error boundary và giữ các abuse gate chưa đủ bằng chứng ở trạng thái BLOCKED.
- `ecc:production-audit`: phân biệt evidence Fastify inject/unit với runtime/DB production, ghi rõ các gate chưa chạy và giới hạn exactly-once.
- `ecc:git-workflow`: giữ candidate checkout/branch riêng, không push/merge nhánh dùng chung và bảo toàn artifact lịch sử.
- `ecc:intent-driven-development`: bám acceptance W3, sửa test theo contract engine/route thật và không biến known fail thành PASS giả.

## Verdict

W3 **DONE scoped**: các acceptance privacy, assertion và CSRF integration của W3 có evidence PASS; không phát sinh blocker P0/P1 mới trong phạm vi wave. Candidate vẫn chưa phải production/tournament-ready và cần W4–W5 để chạy các gate còn lại, review diff và quyết định promotion local.
