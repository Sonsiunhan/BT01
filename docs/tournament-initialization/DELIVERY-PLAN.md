# Phân công task và lịch bàn giao — candidate V2

Cập nhật 20/10/2026, UTC+7. Nghiệp vụ và danh mục trường xem [Đặc tả BA + SA](OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md), mục 7.3; mặc định còn chờ duyệt ở mục 15. Điều chỉnh lịch theo yêu cầu mới của Nam; giữ nguyên phạm vi, chủ trang, reviewer, thời lượng và phụ thuộc. Đây là lịch candidate; requirement gate G0 hiện HOLD, không tự phê duyệt các default còn chờ. Chưa triển khai code/DB/deploy trong nhiệm vụ cập nhật tài liệu này.

## 1. Mốc làm việc và tổng giờ

- **Mở đợt triển khai: 00:00 ngày 21/10. Ca làm việc đầu tiên: 08:00 ngày 21/10.**
- Không giao task, họp, review hoặc yêu cầu phản hồi trong **00:00–08:00**. 00:00 là giới hạn nộp muộn nhất của một ngày, không phải ca làm xuyên đêm hoặc thời lượng bổ sung.
- Ca kế hoạch từ 21/10 đến 24/10: **08:00–12:00 và 13:00–17:00**, tối đa 8 giờ/người/ngày. Không mặc định giao thêm việc buổi tối.
- Task 00: 21/10 08:00–09:00 để chốt yêu cầu/wireframe; task code bắt đầu từ 09:00 nếu G0 đạt. Mốc 00:00 không thay điều kiện G0.
- Candidate đủ trang: **24/10 10:30**; review/tích hợp đến **14:30**; sửa lỗi và nộp candidate nghiệm thu **16:30**.
- Tổng giữ nguyên **31,5 giờ/người, 126 giờ-người**. Task qua bữa trưa hoặc sang ngày được tách khung giờ; thời gian nghỉ không tính vào effort.
- Chỉ còn **24/10 16:30–17:00** dự phòng trong ca đã thống nhất. **Không còn nguyên ngày 24/10 dự phòng**. Hạn ngoài 24/10 18:00 giữ nguyên; lịch không tự kéo sang ngày 25/10 hoặc cộng giờ làm.

## 2. Trang theo thứ tự hạn nộp

Mỗi chủ trang thiết kế, build FE, build backend riêng của trang, tích hợp service chung và kiểm thử. Review chéo không chuyển quyền ghi file. Wireframe nộp **21/10 09:00** trong task 00, gồm bố cục, field, action, loading/empty/error/permission và đường quay lại. Sơn sở hữu layout/style chung.

Các trang cùng hạn làm song song. Hạn dưới đây là hạn nộp trọn trang đã tích hợp; mã P01–P18 giữ nguyên.

