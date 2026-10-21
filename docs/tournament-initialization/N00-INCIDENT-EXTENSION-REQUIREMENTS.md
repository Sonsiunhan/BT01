# N00 — Điều phối sự cố và xin gia hạn giải

21/10/2026, revision3. **Yêu cầu bổ sung đang phân tích — G0 HOLD.** Skill ECC intent-driven-development được dùng tiếp trong cùng cuộc trò chuyện. Đây là requirement supplement, không phải implementation plan hoặc tính năng đã triển khai.

**UPDATE ưu tiên:** Nam đã trả lời8nhóm sau revision3. Đọc [N00-DECISIONS-2026-10-21.md](N00-DECISIONS-2026-10-21.md): referee quyết ngay, TA cóhủy/rollback; startkhôngchờparticipants;SAapproveextensiontrướcend_at;startedmatchesdrain;privacy/scoring/Elo/retentionđãchốt. Những đoạn policyđềxuất/pending hoặcTAapprove trongrevision3 phía dưới chỉ là lịch sử nơi xung đột. Không tiếp tục hỏi lại các quyết định đó. Checklist93IDs giữ nguyên, subAC bổ sung trong decisionrecord.

## Human correction mới nhất — ưu tiên hơn mọi đề xuất bên dưới

- Nam duyệt5.2A: người chơi chỉ gửi yêu cầu pause; TA/referee xác nhận mới dừng.
- Nam duyệt6.1A: cap gia hạn tổng2giờ/giải, trong hợp đồng/capacity, SA được duyệt một phần.
- Nam sửa6.2 bằng lời rõ ràng: **trận đấu hết giờ là phân xử thắng/thua ngay**. Không chờ15phút, không freeze gameplay để chờ SA duyệt gia hạn. Mô tả hold15phút bên dưới là đề xuất root đã bị rút, không phải yêu cầu được duyệt. Kết quả theo luật đã pin và đúng authority; request gia hạn giải không mở lại hoặc reset clock/compute của trận đã kết thúc. Định nghĩa cách xử tại giờ kết thúc giải khác với clock của từng trận vẫn cần mô tả rõ ở lần đặc tả tiếp theo, không suy rộng lời sửa thành SA tự reopen giải terminal.
- Nam thay5.1 bằng quy tắc cụ thể: **TA chọn có/không trọng tài. Nếu bật thì TA cấu hình số tối thiểu; đủ số trọng tài đồng thờiONLINE+READY mới bắt đầu giải. Sau khi giải đã chạy, thiếu số tối thiểu vẫn tiếp tục, không trì hoãn giải hoặc trận mới chỉ vì thiếu trọng tài.** Không cần1ref/trận.

### Gate trọng tài đã chốt

- Proposed configuration identifiers: `referee_required` (boolean), `min_ready_online_referees` (integer dương khi bật; not-applicable khi tắt). Giới hạn kỹ thuật hữu hạn/heartbeat TTL doG1 chốt, không tự gán con sốminimum thayTA.
- Referee được đếm phải là các account khác nhau, đã nhận grant của đúng giải, grant chưa revoke/expire, ONLINE từ kết nối/heartbeat server còn hiệu lực và đã chủ động READY trong giải. Client boolean/URL không tự cấp ONLINE hoặc READY.
- Server recheck đồng thời trong transition **bắt đầu lần đầu** sangRUNNING; thiếu count thì chưa bắt đầu và UI hiển thị `đã sẵn sàng X / yêu cầu N`, ai offline/not ready và cách khắc phục. Không coi đãinvite/accepted là đủ READY.
- Khi đã RUNNING, count tụt không tự PAUSED/ENDED, không ngừng ghép trận hoặc chấm điểm chỉ vì thiếuref, không đình hoãn cả giải. Dashboard tiếp tục hiển thị count và case chưa được nhận đểTA điều phối. Blocker khác (an toàn/hạ tầng/lệnh pause hợp lệ) vẫn có hiệu lực riêng.
- Minimum không áp lại để cản resume giải đã bắt đầu. `ONLINE`, `READY` tại giải và `AVAILABLE` để nhận thêm incident là ba khái niệm khác nhau; trọng tài đang xử lícase không bị tự đổi thànhOFFLINE/NOT_READY chỉ để biểu diễn tải. Candidate dispatch vẫn kiểm tải/capacity.
- UI không cho chỉnh minimum ngầm để vượt initial gate; thay cấu hình qua config revision/permission cóaudit. Semantics đổi bật/tắt khiRUNNING phải theo policy config, không tự chặn runtime bởi count mới.

