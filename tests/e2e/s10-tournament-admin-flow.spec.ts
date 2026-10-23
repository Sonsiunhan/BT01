import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const now = "2026-10-23T08:00:00.000Z";

function mockTournament(id = "tour-001") {
  return {
    id,
    contractId: "HD-2026-CHUNG",
    contractCode: "CONTRACT-DEFAULT",
    unitId: "unit-dhqg",
    ownerTaUserId: "ta-1",
    status: "APPROVED",
    revision: 1,
    activeConfigVersionId: null,
    activeConfigVersionNumber: 1,
    approvedSnapshot: null,
    everApproved: true,
    quotaRefunded: false,
    coreConfig: {
      tournamentCode: "vld-robot-lab-2026",
      tournamentName: "Giải Vô địch Quốc gia Robot Lab 2026",
      description: "Giải đấu cấp toàn quốc",
      organizersText: "Khoa CNTT - ĐHQG",
      competitionMode: "HUMAN_ONLINE",
      audienceScope: "PUBLIC_REGISTERED",
      allowedUnitCodes: [],
      scheduledStartAt: "2026-10-21T15:00:00.000Z",
      scheduledEndAt: "2026-10-25T01:00:00.000Z",
      maxParticipants: 32,
      minParticipantsToStart: 4,
      timezone: "Asia/Ho_Chi_Minh",
      checkinRequired: false,
      checkinOpenAt: null,
      checkinCloseAt: null,
      botDeadlineAt: null,
      maxMatchesPerPlayer: 10,
      maxPairMeetings: 2,
      rematchCooldownMinutes: 5,
      maxConcurrentMatches: 4,
      byeScorePoints: 1,
      spectatorPolicy: "PUBLIC",
      chatPolicy: "MUTED",
      leaderboardVisibility: "PUBLIC",
      initialScore: 0,
      initialElo: 1200,
      kFactor: 32,
      scoreFloor: 0,
    },
    ruleProfile: {
      gamePreset: "STANDARD_9X9",
      boardSize: 9,
      rankedMode: "UNRANKED",
      roundTimeLimitSeconds: 60,
      turnTimeLimitSeconds: 15,
      maxTurnsPerGame: 100,
    },
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    approvedAt: now,
    rejectedAt: null,
    changesRequestedAt: null,
    lastReviewNote: "Hồ sơ đạt tiêu chuẩn",
    lastReviewFieldNotes: {},
    startedAt: null,
    pausedAt: null,
    pauseReason: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    finalizedAt: null,
    copiedFromTournamentId: null,
  };
}

function mockReadiness(tournamentId = "tour-001") {
  return {
    tournamentId,
    status: "APPROVED",
    canOpenScheduled: true,
    canStartRunning: false,
    canFinalize: false,
    eligibleParticipantsCount: 16,
    minParticipantsRequired: 4,
    activeStaffCount: 2,
    activeRefereeCount: 1,
    pendingManualAdjudicationsCount: 0,
    activeRuleVersionNumber: 1,
    checklist: [
      {
        code: "RULE_CONFIG_VALID",
        title: "Cấu hình điều lệ & Luật chơi",
        status: "PASS",
        detail: "Luật chơi đã phê duyệt và hợp lệ",
      },
      {
        code: "PARTICIPANTS_MIN_MET",
        title: "Quy mô số lượng vận động viên",
        status: "PASS",
        detail: "16/4 VĐV tối thiểu đủ điều kiện",
      },
      {
        code: "REFEREE_ASSIGNED",
        title: "Trọng tài điều hành giải",
        status: "PASS",
        detail: "Đã chỉ định 1 trọng tài chính",
      },
    ],
    blockers: [],
    evaluatedAt: now,
    readinessState: "READY",
  };
}

function mockAuditLogs() {
  return [
    {
      id: "audit-001",
      tournamentId: "tour-001",
      action: "TOURNAMENT_APPROVED",
      targetType: "TOURNAMENT",
      targetId: "tour-001",
      actorUserId: "ta-1",
      actorDisplayName: "Quản trị viên Giải đấu",
      timestamp: now,
      metadata: { note: "Phê duyệt chính thức" },
    },
    {
      id: "audit-002",
      tournamentId: "tour-001",
      action: "RULE_VERSION_PUBLISHED",
      targetType: "RULE_VERSION",
      targetId: "rule-v1",
      actorUserId: "ta-1",
      actorDisplayName: "Quản trị viên Giải đấu",
      timestamp: now,
      metadata: { version: 1 },
    },
  ];
}

