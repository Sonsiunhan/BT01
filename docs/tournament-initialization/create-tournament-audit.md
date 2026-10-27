# Rà soát Tạo giải đấu — 2026-10-26

## Bổ sung luồng vận hành CTF

- P1: evaluateReadiness khai báo trả snapshot nhưng với Prisma trả Promise ép `as any` (lifecycle.service.ts:639–648). openScheduled:682 và evaluateScheduledStart:1433 không await, đọc canOpenScheduled/canStartRunning từ Promise; nhánh báo lỗi còn truy cập blockers chưa tồn tại. Đây là lỗi đường chạy DB được xác định qua code, chưa tái hiện bằng E2E DB.
- P1: ReadinessSources countStaff chỉ lọc assignment ACTIVE và role REFEREE; chưa kiểm tra presence ONLINE và READY. Không đáp ứng điều kiện mở giải người dùng đã duyệt.
- P1: Trong source app/server tìm được, evaluateScheduledStart/evaluateAutoEndAtWindow được gọi khi GET danh sách/chi tiết giải, chưa thấy job timer độc lập gọi chúng. Cần kiểm thử không có người mở dashboard để bảo đảm bắt đầu/kết thúc đúng giờ.
- P1: finalizeTournament chỉ kiểm ENDED và adjudication WAITING rồi chuyển ARCHIVED. Trong hàm này chưa thấy chặn trận còn chạy hoặc ledger đang recompute; cần kiểm chứng end-to-end vì yêu cầu cho phép trận đang chơi chạy hết clock sau khi cửa sổ giải kết thúc.
- Audit này đã được thực thi trong local `main` với các sửa lỗi P1 có thể xác nhận bằng component/unit test. Chưa xem đây là xác nhận production/CI sạch.

Baseline: local main 4129088, worktree `.worktrees/merge-d03`. Các thay đổi được giữ ở commit riêng trên local `main`; không tự động push remote.

Skill đã đọc: ECC e2e-testing, áp dụng thao tác nhập bằng userEvent và phân biệt component test với E2E thật.

## Phát hiện

1. **P1 — Ô đích STATIC không sửa được bằng thao tác xóa rồi nhập.** RuleEditor.tsx:118–122 chỉ nhận tọa độ hoàn chỉnh mỗi onChange. Test clear nhận a5 thay vì chuỗi rỗng.
2. **P1 — Danh sách CYCLE/SEEDED không gõ thêm được.** RuleEditor.tsx:125–130 lọc bỏ chuỗi chưa hợp lệ rồi dựng lại input. Test gõ `, b6` sau a5 vẫn nhận a5. SEEDED dùng chung handler.
3. **P1 — Nộp duyệt có thể gửi dữ liệu cũ.** TournamentWizardPage.tsx:315–368 chỉ tự lưu khi chưa có tournamentId. Với bản đã lưu, sửa rồi nộp không PATCH nội dung mới; backend submitDraft đọc dữ liệu đã lưu.
4. **P1 — Lịch mở/đóng đăng ký bị bỏ qua.** Wizard có rosterOpenAt/rosterCloseAt nhưng handleSaveDraft không ánh xạ. tournamentTypes.ts đặt registrationOpenAt/registrationCloseAt thành null.
5. **P1 — Giờ hiển thị lệch múi giờ.** datetime-local chuyển giờ nhập sang UTC bằng toISOString nhưng render slice(0,16) trên UTC. Nhập 10:00 ở UTC+7 sẽ hiển thị 03:00. Xác nhận đường code; chưa chạy browser timezone test.
6. **P1 — Có thể báo thành công dù ghi database lỗi.** core-draft.service.ts:256,374,622 ghi memory store trước rồi gọi persistTournamentToPrisma(...).catch(() => {}) không await. Chưa inject lỗi DB thật hoặc thử restart để đo ảnh hưởng.
7. **P1 — Lưu giải không lưu luật đang sửa trên form.** createDraft truyền DEFAULT_TOURNAMENT_RULE_PROFILE; PATCH chỉ coreConfig. Rule panel giữ state/localStorage riêng và preview/publish riêng. Cần ngăn nộp khi người dùng còn thay đổi luật chưa áp dụng.
8. **P2 — Editor không nạp luật server vào value khi mở trên trình duyệt mới.** TournamentRuleManagementPanel khởi tạo từ localStorage/default; API list chỉ cập nhật versions/revision. Cần thử với giải đã đổi luật ở trình duyệt sạch.

Ngoài ra createDefaultCoreConfig vẫn gán format ARENA_CONTINUOUS, pairingMethod SWISS_SCORE_ADJACENT; chưa thấy cấu hình CTF/Custom trong Wizard. Cần đối chiếu đủ đặc tả với quyết định người dùng trước khi bổ sung.

