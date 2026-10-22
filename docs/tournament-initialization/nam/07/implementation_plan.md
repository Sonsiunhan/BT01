# N07 — RuleEditor trong wizard và phiên bản luật

## Phạm vi

N07 ghép RuleEditor V1 của N05 vào bước tổng quan của wizard P02 và đăng ký điểm vào P04, dùng preview API thật để kiểm tra profile, hiển thị lịch sử phiên bản/diff, và gửi publish request có `reason`, `effectiveAt`, digest, revision và idempotency key. N07 không sao chép engine vào client, không tự tạo phiên bản, không thay đổi luật của match cũ và không thay authority server.

## Acceptance criteria

- Wizard hiển thị RuleEditor có controlled value và field errors từ preview.
- Chưa lưu draft thì không thể preview/publish; preview hợp lệ là điều kiện bắt buộc để publish.
- Reason tối thiểu 3 ký tự và effective time bắt buộc trên UI; server vẫn là nơi xác minh cuối.
- Bản chỉnh sửa được giữ cục bộ theo giải; mọi thay đổi sau preview phải vô hiệu hóa preview cũ và khóa publish.
- Lịch sử phiên bản hiển thị version/effective time/reason; diff hiển thị từng trường, giá trị trước/sau, phạm vi tác động và xác nhận trận cũ không bị ảnh hưởng.
- Sau publish, UI tải lại revision và danh sách phiên bản từ server trước khi cho phép thao tác tiếp.
- Publish response phân biệt `PUBLISHED` và `CHANGE_REQUEST_REQUIRED`; không hiển thị source/secret.
- Interface V1 của N05 và route versioning của N04 được giữ nguyên.

## Verification

- Web typecheck, focused lint và production build phải PASS.
- Regression suite gồm wizard hiện hữu, RuleEditor, preview API, version API và N07 integration phải PASS.
