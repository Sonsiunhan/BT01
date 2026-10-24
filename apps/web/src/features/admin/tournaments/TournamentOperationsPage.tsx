import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { TournamentDto } from "@ottv2/contracts";
import { defaultTournamentApi } from "./tournamentApi";
import { routes } from "../../../app/routes";
import { safeErrorMessage } from "../../../services/http/safeErrorMessage";
import { UiGlyph } from "../../../components/ui/UiGlyph";

export const TournamentOperationsPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<TournamentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal tạm dừng
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  useEffect(() => {
    let active = true;
    if (!tournamentId) return;

    setLoading(true);
    setError(null);
    defaultTournamentApi
      .getTournamentDetail(tournamentId)
      .then((res) => {
        if (active) setTournament(res.tournament);
      })
      .catch((err) => {
        if (active) setError(safeErrorMessage(err, "Không thể tải thông tin điều hành giải đấu."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tournamentId]);

  const handlePause = async () => {
    if (!tournamentId || !tournament) return;
    if (!pauseReason.trim()) {
      alert("Vui lòng nhập lý do tạm dừng giải đấu.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await defaultTournamentApi.pauseTournament(tournamentId, pauseReason.trim(), tournament.revision);
      setTournament(res.tournament);
      setShowPauseModal(false);
      setPauseReason("");
      setSuccessMessage("Đã tạm dừng giải đấu khẩn cấp thành công.");
    } catch (err) {
      setError(safeErrorMessage(err, "Không thể tạm dừng giải đấu."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!tournamentId || !tournament) return;
    try {
      setActionLoading(true);
      const res = await defaultTournamentApi.resumeTournament(tournamentId, tournament.revision);
      setTournament(res.tournament);
      setSuccessMessage("Đã tiếp tục giải đấu thành công.");
    } catch (err) {
      setError(safeErrorMessage(err, "Không thể tiếp tục giải đấu."));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <p>Đang tải trung tâm điều hành giải đấu...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
          <h2 style={{ color: "var(--system-red)", marginBottom: "0.5rem" }}>Lỗi tải dữ liệu</h2>
          <p>{error ?? "Không tìm thấy giải đấu."}</p>
          <Link to={routes.adminTournaments} className="button secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Quay lại danh sách giải
          </Link>
        </div>
      </div>
    );
  }

  const isRunning = tournament.status === "RUNNING";
  const isPaused = tournament.status === "PAUSED";

  return (
    <div style={{ padding: "1.5rem 2rem", maxWidth: "1200px", margin: "0 auto", color: "var(--text)" }}>
      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          <Link to={routes.adminTournaments} style={{ color: "inherit", textDecoration: "none" }}>Giải đấu</Link>
          <span>/</span>
          <Link to={`/admin/tournaments/${tournament.id}`} style={{ color: "inherit", textDecoration: "none" }}>{tournament.coreConfig.tournamentName}</Link>
          <span>/</span>
          <span style={{ color: "var(--text)" }}>Điều hành sự cố (P03)</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <UiGlyph name="warning" size={28} />
              Điều hành & Xử lý sự cố giải đấu
            </h1>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Mã giải: <strong style={{ fontFamily: "var(--font-data)" }}>{tournament.coreConfig.tournamentCode}</strong> | Trạng thái: <span className="badge" style={{ textTransform: "uppercase" }}>{tournament.status}</span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link to={`/admin/tournaments/${tournament.id}`} className="button secondary">
              Quay lại
            </Link>
            <Link to={`/admin/tournaments/${tournament.id}/adjudications`} className="button secondary">
              Phán quyết hòa (P05)
            </Link>
            <Link to={`/admin/tournaments/${tournament.id}/audit`} className="button secondary">
              Nhật ký kiểm toán
            </Link>
          </div>
        </div>
      </div>

      {successMessage && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid var(--system-green)", borderRadius: "0.5rem", marginBottom: "1.25rem", color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Control Panel: Emergency Pause / Resume */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "var(--shadow-raised)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UiGlyph name="clock" size={20} />
            Điều khiển vòng đời khẩn cấp
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: 1.5 }}>
            Khi xảy ra sự cố mạng, tranh chấp bàn cờ hoặc cần kiểm tra kỹ thuật, Tournament Admin có thể tạm dừng khẩn cấp toàn bộ các trận đấu.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {isRunning && (
              <button
                type="button"
                onClick={() => setShowPauseModal(true)}
                disabled={actionLoading}
                className="button danger"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", background: "var(--system-red)", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}
              >
                Tạm dừng giải đấu khẩn cấp
              </button>
            )}

            {isPaused && (
              <button
                type="button"
                onClick={handleResume}
                disabled={actionLoading}
                className="button primary"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", background: "var(--system-green)", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}
              >
                {actionLoading ? "Đang xử lý..." : "Tiếp tục giải đấu (Resume)"}
              </button>
            )}

            {!isRunning && !isPaused && (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Thao tác khẩn cấp chỉ khả dụng khi giải đấu đang ở trạng thái RUNNING hoặc PAUSED.
              </span>
            )}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "var(--shadow-raised)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UiGlyph name="trophy" size={20} />
            Liên kết xử lý trọng tài
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: 1.5 }}>
            Khi các bàn cờ rơi vào tình trạng hòa cờ lặp lại hoặc thí sinh khiếu nại, chuyển tiếp trực tiếp sang bàn xử lý của Nam (P05).
          </p>
          <Link
            to={`/admin/tournaments/${tournament.id}/adjudications`}
            className="button primary"
            style={{ display: "inline-block", fontSize: "0.85rem", padding: "0.5rem 1rem", textDecoration: "none", borderRadius: "0.375rem", fontWeight: 600 }}
          >
            Mở bảng phán quyết hòa (P05)
          </Link>
        </div>
      </div>

      {/* Active Incidents / Status section */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
          Nhật ký trạng thái vận hành hiện tại
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Thời điểm bắt đầu</span>
            <strong style={{ fontFamily: "var(--font-data)", fontSize: "0.9rem" }}>{tournament.startedAt ? new Date(tournament.startedAt).toLocaleString("vi-VN") : "Chưa bắt đầu"}</strong>
          </div>
          <div style={{ padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Thời điểm tạm dừng</span>
            <strong style={{ fontFamily: "var(--font-data)", fontSize: "0.9rem" }}>{tournament.pausedAt ? new Date(tournament.pausedAt).toLocaleString("vi-VN") : "Không có"}</strong>
          </div>
          <div style={{ padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Lý do tạm dừng gần nhất</span>
            <span style={{ fontSize: "0.9rem" }}>{tournament.pauseReason || "Không có"}</span>
          </div>
          <div style={{ padding: "0.75rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Phiên bản cấu hình ghim</span>
            <strong style={{ fontFamily: "var(--font-data)", fontSize: "0.9rem" }}>Version #{tournament.activeConfigVersionNumber}</strong>
          </div>
        </div>
      </div>

      {/* Modal Tạm Dừng Khẩn Cấp */}
      {showPauseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.75)", display: "grid", placeItems: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "500px", width: "100%", boxShadow: "var(--shadow-raised)" }}>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--system-red)", fontSize: "1.2rem" }}>Xác nhận tạm dừng giải đấu</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Khi tạm dừng, mọi trận đấu đang chạy sẽ đóng băng đồng hồ đếm ngược. Vui lòng ghi rõ lý do sự cố để lưu vào nhật ký kiểm toán.
            </p>
            <textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Nhập lý do sự cố (VD: Mất kết nối mạng tại phòng máy, trọng tài yêu cầu xác minh...)"
              style={{ width: "100%", minHeight: "80px", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--surface-raised)", color: "var(--text)", marginBottom: "1rem", fontFamily: "var(--font-body)" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" onClick={() => setShowPauseModal(false)} className="button secondary" style={{ fontSize: "0.85rem", padding: "0.45rem 0.85rem" }}>
                Hủy bỏ
              </button>
              <button type="button" onClick={handlePause} disabled={actionLoading || !pauseReason.trim()} className="button danger" style={{ fontSize: "0.85rem", padding: "0.45rem 0.85rem", background: "var(--system-red)", color: "#fff", border: "none", borderRadius: "0.375rem" }}>
                {actionLoading ? "Đang xử lý..." : "Xác nhận tạm dừng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentOperationsPage;
