import { z } from "zod";

export const MAX_JSON_PAYLOAD_BYTES = 128 * 1024;
export const MAX_SOURCE_BYTES = 64 * 1024;
export const MAX_JSON_DEPTH = 10;

export function validateJsonDepth(
  obj: unknown,
  maxDepth = MAX_JSON_DEPTH,
  currentDepth = 0
): boolean {
  if (currentDepth > maxDepth) {
    return false;
  }

  if (obj === null || typeof obj !== "object") {
    return true;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!validateJsonDepth(item, maxDepth, currentDepth + 1)) {
        return false;
      }
    }
    return true;
  }

  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (!validateJsonDepth(value, maxDepth, currentDepth + 1)) {
      return false;
    }
  }

  return true;
}

export function validateUtf8ByteLength(str: string, maxBytes: number): boolean {
  if (typeof str !== "string") {
    return false;
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes <= maxBytes;
}


export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}
