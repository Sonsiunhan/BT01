# W4 report — candidate test, build và browser gate

Ngày: 2026-10-12  
Candidate branch: `codex/security-network-repair`  
Phạm vi: W4 của candidate repair; không push, không merge `test-v0.2` hoặc `main`.

## Kết quả gate

| Gate | Kết quả |
|---|---|
| Root Vitest (`tests/unit`, `tests/contract`, `tests/integration`) | **PASS** — 31 files, 217 tests; chạy `--testTimeout=60000` để không nhầm module startup/200k-bucket stress thành lỗi chức năng |
| Server unit Vitest | **PASS** — 39 files, 247 passed, 6 skipped; 6 skip là Wasmtime adapter chưa có runtime proven |
| Web Vitest | **PASS** — 51 files, 225 tests |
| Web typecheck | **PASS** |
| Web ESLint | **PASS** — `--max-warnings 0` |
| Web Vite production build | **PASS** — có cảnh báo chunk chính sau minify >500 kB, cần tối ưu sau; build không fail |
| Server TypeScript build | **PASS** |
| Runtime artifact pin test | **PASS** — 2/2 |
| Provider probe mặc định | **NOT RUN** — exit 0 ở chế độ không `RENDER`/`R3_PROVIDER_PROBE`; chưa phải evidence provider/runtime thật |
| Prisma generate | **PASS** |
| Prisma schema validate | **PASS** với dummy `DATABASE_URL`; không kết nối DB |
| Targeted Playwright Bot Workbench/Online | **PASS** — 2/2 trên Vite local, API mock theo fixture E2E |
| Isolated disposable PostgreSQL / migration / DB integration | **BLOCKED / NOT RUN** — chưa có `security-network-repair-isolated-db.mjs`; không dùng default/shared DB |

Các lệnh chính đã chạy:

```text
node node_modules/vitest/vitest.mjs run --config vitest.w3.config.ts tests/unit tests/contract tests/integration --testTimeout=60000 --reporter=default
cd apps/server; node node_modules/vitest/vitest.mjs run --config vitest.config.ts test/unit --testTimeout=60000 --reporter=default
cd apps/web; node node_modules/vitest/vitest.mjs run --config vite.config.ts --pool=threads --maxWorkers=1 --minWorkers=1 --testTimeout=60000 --reporter=dot
cd apps/web; node node_modules/eslint/bin/eslint.js . --max-warnings 0
cd apps/web; node node_modules/vite/bin/vite.js build
node node_modules/typescript/bin/tsc -p apps/server/tsconfig.json
node --test scripts/r3-artifact-pins.test.mjs
node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma
DATABASE_URL=postgresql://unused:unused@127.0.0.1:1/w4_schema_only prisma validate --schema prisma/schema.prisma
E2E_BASE_URL=http://127.0.0.1:4173 node node_modules/playwright/cli.js test tests/e2e/r9-bot-workbench.spec.ts tests/e2e/r10-bot-online.spec.ts
```

## Môi trường và giới hạn

- Repo yêu cầu `pnpm >=12.6.0`, nhưng runtime hiện có `pnpm 11.25.0`; Corepack không tải được 12.6.0 do DNS/network bị chặn. Vì vậy lệnh `pnpm run build:*` chính thức bị **BLOCKED**.
- Để vẫn kiểm tra source, đã chạy compiler binary cục bộ: game-rules, contracts và bot-sdk đều compile được; contracts/bot-sdk dùng alias tạm thời tới dependency đã có trong `apps/server/node_modules`, alias đã xóa và không đưa vào sản phẩm.
- Browser gate chạy trên Vite local. Các test R9/R10 mock API theo fixture, nên chứng minh UI route/observable behavior chứ không chứng minh server + DB production.
- Không chạy `db:migrate`, `db:deploy`, không dùng `DATABASE_URL` mặc định và không mutate database dùng chung.

## Gaps còn lại trước W5

- Cần isolated PostgreSQL harness để chạy migration, server integration và crash/restart boundary. W4 chưa được coi là DB integration complete.
- Provider/Wasmtime thật, adversarial runtime, load/mixed attack, durable exactly-once qua restart và backup/retention vẫn theo verdict BLOCKED của W0–W3.
- SEC-04/SEC-05/LONG-07 vẫn giữ BLOCKED do quota/NAT/trusted identity chưa chốt; SEC-07/SEC-09/LONG-09 vẫn chưa có full harness evidence.
- Cảnh báo web bundle >500 kB là follow-up tối ưu, không phải lỗi build W4.

## Skills đã áp dụng

- `ecc:delivery-gate`: áp dụng nguyên tắc không tuyên bố DONE khi package manager/DB/provider gate thiếu evidence; tách PASS, BLOCKED và NOT RUN.
- `ecc:e2e-testing`: chạy Playwright với Vite local, fixture route observable, worker ổn định và lưu rõ giới hạn mock/backend.
- `ecc:production-audit`: phân biệt build/unit/browser mock với isolated DB, runtime/provider và production evidence; không dùng dummy DB thay thế.
- `ecc:git-workflow`: giữ candidate branch riêng, không push/merge, dọn chỉ các log tạm do W4 tạo.

## Verdict

W4 đạt các gate build, lint, typecheck, root/server/web test và targeted Bot browser trong môi trường local. W4 **DONE scoped nhưng chưa đủ điều kiện promotion** vì isolated DB/migration và runtime/provider evidence còn BLOCKED; chuyển W5 để review diff, kiểm tra evidence và quyết định local promotion có điều kiện.
