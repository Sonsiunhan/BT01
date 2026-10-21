# S00 — Review độc lập thiết kế/prototype

## Revision 4 — closure hiện hành

Reviewer `/root/s00_design_review`, 21/10/2026. **Verdict: READY_FOR_HUMAN_REVIEW / PARTIAL_VALIDATION.** Không còn finding P0/P1 được phát hiện trong scope prototype/handoff đã kiểm; R4-01 đến R4-06 đều đã đóng ở phạm vi xác minh bên dưới. Không ký VERIFIED hoặc 10/10 khi human/SR/zoom/contrast manual chưa có evidence.

| Snapshot cuối revision4 | Evidence |
|---|---|
| `preview.html` | SHA256 `0BF009D45C622AA78808FEAB8DCD09E49F0D65969950222C7D6BF424C495528D` |
| `preview-app.js` | SHA256 `324AAD76E12A20DDB2FB84C229600DAF4923B28C21F63FCA49D2BC0E56501CB0` |
| Browser suite | `evidence/browser-results.json`, Edge 155.0.4283.62, 121 PASS / 0 fail, timestamp 06:28:40Z, cùng hash preview |
| Axe suite | `evidence/accessibility-results.json`, 10 page/theme scans, 0 violations, timestamp 06:28:47Z, cùng hash preview; còn `color-contrast` incomplete |

### Closure độc lập trên snapshot cuối

Reviewer đọc source/delta/traceability, kiểm runner output và chạy Edge headless riêng qua Playwright, nạp fragment local, không API/DB. Có kiểm ban đầu đã reproduce lỗi thật và kiểm lại sau sửa như dưới đây; không chỉ dựa lời root. R4-01…R4-05 kiểm trực tiếp trên snapshot `E3B91E76…89FA06`; patch cuối chỉ thêm `broadcastSelections` theo trận và copy session-local, R4-06 kiểm trực tiếp trên snapshot `0BF009D4…95528D`. Runner cuối chạy lại toàn bộ 121 assertions trên hash mới, reviewer đọc targeted patch không thay logic đã đóng trước đó.

| Finding | Trạng thái | Independent verification |
|---|---|---|
| R4-01/P1 policy drift | CLOSED | BOT_ONLY: `rating=ELO_1000_FIXED` bị khóa; retention 90 ngày bị khóa; qualification được bật và bị khóa. Source normalized ép policy đã duyệt; validation từ chối giá trị trái policy |
| R4-02/P1 actor scope | CLOSED | Observer: mainnav ẩn, không có tab Sẵn sàng hoặc extension action; chỉ match-center theo grant. Observer mở CTF-004 không có broadcast button. Source allowlist chặn admin pages/panels; broadcast panel chỉ dành Broadcast Admin |
| R4-03/P2 row binding | CLOSED | Panel CTF-004 hiện Đã kết thúc, 22/10 · 09:00, Bàn 01, Đỗ Khang vs Bùi Lan, Kênh 3; mở đúng row data thay vì status theo prefix. Incident action chỉ hiện ở row có case flag |
| R4-04/P1 numeric/conditional validation | CLOSED | BOT_ONLY với memory -1 bị `aria-invalid=true`. Reviewer phát hiện vòng kiểm đầu của fix vẫn kiểm Bot fields đã ẩn; sau applicability fix: quay bước 1 → HUMAN_ONLY → bước 3 không còn memory input và qua Xác nhận, errors 0. Source đã kiểm bounds/integer/maxPlies chẵn |
| R4-05/P2 thiếu surface phát sóng | CLOSED | Broadcast Admin mở match CTF-001 → Mở bảng phát sóng: có heading Chuẩn bị phát sóng, layout select và channel select; Observer không có action chuẩn bị |
| R4-06/P2 lựa chọn phát sóng không giữ | CLOSED | Independent Edge: CTF-001 chọn “Chỉ bảng kết quả” / “Kênh 3”, xác nhận, đóng rồi mở lại giữ đúng hai giá trị. Mở CTF-002 có default riêng “Toàn cảnh bàn + đồng hồ” / “Kênh 2”, không nhiễm lựa chọn trận trước. Copy chỉ hứa lưu trong phiên prototype; không claim phát sóng thật hoặc persistence DB |

