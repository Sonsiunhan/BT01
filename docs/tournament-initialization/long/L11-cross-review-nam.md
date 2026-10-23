# L11 — Biên bản Review Chéo Phần Nam (Rules, Version Pinning, Manual Adjudication & Bot Sandbox)

- **Người thực hiện review:** Long (Lead Backend / Foundation, Core Lifecycle, Persistence & Audit)
- **Đối tượng được review:** Phân hệ của Nam (`N00`–`N10`: `P04` Cấu hình Luật, `P05` Phán quyết & Bảng xếp hạng, `P16` Nộp & Kiểm tra Bot cho Giải, `@ottv2/game-rules`, `@ottv2/bot-sdk`, `apps/server/src/modules/bot-library/`, `apps/server/src/modules/bot-online/`)
- **Ngày hoàn tất:** 2026-10-24
- **Kỹ năng ECC áp dụng:** `santa-method`, `production-audit`, `ai-regression-testing`, `error-handling`
- **Trạng thái:** **DONE — 100% PASS**

---

## 1. Bảng kết quả kiểm tra theo Checklist (`T057`–`T073`)

| Mã Test | Hạng mục kiểm tra | Trạng thái ở tầng Core/Contract & Runtime | Trạng thái UI trang riêng của Nam (`P04`, `P05`, `P16`) | Bằng chứng kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `T057` | Hòa có người thắng sau tie-break hợp lệ | **PASS (Core & Rules)** | **PASS (VERIFIED)** | `TieBreakPolicySchema` trong `packages/contracts/src/tournament-initialization.ts`; `@ottv2/game-rules` |
| `T058` | `REPLAY_ONCE_THEN_SEEDED` chỉ đá lại tối đa 1 lần | **PASS (Contract & Rules)** | **PASS (VERIFIED)** | `TieBreakPolicySchema` & `evaluateRuleProfileEnvelope` |
| `T059` | `MANUAL_REFEREE` chỉ TA sở hữu giải mới phán quyết được (chặn Admin, Referee, TA khác) | **PASS (Enforced)** | **PASS (VERIFIED)** | `assertTaContractOrTournamentAccess(..., { mode: "ADJUDICATE_MATCH" })` trong `tournament-store.ts`; test tại `ManualAdjudicationPage.test.tsx` & `tests/unit/tournament-l02-l08.unit.test.ts` |
| `T060` | CAS phán quyết thủ công: chỉ 1 kết quả thắng cuộc khi TA bấm cùng lúc với hết hạn `deadline_at` | **PASS (Enforced)** | **PASS (VERIFIED)** | `AdjudicationLedgerService.submitManualVerdict` trong `adjudication-ledger.service.ts`; kiểm thử 8 luồng đồng thời tại `tests/unit/tournament-l09-concurrency.unit.test.ts` |
| `T061` | Đổi luật trong phạm vi hợp đồng tạo `version N+1` với `effective_at >= now`; ngoài phạm vi bị từ chối | **PASS (Enforced)** | **PASS (VERIFIED)** | `TournamentLifecycleService.publishWithinEnvelopeRuleUpdate` trong `lifecycle.service.ts` |
| `T062` | Trận đang chạy giữ `pinned_config_version_id` cũ; chỉ trận tạo mới tại `created_at >= effective_at` mới lấy version mới | **PASS (Enforced)** | **PASS (VERIFIED)** | `AdmissionGateService.createMatchWithPinnedVersion` trong `admission-gate.service.ts`; kiểm thử tại `tests/unit/tournament-l02-l08.unit.test.ts` |
| `T063`–`T070` | Trần kỹ thuật Bot (`64KB`, `1000ms`, `64MB`), WASI sandbox không rò rỉ mã nguồn Python, memory hoặc stderr/traceback | **PASS (Enforced)** | **PASS (VERIFIED)** | `ContractTechnicalCapsSchema`, `SanitizingAuditService` (`audit.port.ts`), `apps/server/src/modules/bot-online/wasmtime.adapter.ts`, `ManualAdjudicationPage.test.tsx` |
| `T072`–`T073`, `T081` | Công thức `ELO_WEIGHTED_V1`, `score_floor = 0`, xuất Top N và sổ cái bất biến `finish_sequence` | **PASS (Enforced)** | **PASS (VERIFIED)** | `AdjudicationLedgerService.computeLeaderboardSnapshot` trong `adjudication-ledger.service.ts` |

---

## 2. Phát hiện & Điểm hợp đồng đã khóa cho Nam (`N01`–`N10`)

1. **Khóa chặt `mode: "ADJUDICATE_MATCH"` (`T059`):**
   - Trong `apps/server/src/modules/tournament-foundation/tournament-store.ts`, hàm `assertTaContractOrTournamentAccess` đã tách riêng nhánh `ADJUDICATE_MATCH` để đảm bảo ngay cả tài khoản `ADMIN` cũng bị từ chối (`403 FORBIDDEN_ROLE`) nếu cố tình gọi API phán quyết trận đấu. Chỉ duy nhất `ownerTaUserId` có `ContractTaBinding` đang `ACTIVE` mới được phép gửi phán quyết.
   - Giao diện `ManualAdjudicationPage.tsx` của Nam đã tích hợp hiển thị trạng thái `403` chuẩn xác khi không có quyền.
2. **Bảo vệ rò rỉ mã nguồn Bot trong `frozenSnapshot` (`BR-38`, `T064`, `T077`):**
   - Khi mở yêu cầu phán quyết thủ công (`openManualAdjudicationRequest`), `frozenSnapshot` bắt buộc đi qua `sanitizeAuditSnapshot(...)` trước khi lưu để loại bỏ toàn bộ `sourceText`, `pythonSource`, `memoryPayload`, `privateDiagnostics`, `stderr`, `traceback`.
   - Test UI `ManualAdjudicationPage.test.tsx` đã xác nhận: không bao giờ render dữ liệu thô nhạy cảm lên DOM.
3. **Độ an toàn phân xử và quét timeout (`BR-32`):**
   - Đã kiểm chứng tại `tests/integration/n10-engine-settlement.integration.test.ts` và `tests/unit/tournament-l09-concurrency.unit.test.ts`: khi hết hạn `deadlineAt`, giải thuật quét tự động áp dụng `fallbackPolicy` ngay lập tức, ngăn ngừa mọi nỗ lực phán quyết muộn.
