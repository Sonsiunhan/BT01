import { describe, expect, it } from "vitest";
import {
  TournamentStateStore,
  assertTaContractOrTournamentAccess,
  type TournamentActorContext,
} from "../../src/modules/tournament-foundation/tournament-store.js";
import { CoreDraftService } from "../../src/modules/tournament-core/core-draft.service.js";
import { TournamentLifecycleService } from "../../src/modules/tournament-core/lifecycle.service.js";
import { DEFAULT_TOURNAMENT_RULE_PROFILE } from "@ottv2/contracts";

describe("Admin Console Tournament Permissions & Performance Unit Tests", () => {
  it("TournamentStateStore.ensureDefaultSeed populates default unit and contract", () => {
    const store = new TournamentStateStore();
    expect(store.units.size).toBe(0);
    expect(store.contracts.size).toBe(0);

    store.ensureDefaultSeed();

    expect(store.units.has("unit-fit-vnu")).toBe(true);
    expect(store.contracts.has("HD-2026-CHUNG")).toBe(true);

    const contract = store.contracts.get("HD-2026-CHUNG")!;
    expect(contract.contractCode).toBe("HD-2026-CHUNG");
    expect(contract.status).toBe("ACTIVE");
    expect(contract.maxTournamentsTotal).toBe(100);
  });

  it("resolveAuthoritativeActor maps SYSTEM_ADMIN, ADMIN, and TOURNAMENT_ADMIN", () => {
    const store = new TournamentStateStore();

    const adminActor = store.resolveAuthoritativeActor({
      userId: "sa_local_1",
      roles: ["SYSTEM_ADMIN"],
    });
    expect(adminActor.roles).toContain("ADMIN");

    const taActor = store.resolveAuthoritativeActor({
      userId: "ta_user_1",
      roles: ["TOURNAMENT_ADMIN"],
    });
    expect(taActor.roles).toContain("TOURNAMENT_ADMIN");
  });

  it("assertTaContractOrTournamentAccess allows ADMIN to create draft on active contract without TA binding", () => {
    const store = new TournamentStateStore();
    store.ensureDefaultSeed();
    const contract = store.contracts.get("HD-2026-CHUNG")!;

    const adminActor: TournamentActorContext = {
      userId: "admin_user",
      roles: ["ADMIN", "PLAYER"],
    };

    // Should NOT throw for ADMIN
    expect(() => {
      assertTaContractOrTournamentAccess(adminActor, contract, {
        mode: "NEW_DRAFT",
        serverNowIso: "2026-06-01T00:00:00.000Z",
      });
    }).not.toThrow();

    // Regular player without binding MUST be forbidden (403)
    const playerActor: TournamentActorContext = {
      userId: "player_user",
      roles: ["PLAYER"],
    };
    expect(() => {
      assertTaContractOrTournamentAccess(playerActor, contract, {
        mode: "NEW_DRAFT",
        serverNowIso: "2026-06-01T00:00:00.000Z",
      });
    }).toThrowError(/Bạn không có quyền Quản trị giải \(TA\)/);
  });

  it("assertTaContractOrTournamentAccess allows ADMIN to operate existing tournament", () => {
    const store = new TournamentStateStore();
    store.ensureDefaultSeed();
    const contract = store.contracts.get("HD-2026-CHUNG")!;

    const mockTournament = {
      id: "tour-xyz",
      ownerTaUserId: "some_other_ta",
    } as any;

    const adminActor: TournamentActorContext = {
      userId: "admin_user",
      roles: ["ADMIN"],
    };

    expect(() => {
      assertTaContractOrTournamentAccess(adminActor, contract, {
        mode: "OPERATE_EXISTING",
        tournament: mockTournament,
        serverNowIso: "2026-06-01T00:00:00.000Z",
      });
    }).not.toThrow();

    const strangerActor: TournamentActorContext = {
      userId: "stranger_ta",
      roles: ["TOURNAMENT_ADMIN"],
    };
    expect(() => {
      assertTaContractOrTournamentAccess(strangerActor, contract, {
        mode: "OPERATE_EXISTING",
        tournament: mockTournament,
        serverNowIso: "2026-06-01T00:00:00.000Z",
      });
    }).toThrowError();
  });

  it("T059: assertTaContractOrTournamentAccess strictly prevents ADMIN from match adjudication", () => {
    const store = new TournamentStateStore();
    store.ensureDefaultSeed();
    const contract = store.contracts.get("HD-2026-CHUNG")!;

    const mockTournament = {
      id: "tour-xyz",
      ownerTaUserId: "owner_ta",
    } as any;

    const adminActor: TournamentActorContext = {
      userId: "admin_user",
      roles: ["ADMIN"],
    };

    expect(() => {
      assertTaContractOrTournamentAccess(adminActor, contract, {
        mode: "ADJUDICATE_MATCH",
        tournament: mockTournament,
        serverNowIso: "2026-06-01T00:00:00.000Z",
      });
    }).toThrowError(/Chỉ Quản trị giải \(TA\) sở hữu giải đấu mới được phép phán quyết/);
  });

  it("CoreDraftService enables ADMIN to create, patch, and delete drafts using default contract", async () => {
    const store = new TournamentStateStore({ clockFn: () => new Date("2026-06-01T10:00:00.000Z") });
    store.ensureDefaultSeed();
    const service = new CoreDraftService(store);

    const adminActor: TournamentActorContext = {
      userId: "sa_local_id",
      roles: ["ADMIN"],
      correlationId: "corr-123",
    };

    const draft = await service.createDraft(adminActor, {
      contractId: "HD-2026-CHUNG",
      coreConfig: {
        tournamentCode: "GIAI-ROBOT-ADMIN-2026",
        tournamentName: "Giải Đấu Admin Khởi Tạo",
        shortDescription: "Giải đấu test cho Admin",
        organizersText: "Ban Quản trị Hệ thống",
        competitionMode: "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        scheduledStartAt: "2026-07-01T08:00:00.000Z",
        scheduledEndAt: "2026-07-02T18:00:00.000Z",
        maxParticipants: 16,
      } as any,
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("DRAFT");
    expect(draft.ownerTaUserId).toBe("sa_local_id");

    const audit = store.auditRecords.find((a) => a.action === "TOURNAMENT_DRAFT_CREATED");
    expect(audit).toBeDefined();
    expect(audit?.actorRole).toBe("ADMIN");

    // Patch draft as admin
    const patched = await service.patchDraft(adminActor, draft.id, {
      expectedRevision: draft.revision,
      coreConfig: {
        tournamentName: "Giải Đấu Admin Khởi Tạo (Cập nhật)",
      },
    });
    expect(patched.coreConfig.tournamentName).toBe("Giải Đấu Admin Khởi Tạo (Cập nhật)");

    // Delete draft as admin
    const deleteResult = await service.deleteDraft(adminActor, draft.id);
    expect(deleteResult.deleted).toBe(true);
    expect(store.tournaments.has(draft.id)).toBe(false);
  });

  it("TournamentLifecycleService skips store mutex lock on evaluateScheduledStart when no tournaments are SCHEDULED", async () => {
    const store = new TournamentStateStore({ clockFn: () => new Date("2026-06-01T10:00:00.000Z") });
    const lifecycle = new TournamentLifecycleService(store);

    // No scheduled tournaments exist:
    const result = await lifecycle.evaluateScheduledStart();
    expect(result.startedTournaments).toHaveLength(0);
    expect(result.blockedTournaments).toHaveLength(0);

    const endResult = await lifecycle.evaluateAutoEndAtWindow();
    expect(endResult).toHaveLength(0);
  });

  it("TournamentLifecycleService evaluates scheduled tournaments when present", async () => {
    const now = 1770000000000;
    const store = new TournamentStateStore({ clockFn: () => new Date(now) });
    store.ensureDefaultSeed();
    const service = new CoreDraftService(store);
    const lifecycle = new TournamentLifecycleService(store);

    const draft = await service.createDraft({ userId: "sa", roles: ["ADMIN"] }, {
      contractId: "HD-2026-CHUNG",
      coreConfig: {
        tournamentCode: "SCHEDULED-TEST",
        tournamentName: "Scheduled Test Tournament",
        shortDescription: "Test",
        organizersText: "Org",
        competitionMode: "HUMAN_ONLINE",
        audienceScope: "PUBLIC_REGISTERED",
        scheduledStartAt: new Date(now - 1000).toISOString(),
        scheduledEndAt: new Date(now + 100000).toISOString(),
        maxParticipants: 16,
      } as any,
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });
    store.tournaments.set(draft.id, { ...draft, status: "SCHEDULED" });

    // evaluateScheduledStart evaluates when SCHEDULED status is present
    const firstResult = await lifecycle.evaluateScheduledStart();
    expect(firstResult).toBeDefined();
    // Tournament had 0 participants, so it was blocked from starting
    expect(firstResult.blockedTournaments).toHaveLength(1);
    expect(firstResult.blockedTournaments[0].id).toBe(draft.id);
  });
});
