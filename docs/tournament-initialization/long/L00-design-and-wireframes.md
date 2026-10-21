# L00 — Thiết kế trang SA (P06, P07, P08) và Hợp nhất API / Data Proposal

- **Task ID:** `L00`
- **Chủ sở hữu (Owner):** Long
- **Phạm vi trang:** `P06` (Quản lí đơn vị), `P07` (Hợp đồng và hạn mức), `P08` (Xét duyệt giải và yêu cầu thay đổi)
- **Kỹ năng ECC áp dụng:** `intent-driven-development`, `architecture-decision-records`, `error-handling`, `click-path-audit`
- **Trạng thái:** `DONE` (Thiết kế wireframe, state map, contract skeleton, error envelope và bảng phân quyền method ownership)

---

## 1. Bối cảnh và Nguyên tắc Thiết kế

1. **Ngôn ngữ hiển thị:** Toàn bộ nhãn giao diện, thông báo trạng thái, lỗi nhập liệu và hướng dẫn người dùng sử dụng **tiếng Việt** chuẩn mực; tên trường dữ liệu, mã lỗi, enum và định danh kỹ thuật giữ **tiếng Anh**.
2. **Thẩm quyền máy chủ (Server Authority):**
   - Giao diện không tự cấp quyền, không tự tính toán hạn mức (`quota_used`), không tự chuyển trạng thái giải đấu hoặc tự suy diễn điều kiện sẵn sàng (`READY`).
   - Không có bất kỳ nút tham gia chơi Online nào trong khung quản trị Admin (`T005`).
3. **Đầy đủ trạng thái hiển thị (UI States):**
   - Mọi trang đều hỗ trợ đầy đủ 6 trạng thái: `Loading` (đang tải dữ liệu), `Empty` (chưa có dữ liệu kèm hướng dẫn thao tác đầu tiên), `Normal` (hiển thị bảng/thẻ và bộ lọc), `Validation Error` (báo lỗi cạnh trường và giữ nguyên dữ liệu đang nhập), `Forbidden / Blocked` (không đủ quyền `SYSTEM_ADMIN` hoặc bị chặn bởi điều kiện tiên quyết kèm đường quay lại an toàn), và `Network / Conflict Error` (xung đột phiên bản `STALE_VERSION` 409 hoặc lỗi mạng kèm nút `Thử lại`).
4. **Khả năng tiếp cận & Giao diện (A11y / Responsive / Theme / Motion):**
   - Điều hướng bàn phím (`Tab`, `Shift+Tab`, `Enter`, `Escape`), nhãn `aria-label` / `htmlFor` rõ ràng, vùng thông báo lỗi `role="alert"`.
   - Hỗ trợ responsive trên cả Desktop (`>= 1024px`) và Mobile (`360px–767px`), tương thích chế độ Sáng/Tối (`light`/`dark`) và tôn trọng `prefers-reduced-motion`.

---

## 2. Wireframe & State Map chi tiết theo từng trang

### 2.1 Trang P06 — Quản lí đơn vị (`/admin/units`)

- **Tác nhân được phép:**
  - `SYSTEM_ADMIN`: Toàn quyền xem danh sách, tìm kiếm, tạo đơn vị mới, cập nhật tên/trạng thái, khóa đơn vị (`LOCKED`), và kiểm tra tham chiếu trước khi xóa/khóa (`T002`, `BR-13`).
  - `TOURNAMENT_ADMIN`: Chỉ đọc danh sách đơn vị thuộc phạm vi hợp đồng (`allowed_unit_ids`) qua API danh mục; truy cập trực tiếp trang quản trị `/admin/units` hiển thị trạng thái `Forbidden (403)` kèm nút quay về `/admin/tournaments`.
- **Đường quay lại:** Liên kết điều hướng `← Quay lại Danh sách giải (/admin/tournaments)`.

