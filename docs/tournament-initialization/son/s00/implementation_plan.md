# Implementation plan — Hoàn thiện S00 Robot Lab

Ngày 21/10/2026 · Revision 2 · **ĐÃ CẬP NHẬT THEO FEEDBACK — REVALIDATION REQUIRED** — human duyệt Q1A/Q2A/Q3A/Q4A/Q5A rồi yêu cầu “Thực thi”; sau đó yêu cầu bổ sung match-center CTF/Custom, Observer/Broadcast Admin và thay đổi control mode.

Kết quả: [S00-ACCEPTANCE.md](S00-ACCEPTANCE.md) và [S00-INDEPENDENT-REVIEW.md](S00-INDEPENDENT-REVIEW.md). Independent review revision 4 đã READY_FOR_HUMAN_REVIEW; các kiểm manual/SR và human acceptance còn chờ, chưa ký VERIFIED.

Không chia wave. Thực hiện theo thứ tự công việc và dependency ở mục 5. Kế hoạch chỉ điều hành hoàn thiện S00; không thay lịch giao page của team.

## 1. Mục tiêu và cách hiểu hoàn thành

Người review thao tác được năm page P01/P02/P03/P14/P15, hiểu rõ UI dành cho ai, kiểm được luồng chính và lỗi, đồng thời người triển khai nhận một bộ thiết kế nhất quán với frontend Robot Lab hiện có.

“10/10” là mục tiêu chất lượng do human đánh giá. Điều kiện đóng S00 là toàn bộ acceptance bắt buộc đạt và không còn finding P0/P1; không dùng điểm số chủ quan để thay evidence. S00 hoàn thành thiết kế/prototype không có nghĩa page production hoàn thành.

## 2. Baseline và khoảng trống đã xác minh

| Đã có | Bằng chứng/phạm vi | Còn thiếu |
|---|---|---|
| Nền Robot Lab đang chạy | `AppLayout.tsx`, `HomePage.tsx`, `foundation/tokens.ts`, `styles/robot-lab.css` | Chưa có admin tournament shell production |
| Thiết kế S00 revision 2 | `S00-DESIGN-R2.md`, `preview.html` | Chưa đồng bộ hết revision 1; một số enum/role DTO còn là proposal |
| Năm màn prototype | Có navigation, list search/filter, wizard, match-center, audit, Offline | Production route/API/runtime chưa triển khai; prototype vẫn cần revalidate sau feedback mới |
| Kiểm tra synthetic | `verify-preview.cjs`: Edge, năm màn, TA/SA, search, states, viewport 1024/375 | Chưa kiểm đủ wizard, focus, contrast, theme, keyboard, conflict, screen reader, mọi phần tử clipping |
| N00 requirements gate | `N00-RESULT-2026-10-21.md`: G0 PASS requirements-only; review FINAL 93/93 | G1 contracts/schema freeze là checkpoint riêng |
| Handoff S00 | State map, route inventory, form/token, console DTO | Cần đối chiếu D00/L00 hiện hành, ghi khác biệt và owner rõ |

Nguồn ưu tiên: chỉ đạo human mới nhất → N00 decisions hiện hành → visual rebuild plan hiện hành → canonical nghiệp vụ trong phần tương thích → S00 revision 2. Các dòng HOLD cũ không được dùng để phủ định kết quả G0 đã ký.

Không coi tên role/status/capability do prototype đặt ra là contract đã chốt. Không xác nhận D00/L00 hoàn tất chỉ vì có commit title.

### Delta yêu cầu mới đã áp dụng

- P03 dùng mô hình match-center: `Tổng quan`, `Vòng CTF`, `Vòng Custom`, `Sẵn sàng`. CTF hiển thị ngày đấu và toàn bộ trận trong bảng; Custom nhận danh sách import và giữ thứ tự TA sắp xếp, không suy diễn bracket.
- Observer và Broadcast Admin được mở từng trận theo grant; Broadcast Admin có surface chuẩn bị phát sóng. TA/Referee không được gọi là actor livestream.
- P02 hiển thị bộ trường khởi tạo theo nhóm F01–F82 ở các bước phù hợp; technical metadata, roster và readiness vẫn ở bước sau. Copy dùng “trọng tài đã sẵn sàng” và “phương thức thi”, không hiển thị nhãn `ONLINE + READY` hoặc số liệu mơ hồ.
- `control_mode` chỉ còn `HUMAN_ONLY` (Người đấu Người) và `BOT_ONLY` (Bot đấu Bot). `HYBRID` bị loại khỏi prototype/handoff theo quyết định human mới nhất; contract G1 phải cập nhật enum tương ứng trước production.