| Thứ tự | Hạn nộp | Trang | Thiết kế + FE + BE + kiểm thử / chủ trang | Frontend phải có | Backend phải có | Review |
|---|---|---|---|---|---|---|
| 1 | **21/10 12:00** | P01 — Danh sách giải và khung Admin | Sơn | Menu theo quyền; thẻ giải; tìm kiếm, lọc trạng thái, phân trang | API danh sách giải và quyền thao tác; chỉ trả dữ liệu được phép xem | Đức |
| 2 | **21/10 12:00** | P09 — Tài khoản quản trị | Đức | Danh sách, tạo tài khoản TA; gán hợp đồng; thu hồi quyền | Tạo SA ban đầu; tạo tài khoản và cấp/thu hồi quyền đúng thẩm quyền | Sơn |
| 3 | **21/10 16:30** | P06 — Quản lí đơn vị | Long | Danh sách, tạo, sửa, khóa đơn vị; hiển thị lỗi nhập liệu | API quản lí đơn vị; mã không trùng; kiểm tra dữ liệu đang được sử dụng | Nguyễn Tiến Nam |
| 4 | **21/10 16:30** | P07 — Hợp đồng và hạn mức | Long | Tạo/sửa hợp đồng; chọn đơn vị; đặt hạn mức và phạm vi cấu hình giải | Lưu và kích hoạt hợp đồng; kiểm tra thời hạn, liên kết và hạn mức còn lại | Nguyễn Tiến Nam |
| 5 | **22/10 14:30** | P08 — Xét duyệt giải | Long | Danh sách chờ duyệt; xem hồ sơ; duyệt, từ chối hoặc yêu cầu sửa | Kiểm tra quyền; lưu quyết định và bản cấu hình đã duyệt; hoàn hạn mức đúng quy tắc | Nguyễn Tiến Nam |
| 6 | **22/10 14:30** | P10 — Thí sinh và import | Đức | Danh sách thí sinh; thêm tay; tải tệp; xem trước lỗi; theo dõi tiến độ import | Đọc/kiểm tra tệp; import theo lô; chống nhập trùng; dùng lại tài khoản đúng quy tắc | Sơn |
| 7 | **22/10 16:30** | P14 — Nhật ký quản trị | Sơn | Danh sách, bộ lọc và chi tiết thao tác quản trị | API nhật ký theo quyền; che mật khẩu, mã kích hoạt và dữ liệu bí mật | Đức |
| 8 | **22/10 16:30** | P17 — Nhận lời mời nhân sự | Đức | Xem lời mời; đăng nhập để nhận hoặc từ chối; thông báo hết hạn | Kiểm tra người nhận, mã mời và thời hạn; cấp quyền sau khi nhận hợp lệ | Sơn |
| 9 | **23/10 10:30** | P12 — Hàng đợi hỗ trợ tài khoản | Đức | SA xem yêu cầu; xác minh; từ chối hoặc xử lí khôi phục | Chỉ cấp mã khôi phục sau xác minh; giới hạn yêu cầu; lưu nhật ký | Sơn |
| 10 | **23/10 10:30** | P13 — Kích hoạt và đặt lại mật khẩu | Đức | Nhập mã; tự đặt mật khẩu; báo mã hết hạn/đã dùng; gửi yêu cầu khi mất đăng nhập | Mã dùng một lần, đúng mục đích; kiểm tra thời hạn; tiếp nhận yêu cầu hỗ trợ an toàn | Sơn |
| 11 | **23/10 14:30** | P11 — Nhân sự giải và Referee | Đức | Danh sách; mời, phân công, thu hồi; trạng thái đã nhận/chờ nhận | API nhân sự và lời mời; quyền trong phạm vi giải; kiểm tra đủ Referee | Sơn |
| 12 | **23/10 16:30** | P02 — Khởi tạo / sửa nháp giải | Sơn | Form đầy đủ; lưu nháp; báo lỗi; tích hợp bộ cấu hình luật của Nam | Tạo/sửa/kiểm tra/gửi duyệt; kiểm tra hợp đồng, hạn mức và xung đột cập nhật | Đức |
| 13 | **23/10 16:30** | P04 — Cấu hình và phát hành luật | Nguyễn Tiến Nam | Bàn, quân, nước đi, đích; xem trước; so sánh phiên bản; phát hành | Kiểm tra cấu hình bằng engine; lưu phiên bản; kiểm tra phạm vi được duyệt và thời điểm hiệu lực | Long |
| 14 | **23/10 16:30** | P15 — Hub công cụ Offline | Sơn | Một giao diện dẫn vào Kho Bot, Bot Offline, Người–Bot, Người–Người | Kiểm tra quyền và truy cập Kho Bot; nối đúng công cụ/runtime Offline | Đức |
| 15 | **23/10 16:30** | P16 — Trạng thái sẵn sàng Bot | Nguyễn Tiến Nam | Hiển thị Bot tương thích/chờ kiểm tra/bị chặn; phiên bản luật; kiểm tra lại | Kiểm tra tương thích thật; trả trạng thái theo Bot và phiên bản; không lộ mã nguồn riêng tư | Long |
| 16 | **23/10 16:30** | P18 — Điều lệ và xác nhận | Đức | Xem điều lệ đầy đủ; xác nhận; nhắc xác nhận lại khi đổi phiên bản | Lưu người xác nhận, phiên bản và thời điểm; kiểm tra trước khi tạo trận mới | Sơn |
| 17 | **24/10 10:30** | P03 — Chi tiết và điều hành giải | Sơn | Tổng quan; cấu hình; các điều kiện còn thiếu; thao tác đúng quyền/trạng thái | API chi tiết, điều kiện sẵn sàng và thao tác; nối service vòng đời giải của Long | Đức |
| 18 | **24/10 10:30** | P05 — Xem trận và phân xử thủ công | Nguyễn Tiến Nam | Xem bàn đã dừng, chỉ số hòa, thời hạn; chọn bên thắng và ghi lý do | Kiểm tra quyền; nhận quyết định hoặc dùng dự phòng khi hết hạn; bảo đảm chỉ ghi một kết quả | Long |

P13/P17/P18 là entrypoint ngoài shell Admin để hoàn tất kích hoạt, nhận lời mời và xác nhận điều lệ. Login hiện hành được tái sử dụng. Backend Offline gồm quyền/capabilities/Kho Bot; gameplay chạy đúng runtime Offline an toàn. Không thay Người–Python Bot bằng AI heuristic.

## 3. Task theo từng người

Cột **khung giờ thực làm** là toàn bộ khoảng được giao việc; khoảng giữa các khung là nghỉ. Mỗi task gồm harness/implementation/focused verification. Task code chờ G0. Các mốc export và tích hợp chi tiết nằm tại mục 4 và 6a.

### Nguyễn Tiến Nam — 31,5 giờ

