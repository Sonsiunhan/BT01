import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { routes } from "../../../app/routes";
import { defaultTournamentApi, type TournamentApiPort } from "./tournamentApi";
import type {
  TournamentDto,
  TournamentReadinessSnapshot,
  ReadinessChecklistItem,
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
  const tournamentId = propTournamentId || paramTournamentId || "tour-001";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"overview" | "config" | "readiness">("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentDto | null>(null);
  const [readiness, setReadiness] = useState<TournamentReadinessSnapshot | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal pause state
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, readinessRes] = await Promise.allSettled([
        apiClient.getTournamentDetail(tournamentId),
        apiClient.getTournamentReadiness(tournamentId),
      ]);

      if (detailRes.status === "fulfilled") {
        setTournament(detailRes.value.tournament);
      } else {
        throw new Error(errorMessage(detailRes.reason, "Không thể tải thông tin giải đấu"));
      }

      if (readinessRes.status === "fulfilled") {
        setReadiness(readinessRes.value.readiness);
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
              alignItems: "center",
              gap: "1.2rem",
              marginTop: "0.4rem",
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              flexWrap: "wrap",
            }}
          >
            <span>
              Mã: <code style={{ color: "var(--system-cyan)" }}>{core.tournamentCode}</code>
            </span>
            <span>Đơn vị: <strong style={{ color: "var(--text)" }}>{core.organizersText}</strong></span>
            <span>Múi giờ: <strong style={{ color: "var(--text)" }}>{core.timezone}</strong></span>
          </div>
        </div>

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
                  color: "#0B1421",
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
                background: readiness.canStartRunning
                  ? "color-mix(in srgb, var(--system-green) 20%, transparent)"
                  : "color-mix(in srgb, var(--system-red) 20%, transparent)",
                color: readiness.canStartRunning ? "var(--system-green)" : "var(--system-red)",
                fontWeight: 700,
              }}
            >
              {readiness.canStartRunning ? "SẴN SÀNG" : `${readiness.blockers.length} CHẶN`}
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
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
                TIẾN ĐỘ THỜI GIAN
              </span>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
                {core.scheduledStartAt ? new Date(core.scheduledStartAt).toLocaleString("vi-VN") : "Chưa ấn định"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                đến {core.scheduledEndAt ? new Date(core.scheduledEndAt).toLocaleString("vi-VN") : "Chưa ấn định"}
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
          <div
            data-testid="readiness-banner"
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: readiness?.canStartRunning
                ? "color-mix(in srgb, var(--system-green) 12%, var(--surface))"
                : "color-mix(in srgb, var(--system-red) 12%, var(--surface))",
              border: `1px solid ${readiness?.canStartRunning ? "var(--system-green)" : "var(--system-red)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {readiness?.canStartRunning ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--system-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <UiGlyph name="warning" size={20} style={{ color: "var(--system-red)" }} />
                )}
                <strong
                  data-testid="readiness-overall-status"
                  style={{
                    fontSize: "1.05rem",
                    color: readiness?.canStartRunning ? "var(--system-green)" : "var(--system-red)",
                  }}
                >
                  {readiness?.canStartRunning
                    ? "ĐỦ ĐIỀU KIỆN SẴN SÀNG KHỞI CHẠY (READY)"
                    : "CHƯA ĐỦ ĐIỀU KIỆN KHỞI CHẠY (BLOCKED)"}
                </strong>
              </div>
              <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {readiness?.canStartRunning
                  ? "Tất cả các điều kiện tiên quyết từ máy chủ đã hoàn tất. Có thể bắt đầu giải đấu bất cứ lúc nào."
                  : `Hệ thống ghi nhận ${readiness?.blockers.length ?? 0} lý do chặn giải đấu khởi chạy. Vui lòng hoàn thành các yêu cầu bên dưới.`}
              </p>
            </div>

            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Kiểm tra lúc: {readiness ? new Date(readiness.evaluatedAt).toLocaleTimeString("vi-VN") : "--"}
            </div>
          </div>

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
