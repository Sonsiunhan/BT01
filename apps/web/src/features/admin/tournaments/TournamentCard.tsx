import React from "react";
import { Link } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import type { TournamentListItem, TournamentLifecycleStatus } from "./tournamentTypes";

interface TournamentCardProps {
  tournament: TournamentListItem;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  const {
    tournamentId,
    name,
    slug,
    status,
    startAt,
    endAt,
    ownerDisplay,
    participantCount,
    maxParticipants,
    readiness,
    lastReviewNote,
  } = tournament;

  const statusBadge = getStatusBadgeConfig(status);
  const isDraftLike = status === "DRAFT" || status === "CHANGES_REQUESTED";
  // SA review feedback must be visible on the card itself: REJECTED cards have
  // no edit entry point, so the reason would otherwise be invisible.
  const showReviewFeedback =
    (status === "CHANGES_REQUESTED" || status === "REJECTED") && Boolean(lastReviewNote);
  const reviewExcerpt =
    lastReviewNote && lastReviewNote.length > 140
      ? `${lastReviewNote.slice(0, 140)}…`
      : lastReviewNote ?? null;
  const primaryActionUrl = isDraftLike
    ? `/admin/tournaments/${tournamentId}/edit`
    : `/admin/tournaments/${tournamentId}`;

  const primaryActionLabel = isDraftLike ? "Sửa bản nháp" : "Xem chi tiết";

  const scheduleText = formatSchedule(startAt, endAt);