| Task | Khung giờ thực làm | Hạn nộp | Giờ | Công việc / đầu ra | Nhận từ |
|---|---|---|---|---|---|
| N00 | 21/10 08:00–21/10 09:00 | 21/10 09:00 | 1 | **Chốt đặc tả còn lại, kiểm G0; thiết kế trang luật/phân xử.** Quyết định defaults + đề nghị independent re-review; wireframe và Rule/Resolution DTO. G0 chỉ PASS bằng bằng chứng, không vì hết giờ. | Không |
| N01 | 21/10 09:00–21/10 12:00 | 21/10 12:00 | 3 | **Harness và engine bàn/movement mới.** RAY/LEAP, type+side, board5..15, blocker/jump, counts/layout; old-profile regression. | N00; G0 |
| N02 | 21/10 13:00–21/10 16:30 | 21/10 16:30 | 3.5 | **API validate/preview và tính khả thi ban đầu.** POST validate/preview dùng engine thật; golden legalMoves; lỗi field/version/caps; typed widget contract. | N01, L01; G0 |
| N03 | 21/10 16:30–21/10 17:00<br>22/10 08:00–22/10 10:30 | 22/10 10:30 | 3 | **Đích tĩnh/chu kỳ/seed và event order.** Goal profile và seed/round replay; Q17/18 fixtures; không auto-win và không tăng round do pause. | N02; G0 |
| N04 | 22/10 10:30–22/10 12:00<br>22/10 13:00–22/10 14:30 | 22/10 14:30 | 3 | **Comparator và API version/publish.** Trọng số/event/finaltie, version immutable, create>=effective, envelope guard; endpoints list/diff/publish. | N03, L02; G0 |
| N05 | 22/10 14:30–22/10 16:30 | 22/10 16:30 | 2 | **Rule editor V1 có hợp đồng ổn định.** Editor export value/onChange/errors/previewRequest; chọn movement/goal; API thật; interface cố định cho Sơn. | N04, S01; G0 |
| N06 | 22/10 16:30–22/10 17:00<br>23/10 08:00–23/10 10:30 | 23/10 10:30 | 3 | **SDK/runtime adapter và receipts tương thích.** ABI dimensions/goals/rules/legalMoves; receipt owner/hash/rule/SDK/runtime; no hardcoded9. Kiểm consumer Human–Python Bot Offline; nếu thiếu phải có adapter/harness thực, không thay AI heuristic thành Python. | N04, L01; G0 |
| N07 | 23/10 10:30–23/10 12:00<br>23/10 13:00–23/10 14:30 | 23/10 14:30 | 3 | **Hoàn thiện trang luật và ghép component vào wizard.** UI diff/reason/effective/publish, conditional fields, old-version display; giữ interface V1. | N05, N06; G0 |
| N08 | 23/10 14:30–23/10 16:30 | 23/10 16:30 | 2 | **Runtime proof và trang trạng thái Bot.** Preflight thật/hardcompute/policy gate; status/retry không lộ source; unavailable phải BLOCKED. Proof consumer Offline Người–Python Bot và Bot–Bot; thiếu môi trường/runtime thì BLOCKED. | N06, N07, D04; G0 |
| N09 | 23/10 16:30–23/10 17:00<br>24/10 08:00–24/10 10:30 | 24/10 10:30 | 3 | **Trang xem/phân xử exact-tie đầy đủ FE+BE.** Request list→staff match→winner+reason; DTO/API/ACL thật, timeout/cancel conflict; không player role. | N04, L08, S01; G0 |
| N10 | 24/10 10:30–24/10 12:00<br>24/10 13:00–24/10 13:30 | 24/10 13:30 | 2 | **Regression engine/SDK/manual boundary.** Golden board/movement/goal/tie/clock/receipt; actual evidence, không mock runtime pass. Tối thiểu1trận engine thật qua accepted moves→exact comparator tie→WAITING→manual/timeout→one result; fault fixtures riêng, không thay bằng seed pending request. | N08, N09; G0 |
| N11 | 24/10 13:30–24/10 14:30 | 24/10 14:30 | 1 | **Review UI Đơn vị/Hợp đồng/Duyệt và backend của Long.** Ghi findings, chủ Long sửa. | L09, L10; G0 |
| N12 | 24/10 14:30–24/10 16:30 | 24/10 16:30 | 2 | **Sửa lỗi và bàn giao mảng Nam.** Candidate + test logs + known gaps/NOT RUN; không tự gắn DONE nếu mandatory fail. | N10, N11; G0 |

### Sơn — 31,5 giờ