### Đánh giá delta/handoff

- Match-center có overview, Vòng CTF và Vòng Custom với thứ tự import fixture; không tự phát minh knockout/vòng bảng. Đủ surface thiết kế để human review, không phải live scheduler/import proof.
- P02 chỉ có HUMAN_ONLY/BOT_ONLY; F01–F82 có individual traceability và visible grouped map. Các phần engine/runtime/auto/roster vẫn handoff, không quảng cáo 82 field đã triển khai production.
- Observer/Broadcast là scoped context proposal chờ G1; role picker chỉ điều khiển review. Các role không được suy thành persisted global role hoặc server ACL đã hoạt động.
- Binary mode là delta human mới thay HYBRID của N00 trong scope này; Elo 1000, retention 90 ngày và mandatory Bot qualification giữ quyết định N00 chưa bị override.

### NOT RUN/PENDING còn lại

Human visual/copy acceptance bản revision 4; screen reader thực; browser zoom/device manual; axe color-contrast incomplete manual; L00/G1 contract freeze. Browser suite và palette ratios không thay thế các kiểm này. Nhãn đúng tiếp tục **PARTIAL_VALIDATION**, không full VERIFIED. Manifest cần repin sau khi report này thay đổi; root chịu cập nhật hash manifest, reviewer không sửa evidence/source.

---

## Revision 4 — delta match-center/P02, vòng kiểm đầu

Ngày21/10/2026. Phạm vi: `S00-REQUIREMENT-DELTA-2026-10-21.md`, match-center CTF/Custom, scoped Observer/Broadcast Admin, visible mappingF01–F82 và binary control mode. Source/evidence snapshot đầu: `preview.html` SHA256 `0C51E2E4959FFE053B8B76B698196415E043F8BE44F759DD8E638546D7D54EA4`; browser114assertions/axe10scans0violations theo manifest. Verdict revision3 bên dưới là historical và không ký delta revision4.

**Verdict vòng đầu revision4: REWORK_REQUIRED / PARTIAL_VALIDATION.** Có policy/actor-scope regression P1 chưa đóng ở snapshot này. Không có P0 được phát hiện; không claim production vulnerability vì đây là prototype synthetic.

### Findings revision4

| ID | Mức | Finding | Evidence và sửa yêu cầu |
|---|---|---|---|
| R4-01 | P1 | P02 cho KEEP_SYSTEM/COMPRESS_TO_BASELINE, retention editable1..365 và qualification có thể tắt; trái N00fixed tournamentElo1000, retention90days và bắt buộc SECURITY+COMPATIBILITY | Independent Edge: BOT_ONLY → compression → retention365 → qualification off → Xác nhận/errors0. Delta human hiện hành chỉ override mode, không override ba policy này. Khóa/read-only policy đã duyệt; normalized không giữ giá trị trái quyết định |
| R4-02 | P1 | Observer/Broadcast kế thừa navigation admin và mở private audit/tools; Observer cũng có action mở bảng phát sóng | Independent Edge: roleObserver → Nhật ký có2audit rows, gồm request TA và decision Ref; CTF004 panel có broadcast action. Allowlist theo scoped grant; Observer xem trận, Broadcast có surface chuẩn bị riêng, không mặc định audit/owner tools/extension |
| R4-03 | P2 | Match panel dùng prefix ID để đặt trạng thái, không bind MatchRow; incident action mọi row vềcase032 | Independent Edge: rowCTF004 đã kết thúc nhưng panel ghiĐang diễn ra; CUS101 tableĐang diễn ra nhưng panel code ghiSắp diễn ra. Lookup row để dùng status/cặp đấu/ngày/bàn/kênh và incident tương ứng |
| R4-04 | P1 | Numeric fields mới chỉ có HTMLmin/max, formnovalidate nhưng validate không kiểm các bounds này hoặc maxPlieschẵn | Source inspection: validate chỉ kiểm các field subset revision3. turnLimit/memory/fileSize/totalCompute/maxPlies cần bound/integer và hidden applicability rõ; không để dữ liệu trái label qua confirmation |
| R4-05 | P2 | Broadcast preparation action chỉ ghi feedback“đã mở bố cục”, chưa có surface chuẩn bị như delta mô tả | Render/click handler chỉ status text; cần panel kênh/bố cục/context trận hoặc ghi dependency chưa triển khai; Observer không có action preparing |