  return (
    <article
      data-testid={`tournament-card-${tournamentId}`}
      className="tournament-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        border: "1px solid color-mix(in srgb, var(--system-cyan) 28%, var(--border))",
        borderRadius: "var(--radius-md)",
        background: "var(--lab-panel)",
        boxShadow: "var(--lab-bevel)",
        padding: "1.15rem",
        gap: "1rem",
        minWidth: 0,
        transition: "transform var(--motion-fast), box-shadow var(--motion-fast)",
      }}
    >
      {/* Top Header: Status & Slug */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
            }}
          >
            MÃ: <code style={{ color: "var(--system-cyan)" }}>{slug}</code>
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              lineHeight: 1.35,
              color: "var(--text)",
            }}
          >
            <Link
              to={primaryActionUrl}
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
              className="tournament-card-title-link"
            >
              {name}
            </Link>
          </h3>
        </div>

        {/* Status Badge */}
        <span
          data-testid="tournament-status-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.25rem 0.55rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
            background: statusBadge.bg,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`,
            boxShadow: "0 1px 0 rgba(0,0,0,0.15)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "currentColor",
            }}
          />
          {statusBadge.label}
        </span>
      </div>

      {/* Meta Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.65rem 1rem",
          fontSize: "0.82rem",
          padding: "0.75rem 0",
          borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
        }}
      >
        <div>
          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Đơn vị tổ chức</span>
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>{ownerDisplay}</strong>
        </div>

        <div>
          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Quy mô thí sinh</span>
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>
            {participantCount != null ? `${participantCount}` : "--"}
            {maxParticipants ? ` / ${maxParticipants} người` : " thí sinh"}
          </strong>
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.72rem" }}>Lịch thi đấu</span>
          <span style={{ color: "var(--text)", fontFamily: "var(--font-data)", fontSize: "0.8rem" }}>
            {scheduleText}
          </span>
        </div>
      </div>

      {/* Footer: Readiness status & Action CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginTop: "auto",
        }}
      >
        {/* Readiness indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.76rem" }}>
          {readiness.state === "READY" ? (
            <span style={{ color: "var(--system-green, #10b981)", fontWeight: 600 }}>● Sẵn sàng mở giải</span>
          ) : readiness.state === "BLOCKED" ? (
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              <UiGlyph name="warning" size={14} /> Có {readiness.blockerCount} điểm nghẽn
            </span>
          ) : readiness.state === "UNKNOWN" ? (
            <span
              data-testid="tournament-readiness-unknown"
              style={{
                color: "var(--text-muted)",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "0.1rem 0.5rem",
              }}
            >
              ◌ Chưa rõ
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>◌ Đang đối soát</span>
          )}
        </div>

        {showReviewFeedback && (
          <div
            data-testid={`tournament-review-note-${tournamentId}`}
            role="note"
            style={{
              border: "1px solid var(--warning, #f59e0b)",
              borderLeftWidth: "3px",
              borderRadius: "6px",
              background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, var(--surface))",
              padding: "0.5rem 0.7rem",
              fontSize: "0.78rem",
              color: "var(--text)",
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.15rem" }}>
              Phản hồi của Ban quản trị:
            </strong>
            <span style={{ color: "var(--text-secondary)" }}>{reviewExcerpt}</span>
          </div>
        )}

        {/* Action Button */}
        <Link
          to={primaryActionUrl}
          data-testid={`tournament-action-btn-${tournamentId}`}
          className={`button ${isDraftLike ? "secondary" : "primary"}`}
          style={{
            padding: "0.35rem 0.85rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          {primaryActionLabel} →
        </Link>
      </div>
    </article>
  );
};

// Exported as a deterministic presentation seam for the S02 contract test.
// eslint-disable-next-line react-refresh/only-export-components
export function getStatusBadgeConfig(status: TournamentLifecycleStatus): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "DRAFT":
      return {
        label: "Bản nháp",
        bg: "color-mix(in srgb, var(--warning, #EAB308) 15%, var(--surface))",
        color: "var(--warning, #FACC15)",
        border: "color-mix(in srgb, var(--warning, #EAB308) 40%, transparent)",
      };
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return {
        label: "Chờ xét duyệt",
        bg: "color-mix(in srgb, var(--violet, #A855F7) 15%, var(--surface))",
        color: "var(--violet, #C084FC)",
        border: "color-mix(in srgb, var(--violet, #A855F7) 40%, transparent)",
      };
    case "CHANGES_REQUESTED":
      // Không có token cam (orange) trong hệ thiết kế — giữ hex gốc, bọc theo cùng mẫu color-mix.
      return {
        label: "Cần chỉnh sửa",
        bg: "color-mix(in srgb, #F97316 15%, var(--surface))",
        color: "#FB923C",
        border: "color-mix(in srgb, #F97316 40%, transparent)",
      };
    case "APPROVED":
      return {
        label: "Đã phê duyệt",
        bg: "color-mix(in srgb, var(--system-cyan) 15%, var(--surface))",
        color: "var(--system-cyan)",
        border: "color-mix(in srgb, var(--system-cyan) 40%, transparent)",
      };
    case "READY":
    case "ROSTER_OPEN":
    case "SCHEDULED":
      return {
        label: "Lên lịch / Sẵn sàng",
        bg: "color-mix(in srgb, var(--success, #10B981) 15%, var(--surface))",
        color: "var(--success, #34D399)",
        border: "color-mix(in srgb, var(--success, #10B981) 40%, transparent)",
      };
    case "RUNNING":
      return {
        label: "Đang diễn ra",
        bg: "color-mix(in srgb, var(--success, #10B981) 22%, var(--surface))",
        color: "var(--success, #4ADE80)",
        border: "color-mix(in srgb, var(--success, #10B981) 50%, transparent)",
      };
    case "PAUSED":
      return {
        label: "Tạm dừng",
        bg: "color-mix(in srgb, var(--amber, #F59E0B) 18%, var(--surface))",
        color: "var(--amber, #FBBF24)",
        border: "color-mix(in srgb, var(--amber, #F59E0B) 45%, transparent)",
      };
    case "ENDED":
    case "FINALIZED":
      return {
        label: "Đã kết thúc",
        bg: "color-mix(in srgb, var(--text-secondary, #64748B) 15%, var(--surface))",
        color: "var(--text-muted, #94A3B8)",
        border: "color-mix(in srgb, var(--text-secondary, #64748B) 40%, transparent)",
      };
    case "REJECTED":
      return {
        label: "Bị từ chối",
        bg: "color-mix(in srgb, var(--danger, #EF4444) 15%, var(--surface))",
        color: "var(--danger, #F87171)",
        border: "color-mix(in srgb, var(--danger, #EF4444) 40%, transparent)",
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        bg: "color-mix(in srgb, var(--text-secondary, #6B7280) 15%, var(--surface))",
        color: "var(--text-muted, #9CA3AF)",
        border: "color-mix(in srgb, var(--text-secondary, #6B7280) 40%, transparent)",
      };
    default:
      return {
        label: status,
        bg: "var(--surface-raised)",
        color: "var(--text-muted)",
        border: "var(--border)",
      };
  }
}

function formatSchedule(startAt: string | null, endAt: string | null): string {
  if (!startAt && !endAt) {
    return "Chưa thiết lập khung giờ";
  }

  try {
    const formatDate = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    if (startAt && endAt) {
      return `${formatDate(startAt)} – ${formatDate(endAt)}`;
    }
    if (startAt) {
      return `Bắt đầu: ${formatDate(startAt)}`;
    }
    return `Kết thúc: ${formatDate(endAt!)}`;
  } catch {
    return "Lịch thi đấu";
  }
}
