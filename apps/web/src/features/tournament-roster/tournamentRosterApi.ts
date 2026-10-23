import type {
  RosterPreviewRequest,
  RosterPreviewResponse,
  RosterCommitRequest,
  RosterCommitResponse,
  IssueActivationTokenRequest,
  IssueActivationTokenResponse,
  ActivationStatusResponse,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../../services/http/httpClient";

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

export const tournamentRosterApi = {
  preview(payload: RosterPreviewRequest): Promise<RosterPreviewResponse> {
    return requestJson<RosterPreviewResponse>("/admin/roster/preview", {
      method: "POST",
      body: payload,
    });
  },

  commit(payload: RosterCommitRequest): Promise<RosterCommitResponse> {
    return requestJson<RosterCommitResponse>("/admin/roster/commit", {
      method: "POST",
      body: payload,
    });
  },

  listEnrollments(tournamentId: string): Promise<TournamentEnrollmentsResponse> {
    return getJson(`/admin/tournaments/${encodeURIComponent(tournamentId)}/roster`) as Promise<TournamentEnrollmentsResponse>;
  },

  issueActivationToken(payload: IssueActivationTokenRequest): Promise<IssueActivationTokenResponse> {
    return requestJson<IssueActivationTokenResponse>("/admin/roster/activation/issue", {
      method: "POST",
      body: payload,
    });
  },

  getActivationStatus(enrollmentId: string): Promise<ActivationStatusResponse> {
    return getJson(`/admin/roster/activation/${encodeURIComponent(enrollmentId)}`) as Promise<ActivationStatusResponse>;
  },
};

export type TournamentRosterApi = typeof tournamentRosterApi;