```text
+-----------------------------------------------------------------------------------+
| [← Danh sách giải]   QUẢN LÍ ĐƠN VỊ ĐỐI TÁC (P06)                [Vai trò: SA]   |
+-----------------------------------------------------------------------------------+
| Tìm kiếm: [ Nhập mã hoặc tên đơn vị... ]  Trạng thái: [ Tất cả v ]  [+ Tạo đơn vị]|
+-----------------------------------------------------------------------------------+
| biểu mẫu tạo / sửa đơn vị (Inline Panel)                                          |
| Mã đơn vị (unit_code)*: [ THPT_CHUYEN_HN ] (Chuẩn hóa IN HOA, chữ/số/gạch dưới)   |
| Tên đơn vị (name)*:     [ Trường THPT Chuyên Hà Nội ]                             |
| Mô tả ngắn:             [ Đơn vị đối tác khu vực miền Bắc ]                       |
| [Lỗi cạnh trường nếu trùng unit_code hoặc sai định dạng]                          |
|                                                        [Hủy]   [Lưu đơn vị]       |
+-----------------------------------------------------------------------------------+
| DANH SÁCH ĐƠN VỊ (Hiển thị 3 đơn vị)                                 [Làm mới ↻]  |
+------------------+----------------------------+------------+----------+-----------+
| Mã đơn vị        | Tên đơn vị                 | Trạng thái | Liên kết | Thao tác  |
+------------------+----------------------------+------------+----------+-----------+
| THPT_CHUYEN_HN   | Trường THPT Chuyên Hà Nội  | ACTIVE     | 2 HĐ/1G  | [Sửa][Khóa]|
| DH_BACH_KHOA     | Đại học Bách Khoa          | ACTIVE     | 0 HĐ/0G  | [Sửa][Xóa] |
| THPT_LE_HONG_PHONG| THPT Lê Hồng Phong        | LOCKED     | 1 HĐ/1G  | [Mở khóa] |
+------------------+----------------------------+------------+----------+-----------+
```

- **Quy tắc hành vi P06:**
  - `unit_code` là duy nhất toàn hệ thống, tự động chuẩn hóa `trim().toUpperCase()`, khớp mẫu `^[A-Z0-9_]{2,32}$`.
  - Import thí sinh (`P10`) tuyệt đối không tự động tạo đơn vị mới (`BR-13`, `T032`).
  - **FK Reference Guard:** Nếu đơn vị đang được tham chiếu bởi bất kỳ Hợp đồng (`partner_unit_id` hoặc `allowed_unit_ids`), Giải đấu (`organizer_unit_id`, `allowed_unit_ids`) hoặc Thí sinh (`unit_code`), hành động xóa cứng bị chặn với mã lỗi `CONFLICT` (`UNIT_IN_USE`), hướng dẫn chuyển sang trạng thái `LOCKED` để ngừng cấp mới nhưng vẫn bảo toàn lịch sử.

---

### 2.2 Trang P07 — Hợp đồng, Hạn mức và Phạm vi cấu hình (`/admin/contracts`)

- **Tác nhân được phép:**
  - `SYSTEM_ADMIN`: Tạo hợp đồng mới, cấu hình hạn mức (`max_tournaments`, `max_participants_per_tournament`, `max_participants_total`), cấu hình khung luật (`rules_envelope`) và trần tài nguyên sandbox (`sandbox_caps`), kích hoạt hợp đồng (`ACTIVE`), thu hồi/khóa hợp đồng (`REVOKED`), và gán/thu hồi quyền `TOURNAMENT_ADMIN` (`TournamentAdminBinding`).
  - `TOURNAMENT_ADMIN`: Chỉ xem các hợp đồng mà mình được gán quyền hiệu lực khi tạo/sửa giải ở `P02`; không có quyền sửa hợp đồng hay gán quyền cho người khác (`BR-02`, `T002`, `T011`).
- **Đường quay lại:** `← Quay lại Danh sách giải (/admin/tournaments)` và liên kết sang `Quản lí đơn vị (/admin/units)`.

