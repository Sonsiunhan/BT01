# OTTv2 — Đặc tả BA + SA: Khởi tạo giải đấu

| Mục | Nội dung |
|---|---|
| Hệ thống | OTTv2 — trò chơi chiến thuật Kéo–Búa–Bao |
| Bản tài liệu | Bản hiệu chỉnh ngày 20/10/2026 của đặc tả v1.0 |
| Phạm vi | Admin và sáu module Khởi tạo I1–I6; các hợp đồng tích hợp bắt buộc với engine/SDK/runtime/vận hành |
| Trạng thái | Đặc tả tích hợp để team đọc và rà soát; các mặc định/phạm vi bổ sung ở mục 15 chưa được phê duyệt. Không phải chứng nhận implementation hoàn tất |
| Ngôn ngữ | Tiếng Việt cho giao diện/nghiệp vụ; tiếng Anh cho identifier, payload, enum |
| Lịch giao việc | [DELIVERY-PLAN.md](DELIVERY-PLAN.md), candidate V2; không sử dụng lộ trình 7 ngày của bản cũ |
| Đọc biểu mẫu | Mục 7.3 có đủ danh mục F01–F82; gồm trường người tạo nhập, trường hệ thống và bước thực hiện sau tạo nháp |

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu

Tournament Admin được System Admin cấp quyền theo hợp đồng, khởi tạo và quản lí giải của mình. Quy trình: nháp → gửi duyệt → duyệt → nhập thí sinh/nhân sự → kiểm tra sẵn sàng → chuyển sang vận hành. Một giải có một Stage ARENA/đua top; cách trình bày bảng xếp hạng kiểu CTF không tự tạo một thể thức khác.

Luật giải hỗ trợ cấu hình kích thước bàn, số lượng và bố cục ba loại quân, cách đi của từng loại theo từng bên, đích tĩnh/động và phân xử kết quả. Engine, SDK, preview, replay và runtime phải cùng hiểu phiên bản luật. Không coi việc lưu JSON hoặc dựng form là hoàn tất tính năng luật.

### 1.2 Module

| Module | Trách nhiệm |
|---|---|
| I1 | Đơn vị đối tác, hợp đồng, hạn mức dùng chung, phạm vi cấu hình được phép |
| I2 | Identity, quyền quản trị, grant theo hợp đồng/giải, nhân sự và hỗ trợ tài khoản |
| I3 | Biểu mẫu, Ruleset/config version, điều lệ, clock/result/scoring/pairing contracts |
| I4 | Vòng đời, duyệt ban đầu, change request riêng, lịch và kiểm tra sẵn sàng |
| I5 | Roster, import CSV/XLSX, tạo tay, kích hoạt, account reuse và retention |
| I6 | Bot pool, SECURITY/COMPATIBILITY, SDK/runtime receipts và readiness thật |

### 1.3 Ranh giới khởi tạo và vận hành

Khởi tạo phải có dữ liệu, quyền, cấu hình bất biến và readiness dùng được. Engine/SDK/runtime adapter, preview và phân xử thủ công trong lịch giao việc là điểm nối bắt buộc, không được bỏ dưới nhãn “vận hành để sau”.

Full scheduler chạy hàng loạt, ledger/BXH production, dashboard trực tiếp, replay công khai, void/disqualify/khiếu nại và xuất kết quả hàng loạt là phần Vận hành. Đặc tả này định nghĩa payload, cấu hình và tiêu chí bàn giao của chúng; lịch Khởi tạo không mặc nhiên nhận hoàn thành toàn bộ runner.

### 1.4 Ưu tiên

| Tầng | Nội dung |
|---|---|
| MUST | SA/TA/Referee và quyền server; hợp đồng gọn; quota nguyên tử; form nháp/submit; duyệt ba kết quả; change request; import/tạo tay; activation/recovery; Referee accepted trước READY; movement theo type+side; đích STATIC/CYCLE/SEEDED; kết quả cấu hình được; manual exact-tie có timeout/fallback; luật versioned khi RUNNING; SDK/runtime/compatibility thực; audit và privacy |
| SHOULD | Email đã xác minh; CO_ADMIN/ROSTER_MANAGER nâng cao; nhóm đơn vị/cây hai cấp; slot booking; cửa sổ chơi; tùy biến BXH/spectator UI; nộp/chuyển Bot nâng cao; cảnh báo retention |
| COULD | Ảnh bìa, nhân bản giải và chia sẻ template qua UI |
| DEFER | IAM đầy đủ; chuỗi hợp đồng; resource billing/ledger nâng cao; nhiều Stage/Swiss/knockout; rule script, đường nhiều đoạn/đa capture/biến hình nếu chưa hỗ trợ; goal theo sự kiện tùy ý; kiểm tra tương thích trước hiệu lực theo lịch nâng cao |

SHOULD/COULD không được làm form MUST không submit được. Dùng default/not-applicable có ngữ nghĩa rõ; không hiển thị nút giả đã thực thi. Mục 15 phân biệt đề xuất chi tiết chưa phê duyệt với yêu cầu nghiệp vụ đã có.

## 2. Hệ thống hiện tại và hướng thiết kế

| Vùng | Thực trạng và yêu cầu tích hợp |
|---|---|
| Bàn/luật hiện hành | Source đã quan sát còn giả định 9×9, bố cục và scorer cố định; cần mở rộng bằng profile giải. Giữ canonical setup A1/I9 và các mode cũ |
| Admin | Không suy ra đã có role/schema/API/trang chỉ vì tài liệu nêu tên. Phải kiểm tra source và tạo đúng capability còn thiếu |
| Bot | Không suy ra Robot Lab đã hỗ trợ đầy đủ luật mới. SDK, legal moves, scorer, receipts và consumer Người–Python Bot/Bot–Bot cần bằng chứng thực |
| Nguồn thẩm quyền | Server sở hữu quyền, quota, clocks, lifecycle và result; UI không tự cấp quyền/sẵn sàng/kết quả |
| Cấu hình | Dữ liệu khai báo có schema và giới hạn, không thực thi JS/Python từ form |
| Quy mô | Mục tiêu 4.000–10.000 thí sinh đồng thời đăng nhập/sẵn sàng; số trận/worker đồng thời xác định riêng và phải đo |
| Tách tải | Web/Admin, import jobs và Bot runtime có ranh giới tài nguyên; không chạy Python người chơi trong app hoặc native subprocess không hạn chế |

Không hứa hệ thống đã phục vụ 10.000 kết nối trên cấu hình yếu. Trước vận hành phải ghi môi trường, worker concurrency, P95/P99, CPU/memory và kết quả load test. Không tự thuê dịch vụ, bật billing hoặc triển khai production.

## 3. Tác nhân và quyền

### 3.1 Vai trò

| Vai trò | Quyền và phạm vi |
|---|---|
| SYSTEM_ADMIN | Tạo đơn vị/hợp đồng/TA; đặt giới hạn; duyệt hồ sơ/thay đổi vượt phạm vi; xem toàn hệ thống theo ACL; xử lí hỗ trợ; không chơi Online và không thay TA điều hành kết quả |
| TOURNAMENT_ADMIN | Tạo/quản lí giải mình trong contract binding; nhập roster; mời/gán staff; phát hành luật trong envelope; quyết định manual exact-tie của giải mình |
| REFEREE | Grant riêng theo giải, nhận lời mời trước khi có quyền; thao tác trọng tài trong phần Vận hành; không phải bên chơi hoặc host management |
| BROADCAST_OBSERVER | Quan sát giải được phân, không điều khiển kết quả |
| CO_ADMIN / ROSTER_MANAGER | SHOULD, grant theo giải và invite accepted; không tự có global ADMIN hoặc quyền reset credential |
| TOURNAMENT_USER | Identity có person_key, enrollment riêng từng giải, credential thuộc chủ tài khoản; trạng thái tài khoản khác readiness giải |
| USER ngoài / Guest | Guest là principal chưa xác thực. Khi có giải RUNNING/PAUSED, người ngoài phạm vi tham gia hợp lệ không được vào trận Online mới; Offline/quan sát đúng quyền vẫn hoạt động |

### 3.2 Ma trận thao tác

| Hành động | SA | TA chủ giải | Referee | Observer / thí sinh |
|---|---|---|---|---|
| Tạo hợp đồng/đơn vị/tài khoản TA | Có | Không | Không | Không |
| Tạo giải | Không | Có | Không | Không |
| Duyệt hồ sơ hoặc thay đổi vượt envelope | Có | Không tự duyệt | Không | Không |
| Xem/sửa cấu hình giải | Xem; duyệt theo workflow | Giải mình; giới hạn theo trạng thái/envelope | Chỉ xem phần được cấp | Theo quyền xem |
| Import/tạo tay thí sinh | Không thay TA thao tác roster | Có | Không | Không |
| Tạo/mời staff theo giải | Không thay TA phân công | Có; không cấp global role | Nhận lời mời | Nhận lời mời nếu đúng đối tượng |
| Phát hành luật trong envelope | Không thay TA | Có, kể cả RUNNING | Không | Không |
| Phân xử exact-tie đang chờ | Không | Có, có lý do/trước deadline | Không | Không |
| Khôi phục credential đã kích hoạt | Xác minh rồi cấp token trực tiếp chủ tài khoản | Chỉ gửi yêu cầu hỗ trợ | Không | Chủ tài khoản tự đặt lại bằng token hợp lệ |
| Audit | Theo phạm vi hệ thống | Giải mình, dữ liệu đã lọc | Theo grant nếu có | Không xem bí mật |
| Pause/resume giải | Khi sự cố hệ thống, ghi lý do | Có trong quyền và trạng thái hợp lệ | Không mặc nhiên có | Không |
| Void/disqualify | Không | Không qua endpoint phân xử | Phần Vận hành | Không |

Quyền luôn kiểm từ principal/binding/enrollment trên server; URL/payload/client flag không cấp role. Hết một hợp đồng chỉ thu hồi grant tương ứng, không khóa toàn identity còn quyền hợp lệ khác.

### 3.3 IAM và tổ chức

MVP dùng ma trận và một cổng kiểm quyền. IAM đầy đủ gồm Allow/Deny/propagation/cây nhiều cấp để DEFER. Nhóm đơn vị SHOULD; bản đầu có allowed_unit_ids trực tiếp, không mở toàn hệ thống khi group chưa làm.

