# S07 — Implementation Plan: Nối RuleEditor V1 vào Wizard và Submit

## 1. Ranh giới sở hữu và nguyên tắc
- **Sở hữu của Sơn:**
  - `apps/web/src/features/admin/tournaments/tournamentApi.ts` (bổ sung `submitDraft`)
  - `apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx` (P02 - kết nối submit draft, đồng bộ ruleProfile, khóa form khi UNDER_REVIEW)
  - `apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx` (P03 - nút submit draft từ màn hình chi tiết khi DRAFT/CHANGES_REQUESTED)
  - `apps/web/src/features/admin/tournaments/TournamentWizardPage.test.tsx`
  - `tests/unit/s07-rule-editor-wizard.unit.test.ts`
  - `docs/tournament-initialization/son/s07/**`
- **Nguyên tắc bất di bất dịch:**
  - Không sửa file thuộc phân hệ của người khác (`apps/server/**`, `packages/game-rules/**`, `rules/RuleEditor.tsx` của Nam).
  - Copy giao diện hoàn toàn tiếng Việt theo văn bản Robot Lab.
  - Sử dụng API thật `/api/tournaments/:tournamentId/submit`, không giả mạo engine trên client.

## 2. Kế hoạch từng giai đoạn

### Giai đoạn 1: Khảo sát & Harness
- Viết bộ kiểm thử đơn vị `tests/unit/s07-rule-editor-wizard.unit.test.ts` kiểm chứng:
  - Hợp đồng `SubmitTournamentDraftInputSchema` (`expectedRevision`, `submissionNote`).
  - Chuyển đổi trạng thái từ `DRAFT` / `CHANGES_REQUESTED` sang `UNDER_REVIEW`.
  - Cơ chế phòng chống submit khi revision lỗi thời (409 Conflict).

### Giai đoạn 2: Bổ sung API Port & Client
- Mở rộng `TournamentApiPort` với `submitDraft(tournamentId: string, input: SubmitTournamentDraftInput): Promise<{ tournament: TournamentDto }>`.
- Cập nhật `TournamentApiClient`:
  - Trong chế độ API thật: `POST /api/tournaments/${tournamentId}/submit`.
  - Trong chế độ fixture: Cập nhật status thành `UNDER_REVIEW`, ghi nhận `submittedAt`.

### Giai đoạn 3: Tích hợp Giao diện Wizard P02
- Trong `TournamentWizardPage.tsx`:
  - Thêm state `submittingDraft`, `submitError`, `submitSuccessMessage`, `showSubmitModal`, `submissionNote`.
  - Ở Bước 4 (hoặc thanh tác vụ), bổ sung nút `wizard-submit-draft-btn` ("Nộp duyệt giải đấu").
  - Khi submit thành công, hiển thị banner thông báo xanh lá, khóa form hoặc chuyển hướng sang P03.
  - Nếu giải đấu đang ở trạng thái `UNDER_REVIEW` hoặc cao hơn: hiển thị cảnh báo `wizard-locked-banner` và vô hiệu hóa các nút chỉnh sửa/lưu nháp.

### Giai đoạn 4: Tích hợp P03 Tournament Detail Page
- Trong `TournamentDetailPage.tsx`:
  - Khi `tournament.status === "DRAFT" || tournament.status === "CHANGES_REQUESTED"`, hiển thị thêm nút `action-submit-draft-btn` ("Nộp duyệt giải đấu").
  - Khi click: gọi `apiClient.submitDraft(tournament.id, { expectedRevision: tournament.revision })`, sau đó tự động reload detail page.

### Giai đoạn 5: Kiểm thử và Hoàn thiện
- Chạy toàn bộ vitest của web và workspace.
- Chạy `pnpm run typecheck`.
- Cập nhật báo cáo kết quả `S07-RESULT-2026-10-22.md`.
