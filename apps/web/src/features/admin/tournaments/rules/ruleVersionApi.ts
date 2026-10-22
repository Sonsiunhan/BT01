import {
  PublishRuleVersionResponseSchema,
  RuleVersionDiffResponseSchema,
  RuleVersionListResponseSchema,
  type PublishRuleVersionInput,
  type PublishRuleVersionResponse,
  type RuleVersionDiffResponse,
  type RuleVersionListResponse,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../../../../services/http/httpClient";

export interface RuleVersionApiPort {
  list(tournamentId: string): Promise<RuleVersionListResponse>;
  diff(tournamentId: string, versionId: string, against?: string): Promise<RuleVersionDiffResponse>;
  publish(tournamentId: string, input: PublishRuleVersionInput): Promise<PublishRuleVersionResponse>;
}

export class RuleVersionApiClient implements RuleVersionApiPort {
  async list(tournamentId: string): Promise<RuleVersionListResponse> {
    const body = await getJson(
      `/tournaments/${encodeURIComponent(tournamentId)}/rule-versions`,
    );
    return RuleVersionListResponseSchema.parse(body);
  }

  async diff(tournamentId: string, versionId: string, against?: string): Promise<RuleVersionDiffResponse> {
    const query = against ? `?against=${encodeURIComponent(against)}` : "";
    const body = await getJson(
      `/tournaments/${encodeURIComponent(tournamentId)}/rule-versions/${encodeURIComponent(versionId)}/diff${query}`,
    );
    return RuleVersionDiffResponseSchema.parse(body);
  }

  async publish(tournamentId: string, input: PublishRuleVersionInput): Promise<PublishRuleVersionResponse> {
    const body = await requestJson<unknown>(
      `/tournaments/${encodeURIComponent(tournamentId)}/rule-versions/publish`,
      { method: "POST", body: input },
    );
    return PublishRuleVersionResponseSchema.parse(body);
  }
}

export const defaultRuleVersionApi: RuleVersionApiPort = new RuleVersionApiClient();
