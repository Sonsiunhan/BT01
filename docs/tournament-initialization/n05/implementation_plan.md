# N05 — Rule editor V1 và preview API client

**Owner:** Nguyễn Tiến Nam  
**Branch:** `nam-tournament`  
**Dependencies:** N04, S01  
**Scope:** P04 — Rule editor V1; giao diện editor và seam API để Sơn nối vào wizard.

## Mục tiêu

N05 cung cấp một editor controlled có hợp đồng ổn định cho P02/P04:

- `value` là `TournamentRuleProfileWidget` từ `@ottv2/contracts`;
- `onChange` chỉ phát ra value chuẩn hóa, không nhận actor/role/tenant hay winner;
- `errors` được ánh xạ theo `path` để UI gắn vào field và summary;
- `previewRequest` được dựng từ value cùng `expectedConfigRevision` và `draftRevision`;
- movement và goal được chọn bằng các control có giới hạn phù hợp với engine;
- preview gọi API thật `/tournaments/:tournamentId/rule-profile/validate-preview`, không dùng fixture và không coi preview là READY.

## Ownership và ranh giới

| Khu vực | Owner N05 | Ranh giới |
|---|---|---|
| `apps/web/src/features/admin/tournaments/rules/**` | Nam | Editor, types, helper dựng request, API client và test |
| `packages/contracts/src/tournament-rules-preview.ts` | N01/N02 | Tái sử dụng, không đổi schema trong N05 |
| `apps/server/src/modules/tournament-rules-preview/**` | N02 | Tái sử dụng endpoint preview thật, không tạo endpoint thứ hai |
| `apps/web/src/app/router.tsx`, shared CSS | Sơn/S01 | N05 chỉ export component, không tự đăng ký route hoặc sửa token |

## Hợp đồng V1

```ts
type RuleEditorProps = {
  value: TournamentRuleProfileWidget;
  onChange: (value: TournamentRuleProfileWidget) => void;
  errors?: readonly RuleEditorError[];
  previewRequest?: TournamentRulePreviewRequest | null;
  onPreviewRequestChange?: (request: TournamentRulePreviewRequest) => void;
  disabled?: boolean;
};
```

`createRulePreviewRequest(value, expectedConfigRevision, draftRevision)` là helper thuần. `RulePreviewApiClient.preview` parse response bằng `TournamentRulePreviewResponseSchema` và giữ lỗi HTTP theo `requestJson`; không fallback sang dữ liệu giả.

## Acceptance criteria

| ID | Observable acceptance | Evidence |
|---|---|---|
| N05-AC01 | Editor controlled render từ value và gọi onChange với profile mới khi đổi board/movement/goal | component tests |
| N05-AC02 | Movement chọn được cho từng bên và từng loại quân; profile không bị chia sẻ reference | component tests |
| N05-AC03 | Goal chọn được NONE/STATIC/CYCLE/SEEDED; field phụ hiện đúng mode và giữ goal disabled khi không có GOAL_REACHED | component tests |
| N05-AC04 | Errors có `path` được render ở field tương ứng và trong summary | component tests |
| N05-AC05 | Preview request có schemaVersion, engineProfileVersion, expectedConfigRevision, draftRevision và đúng value | helper tests |
| N05-AC06 | API client POST đúng URL/body, parse response thật và truyền AbortSignal | API tests |
| N05-AC07 | API error/response sai schema không bị nuốt hoặc chuyển thành success giả | API tests |
| N05-AC08 | Không sửa router/shared style/server authority; typecheck và test web pass | focused gates |

## Verification

```text
corepack pnpm --filter @ottv2/web test -- src/features/admin/tournaments/rules/RuleEditor.test.tsx src/features/admin/tournaments/rules/rulePreviewApi.test.ts
corepack pnpm --filter @ottv2/web typecheck
git diff --check
```

N05 không claim canonical publish, persistence, runtime proof hoặc route registration; các phần đó thuộc N04/L05/S01 và các task sau.
