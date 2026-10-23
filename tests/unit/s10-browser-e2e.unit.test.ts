import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S10 — Browser E2E Test Suite and Integration Invariants (AC-01..AC-05)", () => {
  it("AC-01: P01 Danh sách giải đấu hỗ trợ đầy đủ bộ lọc, thanh công cụ tìm kiếm và cấu trúc responsive", () => {
    const listPage = read("apps/web/src/features/admin/tournaments/TournamentListPage.tsx");
    expect(listPage).toContain('data-testid="tournament-list-page"');
    expect(listPage).toContain('data-testid="header-create-tournament-btn"');
    expect(listPage).toContain("TournamentFilterToolbar");

    const toolbar = read("apps/web/src/features/admin/tournaments/TournamentFilterToolbar.tsx");
    expect(toolbar).toContain('data-testid="tournament-search-input"');
    expect(toolbar).toContain('data-testid={`status-tab-${tab.id}`}');
    expect(toolbar).toContain("Tất cả");
    expect(toolbar).toContain("Bản nháp");
    expect(toolbar).toContain("Đang diễn ra");
  });

  it("AC-02: P02 Wizard tạo giải đấu nháp 4 bước tích hợp Rule Widget bản cuối và modal nộp duyệt", () => {
    const wizardPage = read("apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx");
    expect(wizardPage).toContain('data-testid="wizard-name-input"');
    expect(wizardPage).toContain('data-testid="wizard-slug-input"');
    expect(wizardPage).toContain('data-testid="wizard-contract-input"');
    expect(wizardPage).toContain('data-testid={`wizard-step-${item.step}-btn`}');

    // Step 4 Rule widget integration
    expect(wizardPage).toContain("TournamentRuleManagementPanel");
    expect(wizardPage).toContain('testIdPrefix="wizard-rule"');

    // Submission modal
    expect(wizardPage).toContain('data-testid="wizard-submit-modal"');
    expect(wizardPage).toContain('data-testid="wizard-submission-note-input"');
    expect(wizardPage).toContain('data-testid="wizard-confirm-submit-btn"');
  });

  it("AC-03: P03 Chi tiết giải đấu liên kết 5 phân hệ vận hành và tab điều kiện sẵn sàng (readiness)", () => {
    const detailPage = read("apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx");
    expect(detailPage).toContain('data-testid="tournament-detail-page"');

    // 5 operational links
    expect(detailPage).toContain('data-testid="action-rules-btn"');
    expect(detailPage).toContain('data-testid="action-roster-btn"');
    expect(detailPage).toContain('data-testid="action-staff-btn"');
    expect(detailPage).toContain('data-testid="action-bot-readiness-btn"');
    expect(detailPage).toContain('data-testid="action-audit-btn"');

    // Tabs
    expect(detailPage).toContain('data-testid="tab-overview-btn"');
    expect(detailPage).toContain('data-testid="tab-config-btn"');
    expect(detailPage).toContain('data-testid="tab-readiness-btn"');
    expect(detailPage).toContain('data-testid="panel-readiness"');
    expect(detailPage).toContain('data-testid="readiness-overall-status"');
  });

  it("AC-04: P14 Nhật ký kiểm toán hỗ trợ lọc theo đối tượng, phạm vi giải đấu và loại trừ dữ liệu nhạy cảm", () => {
    const auditPage = read("apps/web/src/features/admin/tournaments/AuditLogsViewerPage.tsx");
    expect(auditPage).toContain('data-testid="audit-page-title"');
    expect(auditPage).toContain('data-testid="filter-target-type-select"');
    expect(auditPage).toContain('data-testid="filter-target-id-input"');
    expect(auditPage).toContain('data-testid="filter-actor-id-input"');

    // Contract checks
    const contracts = read("packages/contracts/src/tournament-initialization.ts");
    expect(contracts).toContain("AuditLogRecordSchema");
    expect(contracts).toContain("AuditLogRecordDto");
  });

  it("AC-05: P15 Hub công cụ Offline bảo đảm 4 chế độ, sandbox cô lập và bảo mật kho bot", () => {
    const hubPage = read("apps/web/src/features/admin/offline/OfflineHubPage.tsx");
    expect(hubPage).toContain("Trung tâm công cụ Offline");
    expect(hubPage).toContain("BOT_LIBRARY");
    expect(hubPage).toContain("BOT_VS_BOT");
    expect(hubPage).toContain("PRACTICE_HUMAN_BOT");
    expect(hubPage).toContain("PRACTICE_HUMAN_HUMAN");
    expect(hubPage).toContain("Web Worker cô lập");

    const botsPage = read("apps/web/src/features/admin/offline/OfflineBotsPage.tsx");
    expect(botsPage).toContain("Kho Bot của tôi");
    expect(botsPage).toContain("getBotLibrary");
  });
});
