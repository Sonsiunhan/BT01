import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S01 — Admin shell, router and role-aware navigation contract", () => {
  it("AC-S01-01: registers all canonical admin console routes in routes.ts", () => {
    const routesContent = read("apps/web/src/app/routes.ts");

    const expectedAdminRoutes = [
      "/admin/tournaments",
      "/admin/tournaments/new",
      "/admin/tournaments/:tournamentId/edit",
      "/admin/tournaments/:tournamentId",
      "/admin/tournaments/:tournamentId/operations",
      "/admin/audit",
      "/admin/tournaments/:tournamentId/audit",
      "/admin/offline",
      "/admin/offline/bots",
      "/admin/offline/practice/human-bot",
      "/admin/offline/practice/human-human",
    ];

    for (const route of expectedAdminRoutes) {
      expect(routesContent).toContain(route);
    }
  });

  it("AC-S01-02: AppRouter integrates AdminLayout and lazy child routes", () => {
    const routerContent = read("apps/web/src/app/router.tsx");

    expect(routerContent).toContain("AdminLayout");
    expect(routerContent).toContain("AdminRoutePending");
    expect(routerContent).toContain("routes.adminTournaments");
    expect(routerContent).toContain("routes.adminOffline");
    expect(routerContent).toContain("routes.adminAudit");
  });

  it("AC-S01-03 & AC-S01-04: AdminLayout enforces Robot Lab design and strictly bans Online player CTAs", () => {
    const layoutContent = read("apps/web/src/layouts/AdminLayout.tsx");

    // Must have Robot Lab brand & Console label
    expect(layoutContent).toContain("RobotLabWordmark");
    expect(layoutContent).toContain("Console Quản trị");

    // Must have 2 navigation groups: Quản lí giải and Công cụ Offline
    expect(layoutContent).toContain("routes.adminTournaments");
    expect(layoutContent).toContain("routes.adminAudit");
    expect(layoutContent).toContain("routes.adminOffline");
    expect(layoutContent).toContain("routes.adminOfflineBots");

    // Strictly banned: No Online queue or player online matchmaking CTA
    expect(layoutContent).not.toContain("routes.queue");
    expect(layoutContent).not.toContain("routes.rooms");
    expect(layoutContent).not.toContain("Vào hàng đợi");
    expect(layoutContent).not.toContain("Chơi online");
  });

  it("AC-S01-05 & AC-S01-06: AdminCapabilityGuard and AdminRoutePending handle states gracefully", () => {
    const guardContent = read("apps/web/src/features/admin/shell/AdminCapabilityGuard.tsx");
    const pendingContent = read("apps/web/src/features/admin/shell/AdminRoutePending.tsx");

    // Guard handles auth verification and safe prompt
    expect(guardContent).toContain("getMe");
    expect(guardContent).toContain("ottv2:auth-change");
    expect(guardContent).toContain("Yêu cầu đăng nhập quản trị");

    // Pending route displays page info and safe return links
    expect(pendingContent).toContain("AdminRoutePendingProps");
    expect(pendingContent).toContain("routes.adminTournaments");
    expect(pendingContent).toContain("routes.adminOffline");
  });
});
