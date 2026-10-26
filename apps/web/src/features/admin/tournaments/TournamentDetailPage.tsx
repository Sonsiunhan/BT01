import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { routes } from "../../../app/routes";
import { defaultTournamentApi, type TournamentApiPort } from "./tournamentApi";
import type {
  TournamentDto,
  TournamentReadinessSnapshot,
  ReadinessChecklistItem,
  TournamentLeaderboardSnapshotDto,
  TournamentScoreLedgerEntryDto,
} from "@ottv2/contracts";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface TournamentDetailPageProps {
  apiClient?: TournamentApiPort;
  tournamentId?: string;
}

export const TournamentDetailPage: React.FC<TournamentDetailPageProps> = ({
  apiClient = defaultTournamentApi,
  tournamentId: propTournamentId,
}) => {
  const { tournamentId: paramTournamentId } = useParams<{ tournamentId: string }>();
  const tournamentId = propTournamentId || paramTournamentId || "";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"overview" | "config" | "readiness" | "leaderboard" | "matches">("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentDto | null>(null);
  const [readiness, setReadiness] = useState<TournamentReadinessSnapshot | null>(null);
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardSnapshotDto | null>(null);
  const [matches, setMatches] = useState<TournamentScoreLedgerEntryDto[]>([]);
  const [searchLb, setSearchLb] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<string>("");
  const [pageLb, setPageLb] = useState<number>(1);
  const [pageMatches, setPageMatches] = useState<number>(1);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal pause state
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      setError("Không xác định được giải đấu cần xem. Vui lòng mở lại từ danh sách giải đấu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detailRes, readinessRes, lbRes, matchesRes] = await Promise.allSettled([
        apiClient.getTournamentDetail(tournamentId),
        apiClient.getTournamentReadiness(tournamentId),
        apiClient.getLeaderboard
          ? apiClient.getLeaderboard(tournamentId)
          : fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`).then((r) => {
              if (!r.ok) throw new Error(`Không thể tải bảng xếp hạng giải đấu (HTTP ${r.status}).`);
              return r.json();
            }),
        apiClient.getMatches
          ? apiClient.getMatches(tournamentId)
          : fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/matches`).then((r) => {
              if (!r.ok) throw new Error(`Không thể tải nhật ký trận đấu (HTTP ${r.status}).`);
              return r.json();
            }),
      ]);

      if (detailRes.status === "fulfilled") {
        setTournament(detailRes.value.tournament);
      } else {
        throw new Error(errorMessage(detailRes.reason, "Không thể tải thông tin giải đấu"));
      }

      if (readinessRes.status === "fulfilled") {
        setReadiness(readinessRes.value.readiness);
      }
      if (lbRes.status === "fulfilled" && lbRes.value?.leaderboard) {
        setLeaderboard(lbRes.value.leaderboard);
      }
      if (matchesRes.status === "fulfilled" && matchesRes.value?.matches) {
        setMatches(matchesRes.value.matches);
      }
    } catch (error: unknown) {
      setError(errorMessage(error, "Đã xảy ra lỗi khi tải dữ liệu giải đấu."));
    } finally {
      setLoading(false);
    }
  }, [apiClient, tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lifecycle Actions
  const handleOpenScheduled = async () => {
    if (!tournamentId || !tournament) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.openScheduled(tournamentId, tournament.revision);
      setTournament(res.tournament);
      setActionMessage({ type: "success", text: "Đã mở lịch trình giải đấu thành công (SCHEDULED)." });
      const r = await apiClient.getTournamentReadiness(tournamentId);
      setReadiness(r.readiness);
    } catch (error: unknown) {
      setActionMessage({ type: "error", text: errorMessage(error, "Không thể mở lịch trình giải đấu.") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTournament = async () => {
    if (!tournamentId || !tournament) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.startTournament(tournamentId, tournament.revision);
      setTournament(res.tournament);
      setActionMessage({ type: "success", text: "Giải đấu đã chính thức bắt đầu (RUNNING)!" });
      const r = await apiClient.getTournamentReadiness(tournamentId);
      setReadiness(r.readiness);
    } catch (error: unknown) {
      setActionMessage({ type: "error", text: errorMessage(error, "Không thể bắt đầu giải đấu.") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPause = async () => {
    if (!tournamentId || !tournament || !pauseReason.trim()) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.pauseTournament(tournamentId, pauseReason.trim(), tournament.revision);
      setTournament(res.tournament);
      setShowPauseModal(false);
      setPauseReason("");
      setActionMessage({ type: "success", text: "Đã tạm dừng giải đấu thành công (PAUSED)." });
      const r = await apiClient.getTournamentReadiness(tournamentId);
      setReadiness(r.readiness);
    } catch (error: unknown) {
      setActionMessage({ type: "error", text: errorMessage(error, "Không thể tạm dừng giải đấu.") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeTournament = async () => {
    if (!tournamentId || !tournament) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.resumeTournament(tournamentId, tournament.revision);
      setTournament(res.tournament);
      setActionMessage({ type: "success", text: "Đã tiếp tục giải đấu thành công (RUNNING)." });
      const r = await apiClient.getTournamentReadiness(tournamentId);
      setReadiness(r.readiness);
    } catch (error: unknown) {
      setActionMessage({ type: "error", text: errorMessage(error, "Không thể tiếp tục giải đấu.") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!tournamentId || !tournament) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await apiClient.submitDraft(tournamentId, {
        expectedRevision: tournament.revision,
      });
      setTournament(res.tournament);
      setActionMessage({
        type: "success",
        text: "Đã nộp duyệt giải đấu thành công! Trạng thái hiện tại: ĐANG CHỜ PHÊ DUYỆT (UNDER_REVIEW).",
      });
      const r = await apiClient.getTournamentReadiness(tournamentId);
      setReadiness(r.readiness);
    } catch (error: unknown) {
      setActionMessage({
        type: "error",
        text: errorMessage(error, "Không thể nộp duyệt giải đấu."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        data-testid="tournament-detail-loading"
        className="page-container"
        style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}
      >
        <UiGlyph name="refresh" size={28} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "1rem", fontSize: "0.95rem" }}>Đang tải dữ liệu chi tiết giải đấu...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div
        data-testid="tournament-detail-error"
        className="page-container"
        style={{ padding: "2.5rem 1.5rem", maxWidth: "800px", margin: "0 auto" }}
      >
        <div
          role="alert"
          style={{
            padding: "1.5rem",
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--system-red) 12%, var(--surface))",
            border: "1px solid var(--system-red)",
            color: "var(--text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <UiGlyph name="warning" size={22} style={{ color: "var(--system-red)" }} />
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--system-red)" }}>
              Không thể tải dữ liệu giải đấu
            </h3>
          </div>
          <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {error || "Giải đấu không tồn tại hoặc bạn không có quyền truy cập."}
          </p>
          <Link to={routes.adminTournaments} className="button secondary" style={{ fontSize: "0.85rem" }}>
            ← Quay lại danh sách giải đấu
          </Link>
        </div>
      </div>
    );
  }

  const core = tournament.coreConfig;
  const isDraftLike = tournament.status === "DRAFT" || tournament.status === "CHANGES_REQUESTED";
  const canStart = readiness?.canStartRunning ?? false;
  const canOpen = readiness?.canOpenScheduled ?? false;
  const isBlocked = (readiness?.blockers.length ?? 0) > 0;

  return (
    <div
      data-testid="tournament-detail-page"
      className="page-container tournament-detail-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        minHeight: "100%",
        maxWidth: "1080px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Breadcrumb & Top Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <Link
              to={routes.adminTournaments}
              style={{
                fontSize: "0.78rem",
                color: "var(--system-cyan)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Danh sách giải đấu
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/</span>
            <span className="eyebrow" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
              P03 // CHI TIẾT GIẢI ĐẤU
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1
              data-testid="tournament-detail-name"
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              {core.tournamentName}
            </h1>

            {/* Status Badge */}
            <span
              data-testid="tournament-status-badge"
              className="badge"
              style={{
                backgroundColor:
                  tournament.status === "RUNNING"
                    ? "color-mix(in srgb, var(--system-green) 18%, transparent)"
                    : tournament.status === "PAUSED"
                    ? "color-mix(in srgb, var(--system-amber) 18%, transparent)"
                    : tournament.status === "APPROVED" || tournament.status === "SCHEDULED"
                    ? "color-mix(in srgb, var(--system-cyan) 18%, transparent)"
                    : "color-mix(in srgb, var(--text-muted) 18%, transparent)",
                color:
                  tournament.status === "RUNNING"
                    ? "var(--system-green)"
                    : tournament.status === "PAUSED"
                    ? "var(--system-amber)"
                    : tournament.status === "APPROVED" || tournament.status === "SCHEDULED"
                    ? "var(--system-cyan)"
                    : "var(--text)",
                border: "1px solid currentColor",
                fontSize: "0.78rem",
                padding: "0.25rem 0.65rem",
                borderRadius: "4px",
                fontWeight: 700,
              }}
            >
              {tournament.status} (r{tournament.revision})
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              marginTop: "0.6rem",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}
          >
            <div>
              Mã: <code style={{ color: "var(--system-cyan)", padding: "0.15rem 0.4rem", background: "rgba(6, 182, 212, 0.1)", borderRadius: "4px" }}>{core.tournamentCode}</code>
            </div>
            <div>
              Đơn vị: <strong style={{ color: "var(--text)" }}>{core.organizersText}</strong>
            </div>
            <div>
              Múi giờ: <strong style={{ color: "var(--text)" }}>{core.timezone}</strong>
            </div>
          </div>
        </div>

        {/* SA review feedback — the rejection / changes-requested reason must be
            readable here too: REJECTED tournaments have no draft-edit entry. */}
        {tournament.lastReviewNote &&
          (tournament.status === "CHANGES_REQUESTED" || tournament.status === "REJECTED") && (
            <div
              data-testid="tournament-review-feedback"
              role="note"
              style={{
                padding: "0.85rem 1rem",
                border: "1px solid var(--warning, #f59e0b)",
                borderLeftWidth: "3px",
                borderRadius: "8px",
                background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, var(--surface))",
                fontSize: "0.85rem",
                color: "var(--text)",
              }}
            >
              <strong style={{ display: "block" }}>
                {tournament.status === "REJECTED"
                  ? "Lý do Ban quản trị từ chối hồ sơ này:"
                  : "Phản hồi của Ban quản trị khi yêu cầu chỉnh sửa:"}
              </strong>
              <p style={{ margin: "0.2rem 0 0 0", color: "var(--text-secondary)" }}>
                {tournament.lastReviewNote}
              </p>
            </div>
          )}

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {isDraftLike && (
            <>
              <button
                type="button"
                data-testid="action-edit-draft-btn"
                onClick={() => navigate(`/admin/tournaments/${tournament.id}/edit`)}
                className="button secondary"
                style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
              >
                Sửa bản nháp
              </button>
              <button
                type="button"
                data-testid="action-submit-draft-btn"
                onClick={handleSubmitDraft}
                disabled={actionLoading}
                className="button primary"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45rem 0.9rem",
                  background: "var(--system-cyan)",
                  color: "var(--text-on-cyan, #ffffff)",
                  fontWeight: 700,
                }}
              >
                {actionLoading ? "Đang gửi..." : "Nộp duyệt giải đấu"}
              </button>
            </>
          )}

          {tournament.status === "APPROVED" && (
            <button
              type="button"
              data-testid="action-open-scheduled-btn"
              onClick={handleOpenScheduled}
              disabled={actionLoading || !canOpen}
              className="button secondary"
              style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
            >
              Mở lịch trình
            </button>
          )}

          {(tournament.status === "APPROVED" || tournament.status === "SCHEDULED") && (
            <button
              type="button"
              data-testid="action-start-tournament-btn"
              onClick={handleStartTournament}
              disabled={actionLoading || !canStart}
              className="button primary"
              style={{
                fontSize: "0.85rem",
                padding: "0.45rem 0.9rem",
                opacity: canStart ? 1 : 0.45,
                cursor: canStart ? "pointer" : "not-allowed",
              }}
              title={canStart ? "Bắt đầu giải đấu" : "Chưa đủ điều kiện khởi chạy"}
            >
              Bắt đầu giải đấu
            </button>
          )}

          {tournament.status === "RUNNING" && (
            <button
              type="button"
              data-testid="action-pause-tournament-btn"
              onClick={() => setShowPauseModal(true)}
              disabled={actionLoading}
              className="button secondary"
              style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem", color: "var(--system-amber)" }}
            >
              Tạm dừng giải
            </button>
          )}

          {tournament.status === "PAUSED" && (
            <button
              type="button"
              data-testid="action-resume-tournament-btn"
              onClick={handleResumeTournament}
              disabled={actionLoading}
              className="button primary"
              style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
            >
              Tiếp tục giải đấu
            </button>
          )}
          <Link
            to={routes.adminTournamentRules.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-rules-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Luật thi đấu
          </Link>
          <Link
            to={routes.adminTournamentRoster.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-roster-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Vận động viên / Roster
          </Link>
          <Link
            to={routes.adminTournamentStaff.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-staff-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Nhân sự / Referee
          </Link>
          <Link
            to={routes.adminTournamentBotReadiness.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-bot-readiness-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Trạng thái Bot
          </Link>
          <Link
            to={routes.adminTournamentOperations.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-operations-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Điều hành sự cố
          </Link>
          <Link
            to={routes.adminTournamentAdjudications.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-adjudications-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Phán quyết hòa
          </Link>
          <Link
            to={routes.adminTournamentAudit.replace(":tournamentId", tournament.id)}
            className="button secondary"
            data-testid="action-audit-btn"
            id="tournament-detail-audit-btn"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            Nhật ký kiểm toán
          </Link>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            background:
              actionMessage.type === "success"
                ? "color-mix(in srgb, var(--system-green) 12%, var(--surface))"
                : "color-mix(in srgb, var(--system-red) 12%, var(--surface))",
            border: `1px solid ${actionMessage.type === "success" ? "var(--system-green)" : "var(--system-red)"}`,
            color: actionMessage.type === "success" ? "var(--system-green)" : "var(--system-red)",
            fontSize: "0.88rem",
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Các mục thông tin giải đấu"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.25rem",
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === "overview"}
          aria-controls="panel-overview"
          data-testid="tab-overview-btn"
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "overview" ? 700 : 500,
            color: activeTab === "overview" ? "var(--system-cyan)" : "var(--text-muted)",
            borderBottom: activeTab === "overview" ? "2px solid var(--system-cyan)" : "2px solid transparent",
            fontSize: "0.9rem",
          }}
        >
          Tổng quan
        </button>

        <button
          type="button"
          role="tab"
          id="tab-config"
          aria-selected={activeTab === "config"}
          aria-controls="panel-config"
          data-testid="tab-config-btn"
          onClick={() => setActiveTab("config")}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "config" ? 700 : 500,
            color: activeTab === "config" ? "var(--system-cyan)" : "var(--text-muted)",
            borderBottom: activeTab === "config" ? "2px solid var(--system-cyan)" : "2px solid transparent",
            fontSize: "0.9rem",
          }}
        >
          Cấu hình giải
        </button>

        <button
          type="button"
          role="tab"
          id="tab-readiness"
          aria-selected={activeTab === "readiness"}
          aria-controls="panel-readiness"
          data-testid="tab-readiness-btn"
          onClick={() => setActiveTab("readiness")}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "readiness" ? 700 : 500,
            color: activeTab === "readiness" ? "var(--system-cyan)" : "var(--text-muted)",
            borderBottom: activeTab === "readiness" ? "2px solid var(--system-cyan)" : "2px solid transparent",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span>Điều kiện sẵn sàng (Readiness)</span>
          {readiness && (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "0.15rem 0.45rem",
                borderRadius: "10px",
                background: tournament.status === "RUNNING"
                  ? "color-mix(in srgb, var(--system-green) 20%, transparent)"
                  : tournament.status === "PAUSED"
                  ? "color-mix(in srgb, var(--system-amber) 20%, transparent)"
                  : readiness.canStartRunning
                  ? "color-mix(in srgb, var(--system-green) 20%, transparent)"
                  : "color-mix(in srgb, var(--system-red) 20%, transparent)",
                color: tournament.status === "RUNNING" || (tournament.status !== "PAUSED" && readiness.canStartRunning)
                  ? "var(--system-green)"
                  : tournament.status === "PAUSED"
                  ? "var(--system-amber)"
                  : "var(--system-red)",
                fontWeight: 700,
              }}
            >
              {tournament.status === "RUNNING"
                ? "ĐANG CHẠY"
                : tournament.status === "PAUSED"
                ? "TẠM DỪNG"
                : readiness.canStartRunning
                ? "SẴN SÀNG"
                : `${readiness.blockers.length} CHẶN`}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-leaderboard"
          aria-selected={activeTab === "leaderboard"}
          aria-controls="panel-leaderboard"
          data-testid="tab-leaderboard-btn"
          onClick={() => setActiveTab("leaderboard")}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "leaderboard" ? 700 : 500,
            color: activeTab === "leaderboard" ? "var(--system-cyan)" : "var(--text-muted)",
            borderBottom: activeTab === "leaderboard" ? "2px solid var(--system-cyan)" : "2px solid transparent",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span>Bảng xếp hạng</span>
          {leaderboard?.standings && (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "0.15rem 0.45rem",
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--system-cyan) 20%, transparent)",
                color: "var(--system-cyan)",
                fontWeight: 700,
              }}
            >
              {leaderboard.standings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-matches"
          aria-selected={activeTab === "matches"}
          aria-controls="panel-matches"
          data-testid="tab-matches-btn"
          onClick={() => setActiveTab("matches")}
          style={{
            padding: "0.55rem 1rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "matches" ? 700 : 500,
            color: activeTab === "matches" ? "var(--system-cyan)" : "var(--text-muted)",
            borderBottom: activeTab === "matches" ? "2px solid var(--system-cyan)" : "2px solid transparent",
            fontSize: "0.9rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span>Nhật ký trận đấu</span>
          {matches.length > 0 && (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "0.15rem 0.45rem",
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--system-purple) 20%, transparent)",
                color: "var(--system-purple)",
                fontWeight: 700,
              }}
            >
              {matches.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <section
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          data-testid="panel-overview"
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    TIẾN ĐỘ THỜI GIAN
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "10px",
                      fontWeight: 700,
                      background: tournament.status === "RUNNING"
                        ? "color-mix(in srgb, var(--system-green) 18%, transparent)"
                        : tournament.status === "PAUSED"
                        ? "color-mix(in srgb, var(--system-amber) 18%, transparent)"
                        : "color-mix(in srgb, var(--text-muted) 15%, transparent)",
                      color: tournament.status === "RUNNING"
                        ? "var(--system-green)"
                        : tournament.status === "PAUSED"
                        ? "var(--system-amber)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {tournament.status === "RUNNING" ? "ĐANG DIỄN RA" : tournament.status === "PAUSED" ? "TẠM DỪNG" : tournament.status === "ENDED" ? "ĐÃ KẾT THÚC" : "SẮP DIỄN RA"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", margin: "0.4rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Bắt đầu:</span>
                    <strong style={{ color: "var(--text)", fontFamily: "var(--font-data)" }}>
                      {core.scheduledStartAt ? new Date(core.scheduledStartAt).toLocaleString("vi-VN") : "Chưa ấn định"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Kết thúc:</span>
                    <strong style={{ color: "var(--text)", fontFamily: "var(--font-data)" }}>
                      {core.scheduledEndAt ? new Date(core.scheduledEndAt).toLocaleString("vi-VN") : "Chưa ấn định"}
                    </strong>
                  </div>
                </div>
              </div>

              {(() => {
                const startMs = core.scheduledStartAt ? new Date(core.scheduledStartAt).getTime() : 0;
                const endMs = core.scheduledEndAt ? new Date(core.scheduledEndAt).getTime() : 0;
                const nowMs = Date.now();
                let progressPercent = 0;
                if (startMs && endMs && endMs > startMs) {
                  if (nowMs >= endMs || tournament.status === "ENDED") {
                    progressPercent = 100;
                  } else if (nowMs <= startMs) {
                    progressPercent = 0;
                  } else {
                    progressPercent = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
                  }
                }
                return (
                  <div style={{ marginTop: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      <span>Tiến trình giải</span>
                      <span style={{ fontWeight: 600, color: "var(--system-cyan)" }}>{progressPercent}%</span>
                    </div>
                    <div style={{ height: "6px", width: "100%", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--system-cyan), var(--system-green))",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <div
              style={{
                padding: "1.25rem",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
                QUY MÔ THÍ SINH
              </span>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--system-cyan)" }}>
                {readiness?.eligibleParticipantsCount ?? 0} / {core.maxParticipants}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Tối thiểu để bắt đầu: {core.minParticipantsToStart} người
              </div>
            </div>

            <div
              style={{
                padding: "1.25rem",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
                CHẾ ĐỘ THI ĐẤU
              </span>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                {core.competitionMode === "BOT_VS_BOT" ? "Đấu Bot (BOT_VS_BOT)" : "Đấu Người Trực Tuyến (HUMAN_ONLINE)"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Thể thức: {core.format} ({core.pairingMethod})
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "var(--text)" }}>
              Mô tả điều lệ giải đấu
            </h4>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {core.shortDescription || "Chưa có mô tả chi tiết cho giải đấu này."}
            </p>
          </div>
        </section>
      )}

      {/* Tab 2: Configuration */}
      {activeTab === "config" && (
        <section
          id="panel-config"
          role="tabpanel"
          aria-labelledby="tab-config"
          data-testid="panel-config"
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Operational Controls */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--system-cyan)" }}>
              Kiểm soát vận hành (Operational Controls)
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Số trận tối đa mỗi người:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.maxMatchesPerPlayer ?? "Không giới hạn"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Số lần gặp nhau tối đa:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.maxPairMeetings} lần</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Thời gian chờ tái đấu:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.rematchCooldownMinutes} phút</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Số trận đồng thời tối đa:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.maxConcurrentMatches} trận</strong>
              </div>
            </div>
          </div>

          {/* Privacy & Spectator Policy */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--system-cyan)" }}>
              Quyền riêng tư & Khán giả (Privacy & Spectators)
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Chính sách khán giả:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.spectatorPolicy}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Chính sách phòng trò chuyện:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.chatPolicy}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Hiển thị bảng xếp hạng:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.leaderboardVisibility}</strong>
              </div>
            </div>
          </div>

          {/* Scoring & Elo */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "var(--system-cyan)" }}>
              Hệ thống tính điểm & Elo
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Điểm giải ban đầu:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.initialScore}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Elo ban đầu:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.initialElo}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Hệ số K-Factor:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.kFactor}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Điểm sàn tối thiểu:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.scoreFloor}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Điểm khi Bye:</span>
                <strong style={{ fontSize: "0.9rem" }}>{core.byeScorePoints}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Authoritative Readiness Panel */}
      {activeTab === "readiness" && (
        <section
          id="panel-readiness"
          role="tabpanel"
          aria-labelledby="tab-readiness"
          data-testid="panel-readiness"
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Readiness Status Banner */}
          {(() => {
            const isTournamentRunning = tournament.status === "RUNNING";
            const isTournamentPaused = tournament.status === "PAUSED";
            const isTournamentEnded = tournament.status === "ENDED";
            const isReadyToStart = readiness?.canStartRunning;

            let bannerColor = "var(--system-red)";
            let bannerTitle = "CHƯA ĐỦ ĐIỀU KIỆN KHỞI CHẠY (BLOCKED)";
            let bannerDesc = `Hệ thống ghi nhận ${readiness?.blockers.length ?? 0} lý do chặn giải đấu khởi chạy. Vui lòng hoàn thành các yêu cầu bên dưới.`;
            let showSuccessIcon = false;

            if (isTournamentRunning) {
              bannerColor = "var(--system-green)";
              bannerTitle = "GIẢI ĐẤU ĐANG DIỄN RA (RUNNING)";
              bannerDesc = "Giải đấu đã hoàn tất toàn bộ điều kiện khởi chạy và đang trong giai đoạn thi đấu chính thức.";
              showSuccessIcon = true;
            } else if (isTournamentPaused) {
              bannerColor = "var(--system-amber)";
              bannerTitle = "GIẢI ĐẤU ĐANG TẠM DỪNG (PAUSED)";
              bannerDesc = "Giải đấu đang tạm dừng. Các đồng hồ thi đấu và tiến trình trận đấu tạm thời đóng băng.";
            } else if (isTournamentEnded) {
              bannerColor = "var(--text-secondary)";
              bannerTitle = "GIẢI ĐẤU ĐÃ KẾT THÚC (ENDED)";
              bannerDesc = "Giải đấu đã hoàn tất mọi trận đấu và công bố kết quả xếp hạng chung cuộc.";
              showSuccessIcon = true;
            } else if (isReadyToStart) {
              bannerColor = "var(--system-green)";
              bannerTitle = "ĐỦ ĐIỀU KIỆN SẴN SÀNG KHỞI CHẠY (READY)";
              bannerDesc = "Tất cả các điều kiện tiên quyết từ máy chủ đã hoàn tất. Có thể bắt đầu giải đấu bất cứ lúc nào.";
              showSuccessIcon = true;
            }

            return (
              <div
                data-testid="readiness-banner"
                style={{
                  padding: "1.25rem",
                  borderRadius: "8px",
                  background: `color-mix(in srgb, ${bannerColor} 12%, var(--surface))`,
                  border: `1px solid ${bannerColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {showSuccessIcon ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={bannerColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <UiGlyph name="warning" size={20} style={{ color: bannerColor }} />
                    )}
                    <strong
                      data-testid="readiness-overall-status"
                      style={{
                        fontSize: "1.05rem",
                        color: bannerColor,
                      }}
                    >
                      {bannerTitle}
                    </strong>
                  </div>
                  <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {bannerDesc}
                  </p>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Kiểm tra lúc: {readiness ? new Date(readiness.evaluatedAt).toLocaleTimeString("vi-VN") : "--"}
                </div>
              </div>
            );
          })()}

          {/* Blockers list if any */}
          {isBlocked && (
            <div
              data-testid="readiness-blockers-list"
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--system-red)",
              }}
            >
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "var(--system-red)" }}>
                Các điều kiện còn thiếu cần khắc phục:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.88rem", color: "var(--text)" }}>
                {readiness?.blockers.map((b) => (
                  <li key={b} style={{ marginBottom: "0.3rem" }}>
                    <code style={{ color: "var(--system-red)", fontWeight: 700 }}>{b}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Checklist Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h4 style={{ margin: "0.5rem 0 0 0", fontSize: "1rem", color: "var(--text)" }}>
              Hạng mục kiểm tra thẩm quyền (Authoritative Checklist)
            </h4>

            {readiness?.checklist.map((item: ReadinessChecklistItem) => {
              const isPass = item.status === "PASS";
              const isWarn = item.status === "WARN";
              return (
                <div
                  key={item.code}
                  data-testid={`readiness-check-${item.code}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    border: `1px solid ${
                      isPass
                        ? "color-mix(in srgb, var(--system-green) 40%, var(--border))"
                        : isWarn
                        ? "color-mix(in srgb, var(--system-amber) 40%, var(--border))"
                        : "color-mix(in srgb, var(--system-red) 40%, var(--border))"
                    }`,
                    gap: "1rem",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.92rem", color: "var(--text)", display: "block" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem", display: "block" }}>
                      {item.detail}
                    </span>
                  </div>

                  <span
                    className="badge"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "4px",
                      background: isPass
                        ? "color-mix(in srgb, var(--system-green) 15%, transparent)"
                        : isWarn
                        ? "color-mix(in srgb, var(--system-amber) 15%, transparent)"
                        : "color-mix(in srgb, var(--system-red) 15%, transparent)",
                      color: isPass
                        ? "var(--system-green)"
                        : isWarn
                        ? "var(--system-amber)"
                        : "var(--system-red)",
                      border: "1px solid currentColor",
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab 4: Leaderboard */}
      {activeTab === "leaderboard" && (
        <section
          id="panel-leaderboard"
          role="tabpanel"
          aria-labelledby="tab-leaderboard"
          data-testid="panel-leaderboard"
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Header Summary & Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              background: "var(--surface)",
              padding: "1rem 1.25rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", color: "var(--system-cyan)" }}>
                Bảng Xếp Hạng Giải Đấu ({leaderboard?.standings?.length ?? 0} Thí Sinh)
              </h3>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Công thức: <strong>{leaderboard?.formulaPreset ?? core.scoringFormulaPreset}</strong> · Thứ tự hoàn tất gần nhất: #{leaderboard?.lastFinishSequence ?? 0}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Tìm Bot, thí sinh, mã trường..."
                value={searchLb}
                onChange={(e) => { setSearchLb(e.target.value); setPageLb(1); }}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                  color: "var(--text)",
                  fontSize: "0.85rem",
                  minWidth: "240px",
                }}
              />
            </div>
          </div>

          {/* Top 3 Podium Cards */}
          {leaderboard?.standings && leaderboard.standings.length >= 3 && !searchLb && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {leaderboard.standings.slice(0, 3).map((st, i) => {
                const medals = ["🥇 Quán quân", "🥈 Á quân", "🥉 Hạng ba"];
                const colors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                return (
                  <div
                    key={st.participantId}
                    style={{
                      background: "var(--surface)",
                      border: `1px solid ${colors[i]}`,
                      borderRadius: "8px",
                      padding: "1rem",
                      position: "relative",
                      boxShadow: `0 0 12px ${colors[i]}22`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: colors[i] }}>
                        {medals[i]}
                      </span>
                      <span style={{ fontSize: "0.75rem", background: "var(--surface-subtle)", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                        {st.unitCode}
                      </span>
                    </div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.25rem" }}>
                      {st.displayName}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                      Mã: {st.personKey}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                      <span>Điểm: <strong style={{ color: "var(--system-cyan)" }}>{st.tournamentScore}</strong></span>
                      <span>Elo: <strong style={{ color: "var(--system-green)" }}>{st.tournamentElo}</strong></span>
                      <span>Thắng: <strong>{st.wins}/{st.matchesPlayed}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standings Table */}
          {(() => {
            const all = leaderboard?.standings ?? [];
            const filtered = all.filter((s) => {
              if (!searchLb) return true;
              const q = searchLb.toLowerCase();
              return (
                s.displayName.toLowerCase().includes(q) ||
                s.personKey.toLowerCase().includes(q) ||
                s.unitCode.toLowerCase().includes(q)
              );
            });
            const pageSize = 50;
            const totalPages = Math.ceil(filtered.length / pageSize) || 1;
            const displayed = filtered.slice((pageLb - 1) * pageSize, pageLb * pageSize);

            return (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "0.75rem 1rem", width: "60px" }}>Hạng</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Thí sinh / Bot</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Đơn vị</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Điểm giải</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Elo</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Thắng</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Thua</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Số trận</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Trận cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                          Không tìm thấy thí sinh nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      displayed.map((row) => (
                        <tr key={row.participantId} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: row.rank <= 3 ? 800 : 500 }}>
                            {row.rank === 1 ? "🥇 1" : row.rank === 2 ? "🥈 2" : row.rank === 3 ? "🥉 3" : `#${row.rank}`}
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{row.displayName}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.personKey}</div>
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span style={{ background: "var(--surface-subtle)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontSize: "0.8rem" }}>
                              {row.unitCode}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700, color: "var(--system-cyan)" }}>
                            {row.tournamentScore}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 600, color: "var(--system-green)" }}>
                            {row.tournamentElo}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--system-green)", fontWeight: 600 }}>
                            {row.wins}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "var(--system-red)" }}>
                            {row.losses}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                            {row.matchesPlayed}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            #{row.lastFinishedSequence || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Trang {pageLb} / {totalPages} (Tổng số {filtered.length} thí sinh)
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        disabled={pageLb <= 1}
                        onClick={() => setPageLb((p) => Math.max(1, p - 1))}
                        className="button secondary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                      >
                        Trang trước
                      </button>
                      <button
                        type="button"
                        disabled={pageLb >= totalPages}
                        onClick={() => setPageLb((p) => Math.min(totalPages, p + 1))}
                        className="button secondary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Tab 5: Matches & Pairings */}
      {activeTab === "matches" && (
        <section
          id="panel-matches"
          role="tabpanel"
          aria-labelledby="tab-matches"
          data-testid="panel-matches"
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {/* Header Summary */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              background: "var(--surface)",
              padding: "1rem 1.25rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", color: "var(--system-purple)" }}>
                Nhật Ký Trận Đấu & Xếp Cặp ({matches.length} Trận Đấu)
              </h3>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Phương pháp ghép cặp: <strong>{core.pairingMethod}</strong> · Giới hạn tải: {core.maxConcurrentMatches} trận đồng thời
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Tìm mã trận, thí sinh..."
                value={searchMatches}
                onChange={(e) => { setSearchMatches(e.target.value); setPageMatches(1); }}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                  color: "var(--text)",
                  fontSize: "0.85rem",
                  minWidth: "240px",
                }}
              />
            </div>
          </div>

          {/* Matches Table */}
          {(() => {
            const filtered = matches.filter((m) => {
              if (!searchMatches) return true;
              const q = searchMatches.toLowerCase();
              return (
                m.matchId.toLowerCase().includes(q) ||
                m.blueParticipantId.toLowerCase().includes(q) ||
                m.redParticipantId.toLowerCase().includes(q) ||
                m.resolutionSource.toLowerCase().includes(q)
              );
            });
            const pageSize = 50;
            const totalPages = Math.ceil(filtered.length / pageSize) || 1;
            const displayed = filtered.slice((pageMatches - 1) * pageSize, pageMatches * pageSize);

            return (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <th style={{ padding: "0.75rem 1rem", width: "70px" }}>STT</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Mã trận</th>
                      <th style={{ padding: "0.75rem 1rem", color: "var(--system-blue)" }}>Bên Xanh (Blue)</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>Kết quả</th>
                      <th style={{ padding: "0.75rem 1rem", color: "var(--system-red)" }}>Bên Đỏ (Red)</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Hình thức thắng</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                          Chưa có trận đấu nào trong nhật ký.
                        </td>
                      </tr>
                    ) : (
                      displayed.map((m) => {
                        const isBlueWinner = m.winnerSide === "BLUE";
                        return (
                          <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>
                              #{m.finishSequence}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              <code>{m.matchId}</code>
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <div style={{ fontWeight: isBlueWinner ? 700 : 500, color: isBlueWinner ? "var(--system-cyan)" : "var(--text)" }}>
                                {m.blueParticipantId}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {m.blueScoreBefore}đ (Elo {m.blueEloBefore}) → <strong>{m.blueScoreAfter}đ</strong> (Elo {m.blueEloAfter})
                              </div>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                              <span
                                style={{
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  background: isBlueWinner ? "color-mix(in srgb, var(--system-blue) 20%, transparent)" : "color-mix(in srgb, var(--system-red) 20%, transparent)",
                                  color: isBlueWinner ? "var(--system-cyan)" : "var(--system-red)",
                                }}
                              >
                                {isBlueWinner ? "XANH THẮNG" : "ĐỎ THẮNG"}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <div style={{ fontWeight: !isBlueWinner ? 700 : 500, color: !isBlueWinner ? "var(--system-red)" : "var(--text)" }}>
                                {m.redParticipantId}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {m.redScoreBefore}đ (Elo {m.redEloBefore}) → <strong>{m.redScoreAfter}đ</strong> (Elo {m.redEloAfter})
                              </div>
                            </td>
                            <td style={{ padding: "0.75rem 1rem" }}>
                              <span style={{ fontSize: "0.78rem", background: "var(--surface-subtle)", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                                {m.resolutionSource}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {new Date(m.finishedAt).toLocaleTimeString("vi-VN")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Trang {pageMatches} / {totalPages} (Tổng số {filtered.length} trận đấu)
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        disabled={pageMatches <= 1}
                        onClick={() => setPageMatches((p) => Math.max(1, p - 1))}
                        className="button secondary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                      >
                        Trang trước
                      </button>
                      <button
                        type="button"
                        disabled={pageMatches >= totalPages}
                        onClick={() => setPageMatches((p) => Math.min(totalPages, p + 1))}
                        className="button secondary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Pause Confirmation Modal */}
      {showPauseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          data-testid="pause-tournament-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "1.5rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "var(--elevation-modal)",
            }}
          >
            <h3 id="pause-modal-title" style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", color: "var(--system-amber)" }}>
              Tạm dừng giải đấu
            </h3>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Vui lòng nhập lý do tạm dừng giải đấu (bắt buộc theo quy định kiểm toán). Các trận đấu đang diễn ra sẽ bị đóng băng đồng hồ.
            </p>
            <textarea
              data-testid="pause-reason-input"
              rows={3}
              placeholder="Ví dụ: Kiểm tra kỹ thuật sự cố mạng tại phòng máy..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--surface-subtle)",
                color: "var(--text)",
                fontSize: "0.88rem",
                marginBottom: "1rem",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                className="button secondary"
                style={{ fontSize: "0.85rem" }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                data-testid="confirm-pause-btn"
                onClick={handleConfirmPause}
                disabled={!pauseReason.trim() || actionLoading}
                className="button primary"
                style={{ fontSize: "0.85rem", background: "var(--system-amber)", borderColor: "var(--system-amber)" }}
              >
                {actionLoading ? "Đang xử lý..." : "Xác nhận tạm dừng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