## 4. Giao diện Admin và các trang cần có

Admin có nhóm Quản lí giải đấu và một nhóm Công cụ Offline: Kho Bot, Bot Offline, Phòng tập Người–Bot, Người–Người. Không có chế độ/nút tham gia chơi Online; server cũng từ chối direct player admission của Admin. Quản trị/quan sát đúng quyền vẫn hoạt động.

Danh sách giải trình bày thẻ, tìm kiếm/lọc trạng thái Đang diễn ra/Sắp diễn ra/Đã kết thúc và phân trang server. Nút “Tạo giải đấu” chỉ dành TA có contract binding/quota hợp lệ.

Các trang: danh sách giải, form nháp, chi tiết/readiness, luật/phiên bản, phân xử, đơn vị, hợp đồng, hộp duyệt, tài khoản TA, roster/import, nhân sự, support, activation/recovery, audit, Offline hub, Bot readiness; entrypoint nhận lời mời và xác nhận điều lệ. Chủ trang FE+BE và deadline xem DELIVERY-PLAN.md.

Mọi trang có loading/empty/error/forbidden/retry và đường quay lại. Form giữ dữ liệu khi lỗi mạng/xung đột; báo lỗi đúng trường. Hỗ trợ bàn phím, mobile, light/dark và reduced motion. Không lộ raw stack/path/env.

## 5. Vòng đời giải

| Trạng thái | Chuyển hợp lệ | Tác động |
|---|---|---|
| DRAFT | SUBMITTED; xóa nháp; CANCELLED | Trừ một lượt chung hợp đồng khi tạo; lưu tối thiểu tên+hợp đồng hợp lệ |
| SUBMITTED | UNDER_REVIEW; CANCELLED | Submit kiểm đủ field/caps; slot soft hold chỉ khi scheduler có thực thi |
| UNDER_REVIEW | APPROVED / REJECTED / CHANGES_REQUESTED; CANCELLED | Ba kết quả, lý do/field notes, snapshot reviewer thực sự duyệt |
| CHANGES_REQUESTED | DRAFT rồi gửi lại; CANCELLED | Giữ lịch sử; slot có expiry nếu tính năng được bật |
| REJECTED | Kết thúc hồ sơ | Hoàn lượt đúng một lần; muốn làm lại sao chép thành nháp mới và giữ lượt mới |
| APPROVED | ROSTER_OPEN; CANCELLED | Chốt config_version và envelope được duyệt |
| ROSTER_OPEN | READY; CANCELLED | Roster/activation/staff/receipts; không bắt hoàn tất các mục này để lưu DRAFT |
| READY | RUNNING; CANCELLED | Đến start_at và đủ blocker gate; thiếu điều kiện không tự chạy |
| RUNNING | PAUSED / ENDED / CANCELLED | Đến end_at phải ENDED; đổi luật qua version riêng |
| PAUSED | RUNNING / ENDED / CANCELLED | Dừng admission mới; quá end_at vẫn ENDED; không tự bù giờ |
| ENDED | REVIEWING / FINALIZED | Gameplay đóng; không final khi còn request/recompute chưa settle |
| REVIEWING | FINALIZED | Theo policy chốt kết quả và cửa sổ kiểm tra nếu hỗ trợ |
| FINALIZED | ARCHIVED | Snapshot kết quả chính thức; export Top N |
| ARCHIVED | Retention theo đối tượng | Không xóa dữ liệu/tham chiếu còn được giải khác dùng |
| CANCELLED | Kết thúc giải đã hủy | Không hoàn lượt nếu từng APPROVED; chính sách xử lí trận/result chi tiết tại mục 15 |

Change request có state riêng DRAFT/SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED. Sửa trường khóa từ APPROVED/ROSTER_OPEN/READY/RUNNING/PAUSED không đưa trạng thái giải về UNDER_REVIEW. Pending/rejected giữ cấu hình hiệu lực; approved tạo version mới. Không tự resume hoặc bỏ blocker khác.

## 6. Luồng đầu cuối

1. SA bootstrap một lần, tạo đơn vị/hợp đồng/envelope và cấp TA.
2. TA mở danh sách giải → Tạo giải → chọn hợp đồng, đặt tên, lưu DRAFT.
3. Điền form theo mục 7.3, preview/validate luật; server kiểm quyền và quota/caps.
4. Submit; SA xem snapshot và duyệt/từ chối/yêu cầu sửa.
5. APPROVED → ROSTER_OPEN: TA import/tạo tay roster, mời Referee; thí sinh kích hoạt.
6. Thí sinh đọc điều lệ, chọn controller/Bot phù hợp; Bot kiểm SECURITY và đúng luật/SDK/runtime.
7. Server tổng hợp readiness; UI liệt kê từng blocker. Đủ điều kiện mới READY và chuyển RUNNING đúng lịch.
8. Khi đổi luật: TA publish trong envelope; ngoài envelope gửi duyệt lại; trận đã tạo giữ snapshot cũ.
9. Kết thúc gameplay → phân xử/settlement → final snapshot. Vận hành dùng hợp đồng tích hợp tại mục 10.

## 7. Đặc tả sáu module

### 7.1 I1 — Hợp đồng và hạn mức

Contract gồm contract_id, partner_unit_id, valid_from/to, max_tournaments, tournament_min/max_days, max_participants_per_tournament/total, allowed_unit_ids, allowed_control_modes, rules_envelope và sandbox_caps. Chỉ SA tạo/kích hoạt/sửa chính sách; giải phải nằm trong một hợp đồng hiệu lực.

quota_used thuộc hợp đồng, không thuộc từng TA binding. Tạo draft/xóa nháp/reject/refund dùng transaction+idempotency. Giải từng approved hủy không hoàn lượt. Counter không mất vì retention xóa PII. Cách đếm max_participants_total phải hiển thị rõ trước áp dụng; đề xuất cụ thể tại mục 15.

contract_chain_id, resource_budget/budget_policy và billing ledger để DEFER; không dùng chuỗi hợp đồng làm dependency MUST. Hết hợp đồng thu hồi binding; lịch sử vẫn được truy cập theo ACL/retention được định nghĩa, không kéo dài quyền ghi giải.

### 7.2 I2 — Identity, đơn vị, staff và support

Unit do SA tạo, unit_code ổn định/unique, không tự tạo từ tệp. TA chỉ tạo/mời staff trong phạm vi giải và vai trò được hỗ trợ; không tạo TA/global ADMIN. Invite phải accepted; revoke/expiry áp dụng grant của giải, không xóa identity dùng chung. Ít nhất một Referee accepted là blocker trước READY.

Tài khoản mới chưa claim dùng mã kích hoạt một lần do BTC phân phối. Sau kích hoạt, chủ tài khoản tự đặt mật khẩu; TA không biết/đặt lại mật khẩu đó. Mã chưa claim có thể bị BTC dùng trước người nhận: giới hạn của kênh phân phối này phải được nhận diện, không gọi là xác minh độc lập. Email xác minh là SHOULD.

Tài khoản đã kích hoạt: import lại không phát mã claim/reset. Có nút “Yêu cầu hỗ trợ tài khoản” tại roster và trang account-access khi chưa đăng nhập. Request OPEN/IN_REVIEW/RESOLVED/REJECTED. SA xác minh ngoài hệ thống, bằng chứng tham chiếu có ACL riêng; thành công cấp reset token một lần trực tiếp chủ tài khoản. Không hiển thị password mới cho TA/SA hoặc ghi vào audit. Request không tự khóa tài khoản; phản hồi chung tránh dò danh tính.

### 7.3 I3 — Danh mục trường khởi tạo và thao tác liên quan

Mỗi nhóm ghi ai nhập và ở bước nào. Không bắt người tạo điền 82 ô một lúc; thông tin hệ thống/roster/READY/đổi luật nằm ở bước tương ứng. Các giá trị ghi “đề xuất” phải được duyệt theo mục 15 trước khi áp dụng làm chính sách.

#### Quy ước

- D: cần khi tạo DRAFT; S: cần trước gửi duyệt; P: cần trước publish/READY; C: chỉ xuất hiện theo điều kiện; N: tùy chọn. DRAFT luôn cho lưu phần chưa hoàn tất, ngoại trừ dữ liệu tối thiểu và ràng buộc không được lưu.
- M/S/C/Df trong cột tầng: MUST/SHOULD/COULD/DEFER. Không nhầm tầng SHOULD với giá trị NULL được engine chấp nhận: hệ thống có thể cung cấp giá trị cố định/mặc định.
- TA: người tạo chọn/nhập; SA: SA cấu hình, TA chỉ chọn trong phạm vi; Auto: server tạo/suy ra, không nhập.
- Khóa sau duyệt nghĩa cần change request, không đưa tournament status về UNDER_REVIEW. Ruleset đã publish luôn bất biến; sửa tạo version mới kể cả đang RUNNING.
- Đây là lược đồ ngữ nghĩa. Builder hiển thị nhãn và bảng/chọn ô/preview, không bắt người dùng nhập JSON/vector kỹ thuật.

#### A. Hồ sơ, đối tượng và thể thức

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F01 | Hợp đồng `contract_id` | TA chọn / D | Chỉ hợp đồng có quyền và hợp lệ; hiển thị giới hạn và quota; khóa sau duyệt | M |
| F02 | Tên giải `name` | TA / D | 3–120 ký tự sau trim; báo trùng tên chỉ như cảnh báo nếu slug vẫn unique | M |
| F03 | Mã/đường dẫn giải `slug` | Auto gợi ý, TA sửa / S | Unique, kiểm server; ID giải bất biến khác slug; đổi slug không mất tham chiếu | M |
| F04 | Mô tả `description` | TA / N | Plain text, bounded; không thực thi HTML/script | M |
| F05 | Đơn vị tổ chức `organizer_unit_id` | TA chọn trong SA scope / S | FK hợp lệ trong contract; khóa sau duyệt | M |
| F06 | Chủ giải `owner_user_id` | Auto / D | Chính TA đã xác thực, không tin payload | M |
| F07 | Hiển thị giải `visibility` | TA / S | PRIVATE mặc định; PUBLIC/UNLISTED; visibility không tự cấp quyền tham gia | M |
| F08 | Thể thức `pairing_strategy`, `stage_count` | Auto / S | ARENA, một Stage; UI trình bày thông tin, không bắt nhập | M |
| F09 | Chế độ điều khiển `control_mode` | TA / S | HUMAN_ONLY/BOT_ONLY/HYBRID trong contract; khóa sau duyệt; HYBRID cần controller policy rõ | M |
| F10 | Quy mô dự kiến `expected_participants` | TA / S | Int dương ≤max_participants, kiểm cả form và server | M |
| F11 | Số thí sinh tối đa `max_participants` | TA / S | Int dương trong contract; khác số trận thực thi đồng thời | M |
| F12 | Phạm vi đơn vị `allowed_unit_ids` | SA scope + TA chọn / S | Danh sách unit trực tiếp bản gọn; không để group SHOULD khiến form MUST không submit được | M |
| F13 | Nhóm đơn vị `allowed_unit_group_ids` | TA / N | Tiện ích chọn/tái sử dụng; quy đổi unit scope tường minh, không mặc định mở toàn hệ thống | S |
| F14 | Ảnh bìa `banner` | TA / N | Upload có giới hạn định dạng/kích thước; không cần để submit | C |

