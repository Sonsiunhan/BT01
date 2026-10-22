# N04 — Independent requirements review

Ngày: 22/10/2026
Nhánh: `nam-tournament`
Trạng thái: **PASS — requirements gate; N04-owned implementation PASS**

## Kết quả cổng yêu cầu

Reviewer độc lập đã đối chiếu N04 trong `DELIVERY-PLAN.md` và `DELIVERY-TASKS.csv` với quyết định N00 rev.2, `N00-UI-DTO-DRAFT.md`, BA/SA T056–T062, N03 hiện có và nền L02 hiện có.

- Checklist ổn định: **20** tiêu chí nguyên tử
- Đã bao phủ: **20/20 = 100%**
- Thiếu: **0 P0/P1/P2**
- Ngưỡng theo `AGENTS.md`: **≥99% và không còn P0/P1**

## Tiêu chí đã bao phủ

1. Comparator lexicographic và thứ tự tiêu chí.
2. Trọng số dùng chung, số học hữu hạn/chính xác.
3. Khoảng cách goal theo đồ thị trên bàn custom.
4. Semantics goal không thể tới.
5. Mobility đếm cặp `(from,to)` duy nhất.
6. Chính sách không có nước hợp lệ/event.
7. Quy tắc bật/tắt draw.
8. Xác định người đi trước/thứ hai cho exact tie.
9. Ranh giới TA xử lý MANUAL exact-tie.
10. Snapshot đóng băng và timeout/manual.
11. Metadata version bất biến.
12. Reason/effectiveAt/digest.
13. Kiểm tra contract envelope.
14. effectiveAt và ranh giới tạo match.
15. Expected revision/CAS conflict.
16. Idempotency cùng key/cùng payload replay.
17. Idempotency cùng key/khác payload conflict.
18. Snapshot của match cũ không bị thay đổi.

## Hai quyết định đã đóng

### Q1 — ownership publish: A

N04 sở hữu comparator contracts, pure comparator và route adapters list/diff. L05 là single writer của publish transaction, được gọi qua typed port.

### Q2 — API contract: A

N04 chốt `GET /versions`, `GET /versions/:id/diff`, `POST /publish` với pagination bounded, exact digest/ref, expected revision, scoped idempotency key, common error envelope, HTTP status và role/tenant ACL. Cùng key/cùng payload replay kết quả; cùng key/khác payload trả `IDEMPOTENCY_CONFLICT`.

## Kết luận

N04 đã **PASS requirements gate**. Sau cổng này, implementation đã được thực hiện theo plan và đã có focused/regression evidence. Việc đánh giá implementation được ghi trong `N04-IMPLEMENTATION-REVIEW-2026-10-22.md`; không dùng requirements gate để thay cho review/test.

## Evidence sau implementation

- `tests/unit/n04-comparator.unit.test.ts`: 11 tests PASS.
- `tests/unit/n04-versioning.route.unit.test.ts`: 5 tests PASS.
- `tests/contract/n04-versioning.contract.test.ts`: 4 tests PASS.
- Regression N03/L02 và rules-preview: 19 tests PASS.
- `packages/game-rules` typecheck: PASS.
- Workspace server typecheck: BLOCKED bởi Prisma client/generated dependency cũ trong môi trường hiện tại; các lỗi được báo nằm ở `auth.service.ts`, không thuộc module N04.
