import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../app/routes";
import {
  fetchMyTournaments,
  type MyEnrollment,
  type MyTournamentSummary,
} from "../services/tournament-player/myTournamentApi";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Chuẩn bị",
  SUBMITTED: "Đã gửi duyệt",
  UNDER_REVIEW: "Đang chờ duyệt",
  CHANGES_REQUESTED: "Ban tổ chức đang chỉnh sửa",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã hủy hồ sơ",
  SCHEDULED: "Sắp diễn ra",
  RUNNING: "Đang diễn ra",
  PAUSED: "Tạm dừng",
  PAUSED_ADJUDICATION: "Tạm dừng chờ phán quyết",
  CANCELLED: "Đã hủy",
  ENDED: "Đã kết thúc",
  FINALIZED: "Đã tổng kết",
  ARCHIVED: "Đã lưu trữ",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatSchedule(t: MyTournamentSummary): string {
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("vi-VN", { hour12: false }) : "—";
  return `${fmt(t.scheduledStartAt)} → ${fmt(t.scheduledEndAt)}`;
}

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("vi-VN", { hour12: false }) : "—";
}

function enrollmentStateLabel(enrollment: MyEnrollment): string {
  if (enrollment.eligibilityStatus === "WITHDRAWN") return "Đã rút lui khỏi giải";
  if (enrollment.eligibilityStatus === "DISQUALIFIED") return "Bị loại khỏi giải";
  if (enrollment.checkedInAt) return "Đã điểm danh — sẵn sàng thi đấu";
  return "Đã ghi danh — đủ điều kiện thi đấu";
}

export const MyTournamentsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ tournament: MyTournamentSummary; enrollment: MyEnrollment }>>([]);

  useEffect(() => {
    let mounted = true;
    fetchMyTournaments()
      .then((res) => {
        if (mounted) {
          setItems(res.items);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách giải của bạn.");
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="page-container" data-testid="my-tournaments-loading" style={{ padding: "2rem 1rem" }}>
        <p style={{ color: "var(--text-secondary)" }}>Đang tải các giải của bạn…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" data-testid="my-tournaments-error" style={{ padding: "2rem 1rem" }}>
        <div role="alert" style={{ color: "var(--danger, #ef4444)", fontWeight: 600 }}>{error}</div>
        <Link to={routes.home} className="button secondary" style={{ display: "inline-block", marginTop: "1rem" }}>
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="my-tournaments-page" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>KHU VỰC THI ĐẤU GIẢI</p>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Giải đấu của tôi</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "0.3rem 0 0" }}>
          Các giải đấu bạn được Ban tổ chức ghi danh vào danh sách thí sinh. Việc tham gia giải do Ban tổ chức quyết định — liên hệ trực tiếp với Ban tổ chức nếu bạn muốn tham gia.
        </p>
      </header>

      {items.length === 0 ? (
        <div
          data-testid="my-tournaments-empty"
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1.5rem", background: "var(--surface)" }}
        >
          <strong>Bạn chưa tham gia giải đấu nào.</strong>
          <p style={{ margin: "0.4rem 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
            Khi Ban tổ chức thêm bạn vào danh sách thí sinh của một giải, giải đó sẽ xuất hiện tại đây kèm lịch thi đấu, cặp đấu và bảng xếp hạng riêng của giải.
          </p>
          <Link to={routes.home} className="button secondary" style={{ display: "inline-block", marginTop: "1rem" }}>
            Về sảnh để chơi thường
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {items.map(({ tournament: t, enrollment }) => (
            <Link
              key={t.id}
              to={`${routes.myTournaments}/${t.id}`}
              data-testid={`my-tournament-card-${t.id}`}
              style={{
                display: "block",
                textDecoration: "none",
                border: "1px solid color-mix(in srgb, var(--system-cyan) 28%, var(--border))",
                borderRadius: "var(--radius-md)",
                background: "var(--lab-panel)",
                padding: "1rem 1.15rem",
                color: "var(--text)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: "0.72rem", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                    MÃ: {t.tournamentCode}
                  </span>
                  <h2 style={{ margin: "0.15rem 0 0", fontSize: "1.05rem", fontWeight: 800 }}>{t.tournamentName}</h2>
                </div>
                <span className="badge" style={{ padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 }}>
                  {statusLabel(t.status)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.6rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <span>Lịch: <strong style={{ color: "var(--text)" }}>{formatSchedule(t)}</strong></span>
                <span>Ban tổ chức: <strong style={{ color: "var(--text)" }}>{t.organizersText || "—"}</strong></span>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.5rem", fontSize: "0.82rem" }}>
                <span style={{ color: "var(--system-green, #10b981)", fontWeight: 600 }}>{enrollmentStateLabel(enrollment)}</span>
                <span style={{ color: "var(--text-muted)" }}>Điểm khởi đầu của bạn: <strong style={{ color: "var(--text)" }}>{enrollment.seedRating}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Đơn vị: {enrollment.unitCode}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Dữ liệu cập nhật lần cuối khi tải trang — bấm tải lại trang để làm mới. Điểm số hiển thị là điểm khởi đầu trong từng giải, tách biệt với Elo xếp hạng toàn hệ thống. Cập nhật lúc: {formatDateTime(new Date().toISOString())}.
        </p>
      )}
    </div>
  );
};

export default MyTournamentsPage;