#### B. Thời gian

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F15 | Mô hình lịch `time_model` | TA / S | FIXED_WINDOW/MULTIDAY; không tự tạo nhiều Stage | M |
| F16 | Múi giờ `timezone` | TA / S | IANA, đề xuất Asia/Ho_Chi_Minh; lưu instant chuẩn, hiển thị zone | M |
| F17 | Mở/đóng nhập danh sách `roster_open_at`, `roster_close_at` | TA / S | open<close≤start; duyệt muộn hơn lịch cần báo lỗi/điều chỉnh, không lặng lẽ nhập quá hạn | M |
| F18 | Bắt đầu/kết thúc `start_at`, `end_at` | TA / S | start<end, trong hợp đồng, đúng min/max duration; khóa sau duyệt | M |
| F19 | Cửa sổ chơi hằng ngày `daily_play_windows` | TA / N | NULL=24h trong khoảng giải; validate timezone/overlap nếu tính năng có | S |
| F20 | Slot giữ chỗ `time_slot_ids` | Auto từ lịch / C | Không nhập tay; chỉ hứa đặt chỗ nếu scheduler có thực thi/hold thật | S |
| F21 | Khoảng bảo trì `maintenance_blackouts` | SA/TA trong scope / N | Khoảng hữu hạn, ảnh hưởng lịch/admission; không tự bù end_at | S |
| F22 | Số trận/ngày và cả giải `max_matches_per_player_per_day`, `max_matches_per_player_total` | TA / N | Int dương hoặc NULL=không giới hạn nghiệp vụ; vẫn có runtime capacity gate | M |

#### C. Bàn, quân và chuyển động

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F23 | Chọn mẫu luật `base_template_id` | TA / N | Mẫu giúp điền nhanh, mọi giá trị hiệu lực hiện rõ và snapshot theo version | M |
| F24 | Số hàng/cột `board_rows`, `board_cols` | TA / S | Mỗi chiều5..15; không tự khóa bàn vuông | M |
| F25 | Số quân `piece_counts[side][type]` | TA / S | BLUE/RED ×R/P/S; int≥0 và khớp layout, thêm điều kiện khi bật extinction | M |
| F26 | Bố cục `piece_layout` | TA trên preview / S | Mỗi quân1ô, không chồng/ngoài bàn, đủ số lượng; không cấm bất đối xứng | M |
| F27 | Dùng luật di chuyển chung hai bên `same_movement_for_both_sides` | TA / S | Tiện ích builder; khi tắt hiện3 profile/bên, khi bật bản chuẩn hóa vẫn tường minh | M |
| F28 | Mẫu di chuyển theo loại/bên `movement_profiles` | TA / S | Đề xuất RAY ngang/dọc/chéo và LEAP theo offset tùy chọn, hoặc hợp các mẫu; đường nhiều đoạn là phạm vi chưa duyệt, không gọi hỗ trợ mọi luật tưởng tượng | M |
| F29 | Hướng đi `directions` và hệ hướng | TA / C | Hướng ngang/dọc/chéo/vector được hỗ trợ; absolute/relative có preview | M |
| F30 | Khoảng cách `min_distance`, `max_distance` | TA / C | Int có bounds, min≤max, max không vô hạn; cùng một nước không phải nhiều lượt | M |
| F31 | Nhảy qua quân `can_jump` | TA / C | Chỉnh với RAY có đường xác định; LEAP luôn bỏ kiểm trung gian và hiển thị cố định, không toggle mâu thuẫn; không ăn quân ở giữa | M |
| F32 | Ô lệch kiểu nhảy `leap_offsets` | TA trên lưới / C | Tập hữu hạn offset, không zero; preset kiểu ngựa và tùy chọn offset theo khả năng builder | M |
| F33 | Quan hệ ăn quân/chặn cùng loại `capture_policy` | Auto / S | R>S, P>R, S>P; same-type/friendly blocking hiện hành; không là trường thay đổi trong bản đầu | M |
| F34 | Điều kiện thắng `win_conditions` | TA / S | Đề xuất EXTINCTION và/hoặc GOAL_REACHED, OR, tối thiểu1; theo mục 15 semantics/ràng buộc chờ kiểm duyệt | M |
| F35 | Xem trước và kiểm luật | Auto từ F24–F34 / S,P | SUBMIT kiểm cấu trúc/caps/dependencies và snapshot SA duyệt; P bổ sung consumer/runtime/compatibility thật. Preview theo engine, không ghi đã chứng minh cân bằng | M |

#### D. Ô đích, theo từng bên

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F36 | Kiểu đích `goal_profiles[side].mode` | TA / C | Khi GOAL_REACHED: STATIC/CYCLE/SEEDED; nếu không bật goal thì không giữ goal fields giả có hiệu lực | M |
| F37 | Ô đích tĩnh `static_cell` | TA chọn ô / C | Trong bounds, không tự di chuyển quân đang có; không initial-own-goal terminal | M |
| F38 | Danh sách đường đích `cycle_cells` | TA chọn ô có thứ tự / C | CYCLE, hữu hạn/nonempty; xác định bắt đầu index0 và wrap | M |
| F39 | Tập ô ứng viên `candidate_cells` | TA chọn ô / C | SEEDED, hữu hạn/nonempty; seed streams riêng hai bên; policy cho lặp lại đang đề xuất | M |
| F40 | Đổi sau K vòng `round_interval` | TA / C | CYCLE/SEEDED; int dương riêng mỗi bên;1vòng=2 lượt hợp lệ, không theo wall time | M |
| F41 | Chính sách seed trận và stream goal `match_seed_policy`, `goal_seed_policy` | SA profile/TA chọn policy / S,C | theo mục 15 server tạo versioned independent streams; goal schedule/seed cho người chơi xem, runtime private seed riêng không lộ; không TA override seed từng trận | M |
| F42 | Hiệu ứng khi đích tới quân | Auto / C | Không tự thắng/capture; chỉ nước đi vào goal hiện hành mới xét thắng  | M |

#### E. Lượt, đồng hồ và kết quả

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F43 | Bên đi trước `first_move_policy` | TA / S | Đề xuất BLUE_FIRST/RED_FIRST/SEEDED; default BLUE_FIRST theo mục 15; không suy từ UI rotation | M |
| F44 | Phân bên cho trận kế tiếp `side_swap_policy` | TA / S | Đổi assignment giữa các trận theo policy; chốt khi tạo trận, không sửa side/luật trận đã tạo | M |
| F45 | Đồng hồ và thời gian nước `clock_profile`, `turn_time_limit_ms` | TA chọn profile trong caps / S | Think clock khác compute/total compute, bootstrap và queue wait; SA profile cung cấp giới hạn kỹ thuật, không bắt TA điền mọi số | M |
| F46 | Giới hạn số nước toàn trận `max_plies` | TA / N | theo mục 15 đếm accepted plies, finite sốchẵn, Bot default120; HUMAN NULL được nếu clock hữu hạn; goal interval vẫn tính full rounds | M |
| F47 | Kết quả theo tình huống `event_resolution_policies` | TA/preset / S | WIN/LOSS cho bên gặp event khi xác định được, DRAW nếu cho phép, hoặc COMPARE_CRITERIA; limit chung không có bên vi phạm không dùng nhãn WIN/LOSS mơ hồ | M |
| F48 | Nối lại/bỏ trận `reconnect_grace_seconds`, `idle_forfeit_seconds`, `abandon_result` | TA trong policy / S | Int có bounds/enum; bỏ trận khác hạ tầng; giữ blockers khi resume | M |

#### F. Bot — chỉ hiện theo control mode

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F49 | Hồ sơ runtime `bot_runtime_profile` | SA, TA chọn / C | Chỉ profile đã kiểm chứng, không tùy chọn native Python; HUMAN_ONLY không cần Bot | M |
| F50 | Trần Bot `bot_cpu_ms_per_move`, `bot_memory_mb`, `bot_max_file_kb`, `bot_allowed_libs` | SA caps + TA trong caps / C | Không được chỉ khai báo UI rồi runtime vẫn dùng giá trị khác; profile phản ánh enforce thật | M |
| F51 | Tổng compute mỗi bên Bot/trận `bot_total_compute_ms_per_side` | SA profile + TA trong caps / C | Finite riêng mỗi bên; hard stop ngay hết budget không chạy thêm cho đủround; adjudicate committed snapshot, không charge queue/bootstrap | M |
| F52 | Hồ sơ kiểm tra `bot_qualification_profile` | Auto từ profile/version / C | SECURITY và COMPATIBILITY bắt buộc nếu cho Bot vào trận; không để NULL vì UI SHOULD | M |
| F53 | Bot pool/nộp file `bot_pool_max_files`, `bot_submissions_per_day`, `bot_submission_cutoff_at` | TA / N | Quota admission an toàn có hệ thống cưỡng chế dù custom UI chưa làm | S |
| F54 | Chuyển Bot giữa trận `in_match_bot_switch_enabled`, `max_bot_switches_per_match` | TA / N | Đề xuất false ở bản đầu; nếu bật cần consumer verified, Bot source version mới có receipt đúng luật trận, ranh giới lượt hợp lệ và event replay. Không ghi đè source snapshot cũ, không đổi ruleset/controller; giới hạn lượt chuyển được server cưỡng chế | S |