### Coverage delta có sẵn

- P03 có overview và hai tab CTF/Custom; Custom data giữ thứ tựfixture, không tự gán vòngbảng/knockout.
- P02 dropdown chỉ HUMAN_ONLY/BOT_ONLY và normalization xóa Botfields khi HUMAN_ONLY; không HYBRID trong active options.
- Visible field-map có9nhóm và traceability82IDs; nhiều field vẫn component/handoff/auto, không thể gọi82field interactive đã hoàn thành.
- Evidence browser114/axe10 là phạm vi suite hiện có, chưa chứng minh các nhánh adversarial được reviewer phát hiện. Sau fix cần rebuild, thêm regression và repin exact source hash.

### Giới hạn còn lại cho revision4

Human visual/copy acceptance, real screen-reader session, real browser zoom/device và axe color-contrast incomplete manual đều chưa có evidence mới. G1/L00 freeze vẫn pending; role/controlmode/schema là proposal cần được cập nhật contracts trước production. Không dùng role picker trong prototype làm proof server ACL. Reviewer chỉ sửa report, không app/source hoặc dữ liệu hệ thống.

---

**Phạm vi note:** báo cáo này kết luận cho revision 3 (hash `55d1…`) và không bao phủ delta revision 4 về match-center CTF/Custom, Observer/Broadcast Admin hoặc control mode HUMAN_ONLY/BOT_ONLY. Cần một lượt review độc lập mới trước khi ký revision 4.

Reviewer: `/root/s00_design_review` · 21/10/2026 · Revision 2 (targeted semantics/layout addendum)

Phạm vi được human duyệt: Q1A/Q2A/Q3A/Q4A/Q5A. Reviewer chỉ đọc source/evidence và kiểm fixture trong Edge; chỉ ghi report này. Không sửa application code, không tạo quyền server, không gọi dịch vụ hoặc DB production.

## Verdict

**READY_FOR_HUMAN_REVIEW — không còn finding P0/P1 được phát hiện trong phạm vi prototype/handoff đã kiểm.**

Không ký `VERIFIED — DESIGN/PROTOTYPE`, không quy điểm10/10: nghiệm thu hình thức/copy cuối của human, screen reader thật, zoom/device manual và các axe incomplete vẫn cần bằng chứng tương ứng. Đây không phải code/security/runtime review của production.

## Snapshot đã kiểm

| Input | SHA256 / nguồn |
|---|---|
| Independent interaction snapshot `preview.html` | `587BC46BA5C4E70318CFB0C74C852DB06D22A8B73664BDC64A88E251D479E3A6` — R01–R04 closure và normalization kiểm trực tiếp ở snapshot này |
| Independent interaction snapshot `preview-app.js` | `D12E0B4707D548EC9C5C5E052E7D765B708892DA30B68E8F71D3C99919938F71` |
| Targeted final `preview.html` | `55D1C8287742D6CD8BFF8048A39DE2B1DA4E80E11A13EACF1EE3BC98887CDC16` — thêm semantic roles và align-start, không đổi interaction logic |
| `evidence/browser-results.json` final | 106 assertions PASS,0fail; preview hash khớp targeted final; Edge155.0.4283.62; timestamp05:41:01Z |
| `evidence/accessibility-results.json` final | 10 scans page/theme,0violations; preview hash khớp targeted final; timestamp05:40:58Z. Chỉ còn color-contrast incomplete, không có aria-prohibited-attr incomplete |
| Nghiệp vụ | N00 decisions revision2 và N00-RESULT/FINAL93/93; G0 yêu cầu PASS, G1 là dependency riêng |
| Handoff | TRACEABILITY đầy đủ82 field IDs; COMPONENT-STATES; DTO/route proposal; approved implementation plan |

