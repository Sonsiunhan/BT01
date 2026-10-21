# S00 — Wireframe và state map console

## 1. Hướng thiết kế

| Trục | Quyết định |
|---|---|
| Công việc | Quản lí hồ sơ giải, readiness và vận hành theo capability; người dùng cần quét trạng thái trước rồi mới thao tác. |
| Đối tượng | `TOURNAMENT_ADMIN` dùng hằng ngày; `SYSTEM_ADMIN` duyệt/đối chiếu; `REFEREE` chỉ thấy case được giao; observer chỉ xem dữ liệu đã lọc. |
| Tông | Industrial Robot Lab: dày thông tin nhưng yên, góc rõ, ít trang trí; action nguy hiểm luôn có ngữ cảnh và xác nhận. |
| Điểm nhớ | Thanh trạng thái giải cố định dưới breadcrumb: `status`, `readiness`, `blocker count`, `server time` và action hợp lệ nằm cùng một hàng. |
| Ràng buộc | Bám `DESIGN_TOKENS` hiện có; Blue/Red chỉ nhận diện bên chơi, Cyan là system, Violet/Magenta/Amber là semantic role. Không thêm gradient hoặc emoji cho trạng thái. |

First viewport phải cho biết **đang ở giải nào, trạng thái nào, còn blocker gì và người này được làm gì**. Không đặt hero marketing trước nội dung vận hành.

## 2. Shell dùng chung

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ROBOT LAB  / Quản lí giải      [mạng • server time] [theme] [actor menu]     │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ QUẢN LÍ GIẢI  │ Breadcrumb / page title                     [context actions] │
│ • Danh sách   │ ┌──── status strip: state • readiness • blockers • revision ┐ │
│ • Chi tiết     │ └────────────────────────────────────────────────────────────┘ │
│ • Nhật ký      │                                                               │
│               │ Main content: table/form/tabs/panel                         │
│ CÔNG CỤ       │                                                               │
│ OFFLINE       │                                                               │
│ • Hub Offline  │                                                               │
│ • Kho Bot      │                                                               │
│ • Bot Offline  │                                                               │
│ • Tập luyện    │                                                               │
├───────────────┴──────────────────────────────────────────────────────────────┤
│ Mobile: breadcrumb + status; bottom navigation: Giải • Nhật ký • Offline • … │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Header không hiện CTA chơi Online cho admin; server cũng từ chối player admission của admin.
- Sidebar giữ vị trí ổn định khi loading, không để table đẩy navigation.
- `status strip` là `role="status"` khi thay đổi; không dùng màu một mình để biểu thị blocker.
- Context actions chỉ render sau capability response. Khi capability chưa tải, hiển thị skeleton; không render nút rồi mới ẩn.
- Portrait dùng một cột: breadcrumb → status strip → content → action bar; bottom navigation không che form.
- Landscape mobile giữ bảng/preview trong vùng cuộn ngang có tên cột và focus ring rõ.

## 3. State contract dùng chung

| State | Hiển thị | Hành vi bắt buộc |
|---|---|---|
| `loading` | Skeleton giữ chiều cao gần nội dung thật, không nhấp nháy | Không cho mutation; focus giữ ở control khởi phát. |
| `ready` | Dữ liệu server + `asOf`/revision | Action lấy từ `permittedActions`; không suy diễn từ role trong client. |
| `empty` | Giải thích ngắn + đường tạo/import phù hợp capability | Không hiển thị bảng rỗng hoặc nút không có quyền. |
| `forbidden` | “Bạn không có quyền xem mục này.” + quay về nơi hợp lệ | Không leak existence, ID, tenant hay lý do nội bộ. |
| `error` | Mã lỗi thân thiện + Retry + quay lại | Giữ draft/filter; không báo thành công cục bộ. |
| `offline/degraded` | Banner kết nối + dữ liệu cuối đã ghi rõ thời điểm | Khoá mutation cần server; không tự kéo dài clock/deadline. |
| `stale/conflict` | Revision server và revision đang sửa, diff tối thiểu | Tải lại/đối chiếu; không silent overwrite. |
| `pending` | Nút khoá, spinner nhỏ, `aria-live="polite"` | Chống double submit; reload phải khôi phục trạng thái từ server. |
| `success` | ACK server, ID/event/revision nếu có | Chỉ hiện sau authoritative ACK; cho phép mở bản ghi vừa tạo. |

Các state trên áp dụng cho cả light/dark, reduced motion, keyboard và viewport nhỏ. Transition chỉ dùng opacity/transform; reduced motion bỏ scanline/glitch.

## 4. P01 — Danh sách giải/Admin

```text
Quản lí giải đấu                                      [Tạo giải đấu]
[Tìm theo tên/mã] [Trạng thái ▼] [Visibility ▼] [Đơn vị ▼] [Lọc]
3 giải đang hiển thị • cập nhật lúc 10:12:04 UTC+7 • trang 1/1
┌ Tên / mã ┬ Trạng thái ┬ Lịch ┬ Readiness ┬ Đơn vị ┬ Thao tác ┐
│ ...      │ DRAFT      │ ...  │ 2 blocker │ ...    │ Mở      │
└──────────┴────────────┴──────┴───────────┴────────┴──────────┘
```

