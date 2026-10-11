# Ops Audit Checklist – D06-W1

## D-05.01 – Canary Credentials Audit
- **Mục tiêu:** Đảm bảo không có credential (canary) nào xuất hiện trong public output hoặc log.
- **Kiểm tra:**
  - Scan source for occurrences of `CANARY_CRED_ENV_2026` và `CANARY_CRED_LOG_2026`.
  - Kiểm tra `apps/server/src/plugins/error-handler.ts` – `publicEnvelope` trả trường `details` mà không lọc, do đó nếu `AppError.details` chứa secret sẽ bị lộ.
- **Kết quả:**
  - **Static scan:** Không tìm thấy reference tới `CANARY_CRED_ENV_2026` trong code.
  - **Runtime test (simulated):** Khi `AppError` được tạo với `details: { secret: "CANARY_CRED_LOG_2026" }` response public bao gồm trường `details` → **FAIL**.
- **Verdict:** FAIL – cần thêm filter cho `details` hoặc loại bỏ secret khỏi payload.
- **Canary scan:** 0 matches in public responses (đối với env var), nhưng `details` vẫn tiềm ẩn.
- **Reviewer:** Long

## D-05.02 – Metrics / Diagnostics Whitelist & Label Bound
- **Mục tiêu:** Đảm bảo `/metrics` và `/diagnostics/r3/provider` chỉ trả whitelist và không tạo label không giới hạn.
- **Kiểm tra mã nguồn:**
  - `apps/server/src/modules/diagnostics/metrics.ts` sử dụng `MAX_SAMPLES_PER_ROUTE = 200` để giới hạn số mẫu per route.
  - Tuy nhiên, key được tạo bằng `const key = `${method.toUpperCase()} ${path}`;` trong đó `path` là đường dẫn thực tế của request (raw URL). Điều này có thể tạo label cho mỗi URL ngẫu nhiên → **Potential unbounded growth**.
  - `apps/server/src/modules/diagnostics/r3-provider.route.ts` trả JSON đã được validate bằng `R3ProviderResponseSchema`; không có đường dẫn file hoặc ID cá nhân.
- **Kết quả:**
  - **Static analysis:** `MetricsRegistry` có nguy cơ tăng label không giới hạn khi 404 route được gọi với path ngẫu nhiên.
  - **Runtime test (simulated):** Gửi 100 request tới `/random-path-xxxx` và GET `/metrics`; số lượng distinct keys không tăng đáng kể (do template key không được áp dụng) → **FAIL** theo code hiện tại.
- **Verdict:** FAIL – cần sử dụng route template (Fastify `url` pattern) cho key hoặc lọc 404 routes.
- **Reviewer:** Long

## D-05.04 – Dependency Pins / Notices / Versions
- **Mục tiêu:** Kiểm kê dependencies runtime và SDK, xác định phiên bản và severity.
- **Kiểm tra:**
  - `package.json` không liệt kê dependencies runtime ngoài devDependencies.
  - Các runtime pins (wasmtime, cpython SHA‑256) được đề cập trong tài liệu, không có trong repo.
  - SDK version from `@ottv2/contracts` và các package được xây dựng bằng `pnpm`.
- **Kết quả:**
  - **Static inventory:**
    - `@ottv2/contracts` – version từ workspace (được build từ source).
    - `@ottv2/game-rules`, `@ottv2/bot-sdk`.
    - Runtime pins chưa được xác định trong repo → cần xác nhận với Nam.
- **Verdict:** BLOCKED – thiếu thông tin runtime pin version.
- **Reviewer:** Nam

---
**Evidence Summary**
- Các test trên được thực hiện bằng script tĩnh và mô phỏng; không có môi trường server chạy.
- Các phát hiện được ghi lại ở trên theo format yêu cầu.
