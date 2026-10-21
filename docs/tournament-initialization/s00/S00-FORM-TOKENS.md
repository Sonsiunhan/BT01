# S00 — Form contract và semantic tokens

> Revision 2: hình học và typography theo [S00-DESIGN-R2.md](S00-DESIGN-R2.md), bổ sung `--lab-bevel`, `--lab-panel`, `--lab-panel-strong` từ `robot-lab.css`. P01 dùng thẻ; `ServerTable` dành P14. Field labels, accessible errors và ACK contract bên dưới tiếp tục áp dụng.

## 1. Token authority

Nguồn token duy nhất hiện có là `apps/web/src/foundation/tokens.ts`. S00 không thêm CSS variable hay màu hex riêng. Component mới phải dùng semantic token để light/dark/system và reduced motion đổi cùng một chỗ.

| Nhóm | Token dùng trong console | Ngữ nghĩa |
|---|---|---|
| Nền | `--bg-root`, `--bg-secondary` | App shell và vùng content; không dùng cho status. |
| Bề mặt | `--surface-1/2/3`, `--glass` | Header, sidebar, section, modal; tối đa hai lớp lồng nhau. |
| Chữ | `--text-primary`, `--text-secondary`, `--text-muted`, `--font-body`, `--font-data` | Nội dung, hint, timestamp/ID/counter. |
| System | `--system-cyan`, `--focus-ring`, `--gradient-system-pulse` | Link, focus, ACK, realtime và action chính. |
| Semantic | `--violet`, `--magenta`, `--amber`, `--success`, `--warning`, `--error` | Role, pending review, attention, pass, warning, failure. |
| Motion/elevation | `--motion-*`, `--motion-reduced`, `--elevation-*`, `--z-*` | Chỉ dùng transform/opacity; reduced motion về 0ms. |

Blue/Red là identity của bên chơi và không dùng cho `error`, `success` hoặc role. `--error` không được dùng để suy ra bên thua.

## 2. Component contract đề xuất

Các contract dưới đây là interface thiết kế để S01–S09 triển khai; chưa phải source TypeScript.

### `AdminShell`

```text
AdminShell({
  actor: ActorSummary,
  navigation: NavigationItem[],
  breadcrumb: BreadcrumbItem[],
  context?: TournamentContext,
  network: NetworkState,
  children: ReactNode
})
```

- Navigation đã được server/capability adapter lọc; component chỉ render.
- `network` nhận `CHECKING | ONLINE | DEGRADED | OFFLINE | RECONNECTING`.
- Shell giữ focus và context khi child route đổi; không tự gọi mutation.

### `StatusStrip`

```text
StatusStrip({
  status: LifecycleStatus,
  readiness: ReadinessSummary,
  blockers: BlockerSummary[],
  serverNow: Instant,
  revision: string,
  actions: PermittedAction[]
})
```

`StatusStrip` hiển thị status label, blocker count và server time bằng text; icon/màu chỉ bổ trợ. `actions` không được tự tính từ `status` ở client.

### `FormSection` và `FieldControl`

```text
FormSection({ id, title, description, status, children })
FieldControl({
  id, label, hint, value, required, disabled, pending,
  error?: FieldError, onChange, onBlur
})
```

- Label luôn nhìn thấy; hint không thay label.
- Error dùng `path`, `code`, `messageKey`, `safeMessage`; không render raw server text/stack.
- `disabled` phải có `disabledReason` khi capability bị thiếu; không dùng disabled để che forbidden data.
- Input số/ngày có bounds rõ; timezone hiển thị cạnh instant; không dùng placeholder làm giá trị mặc định.

### `AsyncSubmit`

```text
AsyncSubmit({
  label, pendingLabel, intent, disabled,
  expectedRevision, idempotencyKey,
  onSubmit: () => Promise<AuthoritativeAck>
})
```

- Khóa double submit từ lúc gửi tới ACK/failure.
- Chỉ chuyển success khi ACK có `eventId`/`revision` hoặc response tương đương.
- `VERSION_CONFLICT`, `ALREADY_SETTLED`, `DEADLINE_EXPIRED` trả về state recovery, không tự retry mutation.

### `CapabilityGate` và `DataBoundary`

```text
CapabilityGate({ capability, state, children, fallback })
DataBoundary({ state, loading, empty, forbidden, error, children })
```

`CapabilityGate` chỉ dùng `permittedActions`/capability response đã xác thực. `DataBoundary` phân biệt `FORBIDDEN` và `NOT_FOUND` theo disclosure policy; không dùng ID để đoán quyền.

### `ServerTable`

```text
ServerTable({
  columns, rows, cursor, pageSize, sort, filters,
  rowKey, onQueryChange, loading, empty, error
})
```

- Search/filter/sort/page đều gửi server; page size bounded.
- Row action nhận `permittedActions` từng row và `expectedRevision`.
- Desktop dùng bảng; mobile dùng cùng data contract với card có thứ tự trường ổn định.

## 3. Quy tắc form theo page

| Page | Form pattern | Submit/validation |
|---|---|---|
| P01 | Search/filter toolbar + server table | Query bounded; filter đổi cursor; `Tạo giải đấu` chỉ khi `tournament.create`. |
| P02 | Sectioned draft form + sticky action bar | Save DRAFT và Submit là intent khác nhau; giữ draft khi lỗi; conflict mở diff. |
| P03 | Readiness/action panel + incident/extension drawer | Action server-state gated; mutation có reason/revision/idempotency. |
| P14 | Filter toolbar + audit table + safe detail drawer | Không nhập raw JSON/script; export riêng theo capability và retention. |
| P15 | Capability cards + runtime state | Entry unavailable/blocked có hướng dẫn; không tạo fake success hoặc PASSED. |

## 4. Error and recovery copy

| Code | Copy tiếng Việt | Action |
|---|---|---|
| `UNAUTHENTICATED` | “Phiên đăng nhập đã hết hạn.” | Đăng nhập lại, giữ return path. |
| `FORBIDDEN` | “Bạn không có quyền thực hiện thao tác này.” | Quay lại vùng được phép. |
| `VALIDATION_ERROR` | “Kiểm tra các trường được đánh dấu.” | Focus error summary/field đầu. |
| `VERSION_CONFLICT` | “Dữ liệu đã thay đổi ở nơi khác.” | Tải bản server hoặc mở đối chiếu. |
| `QUEUE_BUSY` | “Hệ thống đang bận; chưa có thay đổi nào được ghi.” | Retry bounded. |
| `RUNTIME_UNAVAILABLE` | “Môi trường thực thi chưa sẵn sàng.” | Xem blocker/Retry; không xử thua. |
| `NETWORK_ERROR` | “Không kết nối được. Bản nháp vẫn được giữ.” | Retry/kiểm tra kết nối. |

Raw stack, path, env, token, source và private diagnostics không xuất hiện trong copy hay DOM.

## 5. Form accessibility checklist

- Mỗi section có heading thật; tabs có `aria-controls`, tabpanel có `aria-labelledby`.
- Field error đặt sau control, liên kết qua `aria-describedby`; summary có focus sau submit lỗi.
- Pending state giữ label và không làm mất focus; nút không biến mất giữa request.
- Modal/drawer có focus trap, Escape đúng capability và trả focus về control mở.
- Reduced motion bỏ animation nhưng vẫn giữ progress/status text.
