# Guest Bot Online — workstream riêng

Trạng thái: DONE_SCOPED_LOCAL — GB01–GB06 có acceptance cục bộ và review độc lập PASS. Không thay thế acceptance V10/R20 hoặc phê duyệt phát hành production.

## Evidence cuối — 2026-10-05, supersede counts lịch sử bên dưới

- Server **160/160 PASS, không failed/skipped**: `robot-lab-visual-reference/v10-server-acceptance.json`. Disposable PostgreSQL17 `ottv2_r20_acceptance_1791204380991`, localhost15261, 16 migrations PASS, cluster đã dừng và giữ lại (`v10-isolated-db.json`).
- Frontend **169/169 PASS, không failed/skipped**: `robot-lab-visual-reference/guest-bot-web-tests.json`. Web typecheck/build, lint zero warnings và server TypeScript PASS. Warning Zod và entry500.85kB không được tính là performance PASS.
- Browser bản build cuối sau sửa frozen preview: **9/9 PASS, errors=[]**, measured `2026-10-05T12:55:16.771Z`, `robot-lab-visual-reference/guest-bot-online-browser.json`. API thật, DB disposable, pinned WASI và fixed fixtures; không mock/intercept, không mutation production. Bao gồm tìm/vào custom bằng UI, queue/hủy, preflight hai Guest, upload/activation, reload sau login giữ Guest, đầu hàng/lịch sử và nhập summary preview/retry/dedupe không Elo.
- Consent race có regression RED→GREEN: modal đóng băng đúng summary đã preview; record mới phát sinh không được tự thêm vào payload xác nhận. Full web trên source cuối đã chứa regression này.
- Test fixture local không chứng minh mọi file Python người chơi, Linux Render tải thật hoặc mọi failure/load path. Những lần preflight Windows fail-closed được giữ như diagnostic lịch sử; không tăng quota/bypass để lấy PASS.
- Không push/deploy, migration production hoặc mở Offline runtime. Phát hành và acceptance toàn bộ V10/R20 vẫn tách riêng.
- Review độc lập cuối: **GB01–GB06 scoped local PASS**, không còn scoped P0/P1/blocker được xác định trong source/evidence đã kiểm tra. Missing optional import và consent-race P2 đã đóng. Artifact: `robot-lab-visual-reference/v10-independent-review.md`. Reviewer đọc source/artifact, không tự chạy lại suite hoặc tác động production.
- Clean: diagnostic tạm đã gỡ, diff check PASS; giữ code/evidence cũ, user changes và DB disposable để kiểm tra. Không dùng dọn code làm lý do xóa worktree hoặc dữ liệu.

| ID | Đầu ra | Evidence bắt buộc |
| --- | --- | --- |
| GB01 | Cookie Guest opaque, khôi phục principal sau restart; không tạo User giả | DB disposable + auth restart/expiry/DB failure |
| GB02 | Thư viện trên thiết bị; chỉ revision người chơi chọn được đưa lên server tạm, kiểm tra sandbox Online | ACL hai Guest/tài khoản, TTL, runtime thật hai phe |
| GB03 | Guest queue Bot/custom, chọn/Ready/đấu/cập nhật/reconnect, giữ Guest khi đăng nhập giữa trận | API/lifecycle/integration/race |
| GB04 | Chuẩn bị Bot không yêu cầu đăng nhập; preflight lỗi không cấp Ready; reload không tin cache | UI/browser hành trình thật |
| GB05 | Review độc lập và dọn code trong phạm vi | Artifact review + regression |
| GB06 | Sau trận: preview/đồng ý nhập tóm tắt Bot Guest vào tài khoản, dedupe; không tự upload Python/không tính Elo | DB ACL/retry/schema strict + UI consent/failure + browser thật |

Root sở hữu auth/guest, bot-library, bot-online, matchmaking, Prisma schema/migration source, BotOnlinePage, Guest summary contracts, HistoryPage/GuestBotHistoryImport và service/test liên quan. Không đổi luật bàn cờ, không tự kích hoạt Offline hoặc push/deploy.

Migration Guest mới nằm ngoài ba migration production từng được cho phép. Chỉ test trên DB disposable; Render cần phê duyệt riêng sau SQL review và backup xác minh. Rollback vận hành: khóa luồng Guest Bot và giữ bảng/dữ liệu; không DROP dữ liệu người chơi.

