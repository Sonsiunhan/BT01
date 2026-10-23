# L12 — Gói Bàn Giao Vận Hành, Runbook, Rollback & Bảo Vệ CSDL (Operations Handoff)

- **Chủ sở hữu:** Long (`L12`)
- **Ngày cập nhật:** 2026-10-24
- **Trạng thái:** **DONE — 100% Sẵn Sàng Vận Hành**
- **Kỹ năng ECC áp dụng:** `production-audit`, `verification-loop`, `delivery-gate`

---

## 1. Runbook Migration Expand-Only (`L01`)

1. **Nguyên tắc an toàn tuyệt đối (`AGENTS.md`):**
   - **KHÔNG BAO GIỜ** chạy migration tự động hoặc chạy test ghi dữ liệu trực tiếp lên `DATABASE_URL` mặc định hoặc cơ sở dữ liệu dùng chung/production khi chưa có phê duyệt riêng của con người.
   - Luôn kiểm tra guard an toàn trước mọi thao tác DB:
     ```bash
     node scripts/network/disposable-db.mjs verify
     ```
2. **Kiểm tra trạng thái PostgreSQL cục bộ (Blocker B1):**
   - Trên môi trường máy chủ hiện tại (`linux`), cổng `127.0.0.1:5432` không có tiến trình PostgreSQL đang lắng nghe (`ECONNREFUSED` — `Blocker B1`).
   - Khi có PostgreSQL disposable (`TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ottv2_tournament_test"`):
     ```bash
     TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ottv2_tournament_test" \
       node scripts/network/disposable-db.mjs provision
     ```
3. **Tính chất Expand-Only của Migration `20261021100000_l01_tournament_initialization`:**
   - Chỉ thêm 3 cột nullable (`tournamentId`, `pinnedConfigVersionId`, `finishSequence`) vào bảng `"Match"`.
   - Chỉ tạo mới 11 bảng thuộc phân hệ Khởi Tạo Giải Đấu (`Unit`, `TournamentContract`, `TournamentContractTaBinding`, `Tournament`, `TournamentConfigVersionRecord`, `TournamentChangeRequestRecord`, `TournamentEnrollmentRecord`, `TournamentStaffAssignmentRecord`, `ManualAdjudicationRequestRecord`, `TournamentScoreLedgerRecord`, `TournamentAuditLogRecord`).
   - Tuyệt đối không có bất kỳ câu lệnh `DROP` hay `TRUNCATE` nào, bảo toàn 100% dữ liệu lịch sử.

---

## 2. Quy trình Rollback & Xử Lý Sự Cố Vận Hành

1. **Rollback Ứng dụng (Zero-Data-Loss):**
   - Do migration ở dạng expand-only (chỉ thêm cột nullable và bảng mới), phiên bản code cũ của `@ottv2/server` vẫn chạy bình thường trên schema mới mà không cần xóa bảng hay hạ cấp cơ sở dữ liệu.
2. **Rollback Trạng thái Giải Đấu Đang Chạy (`RUNNING` / `PAUSED`):**
   - Nếu cần dừng tiếp nhận trận mới ngay lập tức: gọi `POST /api/tournaments/:tournamentId/pause` với lý do vận hành (`T027`).
   - Nếu cần hủy giải khẩn cấp trước khi `ENDED`: gọi `POST /api/tournaments/:tournamentId/cancel` — hệ thống tự động hủy (CAS) toàn bộ `ManualAdjudicationRequest` đang `WAITING` (`T029`) và mở khóa cổng `C32` cho người chơi thường/Guest.

---

## 3. Trạng thái Gate G0 & Giới Hạn Tải

- **Gate G0 (`Section 15 Proposed Defaults`):** Đang ở trạng thái `G0_PENDING_CONFIRMATION` trong `CANDIDATE_POLICY_DEFAULTS_V1` (`packages/contracts/src/tournament-initialization.ts`). Không tự ý ghi nhận là đã chốt vĩnh viễn khi chưa có xác nhận của PO/BA.
- **Giới hạn tải chuẩn xác (No False 10k Claim):** Tuân thủ giới hạn hợp đồng: tối đa 1000 thí sinh (`maxParticipantsTotal`), tối đa 100 giải đấu (`maxTournamentsTotal`). Không tuyên bố sai lệch về khả năng chịu tải 10.000 người dùng đồng thời khi chưa có đo kiểm tải phân tán thực tế.
- **Blocker B1 (Local PostgreSQL Daemon):** Đã kiểm soát an toàn qua InMemory StateStore và guard kiểm tra `TEST_DATABASE_URL` độc lập.
