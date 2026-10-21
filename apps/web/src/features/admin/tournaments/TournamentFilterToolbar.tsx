import React from "react";
import type { TournamentListQuery } from "./tournamentTypes";

interface TournamentFilterToolbarProps {
  query: TournamentListQuery;
  onQueryChange: (newQuery: Partial<TournamentListQuery>) => void;
  totalItems: number;
}

const STATUS_TABS: Array<{
  id: "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "RUNNING" | "FINISHED";
  label: string;
}> = [
  { id: "ALL", label: "Tất cả" },
  { id: "DRAFT", label: "Bản nháp" },
  { id: "PENDING_REVIEW", label: "Chờ xét duyệt" },
  { id: "APPROVED", label: "Đã duyệt" },
  { id: "RUNNING", label: "Đang diễn ra" },
  { id: "FINISHED", label: "Đã kết thúc" },
];

export const TournamentFilterToolbar: React.FC<TournamentFilterToolbarProps> = ({
  query,
  onQueryChange,
  totalItems,
}) => {
  const currentTab = query.statusGroup || "ALL";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        marginBottom: "1.25rem",
      }}
    >
      {/* Top row: Search input & summary */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.85rem",
        }}
      >
        <div style={{ position: "relative", minWidth: "260px", flex: "1 1 320px" }}>
          <input
            type="search"
            data-testid="tournament-search-input"
            placeholder="Tìm theo tên giải, mã slug, đơn vị..."
            value={query.q || ""}
            onChange={(e) => onQueryChange({ q: e.target.value, page: 1 })}
            style={{
              width: "100%",
              padding: "0.6rem 0.85rem 0.6rem 2.2rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
              fontSize: "0.85rem",
            }}
          >
            🔍
          </span>
          {query.q && (
            <button
              type="button"
              data-testid="clear-search-button"
              onClick={() => onQueryChange({ q: "", page: 1 })}
              style={{
                position: "absolute",
                right: "0.65rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "0.2rem",
                fontSize: "0.85rem",
              }}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Counter summary */}
        <div
          data-testid="tournament-count-summary"
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-data)",
          }}
        >
          {totalItems} giải đấu đang hiển thị
        </div>
      </div>

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Lọc theo trạng thái giải đấu"
        style={{
          display: "flex",
          gap: "0.4rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              data-testid={`status-tab-${tab.id}`}
              aria-selected={isActive}
              onClick={() => onQueryChange({ statusGroup: tab.id, page: 1 })}
              style={{
                padding: "0.35rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid",
                borderColor: isActive ? "var(--system-cyan)" : "var(--border)",
                background: isActive
                  ? "color-mix(in srgb, var(--system-cyan) 18%, var(--surface))"
                  : "var(--surface)",
                color: isActive ? "var(--system-cyan)" : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all var(--motion-fast)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
