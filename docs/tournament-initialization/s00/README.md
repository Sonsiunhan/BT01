# S00 — Gói thiết kế nền console quản lí giải

Trạng thái: **READY_PREPARATION / thiết kế, chưa code app**.

S00 thay cho phần chuẩn bị của Sơn khi chưa có phản hồi trực tiếp. Gói này là đầu vào cho S01–S10 và không tự đăng ký route, không sửa `apps/web/src`, không tạo API giả và không biến capability của client thành quyền server.

## Phạm vi

- P01 — Danh sách giải/Admin
- P02 — Khởi tạo/sửa nháp
- P03 — Chi tiết/điều hành
- P14 — Nhật ký quản trị
- P15 — Hub Offline

## Tài liệu

1. [Wireframe và state map](S00-UI-STATE-MAP.md) — shell, hierarchy, actor states, responsive và đường hồi phục.
2. [Form contract và design tokens](S00-FORM-TOKENS.md) — component contract, semantic token mapping và quy tắc form.
3. [Route inventory](S00-ROUTE-INVENTORY.md) — route đề xuất, capability, loader và dependency để S01 đăng ký sau G0.
4. [Console DTO](S00-CONSOLE-DTO.md) — payload ngữ nghĩa cho UI; Long/Đức xác nhận contract và server authority ở G1.

## Ranh giới

- `packages/game-rules` và server snapshot là nguồn sự thật cho luật, trạng thái, blocker và kết quả.
- `packages/contracts` là nơi ghi payload sau khi Long duyệt; các DTO trong tài liệu này chưa phải TypeScript compile.
- UI chỉ hiển thị `permittedActions`, không tự suy ra quyền, READY, winner, điểm hoặc thời gian.
- Incident, extension và referee readiness chỉ hiển thị dữ liệu đã lọc; không đưa source Python, memory, log riêng tư, token, path hoặc stack trace vào payload.
- Tất cả page phải có loading, empty, forbidden, error, retry, stale/conflict, keyboard, theme và reduced-motion state.

## Acceptance của S00

- Có state map cho năm page và shell dùng chung.
- Có route inventory, capability key và dependency cho từng entry.
- Có component/form contract dùng semantic token hiện có, không thêm bảng màu riêng.
- Có DTO ngữ nghĩa với cursor, revision, idempotency và error contract phù hợp.
- Có wireframe cho first viewport, empty/error/forbidden và mobile landscape/portrait.
- Không có thay đổi application code; task S00 chỉ đóng khi artifact được review và G0 cho phép S01.
