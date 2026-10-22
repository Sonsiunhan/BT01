# Architecture Decision Records (ADRs) & Acceptance Brief — Long (L00–L13)

Tài liệu này áp dụng hai kỹ năng ECC:
1. **`architecture-decision-records`** (`.agents/skills/architecture-decision-records/SKILL.md`): Ghi lại các quyết định kiến trúc cốt lõi của mảng Foundation & Core (`L00`–`L13`).
2. **`intent-driven-development`** (`.agents/skills/intent-driven-development/SKILL.md`): Chuyển hóa đặc tả BA+SA (`OTTv2_Dac_Ta_BA_SA_Khoi_Tao_Giai_v1.0.md`) thành bộ tiêu chí nghiệm thu quan sát được (`AC-L01`..`AC-L13`), tách biệt rõ sự thật kỹ thuật trong mã nguồn với các mặc định đề xuất tại Mục 15 đang chờ duyệt (`Gate G0`).

---

## Phần 1 — Architecture Decision Records (ADRs)

### ADR-T001: Kiến trúc Single-Writer Port & Dual-Mode Repository (In-Memory + Prisma)

- **Date:** 2026-10-21
- **Status:** accepted
- **Deciders:** Long (Core & Foundation Owner)

#### Context
Theo `DELIVERY-PLAN.md` mục 5 và `AGENTS.md`, Long sở hữu `prisma/schema.prisma`, `@ottv2/contracts`, `apps/server/src/app.ts` và các giao dịch cốt lõi của giải đấu, trong khi Nam, Sơn và Đức phát triển song song các module luật/SDK, shell/console và identity/roster. Đồng thời, trên máy trạm hiện tại không chạy sẵn PostgreSQL daemon (`Blocker B1` đã ghi nhận từ `L06-W0`), và quy tắc dự án nghiêm cấm chạm vào `DATABASE_URL` mặc định.

#### Decision
Chúng tôi định nghĩa giao diện `TournamentRepositoryPort` và `AuditPort` cố định tại `apps/server/src/modules/tournament-foundation/`, kèm hai cài đặt tương đương ngữ nghĩa 100%:
1. `InMemoryTournamentRepository` có khóa tuần tự (mutex lane) và kiểm tra CAS (`expectedRevision`, `casRevision`, `idempotencyKey`) để chạy kiểm thử đơn vị/tích hợp/đồng thời tức thời mà không phụ thuộc tiến trình DB ngoài.
2. `PrismaTournamentRepository` thực thi qua `PrismaClient.$transaction` dùng cho môi trường có PostgreSQL disposable DB đã qua `validateDisposableDbUrl` guard.

#### Alternatives Considered
- **Alternative 1: Chỉ viết code phụ thuộc cứng vào kết nối PostgreSQL sống.**
  - *Why not:* Sẽ làm toàn bộ kiểm thử tích hợp và E2E bị chặn đứng bởi `Blocker B1` khi máy test không bật dịch vụ PostgreSQL, hoặc dẫn đến nguy cơ dùng mock lỏng lẻo ở từng bài test.
- **Alternative 2: Để từng trang (Sơn/Nam/Đức) tự ghi trực tiếp vào bảng `Tournament` và `Contract`.**
  - *Why not:* Vi phạm quy tắc single-writer và gây lỗi race condition trên hạn mức hợp đồng (`quota_used`), phiên bản cấu hình (`config_version`) và phán quyết phân xử (`finish_sequence`).

#### Consequences
- **Positive:** Đảm bảo 100% logic nghiệp vụ, CAS, idempotency và phân quyền được kiểm chứng bằng cả unit/contract/integration tests tốc độ cao lẫn kiểm tra tương thích schema Prisma.
- **Negative:** Cần duy trì parity giữa `InMemoryTournamentRepository` và `PrismaTournamentRepository` (được kiểm soát bằng kỹ năng `ai-regression-testing`).

---

