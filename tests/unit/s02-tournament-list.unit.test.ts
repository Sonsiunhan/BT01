import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TournamentApiClient,
  FIXTURE_TOURNAMENTS,
  matchesStatusGroup,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";
import { getStatusBadgeConfig } from "../../apps/web/src/features/admin/tournaments/TournamentCard";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S02 — Tournament List Page (P01) Contract & Behavioral Tests", () => {
  const client = new TournamentApiClient();

  it("AC-01: Router correctly mounts TournamentListPage on canonical /admin/tournaments route", () => {
    const routerContent = read("apps/web/src/app/router.tsx");

    expect(routerContent).toContain("TournamentListPage");
    expect(routerContent).toContain(
      '<Route path={routes.adminTournaments} element={<TournamentListPage />} />'
    );
  });

  it("AC-02: TournamentApiClient filters by text search (name and slug)", () => {
    // Search by name substring
    const nameSearch = client.filterFixtures({ q: "Quốc gia" });
    expect(nameSearch.items.length).toBeGreaterThan(0);
    expect(nameSearch.items.every((t) => t.name.includes("Quốc gia"))).toBe(true);

    // Search by slug
    const slugSearch = client.filterFixtures({ q: "giao-huu" });
    expect(slugSearch.items).toHaveLength(1);
    expect(slugSearch.items[0].slug).toBe("giao-huu-k22");

    // Search matches nothing
    const emptySearch = client.filterFixtures({ q: "non-existent-search-key-12345" });
    expect(emptySearch.items).toHaveLength(0);
    expect(emptySearch.page.totalItems).toBe(0);
  });

  it("AC-03: TournamentApiClient correctly handles status groups and lifecycle matches", () => {
    // DRAFT group
    const drafts = client.filterFixtures({ statusGroup: "DRAFT" });
    expect(drafts.items.length).toBeGreaterThan(0);
    expect(drafts.items.every((t) => t.status === "DRAFT" || t.status === "CHANGES_REQUESTED")).toBe(true);

    // RUNNING group
    const running = client.filterFixtures({ statusGroup: "RUNNING" });
    expect(running.items.length).toBeGreaterThan(0);
    expect(running.items.every((t) => t.status === "RUNNING" || t.status === "PAUSED")).toBe(true);

    // ALL group
    const all = client.filterFixtures({ statusGroup: "ALL" });
    expect(all.page.totalItems).toBe(FIXTURE_TOURNAMENTS.length);

    // Verify helper function
    expect(matchesStatusGroup("DRAFT", "DRAFT")).toBe(true);
    expect(matchesStatusGroup("APPROVED", "APPROVED")).toBe(true);
    expect(matchesStatusGroup("RUNNING", "RUNNING")).toBe(true);
    expect(matchesStatusGroup("ENDED", "FINISHED")).toBe(true);
    expect(matchesStatusGroup("RUNNING", "DRAFT")).toBe(false);
  });

  it("AC-04: Pagination calculates bounds, pages and items correctly", () => {
    const page1 = client.filterFixtures({ page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.page.currentPage).toBe(1);
    expect(page1.page.pageSize).toBe(2);
    expect(page1.page.hasNext).toBe(true);
    expect(page1.page.hasPrev).toBe(false);

    const page2 = client.filterFixtures({ page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.page.currentPage).toBe(2);
    expect(page2.page.hasPrev).toBe(true);
  });

  it("AC-05: Status badge config returns accessible text and contrast colors for all key statuses", () => {
    const draftBadge = getStatusBadgeConfig("DRAFT");
    expect(draftBadge.label).toBe("Bản nháp");
    expect(draftBadge.color).toBe("#FACC15");

    const approvedBadge = getStatusBadgeConfig("APPROVED");
    expect(approvedBadge.label).toBe("Đã phê duyệt");
    expect(approvedBadge.color).toBe("var(--system-cyan)");

    const runningBadge = getStatusBadgeConfig("RUNNING");
    expect(runningBadge.label).toBe("Đang diễn ra");

    const rejectedBadge = getStatusBadgeConfig("REJECTED");
    expect(rejectedBadge.label).toBe("Bị từ chối");
  });

  it("AC-06: Components enforce Robot Lab tokens, text-lean policy and accessibility", () => {
    const cardContent = read("apps/web/src/features/admin/tournaments/TournamentCard.tsx");
    expect(cardContent).toContain("var(--lab-panel)");
    expect(cardContent).toContain("var(--lab-bevel)");
    expect(cardContent).toContain("tournament-status-badge");
    expect(cardContent).toContain("tournamentId");

    const pageContent = read("apps/web/src/features/admin/tournaments/TournamentListPage.tsx");
    expect(pageContent).toContain("data-testid=\"tournament-list-page\"");
    expect(pageContent).toContain("data-testid=\"header-create-tournament-btn\"");
    expect(pageContent).toContain("TournamentFilterToolbar");
    expect(pageContent).toContain("TournamentPagination");
    expect(pageContent).toContain("TournamentEmptyState");

    const emptyContent = read("apps/web/src/features/admin/tournaments/TournamentEmptyState.tsx");
    expect(emptyContent).toContain("data-testid=\"tournament-empty-state\"");
    expect(emptyContent).toContain("data-testid=\"tournament-no-results\"");
    expect(emptyContent).toContain("data-testid=\"reset-filter-button\"");
  });
});
