# P3 — Bot Online queue → room handoff (ECC)

**Status:** `DONE_SCOPED_LOCAL`

Phạm vi P3 được giới hạn ở handoff sau khi hàng chờ Bot Online tìm thấy phòng:

- sessionStorage chỉ là hint để khôi phục lựa chọn, không phải authority;
- trước khi gắn revision, client đọc snapshot phòng từ server và chỉ tiếp tục khi phòng còn `WAITING_READY`;
- nếu phòng đã chuyển sang countdown/playing/terminal, UI báo lỗi tiếng Việt, không gọi mutation `select` và dọn hint stale;
- sau khi server ACK `selectBotOnline`, hint queue được tiêu thụ một lần, tránh tái sử dụng revision cũ khi reload handoff.

## Harness → Dev → Test

- RED regression: test mới `does not attach a stale queue selection after the room leaves the waiting state` thất bại trước sửa vì page gọi `selectBotOnline` mà không đọc trạng thái phòng.
- GREEN fix: `BotOnlinePage` gọi `getBotOnline(roomId)` ngay trước `selectBotOnline`, chặn mọi trạng thái khác `WAITING_READY`, và chỉ xóa `ottv2:bot-queue-selection` sau ACK (hoặc khi phòng đã bị khóa).
- Regression: `consumes the queue handoff after the server accepts the revision` xác nhận hint không còn sau commit thành công.

## Evidence

- Web P3 focused: `BotOnlinePage.test.tsx` **12/12 PASS**.
- Web P2/P3 related regression: Bot Online + Queue + matchmaking API **32/32 PASS**.
- Web typecheck: **PASS**.
- Web lint (`--max-warnings 0`): **PASS**.
- Web production build: **PASS** (Rollup chỉ phát cảnh báo annotation của dependency `zod` và chunk >500 kB; không có lỗi build).
- Server Bot Online authoritative lifecycle: **16 PASS / 1 explicit runtime-environment skip**.
- `git diff --check`: **PASS** (chỉ cảnh báo line-ending Windows của working tree).

## Independent security review

Agent `/root/p3_security_review` returned **PASS (scoped local)**. The reviewer confirmed the client check is only an early UX guard, while server membership/side/match/revision checks remain authoritative; stale/invalid sessionStorage cannot bypass them; successful or rejected handoff clears the stale queue hint; public snapshots exclude source, memory and private logs. Reviewer evidence records web `47 files / 180 tests PASS` and server `16 PASS / 1 explicit pinned-runtime skip`.

## Security review boundary

- Không dùng sessionStorage để cấp quyền; server route/service tiếp tục kiểm tra membership, role, match status, ownership và revision `PASSED`.
- Không đưa source Python, memory hoặc private log vào snapshot.
- Không chạy Python trong application process hoặc native unrestricted subprocess.
- P3 không thực hiện database mutation, commit, push hoặc deploy.

## Remaining limits

P3 không chứng minh R10/V10/R20 hoặc production readiness. Review độc lập cuối, visual/CWV, backup/migration và Render release vẫn theo các gate riêng của kế hoạch Robot Lab.