Source được tạo từ shell/base/extra/app, không sử dụng application services. Sau thay đổi source/hình thức/actor hoặc policy cần kiểm lại phần bị tác động và cập nhật snapshot; verdict này không tự áp dụng commit tương lai.

## Kiểm độc lập đã thực hiện

- Đọc AGENTS.md, plan, N00 result/decisions, frontend token/visual authority, source prototype, traceability, DTO/route inventory và hai runner/evidence liên quan.
- Áp dụng `ecc:frontend-a11y` (đã đọc đầy đủ): label/error association, focus/keyboard, modal/nonmodal, live regions và reduced motion. Không gọi DOM test là screen reader certification.
- Mở ảnh P01 desktop dark, P02 rules dark, P03 dark375 và P03 light1440. Bố cục/header/palette/panel/depth thống nhất với Robot Lab; mobile content reflow và chữ đọc được ở ảnh đã kiểm. Không suy từ bốn ảnh thành đã kiểm mọi screen/state.
- Chạy Edge headless độc lập bằng Playwright qua `node -e`, nạp riêng fragment local; không network/app API. Browser trong sandbox lỗi profile/pipe; chạy lại ngoài sandbox thành công, không cài browser mới.
- Reproduce ba lỗi dưới đây rồi xác minh sửa bằng thao tác UI; kiểm thêm effective normalization khi HUMAN_ONLY/goal off.

## Findings và closure

| ID | Mức | Vấn đề và repro | Kết quả kiểm lại |
|---|---|---|---|
| R-01 | P1 | Actor denied → product recovery “Về trang được phép” tự đổi role thành TA và hiện3 private cards | **CLOSED**: vẫn role denied, zero cards; focus tới bộ chọn role xem thử. Role picker ngoài sản phẩm được giải thích rõ |
| R-02 | P2 | Tên121 ký tự → Save draft báo saved vì chỉ kiểm min3; không có error | **CLOSED**: save từ chối, error summary1 và nhận focus; không saved ACK giả |
| R-03 | P1 | Save HUMAN_ONLY/goal off → edit/discard/reopen → HYBRID, nhập cpu200 nhưng không qua validation. Editor checkpoint dùng normalized snapshot đã mất keys; updateField từ chối key không còn trong draft | **CLOSED**: checkpoint giữ editable draft; normalized dùng riêng effective payload. Repro lại HYBRID+goal on+F6+cpu200 qua bước Xác nhận, errors0 |
| R-04 | P2 | Sửa rows/goal hợp lệ nhưng old error/aria-invalid vẫn tồn tại, ảnh rules có rows9/E5 mà báo sai | **CLOSED**: sửa rows bỏ snapshot error/aria-invalid và goal dependent error; submit revalidate. Kiểm độc lập attributes rows/goalCell đều null sau sửa |

Console evidence độc lập sau sửa: `denied recovery → {role:denied,cards:0,focus:true}`; `save121 → {error:1,errorFocus:true,status:dirty}`; `normalized inactive keys → no cpu/goalMode/goalCell/interval`; `reactivate after discard → {step:Xác nhận,errors:0,cpu200:true}`.

## Acceptance assessment

### Targeted addendum sau polish