```text
+-----------------------------------------------------------------------------------+
| [← Danh sách giải]   HỢP ĐỒNG, HẠN MỨC & KHUNG LUẬT (P07)        [Vai trò: SA]   |
+-----------------------------------------------------------------------------------+
| Bộ lọc đơn vị: [ Tất cả v ]   Trạng thái: [ Tất cả v ]          [+ Tạo hợp đồng]  |
+-----------------------------------------------------------------------------------+
| BIỂU MẪU HỢP ĐỒNG & KHUNG CẤU HÌNH (Contract & Envelope Editor)                   |
| 1. Thông tin chung & Thời hạn                                                     |
|    Mã hợp đồng*: [ HD_2026_MIEN_BAC ]   Đơn vị đối tác*: [ THPT_CHUYEN_HN v ]     |
|    Hiệu lực từ*: [ 2026-10-01 ]         Đến ngày*:       [ 2026-12-31 ]           |
| 2. Hạn mức chung (Shared Quota — đếm trên hợp đồng, không nhân theo số TA)       |
|    Số giải tối đa (max_tournaments)*:             [ 5 ]                           |
|    Thời lượng giải tối thiểu / tối đa (ngày)*:    [ 1 ] -> [ 14 ]                 |
|    Thí sinh tối đa / 1 giải*:                     [ 500 ]                         |
|    Tổng lượt thí sinh toàn hợp đồng*:             [ 2000 ]                        |
|    (Quy ước: tổng lượt ghi danh qua mọi giải thuộc HĐ; 1 người 2 giải = 2 suất)  |
| 3. Phạm vi đơn vị & Chế độ điều khiển được phép                                   |
|    Đơn vị được phép (allowed_unit_ids)*: [x] THPT_CHUYEN_HN  [x] DH_BACH_KHOA     |
|    Chế độ điều khiển*: [x] HUMAN_ONLY    [x] BOT_ONLY        [x] HYBRID           |
| 4. Khung luật tối đa (rules_envelope) & Trần tài nguyên Bot (sandbox_caps)        |
|    Kích thước bàn cho phép: Hàng [ 5 ]..[ 15 ], Cột [ 5 ]..[ 15 ]                 |
|    Họ di chuyển: [x] RAY [x] LEAP | Đích: [x] STATIC [x] CYCLE [x] SEEDED         |
|    Cho phép Hòa: [x] | Cho phép phân xử thủ công (MANUAL_ADMIN): [x]              |
|    Trần Bot: Turn CPU [ 500 ]ms | Total Compute/bên [ 30000 ]ms | RAM [ 64 ]MB    |
|                                                  [Hủy]  [Lưu nháp]  [Kích hoạt HĐ]|
+-----------------------------------------------------------------------------------+
| DANH SÁCH HỢP ĐỒNG & GÁN QUYỀN TOURNAMENT ADMIN                                   |
| [HD_2026_MIEN_BAC] Đơn vị: THPT_CHUYEN_HN | Trạng thái: ACTIVE                    |
|   Hạn mức giải: Đã dùng 1 / 5 (Còn lại: 4) | Tổng suất thí sinh: 120 / 2000       |
|   TA được gán quyền (Bindings):                                                   |
|   - ta_nguyen_van_a (Hiệu lực đến 2026-12-31)                    [Thu hồi quyền]  |
|   + Gán TA mới: [ Chọn tài khoản TA / nhập userId ] [Hết hạn: 2026-12-31] [Gán]   |
+-----------------------------------------------------------------------------------+
```

---

### 2.3 Trang P08 — Hộp duyệt và Chi tiết Xét duyệt giải (`/admin/approvals`, `/admin/approvals/:id`)

- **Tác nhân được phép:**
  - `SYSTEM_ADMIN`: Xem hàng đợi hồ sơ giải chờ duyệt (`SUBMITTED`, `UNDER_REVIEW`) và các yêu cầu thay đổi cấu hình khóa (`TournamentChangeRequest`), xem đối chiếu chi tiết với `rules_envelope` của hợp đồng, ghi chú theo từng trường (`fieldNotes`), và ra một trong 3 quyết định:
    1. `APPROVED` (Phê duyệt — chốt `approvedSnapshot` bất biến, mở giai đoạn chuẩn bị roster).
    2. `CHANGES_REQUESTED` (Yêu cầu chỉnh sửa — giữ nguyên lượt hạn mức, lưu lịch sử ghi chú để TA sửa và gửi lại).
    3. `REJECTED` (Từ chối — trạng thái kết thúc hồ sơ, hoàn trả đúng 1 lượt hạn mức vào hợp đồng một cách nguyên tử và idempotent).
  - `TOURNAMENT_ADMIN`: Chỉ xem lịch sử quyết định và ghi chú yêu cầu sửa trên giải của chính mình; không có quyền tự duyệt (`BR-01`, `T003`, `T022`).
