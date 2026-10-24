import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { routes } from "../../../app/routes";
import { defaultTournamentApi, type TournamentApiPort } from "./tournamentApi";
import type { AuditLogRecordDto } from "@ottv2/contracts";

interface AuditLogsViewerPageProps {
  apiClient?: TournamentApiPort;
  tournamentId?: string;
}

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Tất cả đối tượng" },
  { value: "TOURNAMENT", label: "Giải đấu (TOURNAMENT)" },
  { value: "RULE_VERSION", label: "Phiên bản luật (RULE_VERSION)" },
  { value: "CHANGE_REQUEST", label: "Yêu cầu thay đổi (CHANGE_REQUEST)" },
  { value: "CONTRACT", label: "Hợp đồng (CONTRACT)" },
  { value: "UNIT", label: "Đơn vị (UNIT)" },
  { value: "STAFF", label: "Nhân sự / Trọng tài (STAFF)" },
  { value: "ADJUDICATION", label: "Phán quyết trọng tài (ADJUDICATION)" },
  { value: "ROSTER", label: "Vận động viên (ROSTER)" },
  { value: "SUPPORT", label: "Hỗ trợ (SUPPORT)" },
];

export const AuditLogsViewerPage: React.FC<AuditLogsViewerPageProps> = ({
  apiClient = defaultTournamentApi,
  tournamentId: propTournamentId,
}) => {
  const { tournamentId: paramTournamentId } = useParams<{ tournamentId?: string }>();
  const effectiveTournamentId = propTournamentId || paramTournamentId;
  const isTournamentScoped = Boolean(effectiveTournamentId);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<AuditLogRecordDto[]>([]);

  // Filter state
  const [filter, setFilter] = useState<{
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
  }>({
    targetType: isTournamentScoped ? "TOURNAMENT" : "",
    targetId: effectiveTournamentId || "",
    actorUserId: "",
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modal inspection state
  const [selectedRecord, setSelectedRecord] = useState<AuditLogRecordDto | null>(null);

  const fetchLogs = useCallback(
    async (f: { targetType?: string; targetId?: string; actorUserId?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.listAuditLogs({
          targetType: f.targetType || undefined,
          targetId: (isTournamentScoped ? effectiveTournamentId : f.targetId) || undefined,
          actorUserId: f.actorUserId || undefined,
        });
        setAllLogs(res.logs || []);
        setCurrentPage(1);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu nhật ký kiểm toán.");
      } finally {
        setLoading(false);
      }
    },
    [apiClient, isTournamentScoped, effectiveTournamentId]
  );

  useEffect(() => {
    fetchLogs(filter);
  }, [fetchLogs, filter]);

  const handleResetFilters = () => {
    setFilter({
      targetType: isTournamentScoped ? "TOURNAMENT" : "",
      targetId: effectiveTournamentId || "",
      actorUserId: "",
    });
  };

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allLogs.slice(startIndex, startIndex + pageSize);
  }, [allLogs, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(allLogs.length / pageSize));

  const formatTimestamp = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadgeClass = (action: string): string => {
    const upper = action.toUpperCase();
    if (upper.includes("CREATE") || upper.includes("APPROVE") || upper.includes("START")) {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
    if (upper.includes("REJECT") || upper.includes("CANCEL") || upper.includes("PAUSE")) {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
    if (upper.includes("UPDATE") || upper.includes("PATCH") || upper.includes("PUBLISH")) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
  };

  const getRoleBadgeClass = (role: string): string => {
    switch (role) {
      case "ADMIN":
      case "SYSTEM_ADMIN":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "TOURNAMENT_ADMIN":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "REFEREE":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-zinc-700/50 text-zinc-300 border-zinc-600";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link to={routes.admin} className="hover:text-cyan-400 transition-colors">
          Bảng điều khiển
        </Link>
        <span>/</span>
        {isTournamentScoped ? (
          <>
            <Link to={routes.adminTournaments} className="hover:text-cyan-400 transition-colors">
              Giải đấu
            </Link>
            <span>/</span>
            <Link
              to={`/admin/tournaments/${effectiveTournamentId}`}
              className="hover:text-cyan-400 transition-colors"
            >
              {effectiveTournamentId}
            </Link>
            <span>/</span>
            <span className="text-zinc-200 font-medium">Nhật ký kiểm toán</span>
          </>
        ) : (
          <span className="text-zinc-200 font-medium">Nhật ký kiểm toán hệ thống</span>
        )}
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <UiGlyph name="history" className="w-6 h-6" />
            </span>
            <h1 data-testid="audit-page-title" className="text-2xl font-bold tracking-tight text-zinc-100">
              {isTournamentScoped ? "Nhật ký kiểm toán giải đấu" : "Nhật ký kiểm toán hệ thống"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {isTournamentScoped
              ? `Lịch sử truy vết mọi hành vi thay đổi cấu hình, duyệt và vận hành của giải ${effectiveTournamentId}.`
              : "Truy vết toàn bộ thao tác quản trị trên nền tảng với dữ liệu bất biến và đã được khử nhạy cảm sâu."}
          </p>
        </div>

        {isTournamentScoped && (
          <div className="flex items-center gap-3">
            <Link
              to={`/admin/tournaments/${effectiveTournamentId}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition-colors"
              id="back-to-tournament-detail-btn"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại
            </Link>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filter-target-type-select" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Loại mục tiêu
            </label>
            <select
              id="filter-target-type-select"
              data-testid="filter-target-type-select"
              value={filter.targetType || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, targetType: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 transition-colors"
            >
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-target-id-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Mã mục tiêu (Target ID)
            </label>
            <input
              id="filter-target-id-input"
              data-testid="filter-target-id-input"
              type="text"
              value={isTournamentScoped ? effectiveTournamentId : (filter.targetId || "")}
              disabled={isTournamentScoped}
              onChange={(e) => setFilter((prev) => ({ ...prev, targetId: e.target.value }))}
              placeholder="VD: tour-001, HD-2026..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="filter-actor-id-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Người thực hiện (User ID)
            </label>
            <input
              id="filter-actor-id-input"
              data-testid="filter-actor-id-input"
              type="text"
              value={filter.actorUserId || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, actorUserId: e.target.value }))}
              placeholder="VD: user-ta-01..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
          <span className="text-xs text-zinc-400">
            Tìm thấy <strong className="text-cyan-400">{allLogs.length}</strong> bản ghi kiểm toán
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              id="reset-audit-filters-btn"
            >
              Đặt lại
            </button>
            <button
              type="button"
              onClick={() => fetchLogs(filter)}
              className="px-4 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-900/30"
              id="apply-audit-filters-btn"
            >
              <UiGlyph name="refresh" className="w-3.5 h-3.5" />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchLogs(filter)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-500 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Table Content */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl shadow-black/20">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Đang tải nhật ký kiểm toán...</p>
          </div>
        ) : allLogs.length === 0 ? (
          <div className="py-16 text-center space-y-3" id="audit-empty-state">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400 border border-zinc-700">
              <UiGlyph name="history" className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-zinc-200">Không tìm thấy bản ghi kiểm toán nào</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Chưa có thao tác nào được ghi nhận cho điều kiện lọc đã chọn. Hãy thử điều chỉnh bộ lọc hoặc làm mới dữ liệu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse" id="audit-logs-table">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-4 font-semibold">Thời điểm</th>
                  <th className="py-3 px-4 font-semibold">Người thực hiện</th>
                  <th className="py-3 px-4 font-semibold">Hành động</th>
                  <th className="py-3 px-4 font-semibold">Đối tượng</th>
                  <th className="py-3 px-4 font-semibold">Lý do / Ghi chú</th>
                  <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-zinc-300 whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-200">{log.actorUserId}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getRoleBadgeClass(
                            log.actorRole
                          )}`}
                        >
                          {log.actorRole}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md border font-mono font-medium ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-xs">
                        <span className="text-zinc-400 font-medium">{log.targetType}: </span>
                        <span className="text-zinc-200 font-mono">{log.targetId}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400 max-w-xs truncate" title={log.reason || ""}>
                      {log.reason || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(log)}
                        className="px-3 py-1 text-xs font-medium rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                        id={`view-audit-detail-${log.id}`}
                        data-testid={`view-audit-detail-${log.id}`}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && allLogs.length > pageSize && (
          <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Trang <strong className="text-zinc-200">{currentPage}</strong> / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 transition-colors"
                id="audit-prev-page-btn"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 transition-colors"
                id="audit-next-page-btn"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Inspector Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          id="audit-snapshot-modal"
          data-testid="audit-snapshot-modal"
        >
          <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <UiGlyph name="history" className="w-5 h-5" />
                </span>
                <div>
                  <h3 data-testid="audit-modal-title" className="text-base font-semibold text-zinc-100">Chi tiết bản ghi kiểm toán</h3>
                  <p className="text-xs text-zinc-400 font-mono">ID: {selectedRecord.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                id="close-audit-modal-btn"
              >
                <UiGlyph name="close" className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs">
                <div>
                  <span className="text-zinc-500 block">Thời gian:</span>
                  <span className="text-zinc-200 font-medium">{formatTimestamp(selectedRecord.createdAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Người thực hiện:</span>
                  <span className="text-zinc-200 font-mono">{selectedRecord.actorUserId}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Hành động:</span>
                  <span className="text-cyan-400 font-mono font-medium">{selectedRecord.action}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Mục tiêu:</span>
                  <span className="text-zinc-200 font-mono">
                    {selectedRecord.targetType} / {selectedRecord.targetId}
                  </span>
                </div>
              </div>

              {selectedRecord.reason && (
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/30 text-xs">
                  <span className="text-zinc-400 font-semibold block mb-1">Lý do / Căn cứ phê duyệt:</span>
                  <p className="text-zinc-200">{selectedRecord.reason}</p>
                </div>
              )}

              {/* Snapshots Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before Snapshot */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                    <span>Trước thay đổi (Before)</span>
                    {!selectedRecord.beforeSnapshot && (
                      <span className="text-[10px] text-zinc-500 italic">Không có dữ liệu gốc</span>
                    )}
                  </div>
                  <pre className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-mono text-zinc-300 max-h-64 overflow-auto">
                    {selectedRecord.beforeSnapshot
                      ? JSON.stringify(selectedRecord.beforeSnapshot, null, 2)
                      : "null"}
                  </pre>
                </div>

                {/* After Snapshot */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                    <span>Sau thay đổi (After)</span>
                    <span className="text-[10px] text-emerald-400/80">Khử nhạy cảm sâu (T077)</span>
                  </div>
                  <pre className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-mono text-zinc-300 max-h-64 overflow-auto">
                    {selectedRecord.afterSnapshot
                      ? JSON.stringify(selectedRecord.afterSnapshot, null, 2)
                      : "null"}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800 bg-zinc-950/60">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsViewerPage;