Reviewer đọc thay đổi: generated root có `role="region"`; nhóm filter có semantic `role="group"`; mini-board có `role="img"`; CSS `.formgrid,.split` dùng `align-items:start` để panel ngắn không kéo dài trống. Các thay đổi này không sửa checkpoint/validation/permission logic đã kiểm độc lập. Hai runner final pin cùng exact fragment hash như bảng trên, source không đổi trong lúc chạy. Reviewer xác minh JSON final106/0fail và axe10scans0violations, đã hết aria-prohibited-attr incomplete. Không lặp lại độc lập toàn bộ106 assertions và không dùng addendum để claim screen reader/human acceptance.

| AC | Đánh giá trong scope đã kiểm |
|---|---|
| 01–02 | IMPLEMENTED và reviewer visual spot-check phù hợp; human visual/copy final còn PENDING |
| 03 | PASS synthetic actor scope; R-01 closed. Không chứng minh server ACL |
| 04 | PASS browser list/query/filter/page/no-results; fixture detail context phân biệt |
| 05–06 | PASS representative wizard4 bước/boundaries/focus; R-02 closed |
| 07–08 | PASS representative conditional effective snapshot, editor checkpoint, leave/conflict/network recovery; R-03/R-04 closed |
| 09 | PASS startup blocker khác warning RUNNING; không thiết kế trì hoãn giải đang chạy vì thiếu Referee |
| 10 | PASS representative assignment/lease/decision/history/reversal/final lock; exact-tie TA-only; production exactly-once OUT_OF_SCOPE |
| 11 | PASS representative extension pending/cap/comparison/expiry/partial approve theo N00; resource transaction OUT_OF_SCOPE |
| 12 | PASS synthetic safe audit fixture/filter/page; không private source/credentials trong artifact đọc; production leak review OUT_OF_SCOPE |
| 13 | PASS bốn Offline entries/dependency/retry không cấp READY giả; không đo actual runtime |
| 14 | PASS representative recovery states; không xem global state switch là production failure injection |
| 15 | Browser focus/association/dialog/tab/Escape PASS scoped; real screen reader NOT RUN |
| 16 | Automated bounds/contrast/motion PASS theo runner; real browser zoom/device manual NOT RUN; axe incomplete cần manual review |
| 17 | PASS handoff coverage82 IDs và owner/dependency/proposal boundaries; D00/L00/G1 không giả đã nghiệm thu |
| 18 | Independent review hoàn tất ở scope report này; human acceptance PENDING |

## Phần chưa đóng và lưu ý bàn giao

1. AC15 screen reader thật chưa chạy; không có evidence NVDA/speech session. Cần kiểm một form error và một panel open/close bằng công cụ thật trước ký VERIFIED.
2. AC16 viewport720 là mô hình reflow200%, chưa thay actual browser zoom/device manual. Không đổi nhãn thành full device support.
3. Axe final còn incomplete `color-contrast`; zero violations không có nghĩa toàn bộ node đã pass. Palette ratios do runner đo là scoped, không thay xem xét các incomplete đó. `aria-prohibited-attr` incomplete đã hết sau targeted semantics polish.
4. Ảnh standalone runner không có host Lucide renderer; icon-only action giữ accessible name nhưng screenshot blank icon chưa đủ chứng minh icon thật trong surface chat. Cần xem bản render chat cuối.
5. Traceability đánh dấu nhiều F01–F82 là Handoff/component của Nam/Long/Đức, không phải82 interactive fields đã code. Đây là scope prototype được duyệt; downstream phải thực hiện đầy đủ trước submit thật.
6. G1 contract freeze/L00 còn dependency pending; không dùng role/status/capability strings proposal để tự tạo persisted global role/API.

Nếu human chấp nhận thiết kế nhưng chưa có SR/zoom evidence, trạng thái đúng tiếp tục là **READY_FOR_REVIEW / PARTIAL VALIDATION**, không phải VERIFIED tuyệt đối.