## Kiểm thử

- Web: TournamentWizardPage.test.tsx và RuleEditor.test.tsx: 11/11 PASS.
- Root: s03-tournament-wizard, s04-tournament-form-groups, tournament-l02-l08, tournament-l09-concurrency, tournament-rules-preview.service: 24/24 PASS.
- Harness component tạm React state + userEvent: 2/2 FAIL đúng ở clear STATIC và nhập thêm CYCLE. Đã gỡ file tạm sau khi ghi nhận.
- Test hiện có pass nhưng chưa bao phủ các lỗi trên; một số chỉ kiểm tra source/contract.
- Chưa chạy browser E2E tới DB, DB failure/restart, kiểm thử đa phiên trên DB, full CI hay đối chiếu đầy đủ 82 trường BA/SA. Không kết luận đây là toàn bộ lỗi của tính năng.

## Đã thực thi trên local `main`

- Ô đích STATIC và danh sách CYCLE/SEEDED giữ chuỗi đang nhập, cho phép xoá rồi nhập lại; chỉ cập nhật model khi tọa độ hợp lệ.
- Nộp duyệt luôn lưu form hiện tại trước khi gọi submit; bản nháp mới được tạo trước khi mở modal, bản nháp cũ không bị tăng revision thêm một lần chỉ vì mở modal.
- Ánh xạ `rosterOpenAt`/`rosterCloseAt` vào `registrationOpenAt`/`registrationCloseAt` và chuyển `regulationsText` vào `regulationsFull` khi tạo/cập nhật bản nháp.
- Lifecycle readiness đã await đúng cả nguồn dữ liệu đồng bộ và Prisma async trong `openScheduled`/`evaluateScheduledStart`, nhưng vẫn giữ tương thích với test store đồng bộ.

## Còn lại sau audit

- Persistence Prisma vẫn cần transaction/error propagation thay cho `catch(() => {})` và cần test lỗi DB/restart.
- Presence `ONLINE + READY`, scheduler độc lập không phụ thuộc GET, lifecycle end-window, luật chưa lưu và timezone cần wave riêng với harness/E2E tương ứng.
- Cần đối chiếu tiếp các trường BA/SA (điều lệ, liên hệ, time model, organizer unit, contract) trước khi tuyên bố tính năng tạo giải đấu hoàn tất toàn scope.

## Thứ tự khắc phục

## Rà soát bổ sung

Các phát hiện sau xác nhận bằng đường code, chưa có browser E2E riêng:

- Điều lệ (`regulationsText`), liên hệ (`contactChannel`), mô hình thời gian (`timeModel`) có input nhưng không được handleSaveDraft đưa vào payload. Đơn vị (`organizerUnitId`) cho nhập nhưng backend lấy từ hợp đồng. Thay hợp đồng khi sửa giải cũng không được PATCH gửi lên.
- Khi bật dùng movement Xanh cho hai bên, input Đỏ vẫn cho sửa. rules-preview.service.ts:116 luôn lấy Xanh cho Đỏ, nên thao tác chỉnh Đỏ bị bỏ qua.
- Nháp chỉnh sửa khởi tạo từ buffer nhưng GET server sau đó ghi đè các trường vừa khôi phục; chưa có quyết định chọn giữ buffer hay dùng bản server.
- Khóa buffer khi sửa là `draft_${id}` nhưng nộp thành công gọi clearLocalDraftBuffer(id), nên không xóa đúng bản lưu cục bộ.
- Nút bỏ buffer reset DEFAULT_FORM_DATA và làm mất tournamentId khi đang ở trang edit; auto-persist lại lưu default. Lần lưu sau có thể đi vào nhánh tạo mới thay vì PATCH.
- Trạng thái chờ duyệt chỉ ẩn nút lưu/nộp, không khóa các input. UI vẫn cho sửa nội dung không có đường lưu tương ứng.
- Mã giải tự sinh chỉ khi slug đang rỗng. Khi gõ tên từng ký tự, slug lấy ký tự đầu rồi không theo phần tên còn lại.

Chưa kết luận toàn bộ lỗi đã được tìm thấy; cần thêm permission E2E, failure/restart DB và đối chiếu đủ đặc tả.

Tách chuỗi đang nhập khỏi dữ liệu tọa độ đã validate; đồng bộ lưu/nộp và luật chưa lưu; ánh xạ lịch đăng ký và chuẩn hóa timezone; đảm bảo transaction/persistence và báo lỗi DB; sau đó kiểm tra TA tạo → sửa → reload → nộp → SA xem đúng nội dung, kèm permission/conflict/error cases.