## Chỉ đạo human đã xác nhận

Nam chọn **4A**: relative BLUE vector gốc/RED rotate180 cả hai trục, không theo góc UI; EXTINCTION khi mất hết một loại R/P/S theo baseline.

Nhóm5: human yêu cầu hệ thống tự tổ chức thi, test, chấm điểm và phát hiện gian lận; sự cố/đề nghị pause/khiếu nại tạo notice trên dashboard các trận cho TA. Khi TA bấm trận, hệ thống gợi ý referee available để TA phân quyền xử lí sự cố, ngay giao diện quản lí giải. Không bố trí một trọng tài thường trực cho mỗi trận. Không diễn giải thành cần2000ref cho4000thí sinh;4000authenticated/ready chưa là proof2000runtime matches đồng thời.

Nhóm6: human yêu cầu TA gửi SA request gia hạn có **lý do+thời lượng**; SA có chức năng vừa xem request vừa đối chiếu lịch trước khi duyệt. Sau đó human duyệt cap2giờ theo6.1A; correction6.2 không chờ15phút, trận hết giờ xử ngay. Semantics end_at giải/request duyệt muộn còn cần tách rõ khỏi clock trận.

Các yêu cầu có giá trị ưu tiên hơn đề xuất5A/6A trước. Chưa có lời duyệt roster≥2/HYBRID/switch hoặc cancel policy chỉ vì human đã mô tả lại5/6.

## Ranh giới thay đổi

Canonical §1.3/10.5 từng đặt full scheduler/ledger/dashboard/khiếu nại vào Vận hành. Chỉ đạo mới bổ sung trực tiếp yêu cầu vận hành tự động + incident dashboard + assignment + extension/calendar. Phải bổ sung đặc tả/AC và đối chiếu lại effort/ownership sau gate; không tự đẩy yêu cầu mới sang DEFER, cũng không hứa lịch4/5ngày cũ đã bao gồm chúng. N00 chỉ làm rõ yêu cầu; không build các module này hoặc sửa schema.

Robot Lab custom room có Referee Start/Stop/Resume hiện hành không tự biến thành luật tournament. Giữ consumer/mode cũ; tournament cần server capability riêng, không cấp role qua URL hoặc chiếm player slot. Quyền phân xử exact-tie đã chốt2A vẫn TA owner nếu bật MANUAL; việc gán incident không tự cấp quyền chọn winner/void/disqualify.

## Phương án đề xuất để Nam quyết — CHƯA DUYỆT

### A. Điều phối sự cố

1. Match bình thường tự chạy theo luật/engine/runtime và bộ chấm điểm; không chờ referee bấm Start từng trận.
2. Player gửi incident (loại, lý do; đề nghị pause là một yêu cầu), hoặc detector tạo alert kèm evidence refs riêng tư. Event có ID/revision, priority, server time, trạng thái và audit; reconnect/retry không tạo nhiều case giống nhau.
3. TA thấy badge và hàng đợi trong dashboard trận, filter theo severity/unassigned/đang xử lí; cảnh báo không bị mất chỉ vì bỏ lỡ toast. Bấm trận mở panel sự cố ngay màn quản lí giải, giữ vị trí/bộ lọc danh sách.
4. Hệ thống gợi ý referee theo grant giải còn hiệu lực+đã accepted, online heartbeat gần đây, availability và tải xử lí. Đề xuất một active incident/referee, không tính mọi trận bình thường là tải trọng tài. Chưa có candidate thì hiện unassigned/queue, không báo đã có người xử lí.
5. TA chọn referee; server kiểm lại eligibility/capacity và gán nguyên tử. Referee phải nhận case; không nhận trong TTL thì quay queue hoặc TA reassign. Assignment không tự cấp global role. Revoke/disconnect cần thu hồi write authority cũ trước người mới có quyền.
6. Referee xử lí tại panel được ACL trong quản lí giải: xem evidence đã lọc, đề xuất/ghi kết luận, Stop/Resume nếu được cấp. Mọi thay đổi winner/void/disqualify là policy riêng cần Nam duyệt; không lấy incident assignment làm quyền override natural winner.

