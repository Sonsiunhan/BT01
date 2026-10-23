import {
  RulesAcknowledgementStatusSchema,
  type RulesAcknowledgementStatus,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../../services/http/httpClient";

export type RulesAcknowledgementApi = {
  getStatus: (contractId: string, tournamentId: string, signal?: AbortSignal) => Promise<RulesAcknowledgementStatus>;
  acknowledge: (contractId: string, tournamentId: string, configVersionId: string) => Promise<RulesAcknowledgementStatus>;
};

const pathFor = (contractId: string, tournamentId: string) =>
  `/api/contracts/${encodeURIComponent(contractId)}/tournaments/${encodeURIComponent(tournamentId)}/rules-ack`;

export const rulesAcknowledgementApi: RulesAcknowledgementApi = {
  async getStatus(contractId, tournamentId, signal) {
    const payload = await getJson(pathFor(contractId, tournamentId), signal);
    return RulesAcknowledgementStatusSchema.parse(payload);
  },
  async acknowledge(contractId, tournamentId, configVersionId) {
    const payload = await requestJson(pathFor(contractId, tournamentId), {
      method: "POST",
      body: { configVersionId },
    });
    return RulesAcknowledgementStatusSchema.parse(payload);
  },
};
