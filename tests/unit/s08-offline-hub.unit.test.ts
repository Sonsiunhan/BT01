import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("S08 — Offline Tools Hub (P15) Unit & Contract Tests", () => {
  const routerPath = resolve(process.cwd(), "apps/web/src/app/router.tsx");
  const routerSource = readFileSync(routerPath, "utf-8");

  it("S08-01: Verifies four entry routes are declared in routes and wired in router", () => {
    expect(routerSource).toContain("routes.adminOffline");
    expect(routerSource).toContain("routes.adminOfflineBots");
    expect(routerSource).toContain("routes.adminOfflinePracticeHumanBot");
    expect(routerSource).toContain("routes.adminOfflinePracticeHumanHuman");
  });

  it("S08-02: Ensures admin layout contains offline tools navigation", () => {
    const layoutPath = resolve(process.cwd(), "apps/web/src/layouts/AdminLayout.tsx");
    const layoutSource = readFileSync(layoutPath, "utf-8");
    expect(layoutSource).toContain("routes.adminOffline");
    expect(layoutSource).toContain("routes.adminOfflineBots");
    expect(layoutSource).toContain("Công cụ Offline");
  });

  it("S08-03: Verifies server capabilities endpoint contract defines four capabilities and modes", async () => {
    const routePath = resolve(
      process.cwd(),
      "apps/server/src/modules/tournament-foundation/foundation.route.ts"
    );
    const routeSource = readFileSync(routePath, "utf-8");
    expect(routeSource).toContain("/api/admin/offline/capabilities");
    expect(routeSource).toContain('"offline.hub.read": true');
    expect(routeSource).toContain('"offline.bot.read": true');
    expect(routeSource).toContain('"offline.practice.humanBot": true');
    expect(routeSource).toContain('"offline.practice.humanHuman": true');
    expect(routeSource).toContain('"NO_SERVER_RUNNER"');
  });

  it("S08-04: Enforces security invariant — no server python runner created for offline play", () => {
    const routePath = resolve(
      process.cwd(),
      "apps/server/src/modules/tournament-foundation/foundation.route.ts"
    );
    const routeSource = readFileSync(routePath, "utf-8");
    expect(routeSource).not.toContain("child_process");
    expect(routeSource).not.toContain("exec(");
    expect(routeSource).not.toContain("spawn(");
  });
});
