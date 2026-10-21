# S00 — Route inventory cho console

Đây là route proposal để S01 đăng ký sau G0. Chưa sửa `apps/web/src/app/routes.ts` hoặc `router.tsx`. Tên kỹ thuật dùng English ổn định; copy hiển thị tiếng Việt.

## 1. Canonical route map

| Page | Route đề xuất | Actor/entry | Capability tối thiểu | Data boundary |
|---|---|---|---|---|
| P01 | `/admin/tournaments` | SA/TA | `tournament.list` | Chỉ tenant/unit scope; server pagination. |
| P02 | `/admin/tournaments/new` | TA | `tournament.create` | Draft mới từ server; không nhận owner từ URL. |
| P02 | `/admin/tournaments/:tournamentId/edit` | TA owner | `tournament.draft.read`, `tournament.draft.write` | ACL theo tournament + config revision. |
| P03 | `/admin/tournaments/:tournamentId` | SA/TA/Ref granted | `tournament.detail.read` | Metadata/readiness theo actor; incident private. |
| P03 | `/admin/tournaments/:tournamentId/operations` | TA/SA | `tournament.operations.read` | Incident/extension filtered; mutation riêng. |
| P14 | `/admin/audit` | SA/TA scoped | `audit.read` | Append-only, safe fields, cursor. |
| P14 | `/admin/tournaments/:tournamentId/audit` | SA/TA scoped | `audit.read` | Scope theo tournament; không leak tenant khác. |
| P15 | `/admin/offline` | Admin có capability | `offline.hub.read` | Bốn entry, runtime status; source/private data không đi qua. |
| P15 | `/admin/offline/bots` | Owner/TA theo scope | `offline.bot.read` | Metadata đã lọc, owner scope. |
| P15 | `/admin/offline/practice/human-bot` | Actor đủ capability | `offline.practice.humanBot` | Consumer thật hoặc BLOCKED; không heuristic giả Python. |
| P15 | `/admin/offline/practice/human-human` | Actor đủ capability | `offline.practice.humanHuman` | Mode Offline; không queue Online. |

`/admin/tournaments/:tournamentId/rules`, `/adjudication` và `/readiness` là route con của P03/P04/P05/P16 do Nam/Long đăng ký theo ownership; S00 chỉ yêu cầu shell giữ vị trí tab và capability boundary.

## 2. Alias và redirect

Alias chỉ được dùng khi cùng screen contract và cùng ACL; không tạo implementation fork.

| Alias cũ/đề xuất | Canonical | Quy tắc |
|---|---|---|
| `/quan-ly-giai` | `/admin/tournaments` | Redirect sau khi auth/capability resolve. |
| `/quan-ly-giai/:id` | `/admin/tournaments/:tournamentId` | Preserve ID, không preserve query không hợp lệ. |
| `/admin/giai-dau` | `/admin/tournaments` | Chỉ alias khi product route registry duyệt. |
| `/admin/offline-hub` | `/admin/offline` | Giữ deep link tab nếu capability cho phép. |

Không nhận `role`, `tenantId`, `ownerId`, `winner` hoặc `capabilities` từ query/path để cấp quyền.

## 3. Loader và route state

Mỗi route loader/entry phải trả hoặc xử lý:

```text
context = { actor, tenantScope, capabilityVersion, serverNow }
resource = { data, revision, asOf, cursor? }
state = CHECKING | READY | EMPTY | FORBIDDEN | ERROR | OFFLINE | CONFLICT
```

- `CHECKING` không render dữ liệu actor trước.
- `FORBIDDEN` không phân biệt resource không tồn tại nếu policy yêu cầu.
- `CONFLICT` giữ draft/filter cục bộ tới khi user chọn reload/compare.
- `OFFLINE` chỉ cho thao tác local/read-only đã được policy cho phép; mutation server bị khóa.
- Route unmount phải hủy request/worker và không để response cũ cập nhật screen mới.

## 4. Navigation registry

```text
Quản lí giải
  /admin/tournaments
  /admin/tournaments/new
  /admin/tournaments/:tournamentId
  /admin/tournaments/:tournamentId/edit
  /admin/tournaments/:tournamentId/operations
  /admin/tournaments/:tournamentId/audit

Công cụ Offline
  /admin/offline
  /admin/offline/bots
  /admin/offline/practice/human-bot
  /admin/offline/practice/human-human
```

Navigation item tối thiểu: `id`, `label`, `href`, `group`, `requiredCapability`, `activeMatch`, `badgeSource?`, `order`. Badge incident/readiness lấy server summary; không đếm từ list đã cắt trang.

## 5. Dependency handoff

| Route | Producer cần trước | Consumer sau |
|---|---|---|
| P01 | L01/D01/S01 cho list và capability | S02 đóng page. |
| P02 | L05/N05 cho RuleEditor/submit | S07 nối wizard. |
| P03 | L05/N08/D09 cho lifecycle/readiness | S05/S08/S09 tích hợp. |
| P14 | S03/S04 + audit query của Long | S06 nối audit viewer. |
| P15 | S01/D02/N06/N08 | S08 nối hub và runtime states. |

S01 đăng ký shell/router sau G0; các page worker chỉ export component/route descriptor, không tự sửa router hoặc shared style.
