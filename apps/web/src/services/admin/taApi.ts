import type {
  CreateTaAccountRequest,
  BindTaContractRequest,
  BindTaContractResponse,
  RevokeTaResponse,
} from "@ottv2/contracts";
import { getJson, requestJson } from "../http/httpClient";

export interface TaUserItem {
  id: string;
  fullName: string;
  displayName: string;
  username: string;
  theme?: string;
  avatarPreset?: string;
  role?: string;
  createdAt?: string;
  stats?: {
    elo: number;
    rankedWins: number;
    rankedLosses: number;
    quickWins: number;
    quickLosses: number;
  };
}

export async function fetchTaList(signal?: AbortSignal): Promise<{ items: TaUserItem[] }> {
  return (await getJson("/admin/ta", signal, { handleUnauthorized: true })) as { items: TaUserItem[] };
}

export async function createTaAccount(input: CreateTaAccountRequest, signal?: AbortSignal): Promise<{ user: TaUserItem }> {
  return await requestJson<{ user: TaUserItem }>("/admin/ta", {
    method: "POST",
    body: input,
    signal,
  });
}

export async function bindTaContract(
  taId: string,
  input: BindTaContractRequest,
  signal?: AbortSignal
): Promise<{ binding: BindTaContractResponse }> {
  return await requestJson<{ binding: BindTaContractResponse }>(`/admin/ta/${encodeURIComponent(taId)}/bind`, {
    method: "POST",
    body: input,
    signal,
  });
}

export async function revokeTaAccount(taId: string, signal?: AbortSignal): Promise<RevokeTaResponse> {
  return await requestJson<RevokeTaResponse>(`/admin/ta/${encodeURIComponent(taId)}`, {
    method: "DELETE",
    signal,
  });
}