#### G. Khai báo điểm và vận hành

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F55 | Preset điểm `scoring_preset`, sàn điểm `score_floor` | TA chọn registry, sàn Auto / S | Sàn0 cố định; đề xuất ELO_WEIGHTED_V1 theo mục 15 có formula/caps/default10/5/0; chờ Nam duyệt, không formula script | M |
| F56 | Elo khởi đầu `initial_rating_mode`, `rating_compression_factor` | TA / S | KEEP_SYSTEM/COMPRESS_TO_BASELINE; factor có miền tường minh | M |
| F57 | Ghép cặp `elo_band_initial`, `elo_band_expand_rate`, `rematch_limit`, `rematch_limit_scope` | TA / S | Miền/đơn vị rõ; khai báo cho runner, không chứng minh đã có scheduler | M |
| F58 | Ghi ngược Elo hệ thống `affects_system_rating` | TA / S | Đề xuất false; khóa sau duyệt; không thay rating global bằng trận chưa có authority | M |
| F59 | Chốt kết quả `finalization_mode` | TA / S | AUTO_FINAL baseline; FREEZE_REVIEW/AUTO_REOPEN tùy consumer SHOULD | M/S |
| F60 | Thứ tự tiêu chí phụ/đóng băng/khiếu nại `tiebreak_order`, `freeze_minutes`, `review_window_hours` | TA / C | theo mục 15 score→Elo→wins→earlier-reached→participantId cho TopN; custom/freeze/review UI SHOULD; không lẫn match comparator | S |
| F61 | N xem BXH và N tuyển chọn | TA ở màn hình tương ứng / N | N xem mặc định10 là UI runtime; không bắt nhập khi tạo giải; nếu N tuyển chọn thành điều lệ thì phải là field riêng và được duyệt | M runtime / pending selection |
| F62 | Nhân sự `referee_user_ids`, `observer_user_ids` | TA mời / P | Có≥1 Referee accepted trước READY; Observer tùy chọn, identity scope riêng | M/S |
| F63 | Điều lệ `rules_quick_summary`, `regulations_full`, `rules_ack_required` | TA / S | Plain text bản đầu; versioned, consent theo version có hiệu lực; policy re-ack sau đổi luật cần review | M |
| F64 | Danh tính BXH `leaderboard_identity_display` | TA/preset / S | Đề xuất NAME_UNIT_MASKED; UI custom SHOULD nhưng public payload luôn lọc theo quyền | M default / S UI |
| F65 | Quyền xem trực tiếp `spectator_access` | TA/preset / S | Đề xuất STAFF_ONLY/ROSTER_ONLY cho PRIVATE; không mở public chỉ vì có URL; custom UI SHOULD | M default / S UI |
| F66 | Retention `data_retention_days`, `retention_notice_days` |90 ngày Auto, TA chọn ngày nhắc / S,N |90ngày , không cho TA đổi nhầm; account/source/log/audit TTL riêng; nhắc nâng cao SHOULD | M/S |

#### H. Thông tin hệ thống — không yêu cầu người tạo điền

| ID | Thông tin | Hành vi |
|---|---|---|
| F67 | `tournament_id`, status, created/updated stamps, actor IDs | Auto server, không chỉnh qua payload |
| F68 | `ruleset_version`, `config_version`, `schema_version`, `engine_profile_version` | Auto, immutable snapshot; TA chọn mẫu/nội dung không tự nhập số version để ghi đè |
| F69 | Reason/effective_at khi phát hành luật | TA bắt buộc ở thao tác đổi luật, không ép điền reason giả khi tạo lần đầu; có preview diff và cảnh báo impact |
| F70 | Approval envelope và audit | SA duyệt phạm vi rõ; audit ghi actor/action/result/reason, không chứa credential/source/private logs |
| F71 | Runtime readiness, job progress, compatibility | Auto từ server/worker thật; không cấp PASSED bằng tickbox admin |
| F72 | Roster và kích hoạt | Workflow sau APPROVED/ROSTER_OPEN, không nhét file/mật khẩu vào form tạo nháp; không bắt chờ toàn bộ10k kích hoạt mới lưu cấu hình |

#### I. Phân xử kết quả trận — khác điểm BXH

| ID | Nhãn/identifier | Chủ nhập / cần | Kiểu, điều kiện, mặc định đề xuất | Tầng |
|---|---|---|---|---|
| F73 | Cho phép kết quả Hòa `draw_enabled` | TA / S | : mặc định false, TA bật được và chọn event DRAW; tắt thì không còn DRAW ẩn ở comparator/fallback | M |
| F74 | Trọng số từng loại quân `material_weights` | TA / C | Riêng wR/wP/wS khi có WEIGHTED_MATERIAL; đề xuất chung hai bên, default1, hữu hạn không âm/ít nhất1 dương; không là điểm BXH | M |
| F75 | Danh sách/thứ tự tiêu chí `match_tiebreak_order` | TA / C | Bộ tiêu chí khai báo, không script; đề xuất WEIGHTED_MATERIAL→GOAL_DISTANCE(nếu có)→MOBILITY, compare lexicographic | M |
| F76 | Phân xử cuối `final_tie_policy` | TA / C | FIRST_MOVER_WINS/SECOND_MOVER_WINS/MANUAL_ADMIN; mặc định đề xuất SECOND_MOVER_WINS; bên thực sự trước/sau được ghim theo match, không mặc định RED | M |
| F77 | Hiển thị policy phân xử | Auto / C | : không hiện thường trực ở màn đấu, có trong điều lệ đầy đủ và luật trận; không phải toggle cho luật bí mật | M |
| F78 | Xem trước phân xử | Auto / C | Cùng snapshot trả chỉ số hai bên, tiêu chí quyết định và verdict cho actor được phép; regression exact-tie/version/cadence | M |
| F79 | Thời hạn chờ TA `adjudication_timeout_seconds` | TA / C | Chỉ MANUAL_ADMIN; int dương bounded; default300s theo , deadline do server tạo lúc request xuất hiện | M |
| F80 | Kết quả dự phòng `adjudication_fallback` | TA / C | Chỉ MANUAL_ADMIN: FIRST_MOVER_WINS/SECOND_MOVER_WINS; default SECOND_MOVER_WINS ; không được chọn MANUAL lặp lại hoặc DRAW khi draw=false | M |
| F81 | Người có quyền quyết định | Auto từ ownership / C | Baseline TA chủ giải; không bắt chọn người để vô tình cấp role khác; endpoint không cho SA/Ref/ngoài scope override | M |
| F82 | Cảnh báo và công bố manual adjudication | Auto / C | Điều lệ có manual policy/deadline/fallback; preview điểm; quyết định cần lý do/audit, chưa settle không official finalize | M |



### 7.4 I4 — Duyệt, lịch và readiness

Duyệt ba kết quả; optimistic version conflict không ghi đè im lặng. Sửa ngày/quy mô/đơn vị/control/resources hoặc vượt rules_envelope phải qua change request. Trong envelope, TA được publish luật bất biến với reason/effective_at và kiểm luật/compatibility.

Slot scheduler SHOULD: giữ mềm/chốt/nhả toàn bộ khung cần thiết nguyên tử, expiry theo server. time_slot_ids auto, không bắt nhập nếu scheduler chưa làm; UI không hứa đảm bảo capacity. daily_play_windows mặc định not-applicable/toàn khoảng giải nếu tính năng chưa bật. Pause giải dừng admission mới, không tự Stop trận đang chạy; Stop trận là thao tác khác, board/clocks đóng băng theo server.

Readiness kiểm roster hợp lệ, accepted Referee, config/rules hợp lệ, mode/controller, rules acknowledgment nếu bật, receipt đúng phiên bản và runtime thực. Đổi luật làm thiếu receipt thì chặn trận mới của thí sinh liên quan, giữ điểm, cho kiểm tra lại/chọn Bot khác.

### 7.5 I5 — Roster, import và account reuse

| Mục | Quy định |
|---|---|
| Nguồn | CSV/XLSX hoặc tạo tay bởi TA; không tự đăng ký roster |
| Mẫu mới | unit_code, student_or_member_id, full_name, username; email tùy chọn; không dùng password để tạo/reset |
| person_key | (unit_code, student_or_member_id); không dùng họ tên/email. Không khẳng định nhận diện duy nhất một người thật giữa các đơn vị |
| Username | Unique toàn hệ thống, chuẩn hóa Unicode/case/whitespace và tên dành riêng; lỗi chung “username không khả dụng” |
| Preview | Lỗi theo dòng: đơn vị lạ/ngoài scope/thiếu/sai/trùng; cùng tên/email chỉ cảnh báo. ID có số 0 đầu phải giữ đúng |
| Commit | Kiểm lại quyền/scope/caps/version/uniqueness; preview không giữ suất hoặc cấp quyền. Worker theo lô có progress, idempotency, retry |
| Tệp/staging | Raw không lưu lâu; file_hash không thay dữ liệu cho worker. Lưu normalized rows có TTL/ACL, xóa raw sau parse/staging hoặc lỗi; không giữ file_ref mật khẩu |
| Mẫu cũ có password | Đề xuất từ chối có hướng dẫn đổi mẫu; không preview/log secret. Không tiếp tục đường import tự đặt password |
| Trạng thái | Credential UNCLAIMED/CLAIMED tách enrollment IMPORTED/ACTIVATED/READY/ACTIVE/WITHDRAWN/DISQUALIFIED |
| Retention | 90 ngày cho dữ liệu giải; Bot/source/memory/log theo TTL module riêng; archive account chỉ khi không còn tham chiếu cần thiết |

| person_key / username | Xử lí |
|---|---|
| Người chưa có, username khả dụng | Tạo identity chưa claim và enrollment; cấp mã kích hoạt |
| Người chưa có, username đã dùng | Lỗi dòng chung; không nêu chủ username |
| Người đã có, username khớp | Link enrollment; giữ credential, không tạo mã reset |
| Người đã có, username nhập khác | Giữ username/credential cũ; báo account đã tồn tại và giá trị nhập bị bỏ qua, không lộ giải khác |
| Trùng key/username trong cùng tệp | Báo lỗi để sửa/loại dòng; không nhân đôi tài khoản |
| Account ARCHIVED xuất hiện lại | Khôi phục account theo quyền/retention; không dựng lại trận đã xóa |
| USER ngoài không có person_key | Không tự gộp với tournament identity |

### 7.6 I6 — Bot và compatibility

