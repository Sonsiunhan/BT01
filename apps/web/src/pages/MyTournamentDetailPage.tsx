import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { routes } from "../app/routes";
import {
  fetchMyTournamentDetail,
  type MyEnrollment,
  type MyMatch,
  type MyTournamentDetail as Detail,
  type MyTournamentSummary,
} from "../services/tournament-player/myTournamentApi";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Chuẩn bị",
  UNDER_REVIEW: "Đang chờ duyệt",
  CHANGES_REQUESTED: "Ban tổ chức đang chỉnh sửa",
  APPROVED: "Đã duyệt",
  SCHEDULED: "Sắp diễn ra",
  RUNNING: "Đang diễn ra",
  PAUSED: "Tạm dừng",
  PAUSED_ADJUDICATION: "Tạm dừng chờ phán quyết",
  CANCELLED: "Đã hủy",
  ENDED: "Đã kết thúc",
  FINALIZED: "Đã tổng kết",
  REJECTED: "Đã hủy hồ sơ",
  ARCHIVED: "Đã lưu trữ",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("vi-VN", { hour12: false }) : "—";
}

function matchStatusLabel(m: MyMatch): string {
  switch (m.status) {
    case "RUNNING":
      return "Đang thi đấu";
    case "PAUSED":
      return "Tạm dừng";
    case "PAUSED_ADJUDICATION":
      return "Chờ phán quyết";
    case "FINISHED":
      return m.iWon ? "Bạn thắng" : "Bạn thua";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return m.status;
  }
}

