# Khởi tạo giải đấu — tài liệu team cần đọc

## Thứ tự đọc

1. **[Đặc tả BA + SA](OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md)** — mọi thành viên đọc mục 1–6, 8, 12, 14–16; đây là tài liệu nghiệp vụ chính đã hiệu chỉnh. Mục 7.3 chứa toàn bộ F01–F82, mục 16 chứa T001–T081.
2. **[Phân công và lịch bàn giao](DELIVERY-PLAN.md)** — mọi thành viên đọc phạm vi trang mình, task, dependency, file ownership, mốc export/tích hợp và điều kiện nghiệm thu.
3. **[Bảng task CSV](DELIVERY-TASKS.csv)** — lọc theo tên để nhận việc và theo dõi giờ nộp; khung giờ thực làm có trong cột WorkSegments_UTC7.

## Đọc sâu theo phần phụ trách

| Thành viên | Phần đặc tả cần đọc sâu |
|---|---|
| Nguyễn Tiến Nam | 7.3 nhóm C–F và I; 7.6; 10.2–10.4; 15; tiêu chí engine/goal/result/Bot trong 16 |
| Sơn | 4; toàn bộ form 7.3; 7.4; 10.5; tiêu chí form/UI/admission trong 16 |
| Long | 3; 5–6; 7.1; 7.4; 8–11; 15; tiêu chí quota/state/ordering trong 16 |
| Đức | 3; 7.2; 7.3 nhóm A/B/G/H; 7.5; 9; 12; tiêu chí identity/import/support/retention trong 16 |

Mỗi người vẫn chịu trách nhiệm đủ thiết kế + FE + BE + kiểm thử của trang được giao.

## Trạng thái và lịch hiện hành

- Các nội dung đánh dấu **đề xuất/chưa phê duyệt** tại mục 15 đặc tả còn cần kiểm duyệt; G0 chưa tự chuyển PASS từ việc hợp nhất tài liệu.
- Mở đợt 21/10/2026 00:00; không giao việc 00:00–08:00. Ca kế hoạch 08:00–12:00, 13:00–17:00; task code phụ thuộc G0.
- Candidate 24/10 16:30; chỉ còn 0,5 giờ/người dự phòng trong ca. Đây là lịch phân bổ, không phải bằng chứng đủ effort hoặc implementation đã hoàn tất.

## Tài liệu hỗ trợ

- `support/`: dữ liệu lịch JSON, kết quả kiểm tra lịch và review hiện hành; dùng khi cần kiểm tra công cụ, không phải bài đọc bắt buộc của team.
- Các bản nháp và tài liệu cũ đã được xóa. Bản đặc tả hiện hành nằm ngay thư mục này theo tên tài liệu gốc.
