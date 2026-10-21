# Lịch giao việc cuốn chiếu V3 — dependency theo page

Cập nhật 21/10/2026. Đây là lịch thực thi hiện hành. `DELIVERY-PLAN.md` và `DELIVERY-TASKS.csv` giữ lại candidate V2 để đối chiếu; bảng dưới đây là cách đọc đúng để đóng từng page.

## Cách đọc

- `→` là dependency bắt buộc; `+` là các task có thể chạy song song.
- Một page được **DONE** khi chuỗi core của page kết thúc và có focused test, quyền server, loading/error và persistence đúng bản chất.
- Regression, browser E2E, review chéo và hardening không được kéo lùi hạn DONE của page; chúng nằm ở lớp candidate cuối.
- G0 09:00 ngày 21/10 là cổng bắt đầu code; G1 contracts/schema freeze lúc 10:00.
- `N` = Nguyễn Tiến Nam, `S` = Sơn, `L` = Long, `D` = Đức.

## Chuỗi dependency và hạn đóng page

| Thứ tự | Page | Hạn đóng | Chuỗi core phải hoàn thành |
|---:|---|---:|---|
| 1 | P01 — Danh sách giải/Admin | 21/10 12:00 | `G0 → (N00 + S00 + L00 + D00) → (L01 + D01 + S01) → S02` |
| 2 | P09 — Tài khoản quản trị | 21/10 12:00 | `G0 → (N00 + S00 + L00 + D00) → (L01 + D01) → D02` |
| 3 | P06 — Quản lí đơn vị | 21/10 16:30 | `G0 → (L00 + N00 + S00 + D00) → (L01 + D01) → L02 → L03` |
| 4 | P07 — Hợp đồng/hạn mức | 21/10 16:30 | `G0 → (L00 + N00 + S00 + D00) → L01 → L02 → L03` |
| 5 | P08 — Xét duyệt giải | 22/10 14:30 | `(N01 → N02) + (L03 → L04) + (D03 → D04) → L05` |
| 6 | P10 — Thí sinh/import | 22/10 14:30 | `(D02 + L02) → D03 → D04 → D05` |
| 7 | P14 — Nhật ký quản trị | 22/10 16:30 | `(S02 + L02) → S03 → S04 → (L03 + S05) → (L05 + S06)` |
| 8 | P17 — Nhận lời mời | 22/10 16:30 | `(D02 + L03) → D06` |
| 9 | P12 — Hỗ trợ tài khoản | 23/10 10:30 | `D02 → D07` |
| 10 | P13 — Kích hoạt/mật khẩu | 23/10 10:30 | `D05 + D07 → P13` |
| 11 | P11 — Nhân sự/Referee | 23/10 16:30 | `(D04 + D05 + D06 + D07) + (L05 → L06 → L07) → D08 → D09` |
| 12 | P02 — Khởi tạo/sửa nháp | 23/10 16:30 | `(S03 → S04) + (N02 → N03 → N04 → N05) + L05 → S07; (S07 + S08 + N05) → S09` |
| 13 | P04 — Luật | 23/10 16:30 | `N00 → N01 → N02 → N03 → N04 → (N05 + N06) → N07; (N06 + N07 + D04) → N08` |
| 14 | P15 — Hub Offline | 23/10 16:30 | `(S01 + D02 + N06) → S08; (N06 + N07 + D04) → N08; (S07 + S08 + N05) → S09` |
| 15 | P16 — Trạng thái Bot | 23/10 16:30 | `N04 → (N05 + N06) → N07; (N06 + N07 + D04) → N08` |
| 16 | P18 — Điều lệ/xác nhận | 23/10 16:30 | `(D04 + D05 + D06 + D07) + L07 → D08 → D09` |
| 17 | P03 — Chi tiết/điều hành | 24/10 10:30 | `(S05 + S06 + S07 + L07) + (S01 + D02 + N06) → S08 → S09; (S09 + N08 + L09 + D09) → S10` |
| 18 | P05 — Xem trận/phân xử | 24/10 10:30 | `(N04 + L07) → L08; (L08 + N04 + S01) → N09` |

P10 cần D03/D04 bắt đầu từ 21/10 nhưng chỉ **đóng page** sau D05 ngày 22/10. P02, P03, P04, P11, P15, P16 và P18 cũng có dependency dùng chung; chúng chỉ được đánh DONE ở mốc cuối của chuỗi core, không phải khi task chuẩn bị đầu tiên xong.

## Thứ tự làm của từng người

### Nguyễn Tiến Nam

| Ngày | Chuỗi |
|---|---|
| 21/10 | `N00 → N01 → N02` |
| 22/10 | `N03 → N04 → N05` |
| 23/10 | `N06 → N07 → N08` |
| 24/10 | `N09 → N10 → N11 → N12` |

### Sơn

| Ngày | Chuỗi |
|---|---|
| 21/10 | `S00 → S01 → S02 → S03` |
| 22/10 | `S04 → S05 → S06` |
| 23/10 | `S07 → S08 → S09` |
| 24/10 | `S10 → S11 → S12 → S13` |

### Long

| Ngày | Chuỗi |
|---|---|
| 21/10 | `L00 → L01 → L02 → L03` |
| 22/10 | `L04 → L05 → L06` |
| 23/10 | `L07 → L08 → L09` |
| 24/10 | `L10 → L11 → L12 → L13` |

### Đức

| Ngày | Chuỗi |
|---|---|
| 21/10 | `D00 → D01 → D02 → D03` |
| 22/10 | `D04 → D05 → D06` |
| 23/10 | `D07 → D08 → D09` |
| 24/10 | `D10 → D11 → D12 → D13` |

## Lớp sau khi page đã đóng

Các task sau không được gắn ngược vào hạn DONE của page: `N10–N12`, `S11–S13`, `L10–L13`, `D10–D13`. Đây là regression, browser E2E, review chéo, tích hợp xuyên suốt, privacy/concurrency và sửa lỗi candidate. Chúng vẫn bắt buộc trước G6 24/10 16:30. `S10`, `N08`, `D09` là task đóng page ở các mốc P03/P04/P11/P15/P16/P18 tương ứng, không phải việc còn treo của các page đã đóng trước đó.
