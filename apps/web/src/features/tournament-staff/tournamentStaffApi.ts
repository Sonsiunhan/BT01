import {
  StaffInvitationDecisionSchema,
  StaffInvitationHandoffSchema,
  StaffInvitationRecipientViewSchema,
  StaffExpiryResultSchema,
  StaffReadinessSchema,
  StaffRevokeResultSchema,
  type CreateStaffInvitationInput,
  type StaffInvitationDecision,
  type StaffInvitationHandoff,
  type StaffInvitationRecipientView,
  type StaffInvitationView,
  type StaffExpiryResult,
  type StaffReadiness,
  type StaffRevokeResult,
} from "@ottv2/contracts";
import { ApiError } from "../../services/http/apiError";

type StaffListResponse = {
  invitations: StaffInvitationView[];
  assignments: Array<{ id: string; tournamentId: string; userId: string; role: string; status: string; assignedRooms: unknown }>;
};

async function requestJson<T>(path: string, init: RequestInit = {}, parser?: { parse: (value: unknown) => T }): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "X-OTT-Request": "1",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      (body as { message?: string }).message ?? "Không thể kết nối dịch vụ nhân sự giải đấu.",
      response.status,
      (body as { code?: string }).code ?? "HTTP_ERROR",
    );
  }
  return parser ? parser.parse(body) : (body as T);
}

const encoded = (value: string) => encodeURIComponent(value);

export const tournamentStaffApi = {
  list(tournamentId: string): Promise<StaffListResponse> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff`);
  },
  createInvitation(tournamentId: string, input: CreateStaffInvitationInput): Promise<StaffInvitationHandoff> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/invitations`, { method: "POST", body: JSON.stringify(input) }, StaffInvitationHandoffSchema);
  },
  revoke(tournamentId: string, assignmentId: string): Promise<StaffRevokeResult> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/assignments/${encoded(assignmentId)}/revoke`, { method: "POST" }, StaffRevokeResultSchema);
  },
  expire(tournamentId: string): Promise<StaffExpiryResult> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/invitations/expire`, { method: "POST" }, StaffExpiryResultSchema);
  },
  readiness(tournamentId: string): Promise<StaffReadiness> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/readiness`, {}, StaffReadinessSchema);
  },
  viewInvitation(tournamentId: string, token: string): Promise<StaffInvitationRecipientView> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/invitations/${encoded(token)}`, {}, StaffInvitationRecipientViewSchema);
  },
  acceptInvitation(tournamentId: string, token: string): Promise<StaffInvitationDecision> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/invitations/${encoded(token)}/accept`, { method: "POST" }, StaffInvitationDecisionSchema);
  },
  rejectInvitation(tournamentId: string, token: string): Promise<StaffInvitationDecision> {
    return requestJson(`/api/tournaments/${encoded(tournamentId)}/staff/invitations/${encoded(token)}/reject`, { method: "POST" }, StaffInvitationDecisionSchema);
  },
};

export type { StaffListResponse };
