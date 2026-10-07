# Đề xuất triển khai OTT Robot Lab tại UET VNU

**Đề xuất nền tảng học lập trình, giải trí và tổ chức giải đấu sinh viên**  
Ngày: 06/10/2026 · Phiên bản: 1.0  
Đơn vị tiếp nhận dự kiến: Trường Đại học Công nghệ, Đại học Quốc gia Hà Nội  
Người đề xuất: .......................................................  
Mã sinh viên, khoa và lớp: ...........................................

Đề nghị nhà trường cho phép thí điểm OTT Robot Lab trên hạ tầng sẵn có để kết hợp học Python, giải trí chiến thuật và tổ chức giải đấu toàn trường. Hai nội dung Đấu chương trình và Chơi trực tiếp được tổ chức song song, ưu tiên nội dung lập trình cho sinh viên năm nhất. Phạm vi đề nghị lần này là chủ trương pilot, đầu mối phối hợp và khảo sát tài nguyên; chưa đề nghị mua máy chủ hoặc ngân sách thương mại.

## 1. Đề nghị nhà trường

```text
Nhà trường cấp hạ tầng sẵn có + đầu mối IT + đơn vị tổ chức
                              ↓
OTT Robot Lab: học Python → thử chiến thuật → thi đấu → phân tích kết quả
                              ↓
Giải toàn trường: Đấu chương trình và Chơi trực tiếp tổ chức song song
                              ↓
Đánh giá hiệu quả → vận hành định kỳ → chuyển giao cho trường khác
```

| Đề nghị | Phạm vi |
|---|---|
| Cho phép triển khai thí điểm | Mở đăng ký toàn trường; ưu tiên hoạt động học tập cho sinh viên năm nhất |
| Cấp tài nguyên | VM/máy chủ hiện có, tên miền phụ, kết nối mạng, nơi lưu backup |
| Cử đầu mối | Giảng viên phụ trách chuyên môn; IT phụ trách hạ tầng; BTC phụ trách giải |
| Tổ chức giải đầu tiên | Hai nội dung song song; ưu tiên truyền thông, workshop và giải thưởng cho lập trình |
| Đánh giá trước mở rộng | Chỉ công bố mức phục vụ sau nghiệm thu tải và diễn tập sự cố |

- Mục tiêu phục vụ **10.000 người online**, thi đấu theo ca **500–1.000 người**; người còn lại ở sảnh hoặc xem kết quả.
- Đây là mục tiêu thiết kế, không phải số liệu hệ thống hiện tại đã chứng minh. Quy mô dân số sinh viên thực tế do trường xác nhận.
- Tận dụng tài nguyên sẵn có; tăng cấp tài nguyên trong đợt giải rồi giảm sau giải. Không đề xuất mua máy chủ ngay khi chưa khảo sát.
- Phạm vi xin chủ trương: khảo sát và pilot trên hạ tầng trường; dự toán lập sau khảo sát IT. Gói thương mại là hướng phát triển tiếp theo, không phải đề nghị mua sắm trong đợt này.
- Mở đăng ký toàn trường; xác nhận lịch thi theo năng lực đã kiểm tải. Nếu vượt năng lực một ca, BTC thêm ca và thông báo lịch thay vì tự nhận toàn bộ vào thi đồng thời.

## 2. Giá trị học tập và giải trí

```text
Workshop nhập môn → Bot mẫu → Tự viết file .py → Thử nghiệm → Thi đấu
                                                           ↓
                              Replay + giải thích chiến thuật + phản hồi giảng viên
```