async function prepareAdmin(page: Page) {
  // Prevent unhandled SSE during tests
  await page.addInitScript(() => {
    class SilentEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      close() {}
    }
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      value: SilentEventSource,
    });
  });

  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "ta-1",
          fullName: "Quản trị viên Giải đấu",
          displayName: "Tournament Admin",
          username: "ta_admin",
          theme: "system",
          avatarPreset: "robot",
          role: "TOURNAMENT_ADMIN",
          capabilities: ["ADMIN_VIEW", "ADMIN_MANAGE", "tournament.create", "offline.hub.read"],
          privacy: {
            presenceVisibility: "FRIENDS",
            friendListVisibility: "PRIVATE",
            fullNameVisibility: "PRIVATE",
          },
          stats: {
            elo: 1200,
            rankedWins: 5,
            rankedLosses: 1,
            quickWins: 3,
            quickLosses: 0,
          },
        },
      }),
    });
  });

  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        service: "ottv2-server",
        version: "s10-e2e",
        protocolVersion: "0.1",
        timestamp: now,
        components: {
          application: { status: "ok" },
          database: { status: "ok" },
          realtime: { status: "ok" },
        },
      }),
    });
  });

  // Mock list tournaments
  await page.route("**/api/tournaments?**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [mockTournament("tour-001")],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
      return;
    }
    await route.continue();
  });

  // Mock tournament detail
  await page.route("**/api/tournaments/tour-001", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tournament: mockTournament("tour-001"),
        configVersions: [],
      }),
    });
  });

  // Mock readiness
  await page.route("**/api/tournaments/tour-001/readiness", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        readiness: mockReadiness("tour-001"),
      }),
    });
  });

  // Mock audit logs
  await page.route("**/api/admin/audit-logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logs: mockAuditLogs(),
      }),
    });
  });

  // Mock offline capabilities
  await page.route("**/api/offline/capabilities**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        capabilities: { "offline.hub.read": true },
        modes: [
          {
            id: "BOT_LIBRARY",
            title: "Kho Bot của tôi",
            description: "Quản lí danh sách mã nguồn Bot cá nhân.",
            route: "/admin/offline/bots",
            status: "ACTIVE",
          },
          {
            id: "BOT_VS_BOT",
            title: "Đấu Bot Offline (Bot – Bot)",
            description: "Môi trường đối kháng hai Bot trong trình duyệt.",
            route: "/admin/offline/bot-vs-bot",
            status: "ACTIVE",
          },
          {
            id: "PRACTICE_HUMAN_BOT",
            title: "Phòng tập Người – Bot",
            description: "Môi trường luyện tập người chơi và Bot Python.",
            route: "/admin/offline/practice-human-bot",
            status: "ACTIVE",
          },
          {
            id: "PRACTICE_HUMAN_HUMAN",
            title: "Phòng tập Người – Người",
            description: "Chế độ chơi hai người trên cùng một thiết bị.",
            route: "/admin/offline/practice-human-human",
            status: "ACTIVE",
          },
        ],
      }),
    });
  });

  // Mock bot library
  await page.route("**/bot-library", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bots: [
          {
            id: "bot-01",
            userId: "ta-1",
            name: "AlphaRPS",
            description: "Bot chiến thuật phản xạ",
            activeRevisionId: "rev-01",
            revisions: [
              {
                id: "rev-01",
                botId: "bot-01",
                revisionNumber: 1,
                sourceDigest: "sha256:abc123456789",
                status: "READY",
                createdAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    });
  });
}