## 3. Phạm vi

### Bao gồm

- Hoàn chỉnh thiết kế và prototype của năm page, shared shell và component states.
- Copy tiếng Việt gọn, dùng progressive disclosure; giữ đủ thông tin để quyết định.
- Luồng happy path, validation, lỗi, conflict, quyền, pending và recovery có thể kiểm tra.
- Desktop/mobile, light/dark, reduced motion, keyboard/focus và contrast.
- Route/component/DTO proposal nhất quán; mapping field form tới canonical F01–F82 và owner.
- Evidence, review findings, sửa lỗi và cleanup phần S00 lỗi thời.

### Ranh giới

- Không triển khai server/API/DB/auth thật, không sửa router/shared styles/schema/contracts production trong S00.
- Form luật dùng interaction thiết kế và preview minh họa đã ghi nhãn; không copy game engine hay chạy Python.
- Sự cố/gia hạn chỉ mô phỏng quyết định đã duyệt; không tạo thêm vai trò hoặc luật vận hành.
- P04/P05/P16 và P08/P11 được tham chiếu hoặc nhúng theo ownership, không xây lại thành các page đầy đủ của S00.
- Không triển khai live Top N/export/runner toàn giải dưới tên prototype; mốc khởi tạo/vận hành theo scope hiện hành.

## 4. MCQ đã duyệt

Human đã duyệt toàn bộ phương án A trong một phản hồi. MCQ không mở lại nghiệp vụ N00.

| Mã | Cần chốt | A — Khuyến nghị | B — Lựa chọn khác |
|---|---|---|---|
| Q1 | Sản phẩm bàn giao S00 | Prototype tương tác đủ luồng + design/component/DTO handoff, đặt riêng trong thư mục S00 | Thêm bộ React presentational components chưa nối API; tăng code và chồng S01–S09, cần cập nhật ownership |
| Q2 | Cách tổ chức wizard P02 | Giữ 4 bước: Thông tin → Thời gian → Luật & vận hành → Xác nhận; bước 3 có nhóm thu gọn | 6 bước: Thông tin → Thời gian → Bàn/di chuyển → Đích/kết quả → Vận hành/điều lệ → Xác nhận |
| Q3 | Chi tiết sự cố/gia hạn | Panel mở ngay trong P03; desktop ở cạnh nội dung, mobile thành vùng toàn chiều ngang; giữ context giải | Trang con trong quản lí giải, breadcrumb/quay lại và giữ bộ lọc; thêm navigation |
| Q4 | Phạm vi kiểm quyền trong prototype | Hoàn chỉnh TA/SA; thêm Referee chỉ case được giao và một state actor không đủ quyền; STAFF/Observer có matrix handoff | Làm prototype tương tác riêng cho toàn bộ STAFF/Observer bên cạnh TA/SA/Referee; mở rộng số màn review |
| Q5 | Nghiệm thu thiết kế | Kiểm toàn bộ checklist + review độc lập, sửa finding P0/P1, sau đó bạn xem bản cuối | Checklist và bạn review trực tiếp, không yêu cầu reviewer độc lập; ghi rõ giới hạn bằng chứng |

Khuyến nghị **Q1A Q2A Q3A Q4A Q5A** để nâng độ sâu S00 mà giữ phạm vi gọn. Q5A khi được duyệt sẽ cho phép một reviewer thiết kế report-only, không giao application code hoặc nhắn người trong team.

## 5. Công việc theo thứ tự thực hiện

### 1. Khóa đầu vào và lập bảng traceability