| Đối tượng | Giá trị | Đầu ra đánh giá |
|---|---|---|
| Sinh viên năm nhất | Luyện Python, cấu trúc dữ liệu, lựa chọn thuật toán, kiểm thử và quản lý giới hạn tính toán | Bot hợp lệ và báo cáo chiến thuật ngắn |
| Đội 2–3 sinh viên | Phân công, trao đổi, cải tiến qua nhiều phiên bản | Bài làm nhóm, nhật ký phiên bản và giải thích đóng góp |
| Sinh viên chơi trực tiếp | Giải trí, tư duy chiến thuật và giao lưu | Tham gia giải công bằng, kết quả rõ ràng |
| Giảng viên | Quan sát cách sinh viên vận dụng kiến thức | Bài làm, replay và phần giải thích; không chỉ dùng thắng/thua làm điểm học tập |

- Hai bảng thi đấu tách kết quả và giải thưởng: **Đấu chương trình** theo đội; **Chơi trực tiếp** theo cá nhân.
- Workshop cung cấp bot mẫu, hướng dẫn giao tiếp và bài tập tăng dần; sinh viên mới không phải tự xây môi trường chạy.
- Cho phép dùng AI hỗ trợ viết bot; đội khai báo công cụ, phạm vi hỗ trợ và nguồn tham khảo, đồng thời phải giải thích được code và chiến thuật của mình. Dùng AI không miễn trách nhiệm về bài nộp hoặc cho phép sao chép bài của đội khác.
- Giải thưởng dựa trên kết quả thi đấu; đánh giá học tập tách riêng theo thuật toán, kiểm thử, giải thích và đóng góp nhóm. Trọng số do giảng viên duyệt trước giải; không tự quy đổi thành điểm học phần.
- Chính sách trích dẫn nguồn và quyền sở hữu bài làm được công bố trước khi mở đăng ký.

## 3. Xử lý file Python sinh viên nộp

```text
Đội tải file .py
       ↓
Kiểm tra dung lượng / cú pháp / giao tiếp / thư viện được phép
       ↓
Chạy thử hai phe trong sandbox có hạn mức
       ├── Không đạt → trả lỗi riêng cho đội → sửa và nộp lại trước hạn
       ↓ Đạt
Lưu revision + hash nguồn → đội chọn bản thi chính thức
       ↓
Khóa revision → BTC xếp lịch → sandbox nhận state công khai + memory riêng
       ↓
Bot trả nước đi → server kiểm tra luật → commit → lưu replay/kết quả
       ↓
Giảng viên được phân quyền xem bài; đối thủ/khán giả không xem source hoặc log riêng
```

| Bước | Cách xử lý | Hiện trạng / phần bổ sung |
|---|---|---|
| Nộp bài | File `.py` theo SDK; hàm `choose_move(state, memory)` trả nước đi và bộ nhớ tiếp theo | Có nền tảng upload/revision và kiểm tra giao tiếp |
| Kiểm tra | Kiểm tra tĩnh không đủ để được thi; chạy thử sandbox cho cả hai phe và kiểm nước hợp lệ | Có preflight runtime; phải nghiệm thu trên máy trường |
| Online | Python được thực thi bằng CPython-WASI trong Wasmtime; ứng dụng giám sát và kiểm kết quả | Có adapter runtime; không chạy file sinh viên bằng Python native không hạn chế |
| Giới hạn quyền | Chỉ cấp state công khai và memory riêng; không cấp mạng, secret hoặc thư mục ứng dụng; runtime chỉ được thấy tài nguyên hệ thống tối thiểu cần cho interpreter | Có giới hạn sandbox; tiếp tục vá runtime và kiểm thử đối kháng |
| Giới hạn tài nguyên | Có trần CPU/thời gian, bộ nhớ, source và output; cùng preset cho hai bên | Có hạn mức; cấu hình giải được đóng băng và công bố trước |
| Khóa bài thi | Giữ nguyên revision từ Ready đến hết trận; sửa giữa các trận chỉ trong cửa sổ BTC cho phép | Cần bổ sung chính sách giải; chế độ thường hiện cho cập nhật giữa trận |
| Chạy theo lịch | Đội nộp trước hạn, không cần luôn online; BTC theo dõi và trọng tài điều hành | Cần bổ sung scheduler, quyền chạy và hàng đợi bền vững |
| Chấm/khiếu nại | Giảng viên được cấp quyền xem source theo đồng ý của đội; ghi nhật ký truy cập | Cần bổ sung quyền học thuật; role trọng tài hiện không mặc định được xem source |
| Offline luyện tập | Runtime trong Worker trình duyệt; cần tải/cache trước | Có nền tảng; không dùng kết quả do trình duyệt tự báo làm kết quả giải chính thức |

