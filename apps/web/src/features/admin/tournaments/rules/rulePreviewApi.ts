import {
  TournamentRulePreviewResponseSchema,
  type TournamentRulePreviewRequest,
  type TournamentRulePreviewResponse,
} from "@ottv2/contracts";
import { requestJson } from "../../../../services/http/httpClient";

export interface RulePreviewApiPort {
  preview(
    tournamentId: string,
    request: TournamentRulePreviewRequest,
    signal?: AbortSignal,
  ): Promise<TournamentRulePreviewResponse>;
}

export class RulePreviewApiClient implements RulePreviewApiPort {
  async preview(
    tournamentId: string,
    request: TournamentRulePreviewRequest,
    signal?: AbortSignal,
  ): Promise<TournamentRulePreviewResponse> {
    const payload = await requestJson<unknown>(
      `/tournaments/${encodeURIComponent(tournamentId)}/rule-profile/validate-preview`,
      { method: "POST", body: request, signal },
    );
    return TournamentRulePreviewResponseSchema.parse(payload);
  }
}

export const defaultRulePreviewApi: RulePreviewApiPort = new RulePreviewApiClient();
