# N01 — Implementation plan

**Owner:** Nguyễn Tiến Nam  
**Task:** N01  
**Trang:** P04 — Cấu hình luật  
**Dependency:** N00  
**Gate:** G0  
**Trạng thái:** PLAN APPROVED — Q1–Q5 chọn A; thực thi vẫn HOLD đến khi G0 PASS; chưa sửa code

## 1. Mục tiêu và giới hạn

N01 mở rộng lớp luật thuần `@ottv2/game-rules` để engine hiểu bàn chữ nhật 5–15, bố cục/counts do profile cung cấp và movement theo `type × side` với hai họ `RAY` và `LEAP`. Bản legacy `createInitialState()` và luật 9×9 hiện tại phải giữ nguyên.

N01 không làm API validate/preview, contract Zod, publish/version, goal `CYCLE/SEEDED`, SDK/runtime receipt, server route, database, UI P04 hoặc settlement. Các phần đó là N02+ và các writer khác. N01 chỉ tạo seam công khai đủ ổn định để N02 gọi engine thật.

## 2. Bằng chứng baseline đã kiểm tra

- `packages/game-rules/src/types.ts`: `File` chỉ `a..i`, `Rank` chỉ `1..9`, `Coordinate` và `Board` cố định 9×9.
- `coordinates.ts`: parser, goal và `BOARD_COORDINATES` đều hard-coded 9×9.
- `engine.ts`: chỉ `isOneStep`, goal cố định, extinction luôn bật; chưa có profile movement, blocker path hoặc jump.
- `setup.ts`: có profile `rps-v1/rps-v2` cố định; chưa nhận board/layout/counts tùy chỉnh.
- Focused baseline: `tests/unit/l01-harness.unit.test.ts` **13 passed** và `tests/unit/game-rules.unit.test.ts tests/unit/l01-w3-entropy.unit.test.ts` **30 passed** bằng local `node_modules/.bin/vitest.cmd`; các ca board/movement mới chưa tồn tại. `corepack pnpm` không chạy được vì môi trường không có pnpm cache và registry bị chặn, nên không dùng kết quả đó làm evidence.

## 3. Seam công khai đề xuất

1. `validateRuleProfile(profile)` — trả lỗi cấu trúc/bounds có mã ổn định, không ném lỗi cho dữ liệu người dùng.
2. `createInitialState({ profile, seed? })` hoặc tên tương đương đã chốt ở MCQ — dựng board từ `layout`, kiểm counts/layout và tạo state immutable.
3. `getBoardCoordinates(boardSpec)` / `isCoordinateInBoard(boardSpec, coordinate)` — không dùng global 9×9 khi state là board tùy chỉnh.
4. `getLegalDestinations(state, side, from)` — enumerate đúng `RAY`/`LEAP`, theo profile của state.
5. `applyMove(state, command)` — giữ capture/blocking/RPS matrix và terminal legacy; không mutate input.

State mới phải mang geometry/profile snapshot bất biến. Các hàm legacy không được yêu cầu caller đổi payload để giữ hành vi cũ.

## 4. Trình tự thực hiện sau khi G0 PASS

### Slice 1 — Harness đỏ tại public seams

- Thêm test fail cho board 5×15 và 15×5; coordinate ngoài board bị từ chối.
- Thêm test fail cho layout không đủ counts, trùng ô, ngoài board, duplicate id và initial terminal.
- Thêm test fail cho `type × side` profile, RAY hữu hạn, blocker `canJump=false/true`, LEAP offset và destination policy.
- Giữ các test legacy hiện có làm regression fence.

### Slice 2 — Geometry và profile validation

- Mở rộng coordinate alphabet tối đa `a..o`, rank `1..15`; parser xử lí rank hai chữ số.
- Tạo geometry theo `rows/cols` chữ nhật, không giả định board vuông.
- Chốt giới hạn pattern/offset và kiểm tra hữu hạn, min/max, zero offset, hướng hợp lệ, goal/layout trong bounds.
- Không thêm script hoặc multi-segment movement.

### Slice 3 — Setup từ counts/layout

- Dựng board rỗng đúng geometry rồi đặt từng entry `{id, side, type, coordinate}`.
- Derive và đối chiếu `pieceCounts`; reject mismatch/collision/duplicate id.
- Kiểm tra mỗi side có nước đi ban đầu khi profile yêu cầu chơi được; không tự kết thúc vì chỉ đứng trên goal.
- Giữ generator/seed legacy `rps-v1/rps-v2` qua adapter tương thích.

### Slice 4 — Movement enumerator

- `RAY`: duyệt từng direction hữu hạn từ min đến max; nếu `canJump=false` thì ô trung gian chặn đường, nếu `true` thì bỏ qua ô trung gian; destination vẫn áp capture/blocking policy.
- `LEAP`: chỉ duyệt tập offset hữu hạn, không kiểm ô trung gian và không ăn quân ở giữa.
- Profile được chọn theo `side × type`; thứ tự kết quả deterministic.
- Giữ RPS `R>S`, `P>R`, `S>P`, friendly/same-type/losing attacker như legacy.

### Slice 5 — Engine integration và regression

