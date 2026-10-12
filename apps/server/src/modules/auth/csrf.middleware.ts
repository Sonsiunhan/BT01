import type { FastifyRequest, FastifyReply, onRequestHookHandler } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

// ecc:contract-first
export const CsrfHeaderSchema = z.object({
  'x-ott-request': z.literal('1'),
  'origin': z.string().url().optional(),
  'referer': z.string().url().optional()
}).refine(data => data.origin || data.referer, {
  message: 'Missing Origin and Referer'
});

export function csrfMiddleware(allowedOrigins: readonly string[]): onRequestHookHandler {
  const allowlist = new Set(allowedOrigins);
  return async function csrfGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    // ecc:security-review (CSRF Protection - state changing routes)
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutationMethods.includes(req.method)) return;

    // 1. Verify headers via the machine-checkable contract.
    const headersObj = {
      'x-ott-request': req.headers['x-ott-request'],
      origin: req.headers.origin,
      referer: req.headers.referer,
    };

    const parsed = CsrfHeaderSchema.safeParse(headersObj);
    if (!parsed.success) {
      throw new AppError("UNAUTHORIZED", "Yêu cầu CSRF không hợp lệ.", 403, false, "INVALID", { reason: "INVALID_CSRF_TOKEN" });
    }

    const origin = parsed.data.origin;
    const referer = parsed.data.referer;
    if (allowlist.size === 0) {
      throw new AppError("SERVICE_UNAVAILABLE", "Bảo vệ CSRF chưa được cấu hình.", 503, true, "RECOVERABLE", { reason: "CSRF_NOT_CONFIGURED" });
    }

    // Origin has precedence. A valid Referer cannot rescue an invalid Origin.
    let valid = false;
    if (origin) {
      valid = allowlist.has(origin);
    } else if (referer) {
      try { valid = allowlist.has(new URL(referer).origin); } catch { valid = false; }
    }
    if (!valid) throw new AppError("UNAUTHORIZED", "Origin hoặc Referer không được phép.", 403, false, "INVALID", { reason: "CSRF_ORIGIN_NOT_ALLOWED" });
  };
}
