# S05-ACCEPTANCE — Ma trận tiêu chí nghiệm thu Task S05

## 1. Tiêu chí bắt buộc (Acceptance Criteria)

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| **AC-01** | Khởi tạo trang chi tiết P03 & Hiển thị Metadata | Vitest Unit Test | Render đầy đủ tiêu đề giải đấu, mã slug, trạng thái vòng đời, ngày bắt đầu/kết thúc và đơn vị chủ quản theo chuẩn Robot Lab. |
| **AC-02** | Tab cấu hình hiển thị đầy đủ các nhóm thông số S04 | Vitest Unit Test | Hiển thị chính xác các giá trị cấu hình Vận hành (`maxMatchesPerPlayer`, `maxPairMeetings`, `rematchCooldownMinutes`), Khán giả (`spectatorPolicy`, `chatPolicy`), và Tính điểm (`initialScore`, `kFactor`). |
| **AC-03** | Panel Readiness hiển thị kiểm tra thẩm quyền máy chủ (Authoritative Checklist) | Vitest Unit Test | Hiển thị 4 hạng mục kiểm tra tự động (`APPROVAL_STATUS`, `RULE_VERSION_PUBLISHED`, `MIN_ELIGIBLE_PARTICIPANTS`, `NO_PENDING_ADJUDICATION`) với nhãn trạng thái PASS/BLOCKED/WARN tương ứng từ máy chủ. |
| **AC-04** | Ngăn chặn hiển thị READY giả khi có blocker | Vitest Unit Test | Khi giải chưa đủ số thí sinh tối thiểu hoặc chưa duyệt, giao diện hiển thị trạng thái `CHƯA ĐỦ ĐIỀU KIỆN (BLOCKED)`, liệt kê danh sách blocker, và vô hiệu hóa nút bắt đầu giải. |
| **AC-05** | Kích hoạt thao tác vòng đời theo điều kiện máy chủ | Vitest Unit Test | Nút "Mở lịch trình" gọi đúng API `openScheduled`, nút "Bắt đầu giải" gọi `startRunning` khi `canStartRunning = true`, nút "Tạm dừng" gửi kèm lý do hợp lệ. |

---

## 2. Kiểm thử tự động tương ứng

- **File kiểm thử:** `tests/unit/s05-tournament-detail-readiness.unit.test.ts`
  - `AC-01`: Render metadata, breadcrumbs, status badge, và thông tin thời gian.
  - `AC-02`: Render các tab Overview, Config và hiển thị các trường cấu hình mở rộng.
  - `AC-03`: Tải snapshot readiness từ máy chủ và hiển thị đầy đủ checklist 4 mục.
  - `AC-04`: Khi có blocker, không render trạng thái READY giả; nút bắt đầu giải bị vô hiệu hóa.
  - `AC-05`: Kích hoạt các API hành động vòng đời (`openScheduled`, `startTournament`, `pauseTournament`).