- Hạn mức source hiện tại là 64 KiB; memory trạng thái bot 8 KiB và ngân sách mỗi lượt 500 ms. Đây là cấu hình nguồn hiện tại; phải kiểm chứng và chốt trước giải. Memory trạng thái không đồng nghĩa toàn bộ RAM interpreter.
- File hợp lệ không được tự cài package hoặc dùng tùy ý thư viện native. BTC cung cấp danh sách thư viện và bot mẫu thống nhất.
- Code lỗi, nước sai hoặc vượt hạn mức: áp dụng điều lệ đã công bố, trả thông tin riêng đủ sửa lỗi. Lỗi hạ tầng: dừng/khôi phục hoặc tổ chức lại theo quyết định trọng tài; không gán thua tự động cho đội vô tội.
- Lưu hash, revision, preset và seed để truy vết. Replay mô tả nước đã commit; không công khai source/memory/log.
- Kiểm tra trùng code chỉ tạo dấu hiệu cần xem xét; giảng viên đối chiếu nguồn, giải thích của đội và bằng chứng trước quyết định.
- Bài `.py` chính thức và revision phục vụ đối chiếu được giữ riêng tư 90 ngày sau giải; bài đang khiếu nại được gia hạn đến khi giải quyết và hết thời hạn khiếu nại liên quan. Sau đó xóa theo chính sách thông báo trước, bao gồm lịch hết hạn bản backup. Thư viện cá nhân là dữ liệu riêng, không tự bị xóa cùng hồ sơ giải.
- Cần bổ sung lưu trữ hồ sơ giải và cơ chế giữ bài đang khiếu nại; không dùng chính sách dọn source trận tạm hiện tại để bảo đảm thời hạn 90 ngày. Quy định log, replay và dữ liệu đăng ký được công bố riêng; không mặc định giữ mọi log 90 ngày.

## 4. Tổ chức giải toàn trường

```text
Chuẩn bị 2–3 tuần
  → Đăng ký / workshop / nộp bài / chạy thử
  → Vòng loại theo ca, ghép người có cùng mức điểm
  → Top 32 mỗi bảng
  → Loại trực tiếp: 32 → 16 → 8 → 4 → 2 → vô địch
  → Chung kết trực tiếp trong một ngày + trao giải + tổng kết học tập
```

| Giai đoạn | Đấu chương trình — ưu tiên | Chơi trực tiếp |
|---|---|---|
| Đăng ký | Đội 2–3 người, danh sách thành viên, người nộp bài, đồng ý quy chế source | Cá nhân, danh tính sinh viên xác minh |
| Chuẩn bị | Workshop Python, SDK/bot mẫu, chạy thử; BTC kiểm bài trước hạn; khai báo AI/nguồn tham khảo | Hướng dẫn luật, luyện tập và thử kết nối |
| Vòng loại | Đề xuất 5–7 vòng Swiss tùy số đội: ghép theo điểm, hạn chế gặp lại; mỗi cặp hai ván đổi phe | Tích điểm theo nhiều vòng; lịch chia ca |
| Chọn Top 32 | Điểm cặp đấu → tiêu chí phụ công bố trước; nếu vẫn bằng ở ranh giới đi tiếp thì play-off | Điểm và tiêu chí phụ; play-off nếu cần |
| Loại trực tiếp | Hai ván đổi phe; bằng điểm thì thêm tối đa một cặp đổi phe. Vẫn bằng: đội có thứ hạng vòng loại cao hơn đi tiếp | Loạt ván có số ván/quy tắc hòa được chốt trước |
| Chung kết | Đội có mặt, trình bày chiến thuật ngắn; trọng tài kiểm revision và điều hành | Người chơi có mặt; trọng tài và bàn hỗ trợ |
| Tổng kết | Công bố kết quả; chia sẻ bài tự nguyện; nhận xét học tập | Công bố kết quả và ghi nhận tham gia |

