# Merge Sơn + Long vào test-v0.2

Ngày kiểm tra: 12/10/2026 (UTC+7). Writer duy nhất: Codex/Nam, theo yêu cầu merge local của người dùng trước W0. Không giao code cho người khác.

## Nguồn và nơi làm việc

| Thành phần | Ref | Commit |
|---|---|---|
| Nền main | origin/main | dbda8a9a17a91b7d24237feb3041fa924416f3f9 |
| Sơn (tên ref thực tế) | origin/feature/refactor-FE-Son | 68838f81203adb951350c0f1fc81c19175bdaf7f |
| Long | origin/network-core-v0.2 | 4ba4a5e8b667bd3a7e323c6ea22da2938afeccd4 |

Checkout tích hợp: `C:/Users/Admin/.codex/worktrees/test-v02-integration/BT01`, nhánh `test-v0.2`. Bắt đầu từ main, fast-forward Sơn rồi merge Long bằng merge commit để giữ lịch sử cả hai. Không push, không deploy, không sửa production/shared DB, không chuyển nhánh hoặc ghi đè thay đổi trong `D:/BT01`. Không bắt đầu W0 hoặc đồng hồ 24 giờ của Bot.

Đã đọc bàn giao Sơn (SON, tasks S-W01–S-W08) và Long (NETWORK-CORE-HANDOFF, FRS/runbook, các handoff liên quan). Những PASS trong tài liệu gốc là evidence của owner ở bản cũ; kết quả dưới đây là kiểm tra mới trên nhánh tích hợp.

## Xung đột và xử lý

