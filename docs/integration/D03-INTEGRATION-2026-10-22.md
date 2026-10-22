# Tích hợp chọn lọc D03 — 22/10/2026

- Nguồn: `origin/duc-tournament`, commit `2caa2773b9b764be6b777b2e85d69e65e700cec8` — `complete D03`, tác giả Duclehoho.
- Đích: `tournament-initialization`, nền `67cea417b3c15cc2bd95e9424a98b219ab80a420`.
- Chỉ lấy thay đổi D03: contracts, parser/preview CSV và XLSX, route, đăng ký server, dependency và test. Giữ các sửa CI đã có trên đích; không lấy toàn bộ nhánh cũ của Đức. Xung đột `app.ts` được giải bằng cách giữ cả rules preview hiện có và roster preview mới.
- ECC `git-workflow`: tách worktree và commit D03 khỏi N04 đang dở. ECC `security-review`: kiểm tra quyền, phạm vi đơn vị, giới hạn import và dependency runtime. Matt Pocock `diagnosing-bugs`: tái hiện lỗi bằng regression trước khi sửa.

## Các lỗi D03 đã xử lý khi tích hợp

1. Client tự tăng `maxRows`: giới hạn hiệu lực không vượt mức mặc định canonical 2.000 dòng; vẫn cho phép thu hẹp.
2. Client tự khai đơn vị: route lấy phạm vi từ DB; TA chỉ có đơn vị thuộc hợp đồng ACTIVE, còn hạn, có binding ACTIVE của chính tài khoản. Bộ lọc client chỉ thu hẹp phạm vi này. SYSTEM_ADMIN xem đơn vị ACTIVE.
3. DB lỗi hoặc scope rỗng từng bỏ qua kiểm tra đơn vị: DB lỗi trả 503; scope rỗng không chấp nhận đơn vị nào.
4. Route chỉ dùng role canonical từ tài khoản đã xác thực; bỏ alias `ADMIN` và mảng role tùy ý. Thông báo quyền được Việt hóa.
5. Parser phải có khi chạy production: chuyển `csv-parse` và `xlsx` từ devDependencies sang dependencies, đồng bộ lockfile. Giới hạn body route đủ cho tệp 2 MiB mã hóa base64 và phần JSON.

## Bằng chứng

- Trước sửa: 17 test gốc PASS; 3 regression mới FAIL đúng các lỗi tăng cap, scope rỗng và DB fail-open.
- Sau sửa: 22/22 test D03 PASS, gồm test HTTP thật qua Fastify injection với phạm vi đơn vị giả mạo.
- Regression server D02/bootstrap/rules preview cùng D03: 56/56 PASS.
- Regression rules N02/N03 và foundation L02: 53/53 PASS.
- `pnpm typecheck`: PASS toàn workspace sau khi sinh Prisma client cục bộ.
- `pnpm build`: PASS; 4 test artifact pin/db-deploy kèm build PASS.
- `node scripts/b14-release-gate.mjs`: PASS. Initial JS 163,1 KiB gzip; tổng JS 289,9 KiB gzip, trong giới hạn 170/300 KiB.
- `git diff --check`: PASS.
- Không chạy migration hoặc kiểm thử DB thật. Không gọi đây là toàn bộ GitHub CI PASS khi chưa push/chạy CI trên remote. Một lượt test server rộng trước build gặp package chưa build và timeout SSE; bằng chứng tích hợp ở trên là các gate tập trung sau build/typecheck.

## Giới hạn phạm vi

Commit nguồn chưa chứa frontend P10 hay staging lưu bền. Tích hợp phần preview backend không đồng nghĩa toàn bộ D03 FE/BE trong DELIVERY-PLAN đã DONE. Import commit/account reuse vẫn thuộc D04. N04 và thay đổi chưa commit ở workspace chính không nằm trong commit tích hợp này.