- Swiss nghĩa là mỗi đội đấu nhiều vòng với đối thủ có điểm tương đương, không bị loại ngay sau một thất bại. Số vòng và số suất đi tiếp điều chỉnh theo số đăng ký.
- Giới hạn 500–1.000 người/ca là tổng người trực tiếp tham gia hai bảng, chưa phải số sandbox chạy đồng thời. Đội Bot có thể được xếp chạy theo lô nhỏ hơn trong cùng ca.
- Ví dụ kế hoạch toàn trường: 6.000 sinh viên ở 2.000 đội Bot và 4.000 cá nhân trực tiếp. Đây là ví dụ phân bổ, không phải số đăng ký dự báo. Với 7 vòng, Bot cần khoảng 14.000 ván nếu mỗi cặp hai ván; trực tiếp cần khoảng 14.000 lượt ghép trước vòng cuối.
- Thời lượng được tính từ benchmark: số ván × thời gian trung bình ÷ số trận chạy đồng thời, cộng dự phòng và thời gian xử lý. Không hứa hoàn thành vòng loại một ngày khi chưa đo.
- Luật Bot một ván hiện có phân định khi chạm trần; quy tắc ưu tiên Đỏ khi mọi tiêu chí bằng nhau phải công bố. Đổi phe trong cặp đấu giảm ảnh hưởng ưu tiên phe nhưng vẫn cần kiểm cân bằng.
- Quy tắc ưu tiên thứ hạng vòng loại khi cặp Bot vẫn bằng điểm được công bố trước giải và áp dụng cả chung kết. Đây là quy tắc phân định suất đi tiếp/chức vô địch, không phải bằng chứng bot của đội đó mạnh hơn trong cặp đấu. BTC phải chốt bảng thứ hạng vòng loại duy nhất trước bốc nhánh; không sửa thứ hạng sau khi biết kết quả loại trực tiếp.
- Proposal chốt nguyên tắc tổ chức; phụ lục điều lệ do BTC/giảng viên duyệt trước giải quy định điểm vòng loại, tiêu chí phụ, xử lý hòa Chơi trực tiếp, vắng mặt, sự cố và thời hạn khiếu nại.
- Giải dùng tài khoản xác minh; Guest phục vụ trải nghiệm/luyện tập. Mã sinh viên không công khai trên leaderboard.
- Đăng ký, luyện tập và vòng loại truy cập qua Internet; chung kết tổ chức tại trường. Bot vòng loại chạy trên server theo lịch BTC, không phụ thuộc máy đội luôn online; Chơi trực tiếp yêu cầu cá nhân có mặt online đúng ca.

## 5. Nền tảng tại trường và quy mô phục vụ

```text
Sinh viên: LAN/Wi-Fi trường hoặc Internet
                 ↓
Tên miền + HTTPS + reverse proxy / static cache
                 ↓
Sảnh / kết quả              API + SSE: phòng, trận, trọng tài
                                  ↓
                      PostgreSQL + checkpoint + backup kín
                                  ↓
                    [Bổ sung] Scheduler → sandbox workers có hạn mức
```

