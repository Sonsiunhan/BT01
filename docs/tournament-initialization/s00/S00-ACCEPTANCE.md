# S00 — Checklist nghiệm thu bản hoàn thiện

21/10/2026. Phạm vi human duyệt Q1A–Q5A, đã bổ sung delta revision 4. Status: **READY FOR HUMAN REVIEW / PARTIAL VALIDATION**.

## Evidence và giới hạn

- `evidence/browser-results.json`: bộ kiểm synthetic trên Edge, ghi version, từng assertion và SHA256 của `preview.html`; xem manifest cho snapshot cuối.
- `verify-complete.cjs`: wizard, role scope, incident/referee/rollback/lease, extension, audit, Offline, UI recovery, keyboard, contrast và reflow.
- `evidence/*.png`: screenshot đại diện dark/light desktop/mobile; root đã mở P01 desktop, P02 rules và P03 mobile light; reviewer độc lập kiểm thêm các ảnh nêu trong report.
- `verify-accessibility.cjs`: axe WCAG2A/AA + 2.1AA; kết quả riêng `evidence/accessibility-results.json` khi chạy xong.
- `verify-manual-gates.cjs`: Edge model kiểm viewport 320–1440, mô hình zoom 200%, contrast mẫu và copy; không thay thế zoom/device thật, screen reader thật hoặc human acceptance.
- Dữ liệu synthetic, không server/API/DB/runtime thật. DOM visibility không chứng minh server ACL. 720px reflow chỉ mô hình 1440px ở200%, không phải browser zoom thực.
- Không tìm thấy NVDA trong các thư mục Program Files đã kiểm hoặc process đang chạy; chưa có session screen reader thực. Không cài hoặc khởi chạy phần mềm hỗ trợ người dùng khi chưa cần.

| AC | Bằng chứng | Trạng thái |
|---|---|---|
| 01 | Source token/geometry mapping trong traceability; ảnh P01/P03/P02 | IMPLEMENTED; human visual final PENDING |
| 02 | Header/cards/progressive disclosure, panel reason/deadline | IMPLEMENTED; human copy review PENDING |
| 03 | Browser roles TA/SA/Ref/Observer/Broadcast/denied; scoped matrix and match-center-only viewer surface | PASS synthetic, server ACL OUT_OF_SCOPE |
| 04 | List search/filter/page/no-results assertions | PASS synthetic |
| 05 | Bốn bước wizard/back/confirmation/submit + field map F01–F82 | PASS synthetic |
| 06 | Name/schedule/board bound errors, summary focus | PASS representative boundaries; full engine validation owner Nam |
| 07 | HUMAN_ONLY/BOT_ONLY, fixed Elo1000/retention90, mandatory Bot qualification và goal applicability | PASS representative UI; full RuleEditor owner Nam |
| 08 | Dirty guard, pending save, error/conflict recovery | PASS synthetic |
| 09 | Startup staffing blocker vs ongoing warning | PASS synthetic |
| 10 | Assignment/unavailable/accept/decision/reverse/finalize/expiry; match panel binds row context | PASS synthetic; exact-tie actual transaction OUT_OF_SCOPE |
| 11 | Pending current-end unchanged, cap120, UNKNOWN/CONFLICT/CLEAR, expiry, partial approve | PASS synthetic |
| 12 | Safe audit diff, filter/page; source/credential deny fields | PASS synthetic fixture; production payload privacy OUT_OF_SCOPE |
| 13 | Four entries, pending human–Python consumer, retry no READY | PASS synthetic |
| 14 | Loading/empty/error/forbidden/pending/expired, context recovery | PASS representative component states |
| 15 | Keyboard/dialog trap/error association/tab arrows/Escape return | PASS browser; screen reader thực NOT RUN |
| 16 | 320/375/768/1366/1440/720 reflow, light/dark, contrast, reduced motion | PASS automated + model gate; real zoom/device manual NOT RUN |
| 17 | Traceability82 fields, visible field map, role/DTO/route proposal boundaries | PASS synthetic/handoff; independent review revision 4 PASS, G1 vẫn pending |
| 18 | `S00-INDEPENDENT-REVIEW.md` + human final | Independent review revision 4 READY_FOR_HUMAN_REVIEW; human acceptance PENDING |

“Hoàn thiện triển khai S00” nghĩa là bộ prototype/handoff đã làm và kiểm trong phạm vi trên. “VERIFIED — DESIGN/PROTOTYPE” chỉ ghi khi các nghiệm thu bắt buộc còn lại có evidence. Không tự quy điểm10/10 hoặc đóng S01–S10.

## Findings đã sửa

- R01/P1: recovery của actor denied tự cấp TA → giữ denied, không lộ cards.
- R02/P2: Save draft nhận tên121 ký tự → enforce3..120 và focus error summary.
- R03/P1: normalized snapshot làm checkpoint editor mất keys Bot/goal → giữ editable draft và effective profile riêng; regression save/discard/reactivate PASS.
- R04/P2: sửa field vẫn giữ lỗi cũ → bỏ lỗi snapshot cũ theo field/dependency, validate lại khi tiếp tục.

Reviewer độc lập đã reproduce rồi kiểm closure của revision 3 và revision 4 delta; source hash mới được ghi trong manifest. Human visual/copy, screen reader, zoom/device và contrast manual vẫn là cổng cuối.