### ADR-T002: Sổ cái Hạn mức Hợp đồng Nguyên tử & Hoàn lượt Đúng Một Lần (`TournamentQuotaLedger`)

- **Date:** 2026-10-21
- **Status:** accepted
- **Deciders:** Long

#### Context
Theo `BR-05` và `T012`–`T015`, hạn mức `max_tournaments` thuộc về Hợp đồng (`TournamentContract`), dùng chung cho mọi `TOURNAMENT_ADMIN` được gán vào hợp đồng đó. Tạo `DRAFT` phải giữ 1 lượt; xóa `DRAFT` hoặc bị `REJECTED` hoàn đúng 1 lượt; giải từng được `APPROVED` nếu bị `CANCELLED` tuyệt đối không được hoàn lượt; gọi lặp lại (retry) không được trừ hoặc hoàn 2 lần.

#### Decision
Mọi biến động của `quotaUsed` trên `TournamentContract` bắt buộc đi qua sổ cái `TournamentQuotaLedger` trong cùng giao dịch nguyên tử:
- Khi tạo nháp (`RESERVE`): khóa bản ghi hợp đồng, kiểm tra `idempotencyKey` (hoặc `RESERVE:${tournamentId}`), kiểm tra `quotaUsed < maxTournaments`, tăng `quotaUsed += 1` và ghi dòng `TournamentQuotaLedger`.
- Khi xóa nháp hoặc từ chối hồ sơ (`REFUND_DRAFT_DELETE` / `REFUND_REJECTED`): kiểm tra giải chưa từng có bản ghi `APPROVED` (`everApproved === false`) và chưa từng có dòng hoàn lượt cho `tournamentId` đó trong `TournamentQuotaLedger`; nếu thỏa mãn mới giảm `quotaUsed -= 1` và ghi sổ cái hoàn lượt.

#### Alternatives Considered
- **Alternative 1: Chỉ cộng/trừ trường số nguyên `quotaUsed` mà không lưu ledger theo `tournamentId`.**
  - *Why not:* Khi request xóa nháp hoặc từ chối bị retry do lỗi mạng, hoặc khi có race condition giữa hai request, hệ thống có thể hoàn lượt 2 lần làm `quotaUsed` bị lệch âm.

#### Consequences
- **Positive:** Chống tuyệt đối lỗi nhân đôi nháp khi retry và lỗi hoàn lượt kép (`T013`, `T014`, `T015`).

---

### ADR-T003: Phân xử Thủ công CAS (`MANUAL_ADMIN`) và Sổ cái Điểm `finish_sequence`

- **Date:** 2026-10-21
- **Status:** accepted
- **Deciders:** Long, Nguyễn Tiến Nam

#### Context
Theo mục 10.4, 15 và `T059`–`T060`, `T081`:
- Khi trận đấu kết thúc với các tiêu chí phụ hoàn toàn bằng nhau (`exact tie`) và giải cấu hình `final_tie_policy = MANUAL_ADMIN`, trận đấu chuyển sang trạng thái chờ phân xử (`WAITING`), khóa bàn cờ/đồng hồ và giải phóng ngay worker Bot.
- Tuy nhiên, các trận đấu khác trong giải vẫn tiếp tục diễn ra và kết thúc. Khi TA ra quyết định (hoặc hết hạn `deadline_at` 300s áp dụng `adjudication_fallback`), kết quả của trận đấu này đến muộn hơn các trận kết thúc sau nó. Nếu tính điểm sàn 0 (`score_floor = 0`) và Elo theo thứ tự thời điểm TA bấm nút, kết quả BXH sẽ bị sai lệch.