| Mức | Tài nguyên đề xuất để khảo sát/cấp thử | Mục đích và điều kiện |
|---|---|---|
| Thử nghiệm | 1 VM 4 vCPU / 8 GiB RAM; SSD 100 GiB; nơi backup riêng | Workshop và diễn tập nhỏ; chưa cam kết tải toàn trường |
| Giải theo ca | App/proxy 8 vCPU / 16 GiB; DB 4 vCPU / 8–16 GiB; runner 8–16 vCPU / 16–32 GiB; SSD app/DB 200 GiB và backup riêng | Mốc cấp thử để benchmark; tối ưu ca trước khi tăng tài nguyên |
| Mục tiêu 10.000 online | App/proxy 8–16 vCPU / 16–32 GiB; DB 4–8 vCPU / 16 GiB; runner pool 16–32 vCPU / 32–64 GiB tổng | Cần nâng cấp điều phối/state trước mở rộng, rồi nghiệm thu; không bảo đảm đạt chỉ bằng cấu hình |

- Các mức là tài nguyên VM **đề xuất ban đầu**, không phải báo giá hoặc số người phục vụ đã đo. IT trường khảo sát tài nguyên trống và lựa chọn mức phù hợp.
- CPU tính theo quota được cấp và hiệu năng core thực tế; shared vCPU không tương đương core riêng. Runner pool tách workload khỏi API nhưng cần phát triển cơ chế điều phối trước khi vận hành.
- Ưu tiên mạng nội bộ 1 Gbps, đo tải Wi-Fi và uplink thực tế. Vì vòng loại mở qua Internet, IT phải kiểm băng thông, firewall/NAT, HTTPS, hạn mức truy cập và kịch bản mất kết nối từ ngoài trường trước mở giải. Khu quản trị, DB và runner không công khai trực tiếp.
- Phục vụ static từ proxy/cache; giảm phát danh sách phòng toàn sảnh; chỉ người trong trận nhận luồng trận. Khán giả số đông xem kết quả/replay hoặc buổi phát sóng, không cùng subscribe mọi phòng.
- SSE hiện dùng nhiều luồng theo tính năng. Cần quản lý số kết nối, timeout, backpressure và reconnect có giãn nhịp; proxy SSE phải cấu hình buffering phù hợp.
- Nhiều room/match/queue đang giữ state trong từng process: không thêm replica tùy ý. Cần xác định chủ sở hữu phòng và đồng bộ/khôi phục state trước scale ngang.
- Bot runtime hiện giới hạn một invocation được admission trong phạm vi adapter; chưa có scheduler giải phân tán. Tăng CPU/RAM một mình không mở được hàng trăm suất tính.
- 10.000 trình duyệt không đồng nghĩa 10.000 kết nối DB; dùng pool có hạn mức và kiểm tải DB thực.

## 6. Nghiệm thu và vận hành

```text
Benchmark trên hạ tầng trường
  → Diễn tập tải / mất mạng / restart / khôi phục
  → Chốt giới hạn ca + suất Bot + lịch dự phòng
  → Đóng băng bản phát hành
  → Tổ chức giải và giám sát
```

| Vai trò | Trách nhiệm |
|---|---|
| Giảng viên phụ trách | Điều lệ, bài học, rubric, quyền xem bài và giải quyết vấn đề học thuật |
| BTC | Đăng ký, lịch/ghép vòng, điểm, thông báo và tiếp nhận khiếu nại |
| IT trường | VM, mạng, HTTPS, quyền truy cập, giám sát, backup và khôi phục |
| Đội phát triển | Cài đặt, kiểm tải, sửa lỗi, tài liệu vận hành và hỗ trợ đợt giải |
| Trọng tài | Kiểm người/bài, bắt đầu/dừng/tiếp tục trận và lập biên bản; không tự sửa kết quả/nước đi |

