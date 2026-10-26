import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S09 — Hoàn thiện UI và Tích hợp Rule Widget Bản Cuối (AC-01..AC-05)", () => {
  it("AC-01: Rule Widget bản cuối tích hợp hoàn chỉnh trong Wizard Step 4 và P04", () => {
    // 1. P04 TournamentRulesPage là trang chuyên biệt read-first — KHÔNG tái sử dụng
    //    wizard tạo giải (chuẩn hóa UX 2026-10-27): không bước 1/2/3, không nút
    //    lưu/nộp nháp, hiển thị luật hiện hành + lịch sử phiên bản bất biến.
    const rulesPageContent = read("apps/web/src/features/admin/tournaments/TournamentRulesPage.tsx");
    expect(rulesPageContent).toContain("TournamentRuleManagementPanel");
    expect(rulesPageContent).not.toContain("<TournamentWizardPage");
    expect(rulesPageContent).toContain("tournamentStatusLabels");
    expect(rulesPageContent).toContain("Lịch sử phiên bản luật");

    // 2. Wizard step 4 mount TournamentRuleManagementPanel
    const wizardContent = read("apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx");
    expect(wizardContent).toContain("TournamentRuleManagementPanel");
    expect(wizardContent).toContain("wizard-rule");

    // 3. Panel quản lý luật có các gate preview và lý do điều chỉnh
    const panelContent = read("apps/web/src/features/admin/tournaments/rules/TournamentRuleManagementPanel.tsx");
    expect(panelContent).toContain("RuleEditor");
    expect(panelContent).toContain("previewApi");
    expect(panelContent).toContain("versionApi");
    expect(panelContent).toContain("aria-live");
  });

  it("AC-02: Đăng ký đầy đủ các route ACK điều lệ và Trạng thái Bot", () => {
    const routesContent = read("apps/web/src/app/routes.ts");
    expect(routesContent).toContain("tournamentRulesAcknowledgement");
    expect(routesContent).toContain("adminTournamentBotReadiness");
    expect(routesContent).toContain("accountActivation");
    expect(routesContent).toContain("accountAccess");
    expect(routesContent).toContain("adminSupport");

    const routerContent = read("apps/web/src/app/router.tsx");
    expect(routerContent).toContain("routes.tournamentRulesAcknowledgement");
    expect(routerContent).toContain("RulesAcknowledgementPage");
    expect(routerContent).toContain("routes.adminTournamentBotReadiness");
    expect(routerContent).toContain("BotReadinessPage");
    expect(routerContent).toContain("SupportRecoveryPage");
  });

  it("AC-03: Chi tiết giải đấu (P03) liên kết đầy đủ 5 phân hệ vận hành và bảo vệ quyền", () => {
    const detailContent = read("apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx");

    // Đầy đủ 5 nút liên kết phân hệ
    expect(detailContent).toContain("action-rules-btn");
    expect(detailContent).toContain("action-roster-btn");
    expect(detailContent).toContain("action-staff-btn");
    expect(detailContent).toContain("action-bot-readiness-btn");
    expect(detailContent).toContain("action-audit-btn");

    // 3 tabs cốt lõi
    expect(detailContent).toContain('activeTab === "overview"');
    expect(detailContent).toContain('activeTab === "config"');
    expect(detailContent).toContain('activeTab === "readiness"');

    // Không hiển thị ready giả khi có blockers
    expect(detailContent).toContain("CHƯA ĐỦ ĐIỀU KIỆN KHỞI CHẠY (BLOCKED)");
    expect(detailContent).toContain("readiness-blockers-list");
  });

  it("AC-04: Hub Offline (P15) bảo đảm 4 lối vào, fail-closed sandbox và bảo mật bot", () => {
    const hubContent = read("apps/web/src/features/admin/offline/OfflineHubPage.tsx");
    expect(hubContent).toContain("BOT_LIBRARY");
    expect(hubContent).toContain("BOT_VS_BOT");
    expect(hubContent).toContain("PRACTICE_HUMAN_BOT");
    expect(hubContent).toContain("PRACTICE_HUMAN_HUMAN");
    expect(hubContent).toContain("BROWSER_WORKER_CPYTHON");
    expect(hubContent).toContain("Không chạy mã trên máy chủ");

    const botsContent = read("apps/web/src/features/admin/offline/OfflineBotsPage.tsx");
    // Tuyệt đối không để lộ mã nguồn gốc hay memory trong danh sách bot
    expect(botsContent).toContain("sourceDigest");
    expect(botsContent).toContain("getBotLibrary");
  });

  it("AC-05: Hệ thống giao diện tuân thủ tokens Robot Lab và cấm Player Online CTAs trong Admin shell", () => {
    const layoutContent = read("apps/web/src/layouts/AdminLayout.tsx");
    expect(layoutContent).toContain("Console Quản trị");
    expect(layoutContent).toContain("RobotLabWordmark");

    // Tuyệt đối không chứa nút vào hàng đợi online người chơi
    expect(layoutContent).not.toContain("routes.queue");
    expect(layoutContent).not.toContain("Vào hàng đợi");
    expect(layoutContent).not.toContain("Chơi online");

    // CSS variables chuẩn
    const listContent = read("apps/web/src/features/admin/tournaments/TournamentListPage.tsx");
    expect(listContent).toContain("var(--surface)");
    expect(listContent).toContain("var(--border)");
    expect(listContent).toContain("var(--text)");
  });
});