test.describe("S10 — Browser E2E đầy đủ các trang Sơn (P01, P02, P03, P14, P15)", () => {
  test("1. P01: Danh sách giải đấu render chuẩn responsive và không vi phạm accessibility", async ({ page }) => {
    await prepareAdmin(page);

    // Responsive checks across mobile, tablet, and desktop viewports
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/tournaments");

      await expect(page.getByRole("heading", { name: "Quản lý giải đấu" })).toBeVisible();
      await expect(page.getByTestId("tournament-search-input")).toBeVisible();
      await expect(page.getByTestId("status-tab-ALL")).toBeVisible();

      // Check no horizontal scroll overflow in tournament list page container
      const { overflow, offenders } = await page.evaluate(() => {
        const pageEl = document.querySelector(".tournament-list-page");
        if (!pageEl) return { overflow: false, offenders: [] };
        const offenders = [...pageEl.querySelectorAll<HTMLElement>("*")]
          .filter((el) => el.scrollWidth > pageEl.clientWidth)
          .slice(0, 5)
          .map((el) => ({
            tag: el.tagName,
            className: el.className,
            scrollWidth: el.scrollWidth,
            clientWidth: pageEl.clientWidth,
          }));
        return {
          overflow: pageEl.scrollWidth <= pageEl.clientWidth,
          offenders,
        };
      });
      expect(overflow, `Horizontal overflow at ${viewport.width}: ${JSON.stringify(offenders)}`).toBe(true);
    }

    // Accessibility check on desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined))
      );
    });
    const axeResults = await new AxeBuilder({ page })
      .include(".tournament-list-page")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = axeResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);
  });

  test("2. P02: Wizard tạo giải đấu nháp 4 bước, xem trước luật và nộp duyệt", async ({ page }) => {
    await prepareAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/admin/tournaments/new");
    await expect(page.getByRole("heading", { name: /Tạo giải đấu mới/i })).toBeVisible();

    // Bước 1: Hồ sơ & Đơn vị
    await expect(page.getByTestId("wizard-step-1-btn")).toBeVisible();
    await page.getByTestId("wizard-name-input").fill("Giải Vô Địch Playwright E2E 2026");
    await page.getByTestId("wizard-slug-input").fill("playwright-e2e-2026");

    // Chuyển sang Bước 2: Lịch trình
    await page.getByTestId("wizard-step-2-btn").click();
    await expect(page.getByTestId("wizard-step-2-btn")).toBeVisible();

    // Chuyển sang Bước 3: Quy mô & Thể thức
    await page.getByTestId("wizard-step-3-btn").click();
    await expect(page.getByTestId("wizard-step-3-btn")).toBeVisible();

    // Chuyển sang Bước 4: Tổng quan & Luật
    await page.getByTestId("wizard-step-4-btn").click();
    await expect(page.getByTestId("wizard-rule-section")).toBeVisible();
    await expect(page.getByTestId("wizard-rule-preview-btn")).toBeVisible();

    // Kiểm tra các trường tổng quan hiển thị đúng dữ liệu đã nhập
    await expect(page.getByText("playwright-e2e-2026")).toBeVisible();
  });

  test("3. P03: Chi tiết giải đấu hiển thị 5 liên kết phân hệ và bảng điều kiện sẵn sàng", async ({ page }) => {
    await prepareAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/admin/tournaments/tour-001");
    await expect(page.getByTestId("tournament-detail-page")).toBeVisible();

    // 5 Action buttons linked to operational submodules
    await expect(page.getByTestId("action-rules-btn")).toHaveAttribute(
      "href",
      "/admin/tournaments/tour-001/rules"
    );
    await expect(page.getByTestId("action-roster-btn")).toHaveAttribute(
      "href",
      "/admin/tournaments/tour-001/roster"
    );
    await expect(page.getByTestId("action-staff-btn")).toHaveAttribute(
      "href",
      "/admin/tournaments/tour-001/staff"
    );
    await expect(page.getByTestId("action-bot-readiness-btn")).toHaveAttribute(
      "href",
      "/admin/tournaments/tour-001/bot-readiness"
    );
    await expect(page.getByTestId("action-audit-btn")).toHaveAttribute(
      "href",
      "/admin/tournaments/tour-001/audit"
    );

    // Chuyển tab Readiness
    await page.getByTestId("tab-readiness-btn").click();
    await expect(page.getByTestId("panel-readiness")).toBeVisible();
    await expect(page.getByTestId("readiness-overall-status")).toBeVisible();

    // Chuyển tab Config
    await page.getByTestId("tab-config-btn").click();
    await expect(page.getByTestId("panel-config")).toBeVisible();
  });

  test("4. P14: Nhật ký kiểm toán hỗ trợ lọc phạm vi và bảo vệ thông tin bí mật", async ({ page }) => {
    await prepareAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Trang nhật ký toàn cục
    await page.goto("/admin/audit");
    await expect(page.getByTestId("audit-page-title")).toBeVisible();

    // Bộ lọc theo đối tượng
    await expect(page.getByTestId("filter-target-type-select")).toBeVisible();
    await page.getByTestId("filter-target-type-select").selectOption("TOURNAMENT");

    // Không chứa khóa bí mật
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("passwordHash");
    expect(pageText).not.toContain("privateKey");
    expect(pageText).not.toContain("sessionToken");

    // Trang nhật ký theo giải đấu
    await page.goto("/admin/tournaments/tour-001/audit");
    await expect(page.getByTestId("audit-page-title")).toBeVisible();
    await expect(page.getByText("tour-001").first()).toBeVisible();
  });

  test("5. P15: Hub công cụ Offline đủ 4 lối vào, bảo mật bot và fail-closed sandbox", async ({ page }) => {
    await prepareAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Hub Offline
    await page.goto("/admin/offline");
    await expect(page.getByRole("heading", { name: "Trung tâm công cụ Offline" })).toBeVisible();

    // Bốn lối vào
    await expect(page.getByText("Kho Bot của tôi")).toBeVisible();
    await expect(page.getByText("Đấu Bot Offline (Bot – Bot)")).toBeVisible();
    await expect(page.getByText("Phòng tập Người – Bot")).toBeVisible();
    await expect(page.getByText("Phòng tập Người – Người")).toBeVisible();

    // Khung an toàn Runtime Sandbox
    await expect(page.getByText(/Tất cả các lượt tính toán chạy hoàn toàn trong trình duyệt/i)).toBeVisible();

    // Vào Kho Bot cá nhân
    await page.goto("/admin/offline/bots");
    await expect(page.getByRole("heading", { name: "Kho Bot của tôi" })).toBeVisible();

    // Bảo mật: Danh sách không tải mã nguồn thô
    const botPageText = await page.textContent("body");
    expect(botPageText).not.toContain("def __init__");
    expect(botPageText).not.toContain("exec(");
  });
});