- Nhân sự đề xuất cho giải đầu: 1 giảng viên đầu mối, 1 IT trực, 1–2 người kỹ thuật ứng dụng, 2–4 BTC; số trọng tài tăng theo lô trận cần giám sát. Không giả định một trọng tài có thể giám sát hàng trăm trận trực tiếp.
- Kiểm tải tăng dần: sảnh đến 10.000 người; gameplay đến giới hạn ca; Bot preflight và lượt tính đo riêng; thêm spectator fan-out và reconnect đồng loạt. Test dài ít nhất bằng một ca giải thực tế.
- Mục tiêu nghiệm thu đề xuất: thao tác gameplay p95 ≤ 300 ms trên LAN, lỗi ngoài chủ đích < 1%, state hội tụ sau reconnect và không commit trùng. Đo hàng đợi Bot riêng; thời gian chờ hạ tầng không tính là lỗi tính toán của đội.
- Diễn tập dừng/tiếp tục, runtime lỗi, đầy suất, DB gián đoạn và phục hồi backup trước giải. Kết quả đo quyết định quy mô, không điều chỉnh ngưỡng chỉ để báo PASS.
- Trước giải: backup có hash và restore thành công; khóa release/preset/điều lệ. Trong giải: giám sát CPU/RAM, event-loop, số SSE, lỗi API, DB, runtime và queue.
- Khi sự cố: trọng tài dừng theo quyền, BTC thông báo phạm vi ảnh hưởng, IT phục hồi; checkpoint/replay là bằng chứng. Lưu quy tắc xử lý dữ liệu phát sinh sau backup; không hứa khôi phục không mất dữ liệu khi chưa kiểm chứng.

## 7. Phạm vi hiện có và cần hoàn thiện cho giải

| Hiện có trong source | Cần bổ sung/kiểm chứng trước giải toàn trường |
|---|---|
| Chơi trực tiếp, Offline, Bot, thư viện revision | Nghiệm thu bản release và runtime trên hạ tầng trường |
| Custom room, trọng tài, khán giả, pause/resume | Tournament admin: đội, đăng ký, lịch, Swiss/bracket, leaderboard |
| Server kiểm luật; checkpoint, replay và lịch sử | Scheduler Bot bền vững, quota công bằng, khóa revision thi |
| Phân quyền source/log riêng | Quyền giảng viên xem bài có consent và audit |
| Chính sách dữ liệu của chế độ thường | Hồ sơ bài thi giữ 90 ngày, giữ bài khiếu nại và dọn dữ liệu theo điều lệ |
| SSE và hạ tầng PostgreSQL | Benchmark 10.000 sảnh; backpressure, reconnect và kế hoạch scale state |

- Có thể thí điểm bằng bảng đấu/lịch do BTC quản lý ngoài hệ thống, dùng custom room hiện có.
- Quy mô toàn trường cần quản trị giải và điều phối bài tự động để giảm sai sót; proposal không coi các module đó đã có.
- Hệ thống hiện chưa có benchmark chứng minh 500–1.000 người thi đấu hoặc 10.000 online. Smoke tải hiện tại chỉ kiểm một người gọi health trong một giây.

## 8. Chi phí và hướng thương mại hóa

```text
Pilot UET → đo hiệu quả và chi phí mỗi giải → gói cài đặt riêng cho trường
                                                 ↓
                              Phiên bản công cộng → đo giữ chân → mở rộng
```

| Khoản | Phương án tiết kiệm |
|---|---|
| Hạ tầng | VM có sẵn; cấp runner thêm trong thời gian giải; chưa mua máy riêng |
| Phần mềm nền | Công cụ cộng đồng; kiểm giấy phép từng dependency/asset trước phân phối thương mại |
| Vận hành | Workshop/lịch chuẩn, runbook, giám sát và backup tự động; tính cả công IT, điện và hỗ trợ |
| Ngân sách giải | BTC quyết định truyền thông, giải thưởng, nhân sự; tách khỏi chi phí hosting |
| Dự toán | Lập sau IT xác nhận tài nguyên; so tổng chi phí năm và chi phí mỗi đợt giải, không chỉ tiền thuê máy |

