import type { HistoryAuditResponse, HistoryDetailResponse, HistoryListResponse, HistoryMode, HistoryResultFilter, HistoryRangeFilter } from "@ottv2/contracts";

import { getJson } from "../http/httpClient";

export type HistoryFilters = { mode: "ALL" | HistoryMode; result: HistoryResultFilter; range: HistoryRangeFilter; cursor?: string };

export function getHistory(filters: HistoryFilters, signal?: AbortSignal): Promise<HistoryListResponse> {
  const params = new URLSearchParams({ mode: filters.mode, result: filters.result, range: filters.range, limit: "20" });
  if (filters.cursor) params.set("cursor", filters.cursor);
  // Guest can view device results; private detail/audit still require auth.
  return getJson(`/history?${params.toString()}`, signal, { handleUnauthorized: true }) as Promise<HistoryListResponse>;
}

export function getHistoryDetail(matchId: string, signal?: AbortSignal): Promise<HistoryDetailResponse> {
  return getJson(`/history/${encodeURIComponent(matchId)}`, signal) as Promise<HistoryDetailResponse>;
}

export function getHistoryAudit(matchId: string, signal?: AbortSignal): Promise<HistoryAuditResponse> {
  return getJson(`/history/${encodeURIComponent(matchId)}/audit`, signal) as Promise<HistoryAuditResponse>;
}
