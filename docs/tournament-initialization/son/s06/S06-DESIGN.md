# S06 — Design: Nhật ký kiểm toán (P14) và Nối kết nối Readiness Core (P03)

## 1. Kiến trúc tổng thể

Giao diện nhật ký kiểm toán (Audit Viewer) phục vụ 2 trường hợp sử dụng chính của người quản trị:
1. **Audit Logs toàn hệ thống (`/admin/audit`):**
   - Dành cho Quản trị viên hệ thống (Admin) theo dõi toàn bộ hành động thay đổi đối với Đơn vị, Hợp đồng, Giải đấu, Phân công nhân sự, Phán quyết và Yêu cầu hỗ trợ.
2. **Audit Logs theo giải đấu (`/admin/tournaments/:tournamentId/audit`):**
   - Dành cho Quản trị viên giải đấu (TA) hoặc Admin tập trung kiểm tra lịch sử thao tác của riêng giải đấu hiện tại (thay đổi cấu hình, ban hành phiên bản luật, điểm danh, hoãn/hủy giải).

```
   ┌─────────────────────────────────────────────────────────────┐
   │            Admin Console (AdminLayout)                      │
   │                                                             │
   │  ┌───────────────────────┐   ┌───────────────────────────┐  │
   │  │ TournamentDetailPage  │──>│   AuditLogsViewerPage     │  │
   │  │        (P03)          │   │          (P14)            │  │
   │  │  - Overview / Config  │   │  - Header & Breadcrumb    │  │
   │  │  - Readiness Panel    │   │  - Filter Bar (Type, ID)  │  │
   │  │  - [Xem nhật ký audit]│   │  - Audit Table            │  │
   │  └───────────────────────┘   │  - Snapshot Diff Inspector│  │
   │                                  - Pagination Controls   │  │
   │                                  └─────────────┬─────────┘  │
   └────────────────────────────────────────────────│────────────┘
                                                    │
                                     GET /api/admin/audit-logs
                                                    │
                                                    ▼
                                  ┌───────────────────────────┐
                                  │   SanitizingAuditService  │
                                  │       (AuditPort)         │
                                  │  - Deep redaction (T077)  │
                                  │  - Append-only immutable  │
                                  └───────────────────────────┘
```

---

## 2. Thiết kế chi tiết thành phần giao diện

### 2.1 Thanh bộ lọc (Filter Bar)
- **Loại mục tiêu (`targetType`):** Dropdown gồm các giá trị:
  - Tất cả các loại (mặc định)
  - `TOURNAMENT`: Giải đấu
  - `RULE_VERSION`: Phiên bản luật
  - `CHANGE_REQUEST`: Yêu cầu thay đổi
  - `CONTRACT`: Hợp đồng
  - `UNIT`: Đơn vị
  - `STAFF`: Phân công nhân sự
  - `ADJUDICATION`: Phán quyết trọng tài
  - `ROSTER`: Danh sách vận động viên
  - `SUPPORT`: Yêu cầu hỗ trợ
- **Mã mục tiêu (`targetId`):** Ô nhập văn bản (tự động khóa và điền sẵn khi ở route `/admin/tournaments/:tournamentId/audit`).
- **Nút lọc & Nút làm mới:** Thực hiện truy vấn lại dữ liệu từ API.

### 2.2 Bảng dữ liệu kiểm toán (Audit Table)
Các cột hiển thị:
1. **Thời điểm (Timestamp):** Định dạng ngày giờ UTC+7 rõ ràng, dễ đọc.
2. **Người thực hiện (Actor):** Hiển thị `actorUserId` kèm huy hiệu vai trò (`ADMIN`, `TOURNAMENT_ADMIN`, `REFEREE`, `SYSTEM`).
3. **Hành động (Action):** Nhãn hành động (ví dụ: `CREATE_DRAFT`, `APPROVE`, `OPEN_SCHEDULED`, `PUBLISH_RULE_VERSION`, `PAUSE_TOURNAMENT`).
4. **Đối tượng (Target):** `targetType` và `targetId`.
5. **Lý do / Ghi chú (Reason):** Lý do thực hiện hành động nếu có.
6. **Chi tiết (Inspector CTA):** Nút mở modal xem chi tiết dữ liệu snapshot trước và sau thay đổi.

### 2.3 Modal xem chi tiết Snapshot (Snapshot Inspector Modal)
- Hiển thị song song hoặc theo dạng thẻ tab:
  - **Dữ liệu trước thay đổi (`beforeSnapshot`):** Dạng JSON định dạng đẹp (hoặc danh sách thuộc tính).
  - **Dữ liệu sau thay đổi (`afterSnapshot`):** Dạng JSON định dạng đẹp.
  - **Mã định danh liên kết (`correlationId`)**: Truy vết nguồn gốc luồng giao dịch.
- **Tiêu chuẩn an toàn:** Cam kết mọi trường nhạy cảm (`password`, `token`, `secret`, `claimCode`) đã được che dấu `[REDACTED]` từ tầng backend theo BR-41/BR-42.

### 2.4 Trạng thái rỗng và Lỗi
- **Rỗng (Empty):** Khi không có bản ghi nào phù hợp bộ lọc, hiển thị icon kèm thông báo "Chưa có bản ghi kiểm toán nào được ghi nhận cho điều kiện tìm kiếm này."
- **Lỗi (Error):** Hiển thị khung cảnh báo màu đỏ có nút "Thử lại".