- **Đường quay lại:** `← Quay lại Danh sách giải (/admin/tournaments)`.

```text
+-----------------------------------------------------------------------------------+
| [← Danh sách giải]   HỘP DUYỆT HỒ SƠ GIẢI & CHANGE REQUEST (P08) [Vai trò: SA]   |
+-----------------------------------------------------------------------------------+
| Tab: [ Hồ sơ giải mới (2) ]  [ Yêu cầu đổi cấu hình khóa - Change Request (1) ]   |
| Bộ lọc trạng thái: [ Chờ duyệt (SUBMITTED/UNDER_REVIEW) v ]      [Làm mới ↻]      |
+-----------------------------------+-----------------------------------------------+
| DANH SÁCH HỒ SƠ                   | CHI TIẾT HỒ SƠ & ĐỐI CHIẾU HỢP ĐỒNG           |
|                                   | Giải: Giải Vô Địch Robot Lab Mùa Thu 2026     |
| > [G-01] Giải Robot Lab Mùa Thu   | Mã (slug): robot-lab-mua-thu-2026             |
|   TA: ta_nguyen_van_a             | Hợp đồng: HD_2026_MIEN_BAC (Còn 4/5 giải)     |
|   Trạng thái: SUBMITTED           | Phiên bản cấu hình đệ trình: v1 (Rev: 3)      |
|   Đệ trình: 21/10/2026 09:30      |                                               |
|                                   | BẢNG ĐỐI CHIẾU ENVELOPE & KIỂM TRA HỢP LỆ:    |
|   [G-02] Giải Giao Hữu Liên Trường| - Quy mô: 300 thí sinh (HĐ tối đa: 500) [ĐẠT] |
|   TA: ta_tran_thi_b               | - Lịch giải: 22/10 -> 25/10 (3 ngày)    [ĐẠT] |
|   Trạng thái: UNDER_REVIEW        | - Bàn cờ: 11x11 (HĐ: 5..15)             [ĐẠT] |
|                                   | - Luật di chuyển: RAY + LEAP            [ĐẠT] |
|                                   | - Đích: CYCLE (K=3 vòng)                [ĐẠT] |
|                                   | - Phân xử hòa cuối: MANUAL_ADMIN (300s) [ĐẠT] |
|                                   |                                               |
|                                   | GHI CHÚ THEO TRƯỜNG (Field Notes):            |
|                                   | Trường: [ F17_roster_close_at v ]             |
|                                   | Nội dung: [ Cần đóng danh sách trước 2h ] [+] |
|                                   |                                               |
|                                   | LÝ DO / GHI CHÚ TỔNG QUÁT*:                   |
|                                   | [ Hồ sơ hợp lệ, đồng ý phê duyệt cấu hình v1 ]|
|                                   |                                               |
|                                   | [Phê duyệt (APPROVE)] [Yêu cầu sửa] [Từ chối] |
+-----------------------------------+-----------------------------------------------+
```

---

## 3. Hợp nhất Khung Contract, Error Envelope và Method Ownership

### 3.1 Quy ước Error Envelope chuẩn (`@ottv2/contracts`)

Mọi API thuộc phạm vi Khởi tạo giải đấu sử dụng chung cấu trúc `ErrorEnvelope` của hệ thống:

```json
{
  "code": "VALIDATION_ERROR | UNAUTHORIZED | CONFLICT | RATE_LIMITED | NOT_FOUND | INTERNAL_ERROR | SERVICE_UNAVAILABLE | PROTOCOL_VERSION_MISMATCH",
  "message": "Thông báo tiếng Việt an toàn, rõ nguyên nhân cho người dùng.",
  "retryable": false,
  "severity": "INVALID | RECOVERABLE | FATAL_SESSION",
  "details": {
    "reason": "CONTRACT_QUOTA_EXHAUSTED | ENVELOPE_VIOLATION | STALE_VERSION | FORBIDDEN_ROLE | ADJUDICATION_DEADLINE_EXPIRED | TOURNAMENT_ADMISSION_LOCKED | ...",
    "field": "maxParticipants",
    "contractId": "contract-01",
    "tournamentId": "tour-01",
    "expectedRevision": 2,
    "currentRevision": 3,
    "quotaRemaining": 0
  }
}
```