Đề xuất pause an toàn: player gửi yêu cầu, **chưa tự freeze chỉ bằng một click**; TA/referee quyết định dừng. Vi phạm xác định do server/runtime áp policy đã duyệt (ví dụ illegal move/own-turn budget), không đổi thành nghi vấn vô hạn; detector tương đồng/bất thường chỉ gắn cờ để review, không tự quy kết gian lận/loại thí sinh. Các detector thực sự hỗ trợ phải có tên/version, dữ liệu, threshold, evidence và false-positive/review tests; không hứa phát hiện mọi hình thức gian lận. Các con số heartbeat/assignment TTL/dedupe/rate limits là kỹ thuật hữu hạn phải chốt trong contract trước consumer.

### B. Gia hạn

Đã duyệt **tổng cộng tối đa2giờ/giải**, cộng dồn mọi lần đã duyệt, SA có thể duyệt ít hơn yêu cầu. Chỉ trong validity/date/resource envelope của hợp đồng và không đè reservation đã có. Vượt cap/hợp đồng không đi qua nút gia hạn nhanh; cần thay chính sách/hợp đồng riêng được human có thẩm quyền quyết. Đây là product cap, không bằng chứng hạ tầng có2giờ trống.

Request gồm tournamentId, baseScheduleRevision, currentEndAt, requestedExtraMinutes, requestedEndAt do server tính, reason, requester và idempotencyKey. Trạng thái PENDING/APPROVED/REJECTED/WITHDRAWN/EXPIRED; chỉ một active request/giải; approved lưu grantedMinutes, approver, decisionReason/time và schedule revision. TA không tự đổi end_at bằng sửa client.

SA mở request có nút **Đối chiếu lịch**: hiển thị timeline giải hiện tại+phần xin thêm, khoảng bảo trì, bookings/capacity theo resource có dữ liệu thật, hạn hợp đồng và tổng cap đã dùng. Hiển thị timezone và UTC instant; không coi hai giải overlap thời gian là conflict nếu có capacity độc lập, cũng không coi lịch trống là đủ capacity2000matches. Scheduler/capacity data thiếu phải ghi UNKNOWN/chặn duyệt nếu policy cần reservation, không hiển thị “không xung đột” giả.

Kết quả so lịch chỉ là preview. Approval transaction recheck revision, quyền, cap cộng dồn, hợp đồng và capacity/reservation; reserve khoảng mới cùng mutation end_at. Hai approval đồng thời không double-extend hoặc double-book; stale request báo conflict và phải đối chiếu lại. Deny/withdraw không thay end_at. Notify TA và refresh authoritative schedule; không reset score, luật trận, compute bank hoặc clock budget.

**WITHDRAWN — đề xuất cũ, human đã sửa:** hold gameplay tối đa15phút chờ SA. Không áp dụng. Theo chỉ đạo mới, trận hết giờ phân xử ngay; không trì hoãn kết quả vì request gia hạn. Manual exact-tie nếu TA đã cấu hình vẫn là workflow riêng đã pin, không được dùng request extension để gia hạn gameplay hoặc override natural winner.

Phần chưa chốt riêng: gia hạn end_at giải tính từ mốc nào và request SA duyệt sau giờ hết giải xử lí thế nào. Không có hold15phút hoặc capacity reservation ngầm trong lúc chờ. Không tự tạo ngân sách chơi mới hay reopen trận terminal.

## Checklist mở rộng revision2

Giữ nguyên T001–T081 để trace lịch sử, **thêm IE01–IE12: tổng93 mục**, công bố trước re-review. Cần93/93 để≥99%; không dùng coverage81IDs cũ chứng nhận scope mới. Nếu phát hiện yêu cầu còn thiếu, version checklist tiếp; không giảm mẫu số để đạt gate.

Mỗi mục sau là mandatory candidate AC của yêu cầu mới; trạng thái PARTIAL khi semantics còn chờ human. Verification hiện NOT RUN; không test DB thật/không chạy Python trong N00.

IE01 cần đầy đủ subcriteria trước khi được COVERED: eligible selection/pairing+rematch limits+queue bounds; runtime test/security/compatibility trước admission; accepted move và clock authority; durable result+finish_sequence+exact-once scoring; restart/retry recovery và measured concurrency/backpressure. IE07 cần detector matrix cụ thể (data/version/threshold/provenance/false-positive/review/sanction) cho từng detector được human chọn; không dùng một câu “phát hiện gian lận” thay acceptance. Các chi tiết chưa chốt vẫn PARTIAL, không gọi IE01/IE07 đủ chỉ vì có tiêu đề tổng quát.

