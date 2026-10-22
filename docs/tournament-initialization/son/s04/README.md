# Task S04 — Các nhóm form ngoài rule builder & Conditional Validation (P02)

## 1. Thông tin tổng quan
- **Mã task:** `S04`
- **Tên nhiệm vụ:** Các nhóm form ngoài rule builder (Đối tượng, Kiểm soát vận hành, Tính điểm, Quyền riêng tư, Điều lệ) & Conditional validation
- **Phụ trách:** Sơn
- **Thời lượng thực hiện:** 2 giờ (22/10 13:40 – 22/10 14:15)
- **Đầu vào phụ thuộc:**
  - `S03`: Wizard nháp giải đấu P02 cơ bản (`TournamentWizardPage.tsx`, `tournamentTypes.ts`, `tournamentApi.ts`)
  - `G0`: Governance gate check PASS
  - `@ottv2/contracts`: `TournamentCoreConfig`, `validateTournamentCoreConfigSemantics`, `normalizeTournamentCoreConfig`
- **Đầu ra chính:**
  1. Mở rộng `DraftFormData` và `createDefaultCoreConfig` trong `tournamentTypes.ts` với đầy đủ 19 trường mở rộng:
     - Nhóm đối tượng & Đơn vị: `allowedUnitCodes` (dành riêng cho `INTERNAL_UNIT`).
     - Nhóm thời gian phụ thuộc: `checkinOpenAt`, `checkinCloseAt` (khi `checkinRequired = true`), `botDeadlineAt` (khi `competitionMode = 'BOT_VS_BOT'`).
     - Nhóm thông tin & điều lệ: `organizersText`, `regulationsText`, `contactChannel`.
     - Nhóm kiểm soát vận hành: `maxMatchesPerPlayer`, `maxPairMeetings`, `rematchCooldownMinutes`, `maxConcurrentMatches`.
     - Nhóm quyền riêng tư & khán giả: `spectatorPolicy`, `chatPolicy`, `leaderboardVisibility`.
     - Nhóm hệ thống tính điểm: `initialScore`, `initialElo`, `kFactor`, `scoreFloor`, `byeScorePoints`.
  2. Giao diện Wizard `TournamentWizardPage.tsx` nâng cấp với:
     - Form nhóm thời gian động tại Bước 2 (cửa sổ điểm danh, hạn nộp bot).
     - Form các nhóm kiểm soát vận hành, khán giả & chat, tính điểm Elo/Score, điều lệ & liên hệ tại Bước 3.
     - Bước 4 hiển thị tổng hợp toàn diện các thông số đã cấu hình.
  3. Cơ chế đồng bộ & Khôi phục bộ nhớ đệm `localStorage` hỗ trợ toàn bộ 19 trường S04.
  4. Bộ kiểm thử tự động `tests/unit/s04-tournament-form-groups.unit.test.ts` (5/5 AC passed).

## 2. Cấu trúc tài liệu S04
- `README.md`: Tổng quan nhiệm vụ và liên kết tài liệu S04.
- `S04-DESIGN.md`: Thiết kế chi tiết các nhóm form mở rộng, quy tắc ràng buộc có điều kiện (conditional validation), chuẩn hóa trường (normalization) và ánh xạ máy chủ.
- `S04-ACCEPTANCE.md`: Ma trận tiêu chí nghiệm thu AC-01 đến AC-05.
- `S04-RESULT-2026-10-22.md`: Báo cáo kết quả thực thi, bằng chứng kiểm thử tự động và trạng thái Git.
- `implementation_plan.md`: Kế hoạch chi tiết triển khai S04.
