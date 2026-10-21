# S00 — Component và state inventory hiện hành

Nguồn hình thức R2; hành vi prototype R3. Không dùng tài liệu này để tạo persisted role/contract mới.

| Component | Có thể review trong prototype | Production seam |
|---|---|---|
| Header/nav | TA/SA/ref/denied; theme light/dark/system | Capability loader, logout/cache clear Đức/Sơn |
| Card list | ready/empty/no-results/filter/page | Server query/cursor; không fetch toàn bộ |
| Field | label/required/error/checkbox/select/number/date/textarea | Canonical schema/bounds G1; contract fields allowlist |
| Draft | dirty/saving/saved/submitted/error/conflict | Revision/idempotency/authoritative ACK; local prototype không proof persistence |
| Wizard | 4 bước/validation/back/summary | Field mapping82, RuleEditor embedded Nam |
| Leave dialog | native modal, Tab/Shift+Tab trap, Escape, ở lại/rời | Reuse Modal hiện hành nếu đáp ứng contract |
| Sidepanel | nonmodal desktop cạnh trang, narrow stack; heading focus/Escape/opener return | Không focus trap panel nonmodal; không chuyển player mode |
| Detail tabs | roving tab + arrow/home/end/aria-controls | Nội dung scoped theo grant |
| Assignment | open/assigned/inprogress/resolved/expired/conflict/no available | Server CAS/lease/revalidate; no1ref per match |
| Decision | required reason, referee active assignee, TA reverse before final | Canonical result ledger/recompute; history append-only |
| Extension | reason/minutes/pending/comparison/partial/expiry | SA transaction rechecks cap/time/reservations |
| Audit | safe diff/reason/metadata details/filter/page | Allowlist/ACL/retention365; không raw logs |
| Offline | available route/blocked consumer/unavailable runtime/retry | Owner Bot library privacy, verified consumer receipt |
| PageBoundary | ready/loading/empty/error/forbidden/expired/pending | Preserve draft, return path, no blind mutation replay |

## Component UX contract

Một primary action trong mỗi nhóm thao tác. Buttons có nhãn, pending/disabled rõ; icon chỉ bổ trợ. Status dùng chữ và màu. Lỗi liên kết field qua `aria-describedby`, summary focus rồi link tới field. Thông báo động dùng live region, không announce timer từng frame.

Input bị ẩn do mode không đi vào normalized snapshot hiệu lực. Editor có thể nhớ lựa chọn cũ khi quay lại mode nhưng phải revalidate trước submit. Preview/cached data tuyệt đối không nâng runtime/readiness thật.

## Skin ownership

`preview-base.css` là hình thức kế thừa prototype R2; `preview-extra.css` mở rộng panel/a11y/reflow, giữ semantic palette. `preview-shell.html` + `preview-app.js` là source; `build-preview.cjs` tạo lại fragment `preview.html`. Khi đưa lên app, map sang DESIGN_TOKENS/robot-lab.css, không copy CSS để tạo token source thứ hai production.