SECURITY và COMPATIBILITY đều MUST trước ghép trận Bot. Receipt gồm owner, source digest, ruleset/config/schema/SDK/runtime/policy versions; không tin file_hash/client checkbox riêng lẻ. Security chỉ tái dùng khi provenance/policy/runtime phù hợp; source không đổi nhưng luật đổi vẫn cần compatibility đúng version.

Bot pool có UPLOADED/TESTING/QUALIFIED/REJECTED/STALE. Hạ tầng bận/lỗi không trở thành author fault hoặc xử thua. Bot mới/đổi phải kiểm; đổi luật không hủy trận đã tạo. Cho thí sinh retry/chọn Bot khác; không ghép mới khi chưa có receipt đạt. Human-only không yêu cầu nộp Bot.

Runtime phải enforce thật per-turn/total compute/memory/output/source caps và isolated execution; không chạy native Python không hạn chế. Trả worker sau gameplay, không giữ compute trong thời gian chờ TA phân xử. Giới hạn sandbox phải do SA profile/contract cung cấp; không cho UI nhập thư viện/fuel mà consumer không hỗ trợ. Chuyển Bot giữa trận SHOULD, mặc định chưa bật nếu chưa có consumer verified.

## 8. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | TA chỉ thấy/thao tác giải trong scope. SA có quyền provisioning/duyệt/support, không tự thay TA chơi hoặc phán trận. |
| BR-02 | SA cấp TA theo contract; TA cấp staff trong giải. Expiry/revoke chỉ thu hồi grant tương ứng. |
| BR-03 | Server chặn ngày/quy mô/đơn vị/control/rules/resources vượt envelope; form báo cạnh trường. |
| BR-04 | Không lấy việc ẩn nút hoặc payload/URL làm phân quyền. |
| BR-05 | Quota dùng chung contract; draft trừ lượt, xóa draft/reject hoàn đúng một lần; từng approved hủy không hoàn. |
| BR-06 | Slot booking SHOULD chỉ được công bố thành công sau hold nguyên tử có expiry. |
| BR-07 | Sửa trường khóa tạo change_request riêng; giải/config đang hiệu lực không bị lùi trạng thái. |
| BR-08 | Không xóa cứng giải đã duyệt qua UI TA; archive/retention theo thẩm quyền. |
| BR-09 | Match count có thể NULL về nghiệp vụ; mọi trận vẫn có giới hạn clock/compute hữu hạn từ profile. |
| BR-10 | Ruleset immutable; mới chỉ áp cho match.created_at >= effective_at. Không đổi luật match đã tạo dù chưa start. |
| BR-11 | Validate cấu trúc, bounds, bố cục, trạng thái đầu chưa kết thúc, nước đi ban đầu và basic reachability; không chứng minh cân bằng/chiến thuật thắng. |
| BR-12 | config_version immutable; approval/publish pin đúng snapshot và expectedVersion. |
| BR-13 | Unit code phải tồn tại và trong scope; import không tạo đơn vị mới. |
| BR-14 | Import có job/progress/retry/idempotency và báo lỗi theo dòng; không commit nửa tệp ngầm. |
| BR-15 | Có bất kỳ giải RUNNING/PAUSED: chặn mọi new Online player admission của USER ngoài và Guest, cả queue/custom/upgrade role; không bypass bằng phòng trống cũ. |
| BR-16 | Mỗi match pin rules/config/SDK/runtime/controller/assignment và Bot source version khởi đầu. Upload/publish Bot mới không sửa snapshot cũ. Nếu bật chuyển Bot giữa trận đã được kiểm chứng, ghi sự kiện chuyển sang source version bất biến khác tại ranh giới hợp lệ; giữ luật trận, receipt, giới hạn lượt chuyển và replay đầy đủ. |
| BR-17 | Score floor 0; replay kết quả theo finish_sequence chuẩn, không thứ tự worker/TA trả lời. |
| BR-18 | Void/disqualify thuộc Vận hành: lưu lịch sử; replay score/Elo và publish projection nguyên tử; không vá delta tùy tiện. |
| BR-19 | State/rules/grants/moderation/exports đều có audit an toàn. |
| BR-20 | Dữ liệu giải TTL 90 ngày; identity nhiều giải không bị xóa vì một giải hết hạn; Bot TTL riêng. |
| BR-21 | N nguyên dương; default xem 10, trang 10; official export trên FINALIZED snapshot, không chỉ trang đang xem. |
| BR-22 | 4k–10k đồng thời auth-ready là mục tiêu chưa đo; match concurrency/worker capacity xác định riêng. |
| BR-23 | Nếu có scheduler, hold mọi slot cần thiết trong cửa sổ chơi nguyên tử; không có scheduler thì không hứa reservation. |
| BR-24 | PAUSED dừng admission, có lý do; không tự dừng/resume tất cả match hoặc xóa blocker khác; end_at vẫn hiệu lực. |
| BR-25 | Import không nhận plaintext password làm credential; activation hash/single-use; raw cleanup/staging TTL không log secret. |
| BR-26 | Staff invite accepted trước grant; grant hết hạn theo giải, không khóa identity còn quyền khác. |
| BR-27 | Điều lệ và rules_ack theo version; full policy kết quả cho actor được phép đọc, không chỉ HUD. |
| BR-28 | affects_system_rating phải trong contract/approval và có consumer verified; không mặc nhiên ghi Elo hệ thống. |
| BR-29 | Visibility/spectator/identity policy enforce trên payload; biết URL không cấp enrollment hoặc xem private data. |
| BR-30 | Top N là xuất người xuất sắc sau vòng từ BXH đầy đủ; không xuất password/activation/source. Tái nhập là enrollment workflow riêng. |
| BR-31 | Nhắc retention/xuất gói SHOULD; quyền xuất không vượt privacy/TTL của từng đối tượng. |
| BR-32 | Bootstrap SA một lần, race chỉ một người thành công; khóa đường bootstrap sau đó. |
| BR-33 | Identity tournament theo person_key; chuyển đơn vị/gộp người không tự động. |
| BR-34 | Username unique và lỗi chung; không lộ owner/tenant khác. |
| BR-35 | Import/tạo tay dùng cùng validator và bảng xử lí mục 7.5. |
| BR-36 | Account có sẵn giữ credential; import không cấp quyền reset hoặc xem hồ sơ/giải khác. |
| BR-37 | Đăng nhập/khôi phục phản hồi chung; có rate limit phù hợp. |
| BR-38 | USER ngoài không có unit/person_key, không tự gộp tài khoản tournament. |
| BR-39 | Khôi phục ARCHIVED identity không khôi phục dữ liệu trận đã hết TTL. |
| BR-40 | Account đã claim chỉ khôi phục qua SA verification và token cho owner; TA chỉ gửi yêu cầu, không nhận password. |
| BR-41 | Audit actor/role/entity/action/from/to/reason/result/server time; nguồn kết nối không tự là bằng chứng gian lận. |
| BR-42 | Audit append-only; không lưu credential/private source/log/memory. Anonymize mapping tách event khi có yêu cầu xóa hợp lệ. |

## 9. Mô hình dữ liệu khái niệm

| Thực thể | Trường/quan hệ cốt lõi |
|---|---|
| unit | unit_code unique, name, status |
| user / account | account_id immutable; username unique; person_key nullable; password_hash; credential_state; status; không trộn role toàn cục với grant giải |
| contract | unit, validity, caps, envelope, quota_used; chain/resource ledger DEFER |
| tournament_admin_binding | account_id, contract_id, grant/status/expiry; quota không đếm riêng trên binding |
| tournament | owner, contract, state, current_config_version, expected revision, end_at |
| stage | tournament_id; ARENA; order_index; format_config version |
| config_version / ruleset_version | immutable payload/schema/profile hashes; reason/effective_at/creator |
| approval_request / change_request | snapshot, notes, outcome, reviewer, version; state riêng |
| participant / enrollment | tournament_id+account_id unique; status/controller; khác credential state |
| tournament_staff / staff_invitation | role/scope, invited/accepted/revoked/expired; token purpose/hash/expiry |
| activation_token / recovery_token | purpose, target owner, hash, expiry, claimed/revoked, atomic one-use |
| support_request | actor/target/reason/status; verification reference ACL riêng; không raw secret |
| import_job / staged_row | tenant/tournament, file_hash, normalized rows, TTL, row outcome, idempotency; không raw file_ref |
| bot_file / compatibility_receipt | owner/source digest + rules/SDK/runtime/policy versions, outcome/job provenance |
| rules_ack | account/enrollment, regulations/rules version, server acked_at |
| slot_capacity / slot_hold | SHOULD; soft/hard/expiry, atomic multi-slot |
| match | created_at; pinned snapshots, participants/controllers/assignment/seed; gameplay state; result state tách biệt |
| adjudication_request | match unique, frozen criteria, actual first/second assignment, deadline/fallback, CAS revision/outcome |
| result_event / score_projection | gameplay_finished_at, finish_sequence, verdict, idempotency, projection_generation |
| audit_log | append-only actor/action/result/reason/time, sanitized data |

DDL/API cụ thể do một writer thống nhất trước dev; bảng khái niệm không chứng minh đã có schema hoặc migration chạy.

## 10. Kiến trúc và điểm nối

### 10.1 Module/ownership

Canonical rules nằm ở @ottv2/game-rules, payload ở @ottv2/contracts; server sở hữu quyền/clocks/result/quota. Các trang có backend riêng nhưng gọi một core service cho state/settlement. Web không chạy Python. Job/runtime phải giới hạn hàng đợi và có recovery/idempotency.

### 10.2 Engine, movement và đích

Luật giữ ba type R/P/S (Búa/Bao/Kéo; Lá là Bao), quan hệ R>S, S>P, P>R và luật quân chắn hiện hành. Profile theo type và side, cho bất đối xứng.

Builder baseline đề xuất RAY tám hướng có min/max/can_jump và LEAP offset tùy chọn hữu hạn, có thể hợp pattern. Bao đi ngang/dọc/chéo tối đa hai ô là một nước; jump cấu hình riêng. Kéo chéo, leap kiểu ngựa hoặc offset ngoài mẫu cờ vua đều biểu diễn được trong capability khai báo. Không nhận script; pattern ngoài engine capability báo unsupported. Chi tiết giới hạn cần duyệt ở mục 15.

