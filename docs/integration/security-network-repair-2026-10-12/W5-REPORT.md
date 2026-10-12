# W5 report — review, cleanup và promotion gate

Ngày: 2026-10-12
Candidate: `codex/security-network-repair`, base `test-v0.2@277c627b78586639e40366e2ab6f544d93da69aa`.

## Review đã thực hiện

- Rà shared files `app.ts`, CORS/CSRF, auth throttle, room manager, command ledger memory/Prisma, match lifecycle/settlement, error handler và web move client.
- Kiểm tra actor/identity scope của command ledger, payload fingerprint, room lock cleanup, clock/reconnect, CSRF origin precedence, error allowlist/log redaction và fallback behavior.
- Đối chiếu evidence W0–W4 với AC-01…AC-22; không gọi các G gate runtime/DB/provider/load là DONE.
- Settlement review không phát hiện đường double-settle mới; guard process-local/durable history vẫn không chứng minh exactly-once qua restart, nên LONG-01/LD04 tiếp tục BLOCKED.

## Cleanup

- Loại toàn bộ `.agents/` khỏi candidate Git tree. Đây là tooling ECC bị nhánh Security kéo theo, không có consumer runtime; thư mục vật lý vẫn được giữ trong checkout local và tiếp tục bị ignore.
- Loại `apps/server/src/test-csrf.ts`, script debug không nằm trong package entry/test script và dùng `ALLOWED_ORIGINS`/default DB nên không phù hợp làm evidence.
- Giữ nguyên security modules, fixtures, reports, probes và W3 candidate config vì chúng có consumer hoặc là evidence tái lập được.
- Không xóa user work, historical evidence, `.worktrees/` hay thay đổi checkout `D:\BT01`.

## M-gate verdict

| AC | Verdict | Evidence |
|---|---|---|
| AC-01/02 | **PASS** | Candidate isolation, baseline artifacts, known G findings tách riêng |
| AC-03 | **PASS scoped** | Direct server/web/package compiler, typecheck/lint/build; official pnpm command BLOCKED bởi pnpm 11.25/Corepack network |
| AC-04/05 | **PASS** | CSRF route/probe và reconnect clock evidence |
| AC-07 | **PASS** | AbuseLimiter mới không được wire; existing AuthThrottle/capacity/CSRF controls giữ nguyên |
| AC-08/09/10/11 | **PASS** | W3 privacy, W2 ledger/payload/UUID/lock tests |
| AC-12 | **PASS scoped** | Candidate diff review và regression suites không thấy conflict marker/regression mới |
| AC-20/21 | **PASS scoped** | Root 31/217, server 247/253 (6 Wasmtime skip), web 225/225, targeted Playwright 2/2; DB không dùng shared/default |
| AC-22 | **PASS self-review** | Không phát hiện P0/P1 mới do repair; independent code/release review vẫn BLOCKED riêng, no-release verdict giữ nguyên |

## Gaps còn giữ nguyên

AC-06 quota policy, AC-13/14 durable/setup, AC-15 SSE, AC-16/17 runtime sandbox, AC-18 crash/backup/retention, AC-19 mixed load/provider và isolated PostgreSQL migration chưa có evidence thật. Các mục này là **BLOCKED/NOT RUN**, không được dùng để quảng bá production/tournament readiness.

## Verdict

W5 review/cleanup **DONE scoped**. Candidate đủ điều kiện promotion local phát triển theo 14 M với các giới hạn đã nêu; không đủ điều kiện release. Promotion chỉ được thực hiện vào checkout `test-v0.2` sạch, không push/deploy/main/shared DB.