Các workstream khác giữ riêng: Offline runtime activation/compatible memory, visual/performance, final review toàn bộ và phát hành Render. Không dùng PASS Guest để đóng các workstream này.

## Acceptance cục bộ — 2026-10-05

- Full server: **159/159 PASS, 0 failed, 0 skipped** (`robot-lab-visual-reference/v10-server-acceptance.json`). Disposable PostgreSQL17 `ottv2_r20_acceptance_1791189235244`, localhost:32300; 16 migration PASS, cluster đã dừng/giữ để kiểm tra (`v10-isolated-db.json`). Không đọc DATABASE_URL mặc định để mutation.
- Integration Guest chạy fixed fixture trong pinned Wasmtime/CPython-WASI thật: hai phe preflight, queue ghép cùng phòng/hủy, custom attach/Ready/nước đi; cookie account thêm giữa trận không đổi chủ Guest; revision mới commit ở lượt của mình, memory cũ bị reset. Public snapshot không chứa source/memory.
- Full web source cuối: **166/166 PASS, 0 failed/skipped** (`guest-bot-web-tests.json`); production web build/typecheck, lint zero warnings, server TypeScript và diff check PASS. Zod/Rollup annotation và entry chunk500.57kB vẫn là warning; không coi là performance PASS.
- Browser bản build + API/DB/WASI thật (không intercept/mock API) **8/8 PASS**, errors=[] tại12:30:02Z, gồm live upload, r2 activation, reload sau login giữ Guest, đầu hàng UI, local history sau login và Guest chưa đăng nhập đọc local history. Red join custom qua API thật, không phải bằng chứng room-discovery UI đầy đủ. Bản browser này có trước sửa event storage commit bên dưới; đang rerun build cuối.
- Harness RED mới: HistoryPage nhận401 rồi redirect, khiến Guest không xem được kết quả local. GREEN: list probe xử lý401 tại trang, hiển thị nguồn thiết bị; private detail/audit vẫn cần tài khoản. Import modal chỉ hiện khi account list thành công. Local summary chỉ từ terminal authoritative Guest, ID ổn định chống trùng; không lưu Python/source/memory/log.
- Một lần browser preflight trên host Windows bị từ chối do ngân sách sandbox (08:32:30Z), giữ Ready bị khóa. Fresh serial server/browser7 chạy PASS sau đó; không tăng budget hay bypass kiểm tra. Đây không phải bằng chứng Linux Render load/headroom của source mới.
- Harness RED race: trang Lịch sử đã mở trước lúc terminal summary commit không tự cập nhật. GREEN9/9 (HistoryPage3 + local storage6): phát event sau commit và reload local generation-fenced, gỡ listener khi unmount. Không thay private account/detail/audit ACL.
- Lượt review ban đầu bị usage limit; reviewer sau đó đã trở lại và xác minh server159/web166/browser8, history/surrender source không có P0/P1 mới. Residual optional Bot Guest import được chỉ ra, không bị che bằng scoped PASS. GB06 đang bổ sung/rerun và chờ review riêng; không đóng V10/R20.

### GB06 — postmatch import continuation

Thêm preview riêng ở trang Lịch sử khi đã đăng nhập, tối đa100 tóm tắt gần nhất mỗi lần, nút xác nhận rõ. Server lưu vào archive `GuestHistoryImport` đã có, schema strict chỉ summary, modeBOT_ONLINE và scoreDelta0, dedupe DB user/localId. Archive owner-only 100 bản mới nhất, ghi rõ nguồn thiết bị/chưa xác minh, không canonical Match/Rating/official statistics. Không cần migration mới cho archive này. Giữ local summary cả thành công/lỗi, không tải source/memory/log; nhập legacyGUEST không đổi.

Harness: endpoint RED404 trước implement; DB disposable focused1 PASS (11 test không chọn, không coi là full suite); UI2 PASS trước full rerun. Full server/web/browser9 và review source đang chạy; ghi counts cuối sau khi có artifacts. Browser đã thay join API bằng discovery/join UI để phủ luồng phòng Bot Guest thực tế.

### Phát hành tách riêng

Guest có **3 migration mới** ngoài 3 migration cũ từng được đồng ý. Chưa migration production, chưa backup xác minh, chưa push/deploy. Cần duyệt SQL và backup trước migration, rồi kiểm tra exact-SHA trên Render Free. Offline activation/compatible-memory đã có local built-product/cold-reload evidence riêng; broader Offline security/release, visual/CWV và final acceptance toàn hệ thống là các workstream còn mở.