- `hasLegalMove`, `evaluateTurnStart`, extinction/goal legacy dùng geometry/profile của state.
- Không đổi semantics v1: 9×9, BLUE first, static goals, OR terminal và object immutability.
- Chạy focused unit/harness, package typecheck và full game-rules regression; ghi log/counters cho cap và thời gian enumerate board 15×15.

## 5. Acceptance criteria quan sát được

- **N01-AC01 Legacy:** toàn bộ `game-rules.unit.test.ts`, `l01-w3-entropy.unit.test.ts` và existing consumers tiếp tục PASS; `createInitialState()` không đổi shape/18 pieces/goal/rotation.
- **N01-AC02 Geometry:** mọi `rows/cols` từ 5 đến 15, kể cả chữ nhật, enumerate đúng số ô; 4 biên và `a10/o15` được parse đúng; ngoài bounds bị reject.
- **N01-AC03 Layout/counts:** mỗi ô tối đa một quân, không có entry ngoài board/duplicate id; counts khớp layout cho cả ba type và hai side.
- **N01-AC04 RAY:** direction/min/max hữu hạn; blocker chặn đúng khi không jump; jump không làm mất destination blocking/capture.
- **N01-AC05 LEAP:** offset không zero, hữu hạn, không bị blocker trung gian; destination ngoài board không xuất hiện.
- **N01-AC06 Side/type:** cùng một ô có thể cho kết quả khác nhau theo side/type profile; không fallback âm thầm sang profile của bên kia.
- **N01-AC07 Terminal safety:** initial setup không auto-win; natural win chỉ phát sinh từ accepted move theo policy đang được state pin.
- **N01-AC08 Immutability:** rejected move trả lại cùng state; accepted move không mutate input và output frozen/deterministic.
- **N01-AC09 Cap/performance:** overflow pattern/offset bị xử lý theo lựa chọn MCQ; có measured evidence trên board 15×15, không chỉ mock.
- **N01-AC10 Evidence:** focused test report, typecheck output và known gaps/NOT RUN được ghi; không đánh dấu DONE nếu G0 hoặc runtime consumer ngoài N01 chưa đạt.

## 6. File ownership và kiểm tra

**Được sửa:** `packages/game-rules/src/types.ts`, `coordinates.ts`, `setup.ts`, `engine.ts`, `index.ts`; `tests/unit/l01-harness.unit.test.ts` và fixture test cục bộ nếu cần.  
**Không sửa trong N01:** `packages/contracts`, server/router, Prisma, SDK ABI, web components, shared styles, runtime Python/WASM.

Focused commands sau khi dev:

```text
node_modules/.bin/vitest.cmd run tests/unit/l01-harness.unit.test.ts tests/unit/game-rules.unit.test.ts tests/unit/l01-w3-entropy.unit.test.ts
node_modules/.bin/tsc.cmd -p packages/game-rules/tsconfig.json --noEmit
```

## 7. MCQ cần chốt trước plan final

**Kết quả review của Nam:** Q1=A, Q2=A, Q3=A, Q4=A, Q5=A.

Các quyết định đã chốt:

- Enforce cap ngay trong `validateRuleProfile`: tối đa 16 patterns cho mỗi `side × type`, tối đa 225 LEAP offsets cho mỗi profile; phải đo trên board 15×15.
- Dùng movement shape `RAY(directions, minDistance, maxDistance, canJump)` và `LEAP(offsets)` theo từng `side × type`; không script/multi-segment.
- Nhận `layout` explicit cho từng quân; derive và validate `pieceCounts`; seed chỉ là adapter cho legacy/v2.
- Mở rộng coordinate lên `a..o` và `1..15`, state pin geometry; giữ public legacy calls; contracts chỉ đổi ở N02.
- Chỉ bắt đầu harness/code sau independent re-review xác nhận G0 PASS.

### Q1 — Cap movement

**A (khuyến nghị):** enforce ngay trong `validateRuleProfile`: tối đa 16 patterns cho mỗi `side × type`, tối đa 225 LEAP offsets cho mỗi profile; đo thời gian enumerate 15×15.  
**B:** chỉ đo và cảnh báo ở N01, defer reject sang N02.

### Q2 — Shape movement

**A (khuyến nghị):** `RAY` gồm `directions[] + minDistance + maxDistance + canJump`; `LEAP` gồm `offsets[]`; profile độc lập cho từng `side × type`; không script/multi-segment.  
**B:** chỉ hỗ trợ preset tên (ORTHOGONAL/DIAGONAL/KNIGHT), không cho vector/offset tùy chỉnh.

### Q3 — Initial layout

**A (khuyến nghị):** `layout` explicit cho từng quân, `pieceCounts` được derive và validate; generator seed chỉ là adapter cho legacy/v2.  
**B:** chỉ nhận counts + seed và để engine tự suy layout.

### Q4 — Coordinate compatibility

**A (khuyến nghị):** mở rộng parser/type lên `a..o` và `1..15`, state pin geometry; giữ nguyên public legacy calls; contracts 9×9 chỉ đổi ở N02 khi có contract writer.  
**B:** tạo một `DynamicCoordinate`/engine song song để không đụng `Coordinate` hiện tại.

### Q5 — Gate thực thi

**A (khuyến nghị):** chỉ bắt đầu Slice 1 sau khi independent re-review xác nhận G0 PASS; plan này được review trước nhưng N01 vẫn HOLD.  
**B:** cho phép code N01 ngay khi G0 còn HOLD.

