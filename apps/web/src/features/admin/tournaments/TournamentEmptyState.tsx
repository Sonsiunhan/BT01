import React from "react";
import { Link } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";

interface TournamentEmptyStateProps {
  type: "empty" | "no-results";
  canCreate?: boolean;
  onResetFilter?: () => void;
}

export const TournamentEmptyState: React.FC<TournamentEmptyStateProps> = ({
  type,
  canCreate = true,
  onResetFilter,
}) => {
  if (type === "no-results") {
    return (
      <div
        data-testid="tournament-no-results"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3.5rem 1.5rem",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border)",
          background: "var(--surface)",
          textAlign: "center",
          gap: "1rem",
        }}
      >
        <span aria-hidden="true"><UiGlyph name="search" size={32} /></span>
        <div>
          <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "1.05rem", color: "var(--text)" }}>
            Không tìm thấy giải đấu phù hợp
          </h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Thử thay đổi từ khóa tìm kiếm hoặc chọn nhóm trạng thái khác.
          </p>
        </div>

        {onResetFilter && (
          <button
            type="button"
            data-testid="reset-filter-button"
            className="button secondary"
            onClick={onResetFilter}
            style={{
              padding: "0.45rem 1rem",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <UiGlyph name="refresh" size={15} /> Xóa bộ lọc tìm kiếm
          </button>
        )}
      </div>
    );
  }

  // P01.empty
  return (
    <div
      data-testid="tournament-empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 1.5rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
        background: "var(--lab-panel)",
        boxShadow: "var(--lab-bevel)",
        textAlign: "center",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--system-cyan) 15%, transparent)",
          border: "1px solid color-mix(in srgb, var(--system-cyan) 35%, transparent)",
        }}
      >
        <UiGlyph name="trophy" size={28} />
      </div>

      <div style={{ maxWidth: "26rem" }}>
        <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "1.15rem", color: "var(--text)" }}>
          Chưa có giải đấu nào được khởi tạo
        </h4>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Bắt đầu tạo giải đấu mới để thiết lập thể thức thi đấu, danh sách thí sinh và luật chơi theo hợp đồng của đơn vị.
        </p>
      </div>

      {canCreate ? (
        <Link
          to="/admin/tournaments/new"
          data-testid="empty-create-tournament-btn"
          className="button primary"
          style={{
            padding: "0.55rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          + Tạo giải đấu đầu tiên
        </Link>
      ) : (
        <div
          data-testid="empty-cannot-create-hint"
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          Tài khoản của bạn chỉ có quyền xem danh sách giải đấu.
        </div>
      )}
    </div>
  );
};