| Task | Khung giờ thực làm | Hạn nộp | Giờ | Công việc / đầu ra | Nhận từ |
|---|---|---|---|---|---|
| S00 | 21/10 08:00–21/10 09:00 | 21/10 09:00 | 1 | **Thiết kế shell và các trang Sơn; chuẩn UI dùng chung.** Wireframe/state map, form components/tokens, route inventory và console DTO; không code app trước G0. | Không |
| S01 | 21/10 09:00–21/10 10:00 | 21/10 10:00 | 1 | **Admin shell/router và auth-state integration.** Layout/navigation role-aware, routes lazy; thiếu capability hiển thị blocked, không player Online CTA. | S00; G0 |
| S02 | 21/10 10:00–21/10 12:00 | 21/10 12:00 | 2 | **Danh sách giải + capabilities FE/BE.** GET list/filter/page/sort và UI cards; server scope; loading/empty/error; actual disposable data. | S01, L01, D01; G0 |
| S03 | 21/10 13:00–21/10 16:30 | 21/10 16:30 | 3.5 | **Wizard nháp cơ bản FE/BE.** Create/read/patch draft adapters gọi core, tên/contract/lịch; giữ draft khi lỗi, version conflict. | S02, L02; G0 |
| S04 | 21/10 16:30–21/10 17:00<br>22/10 08:00–22/10 10:30 | 22/10 10:30 | 3 | **Các nhóm form ngoài rule builder.** Đối tượng/control/clock/scoring/privacy/regulations; conditional validation và server mapping. | S03; G0 |
| S05 | 22/10 10:30–22/10 12:00<br>22/10 13:00–22/10 14:30 | 22/10 14:30 | 3 | **Trang chi tiết và panel readiness.** GET detail/blockers/state/actions; overview/config/tabs; runtime pending không thành READY giả. | S04, L03; G0 |
| S06 | 22/10 14:30–22/10 16:30 | 22/10 16:30 | 2 | **Audit viewer FE/BE và nối readiness core.** GET scoped audit + filter/page UI; aggregate blocker từ API core; đọc thật, không chỉ UI fixture. | S05, L05; G0 |
| S07 | 22/10 16:30–22/10 17:00<br>23/10 08:00–23/10 10:30 | 23/10 10:30 | 3 | **Nối RuleEditor V1 vào wizard và submit.** Giữ một RuleProfile, validate/preview/submit API thật; không copy engine sang client. | N05, S04, L05; G0 |
| S08 | 23/10 10:30–23/10 12:00<br>23/10 13:00–23/10 13:30 | 23/10 13:30 | 2 | **Hub Offline đủ auth/backend và bốn lối vào.** Capabilities API + riêng tư Bot library; mode routing thực; thiếu consumer phải blocked rõ. | S01, D02, N06; G0 |
| S09 | 23/10 13:30–23/10 16:30 | 23/10 16:30 | 3 | **Hoàn thiện UI và tích hợp rule widget bản cuối.** Keyboard/theme/mobile/error/permission. Nhận N07 ngày 23/10 14:30; 14:30–15:30 tích hợp luật, 15:30–15:45 đăng ký ACK/Bot routes, 15:45–16:30 kiểm tra lại. | S07, S08, N05; G0 |
| S10 | 23/10 16:30–23/10 17:00<br>24/10 08:00–24/10 10:30 | 24/10 10:30 | 3 | **Browser E2E đầy đủ các trang Sơn.** RealAPI create→submit→notes/approve→roster/readiness; bằng chứng đúng role, không fixture API. | S09, N08, L09, D09; G0 |
| S11 | 24/10 10:30–24/10 12:00<br>24/10 13:00–24/10 13:30 | 24/10 13:30 | 2 | **Review chéo trang tài khoản/roster của Đức.** UI/ACL/recovery/import/invite findings; không sửa trực tiếp feature files Đức. | D10; G0 |
| S12 | 24/10 13:30–24/10 14:30 | 24/10 14:30 | 1 | **Kiểm tra role/URL trực tiếp và trạng thái lỗi.** No Admin Online player; forbidden direct routes; safe errors/return path/draft preservation. | S10, S11; G0 |
| S13 | 24/10 14:30–24/10 16:30 | 24/10 16:30 | 2 | **Sửa lỗi và bàn giao mảng Sơn.** Screenshots/traces + checks + integration candidate; no dead buttons/dummy success. | S12; G0 |

### Long — 31,5 giờ