#### Decision
1. Ngay tại thời điểm gameplay kết thúc (`gameplayFinishedAt`), hệ thống cấp một số thứ tự đơn điệu toàn giải `finishSequence` (`1, 2, 3...`), kể cả khi kết quả trận đang ở trạng thái `WAITING` chờ phân xử thủ công.
2. Quyết định phân xử (`RESOLVED_MANUAL`), hết hạn tự động (`RESOLVED_TIMEOUT` khi `serverNow >= deadlineAt`), hoặc hủy giải (`CANCELLED_ABORTED`) đều cập nhật trạng thái thông qua CAS (`status === 'WAITING'` và `casRevision`), đảm bảo chỉ đúng **một** kết quả được ghi nhận.
3. Khi một trận ở `finishSequence = k` được chốt kết quả (hoặc khi có kết quả đến trễ hơn `finishSequence > k` đã tính trước đó), bộ máy sổ cái `TournamentResultLedger` thực hiện replay lại chuỗi điểm (`score = max(0, score + delta)`) và `tournamentElo` theo đúng thứ tự chuẩn `finishSequence` tăng dần và tăng `projectionGeneration` nguyên tử.

#### Alternatives Considered
- **Alternative 1: Cộng trừ điểm trực tiếp vào bảng thí sinh tại thời điểm TA bấm nút phân xử.**
  - *Why not:* Vi phạm `BR-17` và `T081` vì hiệu ứng sàn điểm 0 (`Math.max(0, score + delta)`) và hệ số Elo phụ thuộc vào thứ tự trận đấu kết thúc thực tế (`finish_sequence`), không phải thứ tự hoàn tất của worker hay thời điểm TA phản hồi.

#### Consequences
- **Positive:** Đảm bảo tính tất định 100% của điểm số và Elo bất kể độ trễ phân xử thủ công hay retry (`T060`, `T081`).

---

## Phần 2 — Acceptance Brief (Intent-Driven Development)

### Phân tách Sự thật Kỹ thuật vs. Đề xuất chờ duyệt Gate G0

- **Discovered Technical Facts (từ source repository):**
  - Monorepo dùng `pnpm`, TypeScript, Fastify (`apps/server`), React + Vite (`apps/web`), Prisma PostgreSQL (`prisma/schema.prisma`), Zod (`@ottv2/contracts`).
  - `AuthService` hiện quản lý phiên đăng nhập qua cookie `ottv2_session` và phiên khách qua `ottv2_guest`.
  - `scripts/network/disposable-db.mjs` cung cấp bộ kiểm tra an toàn 3 điều kiện cho cơ sở dữ liệu kiểm thử dùng một lần (`TEST_DATABASE_URL`).
- **Product / Business Constraints & Section 15 Candidate Defaults (`WAITING_G0`):**
  - Toàn bộ các giá trị mặc định chi tiết ở Mục 15 của đặc tả (`board 5..15`, `max_plies = 120` cho Bot, `adjudication_timeout_seconds = 300`, `adjudication_fallback = SECOND_MOVER_WINS`, `ELO_WEIGHTED_V1` base `10/5/0` với `score_floor = 0`, `data_retention_days = 90`, `max_participants_total` tính tổng lượt ghi danh qua các giải thuộc hợp đồng) được cài đặt dưới dạng **hằng số chính sách cấu hình được (`CANDIDATE_POLICY_DEFAULTS_V1`)**, sẵn sàng phục vụ kiểm thử candidate nhưng vẫn ghi nhận rõ trạng thái `Gate G0: HOLD` cho đến khi có phê duyệt chính thức.

### Danh mục Tiêu chí Nghiệm thu (`AC-L01` .. `AC-L10`)