| Hướng sản phẩm | Gói đề xuất |
|---|---|
| Bán cho trường | Giấy phép sử dụng + cài đặt riêng + đào tạo + hỗ trợ giải; dữ liệu từng trường tách biệt |
| Dịch vụ định kỳ | Phí triển khai ban đầu, bản quyền năm, bảo trì/nâng cấp và hỗ trợ sự kiện theo hợp đồng |
| Game công cộng | Bản dễ tiếp cận; kiểm chứng lượt quay lại, chất lượng ghép trận và cộng đồng trước mở rộng |
| Tài sản trí tuệ | Làm rõ quyền tác giả, asset/dependency và bài sinh viên; quyền dùng nội bộ không tự bao gồm quyền bán lại |

- Không cam kết doanh thu hay mức bùng nổ tương tự Flappy Bird. Lợi thế đề xuất là kết hợp trò chơi chiến thuật, học lập trình và công cụ tổ chức giải.
- Nhà trường sở hữu/quản lý dữ liệu sinh viên theo thỏa thuận; code sinh viên không tự được dùng đào tạo AI, quảng cáo hoặc bán kèm.
- Mô hình bản quyền và quyền khai thác của tác giả/nhà trường cần chốt trước ký chuyển giao.
- Trong proposal này chỉ đề xuất định hướng cấp phép cho trường khác; chưa đưa giá bán, tỷ lệ chia doanh thu hoặc cam kết chuyển quyền. Các nội dung đó thuộc thỏa thuận riêng sau pilot.

## 9. Lộ trình đề xuất

| Bước | Đầu ra |
|---|---|
| 1. Nhà trường tiếp nhận | Đầu mối giảng viên/IT/BTC; khảo sát hạ tầng, nguồn lực và quyền dữ liệu |
| 2. Chuẩn bị hệ thống | Release kiểm chứng; tính năng giải thiết yếu; benchmark và điều lệ |
| 3. Mở đăng ký toàn trường | Workshop, đội/cá nhân, nộp thử và lịch ca; chuẩn bị 2–3 tuần sau khi hệ thống sẵn sàng |
| 4. Tổ chức giải | Vòng loại theo ca; chung kết một ngày; nhật ký vận hành và khiếu nại |
| 5. Đánh giá | Tỷ lệ bài hợp lệ, mức cải tiến chiến thuật, phản hồi sinh viên, uptime đợt giải và tổng chi phí |
| 6. Phát triển sản phẩm | Gói chuyển giao trường khác và thử nghiệm game công cộng |

**Đề nghị phê duyệt:** cho phép khảo sát và triển khai thí điểm toàn trường trên hạ tầng sẵn có, cử đầu mối phối hợp, phê duyệt kế hoạch giải sau khi nghiệm thu kỹ thuật và điều lệ hoàn tất.

## Phụ lục — Căn cứ kỹ thuật

- Căn cứ source ngày 06/10/2026: `tests/load/smoke.js`; room/match/matchmaking managers và SSE routes; Bot Library service; Wasmtime adapter; Python runner; `docs/r3-bot-limit-manifest.json`. Rà source không thay thế kiểm thử production.
- [Wasmtime: sandbox và quyền WASI](https://docs.wasmtime.dev/security.html): căn cứ cho mô hình code không tin cậy; cần cấu hình quyền và cập nhật runtime đúng cách.
- [NGINX proxy buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering): căn cứ cấu hình proxy cho stream.
- [PostgreSQL connection limits](https://www.postgresql.org/docs/18/runtime-config-connection.html): số kết nối làm tăng tài nguyên cấp phát; cần giới hạn pool phù hợp.
- [k6: kiểm thử API theo workload](https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/): căn cứ đo capacity theo hành vi và tốc độ truy cập.
- Trọng số đánh giá học tập, điều lệ chi tiết, nguồn lực BTC và thỏa thuận quyền khai thác được hoàn thiện ở bước chuẩn bị pilot với nhà trường.
