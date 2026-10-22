import React from "react";
import type { TournamentPageInfo } from "./tournamentTypes";

interface TournamentPaginationProps {
  pageInfo: TournamentPageInfo;
  onPageChange: (newPage: number) => void;
}

export const TournamentPagination: React.FC<TournamentPaginationProps> = ({
  pageInfo,
  onPageChange,
}) => {
  const { currentPage, totalPages, totalItems, hasPrev, hasNext } = pageInfo;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      data-testid="tournament-pagination"
      aria-label="Phân trang giải đấu"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "1.5rem",
        paddingTop: "1rem",
        borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
        Trang <strong style={{ color: "var(--text)" }}>{currentPage}</strong> trên{" "}
        <strong style={{ color: "var(--text)" }}>{totalPages}</strong> ({totalItems} mục)
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          data-testid="pagination-prev-btn"
          className="button secondary"
          disabled={!hasPrev}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: "0.3rem 0.75rem",
            fontSize: "0.82rem",
            opacity: hasPrev ? 1 : 0.45,
            cursor: hasPrev ? "pointer" : "not-allowed",
          }}
        >
          ← Trang trước
        </button>

        <button
          type="button"
          data-testid="pagination-next-btn"
          className="button secondary"
          disabled={!hasNext}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: "0.3rem 0.75rem",
            fontSize: "0.82rem",
            opacity: hasNext ? 1 : 0.45,
            cursor: hasNext ? "pointer" : "not-allowed",
          }}
        >
          Trang sau →
        </button>
      </div>
    </nav>
  );
};