| Task | Khung giờ thực làm | Hạn nộp | Giờ | Công việc / đầu ra | Nhận từ |
|---|---|---|---|---|---|
| L00 | 21/10 08:00–21/10 09:00 | 21/10 09:00 | 1 | **Thiết kế trang SA và hợp nhất API/data proposal.** Wireframes unit/contract/approval; contract skeleton/error/envelope schema và method ownership. | Không |
| L01 | 21/10 09:00–21/10 10:00 | 21/10 10:00 | 1 | **Chốt contracts/schema và DB test an toàn.** Single-writer DTOs/schema; disposable DB explicit; typed fixtures và migration candidate, không DB chung. | L00, N00, S00, D00; G0 |
| L02 | 21/10 10:00–21/10 12:00 | 21/10 12:00 | 2 | **Core draft/quota/contract-policy và audit port.** CoreService create/patch/submit guards, atomic quota/idempotency, audit writer; consumers dùng port cố định. | L01; G0 |
| L03 | 21/10 13:00–21/10 16:30 | 21/10 16:30 | 3.5 | **Hai trang Đơn vị và Hợp đồng FE/BE.** CRUD scoped/ranges/envelope/bindings; FK delete guards, remaining quota; real UI/API/tests. | L02, D01; G0 |
| L04 | 21/10 16:30–21/10 17:00<br>22/10 08:00–22/10 10:30 | 22/10 10:30 | 3 | **Hộp duyệt và chi tiết xét duyệt FE/BE.** List/detail/diff approve/reject/changes with notes; immutable approved snapshot và refund đúng1lần. | L03, N02; G0 |
| L05 | 22/10 10:30–22/10 12:00<br>22/10 13:00–22/10 14:30 | 22/10 14:30 | 3 | **Lifecycle/change-request/READY aggregate.** States + separate config change requests; blockers/ref/roster/rules/receipt aggregation; no fake READY. | L04, D04, N02; G0 |
| L06 | 22/10 14:30–22/10 16:30 | 22/10 16:30 | 2 | **Player admission C32 và cổng quyền chung.** All queue/custom/player-upgrade deny ngoài giải/Guest; existing match reconnect/Offline/observer đúng scope. | L05, D01; G0 |
| L07 | 22/10 16:30–22/10 17:00<br>23/10 08:00–23/10 10:30 | 23/10 10:30 | 3 | **Pause/cancel/end và persistence boundary.** Admission-pause vs match-stop rõ; end_at; cancellation CAS hooks; server time; fake-time tests. | L05, L06; G0 |
| L08 | 23/10 10:30–23/10 12:00<br>23/10 13:00–23/10 14:30 | 23/10 14:30 | 3 | **Manual adjudication transaction và ledger handoff.** WAITING request/frozen snapshot/deadline/fallback/CAS/cancel order/finish_sequence; một verdict, không double points. | L07, N04; G0 |
| L09 | 23/10 14:30–23/10 16:30 | 23/10 16:30 | 2 | **Concurrency và state/permission test suite.** Quota/refund/create-effective/cancel/timeout tests trên disposable DB; report actuals. | L08; G0 |
| L10 | 23/10 16:30–23/10 17:00<br>24/10 08:00–24/10 10:30 | 24/10 10:30 | 3 | **Tích hợp app/API/DB và chạy luồng xuyên suốt.** Compile/runtime wiring thật, no stub handlers; SA→TA→draft→approval→roster→rules→readiness; result fixture. Result fixture chỉ fault/race; engine-to-settlement proof tạiN10. | L09, N08, D09, S09; G0 |
| L11 | 24/10 10:30–24/10 12:00<br>24/10 13:00–24/10 13:30 | 24/10 13:30 | 2 | **Review chéo engine/SDK và phân xử của Nam.** Review immutable rules, hard cap/privacy/tie/cancel; findings để Nam sửa, không sửa hộ shared files. | N09, L10; G0 |
| L12 | 24/10 13:30–24/10 14:30 | 24/10 14:30 | 1 | **Đóng gói data/handoff và kiểm lại trạng thái.** Config/rule/seed/participant/result-order contract; operation scope và known blockers; no false10k claim. | L11; G0 |
| L13 | 24/10 14:30–24/10 16:30 | 24/10 16:30 | 2 | **Sửa lỗi và bàn giao candidate tích hợp.** Focused + required typecheck/lint/build/integration/E2E; final evidence và release decision, không tự deploy. | L12; G0 |

### Đức — 31,5 giờ

