import type {
  ApprovalDecisionInput,
  CreateTournamentContractInput,
  CreateUnitInput,
  GrantContractTaInput,
  RevokeContractTaInput,
  TournamentChangeRequestDto,
  TournamentContractDto,
  TournamentDto,
  UnitDto,
  UpdateTournamentContractInput,
  UpdateUnitInput,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../../../services/http/httpClient";

export interface TournamentAdminApiPort {
  listUnits(): Promise<{ units: UnitDto[] }>;
  createUnit(input: CreateUnitInput): Promise<{ unit: UnitDto }>;
  updateUnit(unitId: string, input: UpdateUnitInput): Promise<{ unit: UnitDto }>;
  deleteUnit(unitId: string): Promise<{ deleted: true }>;

  listContracts(filter?: {
    unitId?: string;
    status?: string;
  }): Promise<{ contracts: TournamentContractDto[] }>;
  createContract(
    input: CreateTournamentContractInput
  ): Promise<{ contract: TournamentContractDto }>;
  updateContract(
    contractId: string,
    input: UpdateTournamentContractInput
  ): Promise<{ contract: TournamentContractDto }>;
  grantContractTa(
    contractId: string,
    input: GrantContractTaInput
  ): Promise<{ contract: TournamentContractDto }>;
  revokeContractTa(
    contractId: string,
    userId: string,
    input: RevokeContractTaInput
  ): Promise<{ contract: TournamentContractDto }>;

  listApprovals(filter?: { status?: string }): Promise<{
    initialSubmissions: TournamentDto[];
    changeRequests: TournamentChangeRequestDto[];
  }>;
  decideInitialApproval(
    tournamentId: string,
    input: ApprovalDecisionInput
  ): Promise<{ tournament: TournamentDto }>;
  decideChangeRequest(
    changeRequestId: string,
    input: { decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES"; note?: string }
  ): Promise<{ changeRequest: TournamentChangeRequestDto }>;
}

export const defaultTournamentAdminApi: TournamentAdminApiPort = {
  async listUnits() {
    return (await getJson("/api/admin/units")) as { units: UnitDto[] };
  },
  async createUnit(input) {
    return await requestJson<{ unit: UnitDto }>("/api/admin/units", {
      method: "POST",
      body: input,
    });
  },
  async updateUnit(unitId, input) {
    return await requestJson<{ unit: UnitDto }>(`/api/admin/units/${unitId}`, {
      method: "PATCH",
      body: input,
    });
  },
  async deleteUnit(unitId) {
    return await requestJson<{ deleted: true }>(`/api/admin/units/${unitId}`, {
      method: "DELETE",
    });
  },

  async listContracts(filter) {
    const params = new URLSearchParams();
    if (filter?.unitId) params.set("unitId", filter.unitId);
    if (filter?.status) params.set("status", filter.status);
    const qs = params.toString();
    return (await getJson(
      `/api/admin/contracts${qs ? `?${qs}` : ""}`
    )) as { contracts: TournamentContractDto[] };
  },
  async createContract(input) {
    return await requestJson<{ contract: TournamentContractDto }>(
      "/api/admin/contracts",
      {
        method: "POST",
        body: input,
      }
    );
  },
  async updateContract(contractId, input) {
    return await requestJson<{ contract: TournamentContractDto }>(
      `/api/admin/contracts/${contractId}`,
      {
        method: "PATCH",
        body: input,
      }
    );
  },
  async grantContractTa(contractId, input) {
    return await requestJson<{ contract: TournamentContractDto }>(
      `/api/admin/contracts/${contractId}/ta-bindings`,
      {
        method: "POST",
        body: input,
      }
    );
  },
  async revokeContractTa(contractId, userId, input) {
    return await requestJson<{ contract: TournamentContractDto }>(
      `/api/admin/contracts/${contractId}/ta-bindings/${encodeURIComponent(userId)}/revoke`,
      {
        method: "POST",
        body: input,
      }
    );
  },

  async listApprovals(filter) {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    const qs = params.toString();
    return (await getJson(
      `/api/admin/approvals${qs ? `?${qs}` : ""}`
    )) as {
      initialSubmissions: TournamentDto[];
      changeRequests: TournamentChangeRequestDto[];
    };
  },
  async decideInitialApproval(tournamentId, input) {
    return await requestJson<{ tournament: TournamentDto }>(
      `/api/admin/approvals/${tournamentId}/decision`,
      {
        method: "POST",
        body: input,
      }
    );
  },
  async decideChangeRequest(changeRequestId, input) {
    return await requestJson<{ changeRequest: TournamentChangeRequestDto }>(
      `/api/admin/change-requests/${changeRequestId}/decision`,
      {
        method: "POST",
        body: input,
      }
    );
  },
};
