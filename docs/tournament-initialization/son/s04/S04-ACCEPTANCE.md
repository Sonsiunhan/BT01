# S04-ACCEPTANCE — Ma trận tiêu chí nghiệm thu Task S04

## 1. Tiêu chí bắt buộc (Acceptance Criteria)

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| **AC-01** | Kiểm tra ràng buộc có điều kiện (Conditional Validation) | Vitest Unit Test | 1. `audienceScope === 'INTERNAL_UNIT'` bắt buộc có ít nhất một đơn vị `allowedUnitCodes`.<br>2. `checkinRequired === true` yêu cầu cửa sổ điểm danh hợp lệ và `checkinCloseAt <= scheduledStartAt`.<br>3. `competitionMode === 'BOT_VS_BOT'` yêu cầu `botDeadlineAt <= scheduledStartAt`. |
| **AC-02** | Chuẩn hóa dữ liệu khi thay đổi toggle cha (Normalization) | Vitest Unit Test | Khi chuyển đổi `audienceScope` không phải nội bộ, `allowedUnitCodes` được xóa sạch. Khi tắt `checkinRequired`, `checkinOpenAt/CloseAt` về `null`. Khi chuyển chế độ đấu người, `botDeadlineAt` về `null`. |
| **AC-03** | Không có lỗi ngữ nghĩa khi cấu hình hợp lệ | Vitest Unit Test | Cấu hình đầy đủ các trường hợp lệ trả về mảng rỗng `issues.length === 0` từ `validateTournamentCoreConfigSemantics`. |
| **AC-04** | Ánh xạ đầy đủ các nhóm kiểm soát vận hành, tính điểm và riêng tư vào CoreConfig | Vitest Unit Test | `createDefaultCoreConfig` tiếp nhận và gán chính xác tất cả các trường nâng cao: `maxMatchesPerPlayer`, `maxPairMeetings`, `rematchCooldownMinutes`, `maxConcurrentMatches`, `spectatorPolicy`, `chatPolicy`, `leaderboardVisibility`, `initialScore`, `initialElo`, `kFactor`, `scoreFloor`, `byeScorePoints`. |
| **AC-05** | Lưu trữ và phục hồi trọn vẹn 19 trường mở rộng qua Local Storage Buffer | Vitest Unit Test | Dữ liệu chứa tất cả các trường nâng cao được lưu vào bộ đệm trình duyệt và khôi phục nguyên vẹn 100%, không bị mất mát hay thay đổi giá trị. |

---

## 2. Kiểm thử tự động tương ứng

- **File kiểm thử:** `tests/unit/s04-tournament-form-groups.unit.test.ts`
  - `it("AC-01: validates conditional rules for INTERNAL_UNIT, check-in window and bot deadline")`: Đạt (Passed).
  - `it("AC-02: normalizes conditional fields when parent scope/mode toggles change")`: Đạt (Passed).
  - `it("AC-03: reports zero semantic issues when all conditional fields are valid")`: Đạt (Passed).
  - `it("AC-04: maps operational control, scoring, and privacy groups into coreConfig")`: Đạt (Passed).
  - `it("AC-05: preserves all extended S04 form groups across Local Storage buffer save & recovery")`: Đạt (Passed).
