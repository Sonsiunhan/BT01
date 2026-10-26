import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TournamentApiClient,
  applyListQuery,
  mapServerTournamentListItem,
  matchesStatusGroup,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";
import { getStatusBadgeConfig } from "../../apps/web/src/features/admin/tournaments/TournamentCard";
import type { TournamentCapabilities } from "../../apps/web/src/features/admin/tournaments/tournamentTypes";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Payload đúng shape của GET /api/tournaments (apps/server/src/modules/tournament-core/tournament-core.route.ts)
const SERVER_TOURNAMENTS = [
  {
    id: "tour-001",
    status: "DRAFT",
    revision: 8,
    unitId: "unit-dhqg",
    coreConfig: {
      tournamentName: "Giải Vô địch Quốc gia Robot Lab 2026",
      tournamentCode: "vld-robot-lab-2026",
      audienceScope: "PUBLIC_REGISTERED",
      scheduledStartAt: "2026-10-21T08:00:00.000Z",
      scheduledEndAt: "2026-10-24T18:00:00.000Z",
      timezone: "Asia/Ho_Chi_Minh",
      organizersText: "Khoa CNTT - ĐHQG",
      maxParticipants: 32,
    },
  },
  {
    id: "tour-002",
    status: "RUNNING",
    revision: 12,
    unitId: "unit-clb-ai",
    coreConfig: {
      tournamentName: "Giải Giao hữu Tân sinh viên K22",
      tournamentCode: "giao-huu-k22",
      audienceScope: "INTERNAL_UNIT",
      scheduledStartAt: null,
      scheduledEndAt: null,
      timezone: "Asia/Ho_Chi_Minh",
      organizersText: "CLB Trí tuệ Nhân tạo",
      maxParticipants: 16,
    },
  },
];

const UNKNOWN_CAPABILITIES: TournamentCapabilities = {
  canCreate: null,
  canViewAudit: null,
  canManageContracts: null,
};

