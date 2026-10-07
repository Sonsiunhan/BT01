# R20 Desktop UI Audit

Ngày rà soát: 2026-10-05  
Phạm vi: desktop browser/local harness theo Robot Lab; kiểm thử thiết bị Chrome Android và Safari iOS đã được người dùng miễn (`WAIVED_BY_USER`).

## Kết quả đã có

- 7 trang được chụp ở viewport `1440x900`: Home, Bot Workbench, Bot Online, Bot Offline, History, Friends và Settings.
- Manifest hiện tại (`docs/r20-desktop-baselines/manifest.json`) ghi `consoleErrors=[]`, `notFoundResponses=[]`, `requestFailures=[]`, không có overflow ngang; các endpoint Guest cùng origin được harness trả `401` có chủ đích. Workbench dùng account fixture để kiểm tra trạng thái đã đăng nhập.
- Full web test: `46 files / 169 tests PASS`.
- Playwright browser regression: `43/43 PASS` với một worker.
- Web typecheck, lint và production build: PASS.
- Robot Lab hero, board/pieces và Bot Workbench empty-state đã được kiểm tra lại sau các chỉnh sửa R20. Abort khi teardown của Workbench không còn tạo banner lỗi kết nối giả.
- Guest Bot Online scoped: server `160/160`, browser `9/9`, import preview/retry/dedupe và custom discovery/join UI PASS; review độc lập scoped PASS. Chi tiết ở `docs/guest-bot-online-acceptance.md`.

## Không được suy luận thành PASS

- Ảnh trong `docs/r20-desktop-baselines/` là baseline hiện tại, chưa có reference được người dùng/BA phê duyệt; vì vậy screenshot comparison vẫn là `INCONCLUSIVE`.
- Independent BA/QA final review toàn hệ thống chưa có; review độc lập Guest Bot Online scoped đã có tại `docs/robot-lab-visual-reference/v10-independent-review.md` và không thay thế final V10/R20 review.
- Release-grade Core Web Vitals chưa được đo trong một phiên profiling được chấp nhận; các số Lighthouse/lab trước đó chỉ là chẩn đoán.
- Việc miễn Android/iOS chỉ loại trừ hai gate vật lý đó, không loại trừ ba gate ở trên.

## Quyết định phát hành

R20 vẫn `BLOCKED` cho đến khi có đủ ba artifact còn thiếu. Không push/deploy hoặc tự chuyển state sang `DONE` trong khi các gate này chưa có bằng chứng thực tế.

Nguồn theo dõi: `docs/robot_lab_wave_status.json`, `docs/r20-final-acceptance-evidence.md`, `docs/r20-desktop-baselines/manifest.json` và `docs/implementation_plan_ott_v0.2_robot_lab.md`.