- Tìm/lọc/sort/page là server-side; cursor thay đổi khi query hoặc filter đổi.
- Thẻ/bảng hiển thị tên, slug, trạng thái vòng đời, `start_at/end_at` theo timezone, blocker count và owner đã lọc.
- `Tạo giải đấu` chỉ xuất hiện khi `tournament.create` được cấp; ngoài ra giữ vị trí bằng trạng thái disabled có lý do an toàn.
- `P01.empty` có CTA tạo nếu có quyền; `P01.forbidden` không hiển thị số lượng.
- Khi server báo `VERSION_CONFLICT` hoặc filter stale, giữ query và tải lại trang hiện hành.

## 5. P02 — Khởi tạo/sửa nháp

```text
← Danh sách / Tạo giải đấu                         [Lưu nháp] [Gửi duyệt]
Thông tin ─ Thời gian ─ Bàn & luật ─ Kết quả ─ Điều lệ
┌ Form section đang chọn ───────────────┬ Draft status ──────────────┐
│ label + hint + input                  │ DRAFT • revision 4          │
│ field error ngay dưới field           │ Lần lưu cuối / người sửa    │
│ conditional fields hiện khi áp dụng   │ [Kiểm tra] [Tải bản server] │
└───────────────────────────────────────┴─────────────────────────────┘
```

- P02 dùng một `RuleProfileDraft` và các field group canonical; không copy engine vào client.
- Field phụ thuộc mode phải chuyển rõ thành not-applicable/default khi mode đổi; không giữ hidden value nguy hiểm.
- Save draft cho phép tối thiểu các trường DRAFT hợp lệ; Submit mới kiểm đủ field/caps và snapshot.
- `draftRevision` và `expectedConfigRevision` luôn đi cùng mutation. Conflict mở panel so sánh, không ghi đè.
- Rời trang khi có thay đổi chưa ACK phải có unsaved guard; lỗi mạng giữ toàn bộ draft.

## 6. P03 — Chi tiết/điều hành

```text
← Danh sách / Giải A-2026                  [state] [revision] [Thao tác ▾]
[Tổng quan] [Cấu hình] [Readiness] [Trận đấu • incident count] [Nhân sự]
┌ Blocker summary ┐ ┌ Schedule ┐ ┌ Rules snapshot ┐ ┌ Staffing ┐
│ 2 cần xử lí     │ │ start/end│ │ v3 • digest    │ │ X/N READY │
└─────────────────┘ └──────────┘ └────────────────┘ └───────────┘
Timeline / audit excerpt / next allowed transition
```

- `RUNNING` vẫn hiển thị cảnh báo staffing khi số Referee dưới ngưỡng; không tự dừng giải.
- Incident panel nằm trong trang quản lí giải. Case có badge bền vững, assignment/referee lease đã lọc, không dùng toast làm queue.
- Gia hạn hiển thị `currentEndAt`, request, cap còn lại và trạng thái đối chiếu lịch; pending không đổi lịch.
- Các transition (submit, cancel, pause, publish, request extension) chỉ render từ `permittedActions` và state machine server.
- Bàn/clock nếu hiển thị chỉ là snapshot read-only; không tạo player slot cho TA và không sửa result từ panel.

## 7. P14 — Nhật ký quản trị

```text
Nhật ký quản trị                              [Xuất theo quyền]
[Giải ▼] [Actor ▼] [Action ▼] [Từ ngày] [Đến ngày] [Lọc]
┌ Thời điểm ┬ Actor đã lọc ┬ Action ┬ Đối tượng ┬ Kết quả ┬ Revision ┐
│ ...       │ TA-***       │ UPDATE │ ...        │ ACK      │ ...      │
└───────────┴──────────────┴────────┴────────────┴──────────┴───────────┘
Chi tiết event: reason / field diff an toàn / request ID / correlation ID
```

- Audit append-only, phân trang server, newest-first; filter đổi cursor.
- Detail chỉ hiển thị safe summary và field diff được allowlist; loại credential, token, source, memory, raw log, path và stack.
- Export là action riêng có capability; payload export áp dụng cùng retention/PII policy.

## 8. P15 — Hub Offline

```text
Công cụ Offline
┌ Kho Bot ┐       ┌ Bot Offline ┐
│ owner   │       │ readiness  │
└─────────┘       └────────────┘
┌ Người–Bot ┐     ┌ Người–Người ┐
│ tập luyện │     │ practice    │
└───────────┘     └─────────────┘
Banner capability/runtime: READY / BLOCKED / UNAVAILABLE / RETRY
```

- Hub có bốn lối vào đúng policy; không gắn nhãn `PASSED` bằng checkbox.
- Nếu runtime unavailable, entry vẫn có thể hiện hướng dẫn và `BLOCKED` rõ; không thay Python consumer bằng AI heuristic.
- Private Bot library chỉ hiện metadata theo owner/scope; không tải source, memory, logs hoặc token qua hub.
- Offline mode không thừa hưởng rotation/side HUD của Online; mỗi entry nêu orientation canonical tương ứng.

## 9. Accessibility và responsive checklist

- Mọi form control có visible label, `id`, `aria-describedby` và lỗi gắn đúng field.
- Tab order theo thứ tự đọc; menu/tabs dùng Arrow/Enter/Space/Escape; focus sau submit tới error summary hoặc ACK.
- Bảng có tên cột, row action accessible và phiên bản card cho mobile; không chỉ dùng màu Blue/Red/Cyan.
- `aria-live="polite"` cho ACK, network và job progress; lỗi fatal có heading và đường quay lại.
- Desktop 1366×768: shell + content không cuộn toàn trang ngoài main; tablet giữ action bar; mobile 375×812 không clipping.
- Reduced motion tắt chuyển cảnh trang, particle và scanline; không làm mất trạng thái hoặc feedback.