| Task | Khung giờ thực làm | Hạn nộp | Giờ | Công việc / đầu ra | Nhận từ |
|---|---|---|---|---|---|
| D00 | 21/10 08:00–21/10 09:00 | 21/10 09:00 | 1 | **Thiết kế account/roster/staff/support/onboarding.** Wireframes+actor matrix, identity/roster/import/staff DTO gửi Long; synthetic fixtures. | Không |
| D01 | 21/10 09:00–21/10 10:00 | 21/10 10:00 | 1 | **Auth/tenant guard contracts và tests.** Trusted principal/role/binding checks với repository port; public register never ADMIN; auth-service ownership. | D00; G0 |
| D02 | 21/10 10:00–21/10 12:00 | 21/10 12:00 | 2 | **Bootstrap/TA account trang FE+BE.** One-time bootstrap trên safe target; SA list/create/bind/revoke TA; no passwords in logs, whole UI test. | D01, L01; G0 |
| D03 | 21/10 13:00–21/10 16:30 | 21/10 16:30 | 3.5 | **Roster + preview CSV/XLSX FE/BE.** Parse/normalize/validate rows, error preview, safe staging; page table/manual create; scope/caps. | D02, L02; G0 |
| D04 | 21/10 16:30–21/10 17:00<br>22/10 08:00–22/10 10:30 | 22/10 10:30 | 3 | **Import commit worker và account reuse.** Batch jobs progress/idempotency/unique/person_key/capacity; no password overwrite, retry/crash harness. | D03; G0 |
| D05 | 22/10 10:30–22/10 12:00<br>22/10 13:00–22/10 14:30 | 22/10 14:30 | 3 | **Activation và giao diện nhận tài khoản.** Single-use hash/TTL/claim/reissue unclaimed; success không lộ token; owner self-password, accountclaimed không TA reset. | D04; G0 |
| D06 | 22/10 14:30–22/10 16:30 | 22/10 16:30 | 2 | **Nhân sự/Referee invite FE+BE.** Assign/invite/accept/revoke/expiry; minRef accepted cho READY; không gán global role trái phép. | D02, L03; G0 |
| D07 | 22/10 16:30–22/10 17:00<br>23/10 08:00–23/10 10:30 | 23/10 10:30 | 3 | **Support queue và recovery SA FE+BE.** Request/review/verify/reject/resolve, one-time reset owner-only, audit safe và rate limit. /account-access có request recovery khi chưa đăng nhập; public API rate-limited, response chung không enumeration; không đưa người mất password vào Admin shell. | D02; G0 |
| D08 | 23/10 10:30–23/10 12:00<br>23/10 13:00–23/10 14:30 | 23/10 14:30 | 3 | **Ack điều lệ/expiry/retention và dữ liệu cá nhân.** Versioned rules_ack, account-vs-enrollment expiry, staging cleanup và90days multi-reference policy; fake-time harness. | D04, D05, D06, L07; G0 |
| D09 | 23/10 14:30–23/10 16:30 | 23/10 16:30 | 2 | **Import/security/privacy integration tests.** Cross-tenant/doubleclaim/uploadbounds/source/token leakage/retry; synthetic large input không benchmark10klive. | D08, D07; G0 |
| D10 | 23/10 16:30–23/10 17:00<br>24/10 08:00–24/10 10:30 | 24/10 10:30 | 3 | **E2E các trang Đức bằng account thật ở DB test.** Bootstrap→TA→import→claim→Refaccept→ack/support; no demo-only API, report actor/error cases. | D09; G0 |
| D11 | 24/10 10:30–24/10 12:00<br>24/10 13:00–24/10 13:30 | 24/10 13:30 | 2 | **Review chéo trang quản trị của Sơn.** Forms/conditional defaults/loading/permission/admission/Offline privacy; findings có repro. | S10; G0 |
| D12 | 24/10 13:30–24/10 14:30 | 24/10 14:30 | 1 | **Rà audit/PII/token và permission matrix cuối.** No secrets across logs/export/publicpayload; no ID-based role bypass; retention account shared. | D10, D11; G0 |
| D13 | 24/10 14:30–24/10 16:30 | 24/10 16:30 | 2 | **Sửa lỗi và bàn giao mảng Đức.** Focused tests + UI traces + status no missing backend and no secret fixture data. | D12; G0 |

## 4. Các mốc export để không chờ dây chuyền

Các export giữa task phải dùng được theo interface thống nhất; không chờ cuối task mới giao. Đây là phần việc nằm trong task của producer.

| Task giao | Giờ giao | Export | Task nhận |
|---|---|---|---|
| S02 | 21/10 10:50 | Console backend exports | L02 |
| D02 | 21/10 10:50 | Account/role backend exports | L02 |
| D02 | 21/10 11:10 | Account FE | S02 |
| S03 | 21/10 15:00 | Draft backend | L03 |
| D03 | 21/10 15:00 | Roster staging backend | L03 |
| D03 | 21/10 15:20 | Roster FE | S03 |
| L03 | 21/10 15:20 | Units/contracts FE | S03 |
| D05 | 22/10 12:00 | Activation backend | L05 |
| D05 | 22/10 13:20 | Activation FE | S05 |
| N04 | 22/10 14:30 | Manual backend route exports | L08 |
| D06 | 22/10 15:30 | Staff/invite backend | L06 |
| D06 | 22/10 15:40 | Staff/invite FE | S06 |
| D07 | 23/10 09:15 | Support/recovery backend | L07 |
| D07 | 23/10 09:20 | Support/recovery FE | S07 |
| N06 | 23/10 10:30 | Bot-readiness backend ABI export | L09 |
| D08 | 23/10 14:00 | Regulations/ACK backend+FE | L09/S09 |
| N07 | 23/10 14:30 | Final RuleEditor stable interface | S09 |
| N08 | 23/10 15:30 | Bot-readiness FE | S09 |
| N09 | 24/10 09:30 | Manual FE; code stable for consumer smoke | S10/L10 |

## 5. Quyền ghi file — một writer, không giẫm nhau

Các folder mới dưới đây là **vị trí đề xuất**, chưa tạo app files trong nhiệm vụ lập lịch. Mỗi chủ trang sở hữu cả thư mục FE và module BE tương ứng. Khi nhận code phải đối chiếu baseline/consumers/dirty changes trước; không ghi đè công việc hiện có.

