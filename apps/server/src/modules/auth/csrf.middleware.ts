import { FastifyRequest, FastifyReply } from 'fastify';
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

export async function csrfMiddleware(req: FastifyRequest, reply: FastifyReply) {
  // ecc:security-review (CSRF Protection - state changing routes)
  const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutationMethods.includes(req.method)) {
    return;
  }

  // 1. Verify Headers via Contract Schema
  const headersObj = {
    'x-ott-request': req.headers['x-ott-request'],
    'origin': req.headers['origin'],
    'referer': req.headers['referer']
  };

  const parsed = CsrfHeaderSchema.safeParse(headersObj);
  if (!parsed.success) {
    throw new AppError("FORBIDDEN", "INVALID_CSRF_TOKEN", 403, false, "CRITICAL", {
      details: parsed.error.issues
    });
  }

  const origin = parsed.data.origin;
  const referer = parsed.data.referer;
  
  // 2. Strict Origin/Referer Allowlist Check
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
  if (allowedOrigins.length === 0 || allowedOrigins[0] === '') {
    // Fail safe: nếu không configure, từ chối mọi mutation
    throw new AppError("FORBIDDEN", "CSRF_NOT_CONFIGURED", 403, false, "CRITICAL");
  }
  
  let valid = false;
  if (origin) {
    if (allowedOrigins.includes(origin)) valid = true;
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (allowedOrigins.includes(refererUrl.origin)) valid = true;
    } catch {
      // invalid URL
    }
  }

  if (!valid) {
    throw new AppError("FORBIDDEN", "Origin/Referer not allowed", 403, false, "CRITICAL");
  }
}
