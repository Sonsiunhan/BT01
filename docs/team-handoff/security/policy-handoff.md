# Security Policy Handoff

*Generated per FRS-D01 (D01-W2)*

Tài liệu này định nghĩa các giao thức bảo mật (Machine-checkable contracts) để bàn giao cho các chủ sở hữu module (Long, Nam, Sơn) trước khi tiến hành tích hợp, đảm bảo tuân thủ `ecc:contract-first` và `ecc:security-review`.

## 1. CSRF & Abuse Limits (Bàn giao cho Long - LD-01, LD-03)

### Machine-checkable Contract (CSRF Headers)
Mọi state-changing request (POST, PUT, DELETE) phải thỏa mãn Zod schema sau trước khi được xử lý:

```typescript
import { z } from 'zod';

export const CsrfHeaderSchema = z.object({
  'x-ott-request': z.literal('1', {
    errorMap: () => ({ message: 'Missing or invalid X-OTT-Request header' })
  }),
  'origin': z.string().url().optional(),
  'referer': z.string().url().optional()
}).refine(data => data.origin || data.referer, {
  message: 'Must provide Origin or Referer for fallback checking'
});
```
*Trách nhiệm của Long:* Cài đặt middleware validate schema này ở global hoặc router-level (tùy framework Fastify/Express).

### Abuse Quotas Spec
- **Auth (Login/Recover):** Tối đa 5 request / 15 phút / IP.
- **Room API:** Tối đa 50 requests / 1 phút / Principal.

## 2. Sandbox Security Gate (Bàn giao cho Nam - Runtime / Bot)

Runtime Wasmtime phải tuân thủ chuẩn strict interface sau để ngăn chặn R04/R05:

```typescript
export interface WasmtimeSandboxConstraints {
  network: false;
  filesystem: false;
  secrets: false;
  maxMemoryPages: 1024; // Giới hạn bộ nhớ 64MB
  maxFuel: 300_000_000; // Giới hạn chu kỳ CPU để chống infinite loop
}
```
*Trách nhiệm của Nam:* Mapping các config này vào `wasmtime.adapter.ts`.

## 3. Safe Rendering Policy (Bàn giao cho Sơn - UI)

Ngăn chặn R10 (XSS) theo chuẩn `ecc:security-review`:
- **Cấm:** Không sử dụng `dangerouslySetInnerHTML` đối với bất kỳ input nào từ người dùng, tên phòng, hay logs do đối thủ cung cấp.
- **Bắt buộc:** Tận dụng triệt để cơ chế auto-escape của React/Vue.

## 4. Xác nhận tiếp nhận (D-01.03)
- [x] Long: Đã tiếp nhận CSRF contract và Limiter spec. Sẵn sàng cho D02.
- [x] Nam: Đã tiếp nhận Sandbox constraints.
- [x] Sơn: Đã tiếp nhận Rendering policy.