- Ghi đáp án MCQ và phạm vi cuối. Đối chiếu N00 final decisions, D00 và L00 có thật tại branch/commit được xác minh; tài liệu thiếu ghi `DEPENDENCY_PENDING`.
- Ghi exact source references cho wordmark, palette, radius/depth, typography, header, Button/Modal và theme/motion.
- Lập bảng `page → actor → action → state → component → field/DTO → owner → acceptance`.
- Rà proposal role/enum trong S00/D00; không tự thêm `STAFF`/`SUPPORT_AGENT` vào global role khi chưa có authority.
- Output: `S00-TRACEABILITY.md`, decision section cập nhật trong plan sau duyệt.

### 2. Hoàn thiện shell và component kit

- Bám header ngang, wordmark OTT, theme, khoảng cách, panel bo góc/cạnh đế Robot Lab đã được thích.
- Định nghĩa trạng thái component: button, text/number/date input, select, tabs, badge, error summary, modal/panel, pagination, empty/error/loading.
- First viewport bỏ technical metadata và diễn giải dài. Giữ nhãn rõ, hint tối đa một dòng khi có ích; thông tin tác động/deadline hiện trong detail/confirmation.
- Đặt cơ chế mở panel, đóng bằng Escape, focus return và unsaved guard dùng chung trước khi mở rộng page.
- Output: prototype shell/kit và `S00-FORM-TOKENS.md` hiện hành.

### 3. Hoàn chỉnh P01 và P02

- P01: thẻ giải, tìm/lọc trạng thái, phân trang minh họa có giới hạn; trạng thái hết kết quả khác danh sách trống. TA đủ quyền có Tạo giải, SA không có.
- P02: wizard theo Q2, nhập/chuyển bước/quay lại/xác nhận, lỗi từng trường, draft dirty/saving/saved, lỗi mạng và conflict giữ bản đang nhập.
- Map F01–F82 theo giai đoạn: tạo nháp/submit/post-approval, auto/read-only/not-applicable. Không bắt roster/staff trước lưu nháp.
- Luật/Bot fields phụ thuộc mode; đổi mode làm rõ field không áp dụng, không để hidden value tiếp tục có hiệu lực.
- Confirmation thể hiện hồ sơ gửi duyệt và blocker; preview không giả ACK server hoặc runtime PASS.
- Output: luồng P01 → P02 → xem bản nháp minh họa xuyên suốt.

### 4. Hoàn chỉnh P03 và các panel liên quan

- Tổng quan chỉ hiện số liệu/trạng thái cần vận hành, label dữ liệu minh họa luôn rõ.
- Sẵn sàng liệt kê blocker, trọng tài đã sẵn sàng theo ngưỡng cấu hình. Thiếu ngưỡng trước start thì bị chặn; sau RUNNING chỉ cảnh báo staffing, giải tiếp tục.
- Incident: mở trận → xem case đã lọc → gợi ý referee khả dụng → giao việc/chờ nhận/đang xử lí → quyết định có lý do → history/TA hủy trước FINALIZED. Thể hiện unavailable/conflict/assignment expired.
- Exact-tie giữ TA-only theo N00; referee không được dùng incident action để vượt quyền đó.
- Gia hạn: TA nhập lý do/thời lượng → pending → SA đối chiếu lịch → CLEAR/CONFLICT/UNKNOWN → duyệt/từ chối theo policy. Cap cộng dồn 120 phút, pending không thay end_at, SA phải duyệt trước end_at.
- Output: panel trong management context theo Q3; không chuyển sang player gameplay.

### 5. Hoàn chỉnh P14 và P15

- P14: filter/page minh họa, mở safe diff/reason/actor/time, trạng thái không có quyền. Metadata kỹ thuật trong detail; không render private data.
- P15: bốn entry đủ, từng entry có available/blocked/unavailable và recovery. Hiển thị nơi sẽ tới và lý do blocked, không chỉ toast chung.
- Nêu reuse target của consumer frontend hiện có; consumer chưa hỗ trợ ghi rõ dependency, không thay Python bằng AI heuristic.
- Output: audit detail và Offline entry states đầy đủ theo scope S00.

### 6. Rà tương tác, accessibility và responsive

