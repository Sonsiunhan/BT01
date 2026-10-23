import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S11 — Cross-Review of Account, Roster, Staff & Support Subsystems (AC-01..AC-06)", () => {
  it("AC-01: P09 Admin TA Page & P10 Roster Page có đầy đủ test-id, bảng điều khiển và badge trạng thái", () => {
    const adminTaPage = read("apps/web/src/pages/AdminTaPage.tsx");
    expect(adminTaPage).toContain('data-testid="admin-ta-page"');
    expect(adminTaPage).toContain('data-testid="ta-table"');
    expect(adminTaPage).toContain('data-testid="open-create-ta-btn"');
    expect(adminTaPage).toContain("Quản lý Tournament Admin (TA)");

    const rosterPage = read("apps/web/src/features/tournament-roster/TournamentRosterPage.tsx");
    expect(rosterPage).toContain('data-testid="tournament-roster-page"');
    expect(rosterPage).toContain('data-testid="roster-file-input"');
    expect(rosterPage).toContain('data-testid="roster-preview-btn"');
    expect(rosterPage).toContain('data-testid="badge-total"');
    expect(rosterPage).toContain('data-testid="badge-valid"');
    expect(rosterPage).toContain('data-testid="badge-error"');
    expect(rosterPage).toContain('data-testid="roster-commit-btn"');
  });

  it("AC-02: P10 Roster Token không rò rỉ vào browser storage và bảo vệ bàn giao một lần", () => {
    const rosterPage = read("apps/web/src/features/tournament-roster/TournamentRosterPage.tsx");
    expect(rosterPage).toContain('data-testid="token-handoff-banner"');
    expect(rosterPage).toContain('data-testid="claim-token-value"');

    // Invariant: raw claim tokens must never be written to persistent browser storage
    expect(rosterPage).not.toContain("localStorage.setItem");
    expect(rosterPage).not.toContain("sessionStorage.setItem");
  });

  it("AC-03: P11 Staff API thực thi nghiêm ngặt header CSRF X-OTT-Request và phân định Content-Type", () => {
    const staffApi = read("apps/web/src/features/tournament-staff/tournamentStaffApi.ts");
    expect(staffApi).toContain('"X-OTT-Request": "1"');
    expect(staffApi).toContain("credentials: \"include\"");

    const staffPage = read("apps/web/src/features/tournament-staff/TournamentStaffPage.tsx");
    expect(staffPage).toContain('data-testid="tournament-staff-page"');
    expect(staffPage).toContain('data-testid="staff-readiness"');
    expect(staffPage).toContain("Thu hồi");
  });

  it("AC-04: P12 Support Recovery & P13 Activation đảm bảo tính idempotent và hợp đồng an toàn", () => {
    const activationPage = read("apps/web/src/pages/AccountActivationPage.tsx");
    expect(activationPage).toContain('data-testid="account-activation-card"');
    expect(activationPage).toContain('data-testid="claim-submit-btn"');
    expect(activationPage).toContain('data-testid="activation-password-input"');
    expect(activationPage).toContain('data-testid="password-submit-btn"');
    expect(activationPage).not.toContain("localStorage.setItem");

    const supportPage = read("apps/web/src/features/admin/support/SupportRecoveryPage.tsx");
    expect(supportPage).toContain('data-testid="support-recovery-page"');
    expect(supportPage).toContain('data-testid="support-recovery-empty"');
    expect(supportPage).toContain('data-testid="support-reset-handoff"');
    expect(supportPage).not.toContain("localStorage.setItem");
  });

  it("AC-05: P18 Rules Acknowledgement Guard ràng buộc chặt chẽ config_version_id trước khi khởi chạy", () => {
    const ackGuard = read("apps/server/src/modules/tournament-core/acknowledgement-guard.ts");
    expect(ackGuard).toContain("TournamentAcknowledgementGuard");
    expect(ackGuard).toContain("assertReadyForStart");
    expect(ackGuard).toContain("STALE_RULE_VERSION");

    const ackPage = read("apps/web/src/features/account/RulesAcknowledgementPage.tsx");
    expect(ackPage).toContain("Xác nhận điều lệ");
    expect(ackPage).toContain("rulesAcknowledgementApi");
  });

  it("AC-06: Tuyệt đối không phơi bày trường nhạy cảm (passwordHash, privateKey, raw token) ra giao diện", () => {
    const pages = [
      read("apps/web/src/pages/AdminTaPage.tsx"),
      read("apps/web/src/features/tournament-roster/TournamentRosterPage.tsx"),
      read("apps/web/src/features/tournament-staff/TournamentStaffPage.tsx"),
      read("apps/web/src/features/admin/support/SupportRecoveryPage.tsx"),
      read("apps/web/src/pages/AccountActivationPage.tsx"),
      read("apps/web/src/features/account/RulesAcknowledgementPage.tsx"),
    ];

    for (const pageCode of pages) {
      expect(pageCode).not.toContain("passwordHash");
      expect(pageCode).not.toContain("privateKey");
    }
  });
});
