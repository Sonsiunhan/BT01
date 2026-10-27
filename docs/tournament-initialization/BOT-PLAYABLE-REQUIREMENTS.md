# Bot–Bot chạy thật và tích hợp giải đấu

Ngày 2026-10-26. Phân tích yêu cầu; chưa phải chứng nhận implementation DONE.

Skill đã đọc: ECC contract-first. Phạm vi source khảo sát: local main 4129088 tại `.worktrees/merge-d03`; không đại diện origin/main mới nhất. Không sửa application code trong bước phân tích.

## Quyết định người dùng

- Q1B: được thay Bot cả khi trận đang chạy.
- Q2B: chỉ xóa file lỗi/chưa từng thi đấu. Diễn giải an toàn: file từng được dùng trong trận không xóa kể cả sau này báo lỗi; file bị ghim active/pending không xóa.
- Q3A: server xác nhận AC theo đúng code/luật; một file AC được chọn đủ Ready dù file khác lỗi. Hạ tầng lỗi không đánh Error cho code.
- Q4A: người dùng xác nhận hạn nộp chỉ áp dụng Bot AC ban đầu; sau hạn vẫn được test/thay Bot trong trận.

## Nguyên nhân và phần tái sử dụng

- Backend local 127.0.0.1:3001 từ chối kết nối lúc kiểm tra. Không có BOT_* trong .env và không có src/dist bot-runtime-config.json; wasmtime không có trong PATH. Docker/WSL có executable nhưng chưa xác minh daemon hay runtime. Chưa đủ điều kiện chạy Python sandbox.
- Có Wasmtime/CPython-WASI adapter, BotLibraryService, preflight hai phía, BotOnlineService, xưởng Bot và mẫu SDK; không cần viết engine mới.
- READY trong thư viện hiện chỉ kiểm tra tĩnh, PASSED mới chạy preflight. Workbench cho dùng cả hai; cần thống nhất UI AC và Ready của người chơi.
- BotRevisionUpload chỉ mở PLAYING và upload tự test/đưa pending. Cần tách upload/test/select và dùng chung panel trước/trong trận.
- Readiness chọn file mới có thể chuyển enrollment PENDING và bỏ pin cũ trước khi biết kết quả. Cần giữ candidate tách active/selected.
- Readiness receipts/jobs đang lưu Map/WeakMap; cần bền vững cho restart. DELETE revision đã có nhưng cần liên kết selection/tournament pin và lịch sử sử dụng.
- Preflight hiện hai nước thử; AC chỉ có nghĩa vượt bộ kiểm tra, không đảm bảo mọi nước trong trận tương lai không lỗi.

## Checklist nghiệm thu yêu cầu — cố định 12 mục

1. Upload .py giữ tên file/revision rõ; mỗi file có trạng thái riêng Chưa test/Đang test/AC/Error/Chưa kiểm tra được. File sai UTF-8/kích thước báo đúng file.
2. Server test trong sandbox; kết quả ràng buộc hash code, luật, SDK/runtime/policy. Không nhận AC client tự khai. Lỗi hiển thị tên file, lý do hữu ích; source/log chỉ trả chủ sở hữu.
3. Một file AC được chọn đủ bật Ready của người chơi, các file lỗi khác không chặn. Ready không đồng nghĩa ép bắt đầu khi đối thủ/điều kiện giải chưa đủ.
4. Test/upload candidate không thay selection/active, không reset clock hay memory Bot cũ. Candidate fail hoặc hạ tầng fail giữ Bot cũ.
5. Xóa file chưa từng thi đấu và không bị trận ghim xóa source/kết quả test khỏi backend/UI; refresh không hồi sinh. Nếu đang chọn nhưng chưa ghim, xóa đồng thời bỏ chọn/Ready; không ảnh hưởng lựa chọn khác. Callback test muộn không hồi sinh file.
6. Panel test ngoài trận và tab riêng trong bàn dùng chung component/API; test dùng bộ tình huống riêng theo luật, không dùng board sống để tác động trận.
7. Owner-only cho read source/test/delete/select; đối thủ, referee, observer không xem source/log và không điều khiển candidate. Test quyền tại server, không chỉ ẩn tab.
8. Có tải file mẫu và hướng dẫn ngắn choose_move(state,memory), legal_moves, kiểu output. Mẫu phải AC bằng runtime thật và hai mẫu đấu hết trận; không dùng mock thay bằng chứng.
9. Runtime giới hạn tài nguyên, không mạng/secrets/app filesystem; lỗi provider là Chưa kiểm tra được/retry, không xử thua do hạ tầng. Đo được đường chạy trên máy này trước UI integration.
10. Trước trận chọn file AC; trong PLAYING bấm Dùng Bot này đưa pending, áp dụng ở đầu lượt kế tiếp của chính mình, không sửa lượt đang tính, reset memory khi đổi revision theo cơ chế hiện hữu. Trận PAUSED/ENDED không áp dụng; không tự resume. Latest valid explicit selection thay pending cũ; chống response race.
11. Đổi code hoặc luật liên quan làm AC không còn hợp lệ cho context mới; server kiểm lại receipt lúc select/queue/start/swap. Persist receipt/selection/reference để restart không mất hoặc dùng nhầm file.
12. File từng thi đấu không xóa; active/pending reference chặn xóa. Lịch sử ghi revision/hash và thời điểm áp dụng, không lộ source. Kết quả/điểm giải chỉ commit một lần.

## Điểm cần xác nhận với review

Deadline đã chốt bằng Q4A. AC cho swap phải theo luật đã ghim của trận đang chơi, không lấy luật mới nhất của giải; AC cho trận tương lai dùng context tương lai. Source hiện upload test không truyền ruleProfile, cần sửa và kiểm chứng.

## Hướng xử lý tối thiểu để lập kế hoạch sau review

Ưu tiên runtime thật và hai Bot mẫu chạy hết trận → thống nhất AC/Ready → panel test chung và xóa thật → thay Bot an toàn trước/trong trận → nối enrollment/lịch trận/kết quả giải → E2E gồm reload/restart/lỗi/quyền. Tận dụng adapter, SDK, thư viện, turn loop có sẵn; không xây nền tảng test hay engine mới.
