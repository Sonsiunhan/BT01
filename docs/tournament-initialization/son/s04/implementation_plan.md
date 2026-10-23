# S04 — Implementation Plan: Các nhóm form ngoài rule builder & Conditional Validation (P02)

**Owner:** Sơn  
**Task:** S04  
**Trang:** P02 — Khởi tạo / Sửa nháp giải đấu (mở rộng nhóm form)  
**Dependencies:** S03, G0 PASS  
**Status:** COMPLETED  

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu
Mở rộng trang Wizard P02 và lớp dữ liệu để hỗ trợ đầy đủ các nhóm form ngoài rule builder theo đặc tả BA/SA v1.0 I3:
1. **Ràng buộc có điều kiện (Conditional Validation):**
   - Khi `audienceScope === 'INTERNAL_UNIT'`: Bắt buộc chọn ít nhất một đơn vị (`allowedUnitCodes.length > 0`).
   - Khi `checkinRequired === true`: Bắt buộc nhập `checkinOpenAt` và `checkinCloseAt`, đồng thời `checkinCloseAt <= scheduledStartAt`.
   - Khi `competitionMode === 'BOT_VS_BOT'`: Bắt buộc nhập `botDeadlineAt` và `botDeadlineAt <= scheduledStartAt`.
2. **Quy tắc chuẩn hóa tự động (Normalization):**
   - Nếu `audienceScope !== 'INTERNAL_UNIT'`: Xóa trắng `allowedUnitCodes`.
   - Nếu `checkinRequired === false`: Xóa `checkinOpenAt` và `checkinCloseAt` về `null`.
   - Nếu `competitionMode === 'HUMAN_ONLINE'`: Xóa `botDeadlineAt` về `null`.
3. **Các nhóm cấu hình mở rộng (Form Groups):**
   - **Vận hành (Operational Controls):** Số trận tối đa mỗi người (`maxMatchesPerPlayer`), số lần gặp nhau tối đa giữa 2 đấu thủ (`maxPairMeetings`), thời gian chờ tái đấu (`rematchCooldownMinutes`), số trận đồng thời tối đa (`maxConcurrentMatches`).
   - **Khán giả & Quyền riêng tư (Spectator & Privacy):** Chính sách khán giả (`spectatorPolicy`), kênh trò chuyện (`chatPolicy`), hiển thị bảng xếp hạng (`leaderboardVisibility`).
   - **Hệ thống tính điểm (Scoring System):** Điểm khởi đầu (`initialScore`), Elo ban đầu (`initialElo`), hệ số K-Factor (`kFactor`), điểm sàn (`scoreFloor`), điểm khi được bye (`byeScorePoints`).
   - **Điều lệ & Liên hệ:** Đơn vị tổ chức (`organizersText`), điều lệ (`regulationsText`), kênh hỗ trợ (`contactChannel`).
4. **Khả năng lưu trữ cục bộ (Resilience):**
   - Bộ đệm `localStorage` hỗ trợ đầy đủ 19 trường mở rộng, phục hồi nguyên vẹn khi tải lại trang.

### 1.2 Out of scope
- Rule builder tuỳ chỉnh bàn cờ, nước đi, quân cờ (thuộc S07 / N02 / N05).
- Nộp duyệt và phê duyệt chính thức giải đấu (thuộc S07 / L05).

---

## 2. Phân công File (File Ownership)

| File | Phân loại | Mô tả |
|---|---|---|
| `docs/tournament-initialization/son/s04/*` | Docs | Tài liệu thiết kế, kế hoạch, nghiệm thu và kết quả S04 |
| `apps/web/src/features/admin/tournaments/tournamentTypes.ts` | Types | Mở rộng `DraftFormData` và `createDefaultCoreConfig` với 19 trường S04 |
| `apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx` | UI | Thêm conditional inputs tại Bước 2, form groups mới tại Bước 3, summary mở rộng tại Bước 4 |
| `tests/unit/s04-tournament-form-groups.unit.test.ts` | Test | Bộ kiểm thử AC-01 đến AC-05 cho S04 |

---

## 3. Các bước thực hiện (Harness → Dev → Test → Review)

1. **Harness First:**
   - Xây dựng file kiểm thử `tests/unit/s04-tournament-form-groups.unit.test.ts` định nghĩa các kỳ vọng AC-01 (conditional validation), AC-02 (normalization), AC-03 (zero semantics issues), AC-04 (mapping), AC-05 (local storage buffer).
2. **Cập nhật Types & Mapping:**
   - Cập nhật `DraftFormData` và `createDefaultCoreConfig` trong `tournamentTypes.ts` với đầy đủ các trường và giá trị mặc định hợp lý.
3. **Mở rộng giao diện Wizard:**
   - Bước 2: Bổ sung input conditional `checkinOpenAt`, `checkinCloseAt` (khi bật `checkinRequired`) và `botDeadlineAt` (khi chọn `BOT_VS_BOT`).
   - Bước 3: Thêm các khối accordion/card cho Nhóm kiểm soát vận hành, Nhóm khán giả & chat, Nhóm tính điểm, Nhóm đơn vị & điều lệ.
   - Bước 4: Hiển thị tóm tắt đầy đủ các cấu hình mở rộng trước khi lưu nháp.
4. **Kiểm thử & Xác nhận:**
   - Chạy toàn bộ test suite và typecheck để bảo đảm không xảy ra lỗi hồi quy (regression).