| Mã AC | Liên kết T-ID | Kịch bản & Hành động | Kết quả Quan sát được (Expected) | Điều cấm (Must Not) | Phương pháp Kiểm chứng |
|---|---|---|---|---|---|
| **AC-L01** | `T011`, `T020`, `T071` | Validate payload tạo/sửa đơn vị, hợp đồng, nháp giải và đổi chế độ điều khiển/đích | Các trường ẩn được chuẩn hóa về `not-applicable`/default rõ ràng; lỗi trả về đúng `ErrorEnvelope` kèm tên trường | Không giữ cờ nguy hiểm của mode cũ; không cho phép sửa `ownerUserId` hay `configVersion` từ payload | Contract & Unit tests (`tests/contract/tournament-l01.contract.test.ts`) |
| **AC-L02** | `T012`, `T013`, `T014`, `T015` | Hai TA cùng tạo giải trên lượt hạn mức cuối; xóa nháp; SA từ chối; hủy giải đã duyệt | Chỉ 1 nháp được tạo khi hết hạn mức; xóa nháp/từ chối hoàn đúng 1 lượt; hủy giải từng `APPROVED` không hoàn lượt | Không nhân hạn mức theo số TA; không hoàn lượt 2 lần khi retry | Concurrency & Unit tests (`tests/unit/tournament-l02-core.unit.test.ts`) |
| **AC-L03** | `T002`, `T011`, `T016`, `T018` | SA thao tác CRUD Đơn vị (`P06`) và Hợp đồng/Gán TA (`P07`); xóa đơn vị đang dùng | Tạo/sửa/khóa đơn vị và hợp đồng thành công; chặn xóa đơn vị đang có FK (`409 CONFLICT`); hết hạn 1 hợp đồng chỉ thu hồi binding đó | Không cho TA tạo đơn vị/hợp đồng; không khóa toàn bộ tài khoản khi 1 hợp đồng hết hạn | API + React UI tests (`P06`, `P07`) |
| **AC-L04** | `T003`, `T022` | SA xem hộp duyệt (`P08`) và thực hiện `APPROVED` / `REJECTED` / `CHANGES_REQUESTED` | Lưu đúng `approvedSnapshot` bất biến và `fieldNotes`; `REJECTED` hoàn đúng 1 lượt hạn mức | Không cho TA tự duyệt giải của mình; không duyệt lặng lẽ lịch đã quá hạn | API + React UI tests (`P08`) |
| **AC-L05** | `T024`, `T025`, `T026`, `T061` | Sửa trường khóa sau duyệt; publish luật trong/ngoài envelope; kiểm tra `READY` | Sửa trường khóa tạo `ChangeRequest` riêng không lùi trạng thái giải; chỉ `READY` khi đủ roster, Referee accepted, ACK điều lệ, Bot receipt và runtime | Không cấp `READY` giả; không tự chuyển `RUNNING` khi đến `start_at` mà còn blocker | Lifecycle & Readiness tests |
| **AC-L06** | `T005`, `T075`, `BR-15` | Admin hoặc Guest/User ngoài gọi vào hàng đợi/phòng Online khi có giải `RUNNING`/`PAUSED` | Cổng `C32` từ chối `403 FORBIDDEN` mọi lượt vào chơi Online mới; cho phép nối lại trận đã tạo, công cụ Offline và quan sát đúng quyền | Không chỉ ẩn nút ở UI mà bỏ ngỏ API `/matchmaking/queue` hoặc `/rooms` | Admission integration tests |
| **AC-L07** | `T027`, `T028`, `T029`, `T030` | Tạm dừng (`PAUSED`), tiếp tục (`RUNNING`), chạm mốc `end_at` (`ENDED`), và hủy giải (`CANCELLED`) | `PAUSED` dừng nhận trận mới; quá `end_at` tự chuyển `ENDED` không bù giờ; `CANCELLED` đóng các yêu cầu phân xử `WAITING` qua CAS | Không cho hủy giải đã `ENDED`/`FINALIZED`; không chốt `FINALIZED` khi còn phân xử chưa xong | Fake-time boundary tests |
| **AC-L08** | `T009`, `T059`, `T060`, `T072`, `T073`, `T081` | Trận đấu hòa tuyệt đối mở request `WAITING`; TA phân xử vs hết hạn 300s vs hủy giải; kết quả đến trễ | Đúng 1 phán quyết được ghi qua CAS; `now >= deadline` ưu tiên `fallback`; sổ cái điểm replay theo `finish_sequence` với sàn điểm 0 | Không cộng điểm 2 lần; không cho SA/Referee/Player gọi endpoint phân xử của TA chủ giải | Concurrency & Replay ledger tests |