export const MyTournamentDetailPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      setError("Không xác định được giải đấu.");
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchMyTournamentDetail(tournamentId)
      .then((res) => {
        if (mounted) setDetail(res);
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : "Không thể tải thông tin giải.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="page-container" data-testid="my-tournament-detail-loading" style={{ padding: "2rem 1rem" }}>
        <p style={{ color: "var(--text-secondary)" }}>Đang tải giải đấu…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-container" data-testid="my-tournament-detail-error" style={{ padding: "2rem 1rem" }}>
        <div role="alert" style={{ color: "var(--danger, #ef4444)", fontWeight: 600 }}>{error ?? "Không tìm thấy giải đấu."}</div>
        <Link to={routes.myTournaments} className="button secondary" style={{ display: "inline-block", marginTop: "1rem" }}>
          ← Các giải của tôi
        </Link>
      </div>
    );
  }

  const t: MyTournamentSummary = detail.tournament;
  const enrollment: MyEnrollment = detail.enrollment;
  const standings = detail.standings?.standings ?? [];
  const myStandingsRow = standings.find((row) => row.participantId === enrollment.enrollmentId);

  return (
    <div className="page-container" data-testid="my-tournament-detail-page" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "0.75rem" }}>
        <Link to={routes.myTournaments} style={{ color: "var(--system-cyan)", fontWeight: 600 }}>← Giải đấu của tôi</Link>
      </nav>

      <header style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: "0.72rem", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
            MÃ: {t.tournamentCode}
          </span>
          <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{t.tournamentName}</h1>
          <p style={{ margin: "0.3rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Ban tổ chức: {t.organizersText || "—"} · Múi giờ: {t.timezone}
          </p>
        </div>
        <span className="badge" style={{ padding: "0.25rem 0.6rem", borderRadius: 4, fontSize: "0.8rem", fontWeight: 700 }}>
          {statusLabel(t.status)}
        </span>
      </header>

      <section style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", margin: "1.1rem 0" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", padding: "0.9rem 1rem" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Tình trạng của bạn</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.85rem", display: "grid", gap: "0.3rem" }}>
            <li>Trạng thái ghi danh: <strong>{enrollment.eligibilityStatus === "ELIGIBLE" ? "Đủ điều kiện" : enrollment.eligibilityStatus}</strong></li>
            <li>Điểm danh: <strong>{enrollment.checkedInAt ? fmt(enrollment.checkedInAt) : (t.checkinRequired ? "Chưa điểm danh" : "Giải không yêu cầu điểm danh")}</strong></li>
            <li>Điểm khởi đầu trong giải: <strong>{enrollment.seedRating}</strong></li>
            <li>Đơn vị: <strong>{enrollment.unitCode}</strong></li>
            {enrollment.pinnedBotRevisionId && (
              <li>Bot ghim cho giải: <span style={{ fontFamily: "var(--font-data)", fontSize: "0.78rem" }}>{enrollment.pinnedBotRevisionId.slice(0, 12)}…</span></li>
            )}
          </ul>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", padding: "0.9rem 1rem" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Thể thức & lịch</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.85rem", display: "grid", gap: "0.3rem" }}>
            <li>Lịch thi đấu: <strong>{fmt(t.scheduledStartAt)} → {fmt(t.scheduledEndAt)}</strong></li>
            <li>Thể thức: <strong>{t.format ?? "—"} ({t.pairingMethod ?? "—"})</strong></li>
            <li>Chế độ: <strong>{t.competitionMode}</strong></li>
            <li>Điểm danh: <strong>{t.checkinRequired ? `Bắt buộc${t.checkinOpenAt ? ` — mở ${fmt(t.checkinOpenAt)}` : ""}` : "Không bắt buộc"}</strong></li>
            <li>Quy mô: <strong>tối đa {t.maxParticipants ?? "—"} thí sinh</strong></li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="my-matches-heading" style={{ marginBottom: "1.4rem" }}>
        <h2 id="my-matches-heading" style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Trận đấu của bạn ({detail.myMatches.length})</h2>
        {detail.myMatches.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Engine chưa ghép trận nào cho bạn. Khi giải diễn ra và cặp đấu của bạn được xác định, trận sẽ xuất hiện tại đây.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {detail.myMatches.map((m) => (
              <div
                key={m.matchId}
                data-testid={`my-match-${m.matchId}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", padding: "0.7rem 0.9rem" }}
              >
                <div style={{ fontSize: "0.88rem" }}>
                  <strong>{m.opponentName}</strong>
                  <span style={{ color: "var(--text-muted)" }}> · Bạn cầm {m.mySide === "BLUE" ? "Xanh" : "Đỏ"}</span>
                  <span style={{ color: "var(--text-muted)" }}> · {fmt(m.createdAt)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    className="badge"
                    style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: m.status === "RUNNING" ? "var(--system-cyan)" : m.status === "FINISHED" ? (m.iWon ? "var(--system-green, #10b981)" : "var(--danger)") : "var(--text-muted)",
                    }}
                  >
                    {matchStatusLabel(m)}
                  </span>
                  {m.status === "RUNNING" && m.roomId && (
                    <Link to={`/game/${m.roomId}`} className="button primary" style={{ fontSize: "0.8rem", padding: "0.35rem 0.8rem", textDecoration: "none" }} data-testid={`my-match-enter-${m.matchId}`}>
                      Vào trận →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="my-standings-heading" style={{ marginBottom: "2rem" }}>
        <h2 id="my-standings-heading" style={{ fontSize: "1.05rem", margin: "0 0 0.5rem" }}>Bảng xếp hạng giải</h2>
        {detail.standingsHiddenReason === "HIDDEN_UNTIL_END" ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Ban tổ chức chọn ẩn bảng xếp hạng đến khi giải kết thúc.
          </p>
        ) : standings.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Chưa có trận nào được tính điểm — bảng xếp hạng sẽ xuất hiện sau khi các trận đấu kết thúc.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Hạng</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Thí sinh</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Đơn vị</th>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.6rem" }}>Điểm</th>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.6rem" }}>Elo giải</th>
                  <th style={{ textAlign: "right", padding: "0.4rem 0.6rem" }}>Thắng / Thua</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const isMe = row.participantId === enrollment.enrollmentId;
                  return (
                    <tr key={row.participantId} style={isMe ? { background: "color-mix(in srgb, var(--system-cyan) 12%, transparent)", fontWeight: 700 } : undefined}>
                      <td style={{ padding: "0.4rem 0.6rem" }}>#{row.rank}</td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        {row.displayName}
                        {isMe && <span style={{ color: "var(--system-cyan)" }}> (bạn)</span>}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>{row.unitCode}</td>
                      <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>{row.tournamentScore}</td>
                      <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", fontFamily: "var(--font-data)" }}>{row.tournamentElo}</td>
                      <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>{row.wins} / {row.losses}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {myStandingsRow && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Vị trí hiện tại của bạn: #{myStandingsRow.rank} — {myStandingsRow.tournamentScore} điểm, Elo giải {myStandingsRow.tournamentElo}.
          </p>
        )}
      </section>
    </div>
  );
};

export default MyTournamentDetailPage;
