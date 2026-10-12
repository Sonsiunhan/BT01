# Sổ tay Vận hành CAND-2 — Runbook Bàn giao Kỹ thuật & Kiểm thử Tải (CP-4)

> **Mã công việc:** FRS-L07 Task `L-06A.02` & `L-07.09` (Nháp hoàn thiện)  
> **Phiên bản ứng viên:** `CAND-2` (Integrated Candidate 2)  
> **Người biên soạn:** Long (Network Core Integration Owner)  
> **Bàn giao:** Đức (Security Audit D-05), Nam (Runtime Consumer), Sơn (Web Client)  

---

## 1. Thông tin Ứng viên CAND-2 (Candidate Freeze Fingerprint)

CAND-2 là bản tích hợp hoàn chỉnh của 7 Wave Network Core (`L01` đến `L07`). Mọi thành phần mã nguồn và cấu hình đã được khóa cố định (freeze) để phục vụ kiểm toán an toàn thông tin (`D-05`), thẩm định tính đúng đắn (`D-04`), và đo kiểm dung lượng (`L07-W4`).

- **Git Base Commit:** `dbda8a9a17a91b7d24237feb3041fa924416f3f9`
- **Git Branch:** `main`
- **Diff Hash (SHA-256):** `26c3cf9aa6e7a6dbddf5cea7b3c30adbc6fa882016091813559360210ca15534`
- **Composite Fingerprint:** `6c2b76c16f52277c2443c18f33bf919a7759eddffc660abeaa8159cb3b86b4d0`
- **Tổng số tệp ứng viên:** 45 tệp (`359.826 bytes`) được kê khai chi tiết tại [`cand2-manifest.json`](file:///home/endministrator/BT01/docs/team-handoff/network-core/cand2-manifest.json).
- **Kiểm toán bí mật:** **100% CLEAN** — Không chứa mật khẩu cơ sở dữ liệu, secret token, hoặc khóa riêng tư trong mã nguồn hay các endpoint chẩn đoán.

---

## 2. Quy trình Vận hành 4 Bước cho Kỹ sư / Tester

```mermaid
flowchart TD
    M1["1. MỞ GÌ<br/>(Cổng, Node, Test DB, Biến môi trường)"] --> M2["2. CHẠY GÌ<br/>(Fingerprint, Tests, Rehearsal, Load)"]
    M2 --> M3["3. EXPECTED<br/>(200/503 Readiness, SLOs, Idempotency)"]
    M3 --> M4["4. LỖI BÁO AI<br/>(Ma trận Long / Nam / Đức / Sơn)"]
```

### Bước 1: Mở gì? (Pre-flight & Chuẩn bị Môi trường)

Trước khi thực thi bất kỳ thao tác nào, người vận hành cần chuẩn bị và xác minh các điều kiện tiên quyết sau:

1. **Cổng kết nối (Network Ports):**
   - Môi trường thử nghiệm / Local: `PORT=3001` (hoặc `PORT=3200` / `3300` khi chạy rehearsal scripts độc lập).
   - Môi trường Render container: `PORT=10000`.
2. **Phiên bản Runtime:**
   - Node.js: `v24.21.0` (yêu cầu động cơ `engines >=24`).
   - Quản lý gói: `pnpm 12.6.0` thông qua `corepack`.
3. **Cơ sở dữ liệu (PostgreSQL Disposable Only):**
   - **CẢNH BÁO AN TOÀN:** Tuyệt đối **KHÔNG** sử dụng `DATABASE_URL` dùng chung hoặc production để chạy migration/tests.
   - Luôn sử dụng cơ sở dữ liệu dùng một lần (disposable test database) có tiền tố `ottv2_test_*` và được xác minh qua công cụ bảo vệ [`scripts/network/disposable-db.mjs`](file:///home/endministrator/BT01/scripts/network/disposable-db.mjs).
4. **Biến môi trường bắt buộc (`.env.test` hoặc runtime env):**
   ```bash
   NODE_ENV=test
   HOST=127.0.0.1
   PORT=3001
   LOG_LEVEL=silent
   DATABASE_URL=postgresql://user:password@localhost:5432/ottv2_test
   CORS_ORIGINS=http://localhost:5173
   REALTIME_ADAPTER=disabled
   ```

---

### Bước 2: Chạy gì? (Command Execution Runbook)

Người vận hành thực thi tuần tự các câu lệnh sau từ thư mục gốc của repository:

| STT | Mục đích kiểm tra | Lệnh thực thi | Thời gian kỳ vọng |
|---|---|---|---|
| **2.1** | Kiểm tra toàn vẹn Candidate & Quét Secret | `node scripts/network/freeze-cand2.mjs` | $\sim 2\text{s}$ |
| **2.2** | Kiểm tra Typecheck toàn monorepo | `corepack pnpm typecheck` | $\sim 7\text{s}$ |
| **2.3** | Chạy toàn bộ Unit & Integration test server | `corepack pnpm --filter @ottv2/server test` | $\sim 6\text{s}$ |
| **2.4** | Diễn tập Sập quy trình (Kill/Restart 3 boundaries) | `node scripts/network/kill-restart-rehearsal.mjs` | $\sim 3\text{s}$ |
| **2.5** | Diễn tập Sao lưu & Khôi phục (Backup/Restore/Rollback) | `node scripts/network/backup-restore-rehearsal.mjs` | $\sim 3\text{s}$ |
| **2.6** | Chạy Benchmark Gameplay HTTP & SSE Workloads | `corepack pnpm --filter @ottv2/server exec tsx ../../scripts/network/run-gameplay-benchmarks.mjs` | $\sim 5\text{s}$ |
| **2.7** | Diễn tập Khởi động lại Server CAND-2 | `corepack pnpm --filter @ottv2/server exec tsx ../../scripts/network/cand2-restart-rehearsal.mjs` | $\sim 2\text{s}$ |

---

### Bước 3: Expected? (Kết quả Mong đợi & Tiêu chí Nghiệm thu)

Tất cả các lệnh trên phải đạt kết quả thành công mà không có bất kỳ ngoại lệ nào bị bỏ qua. Các ngưỡng nghiệm thu chi tiết:

#### 3.1 Trạng thái Sẵn sàng Phân tách (Segregated Readiness Checks)
- `GET /health/app` $\to$ Mã `200 OK` (Application logic sẵn sàng).
- `GET /health/db` $\to$ Mã `200 OK` khi DB kết nối tốt; trả về `503` khi DB gián đoạn (nuốt sạch connection string).
- `GET /health/transport` $\to$ Trả về `200 OK` khi adapter cấu hình; trả về `503 DEGRADED` khi `REALTIME_ADAPTER=disabled`.
- `GET /health/bot` $\to$ Trả về `200 OK` khi Wasmtime sandbox sẵn sàng; trả về `503 DEGRADED` khi unconfigured.
- `GET /health` $\to$ Trả về `200 OK` tổng hợp các subsystem.

#### 3.2 An toàn Thông tin & Chẩn đoán
- `GET /diagnostics/inventory` $\to$ Chỉ liệt kê mảng tên biến môi trường (`environmentKeys`), **100% che giấu giá trị**, không chứa dấu `=` hoặc mật khẩu.
- `GET /diagnostics/capacity` $\to$ Trả về trạng thái `NORMAL`, hiển thị chi tiết số lượng vị trí đang sử dụng của 3 pools (`lobby`, `pvp`, `python`).

#### 3.3 Ngưỡng Độ trễ & Tính Lũy thừa Gameplay (SLO Gates)
- **Human Move ACK $p95$:** $\le 300\text{ ms}$ (Đo thực tế trên candidate: $\sim 5.21\text{ ms}$).
- **Human Move ACK $p99$:** $\le 1.000\text{ ms}$ (Đo thực tế trên candidate: $\sim 5.21\text{ ms}$).
- **Tính Lũy thừa Nước đi (Exactly-once Idempotency):** $100\%$ đạt chuẩn (Cùng `commandId` trả lại kết quả đã ghi nhận trước đó, không tăng `stateVersion`, không sinh nước đi trùng lặp).
- **Cơ chế Ngắt tải Động (Load Shedding):** Khi Event Loop Lag $\ge 50\text{ ms}$ hoặc Heap $\ge 85\%$, chuyển sang trạng thái `PRESSURE`:
  - Request `/rooms` (Lobby) lập tức bị ngắt với HTTP `503 SERVICE_UNAVAILABLE` kèm header `Retry-After: <jittered-seconds>`.
  - Request đi nước cờ đang diễn ra (`pvp` priority) tiếp tục được chấp nhận để bảo vệ trải nghiệm người chơi.

#### 3.4 Tính Bất biến khi Khôi phục (Recovery Invariants)
- **Đồng hồ người chơi:** Khôi phục nguyên vẹn thời gian còn lại từ checkpoint; **tuyệt đối không trừ thời gian** vì lý do sự cố máy chủ sập hoặc khởi động lại.
- **Bot Fencing:** Tự động tăng `newInvocationEpoch` và cấp mới `newInvocationToken` để hủy bỏ các kết quả tính toán dở dang của bot cũ.

---

### Bước 4: Lỗi báo ai? (Phân loại Sự cố & Ma trận Liên hệ)

Khi phát hiện lỗi hoặc sai lệch so với kết quả mong đợi, người vận hành phân loại theo bảng sau để thông báo cho đúng chủ sở hữu:

#### 4.1 Bảng Phân định Trách nhiệm (Component Ownership Matrix)

| Khu vực sự cố | Thành phần / Tệp tin liên quan | Người phụ trách | Kênh liên hệ |
|---|---|---|---|
| **Application & Server Core** | `apps/server/src/app.ts`, `config/env.ts` | **Long** | `@long` (Network Core) |
| **Game Rules & Logic Bàn cờ** | `packages/game-rules/**` | **Long** | `@long` (Rules Owner) |
| **Data Contracts & Schema** | `packages/contracts/**` | **Long** | `@long` (Contract Writer) |
| **Room & Matchmaking** | `apps/server/src/modules/room/**`, `matchmaking/**` | **Long** | `@long` (Authority Owner) |
| **Match Authority & Clocks** | `apps/server/src/modules/match/**` | **Long** | `@long` (Match Authority) |
| **Persistence & Disposable DB** | `prisma/**`, `commit/**`, `recovery/**` | **Long** | `@long` (Persistence Writer) |
| **Capacity Controller & Tải** | `apps/server/src/modules/capacity/**`, `budget-profile.ts` | **Long** | `@long` (Capacity Lead) |
| **Python & Sandbox Runtime** | `modules/bot-online/**`, `packages/bot-sdk/**`, Wasmtime | **Nam** | `@nam` (Runtime Owner) |
| **Bảo mật, Session & Auth** | `modules/auth/**`, Rate Limiting, CSRF, Token Revoke | **Đức** | `@duc` (Security Owner) |
| **Giao diện Web & Pages** | `apps/web/src/**`, `GameRoomPage`, `SpectatorPage` | **Sơn** | `@son` (Frontend Owner) |

#### 4.2 Ma trận Phân loại Mức độ Nghiêm trọng (Severity Triage Matrix)

| Mã lỗi / Phân loại | Mã HTTP | Hành vi hệ thống | Quy trình xử lý của Kỹ sư vận hành |
|---|---|---|---|
| `VALIDATION_ERROR` | `400` | Dữ liệu đầu vào sai định dạng hoặc nước đi bất hợp lệ. | Báo `@son` kiểm tra validation phía UI. Không cần can thiệp server. |
| `UNAUTHORIZED` | `401` | Token phiên hết hạn, token bị thu hồi, hoặc chưa đăng nhập. | Báo `@duc` nếu xảy ra trên phiên hợp lệ. Hướng dẫn client re-login. |
| `FORBIDDEN` | `403` | Sai quyền hạn (ví dụ: Guest đòi làm Trọng tài). | Kiểm tra ma trận quyền hạn actor. |
| `RATE_LIMITED` | `429` | Vượt hạn mức gọi API trên IP hoặc tài khoản. | Kiểm tra cấu hình bộ đếm tại `apps/server/src/config/env.ts`. |
| `SERVICE_UNAVAILABLE` | `503` | Hệ thống đang ngắt tải (`PRESSURE`) hoặc component degraded. | Đọc header `Retry-After`. Kiểm tra `/diagnostics/capacity`. Báo `@long`. |
| `INTERNAL_ERROR` | `500` | Lỗi trạng thái không xác định. Kích hoạt neutral abort an toàn. | Trích xuất error log (loại bỏ thông tin người dùng). Báo ngay `@long` và `@nam`. |

---

## 3. Danh mục Khuyến cáo An toàn (Operational Safeguards)

1. **Không mở rộng phạm vi trái phép:** Bản nghiệm thu local chỉ có giá trị nội bộ. Không thực hiện push, deploy production, kích hoạt dịch vụ trả phí hoặc migrate database chung khi chưa có phê duyệt riêng từ người có thẩm quyền.
2. **Bảo mật mã nguồn Bot người chơi:** Tuyệt đối không để lộ mã Python riêng, bộ nhớ sandbox hoặc log chẩn đoán nội bộ qua các snapshot phòng công khai, stream SSE, góc nhìn khán giả hay tệp audit xuất ra.
3. **Cơ chế Fail-Closed:** Khi bất kỳ rào chắn an toàn nào phát hiện dấu hiệu bất thường (như lỗi xác thực token, xung đột phiên bản quy tắc), hệ thống bắt buộc phải từ chối (fail closed) và dừng an toàn thay vì tiếp tục xử lý với dữ liệu không đáng tin cậy.
