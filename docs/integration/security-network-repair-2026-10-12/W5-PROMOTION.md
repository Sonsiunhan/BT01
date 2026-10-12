# W5 local promotion

Ngày: 2026-10-12
Target checkout: `test-v0.2`
Source candidate: `codex/security-network-repair@faa3ad0`
Merge commit: `8da57f1`

## Kết quả

- Merge bằng `ort` hoàn tất, không có conflict.
- `test-v0.2` hiện chứa candidate W5; `main` vẫn ở `dbda8a9` và chưa có push/deploy.
- Worktree target sạch sau khi chạy smoke regression.
- `git merge-base --is-ancestor main HEAD` đạt; đây chỉ là kiểm tra quan hệ lịch sử, không phải merge vào `main`.

## Evidence sau merge

- Root security/CSRF focused: **2 files, 33 tests PASS**.
- Server error redaction: **1 file, 1 test PASS**.
- Server command/commit/room regression: **4 files, 44 tests PASS**.
- Tổng smoke sau merge: **78/78 PASS**.
- Không có conflict marker hoặc thay đổi ngoài candidate trong merge.

## Gate và giới hạn

- W5 local promotion: **DONE scoped** cho candidate development.
- Typecheck không tái lập được trong checkout promotion vì môi trường dependency của worktree không hoàn chỉnh: server không resolve generated `@prisma/client`; web không ghi được `tsconfig.tsbuildinfo` và package typings không khớp. W4 đã có evidence typecheck PASS trên candidate trước promotion; không dùng lần chạy lỗi này để kết luận lỗi source mới.
- Các G gate vẫn BLOCKED theo W5-REPORT: isolated PostgreSQL/migration, quota production, durable/restart semantics, sandbox/provider runtime thật, crash/backup/retention, load/real-device evidence và independent release review.
- Vì vậy candidate chưa được tuyên bố production/tournament-ready.

## ECC áp dụng

- `ecc:git-workflow`: merge có kiểm soát vào checkout riêng, bảo toàn `main` và remote.
- `ecc:delivery-gate`: chỉ kết luận DONE theo evidence, tách M gate khỏi G gate.
- `ecc:production-audit`: phân biệt smoke/source evidence với runtime, database và production evidence.
- `ecc:security-review`: rà quyền, privacy, error redaction và failure paths trước promotion.
