# L00 — Wireframes P06/P07/P08

Revision 1. These are implementation handoff wireframes. They use S00's `AdminShell`, `StatusStrip`, `FormSection`, `FieldControl`, `AsyncSubmit`, `CapabilityGate`, `DataBoundary` and `ServerTable` contracts. Copy is Vietnamese; technical IDs remain English.

## Shared shell and state rules

```text
┌ ROBOT LAB / Quản lí giải     [Kết nối] [server time] [chủ tài khoản] ┐
├───────────────┬───────────────────────────────────────────────────────┤
│ QUẢN LÍ GIẢI  │ Breadcrumb / title                     [context action]│
│ • Danh sách   │ ┌ trạng thái • quyền • revision • blocker ──────────┐ │
│ • Nhật ký     │ └─────────────────────────────────────────────────────┘ │
│ OFFLINE       │ Main content: table / form / review panel              │
└───────────────┴───────────────────────────────────────────────────────┘
```

- Capability and permitted actions are server supplied. Client role text, URL, query and hidden buttons never grant authority.
- `CHECKING` renders skeleton only. `FORBIDDEN` and `NOT_FOUND` follow disclosure policy and do not reveal cross-tenant existence.
- `ERROR` retains draft/filter and offers bounded retry. `CONFLICT` shows server revision and explicit `Tải bản server` / `Đối chiếu`; it never overwrites silently.
- Mutations require server ACK carrying revision/event or an equivalent authoritative response. Network uncertainty is `PENDING/UNKNOWN`, not local success.
- Every action has loading, empty, forbidden, validation, conflict, expired-grant, offline and retry states. Focus returns to the invoking control; mobile uses one column and an action bar that remains reachable.

## P06 — Quản lí đơn vị

### List

```text
Quản lí đơn vị                                  [Tạo đơn vị]
[Tìm tên/mã] [Trạng thái ▼] [Lọc] [Xoá bộ lọc]
Đang hiển thị n bản ghi • cập nhật lúc {serverNow} • cursor {page}
┌ Mã đơn vị ┬ Tên ┬ Trạng thái ┬ Hợp đồng ┬ Cập nhật ┬ Thao tác ┐
│ U-001     │ …   │ ACTIVE     │ 2         │ …         │ Mở       │
└───────────┴─────┴────────────┴───────────┴───────────┴──────────┘
```

`unit.list` controls list/filter. Empty state says `Chưa có đơn vị trong phạm vi của bạn.` and shows create only with `unit.create`. Forbidden state has no count. Row actions carry row revision.

### Create/edit form

```text
← Danh sách đơn vị       Tạo đơn vị / Chỉnh sửa đơn vị       [Lưu]
Thông tin cơ bản
  Mã đơn vị *     [__________]  (ổn định, không đổi sau khi dùng)
  Tên đơn vị *    [________________________]
  Trạng thái      [ACTIVE ▼]  (chỉ action được phép)
Liên kết sử dụng: {contracts} • {enrollments}  [Xem liên kết]
[Huỷ]                                      [Lưu thay đổi]
```

Validation: missing/invalid code or name is field-linked; duplicate code is a safe conflict; `UNIT_IN_USE` blocks unsafe lock/delete and links to references. No hard-delete control is rendered. Lock requires a reason and authoritative confirmation; it does not delete identity, contracts, enrollment, match history or audit.

### States

| State | Visible output | Prohibited effect |
|---|---|---|
| Loading | Skeleton preserving field/table geometry | No mutation. |
| Empty | Explanation + permitted create CTA | No fake count. |
| Forbidden | `Bạn không có quyền xem đơn vị này.` | No ID/tenant leakage. |
| Duplicate/conflict | Field error or server revision comparison | No overwrite. |
| In use | Linked-resource summary + safe next action | No cascade delete. |
| Network/unknown | Draft retained + `Thử lại` | No local success. |

## P07 — Hợp đồng và hạn mức

### List/detail

```text
Hợp đồng và hạn mức                              [Tạo hợp đồng]
[Đơn vị ▼] [Trạng thái ▼] [Còn hiệu lực ▼] [Lọc]
┌ Contract ID ┬ Đơn vị ┬ Hiệu lực ┬ Đã dùng/giới hạn ┬ Trạng thái ┬ Mở ┐
│ …           │ …      │ …         │ 2 / 10             │ ACTIVE      │ >  │
└─────────────┴────────┴───────────┴────────────────────┴─────────────┴────┘
```