describe("S02 — Tournament List Page (P01) Contract & Behavioral Tests", () => {
  it("AC-01: Router correctly mounts TournamentListPage on canonical /admin/tournaments route", () => {
    const routerContent = read("apps/web/src/app/router.tsx");

    expect(routerContent).toContain("TournamentListPage");
    expect(routerContent).toContain(
      '<Route path={routes.adminTournaments} element={<TournamentListPage />} />'
    );
  });

  it("AC-02: server DTO mapping is honest — unknown fields stay unknown, nothing is fabricated", () => {
    const item = mapServerTournamentListItem(SERVER_TOURNAMENTS[0]);

    expect(item.tournamentId).toBe("tour-001");
    expect(item.name).toBe("Giải Vô địch Quốc gia Robot Lab 2026");
    expect(item.slug).toBe("vld-robot-lab-2026");
    expect(item.status).toBe("DRAFT");
    expect(item.visibility).toBe("PUBLIC");
    expect(item.ownerDisplay).toBe("Khoa CNTT - ĐHQG");
    expect(item.maxParticipants).toBe(32);
    expect(item.revision).toBe("rev-8");

    // Server list response does NOT provide participant counts, readiness or
    // privileged actions — the client must report these as unknown / minimal.
    expect(item.participantCount).toBeNull();
    expect(item.readiness).toEqual({ state: "UNKNOWN", blockerCount: null });
    expect(item.permittedActions).toEqual(["view"]);

    // Internal-unit audience must not be reported as PUBLIC.
    const internal = mapServerTournamentListItem(SERVER_TOURNAMENTS[1]);
    expect(internal.visibility).toBe("PRIVATE");
    expect(internal.startAt).toBeNull();
  });

  it("AC-03: applyListQuery filters REAL server results by text search (name and slug)", () => {
    const items = SERVER_TOURNAMENTS.map(mapServerTournamentListItem);

    const nameSearch = applyListQuery({ q: "Quốc gia" }, items, UNKNOWN_CAPABILITIES);
    expect(nameSearch.items.length).toBeGreaterThan(0);
    expect(nameSearch.items.every((t) => t.name.includes("Quốc gia"))).toBe(true);

    const slugSearch = applyListQuery({ q: "giao-huu" }, items, UNKNOWN_CAPABILITIES);
    expect(slugSearch.items).toHaveLength(1);
    expect(slugSearch.items[0].slug).toBe("giao-huu-k22");

    const emptySearch = applyListQuery({ q: "non-existent-search-key-12345" }, items, UNKNOWN_CAPABILITIES);
    expect(emptySearch.items).toHaveLength(0);
    expect(emptySearch.page.totalItems).toBe(0);
  });

  it("AC-04: applyListQuery handles status groups, unit filter and pagination bounds", () => {
    const items = SERVER_TOURNAMENTS.map(mapServerTournamentListItem);

    const drafts = applyListQuery({ statusGroup: "DRAFT" }, items, UNKNOWN_CAPABILITIES);
    expect(drafts.items.every((t) => t.status === "DRAFT" || t.status === "CHANGES_REQUESTED")).toBe(true);

    const running = applyListQuery({ statusGroup: "RUNNING" }, items, UNKNOWN_CAPABILITIES);
    expect(running.items.every((t) => t.status === "RUNNING" || t.status === "PAUSED")).toBe(true);

    const unitFiltered = applyListQuery({ unitId: "unit-clb-ai" }, items, UNKNOWN_CAPABILITIES);
    expect(unitFiltered.items).toHaveLength(1);
    expect(unitFiltered.items[0].unitId).toBe("unit-clb-ai");

    // Single item paginated with pageSize=2 stays on one page without phantom pages.
    const page1 = applyListQuery({ page: 1, pageSize: 1 }, items, UNKNOWN_CAPABILITIES);
    expect(page1.items).toHaveLength(1);
    expect(page1.page.totalItems).toBe(2);
    expect(page1.page.totalPages).toBe(2);
    expect(page1.page.hasNext).toBe(true);
    expect(page1.page.hasPrev).toBe(false);

    const page2 = applyListQuery({ page: 2, pageSize: 1 }, items, UNKNOWN_CAPABILITIES);
    expect(page2.items).toHaveLength(1);
    expect(page2.page.currentPage).toBe(2);
    expect(page2.page.hasPrev).toBe(true);
    expect(page2.page.hasNext).toBe(false);
  });

  it("AC-05: listTournaments maps the real server payload and reports unknown capabilities when the session is unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/me")) {
          throw new TypeError("fetch failed");
        }
        if (url.includes("/api/tournaments")) {
          return jsonResponse({ tournaments: SERVER_TOURNAMENTS });
        }
        throw new TypeError(`unexpected fetch url: ${url}`);
      })
    );

    const client = new TournamentApiClient();
    const res = await client.listTournaments({ q: "Quốc gia" });

    expect(res.items).toHaveLength(1);
    expect(res.items[0].participantCount).toBeNull();
    expect(res.items[0].readiness.state).toBe("UNKNOWN");
    expect(res.page.totalItems).toBe(1);
    expect(res.capabilities.canCreate).toBeNull();
  });

  it("AC-06: listTournaments derives canCreate from the real session role when /auth/me answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/me")) {
          return jsonResponse({ user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } });
        }
        if (url.includes("/api/tournaments")) {
          return jsonResponse({ tournaments: SERVER_TOURNAMENTS });
        }
        throw new TypeError(`unexpected fetch url: ${url}`);
      })
    );

    const client = new TournamentApiClient();
    const res = await client.listTournaments();
    expect(res.capabilities.canCreate).toBe(true);
  });

  it("AC-07: listTournaments propagates network / server errors instead of returning fabricated data", async () => {
    const client = new TournamentApiClient();

    // Network failure
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(client.listTournaments()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      statusCode: 0,
    });

    // Server 500
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Lỗi máy chủ" }, 500)));
    await expect(client.listTournaments()).rejects.toMatchObject({
      statusCode: 500,
      message: "Lỗi máy chủ",
    });

    // Unexpected response shape
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/auth/me")) throw new TypeError("fetch failed");
      return jsonResponse({});
    }));
    await expect(client.listTournaments()).rejects.toMatchObject({
      code: "LIST_TOURNAMENTS_INVALID_RESPONSE",
    });
  });

  it("AC-08: Status badge config returns accessible text and token-based colors for all key statuses", () => {
    const draftBadge = getStatusBadgeConfig("DRAFT");
    expect(draftBadge.label).toBe("Bản nháp");
    expect(draftBadge.color).toBe("var(--warning, #FACC15)");

    const approvedBadge = getStatusBadgeConfig("APPROVED");
    expect(approvedBadge.label).toBe("Đã phê duyệt");
    expect(approvedBadge.color).toBe("var(--system-cyan)");

    const runningBadge = getStatusBadgeConfig("RUNNING");
    expect(runningBadge.label).toBe("Đang diễn ra");

    const rejectedBadge = getStatusBadgeConfig("REJECTED");
    expect(rejectedBadge.label).toBe("Bị từ chối");

    // Documented exception: no orange token exists in the design system yet,
    // so CHANGES_REQUESTED keeps its original hex.
    expect(getStatusBadgeConfig("CHANGES_REQUESTED").color).toBe("#FB923C");
  });

  it("AC-09: matchesStatusGroup helper keeps canonical lifecycle groupings", () => {
    expect(matchesStatusGroup("DRAFT", "DRAFT")).toBe(true);
    expect(matchesStatusGroup("APPROVED", "APPROVED")).toBe(true);
    expect(matchesStatusGroup("RUNNING", "RUNNING")).toBe(true);
    expect(matchesStatusGroup("ENDED", "FINISHED")).toBe(true);
    expect(matchesStatusGroup("RUNNING", "DRAFT")).toBe(false);
  });

  it("AC-10: Components enforce Robot Lab tokens, text-lean policy and accessibility", () => {
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