| Điểm | Cách xử lý |
|---|---|
| network-core/README.md, add/add | Giữ hàng Master handoff của Long và separator bảng từ main. |
| FRS-L07-CAPACITY-INTEGRATION-RUNBOOK.md, add/add | Giữ yêu cầu có sẵn và bổ sung liên kết runbook mới của Long. |
| ResultPanel tự merge nhưng thiếu hiển thị NO_LEGAL_MOVES | Giữ xử lý hòa của Sơn, lý do mới của Long; thêm diễn giải thắng/thua khóa nước đúng phía. |
| LocalGamePage còn tự phân xử khóa nước | Bỏ helper luật trùng lặp; dùng applyMove/evaluateTurnStart của engine chuẩn cho lượt Bot, lượt người và phiên khôi phục. Không đổi luật engine. |
| Lint phần network mới | Sửa type test, import/biến không dùng, giải thích các catch cách ly callback; không tắt lint hay giảm assertions. |
| Script hashbang CRLF trên Windows | Chuẩn hóa LF và thêm .gitattributes giới hạn scripts/network/*.mjs. Nội dung logic các script giữ nguyên. |
| Test W12 đọc tài liệu lịch sử đã bị main xóa | Khôi phục đúng W12_IMPLEMENTATION_PLAN.md từ a56e77b, thêm nhãn lịch sử; không coi đó là kế hoạch hiện hành hay evidence deploy. |
| E2E cũ khác bàn giao Sơn | Cập nhật nhãn nhật ký tiếng Việt; chờ trạng thái animation ổn định trước axe; kiểm tra cuộn ngang; kiểm tra nickname chỉnh sửa được và lưu lại; hủy queue chờ ACK rồi ở nguyên trang, nút Về sảnh mới điều hướng. |
| Test backup đòi POSIX mode 0600 trên Windows | Không nới guard. Gate file permissions đầy đủ chỉ chạy POSIX; Windows có test xác nhận từ chối BACKUP_SECURITY. Gate POSIX chưa được nghiệm thu tại đây. |

Regression trước sửa khóa nước: 4 FAIL; sau sửa: 13 PASS trong hai file liên quan. Lưu semantic-before/after.json. Các lần thất bại đầu khác được lưu trong root-before, server-before, server-before-permissions và browser-before.json. Lần axe quét khi panel đang fade-in lưu browser-animation-before.json; helper chỉ chờ animation hữu hạn kết thúc trước khi quét, không tắt luật contrast.

## Kiểm tra mới

Kết quả cuối và hash evidence ở verification.json; danh sách test cụ thể trong các JSON cùng thư mục. SHA-256 của evidence văn bản được tính sau chuẩn hóa CRLF thành LF để có thể đối chiếu ở cả Windows và Linux.

- Cài dependency đúng lockfile, build packages và Prisma generate: PASS.
- Lệnh tái chạy chính: corepack pnpm run typecheck; corepack pnpm run lint; corepack pnpm run build; node scripts/integration/test-v02-safe-db.mjs; node node_modules/playwright/cli.js test --config scripts/integration/test-v02-browser.config.ts. Web: từ apps/web chạy node ../../node_modules/vitest/vitest.mjs run --maxWorkers=2.
- Harness DB từ chối checkout có .env và chỉ chạy trên cluster mới tự tạo; giữ nguyên điều kiện này khi tái chạy. Browser harness từ chối cổng đã có dịch vụ, không dùng lại server sẵn.
- Typecheck, lint, build: PASS. Build còn cảnh báo bundle frontend lớn hơn 500 kB và annotation dependency; không đổi ngưỡng để giấu cảnh báo.
- Root unit/contract/integration: 144 PASS, không FAIL.
- Frontend Vitest: 225 PASS, không FAIL.
- Server Vitest: 293 PASS, không FAIL, 8 SKIP (7 cần Wasmtime/CPython-WASI thật, 1 gate POSIX backup permissions).
- Migration deploy: PASS trên cluster PostgreSQL 17 mới, localhost, database ottv2_test_merge_1791770734305; đã dừng cluster, giữ thư mục tạm để kiểm tra. isolated-db.json ghi rõ datasource không phải production.
- Auth/profile integration có Prisma thật trên database trên. Các crash/restore/commit rehearsal dùng mock/in-memory theo source gốc, không phải chứng minh crash-recovery PostgreSQL thật.
- Browser: **44 PASS, 0 FAIL, 0 SKIP** ở lần chạy cuối; xem browser-tests.json/verification.json. Dùng Chrome headless, Vite riêng, API guard localhost:3001 từ chối request không mock, service worker bị tắt. Đây là browser fixture suite, không phải E2E với backend production.
- Test hai tab Guest từng timeout khi chờ toàn bộ load event. Đổi navigation test sang domcontentloaded và chờ UI bằng assertions; test riêng đạt 1/1, nhóm Guest chạy lặp đạt 9/9 với timeout/assertions giữ nguyên. Diagnostics được gắn vào kết quả test; không đổi khóa Guest của ứng dụng. Chạy toàn bộ cuối bằng một worker; test hai tab vẫn dùng Promise.all để kiểm tra concurrency. Lưu browser-resource-timeout.json, không che lần FAIL.

## Bảo toàn thay đổi và review

preservation.json đối chiếu blob của 55 file Sơn và 164 file Long. 51/55 file Sơn và 151/164 file Long giữ nguyên blob; mọi khác biệt còn lại thuộc các xử lý tích hợp liệt kê trên. File giao nhau giữa hai nhánh là ResultPanel.tsx; hai xung đột docs phát sinh với main. Các bài E2E sửa bổ sung thuộc baseline và được ghi rõ ở bảng trên.

Đã review diff các điểm sửa, đối chiếu ownership/handoff, kết quả khóa nước, canonical orientation, public/private dữ liệu theo test hiện có; không thay schema, quyền hay nguồn Python của người chơi trong các fix tích hợp. Không còn conflict marker/unmerged path. Không mass-format whitespace trong tài liệu bàn giao hoặc sửa evidence/manifests đóng băng của Long.

Review tích hợp này do chính writer thực hiện cùng regression/preservation checks; không tuyên bố có independent code-review pass. Dedicated requirements reviewer trước đó chỉ nghiệm thu yêu cầu Bot, không phải nghiệm thu code merge này.

ECC đã đọc/áp dụng trong lượt: git-workflow (merge giữ lịch sử/checkout riêng), intent-driven-development (DoD cụ thể), ai-regression-testing (FAIL trước fix), e2e-testing (browser gates), security-review (giữ fail-closed, cách ly DB/API, rà public/private seams).

## Giới hạn cần xử lý trước W0 hoặc phát hành

1. **P1 — Persistence runtime:** buildApp mặc định không tạo/nối PrismaCommitPort; MatchManager dùng InMemoryCommitPort mặc định và đường move đồng bộ. Các test rehearsal không chứng minh durable-before-ACK/recovery của tiến trình production. Đã giữ nguyên code Long; không coi việc merge là hoàn thành kết nối runtime này.
2. **P1 — Baseline Bot thay đổi:** contracts/rules/network/commit đã khác baseline lập kế hoạch Bot trước đây. Phải rà lại interface, dependency và feasibility harness trước W0; không dùng independent requirements-review cũ như code acceptance trên HEAD mới.
3. **Luật:** createInitialState mặc định rps-v1; setup rps-v2 là opt-in. Không tự bật rps-v2 cho mọi trận để khớp câu chữ handoff. Tài liệu Long có mô tả setup khác nhau; hành vi engine thực tế là nguồn đầu vào cho Bot theo quyết định 23A.
4. Wasmtime thật, gate POSIX backup, kill/restart DB thật, tải production/10k CCU và triển khai Render: **NOT RUN / NOT PROVEN**. Không dùng mock hoặc lịch sử PASS thay thế.
5. Các backlog Bot/ADMIN/hướng dẫn/Ranked của Nam vẫn là đợt Bot riêng; không triển khai lẫn trong merge này. Tài liệu Bot và thay đổi chưa commit của Nam trong checkout gốc được giữ nguyên.

Nhánh này là bản tích hợp local để tiếp tục kiểm thử và rà dependency; không phải phê duyệt đưa lên main hoặc production.