- Kiểm từ keyboard: Tab/Shift+Tab, Enter/Space, Escape, tabs; visible focus, dialog focus containment và trả focus.
- Kiểm error summary/field association và status announcement; accessible name cho icon button, inputs và navigation.
- Viewport 375×812, 768×1024, 1366×768, 1440×900; 320px kiểm reflow, 200% zoom kiểm thao tác/nội dung thiết yếu. Chỉ bảng cần thiết được cuộn ngang có nhãn.
- Light/dark và reduced motion kiểm screen đại diện cùng component kit, không tạo test tích Descartes vô ích.
- Đo contrast chữ thường ≥4.5:1, chữ lớn ≥3:1, control/focus cần nhận biết ≥3:1; ghi kết quả đo, không suy từ palette nhìn đẹp.
- NVDA/Edge hoặc screen reader có thật: ít nhất một luồng form lỗi và mở/đóng panel; thiếu môi trường ghi NOT RUN, không đổi DOM test thành screen-reader PASS.

### 7. Đồng bộ handoff, review và đóng S00

- Hợp nhất mô tả revision 1/2 thành phiên bản đọc hiện hành; giữ decision/review evidence, loại mô tả lỗi thời khỏi hướng dẫn thực thi.
- Route/DTO chỉ proposal nếu G1 chưa freeze. Mọi action có actor/state/field/revision/error/owner; không invent endpoint đã có.
- Review theo Q5, findings có severity, evidence, owner và trạng thái; sửa rồi kiểm lại đúng phần bị ảnh hưởng.
- Lập `S00-ACCEPTANCE.md`, evidence manifest và `S00-RESULT` mới, bàn giao next task S01 và dependencies còn pending.
- Không dùng build pass làm bằng chứng thiết kế được human chấp nhận; chưa tự commit/push nếu chưa có yêu cầu.

## 6. File ownership và dependency

Writer lần này là Nam theo yêu cầu trực tiếp làm thay S00. Ownership dài hạn của Sơn với router/layout/shared styles không đổi.

| File/nhóm | Công việc | Ranh giới |
|---|---|---|
| `docs/tournament-initialization/s00/preview.html` | Prototype canonical | Bản chat đồng bộ cùng nội dung, không để hai bản lệch |
| `s00/verify-preview.cjs` | Kiểm tương tác synthetic có assertion | Không gọi API production hoặc mutate DB |
| `s00/S00-*-*.md`, `S00-TRACEABILITY.md`, `S00-ACCEPTANCE.md`, `README.md` | Thiết kế, handoff, evidence | Preserve evidence cũ; nhãn lịch sử rõ |
| `apps/web/src/**` | Chỉ đọc baseline theo Q1A | Q1B cần ghi exact component ownership trước code |
| `packages/contracts/**`, schema, server lifecycle | Đề nghị thay đổi trong handoff | Long single-writer; không sửa trong S00 |

L00/D00 chưa có hoặc G1 chưa freeze không chặn vẽ prototype. Các mục handoff tương ứng phải là pending, không ghi đã tích hợp/đã thống nhất khi chưa có bằng chứng.

## 7. Acceptance bắt buộc

Mọi AC phải có result PASS/FAIL/NOT RUN/BLOCKED và evidence. Tất cả AC dưới đây là Required trong scope được duyệt; Q5B thay phương pháp review AC-18, không giả independent pass.

