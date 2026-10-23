# S07 — Technical Design: Nối RuleEditor V1 vào Wizard và Submit

## 1. Kiến trúc luồng dữ liệu & Vòng đời giải đấu

```
[ Wizard Form Data (P02) ]
        │
        ├── RuleProfile & ConfigRevision ──> [ TournamentRuleManagementPanel (N07/N05) ]
        │                                           │
        │                                           ├── RulePreviewApiClient (POST /validate-preview)
        │                                           └── RuleVersionApiClient (POST /rule-versions)
        │
        └── Save Draft (POST/PATCH /drafts) ──> Backend Server (L05)
                        │
                        └── Submit for Review (POST /submit)
                                        │
                                        └── Trạng thái chuyển sang: UNDER_REVIEW
```

## 2. Hợp đồng API `submitDraft`

### Input Payload:
```ts
export interface SubmitTournamentDraftInput {
  expectedRevision: number;
  submissionNote?: string;
}
```

### URL:
`POST /api/tournaments/:tournamentId/submit`

### Quy tắc nghiệp vụ (Business Rules - BR-06 / L05):
1. **Trạng thái hợp lệ để nộp duyệt:**
   - Chỉ cho phép khi giải ở `DRAFT` hoặc `CHANGES_REQUESTED`.
   - Nếu giải đã ở `UNDER_REVIEW`, `APPROVED`, v.v., trả về mã lỗi `400 BAD_REQUEST` hoặc `409 CONFLICT`.
2. **Kiểm soát đồng thời lạc quan (OCC):**
   - Phải khớp `expectedRevision` với revision hiện tại trên máy chủ.
   - Nếu sai lệch, máy chủ trả về `409 CONFLICT`. Wizard bắt lỗi này và hiển thị `wizard-conflict-banner`.
3. **Sau khi nộp duyệt thành công:**
   - Cột mốc `submittedAt` được cập nhật.
   - Trạng thái chuyển thành `UNDER_REVIEW`.
   - Bản nháp bị khóa chỉnh sửa tự do; chỉ quản trị viên cấp cao (Admin) trên trang P08 mới có quyền phê duyệt hoặc yêu cầu chỉnh sửa tiếp.

## 3. Thiết kế thành phần Giao diện

### P02 (Wizard Page):
- **Step 4 Header/Action Bar:**
  - Nút `wizard-submit-draft-btn` có màu nổi bật (`var(--system-cyan)`).
  - Modal hoặc hộp thoại xác nhận nộp duyệt với ô nhập ghi chú `wizard-submission-note-input` (tối đa 500 ký tự).
  - Vô hiệu hóa nút khi đang gửi (`submittingDraft`) hoặc khi chưa lưu nháp lần đầu lên máy chủ (`!formData.tournamentId`).
- **Trạng thái Khóa (Locked State):**
  - Khi `tournamentStatus === "UNDER_REVIEW"`, hiển thị `wizard-locked-banner` ("Bản nháp đang trong quá trình phê duyệt"). Tất cả các input chuyển sang `disabled` hoặc `read-only`.

### P03 (Detail Page):
- Bổ sung nút `action-submit-draft-btn` song song với `action-edit-draft-btn` khi giải đấu ở trạng thái `DRAFT` hoặc `CHANGES_REQUESTED`.
