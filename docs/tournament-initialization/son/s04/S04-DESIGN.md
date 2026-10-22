# S04-DESIGN — Thiết kế kiến trúc Form Groups mở rộng & Conditional Validation (P02)

## 1. Mục tiêu và bối cảnh
Nhiệm vụ `S04` hoàn thiện các nhóm form quản trị ngoài rule builder cho Wizard tạo/sửa bản nháp giải đấu (P02). Theo quy chuẩn hệ thống OTT v2 và Robot Lab design system, giao diện cần đảm bảo tính chặt chẽ về dữ liệu, phản hồi tức thời về mặt ngữ nghĩa và không làm người dùng bối rối khi cấu hình các thông số nâng cao.

Toàn bộ copy giao diện là **Tiếng Việt 100%**, các định danh kỹ thuật giữ nguyên English theo hợp đồng `@ottv2/contracts`.

---

## 2. Kiến trúc các nhóm form mở rộng

### 2.1. Nhóm đối tượng & Đơn vị phụ thuộc (`audienceScope`)
- **Trường phụ thuộc:** `allowedUnitCodes` (danh sách mã đơn vị được phép tham gia).
- **Ràng buộc:**
  - Nếu `audienceScope === 'INTERNAL_UNIT'`: Yêu cầu ít nhất 1 mã đơn vị hợp lệ.
  - Nếu `audienceScope !== 'INTERNAL_UNIT'`: Tự động ẩn và chuẩn hóa xóa danh sách `allowedUnitCodes = []`.

### 2.2. Nhóm thời gian phụ thuộc (Conditional Time Windows)
- **Cửa sổ điểm danh (`checkinRequired`):**
  - Khi bật `checkinRequired = true`: Xuất hiện `checkinOpenAt` và `checkinCloseAt`.
  - Quy tắc kiểm tra: `checkinOpenAt < checkinCloseAt <= scheduledStartAt`.
  - Chuẩn hóa: Khi tắt `checkinRequired = false`, các mốc thời gian điểm danh được đặt lại thành `null`.
- **Hạn chót nộp Bot (`competitionMode`):**
  - Khi `competitionMode === 'BOT_VS_BOT'`: Xuất hiện `botDeadlineAt`.
  - Quy tắc kiểm tra: `botDeadlineAt <= scheduledStartAt`.
  - Chuẩn hóa: Khi chuyển sang `HUMAN_ONLINE`, `botDeadlineAt` tự động xóa về `null`.

### 2.3. Nhóm kiểm soát vận hành (Operational Controls)
- `maxMatchesPerPlayer`: Số trận tối đa mỗi người chơi (mặc định 20, min: 1).
- `maxPairMeetings`: Số lần gặp nhau tối đa giữa hai đấu thủ bất kỳ (mặc định 2, min: 1).
- `rematchCooldownMinutes`: Thời gian chờ giữa 2 lần tái đấu (mặc định 10 phút, min: 0).
- `maxConcurrentMatches`: Số trận đồng thời tối đa trong giải đấu (mặc định 8, min: 1).

### 2.4. Nhóm khán giả & Quyền riêng tư (Spectator & Privacy)
- `spectatorPolicy`:
  - `PUBLIC_WATCH`: Mọi người đều có thể theo dõi.
  - `PARTICIPANTS_ONLY`: Chỉ đấu thủ trong giải được xem.
  - `DISABLED`: Tắt tính năng xem trực tiếp.
- `chatPolicy`:
  - `ENABLED`: Cho phép trò chuyện tự do.
  - `SPECTATOR_MUTED`: Khán giả chỉ xem, không được chat.
  - `DISABLED`: Tắt hoàn toàn chat phòng đấu.
- `leaderboardVisibility`:
  - `LIVE_PUBLIC`: Cập nhật bảng xếp hạng công khai theo thời gian thực.
  - `AFTER_STAGE_END`: Chỉ công bố sau khi kết thúc chặng.
  - `PRIVATE`: Chỉ ban tổ chức được xem.

### 2.5. Nhóm tính điểm & Elo (Scoring System)
- `initialScore`: Điểm giải ban đầu (mặc định 1000).
- `initialElo`: Điểm Elo khởi tạo (mặc định 1000).
- `kFactor`: Hệ số điều chỉnh Elo K-Factor (mặc định 32).
- `scoreFloor`: Điểm sàn tối thiểu (mặc định 0).
- `byeScorePoints`: Điểm cộng khi người chơi được miễn đấu (bye) (mặc định 1).

### 2.6. Nhóm thông tin điều lệ & Kênh hỗ trợ
- `organizersText`: Tên ban tổ chức hiển thị.
- `regulationsText`: Tóm tắt hoặc liên kết văn bản điều lệ giải.
- `contactChannel`: Kênh tiếp nhận hỗ trợ (email/discord/hotline).

---

## 3. Quy trình chuẩn hóa & Kiểm tra tính hợp lệ (Validation Engine)

```
[Người dùng nhập liệu]
         │
         ▼
[Kiểm tra ngữ nghĩa form cục bộ] ──(Lỗi)──> [Hiển thị cảnh báo trực tiếp trên từng trường]
         │ (Hợp lệ)
         ▼
[normalizeTournamentCoreConfig]  ───> [Dọn sạch các trường không liên quan theo toggle]
         │
         ▼
[createDefaultCoreConfig mapping] ───> [Gửi API Payload chuẩn về máy chủ hoặc lưu Buffer]
```

---

## 4. Trải nghiệm người dùng (UX & Robot Lab Aesthetics)
- Nhóm trường mở rộng tại Bước 3 được phân chia thành các card/section trực quan có biểu tượng vector tương ứng.
- Tự động cảnh báo đỏ với icon cảnh báo khi các mốc thời gian phụ thuộc vượt quá `scheduledStartAt`.
- Bước 4 hiển thị tổng quan tóm tắt toàn bộ 19 trường theo các nhóm gọn gàng trước khi người dùng thực hiện lưu nháp.
