import {
  RosterPreviewResponseSchema,
  RosterCommitResponseSchema,
  IssueActivationTokenResponseSchema,
  ActivationStatusResponseSchema,
  type RosterPreviewRequest,
  type RosterPreviewResponse,
  type RosterCommitRequest,
  type RosterCommitResponse,
  type IssueActivationTokenRequest,
  type IssueActivationTokenResponse,
  type ActivationStatusResponse,
} from "@ottv2/contracts";

export interface EnrollmentRecordItem {
  id: string;
  tournamentId: string;
  contractId: string;
  personKey: string;
  userId?: string | null;
  displayName: string;
  unitCode: string;
  email?: string | null;
  seedRating: number;
  eligibilityStatus: string;
  checkedInAt?: string | null;
  botReadinessStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentEnrollmentsResponse {
  tournamentId: string;
  enrollments: EnrollmentRecordItem[];
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  parser?: { parse: (value: unknown) => T },
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      (body as { message?: string }).message ?? "Không thể kết nối dịch vụ thí sinh giải đấu.",
    );
    Object.assign(error, { statusCode: response.status, code: (body as { code?: string }).code });
    throw error;
  }
  return parser ? parser.parse(body) : (body as T);
}

const encoded = (value: string) => encodeURIComponent(value);

export const tournamentRosterApi = {
  preview(payload: RosterPreviewRequest): Promise<RosterPreviewResponse> {
    return requestJson("/admin/roster/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }, RosterPreviewResponseSchema);
  },

  commit(payload: RosterCommitRequest): Promise<RosterCommitResponse> {
    return requestJson("/admin/roster/commit", {
      method: "POST",
      body: JSON.stringify(payload),
    }, RosterCommitResponseSchema);
  },

  listEnrollments(tournamentId: string): Promise<TournamentEnrollmentsResponse> {
    return requestJson(`/admin/tournaments/${encoded(tournamentId)}/roster`);
  },

  issueActivationToken(payload: IssueActivationTokenRequest): Promise<IssueActivationTokenResponse> {
    return requestJson("/admin/roster/activation/issue", {
      method: "POST",
      body: JSON.stringify(payload),
    }, IssueActivationTokenResponseSchema);
  },

  getActivationStatus(enrollmentId: string): Promise<ActivationStatusResponse> {
    return requestJson(`/admin/roster/activation/${encoded(enrollmentId)}`, {}, ActivationStatusResponseSchema);
  },
};

export type TournamentRosterApi = typeof tournamentRosterApi;
