# Kế hoạch Bot–Bot chạy thật, tích hợp giải đấu

2026-10-26. Requirements: BOT-PLAYABLE-REQUIREMENTS.md. Quyết định Q1B/Q2B/Q3A/Q4A. Agent bot_flow_requirements_review đã review cùng checklist: PASS 12/12, không còn gap yêu cầu P0/P1; không phải PASS implementation.

## Phạm vi và cách làm

Một người triển khai, không phân công code song song. Tận dụng BotLibraryService, Wasmtime/CPython-WASI, BotOnlineService và SDK hiện có. Không thay engine hoặc thêm dịch vụ trả phí. Mọi sửa task Nam cần thực hiện trên checkout nam-tournament sau khi bảo toàn diff hiện hữu; không sửa/commit ứng dụng trực tiếp trên main. Tài liệu hiện ghi tại worktree đang khảo sát, chưa commit/push.

## Trình tự thực hiện

1. **Làm runtime chạy thật.** Kiểm tra artifact và môi trường; cấu hình adapter Wasmtime/CPython-WASI có hash đã kiểm chứng, khởi động backend/database local đã xác định. Ưu tiên môi trường Linux tái lập tương thích adapter hiện có qua Docker/WSL nếu chưa có bộ Windows được chứng minh; kiểm tra daemon và probe trước khi chọn, không tải/chạy artifact chưa xác minh. Chạy mẫu hai phía rồi hai Bot hết một trận. Kiểm tra timeout, output sai và isolation. Không fallback chạy Python native không hạn chế. Owner: config/bot-runtime, adapter, script bootstrap local nếu cần.
2. **Thống nhất AC và Ready.** Dùng contracts hiện có làm nguồn chung; READY thư viện không còn được UI hiểu là AC. Receipt bền vững theo revision/hash + luật + SDK/runtime/policy; server kiểm tra receipt ở select/queue/start/swap. Thư viện, enrollment, active/pending có trạng thái riêng; candidate test không làm mất AC/Ready cũ. Lỗi runtime hạ tầng trả retryable, không đánh lỗi file. Owner: contracts bot, bot-library, tournament-bot-readiness, Prisma migration nếu cần.
3. **Một panel test dùng ở hai nơi.** Tách component từ Workbench dùng cho xưởng Bot và tab riêng trong phòng trước/trong trận. Mỗi file có tên, trạng thái, lỗi, Test/Dùng Bot này/Xóa. API test không nhận room mutation; tình huống test theo luật và độc lập board/clock sống. Chỉ chủ sở hữu xem source/log/test. Upload/test không tự chọn Bot. Cung cấp tải bot-mau.py và hướng dẫn 1 trang.
4. **Xóa thật đúng quyền.** Chỉ file chưa từng thi đấu, không active/pending. Xóa source/test khỏi backend và UI, clear selection/Ready nếu đang chọn nhưng chưa ghim; bảo vệ callback test muộn. File từng thi đấu được giữ, kể cả sau đó FAILED. Refresh/restart không hồi sinh file; không chỉ ẩn giao diện.
5. **Đổi Bot trước và trong trận.** Trước trận chọn AC rồi Ready. Trong PLAYING chọn AC rồi explicit Dùng Bot này; áp dụng đầu lượt kế tiếp của chính người chơi, reset memory theo cơ chế hiện có. Candidate fail giữ Bot đang chạy. Chặn response cũ ghi đè pending mới; không sửa lượt đang tính, không reset clock. PAUSED/STOPPED không kích hoạt; test không tự resume. Cho chọn Bot có sẵn khác cũng như revision mới, sửa hạn chế hiện tại chỉ upload vào botId đang dùng.
6. **Nối giải đấu thật.** Qualification ban đầu trước botDeadline; live swap sau deadline vẫn được phép. AC swap theo luật đã ghim của trận, AC cho trận tương lai theo context tương lai. Nối enrollment → chọn Bot → tạo trận/pin → runner → result ledger/BXH, không chỉ tạo bản ghi trận. Persist receipt, pin, usage/reference và đổi revision để restart phục hồi an toàn. Sửa readiness async/ONLINE+READY và lịch chạy nền nếu chúng chặn E2E giải. Không mở rộng sang toàn bộ lỗi wizard không liên quan.
7. **Kiểm thử và bàn giao.** Tests hồi quy trước sửa; focused unit/contract/API và browser hai tài khoản trên DB test riêng; typecheck/lint/build/CI phù hợp. Xóa code UI upload autoapply cũ sau kiểm consumer. Ghi đúng trạng thái NOT RUN/BLOCKED nếu runtime hoặc E2E chưa đạt; không commit/push main chỉ vì build xanh.

## Điều kiện DONE

- Runtime thật: tải mẫu → upload → AC → hai người Ready → Bot tự đi đến kết quả; không cần bước giả lập thủ công.
- Một file AC + một file lỗi vẫn chơi được; lỗi gắn đúng tên file.
- Xóa file chưa dùng ở backend/UI; refresh/restart không trở lại; từng thi đấu/active/pending bị chặn.
- Tab test trước/trong trận cùng UI, chỉ chủ sở hữu; đối thủ/referee/observer API không đọc được source/log.
- Test candidate lỗi/timeout không làm mất Bot cũ, không dừng clock/trận; đổi AC chỉ tại lượt kế tiếp, reset memory đúng một lần.
- Code/luật không đúng context không dùng receipt cũ; live swap dùng pinned match rules.
- Reload/restart/race không mất lựa chọn, không hồi sinh file, không ghi điểm hai lần.
- Một giải Bot–Bot thực tế chạy từ enrollment đến kết quả/BXH; việc mở trang không phải điều kiện để scheduler chạy.

## Mẫu hướng dẫn

Mẫu ABI hiện có trong BotLibraryService (phải chạy kiểm chứng, chưa claim AC):

```python
def choose_move(state, memory):
    return state['legal_moves'][0], memory
```

Hướng dẫn người chơi chỉ cần: tải mẫu → sửa choose_move → tải .py → Test → thấy AC → Dùng Bot này → Ready. Khi đang thi đấu: mở tab Bot của tôi → Test → Dùng Bot này → chờ lượt của mình. AC là vượt bộ kiểm tra, không bảo đảm Bot không bao giờ lỗi với mọi thế trận.
