# S00 — Gói thiết kế nền console quản lí giải

Trạng thái: **S00 revision 4 — READY FOR HUMAN REVIEW / PARTIAL VALIDATION**. Match-center CTF/Custom, Observer/Broadcast Admin, copy, policy cố định và control mode đã được revalidate; còn human visual/copy acceptance và các kiểm manual đã nêu trong manifest.

Đọc hiện hành: [Traceability/handoff](S00-TRACEABILITY.md), [Component/state inventory](S00-COMPONENT-STATES.md), [Checklist/evidence](S00-ACCEPTANCE.md), [Review độc lập](S00-INDEPENDENT-REVIEW.md). Các mô tả revision1 có nhãn lịch sử không là hướng dẫn triển khai mới.

Revision 2 bám `implementation_plan_robot_lab_visual_rebuild.md` và source frontend hiện hành: header ngang, wordmark OTT, nền navy/ceramic, accent mint, panel bo góc và cạnh đế. [Đặc tả thiết kế revision 2](S00-DESIGN-R2.md) thay thế các mô tả bố cục mâu thuẫn trong revision 1 bên dưới.

Prototype: [preview.html](preview.html). Đây là fragment dùng trong bản xem trước chat; không phải route production. Build bằng `node docs/tournament-initialization/s00/build-preview.cjs`, kiểm bằng `verify-complete.cjs`, `verify-accessibility.cjs` và `verify-manual-gates.cjs` cùng thư mục (Playwright + Edge đã cài). Evidence hiện hành đã được chạy lại cho revision 4; evidence cũ chỉ là historical của revision 3.

S00 thay cho phần chuẩn bị của Sơn khi chưa có phản hồi trực tiếp. Gói này là đầu vào cho S01–S10 và không tự đăng ký route, không sửa `apps/web/src`, không tạo API giả và không biến capability của client thành quyền server.

## Phạm vi

- P01 — Danh sách giải/Admin
- P02 — Khởi tạo/sửa nháp
- P03 — Chi tiết/điều hành
- P14 — Nhật ký quản trị
- P15 — Hub Offline

Revision 4 trọng tâm P03: dashboard diễn biến giải, tab Vòng CTF, tab Vòng Custom và bảng trận có thể mở theo quyền; P02 chọn đúng một phương thức Người đấu Người hoặc Bot đấu Bot.

## Tài liệu

- [Implementation plan hoàn thiện S00](implementation_plan.md) — đã duyệt Q1A–Q5A và yêu cầu thực thi; không chia wave.

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
- Không có thay đổi application code. S00 cung cấp thiết kế để S01 triển khai; prototype đã có browser/accessibility evidence tổng hợp, còn production browser evidence chưa thuộc scope S00.
