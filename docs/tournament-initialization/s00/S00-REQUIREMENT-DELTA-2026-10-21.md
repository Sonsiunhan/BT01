# S00 — Delta yêu cầu sau review match-center

Ngày 21/10/2026. Đây là delta của S00 revision 3, không thay thế đặc tả BA/SA và chưa phải contract production.

## Quyết định đã chốt

1. P03 là một **match-center của giải**. Dashboard “Diễn biến giải” vẫn là lớp tổng quan; bên dưới có hai tab nghiệp vụ:
   - **Vòng CTF**: các ngày thi và toàn bộ trận CTF trong bảng; mỗi dòng mở được trận.
   - **Vòng Custom**: danh sách trận từ file import do Tournament Admin đưa lên và tự sắp xếp; hệ thống không gán nhãn vòng bảng, loại trực tiếp hay knockout.
2. Observer và Broadcast Admin là nhóm xem/livestream theo grant. Broadcast Admin có surface chuẩn bị phát sóng; Observer chỉ xem. TA và Referee không được gọi là actor livestream.
3. P02 phải trình bày đủ nhóm trường cần để cấu hình giải theo BA/SA, nhưng phân nhóm theo bước và progressive disclosure. Không dồn 82 trường vào một màn hình; roster, readiness và metadata hệ thống vẫn ở workflow sau.
4. `control_mode` chỉ có hai lựa chọn độc quyền: `HUMAN_ONLY` — Người đấu Người; `BOT_ONLY` — Bot đấu Bot. `HYBRID` bị loại khỏi UI/handoff của S00; G1 phải cập nhật contract/enum trước khi production.
5. Copy hiển thị theo ý nghĩa nghiệp vụ: “trọng tài đã sẵn sàng”, “số trọng tài tối thiểu”, “phương thức thi”, “bảng lịch trận”. Không dùng nhãn kỹ thuật rời rạc như “ONLINE + READY” trên first viewport.

## Đối chiếu BA/SA

P02 revision 4 đã đưa vào preview các nhóm F01–F18, F22–F24, F27–F35, F36–F48, F49–F52, F55–F66. Các trường còn lại là auto/read-only, workflow roster/import, hoặc handoff engine/runtime theo đúng mục 7.3; không giả rằng prototype đã triển khai server.

P03 revision 4 bổ sung `MatchCenterView` và `MatchRow` proposal trong `S00-CONSOLE-DTO.md`. Route/capability và role mapping vẫn **DEPENDENCY_PENDING / G1**, vì tài liệu BA/SA không tự tạo persisted global role.

## Trạng thái kiểm chứng

Evidence revision 3 không còn là evidence cuối cho delta này. Revision 4 đã build lại preview, chạy browser/accessibility suite và cập nhật manifest: 121 assertions PASS, 10 axe screens, 0 violations. Independent review revision 4 đã xác nhận closure; human acceptance và kiểm manual vẫn là cổng cuối trước `VERIFIED`.

## Closure của review vòng đầu

Review độc lập vòng đầu đã phát hiện và yêu cầu sửa: policy Elo/retention/qualification không được editable, numeric bounds và max plies chẵn, viewer chỉ ở match-center, Observer không có broadcast action, panel phải bind đúng row, và Broadcast Admin cần surface chuẩn bị phát sóng. Revision 4 hiện đã phản ánh các điểm này trong source và regression suite; report độc lập cần xác nhận closure bằng hash mới.