Detail has tabs `Phạm vi`, `Hạn mức`, `Rules envelope`, `Lịch sử`. Usage is read-only server data. The UI labels that quota is shared by the contract, not by each TA binding.

### Form

```text
← Hợp đồng       Tạo/chỉnh sửa hợp đồng       [Lưu nháp] [Kích hoạt]
Đơn vị đối tác * [select scoped Unit]
Hiệu lực *       [from] → [to]  (timezone + server interpretation)
Giới hạn         giải tối đa [ ] • người/giải [ ] • người/tổng [ ]
Phạm vi          allowed units [ ] • control modes [ ]
Rules envelope   board [ ] • movement [ ] • goal [ ] • resources [ ]
Sandbox caps     source [ ] • memory [ ] • compute [ ]
Quota preview    used {read-only} • remaining {read-only}
[Huỷ]                                      [Lưu / Kích hoạt]
```

The form validates date order, non-negative finite caps and envelope intersections. It does not expose billing/chain configuration. Activation is a separate intent and requires the SA capability; TA binding is not created by this form.

### Quota semantics displayed in help text

- A draft consumes one shared contract slot atomically; deleting a draft or rejecting it refunds exactly once.
- An approved tournament cancellation does not refund the slot.
- The same account enrolled in two tournaments uses two enrollment slots; withdraw/reactivate does not refund or increase usage.
- Retention/archiving never resets contract usage.

## P08 — Xét duyệt giải

### Inbox

```text
Hộp xét duyệt                                  [Tải lại]
[Trạng thái ▼] [Đơn vị ▼] [Loại: hồ sơ / thay đổi / gia hạn] [Tìm]
┌ Giải ┬ Chủ ┬ Snapshot ┬ Tác động ┬ Gửi lúc ┬ Hạn ┬ Thao tác ┐
│ …    │ …   │ v7       │ config   │ …       │ …   │ Mở       │
└──────┴─────┴──────────┴──────────┴─────────┴─────┴──────────┘
```

Rows are server-paginated and carry `requestId`, `tournamentRevision`, `snapshotRevision`, `requestType`, `permittedActions` and `asOf`. A stale row is reloadable; the UI does not approve from list data alone.

### Review detail

```text
← Hộp xét duyệt       {tournamentName} / {requestType}
Snapshot v{n} • giải revision {r} • server time {now}
[Tổng quan] [Thay đổi] [Envelope] [Blockers] [Lịch sử]
┌ Hiện hành ─────────────┬ Đề xuất ───────────────────────────┐
│ field / value           │ field / value / diff reason         │
└────────────────────────┴────────────────────────────────────┘
Ghi chú theo trường [........................................]
Lý do quyết định *       [....................................]
[Từ chối] [Yêu cầu sửa] [Duyệt]             [Quay lại]
```

`Duyệt`, `Từ chối`, `Yêu cầu sửa` are distinct intents. Each submits `expectedRevision`, `idempotencyKey`, reason and field notes. Initial approval records the reviewer snapshot. Locked-field changes use a separate change request; pending/rejected proposals never replace the effective config.

### Extension panel

```text
Gia hạn giải
end_at hiện tại: {instant} • đã dùng/cap: {duration} / 2h
Đề nghị thêm [duration] • resource/capacity evidence [read-only]
[Phê duyệt toàn bộ] [Phê duyệt một phần] [Từ chối]
Lý do * [......................................................]
```

Only SA may approve before the current `end_at`. At or after `end_at`, the request is expired and cannot reopen the tournament. Pending approval does not change the schedule. Started matches drain their pinned clock/compute; no new match, rematch or requeue is admitted after `end_at`. If capacity evidence is unavailable, the UI shows `BLOCKED — chưa có bằng chứng capacity`, never a successful hold.

### Review states

| State | Visible output | Prohibited effect |
|---|---|---|
| Pending | Snapshot, blockers, allowed actions | No implicit approval. |
| Approved | ACK, new revision/generation and audit link | No rewrite of old snapshot/matches. |
| Rejected/changes requested | Reason and field notes | Effective config remains. |
| Conflict | Server revision and reload/compare | No double decision. |
| Expired | Read-only explanation | No reopen after `end_at`. |
| Unauthorized | Safe forbidden state | No actor/tenant existence leak. |