Board_rows/cols mỗi chiều 5–15. Goal riêng mỗi bên: STATIC, CYCLE theo danh sách/vòng lặp, SEEDED theo tập ô; sau mỗi K vòng đầy đủ, một vòng = hai accepted plies từ đầu trận bất kể màu đi trước. Rejected move/pause không tăng round. Goal tới ô có quân không ăn/xóa/đẩy quân hoặc tự thắng; cần một nước hợp lệ vào goal hiệu lực để GOAL_REACHED.

Natural win hợp lệ phải có kết quả duy nhất; thứ tự clock/move/limit/goal tick và graph kiểm khả thi ở mục 15. Seed/policy được pin để replay; goal seed không tái dùng secret runtime.

### 10.3 Đổi luật và tạo trận

TA publish trong SA-approved envelope với reason/effective_at không backdate; ngoài envelope duyệt lại. Chọn luật và ghi match.created_at/config/assignment/seed/receipt phải cùng transaction authority. Match tạo trước hiệu lực nhưng start sau vẫn dùng luật cũ.

Giữ điểm/Elo hiện có, cộng tiếp kết quả; match lưu version và lịch sử thay đổi được hiển thị. Bot thiếu compatibility mới chưa được ghép trận, không xử thua hoặc trừ điểm; old match tiếp tục theo version đã pin.

### 10.4 Kết quả và phân xử thủ công

TA cấu hình kết quả theo sự kiện; mặc định không Hòa, vẫn bật DRAW cho tình huống cụ thể. Trọng số Búa/Bao/Kéo và thứ tự tiêu chí là cấu hình kết quả trận, khác điểm BXH. Sau tất cả tiêu chí bằng nhau, chọn FIRST_MOVER_WINS, SECOND_MOVER_WINS hoặc MANUAL_ADMIN. “Đi sau” dựa assignment thật, không mặc định màu Đỏ.

Full policy nằm trong điều lệ và bản luật trận cho người có quyền đọc; không cần hiện thường trực trên HUD. Manual chỉ mở cho exact tie, không cho thay natural winner. Popup dẫn tới đúng trận; có danh sách request bền vững khi bỏ lỡ popup.

Chốt gameplay snapshot và đóng clocks/compute trước request. TA owner chọn bên thắng+lý do; không sửa bàn/luật/chỉ số hoặc chiếm player slot. Timeout TA cấu hình, mặc định 300 giây; fallback chọn trước first/second mover, mặc định second mover. Server now>=deadline ưu tiên fallback. Manual/timeout/restart/cancel dùng CAS/idempotency, một verdict/result duy nhất; refresh không gia hạn.

Deadline phân xử là thời gian sau gameplay, không là đồng hồ thi đấu; chi tiết pause/cancel/ledger còn cần duyệt ở mục 15. Không official finalize/export khi còn pending/recompute. Thí sinh pending không ghép thêm; không chặn tất cả người khác vì một request.

### 10.5 BXH kiểu CTF và Top N — hợp đồng Vận hành

Hai bảng độc lập:
- Bảng Top N dẫn đầu: mặc định N=10, người quản trị chỉnh N ở thanh tìm kiếm/bộ lọc; mỗi trang 10 người.
- Bảng trận đang diễn ra: mỗi trang 10 trận, mặc định trận mới nhất trước; pagination riêng.

Sau vòng đấu, xuất đủ min(N, số thí sinh hợp lệ) trên snapshot BXH đầy đủ, không chỉ 10 người của trang hiện tại. Official từ FINALIZED; bản REVIEWING nếu cho xuất phải ghi chưa chốt. N đang xem không tự thay số suất đi tiếp đã quy định trong điều lệ.

Tệp kết quả có rank/score/identity được phép; không password/mã kích hoạt/source. Nếu cần đưa sang giải sau, dùng mẫu enrollment theo person_key; không ràng buộc phải xuất credential hoặc sửa mật khẩu cũ.

### 10.6 Nhất quán và khả năng phục hồi

Quota/refund, multi-slot holds nếu có, duplicate import/claim, version publish, match create và manual settlement đều phải có transaction/CAS/idempotency tương ứng. Job retry không nhân đôi account/enrollment/result. Crash/restart dùng trạng thái bền vững, không duy nhất trong memory một web process.

Canonical ordering của result, floor 0 và Elo cần replay contract rõ tại mục 15. Lỗi hạ tầng trả pending/blocked/retry; không giả thành lỗi Bot/người chơi. Admission check tại queue lẫn create/custom join/player-upgrade, không chỉ ẩn nút.

## 11. Ràng buộc kiến trúc

| Ràng buộc | Mục đích |
|---|---|
| Contract envelope | Chặn vượt cam kết bằng server validation và approval snapshots |
| Immutable config/rules | Match/replay/SDK giải thích cùng dữ liệu, không áp ngược |
| Identity tách grant/enrollment | Không để hợp đồng hết hạn hoặc import chéo chiếm account |
| Isolated runtime | Không cho Python người chơi chạy trong app hoặc native subprocess unrestricted |
| Async bounded jobs | Import/preflight/export không làm cạn tài nguyên web |
| Server authority | UI không tự tạo state/result/clock hoặc quyền |
| Safe audit | Truy vết được nhưng không phát tán secret/PII/private Bot |
| Profile expansion | Giải tùy biến không thay canonical OTT/Robot Lab ngoài scope |

## 12. Bảo mật và retention

Mọi API kiểm actor/scope và ownership. Public snapshot/SSE/spectator/Referee/replay/download/audit không chứa source, private memory/log/diagnostics hoặc activation/reset token. Admin Offline chỉ dùng Bot mình có quyền hoặc mẫu hệ thống, không mặc nhiên xem source thí sinh.

Upload kiểm extension/MIME/content, bounds, archive expansion, công thức/external links; không evaluate spreadsheet script/formula. Hash không thay TTL/ACL. Staging phải đủ cho worker retry sau raw cleanup, không giữ upload chứa credential qua file_ref/backup vô hạn.

90 ngày là số ngày thực cho dữ liệu giải, không “ba tháng” lịch. Mỗi giải hết TTL xử lí riêng; không xóa account/PII còn cần cho giải khác. Archive identity giữ tối thiểu theo chính sách; restore không dựng match đã xóa. Bot source/log/memory theo TTL module riêng, không kéo dài thành 90 ngày. Audit append-only và identity mapping riêng; không ghi credential để rồi mong xóa log.

Dữ liệu test dùng tổng hợp. Không mặc nhiên mutate DATABASE_URL mặc định; DB test disposable phải được định danh trước. Không push/deploy/billing/migrate DB dùng chung nếu chưa được cho phép.

## 13. Rủi ro và nghiệm chứng

| Rủi ro | Cách xử lí |
|---|---|
| Luật mới vượt engine/SDK/render/runtime hiện hành | Golden fixtures và cross-consumer equality; kiểm cả Người–Python Bot và Bot–Bot bằng runtime thật |
| Không đủ giờ | Giữ MUST, cập nhật forecast, không giả DONE/cắt security để vừa lịch |
| Sai cấu hình/cân bằng | Chặn cấu trúc/initial terminal/no moves/reachability sai; công bố giới hạn không chứng minh fairness |
| Admin biết mã kích hoạt chưa claim | Mã một lần, TTL/revoke; không dùng lại để reset account đã claim; kênh xác minh độc lập SHOULD |
| Race quota/import/claim/manual | DB uniqueness/transaction/CAS/idempotency và fault/concurrency harness |
| Result đến trễ làm sai floor 0/Elo | Canonical finish order và atomic projection/replay; không apply theo worker completion |
| Cấu hình yếu/10k chưa đo | Admission/queues/caps/pagination, báo NOT MEASURED; không hứa capacity chưa chứng minh |
| Còn mặc định chưa duyệt | Mục 15 là gate đầu vào, không tự suy ra chấp thuận từ lịch chia việc |

## 14. Thực hiện và bàn giao

Lịch và ownership tại [DELIVERY-PLAN.md](DELIVERY-PLAN.md); task riêng ở [DELIVERY-TASKS.csv](DELIVERY-TASKS.csv). Đợt mở 21/10 00:00; không giao việc 00:00–08:00; ca 08:00–12:00 và 13:00–17:00. Candidate V2 kết thúc 24/10 16:30; chỉ còn 0,5 giờ/người dự phòng trong ca, không còn nguyên ngày buffer.

Trình tự Plan → Harness → Dev → Test → Review → Clean Rubbish Code. Task mới chỉ code sau requirement gate; code/runtime/capacity là những bằng chứng riêng. Không tái dùng lịch sử B0–B14 để chứng nhận scope mới.

## 15. Mặc định/phạm vi bổ sung cần kiểm duyệt

Các mục dưới là **đề xuất chưa phê duyệt**, không phải policy đã có hiệu lực. Những giá trị được ghi tại form/acceptance phục vụ kiểm thử candidate, không tự đóng requirement gate. Không có lịch sử hỏi đáp trong phần này.

