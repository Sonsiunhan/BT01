# L11 — Biên bản Review Chéo Phần Nam (Rules, Version Pinning, Manual Adjudication & Bot Sandbox)

- **Người thực hiện review:** Long (Lead Backend / Foundation, Core Lifecycle, Persistence & Audit)
- **Đối tượng được review:** Phân hệ của Nam (`N00`–`N08`: `P04` Cấu hình Luật, `P05` Phán quyết & Bảng xếp hạng, `P16` Nộp & Kiểm tra Bot cho Giải, `@ottv2/game-rules`, `@ottv2/bot-sdk`, `apps/server/src/modules/bot-library/`, `apps/server/src/modules/bot-online/`)
- **Ngày thực hiện:** 2026-10-21
- **Kỹ năng ECC áp dụng:** `santa-method`, `production-audit`, `ai-regression-testing`, `error-handling`

---

## 1. Bảng kết quả kiểm tra theo Checklist (`T057`–`T073`)

| Mã Test | Hạng mục kiểm tra | Trạng thái ở tầng Core/Contract & Runtime hiện có | Trạng thái UI trang riêng của Nam (`P04`, `P05`, `P16`) | Bằng chứng kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `T057` | Hòa có người thắng sau tie-break hợp lệ | **PASS (Core & Rules)** | `PENDING_NAM_BRANCH_UI` | `TieBreakPolicySchema` trong `packages/contracts/src/tournament-initialization.ts`; `@ottv2/game-rules` |
| `T058` | `REPLAY_ONCE_THEN_SEEDED` chỉ đá lại tối đa 1 lần | **PASS (Contract & Rules)** | `PENDING_NAM_BRANCH_UI` | `TieBreakPolicySchema` & `evaluateRuleProfileEnvelope` |
| `T059` | `MANUAL_REFEREE` chỉ TA sở hữu giải mới phán quyết được (chặn Admin, Referee, TA khác) | **PASS (Enforced)** | `PENDING_NAM_BRANCH_UI` | `assertTaContractOrTournamentAccess(..., { mode: "ADJUDICATE_MATCH" })` trong `tournament-store.ts`; kiểm thử tại `tests/unit/tournament-l02-l08.unit.test.ts` |
| `T060` | CAS phán quyết thủ công: chỉ 1 kết quả thắng cuộc khi TA bấm cùng lúc với hết hạn `deadline_at` | **PASS (Enforced)** | `PENDING_NAM_BRANCH_UI` | `AdjudicationLedgerService.submitManualVerdict` trong `adjudication-ledger.service.ts`; kiểm thử 8 luồng đồng thời tại `tests/unit/tournament-l09-concurrency.unit.test.ts` |
| `T061` | Đổi luật trong phạm vi hợp đồng tạo `version N+1` với `effective_at >= now`; ngoài phạm vi bị từ chối | **PASS (Enforced)** | `PENDING_NAM_BRANCH_UI` | `TournamentLifecycleService.publishWithinEnvelopeRuleUpdate` trong `lifecycle.service.ts` |
| `T062` | Trận đang chạy giữ `pinned_config_version_id` cũ; chỉ trận tạo mới tại `created_at >= effective_at` mới lấy version mới | **PASS (Enforced)** | `PENDING_NAM_BRANCH_UI` | `AdmissionGateService.createMatchWithPinnedVersion` trong `admission-gate.service.ts`; kiểm thử tại `tests/unit/tournament-l02-l08.unit.test.ts` |
| `T063`–`T070` | Trần kỹ thuật Bot (`64KB`, `1000ms`, `64MB`), WASI sandbox không rò rỉ mã nguồn Python, memory hoặc stderr/traceback | **PASS (Enforced)** | `Available in BotWorkbenchPage / PENDING P16 Tournament Binding UI` | `ContractTechnicalCapsSchema`, `SanitizingAuditService` (`audit.port.ts`), `apps/server/src/modules/bot-online/wasmtime.adapter.ts` |
| `T072`–`T073`, `T081` | Công thức `ELO_WEIGHTED_V1`, `score_floor = 0`, xuất Top N và sổ cái bất biến `finish_sequence` | **PASS (Enforced)** | `PENDING_NAM_BRANCH_UI` | `AdjudicationLedgerService.computeLeaderboardSnapshot` trong `adjudication-ledger.service.ts` |

---

## 2. Phát hiện & Điểm hợp đồng đã khóa cho Nam (`N01`–`N08`)

1. **Khóa chặt `mode: "ADJUDICATE_MATCH"` (`T059`):**
   - Trong `apps/server/src/modules/tournament-foundation/tournament-store.ts`, hàm `assertTaContractOrTournamentAccess` đã tách riêng nhánh `ADJUDICATE_MATCH` để đảm bảo ngay cả tài khoản `ADMIN` cũng bị từ chối (`403 FORBIDDEN_ROLE`) nếu cố tình gọi API phán quyết trận đấu. Chỉ duy nhất `ownerTaUserId` có `ContractTaBinding` đang `ACTIVE` mới được phép gửi phán quyết.
2. **Bảo vệ rò rỉ mã nguồn Bot trong `frozenSnapshot` (`BR-38`, `T064`, `T077`):**
   - Khi mở yêu cầu phán quyết thủ công (`openManualAdjudicationRequest`), `frozenSnapshot` bắt buộc đi qua `sanitizeAuditSnapshot(...)` trước khi lưu để loại bỏ toàn bộ `sourceText`, `pythonSource`, `memoryPayload`, `privateDiagnostics`, `stderr`, `traceback`.
3. **Điểm cần Nam lưu ý khi ghép UI `P04`, `P05`, `P16`:**
   - Khi gọi `POST /api/tournaments/:tournamentId/rule-versions` từ `P04`, bắt buộc truyền `expectedRevision` hiện tại của giải và `effectiveAt >= serverNow`.
   - Khi hiển thị đếm ngược `deadlineAt` trên `P05`, nếu đồng hồ chạm `0`, UI cần khóa nút phán quyết và gọi lại `GET /api/tournaments/:tournamentId/adjudications` vì máy chủ ưu tiên `fallbackPolicy` tuyệt đối khi `serverNow >= deadlineAt` (`BR-32`).
