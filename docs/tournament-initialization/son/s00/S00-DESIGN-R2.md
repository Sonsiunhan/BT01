# S00 — Thiết kế Robot Lab revision 2

21/10/2026. Nguồn hình thức: `docs/implementation_plan_robot_lab_visual_rebuild.md`, `apps/web/src/layouts/AppLayout.tsx`, `foundation/tokens.ts`, `styles/robot-lab.css`, `pages/HomePage.tsx`. Revision này ưu tiên khi xung đột với mô tả S00 revision 1. Đây là thiết kế/prototype, không chứng nhận API hoặc quyền đã được triển khai.

## Bố cục và mức độ hiển thị

- Header ngang dùng lại wordmark OTT, hình học nút và theme hiện có. Navigation quản trị gồm Giải đấu, Nhật ký, Công cụ Offline; không mang CTA chơi Online từ shell người chơi sang.
- Bỏ sidebar thường trực, bỏ status strip kỹ thuật toàn cục. Tên giải/trạng thái là context tại trang chi tiết. Revision, digest, server time và correlation ID chuyển vào chi tiết khi cần, không chiếm first viewport.
- Nền navy `#0B1421`, panel `#142134`, raised `#1E3048`, mint `#69EEE7`; light dùng palette ceramic của cùng bộ tokens. Text/muted/semantic tiếp tục dùng token source hiện có.
- Panel radius 18–24px, padding 20–26px, gap 18–24px, đế 3–4px và rãnh góc ngắn. Heading tiếng Việt dùng Be Vietnam Pro; mono chỉ cho thời gian/ID. Không thay bằng phong cách góc sắc, neon hoặc gradient tràn màn.
- Hover nút -2px, press +2px, 160ms; reduced motion phản hồi tĩnh. Không tilt cả panel hoặc animation lặp.

## Năm page

| Page | First viewport | Chi tiết mở khi cần | Hành động chính |
|---|---|---|---|
| P01 | Tiêu đề, tạo giải, tab trạng thái, tìm kiếm, thẻ giải | Điều kiện bị chặn, hợp đồng | Mở giải / Tạo giải |
| P02 | Bốn bước, form bước hiện tại, summary hợp đồng bên cạnh | Bounds, mô tả luật, lỗi có liên kết | Tiếp tục / Lưu nháp |
| P03 | Tên/trạng thái/lịch; tab Tổng quan, Trận đấu, Sẵn sàng | Incident trong panel tại chỗ; request gia hạn; lịch sử quyết định | Xử lí sự cố theo quyền |
| P14 | Nhật ký theo thời điểm, actor, hoạt động | Reason và diff đã lọc | Xem chi tiết |
| P15 | Bốn thẻ: Kho Bot, Bot Offline, Người–Bot, Người–Người | Runtime blocker và chuẩn bị consumer | Mở công cụ |

P01 dùng **thẻ** theo canonical mục 4, không mặc định đổi thành bảng. Thẻ chỉ giữ trạng thái, tên giải, đơn vị, lịch, số thí sinh và một trạng thái cần chú ý. List query vẫn phân trang/filter/sort ở server khi triển khai.

## Chính sách ít chữ

1. Mỗi control có nhãn cụ thể, tối đa một dòng hint ngắn nếu cần quyết định.
2. First viewport ưu tiên đối tượng và thao tác; không hiển thị mô tả hệ thống, DTO, mã page, quyền kỹ thuật hay revision mặc định.
3. Icon hỗ trợ nhãn; không dùng icon thay mọi chữ. Status luôn có text và không chỉ mã màu.
4. Chỉ hiện cảnh báo/action khi có dữ liệu tương ứng. Không tạo metric trống hoặc thông báo “hệ thống tự động” để lấp chỗ.
5. Lý do, deadline, scope và hậu quả của thao tác quan trọng vẫn phải hiện đầy đủ ở confirmation/detail.

## Quyền và dữ liệu

- Prototype cho đổi TA/SA để so sánh nội dung; đây là điều khiển xem thử, không xuất hiện trong sản phẩm và không cấp quyền thật.
- SA không có Tạo giải; TA có action này chỉ sau capability server. Referee dùng case được giao, không nhận toàn bộ navigation quản trị.
- Admin có thể dùng công cụ Offline. Bot readiness phải nhận từ consumer thật; prototype không cấp READY/PASSED cho runtime thực.
- Điều hành, incident, gia hạn, rollback và exact-tie kế thừa N00 decisions; không dùng số liệu minh họa để chứng minh throughput hoặc người đang online.
- G0 yêu cầu **đã PASS theo N00-RESULT-2026-10-21.md và review FINAL 93/93**. Các dòng HOLD cũ ở lịch/snapshot không có ưu tiên hơn kết quả đó. G1 contracts/schema vẫn là checkpoint riêng.

## Prototype và trạng thái

Bản xem trước trong chat có năm page, navigation, tìm giải, lọc trạng thái, chuyển TA/SA, form step, mở incident/gia hạn/audit detail và chọn loading/empty/error/forbidden. Dữ liệu được đánh dấu minh họa; không gửi API và không ghi dữ liệu hệ thống.

Production phải bổ sung theo task S01–S10: authoritative ACK, version conflict/draft preservation, scoped cache clear, route guards, lazy loading và consumer runtime. Có prototype không đồng nghĩa các task này DONE.

## Handoff cụ thể

| Thành phần | Reuse | Thay đổi khi triển khai |
|---|---|---|
| Header/wordmark | `RobotLabWordmark`, ThemeSwitcher, actor menu | Navigation nhận server capabilities; tách nhánh quản trị để không đổi shell người chơi |
| Panel/nút | `DESIGN_TOKENS`, robot-lab bevel, Button/Modal/LoadingState | Class scoped cho tournament; không sửa token toàn cục theo page |
| Draft | Controlled form + RuleEditor của Nam | Một draft, lỗi theo path, response gắn revision/context |
| P03 | Tab và panel | Summary nhỏ; incident/extension mở trong quản lí giải; server là authority |
| Routes/contracts | Route proposal S00 revision 1 | Long chốt names/enums/bounds G1; Sơn single-writer router/shared styles |

## Nghiệm thu revision 2

- PASS synthetic qua Playwright/Edge: navigation năm page, filter/search, role TA/SA, form step, incident/detail, audit, bốn Offline entry và năm recovery states; không JavaScript page error.
- PASS kiểm overflow toàn trang ở 1024px/375px cho navigation chính. Đây chưa phải kiểm mọi element clipping, contrast, screen reader hoặc real-device.
- Command: `node docs/tournament-initialization/s00/verify-preview.cjs`. Bundled Chromium thiếu executable; Edge trong sandbox lỗi profile/pipe, chạy lại Edge ngoài sandbox PASS. Không tải/cài browser mới.
- Production API/browser/integration và independent review: NOT RUN trong S00 revision 2.
- Không tự commit/push/deploy hoặc mở rộng thành S01 nếu chưa được giao.

Skills sử dụng: `ecc:frontend-design-direction`, `ecc:frontend-patterns` đã đọc trong S00 để thiết kế hierarchy và form/state contract; `visualize:visualize` dùng để tạo mockup tương tác trong chat. Palette/hình học đối chiếu source và visual rebuild plan hiện hành.
