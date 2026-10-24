import { randomUUID } from "node:crypto";
import {
  AuditLogRecordSchema,
  type AuditLogRecordDto,
  type TournamentRole,
} from "@ottv2/contracts";

const SENSITIVE_KEY_PATTERN =
  /(password|passwordhash|recoverycode|token|tokenhash|secret|apikey|credential|privatekey|sourcetext|sourcecode|pythonsource|pythoncode|botsource|rawsource|memorypayload|botmemory|memorystate|privatediagnostics|diagnostics|stderr|traceback|cookie|authorization)/i;

const SECRET_VALUE_PATTERN =
  /(Bearer\s+[A-Za-z0-9._~+/-]+=*|\bdef\s+[A-Za-z_][A-Za-z0-9_]*\s*\(|\bclass\s+[A-Za-z_][A-Za-z0-9_]*\s*[:(]|Traceback \(most recent call last\)|scrypt\$|argon2id\$)/i;

function deepFreeze<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  for (const val of Object.values(value as Record<string, unknown>)) {
    deepFreeze(val);
  }
  return Object.freeze(value);
}

/**
 * Recursively sanitizes a snapshot object so secrets, tokens, password hashes,
 * and private bot source/memory/diagnostics are never stored in audit records (BR-41, BR-42, T077).
 */
export function sanitizeAuditSnapshot(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const sanitizeValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
      if (SECRET_VALUE_PATTERN.test(val)) {
        return "[REDACTED]";
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => sanitizeValue(item));
    }
    if (typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          out[k] = "[REDACTED]";
        } else {
          out[k] = sanitizeValue(v);
        }
      }
      return out;
    }
    return val;
  };

  return sanitizeValue(input) as Record<string, unknown>;
}

/**
 * Sanitizes free-form audit reason to ensure tokens, credentials, and traceback
 * are never stored in audit records (D11-F09, BR-41, T077).
 */
export function sanitizeAuditReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (SECRET_VALUE_PATTERN.test(reason)) {
    return "[REDACTED]";
  }
  return reason;
}

export interface AppendAuditLogInput {
  actorUserId: string;
  actorRole: TournamentRole;
  action: string;
  targetType: AuditLogRecordDto["targetType"];
  targetId: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  reason?: string | null;
  correlationId?: string | null;
  nowIso?: string;
}

export interface AuditPort {
  append(input: AppendAuditLogInput): AuditLogRecordDto;
  list(filter?: {
    targetType?: AuditLogRecordDto["targetType"] | undefined;
    targetId?: string | undefined;
    actorUserId?: string | undefined;
  }): AuditLogRecordDto[];
}

/**
 * Append-only, deep-redacting audit log service (BR-41, BR-42, T077).
 * Intentionally exposes NO update or delete methods.
 */
export class SanitizingAuditService implements AuditPort {
  private readonly records: AuditLogRecordDto[];

  constructor(backingArray: AuditLogRecordDto[] = []) {
    this.records = backingArray;
  }

  append(input: AppendAuditLogInput): AuditLogRecordDto {
    const record = AuditLogRecordSchema.parse({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeSnapshot: sanitizeAuditSnapshot(input.beforeSnapshot ?? null),
      afterSnapshot: sanitizeAuditSnapshot(input.afterSnapshot ?? null),
      reason: sanitizeAuditReason(input.reason),
      correlationId: input.correlationId ?? null,
      createdAt: input.nowIso ?? new Date().toISOString(),
    });
    const frozen = deepFreeze({
      ...record,
      beforeSnapshot: record.beforeSnapshot ? { ...record.beforeSnapshot } : null,
      afterSnapshot: record.afterSnapshot ? { ...record.afterSnapshot } : null,
    });
    this.records.push(frozen);
    return frozen;
  }

  list(filter?: {
    targetType?: AuditLogRecordDto["targetType"] | undefined;
    targetId?: string | undefined;
    actorUserId?: string | undefined;
  }): AuditLogRecordDto[] {
    return this.records
      .filter((r) => {
        if (filter?.targetType && r.targetType !== filter.targetType) return false;
        if (filter?.targetId && r.targetId !== filter.targetId) return false;
        if (filter?.actorUserId && r.actorUserId !== filter.actorUserId) return false;
        return true;
      })
      .map((r) => deepFreeze(structuredClone(r)));
  }
}
