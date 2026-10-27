import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { routes } from "../../../app/routes";
import { defaultTournamentApi, type TournamentApiPort } from "./tournamentApi";
import type { AuditLogRecordDto } from "@ottv2/contracts";
import "./AuditLogsViewerPage.css";

interface AuditLogsViewerPageProps {
  apiClient?: TournamentApiPort;
  tournamentId?: string;
}

// Khớp chính xác với union mà máy chủ chấp nhận tại GET /api/admin/audit-logs
// (apps/server/src/modules/tournament-foundation/foundation.route.ts).
const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Tất cả đối tượng" },
  { value: "TOURNAMENT", label: "Giải đấu (TOURNAMENT)" },
  { value: "RULE_VERSION", label: "Phiên bản luật (RULE_VERSION)" },
  { value: "CHANGE_REQUEST", label: "Yêu cầu thay đổi (CHANGE_REQUEST)" },
  { value: "CONTRACT", label: "Hợp đồng (CONTRACT)" },
  { value: "CONTRACT_TA_BINDING", label: "Gán TA vào hợp đồng (CONTRACT_TA_BINDING)" },
  { value: "UNIT", label: "Đơn vị (UNIT)" },
  { value: "ADJUDICATION", label: "Phán quyết trọng tài (ADJUDICATION)" },
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
    <div className="audit-logs-page" data-testid="audit-logs-page">
      {/* Navigation Breadcrumb */}
      <div className="audit-breadcrumb">
        <Link to={routes.admin}>
          Bảng điều khiển
        </Link>
        <span>/</span>
        {isTournamentScoped ? (
          <>
            <Link to={routes.adminTournaments}>
              Giải đấu
            </Link>
            <span>/</span>
            <Link to={`/admin/tournaments/${effectiveTournamentId}`}>
              {effectiveTournamentId}
            </Link>
            <span>/</span>
            <strong style={{ color: "var(--text)" }}>Nhật ký kiểm toán</strong>
          </>
        ) : (
          <strong style={{ color: "var(--text)" }}>Nhật ký kiểm toán hệ thống</strong>
        )}
      </div>

      {/* Page Header */}
      <div className="audit-header">
        <div className="audit-header-title-group">
          <div className="audit-header-icon">
            <UiGlyph name="history" size={24} />
          </div>
          <div>
            <h1 data-testid="audit-page-title" className="audit-title">
              {isTournamentScoped ? "Nhật ký kiểm toán giải đấu" : "Nhật ký kiểm toán hệ thống"}
            </h1>
            <p className="audit-subtitle">
              {isTournamentScoped
                ? `Lịch sử truy vết mọi hành vi thay đổi cấu hình, duyệt và vận hành của giải ${effectiveTournamentId}.`
                : "Truy vết toàn bộ thao tác quản trị trên nền tảng với dữ liệu bất biến và đã được khử nhạy cảm sâu."}
            </p>
          </div>
        </div>

        {isTournamentScoped && (
          <div>
            <Link
              to={`/admin/tournaments/${effectiveTournamentId}`}
              className="button secondary"
              id="back-to-tournament-detail-btn"
            >
              Quay lại
            </Link>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="audit-filter-bar">
        <div className="audit-filter-grid">
          <div className="audit-filter-field">
            <label htmlFor="filter-target-type-select" className="audit-filter-label">
              Loại mục tiêu
            </label>
            <select
              id="filter-target-type-select"
              data-testid="filter-target-type-select"
              value={filter.targetType || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, targetType: e.target.value }))}
            >
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="audit-filter-field">
            <label htmlFor="filter-target-id-input" className="audit-filter-label">
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
            />
          </div>

          <div className="audit-filter-field">
            <label htmlFor="filter-actor-id-input" className="audit-filter-label">
              Người thực hiện (User ID)
            </label>
            <input
              id="filter-actor-id-input"
              data-testid="filter-actor-id-input"
              type="text"
              value={filter.actorUserId || ""}
              onChange={(e) => setFilter((prev) => ({ ...prev, actorUserId: e.target.value }))}
              placeholder="VD: user-ta-01..."
            />
          </div>
        </div>

        <div className="audit-filter-actions">
          <span className="audit-count-label">
            Tìm thấy <strong>{allLogs.length}</strong> bản ghi kiểm toán
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleResetFilters}
              className="button secondary"
              id="reset-audit-filters-btn"
              style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
            >
              Đặt lại
            </button>
            <button
              type="button"
              onClick={() => fetchLogs(filter)}
              className="button primary"
              id="apply-audit-filters-btn"
              style={{ fontSize: "0.82rem", padding: "0.4rem 1rem" }}
            >
              <UiGlyph name="refresh" size={14} />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--danger)",
            background: "color-mix(in srgb, var(--danger) 12%, var(--surface))",
            color: "var(--danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.88rem",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchLogs(filter)}
            className="button secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Table Content */}
      <div className="audit-table-card">
        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
            <div
              style={{
                width: "2rem",
                height: "2rem",
                border: "3px solid var(--border)",
                borderTopColor: "var(--system-cyan)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 1rem",
              }}
            />
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Đang tải nhật ký kiểm toán...</p>
          </div>
        ) : allLogs.length === 0 ? (
          <div style={{ padding: "3.5rem 1rem", textAlign: "center" }} id="audit-empty-state">
            <div
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "50%",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 0.75rem",
                color: "var(--text-secondary)",
              }}
            >
              <UiGlyph name="history" size={24} />
            </div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: "0 0 0.25rem" }}>
              Không tìm thấy bản ghi kiểm toán nào
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: "24rem", margin: "0 auto" }}>
              Chưa có thao tác nào được ghi nhận cho điều kiện lọc đã chọn. Hãy thử điều chỉnh bộ lọc hoặc làm mới dữ liệu.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="audit-table" id="audit-logs-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Lý do / Ghi chú</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: "var(--font-data)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontFamily: "var(--font-data)", fontSize: "0.82rem" }}>{log.actorUserId}</span>
                        <span
                          className={`badge ${getRoleBadgeClass(log.actorRole)}`}
                          style={{ fontSize: "0.68rem", padding: "0.15rem 0.45rem", borderRadius: "999px" }}
                        >
                          {log.actorRole}
                        </span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className={`badge ${getActionBadgeClass(log.action)}`}
                        style={{ fontFamily: "var(--font-data)", fontSize: "0.78rem", padding: "0.2rem 0.55rem", borderRadius: "4px" }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{log.targetType}: </span>
                        <span style={{ fontFamily: "var(--font-data)" }}>{log.targetId}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.reason || ""}>
                      {log.reason || "—"}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(log)}
                        className="button secondary"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
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
          <div className="audit-pagination-footer">
            <span>
              Trang <strong style={{ color: "var(--text)" }}>{currentPage}</strong> / {totalPages}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="button secondary"
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                id="audit-prev-page-btn"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="button secondary"
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
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
          className="audit-modal-backdrop"
          role="dialog"
          aria-modal="true"
          id="audit-snapshot-modal"
          data-testid="audit-snapshot-modal"
        >
          <div className="audit-modal-card">
            {/* Modal Header */}
            <div className="audit-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="audit-header-icon" style={{ width: "2.2rem", height: "2.2rem" }}>
                  <UiGlyph name="history" size={18} />
                </div>
                <div>
                  <h3 data-testid="audit-modal-title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
                    Chi tiết bản ghi kiểm toán
                  </h3>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", fontFamily: "var(--font-data)", color: "var(--text-secondary)" }}>
                    ID: {selectedRecord.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="button secondary"
                style={{ padding: "0.3rem 0.5rem" }}
                id="close-audit-modal-btn"
                aria-label="Đóng cửa sổ"
              >
                <UiGlyph name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="audit-modal-body">
              {/* Summary Metadata Grid */}
              <div className="audit-modal-meta-grid">
                <div>
                  <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Thời gian:</span>
                  <strong style={{ fontFamily: "var(--font-data)" }}>{formatTimestamp(selectedRecord.createdAt)}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Người thực hiện:</span>
                  <strong style={{ fontFamily: "var(--font-data)" }}>{selectedRecord.actorUserId}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Hành động:</span>
                  <strong style={{ color: "var(--system-cyan)", fontFamily: "var(--font-data)" }}>{selectedRecord.action}</strong>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.2rem" }}>Mục tiêu:</span>
                  <strong style={{ fontFamily: "var(--font-data)" }}>{selectedRecord.targetType} / {selectedRecord.targetId}</strong>
                </div>
              </div>

              {selectedRecord.reason && (
                <div style={{ padding: "0.85rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface-raised)", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Lý do / Căn cứ phê duyệt:</span>
                  <p style={{ margin: 0, color: "var(--text)" }}>{selectedRecord.reason}</p>
                </div>
              )}

              {/* Snapshots Comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                    <span>Trước thay đổi (Before)</span>
                    {!selectedRecord.beforeSnapshot && <span style={{ fontStyle: "italic", fontSize: "0.72rem" }}>Không có dữ liệu gốc</span>}
                  </div>
                  <pre className="audit-modal-pre">
                    {selectedRecord.beforeSnapshot ? JSON.stringify(selectedRecord.beforeSnapshot, null, 2) : "null"}
                  </pre>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                    <span>Sau thay đổi (After)</span>
                    <span style={{ color: "var(--system-green)", fontSize: "0.72rem" }}>Khử nhạy cảm sâu</span>
                  </div>
                  <pre className="audit-modal-pre">
                    {selectedRecord.afterSnapshot ? JSON.stringify(selectedRecord.afterSnapshot, null, 2) : "null"}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="audit-modal-footer">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="button secondary"
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
