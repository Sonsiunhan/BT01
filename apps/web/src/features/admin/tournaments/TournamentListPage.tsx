import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type {
  TournamentListItem,
  TournamentListQuery,
  TournamentListResponse,
} from "./tournamentTypes";
import { defaultTournamentApi, type TournamentApiPort } from "./tournamentApi";
import { TournamentCard } from "./TournamentCard";
import { TournamentFilterToolbar } from "./TournamentFilterToolbar";
import { TournamentPagination } from "./TournamentPagination";
import { TournamentEmptyState } from "./TournamentEmptyState";

interface TournamentListPageProps {
  apiClient?: TournamentApiPort;
  initialQuery?: TournamentListQuery;
  canCreateOverride?: boolean;
}

export const TournamentListPage: React.FC<TournamentListPageProps> = ({
  apiClient = defaultTournamentApi,
  initialQuery = {},
  canCreateOverride,
}) => {
  const [query, setQuery] = useState<TournamentListQuery>({
    page: 1,
    pageSize: 6,
    statusGroup: "ALL",
    ...initialQuery,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TournamentListResponse | null>(null);

  const fetchTournaments = useCallback(
    async (q: TournamentListQuery) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.listTournaments(q);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải danh sách giải đấu.");
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    fetchTournaments(query);
  }, [fetchTournaments, query]);

  const handleQueryChange = (patch: Partial<TournamentListQuery>) => {
    setQuery((prev) => ({ ...prev, ...patch }));
  };

  const handleResetFilter = () => {
    setQuery({
      page: 1,
      pageSize: 6,
      statusGroup: "ALL",
      q: "",
    });
  };

  const items = data?.items || [];
  const pageInfo = data?.page || {
    currentPage: 1,
    pageSize: 6,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  const canCreate =
    canCreateOverride !== undefined
      ? canCreateOverride
      : (data?.capabilities?.canCreate ?? true);

  return (
    <div
      data-testid="tournament-list-page"
      className="page-container tournament-list-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        minHeight: "100%",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
        }}
      >
        <div>
          <span
            className="eyebrow"
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              display: "block",
              marginBottom: "0.2rem",
            }}
          >
            HỆ THỐNG GIẢI ĐẤU // TỔNG HỢP VÒNG ĐỜI
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            Quản lý giải đấu
          </h1>
        </div>

        {/* Create Tournament CTA with capability guard */}
        <div>
          {canCreate ? (
            <Link
              to="/admin/tournaments/new"
              data-testid="header-create-tournament-btn"
              className="button primary"
              style={{
                padding: "0.55rem 1.15rem",
                fontSize: "0.88rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>+</span> Tạo giải đấu mới
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid="header-create-tournament-disabled-btn"
              className="button secondary"
              title="Bạn không có quyền tournament.create để khởi tạo giải đấu mới"
              style={{
                padding: "0.55rem 1.15rem",
                fontSize: "0.88rem",
                opacity: 0.5,
                cursor: "not-allowed",
              }}
            >
              🔒 Tạo giải đấu (Chưa cấp quyền)
            </button>
          )}
        </div>
      </div>

      {/* Filter and search toolbar */}
      <TournamentFilterToolbar
        query={query}
        onQueryChange={handleQueryChange}
        totalItems={pageInfo.totalItems}
      />

      {/* Main Content States */}
      {loading ? (
        <div
          data-testid="tournament-loading-skeleton"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1rem",
          }}
        >
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              style={{
                height: "210px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                opacity: 0.6,
                animation: "pulse 1.5s infinite ease-in-out",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          data-testid="tournament-error-state"
          style={{
            padding: "2rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--danger)",
            background: "color-mix(in srgb, var(--danger) 8%, var(--surface))",
            color: "var(--danger)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "1.75rem" }}>⚠</span>
          <div>
            <h4 style={{ margin: "0 0 0.3rem 0" }}>Lỗi tải dữ liệu</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text)" }}>{error}</p>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => fetchTournaments(query)}
            style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            ↺ Thử lại
          </button>
        </div>
      ) : items.length === 0 ? (
        query.q || (query.statusGroup && query.statusGroup !== "ALL") ? (
          <TournamentEmptyState type="no-results" onResetFilter={handleResetFilter} />
        ) : (
          <TournamentEmptyState type="empty" canCreate={canCreate} />
        )
      ) : (
        <>
          {/* Card Grid */}
          <div
            data-testid="tournament-cards-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1.1rem",
            }}
          >
            {items.map((tournament) => (
              <TournamentCard key={tournament.tournamentId} tournament={tournament} />
            ))}
          </div>

          {/* Server-side Pagination */}
          <TournamentPagination
            pageInfo={pageInfo}
            onPageChange={(newPage) => handleQueryChange({ page: newPage })}
          />
        </>
      )}
    </div>
  );
};

export default TournamentListPage;