| Vùng | Người duy nhất ghi | Consumers/yêu cầu thay đổi |
|---|---|---|
| `prisma/schema.prisma`, migration candidate; `packages/contracts/src/**`; `apps/server/src/app.ts`; shared match lifecycle/persistence | Long | Nam/Sơn/Đức gửi contract/model/method request, không tự sửa file |
| `apps/web/src/app/router.tsx`, `routes.ts`, `layouts/AppLayout.tsx`, shared UI tokens/styles | Sơn | Các trang Nam/Long/Đức gửi route+component export; không tự đăng ký router/styles |
| `packages/game-rules/src/**`, `packages/bot-sdk/src/**`, board renderer/adapters, Bot runtime/Offline consumer điểm nối thuộc scope | Nam | Không đổi profile cũ; Sơn dùng component/preview, không copy logic luật |
| `apps/server/src/modules/auth/**` và account/session principal implementation | Đức | Long dùng guard/identity port; thay User schema vẫn gửiLong |
| FE `features/admin/rules/**`, `adjudication/**`, `bot-readiness/**`; BE `modules/tournament-rules/**`, `tournament-adjudication/**`, `tournament-bot-readiness/**` | Nam | Adjudication routes/query/ACL củaNam gọi mutation transaction củaLong, không tự ghi result riêng |
| FE `features/admin/shell/**`, `tournaments/**`, `audit/**`, `offline-tools/**`; BE `modules/tournament-console/**` | Sơn | Query/adapter/draftcommand gọiCoreService; không viết lifecycle thứhai |
| FE `features/admin/units/**`, `contracts/**`, `approvals/**`; BE `modules/tournament-foundation/**`, `tournament-core/**` | Long | Unit/contract/approval/clock/state/quota/canonical settlement |
| FE `features/admin/accounts/**`, `participants/**`, `staff/**`, `support/**`, `features/tournament-access/**`; BE `modules/tournament-identity/**`, `tournament-roster/**`, `tournament-staff/**`, `tournament-support/**` | Đức | Public activation/invite/ack cùng owner, server tokenpurpose không nhậpnhằng |
| Tests/evidence feature-local | Chủ task | Crossreview chỉ gửi findings; chủ file sửa. Global test config/CI cần writer được chỉ định, không 4 người sửa cùng lúc |

Contracts/schema chốt **21/10 10:00** tại L01. Yêu cầu sau freeze phải có task ID, file/method, thay đổi, lý do, consumer và ảnh hưởng compatibility. Writer phản hồi trong 30 phút trong ca; không đặt SLA trong giờ nghỉ hoặc 00:00–08:00.

## 6. Tổ chức tích hợp

- Mỗi người dùng checkout/nhánh riêng từ baseline đã ghi; Long quản integration. Giữ nguyên dirty/untracked/`.worktrees/`; không reset/clean/push/deploy.
- FE có thể dùng typed fixtures trong harness khi provider đang làm; chỉ ký hoàn tất sau API/DB/ACL thật. Không ship fake success.
- Chủ trang tự làm BE riêng; Long chỉ sở hữu foundation/canonical mutations và composition.
- Provider trễ phải báo task, consumer bị ảnh hưởng và forecast. Không tự cắt MUST hoặc kiểm thử để giữ giờ nộp.
- Chỉ mutation trên disposable DB đã định danh/kiểm tra; không dùng mặc định DATABASE_URL hoặc migrate DB chung.

## 6a. Slot tích hợp nằm trong task của writer

Không cộng thêm giờ, không giao một người hai việc đồng thời. Slot qua giờ nghỉ được tách khung dưới đây.

| Writer | Task | Khung giờ thực làm | Đầu ra |
|---|---|---|---|
| Long | L01 | 21/10 09:00–21/10 10:00 | Chốt contracts/schema và disposable DB. |
| Long | L02 | 21/10 11:00–21/10 11:20 | Đăng ký backend tài khoản và console từ export S02/D02. |
| Long | L03 | 21/10 15:30–21/10 16:30 | Ghép API draft/roster/đơn vị/hợp đồng và kiểm tra với chủ trang; nhận export S03/D03/L03. |
| Long | L05 | 22/10 13:30–22/10 14:00 | Ghép API kích hoạt và DTO từ export D05. |
| Long | L06 | 22/10 16:00–22/10 16:30 | Ghép staff/invite/role/admission từ export D06. |
| Long | L07 | 23/10 09:30–23/10 09:50 | Ghép public + SA support/recovery API từ export D07. |
| Long | L08 | 23/10 13:30–23/10 14:00 | Nối API phân xử N04 với canonical result service. |
| Long | L09 | 23/10 14:30–23/10 15:00 | Nối ACK/compatibility từ D08/N06 và kiểm tra HTTP. |
| Long | L10 | 24/10 09:30–24/10 10:30 | Nhận manual FE N09 lúc 24/10 09:30; route sẵn sàng 09:45; browser smoke 09:45–10:30. |
| Sơn | S01 | 21/10 09:00–21/10 09:30 | Đăng ký shell/routes/guards; route chưa hoàn tất hiển thị pending. |
| Sơn | S02 | 21/10 11:15–21/10 11:30 | Đăng ký console/account FE từ export D02. |
| Sơn | S03 | 21/10 15:30–21/10 16:00 | Đăng ký draft/roster/SA FE từ S03/D03/L03, cùng chủ trang kiểm tra API thật. |
| Sơn | S05 | 22/10 13:30–22/10 13:45 | Đăng ký activation FE D05; kiểm tra API sau slot Long L05. |
| Sơn | S06 | 22/10 15:45–22/10 16:00 | Đăng ký staff/invite FE từ D06. |
| Sơn | S07 | 23/10 09:30–23/10 09:45 | Đăng ký support/recovery FE từ D07. |
| Sơn | S09 | 23/10 14:30–23/10 16:30 | 23/10 14:30–15:30 tích hợp luật; 15:30–15:45 ACK/Bot routes; 15:45–16:30 kiểm tra lại. |
| Sơn | S10 | 24/10 09:30–24/10 09:45 | Đăng ký manual FE N09 ngày 24/10 09:30–09:45, giao Long kiểm tra UI. |

