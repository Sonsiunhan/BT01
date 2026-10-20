# D-02.03 CSRF Test Fixtures

Sẽ được sử dụng khi Long hoàn tất đấu nối `csrf.middleware.ts` vào router.

| Test ID | Đầu vào (Input / Request) | Kết quả kỳ vọng (Expected) |
|---|---|---|
| `D-02.03-POS` | `POST /auth/login`, `Origin: [ALLOWED_ORIGIN]`, `X-OTT-Request: 1` | `200 OK` (hoặc response logic tương ứng) |
| `D-02.03-NEG1` | `POST /auth/login`, `Origin: https://evil.com`, `X-OTT-Request: 1` | `403 FORBIDDEN` (Origin not allowed) |
| `D-02.03-NEG2` | `POST /auth/login`, `Origin: null`, `X-OTT-Request: 1` | `403 FORBIDDEN` (Invalid origin/referer) |
| `D-02.03-NEG3` | `POST /auth/login`, `X-OTT-Request: 1` (no origin/referer) | `403 FORBIDDEN` (Missing origin and referer) |
| `D-02.03-NEG4` | `POST /auth/login`, `Origin: [ALLOWED_ORIGIN]`, No `X-OTT-Request` | `403 FORBIDDEN` (Missing X-OTT-Request header) |
| `D-02.03-NEG5` | `POST /auth/login`, `Content-Type: text/plain`, `Origin: [ALLOWED_ORIGIN]` | `403 FORBIDDEN` hoặc `400 BAD REQUEST` (Schema fallback chặn) |

*Ghi chú:*
Thử nghiệm sẽ được chạy nội bộ, cô lập DB và dùng biến môi trường test.