| Nhóm | Đề xuất có ngữ nghĩa cụ thể |
|---|---|
| Movement | RAY tám hướng + LEAP offset hữu hạn, union theo type+side; không script/multi-segment/promotion/đa capture. Cap 16 pattern/profile, 225 offset/profile; phải đo trước phát hành |
| Win/feasibility | EXTINCTION và/hoặc GOAL_REACHED theo OR. Khi extinction bật cần cả ba type >0 ban đầu. Mỗi side có ít nhất một legal move ban đầu; mỗi candidate goal có đường trên graph bàn trống từ ít nhất một quân own đúng type/side. Không chứng minh chiến thuật thắng |
| Goal detail | STATIC và CYCLE index 0 không đặt dưới quân own ban đầu của bên cần tới đích; CYCLE index 0/wrap. SEEDED lọc các ô như vậy trước initial sampling, tập hợp lệ rỗng bị chặn; được lặp/tập một ô nếu hợp lệ. Runtime goal chung/đang có quân không auto-win. Versioned PRNG, stream side/purpose độc lập; goal schedule/seed hiển thị, runtime secret seed riêng |
| Comparator | Lexicographic WEIGHTED_MATERIAL → GOAL_DISTANCE nếu có → MOBILITY; weights chung hai bên, 0..1000/tối đa 3 số lẻ, không đồng loạt 0; scaled integer. Distance là min movement steps graph bàn trống tới current goal; unreachable kém reachable. Mobility đếm unique from/to, không double pattern |
| Event policy | No legal move mặc định COMPARE_CRITERIA, có WIN/LOSS cho bên gặp event hoặc DRAW nếu bật. Global ply/compute limit dùng comparator; không gán “bên vi phạm” mơ hồ. Own-turn violation mặc định LOSS; infra neutral stop/abort không winner/points |
| Assignment/clock | First BLUE_FIRST/RED_FIRST/SEEDED, default BLUE_FIRST; side swap ALTERNATE_BY_PAIR, ordinal cấp nguyên tử khi create. Bank Human 60/180/300s default180, cap nước 10/30/60s default30 trong contract; không reset bank mỗi nước |
| Compute/priority | Profile Bot baseline: preflight250ms, turn500ms, total30.000ms mỗi bên/trận, 120 plies; source64KiB, memory payload8KiB/depth32, output16KiB; linear memory64MiB không là total RSS. Chỉ consumer-proven profiles. Invocation min(turn remaining,total remaining), hard stop/discard output chưa commit khi hết total, không cấp thêm để đủ round |
| Limit/event order | Finite ply limit chẵn theo accepted plies; Human có thể NULL nếu clock hữu hạn. Deadline>= reject trước commit; natural win đúng hạn ưu tiên, rồi ply-limit, rồi goal tick. Hard compute có thể dừng mid-round, dùng committed snapshot trước invocation; không charge queue/bootstrap/Human think/observation |
| HYBRID/switch | H–H/H–Bot/Bot–Bot, controller ghim trước match, không đổi Human↔Bot giữa trận; chung BXH có label. Bot switch SHOULD mặc định false đến khi consumer có evidence |
| Điều lệ/privacy | rules_ack_required defaulttrue; re-ack version trước trận mới, không chặn ngược old match. PRIVATE default; STAFF_ONLY cho PRIVATE, LOGGED_IN cho PUBLIC; identity NAME_UNIT_MASKED. Biết URL không có quyền xem |
| Contract counts/envelope | max_participants_total tính tổng enrollment qua các giải contract, cùng account hai giải tính hai suất. Envelope cụ thể gồm board5..15/RPS/movement families/goal/win/control/resource/date/unit caps, SA được thu hẹp |
| Cancel/pause | CANCEL chỉ từ trạng thái trước ENDED theo mục 5; giữ result đã settle, neutral-abort gameplay dở, đóng pending request không winner/official TopN. Cancel commit trước chặn late verdict; verdict commit trước không bị xóa. Manual deadline tiếp tục qua PAUSED/ENDED/restart, không tự kéo dài |
| Upload/token/support TTL | Reject mẫu cũ có password; raw xóa sau parse hoặc lỗi; staging24h. Upload10MiB, expanded50MiB,20.000 rows,batch200 là cap kỹ thuật cần đo, không trần sản phẩm. Activation24h/reset30phút, support rate10/account/day; support evidence TTL90ngày sau xử lí, ACL riêng |
| Score/Elo/pairing | Registry ELO_WEIGHTED_V1: multiplier=clamp(opponent_tournament_rating_before/1000,0.5,2); win=round_half_up(win_base*multiplier); loss=-round_half_up(loss_base/multiplier); draw=draw_base; defaults10/5/0; bases win/loss1..1000,draw0..1000; floor0 sau mỗi result. Elo baseline1000,K32,expected scale400; BLUE delta round-half-away-from-zero, RED=-BLUE; KEEP_SYSTEM hoặc compression0..1. affects_system_rating false. Band100,tăng50/30s đến SA max; rematch3/PER_DAY |
| Result order/TopN | gameplay end cấp gameplay_finished_at+finish_sequence đơn điệu, kể cả manual pending; ledger replay theo finish_sequence, không theo thời điểm verdict. pairing_rating_snapshot lúc create khác scoring_rating_before khi replay; late/void replay từ vị trí đầu ảnh hưởng, publish generation atomic. TopN score↓Elo↓wins↓earlier-reached↑participantId↑; lấy đúng N eligible, không tự thêm đồng hạng |
| Audit retention | Append-only không tự xóa cùng TTL90ngày; anonymize qua identity mapping; Bot TTL riêng; pháp lí/quy trình xóa identity cần rà soát theo môi trường thực, không tuyên bố compliance đã được chứng nhận |

## 16. Tiêu chí nghiệm thu và kiểm chứng

Checklist bên dưới dùng để review đặc tả và tạo harness. Mỗi mục phải có evidence riêng khi implementation được nghiệm thu. Đủ mô tả không đồng nghĩa code/runtime/capacity PASS; các mục lệ thuộc đề xuất chưa duyệt vẫn chưa đóng.

### Danh tính, quyền và điều hướng

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T001 | Bootstrap chưa có SA → tạo đúng1SA; hai bootstrap tranh nhau chỉ1thành công; sau đó public endpoint khóa | Auth concurrency; BR32 |
| T002 | SA tạo unit/contract/TA → dữ liệu thật có thể chọn trong form, public register không cấp ADMIN | API actors; I1/I2 |
| T003 | TA tạo và SA duyệt → đúng ma trận, SA không tự tạo giải, TA không tự duyệt bằng payload | Role negative matrix |
| T004 | TA-A gọi get/edit/import/export bằng ID của B → không thấy dữ liệu hoặc thay đổi B, không leak sự tồn tại/private fields | Tenant API matrix; BR01/04 |
| T005 | Admin vào Home/direct queue/join-player API → UI chỉ management+Offline và server từ chối chơi Online; management/observation vẫn đúng scope | Browser+API; user UI |
| T006 | Admin test Offline → có Kho Bot/Bot Offline/Người–Bot/Người–Người; reuse điểm nối phù hợp, không coi AI heuristic là Python Bot nếu mode cần Python | Real consumer browser; consumer Offline |
| T007 | TA mời/gán Referee → invite phải accepted trước có quyền, ít nhất1accepted trước READY; không ép để lưu DRAFT | Role/state tests; I2/F62 |
| T008 | Staff revoke/expire hoặc contract expire → thu hồi binding đúng scope, không khóa identity có quyền hợp lệ khác | Session/ACL tests; /BR02 |
| T009 | Host/SA/Ref/player sửa role hoặc gọi manual exact-tie endpoint → chỉ TA chủ giải được quyết định baseline; không acquired role từ URL | Privilege tests; /new scope |
| T010 | Public/Referee/observer/download đọc match → không source/private memory/logs/token; Admin không tự có quyền xem Bot thí sinh | Payload leak tests; AG privacy |

### Hợp đồng, quota và ràng buộc

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T011 | TA chọn contract → chỉ binding hợp lệ; outside-scope unit/dates/control/resources bị từ chối server | Contract fixtures; BR03 |
| T012 | Tạo DRAFT khi contract còn quota → giữ1lượt chung hợp đồng, không nhân quota theo số TA | DB transaction |
| T013 | Hai TA dùng lượt cuối/retry create → không vượt quota, idempotency không tạo2draft | Concurrent disposable DB; CN02 |
| T014 | Xóa DRAFT hoặc REJECTED/refund retry → hoàn đúng1lần, REJECTED terminal | State/DB |
| T015 | Copy REJECTED → nháp mới giữ lượt mới; cancel giải từng APPROVED không refund | Quota lifecycle |
| T016 | max_participants bị vượt bằng hai import/manual row → atomic check, không vượt cap của giải và tổng cap contract có semantics đã định nghĩa | Import concurrency; I1/I5 |
| T017 | TA phát hành movement/goal/resource ngoài envelope → chặn và change request; không sửa caps trong ruleset | Envelope diff tests |
| T018 | Hết contract trong khi identity có role khác → chỉ grant hợp đồng hết hạn, không reset account/password/other tenant | Cross-binding fixture; BR02 correction |
| T019 | Slot scheduler SHOULD có/không có → nếu có hold toàn bộ slots nguyên tử/expiry/release; nếu chưa có UI không hứa capacity booking | Feature-gated integration; BR06/23 |
| T020 | TA nhập tên/slug/scope sai hoặc ID owner giả → inline lỗi và server reject, owner/version IDs do server, ID stable qua đổi slug | Form/API fixtures; groups A-D |

### Vòng đời, duyệt và nhất quán

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T021 | Save thiếu field → DRAFT lưu tối thiểu hợp lệ; SUBMIT cần đủ S fields/structural validity, không ép roster/Ref accepted trước nháp | Stage validation; user workflow |
| T022 | SUBMIT/UNDER_REVIEW → APPROVED/REJECTED/CHANGES_REQUESTED đúng ba outcome và notes; ghi snapshot SA thực sự duyệt | State matrix; I4 |
| T023 | Hai người sửa cùng config → conflict version, không silent overwrite; retry không tạo publish trùng | Version race; CN03 |
| T024 | Approved sửa locked field → change_request riêng, config hiệu lực cũ giữ nguyên khi pending/rejected; không lùi RUNNING về UNDER_REVIEW | Change tests; nghiệp vụ corrected |
| T025 | APPROVED→ROSTER_OPEN→READY → kiểm roster, mode, Ref accepted, rules/runtime dependencies; worker/client không tự cấp READY | Readiness tests; I4/I6 |
| T026 | Đến start_at khi thiếu readiness → không tự chạy sai điều kiện, hiển thị blocker; late approval không sửa timestamp ngầm | Fake clock; lifecycle |
| T027 | RUNNING→PAUSED/resume → dừng admission mới, không clear blocker không liên quan; trạng thái trận/clock theo policy server riêng | Pause actor/race; AG/BR24 |
| T028 | PAUSED qua end_at → ENDED một lần, không resume terminal; gia hạn phải qua contract/config approval | Fake time; fix source lifecycle |
| T029 | CANCEL trước/đang chạy → state allowed list, xử lý match dở/result theo policy công bố, không hủy FINALIZED để viết lại điểm | Cancellation fixtures; lifecycle proposal |
| T030 | ENDED/AUTO_FINAL có pending adjudication → gameplay hết giờ nhưng chỉ FINALIZED khi settled; REVIEWING/ARCHIVED/retention không nuốt request | Settlement clock tests |