| ID | Actor/điều kiện → trigger → expected/prohibited effect | Verification dự kiến |
|---|---|---|
| IE01 | Eligible players+config/runtime đạt → nếuTA bật trọng tài thì lần bắt đầu đầu tiên chỉRUNNING khi đủmin distinct accepted/active referee đồng thờiONLINE+READY, server kiểmatomic; tắt thì gate nàynot-applicable. SauRUNNING tụtmin không dừng/trì hoãn giải hoặc admission vì count. Scheduler create/run/test/score theo luật pinned, không1ref/trận; enforce capacity/backpressure, không hứa2000concurrent chưa đo | Fake-time ONLINE/READY/start race + no-ref-start/offline-after-start/resume regression + engine/runtime/admission/load theo môi trường |
| IE02 | Player trong trận hoặc detector trusted → tạo case/đề nghị pause → notice durable đúng dashboard TA; dedupe/retry/rate-limit, không leak tenant/private Bot | API/DB event retry + browser case list |
| IE03 | Có case → TA bấm trận → mở incident panel trong quản lí giải, giữ context danh sách; loading/empty/forbidden/error/retry/a11y/mobile/theme rõ | Browser actor/state/viewport/keyboard evidence |
| IE04 | TA xem gợi ý → chỉ grant accepted/active trong giải+availability có timestamp+tải hợp lệ; candidate rỗng không fake assigned; không tự chọn người ở giải khác | Fake-time heartbeat/ACL/load tests |
| IE05 | Hai TA/requests gán cùng referee hoặc case → server capacity/CAS chống double-assignment; accept/expire/reassign/revoke được audit, old assignee mất write authority | Transaction/concurrency/restart tests |
| IE06 | Player xin pause hoặc referee được gán thao tác → freeze/resume theo policy được duyệt; clocks/board/compute authoritative, late output discard, resume không clear blocker khác | Clock/late output/ACL/abuse tests; cần chốt pause policy |
| IE07 | Detector phát hiện dấu hiệu → alert có evidence/version/rationale, review outcome audit; chỉ policy server-verified được auto sanction, suspicion không tự kết tội/đổi winner | Positive/negative/security/privacy corpus theo detector được chốt |
| IE08 | TA gửi gia hạn lý do+thời lượng → server tạo request scoped bounded idempotent; vượt cap2giờcộngdồn/hợp đồng rejected không đổi lịch, chỉSA duyệt, cópartialapproval | Boundary/ACL/request-state tests; cap2giờ đã duyệt |
| IE09 | SA bấm Đối chiếu lịch → xem request+timeline/resource conflict/blackout/contract/cap trong cùng luồng; dữ liệu thiếu UNKNOWN, không false free | Calendar UI/API fixtures + capacity integration |
| IE10 | SA approve đồng thời với request khác/schedule đổi → atomic revision+cap+reservation recheck; end_at tăng đúng một lần, notify/audit, score/rules/clocks budget không reset | Disposable DB race/TOCTOU/idempotency tests |
| IE11 | Clock trận hết khi pending/deny/approve gia hạn → phân xử thắng/thua theo luật pinned ngay, không hold15phút hoặc output sau deadline, không mở lại trậnterminal. Request chỉ đổi end_at giải khi duyệt hợp lệ; cách xử end_at giải/lateapproval còn phải chốt riêng | Fake-time match-clock/extension-request independence + end_at boundary/restart corpus |
| IE12 | Incident/appeal/manual pending hoặc grant revoked → privacy-safe evidence và quyền phân biệt incident vs verdict; finalization/result ordering/retention không nuốt case hoặc double points | End-to-end late-result/ACL/retention tests; authority/finalization policy cần chốt |

## Các quyết định cần Nam trả lời

- Referee gate đã chốt ở trên; roster≥2eligible và HYBRID/switch chưa duyệt.
- Player chỉrequest pause đã chốt; giới hạn chống lạm dụng và quyền referee Stop/Resume/đề xuất vsvoid/disqualify vẫn cần rõ. Manual exact-tie TA-only vẫn giữ trừ human đổi riêng.
- Cap2giờ/contract/capacity/partialapproval đã chốt, không hỏi lại.
- Không freeze chờextension và clock trận hết xử ngay đã chốt; chỉcòn end_at giải/lateapproval/finalization/reservation cần định nghĩa riêng.
- Auto cheating detector baseline gồm những loại nào; verdict/sanction nào tự động, loại nào human xác nhận? Không suy từ “phát hiện gian lận” thành classifier toàn năng.

Canonical chưa sửa để không thay ý nghĩa trước khi các policy được chốt; supplement này ghi rõ human delta có ưu tiên hơn các dòng≥1Referee/ENDED cũ cần cập nhật. Lịch chưa sửa, không tuyên bố đủ effort.
