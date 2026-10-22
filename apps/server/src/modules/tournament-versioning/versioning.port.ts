import type {
  AuthContext,
} from "../auth/auth.service.js";
import type {
  PublishRuleVersionInput,
  PublishRuleVersionResponse,
  RuleVersionDiffResponse,
  RuleVersionListResponse,
} from "@ottv2/contracts";

export type RuleVersionListQuery = Readonly<{
  cursor?: string;
  limit: number;
}>;

/**
 * N04 route boundary. L05 implements the canonical publish transaction behind
 * this port; N04 must never create a second writer for configVersions.
 */
export interface TournamentVersioningPort {
  listVersions(
    context: AuthContext,
    tournamentId: string,
    query: RuleVersionListQuery,
  ): Promise<RuleVersionListResponse>;
  diffVersions(
    context: AuthContext,
    tournamentId: string,
    versionId: string,
    againstVersionId?: string,
  ): Promise<RuleVersionDiffResponse>;
  publish(
    context: AuthContext,
    input: PublishRuleVersionInput,
    tournamentId: string,
  ): Promise<PublishRuleVersionResponse>;
}
