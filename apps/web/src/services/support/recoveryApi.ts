import {
  ConsumeRecoveryTokenResultSchema,
  RecoveryTokenHandoffSchema,
  SupportRequestListSchema,
  SupportRequestTransitionInputSchema,
  SupportRequestViewSchema,
  type ConsumeRecoveryTokenResult,
  type D07SupportRequestStatus,
  type RecoveryTokenHandoff,
  type SupportRequestCreateResult,
  type SupportRequestList,
  type SupportRequestTransitionInput,
  type SupportRequestView,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../http/httpClient";

const parse = <T>(schema: { parse: (value: unknown) => T }, value: unknown): T => schema.parse(value);
const encoded = (value: string) => encodeURIComponent(value);

export interface RecoveryRequestInput {
  username: string;
  reason: string;
  idempotencyKey?: string;
}

export const recoveryApi = {
  request(input: RecoveryRequestInput): Promise<SupportRequestCreateResult> {
    return requestJson<unknown>("/api/account-access/recovery-requests", {
      method: "POST",
      body: input,
    }).then((value) => {
      // The public route intentionally exposes only the anti-enumeration envelope.
      // Normalize it to the richer internal type without exposing request existence.
      if (!value || typeof value !== "object" || (value as { accepted?: unknown }).accepted !== true) {
        throw new Error("Phản hồi hỗ trợ không hợp lệ.");
      }
      return { accepted: true as const, requestId: null, replayed: false };
    });
  },

  reset(input: { token: string; newPassword: string }): Promise<ConsumeRecoveryTokenResult> {
    return requestJson<unknown>("/api/account-access/recovery/reset", {
      method: "POST",
      body: input,
    }).then((value) => parse(ConsumeRecoveryTokenResultSchema, value));
  },

  list(status?: D07SupportRequestStatus): Promise<SupportRequestList> {
    const query = status ? `?status=${encoded(status)}` : "";
    return getJson(`/api/admin/support/recovery-requests${query}`).then((value) => parse(SupportRequestListSchema, value));
  },

  detail(requestId: string): Promise<SupportRequestView> {
    return getJson(`/api/admin/support/recovery-requests/${encoded(requestId)}`).then((value) => parse(SupportRequestViewSchema, value));
  },

  transition(requestId: string, input: SupportRequestTransitionInput): Promise<{ request: SupportRequestView; replayed: boolean }> {
    const body = parse(SupportRequestTransitionInputSchema, input);
    return requestJson<unknown>(`/api/admin/support/recovery-requests/${encoded(requestId)}/transition`, {
      method: "POST",
      body,
    }).then((value) => {
      const record = value as { request?: unknown; replayed?: unknown };
      return { request: parse(SupportRequestViewSchema, record.request), replayed: record.replayed === true };
    });
  },

  issueResetToken(requestId: string): Promise<RecoveryTokenHandoff> {
    return requestJson<unknown>(`/api/admin/support/recovery-requests/${encoded(requestId)}/reset-token`, {
      method: "POST",
    }).then((value) => parse(RecoveryTokenHandoffSchema, value));
  },
};

export type RecoveryApi = typeof recoveryApi;