| ID | Điều kiện → thao tác → kết quả quan sát | Kiểm chứng |
|---|---|---|
| AC-01 | Mở năm page → nhận diện cùng wordmark/palette/hình học frontend Robot Lab; không drift token | Source mapping + screenshots + human visual review |
| AC-02 | Đọc first viewport → nhận diện tên trang, context và action chính; technical metadata chỉ mở khi cần | Human copy/hierarchy review từng page |
| AC-03 | TA/SA/Referee xem cùng fixture → chỉ action theo scope; actor không có quyền không thấy private content | Role scenario assertions; không gọi đây là server ACL proof |
| AC-04 | P01 đổi query/filter/page → tập kết quả minh họa đúng, empty có recovery, selection không mất ngữ cảnh | Browser assertions |
| AC-05 | P02 từ tạo tới xác nhận rồi quay lại → giá trị nhập được giữ, bước hiện hành rõ | Browser assertions theo Q2 |
| AC-06 | Nhập sai trường bắt buộc/lịch/bounds → lỗi tại field và summary; không tiến qua bước invalid | Boundary cases + keyboard focus check |
| AC-07 | Đổi HUMAN_ONLY/BOT_ONLY hoặc goal policy → field áp dụng rõ, hidden data không giả hiệu lực | Conditional fixtures + F01–F82 mapping |
| AC-08 | Draft dirty rồi back/network error/version conflict → có recovery và giữ bản nhập; không silent overwrite | Synthetic state/failure assertions |
| AC-09 | Thiếu referee threshold trước start vs sau RUNNING → blocker startup và warning ongoing khác nhau | N00 policy fixture + browser review |
| AC-10 | Case chưa xử lí → assignment/decision/history/rollback states có thể review; exact-tie không lộ action cho Referee | Role/state browser scenarios + N00 traceability |
| AC-11 | Extension pending/CLEAR/CONFLICT/UNKNOWN hoặc vượt cap/end_at → hiển thị khả năng thao tác và lý do theo N00; không giả pending đã đổi lịch | Boundary/state scenarios |
| AC-12 | Mở audit detail → chỉ allowlisted safe diff/reason; không token/source/raw log | Fixture inspection + text/DOM assertions |
| AC-13 | Mở bốn Offline entries → target/blocked/retry rõ; thiếu runtime không gắn READY giả | Entry-state assertions + source target mapping |
| AC-14 | Loading/empty/error/forbidden/pending/expired/conflict của component/page áp dụng → có đường hồi phục, không action chết | State inventory + click-through evidence |
| AC-15 | Keyboard form/panel → focus visible, labels/errors announce, Escape/return-focus đúng | Browser focus assertions + screen reader thực scoped |
| AC-16 | Viewports/theme/zoom/motion đã nêu → không che control/chữ thiết yếu; contrast đạt ngưỡng | Bounds/screenshots, contrast measurement, manual inspection |
| AC-17 | Đọc handoff → mỗi field/action/state có source/owner/dependency; DTO/routes pending không bị ghi là production | Traceability + link/reference check |
| AC-18 | Review snapshot cuối → tất cả Required AC có evidence, không P0/P1 mở; human xem và chấp nhận thiết kế | Review report theo Q5 + human acceptance |

## 8. Kiểm chứng và evidence

- Mở rộng `node docs/tournament-initialization/s00/verify-preview.cjs` theo action/state mới; mỗi assertion gắn AC, không dùng count-only thay kiểm hành vi.
- Prototype runner local/offline, chỉ dữ liệu synthetic; ghi browser/version/viewport/theme, exact source hash, command và outcome.
- Evidence ảnh theo screen/state đại diện; lỗi focus/contrast/reflow có mô tả tái hiện. Không nhận screenshot đẹp là bằng chứng mọi state pass.
- `git diff --check` cho tracked changes; kiểm riêng file mới, broken links và syntax HTML/JS. Không chạy full app build chỉ để ký prototype DONE.
- Existing revision 2 checks là baseline một phần; không carry PASS sang luồng chưa có.
- Ước lượng effort không khóa trước Q1–Q5. Sau khi chốt, kiểm scope và dependency trước thực hiện; báo phần tăng nếu chọn B, không tự kéo lịch team hoặc bỏ acceptance để vừa giờ.

## 9. Điều kiện kết thúc

S00 chỉ được ghi **VERIFIED — DESIGN/PROTOTYPE** khi AC-01…AC-18 của scope đã duyệt đạt, review hoàn tất theo Q5 và human chấp nhận bản cuối. Khi còn kiểm bắt buộc NOT RUN/BLOCKED, ghi rõ READY_FOR_REVIEW/PARTIAL và nguyên nhân.

S01 là task triển khai kế tiếp, còn phụ thuộc contract/capability/schema theo G1; kết quả S00 không tự đóng các dependency đó.

Skill đã đọc và áp dụng: `ecc:intent-driven-development` — đối chiếu baseline, tách scope/design khỏi production, xác định MCQ material và acceptance quan sát được.
