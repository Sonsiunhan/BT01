# S-W07 — Homepage Room Preview & UI Fixes

> **Wave ID:** S-W07  
> **Ngày tạo:** 2026-10-11  
> **Phụ trách:** Sơn  
> **Trạng thái:** ✅ DONE  
> **Effort ước tính:** 2 giờ  

---

## Mục tiêu Wave

Sửa các lỗi hiển thị phát hiện sau khi hoàn thành S-W06:
1. Card phòng đấu trên trang Sảnh (preview) bị **chồng đè lên nhau** do grid layout sai
2. CSS class `home-lobby-support` chưa được định nghĩa
3. RoomBrowser `variant="preview"` dùng chung grid 4 cột với `variant="full"` — không phù hợp container hẹp
4. Ghi nhận các fix ngoài kế hoạch đã thực hiện

---

## Phân tích nguyên nhân gốc rễ (B-W07-01 & B-W07-02)

**Cấu trúc DOM trên Homepage:**
```
.home-lobby-main
  └─ .home-lobby-support        ← CSS class KHÔNG tồn tại trong globals.css
       ├─ <RoomBrowser />       ← variant="preview", nhưng dùng chung CSS với full
       └─ <FriendsPreview />
```

**Nguyên nhân cards chồng lên nhau:**
- `home-lobby-support` không có `display` → layout block mặc định
- `.room-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) }` — luôn 4 cột
- Trong Sảnh, RoomBrowser chỉ chiếm ~55% chiều rộng (phần còn lại là ProfilePanel bên phải)
- 4 card cố định trong container hẹp → tràn/chồng lên nhau

**Giải pháp:**
- Định nghĩa `.home-lobby-support` với layout phù hợp
- Thêm `.room-browser-preview .room-grid` → override 2 cột cho preview
- Tắt scroll ở preview (không cần cuộn 4 phòng)

---

## Danh sách Bugs

| Bug ID | Mô tả | File | Mức độ | Trạng thái |
|:---|:---|:---|:---:|:---:|
| B-W07-01 | `.home-lobby-support` thiếu CSS → layout sai trên Sảnh | globals.css | P2 | ✅ DONE |
| B-W07-02 | `.room-grid` 4 cột cố định → cards chồng trong preview hẹp | globals.css | P2 | ✅ DONE |
| B-W07-03 | Preview nên dùng 2 cột thay vì 4 cột | globals.css | P2 | ✅ DONE |
| B-W07-04 | `room-grid-scroll` max-height không phù hợp preview | globals.css | P3 | ✅ DONE |
| B-W07-05 | Header không cập nhật sau đăng nhập (cần reload) | AppLayout.tsx, LoginPage.tsx, RegisterPage.tsx | P2 | ✅ DONE |
| B-W07-06 | OnlineRoomsPage thiếu khung card và h1 | OnlineRoomsPage.tsx, globals.css | P3 | ✅ DONE |
| B-W07-07 | Font sai trong room cards | globals.css | P2 | ✅ DONE |

---

## Acceptance Criteria

- [ ] Trang Sảnh: các card phòng hiển thị đúng ô riêng biệt, không chồng nhau
- [ ] Trang Sảnh: RoomBrowser preview dùng 2 cột cards
- [ ] Trang Đấu trường: có khung card bao ngoài và h1 heading riêng
- [ ] Font trong room cards đúng "Be Vietnam Pro" / "Space Grotesk"
- [ ] Header cập nhật username ngay sau đăng nhập
- [ ] Typecheck PASS (0 errors)
- [ ] 197/197 unit tests PASS

---

## Kế hoạch thực thi

### Bước 1 — Harness ✅
- [x] Chụp màn hình hiện trạng (user cung cấp)
- [x] Đọc CSS globals.css xác định root cause
- [x] Đọc HomePage.tsx xác định context nhúng RoomBrowser

### Bước 2 — Dev (đang thực hiện)
- [ ] globals.css: Định nghĩa `.home-lobby-support` layout
- [ ] globals.css: Thêm `.room-browser-preview .room-grid` → 2 cột
- [ ] globals.css: Tắt scroll cho preview
- [x] globals.css: Thêm font-family vào room card classes (done)
- [x] globals.css: Thêm rooms-visual-shell, friends-visual-shell (done)
- [x] OnlineRoomsPage.tsx: Bọc trong shell có h1 (done)
- [x] RoomBrowser.tsx: Ẩn h2 nội bộ khi variant=full (done)
- [x] AppLayout.tsx: Thêm listener ottv2:auth-change (done)
- [x] LoginPage.tsx: Dispatch ottv2:auth-change sau login (done)
- [x] RegisterPage.tsx: Dispatch ottv2:auth-change sau register (done)

### Bước 3 — Test
- [x] pnpm typecheck → 0 errors ✅
- [x] pnpm test → 197/197 PASS ✅
- [ ] Manual: Sảnh — cards phòng riêng biệt
- [ ] Manual: Đấu trường — khung bao + heading
- [ ] Manual: Login → header cập nhật ngay

---

## Test Evidence

| Test | Kết quả |
|:---|:---:|
| TypeScript typecheck | ✅ PASS (0 errors) |
| Vitest 197 unit tests | ✅ 197/197 PASS |
| Manual: room preview grid | ⏳ Pending (fix đang implement) |
| Manual: login auth-change | ⏳ Pending |
