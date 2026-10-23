import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S13 — Son Final Release & Handover Invariants (AC-01..AC-04)", () => {
  it("AC-01: Không có nút chết (No Dead Buttons) trên các trang quản trị của Sơn (P01, P02, P03, P14, P15)", () => {
    const listPage = read("apps/web/src/features/admin/tournaments/TournamentListPage.tsx");
    expect(listPage).toContain('data-testid="header-create-tournament-btn"');
    expect(listPage).not.toContain('onClick={() => {}}');

    const wizardPage = read("apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx");
    expect(wizardPage).toContain("handleSaveDraft");
    expect(wizardPage).toContain("handleSubmitDraft");
    expect(wizardPage).not.toContain('onClick={() => {}}');

    const detailPage = read("apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx");
    expect(detailPage).toContain("action-rules-btn");
    expect(detailPage).toContain("action-roster-btn");
    expect(detailPage).toContain("action-staff-btn");
    expect(detailPage).toContain("action-bot-readiness-btn");
    expect(detailPage).toContain("action-audit-btn");

    const auditPage = read("apps/web/src/features/admin/tournaments/AuditLogsViewerPage.tsx");
    expect(auditPage).toContain("audit-prev-page-btn");
    expect(auditPage).toContain("audit-next-page-btn");
    expect(auditPage).toContain("setSelectedRecord");

    const offlinePage = read("apps/web/src/features/admin/offline/OfflineHubPage.tsx");
    expect(offlinePage).toContain("route: routes.adminOfflineBots");
    expect(offlinePage).toContain("to={mode.route}");
  });

  it("AC-02: Toàn bộ 5 trang chính của Sơn được khai báo đầy đủ trong routes.ts và router.tsx", () => {
    const routesFile = read("apps/web/src/app/routes.ts");
    expect(routesFile).toContain("adminTournaments");
    expect(routesFile).toContain("adminTournamentNew");
    expect(routesFile).toContain("adminTournamentDetail");
    expect(routesFile).toContain("adminAudit");
    expect(routesFile).toContain("adminOffline");

    const routerFile = read("apps/web/src/app/router.tsx");
    expect(routerFile).toContain("TournamentListPage");
    expect(routerFile).toContain("TournamentWizardPage");
    expect(routerFile).toContain("TournamentDetailPage");
    expect(routerFile).toContain("AuditLogsViewerPage");
    expect(routerFile).toContain("OfflineHubPage");
  });

  it("AC-03: Toàn bộ 14 tasks (S00..S13) có đầy đủ hồ sơ nghiệm thu hợp lệ trên hệ thống tài liệu", () => {
    const tasks = [
      "s00", "s01", "s02", "s03", "s04", "s05",
      "s06", "s07", "s08", "s09", "s10", "s11",
      "s12", "s13",
    ];

    for (const task of tasks) {
      const readmePath = resolve(root, `docs/tournament-initialization/son/${task}/README.md`);
      const acceptancePath = resolve(root, `docs/tournament-initialization/son/${task}/S${task.slice(1).toUpperCase()}-ACCEPTANCE.md`);
      expect(existsSync(readmePath)).toBe(true);
      expect(existsSync(acceptancePath)).toBe(true);
    }
  });

  it("AC-04: Báo cáo tổng kết phát hành mảng Sơn S13 ghi nhận 14/14 tasks hoàn thành 100%", () => {
    const finalReport = read("docs/tournament-initialization/son/s13/S13-FINAL-RELEASE-REPORT.md");
    expect(finalReport).toContain("14/14 Tasks (`S00`..`S13`) 100% PASS");
    expect(finalReport).toContain("DONE");
    expect(finalReport).toContain("Playwright E2E Tests");
  });
});