### Roster, kích hoạt và hỗ trợ

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T031 | Import CSV/XLSX/tạo tay → cùng validator; không tự đăng ký vào roster; mẫu mới không nhận plaintext password để tạo/reset | Format fixtures; I5/ |
| T032 | Preview unknown unit/duplicate/invalid/Unicode/ID leading zeros → đủ lỗi từng dòng, names/email trùng chỉ warning, không auto-create unit | Import normalization; BR13/34 |
| T033 | Same person_key existing → link đúng scope, không đổi username/password, không cấp reset token, không leak giải đã tham gia | Multi-tenant fixture; nghiệp vụ |
| T034 | Cùng tên khác key / chuyển đơn vị → không gộp nhầm; không hứa person_key chứng minh một người thật toàn hệ thống | Identity fixtures; nghiệp vụ boundary |
| T035 | Worker crash/retry/import lặp → không double account/enrollment, progress/error/retry khớp trạng thái thực; cancel không xóa batch đã commit ngầm | Fault injection; BR14/CN04 |
| T036 | Commit sau preview đã có thay đổi scope/quota → revalidate/reject conflict, không coi preview là quyền hoặc capacity reservation | TOCTOU integration; BR03/13 |
| T037 | Mã kích hoạt mới → chỉ hash/TTL/rate limit, BTC cấp được mã chưa claim theo rủi ro kênh phân phối; token không log/public export | Auth/security fixtures |
| T038 | Hai claim/reissue/expire → single-use atomic; token cũ revoked, account đã claim không bị TA phát lại mã reset | Fake time+concurrency |
| T039 | Owner mất credential đã claim → gửi request SA; verify ngoài hệ thống trước reset, không đưa mật khẩu cho TA; request result có audit | Recovery workflow |
| T040 | Raw/staging files/tệp độc hại → không eval formula/script/archive bomb, bounded parse/job data, xóa raw/TTL staging, no secret logs | Upload/security+TTL; BR25 corrected |

### Bàn, movement và engine

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T041 | Board rows/cols5..15 gồm ô hàng10..15 → parser/render/engine/SDK/replay không bị regex9x9; canonical game modes giữ behavior cũ | Coordinate corpus |
| T042 | R/P/S counts/layout → không overlap/outside/count mismatch, không tự thêm loại Bao/Lá khác P, không cấm bất đối xứng | Layout validation |
| T043 | Bao rays8 hướng max2, blocker/jump toggle → cùng legal set server/UI/SDK; một move, không ăn quân trung gian | Golden rule fixtures |
| T044 | Ngựa/custom leap offset/Kéo chéo/hợp pattern → đích đúng bounds, LEAP không có toggle tự mâu thuẫn, duplicate không tăng mobility | Engine corpus; latest movement |
| T045 | Profile theo type+side/relative direction → actual board coords không bị UI rotation thay luật; không ghi đè từng quân ngoài scope đã duyệt | Side/mirror fixtures |
| T046 | Friendly/same type/losing capture → giữ RPS blocking; movement mới không tự đổi capture matrix/ăn nhiều quân | Capture regression; source invariants |
| T047 | Movement payload zero/unbounded/deep/script → reject server trước eval, finite patterns/work, no arbitrary JS/Python config | Parser/property/security tests |
| T048 | EXTINCTION/GOAL_REACHED chọn/tắt → OR semantics/version rõ, type counts/init terminal check đúng theo điều kiện đã bật | Win-condition fixtures; F34 |
| T049 | BR11 validation/preview → structural/nonterminal/initial moves/basic reachability có output cụ thể, không claim fairness/strategy proof | Human+engine fixtures |
| T050 | Cùng snapshot/version ở browser/server/replay/Bot → cùng legal moves/result; mẫu custom path ngoài capability bị báo unsupported thay vì diễn giải ngầm | Cross-consumer equality |

### Goal, kết quả và phân xử cuối

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T051 | STATIC/CYCLE/SEEDED riêng mỗi bên → đúng initial goal/index, sequence/PRNG version+seed tái lập, danh sách nonempty/bounded | Goal fixtures |
| T052 | K rounds khi accepted/rejected/pause/restart/first-side khác → chỉ2accepted plies hoàn thành1round, cadence riêng side, không gắn round với currentTurn=BLUE | Determinism/restart |
| T053 | Goal chuyển lên quân/goal chung → không auto-win/capture/xóa quân; move vào goal hiện hành mới GOAL_REACHED | Occupied/shared goal fixtures |
| T054 | Last move natural win đồng thời limit/goal tick/deadline → unique priority, move muộn reject, terminal không bị tick/scorer ghi đè | Boundary race corpus |
| T055 | Event no legal move/maxplies/compute cap → đúng event policy; DRAW chỉ nếu bật, winner-relative event không dùng cho limit vô chủ | Event result fixtures |
| T056 | Material weights R/P/S + criterion order → finite exact arithmetic, cùng weight hai bên theo baseline, lexicographic, khác điểm/Elo giải | Comparator golden tests |
| T057 | Goal distance/mobility trên custom movement/goal/bounds → không dùng hardcoded9x9, unreachable có nghĩa, count legal move không double pattern | Scorer graph fixtures; mục 15 |
| T058 | All criteria equal → first/second mover policy đúng actual assignment hoặc tạo manual request; điều lệ đầy đủ chứa policy | First-side/visibility tests |
| T059 | MANUAL request → board/clocks/compute locked, popup+durable list, TA owner chọn BLUE/RED+reason, no player slot/other override, points pending | Browser/API/audit |
| T060 | Manual vs timeout/restart/end_at → one CAS verdict,300s default/configured timeout, fallback prechosen, no unbounded wait/double points | Fake-time concurrency |

### Bot, phiên bản và runner contract

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T061 | TA publish trong/ngoài envelope → reason/effective_at/version immutable/diff; ngoài envelope phải SA approve; old matches không đổi | Publish ACL/diff |
| T062 | Match tạo trước effective nhưng bắt đầu sau / cùng timestamp → version chọn nguyên tử theo create boundary; assignment/seed/config ghim cùng | Match create race |
| T063 | Source cũ luật mới → COMPATIBILITY receipt gắn owner/hash/rules/SDK/runtime/policy; source không đổi vẫn recheck khi cần | Receipt forgery/version tests |
| T064 | Bot pending/fail/infra busy → chưa ghép trận mới, giữ điểm, cho retry/select khác; old match giữ version/receipt cũ; infra không author loss | Mode/readiness matrix |
| T065 | HUMAN_ONLY/BOT_ONLY/HYBRID → controller được ghim mỗi player/match, manual không điều khiển Bot slot, readiness đúng loại, shared leaderboard labeled | Controller ACL; O10/source+profile proposal |
| T066 | SDK bot state custom rule → có dimensions/movement/goals/version/legalMoves/clock metadata cần thiết, không memory/source đối thủ | ABI contract+privacy tests |
| T067 | Runtime new-rule sample/security corpus → thật trong isolated runtime, pinned versions/limits; static pass/mock không READY, no native Python | Real sandbox evidence; AG/I6 |
| T068 | Turn/total compute/clock/queue/bootstrap/pause → caps enforce thật, wait/infra không phạt Bot; hard compute mỗi bên stop ngay khi hết budget, có thể mid-round; chỉ ply-limit chẵn chốt full-round theo actual first-side assignment | Supervisor+boundary evidence |
| T069 | Bot switch SHOULD bật/tắt → nếu bật phải enforce limits/own-turn safe boundary/matchversion; nếu chưa làm không ship toggle giả có tác dụng | Feature/actor fixtures; nghiệp vụ/BR16 conflict |
| T070 | Rule change while RUNNING → scoreboard giữ điểm/Elo, pending/replay pin old versions; regulations re-ack gate theo policy trước new match | Integration fixture |

### Form, dữ liệu và nghiệm thu tích hợp

| ID | Scenario/action → kết quả và điều cấm | Verification dự kiến / nguồn |
|---|---|---|
| T071 | TA điền field có điều kiện rồi đổi mode → hidden values trở thành not-applicable/default rõ; không NULL vì SHOULD hoặc giữ flag nguy hiểm | Conditional form/API tests; source mandatory fields |
| T072 | Scoring/Elo/pairing config → preset có schema/version/caps; score floor0; rating system chỉ ảnh hưởng khi affects_system_rating được duyệt true | Contract validation; groups G/H |
| T073 | Live TopN/current matches/export → default10/page10 independent newest-first; export đủN từ final snapshot, không password/activation/source | Runtime handoff/export AC; mục 10.5 |
| T074 | Private/Public/Unlisted + spectator/display → visibility không là enrollment grant; public payload chỉ identity policy, luật đầy đủ không bí mật | Privacy/view matrix; BR27/29 |
| T075 | Có giải RUNNING/PAUSED nhiều giải → outside USER không vào queue mới, không hủy created match/Offline; nhả khi hết tất cả active blockers | Admission multi-tournament |
| T076 |90days retention nhiều giải/ARCHIVED/reimport → xóa đúng data hết hạn, account tối thiểu hồi phục không dựng lại match đã xóa, không xóa other tournament | Fake-time multi-reference |
| T077 | Audit/PII/secret TTL → append-only actor/action/state/reason/result; ẩn danh qua identity mapping, không sửa log; TTL Bot không thành90days | Audit permissions+TTL fixtures |
| T078 | Target4k–10k auth-ready weak host → phân biệt account/connections/matches/workers, server pagination/bounded jobs/overload;10k NOT MEASURED nếu chưa đo | Architecture+measured gates riêng |
| T079 | Form keyboard/mobile/light-dark/reduced motion/loading/error/conflict/permission → thao tác được và có recovery, state do server không UI invent | Browser/a11y/manual evidence; AG |
| T080 | Bàn giao/init vs runtime → liệt kê implemented/NOT RUN/BLOCKED, source changes preserved, không reuse lịch sử Bot/B0-B14 làm bằng chứng scope mới, no push/deploy/shared migration | Candidate evidence review; AG |
| T081 | Manual/timeout/void làm result đến muộn → finish_sequence theo gameplay end, replay floor0/Elo canonical order, pairing snapshot bất biến, projection generation atomic; không worker completion order | Delayed-result/replay ledger; reviewer nghiệp vụ gap |


Các kết quả bắt buộc ghi PASS/FAIL/NOT RUN/BLOCKED với command, môi trường và bằng chứng. Chỉ mutate disposable test DB đã định danh. Review độc lập phải dùng đúng snapshot hiện hành; không kế thừa coverage của bản lưu trữ.