**Phân xử ngày 24/10:** Nam giao component **09:30**, Sơn đăng ký route **09:30–09:45**, Long kiểm tra UI thật **09:45–10:30**. Nam giữ interface ổn định sau export. API và service đã giao từ N04/L08 trước đó.

## 7. Gate và nghiệm thu

| Gate | Hạn | Điều kiện |
|---|---|---|
| G0 | 21/10 09:00 mục tiêu | Nam xử lí default còn chờ; checklist ổn định được independent re-review ≥99%, không P0/P1. Hiện HOLD; 81 mục cần đủ 81/81. |
| G1 | 21/10 10:00 | Contracts/schema/error/ports và DB test được thống nhất. |
| G2 | 22/10 16:30 | Foundation/approval/roster/invite thật; RuleEditor V1 giao Sơn. |
| G3 | 23/10 16:30 | Engine/SDK/runtime/compatibility có bằng chứng; các trang trước manual đã tích hợp. |
| G4 | 24/10 10:30 | Đủ 18 trang, manual FE+BE thật, không nút chết/route placeholder. |
| G5 | 24/10 14:30 | Review chéo và tích hợp; findings có owner. |
| G6 | 24/10 16:30 | Candidate nghiệm thu; checks bắt buộc có evidence, không P0/P1 mới. |
| Dự phòng còn lại | 24/10 16:30–17:00 | Sửa lỗi/retest trong 0,5 giờ/người; không còn nguyên ngày buffer. |

Một trang hoàn tất phải có thiết kế, FE, backend/persistence đúng bản chất, quyền server, loading/error/retry, focused tests, browser flow thật và findings được xử lí. Không ký DONE bằng screenshot/build/mock. Thiếu runtime proof hoặc còn P0/P1 là NO-GO dù đến deadline.

V2 dùng ca 08:00–12:00 và 13:00–17:00 từ 21/10. Mốc mở đợt là 21/10 00:00; không xếp việc 00:00–08:00. G0 mục tiêu 21/10 09:00; nếu chậm, công bố lịch mới theo ca hợp lệ, không tự cắt MUST/test hoặc đổi hạn cuối 24/10 18:00.

Bằng chứng phân xử bắt buộc: accepted moves của engine thật → exact tie → WAITING → manual/timeout → đúng một kết quả và một lần cộng điểm. Fixture WAITING chỉ bổ sung fault/race testing.

## 8. Ranh giới và rủi ro lịch

- Đây là phạm vi Admin/Khởi tạo và điểm nối luật/SDK/manualdecision bắtbuộc. Fullrun hàngloạt/TopNactive dashboard/finalexport/appeal/re-ratingproduction thuộc Vận hành kế tiếp theo đặctả, chưa bị gán deadline 5 ngày giả. Handoffconfig/tie/exportcontract vẫn cóownerLong/Nam/Sơn; không coi vậy là dashboard đãbuild.
- Các SHOULD không là dependencyngầm: email, CO_ADMIN/ROSTER_MANAGER nângcao, bookingnângcao, group/orgtree; COULDảnhbìa/nhânbản chưa lấy giờMUST. Không đẩy rulesmovement/goalđộng/đổiluật/compatibility/manualtiebreak sangDEFER.
- N01–N08 là criticalpath córủirocao: source hiệnfixed 9 x 9, SDK/scorer/renderer/runtime cùngbịảnhhưởng.126 giờ là lịchphânbổ, không effortđãđo hoặc camkết vừa scope. G1/G3 phải báo forecast theo evidence; nếu không đạt phải báo ảnhhưởng deadline hoặc xin thayđổi phạmvi rõràng, không nới runtimeunsafe hay giả consumerproof.
- Mục tiêu 4 k–10 kauthenticated/ready là hướng kiếntrúc, chưa benchmark; không thuê hạ tầng/paidservice trong lịch này. Chưa có quyềnpush/deploy/sharedDBmigration.

## 9. Tệp dùng để nhận việc

- DELIVERY-TASKS.csv:55 task, người, start/deadline/hours/dependencies/output/status, dễ mở bằngExcel.
- [support/DELIVERY-TASKS.json](support/DELIVERY-TASKS.json): dữ liệu máy đọc của task/page/API ownership và gates.
- Cả 55 task hiệnPLANNED/READY_PREPARATION hoặcWAITING_G 0; không có task implementation nào được ghiDONE bởi việc lập lịch.
