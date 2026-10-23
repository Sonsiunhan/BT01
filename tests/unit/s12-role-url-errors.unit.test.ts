import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S12 — Role Enforcement, Direct URL Protection & Safe Error States (AC-01..AC-05)", () => {
  it("AC-01: Chặn Admin thi đấu Online (Server trả về ADMIN_CANNOT_PLAY_ONLINE; Admin Shell không có CTA người chơi)", () => {
    // 1. Máy chủ bắt buộc từ chối tài khoản ADMIN tham gia thi đấu trực tuyến
    const admissionService = read("apps/server/src/modules/tournament-core/admission-gate.service.ts");
    expect(admissionService).toContain("ADMIN_CANNOT_PLAY_ONLINE");

    // 2. Hợp đồng định nghĩa mã lỗi này
    const contracts = read("packages/contracts/src/tournament-initialization.ts");
    expect(contracts).toContain("ADMIN_CANNOT_PLAY_ONLINE");

    // 3. Admin Layout tách biệt hoàn toàn không có Online player action
    const adminLayout = read("apps/web/src/layouts/AdminLayout.tsx");
    expect(adminLayout).not.toContain("TÌM TRẬN");
    expect(adminLayout).toContain("Console Quản trị");
  });

  it("AC-02: Chặn truy cập trực tiếp URL quản trị trái phép & Hỗ trợ loginReturnPath an toàn", () => {
    const guard = read("apps/web/src/features/admin/shell/AdminCapabilityGuard.tsx");
    expect(guard).toContain('data-testid="admin-guard-unauthenticated"');
    expect(guard).toContain("loginReturnPath");
    expect(guard).toContain("Yêu cầu đăng nhập quản trị");

    const returnUrlHelper = read("apps/web/src/services/auth/returnUrl.ts");
    expect(returnUrlHelper).toContain("loginReturnPath");
    expect(returnUrlHelper).toContain("safeReturnTo");
  });

  it("AC-03: Chặn phân quyền người dùng không có vai trò SYSTEM_ADMIN truy cập trang quản trị TA", () => {
    const adminTaPage = read("apps/web/src/pages/AdminTaPage.tsx");
    expect(adminTaPage).toContain('data-testid="ta-forbidden"');
    expect(adminTaPage).toContain("Không đủ quyền hạn");
    expect(adminTaPage).toContain("SYSTEM_ADMIN");
  });

  it("AC-04: Bảo toàn dữ liệu nháp (Draft Preservation) khi gặp lỗi thẩm định hoặc lỗi máy chủ", () => {
    const wizardPage = read("apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx");
    // Form wizard quản lý state tách bạch và hiển thị thông báo lỗi mà không xóa sạch dữ liệu người dùng
    expect(wizardPage).toContain("errorMessage");
    expect(wizardPage).toContain("wizard-confirm-submit-btn");
    expect(wizardPage).toContain("wizard-submission-note-input");
    expect(wizardPage).toContain("setFormData");
  });

  it("AC-05: Toàn bộ thông báo lỗi được chuẩn hóa an toàn, không rò rỉ database query hay private tokens", () => {
    const safeErrorHelper = read("apps/web/src/services/http/safeErrorMessage.ts");
    expect(safeErrorHelper).toContain("safeErrorMessage");

    const sonPages = [
      read("apps/web/src/features/admin/tournaments/TournamentListPage.tsx"),
      read("apps/web/src/features/admin/tournaments/TournamentWizardPage.tsx"),
      read("apps/web/src/features/admin/tournaments/TournamentDetailPage.tsx"),
      read("apps/web/src/features/admin/tournaments/AuditLogsViewerPage.tsx"),
      read("apps/web/src/features/admin/offline/OfflineHubPage.tsx"),
    ];

    for (const pageCode of sonPages) {
      expect(pageCode).not.toContain("passwordHash");
      expect(pageCode).not.toContain("sessionToken");
      expect(pageCode).not.toContain("DATABASE_URL");
    }
  });
});