- **Bảo mật lỗi (`BR-34`, `BR-42`, `T004`, `T010`):**
  - Không bao giờ trả về stack trace, câu lệnh SQL, đường dẫn tệp máy chủ, biến môi trường, mật khẩu, `passwordHash`, `activationToken`, `resetToken`, hoặc mã nguồn Bot riêng tư trong `details` hoặc `message`.
  - Khi `TOURNAMENT_ADMIN` truy cập tài nguyên thuộc tenant/giải của TA khác, trả về `403` hoặc `404` đồng nhất mà không tiết lộ dữ liệu nội bộ của giải khác (`T004`).

### 3.2 Ma trận Phân quyền Method & Port Ownership (4 Thành viên)

| Module / Port | Chủ sở hữu (Single Writer) | Đường dẫn định nghĩa | Consumer (Người gọi) | Quy tắc bất biến |
|---|---|---|---|---|
| **Contracts & Zod Schemas** | **Long** | `packages/contracts/src/tournament-initialization.ts`, `packages/contracts/src/account/d00.dto.ts` | Nam, Sơn, Đức, Long | Chốt tại `L01`; mở rộng không phá vỡ tương thích ngược (`expand-only`). |
| **Prisma Schema & Migration Candidate** | **Long** | `prisma/schema.prisma`, `prisma/migrations/20261021100000_l01_tournament_initialization/migration.sql` | Long, Đức, Sơn, Nam | Chỉ dùng DDL mở rộng (`CREATE TABLE`, `ADD COLUMN` nullable/default); chỉ chạy trên disposable test DB đã qua guard. |
| **Audit Port (`AuditPort`)** | **Long** | `apps/server/src/modules/tournament-foundation/audit.port.ts` | Long, Sơn (`P14`), Đức (`D02`–`D08`), Nam (`N04`, `N09`) | Append-only; tự động lọc bỏ mọi trường nhạy cảm (`password`, `token`, `sourceText`, `memoryPayload`). |
| **Units & Contracts Service (`P06`, `P07`)** | **Long** | `apps/server/src/modules/tournament-foundation/` | Long FE (`P06`, `P07`), Sơn (`P02`), Đức (`D02`, `D03`) | Kiểm tra khóa ngoại trước khi xóa đơn vị; tính toán `quotaRemaining` và `participantsRemainingTotal` chính xác. |
| **Core Draft, Quota, Approval & Lifecycle (`CoreService`)** | **Long** | `apps/server/src/modules/tournament-core/` | Sơn (`P01`, `P02`, `P03`, `P14`), Nam (`P04`, `P05`), Đức (`D03`–`D08`) | Tạo nháp trừ 1 lượt hợp đồng; xóa nháp/từ chối hoàn đúng 1 lần; hủy giải từng `APPROVED` không hoàn lượt; sửa trường khóa sau duyệt đi qua `ChangeRequest`. |
| **Player Admission Gate (`C32`)** | **Long** | `apps/server/src/modules/tournament-core/admission-gate.service.ts` | `app.ts`, `/matchmaking/queue`, `/rooms`, Sơn (`P01`, `P15`) | Chặn `SYSTEM_ADMIN`/`TOURNAMENT_ADMIN` chơi Online; khi có giải `RUNNING`/`PAUSED` chặn mọi `USER` ngoài phạm vi và `GUEST` vào trận Online mới. |
| **Manual Adjudication & Score/Elo Replay Ledger** | **Long** | `apps/server/src/modules/tournament-core/adjudication-ledger.service.ts` | Nam (`P05` `N04`/`N09`), Operations runner | CAS một phán quyết duy nhất (`RESOLVED_MANUAL` / `RESOLVED_TIMEOUT` / `CANCELLED_ABORTED`); `serverNow >= deadlineAt` ưu tiên `fallback`; cộng điểm sàn 0 theo đúng `finish_sequence`. |
| **FE Route & Component Exports (`P06`, `P07`, `P08`)** | **Long** (Component) → **Sơn** (Router) | `apps/web/src/features/admin/{units,contracts,approvals}/`, `apps/web/src/features/admin/long-routes.tsx` | Sơn đăng ký vào `apps/web/src/app/router.tsx` và `routes.ts` | Long không sửa trực tiếp `router.tsx` / `routes.ts` của Sơn để tránh xung đột single-writer. |
