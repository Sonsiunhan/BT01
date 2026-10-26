import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { SanitizingAuditService } from "../../src/modules/tournament-foundation/audit.port.js";
import {
  syncPrismaToTournamentStore,
  persistContractToPrisma,
} from "../../src/modules/tournament-foundation/prisma-sync.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";
import { UnitContractService } from "../../src/modules/tournament-foundation/unit-contract.service.js";
import { CoreDraftService } from "../../src/modules/tournament-core/core-draft.service.js";
import type { TournamentCoreConfig } from "@ottv2/contracts";

type RecordedCall = { model: string; op: string; args: Record<string, unknown> };

function createFakePrisma(options?: { failOn?: string }): {
  client: PrismaClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const makeDelegate = (name: string) => ({
    upsert: vi.fn(async (args: Record<string, unknown>) => {
      if (options?.failOn === name) throw new Error(`simulated ${name} outage`);
      calls.push({ model: name, op: "upsert", args });
      return {};
    }),
    delete: vi.fn(async (args: Record<string, unknown>) => {
      if (options?.failOn === name) throw new Error(`simulated ${name} outage`);
      calls.push({ model: name, op: "delete", args });
      return {};
    }),
    deleteMany: vi.fn(async (args: Record<string, unknown>) => {
      calls.push({ model: name, op: "deleteMany", args });
      return { count: 0 };
    }),
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    create: vi.fn(async () => ({})),
  });
  const client = {
    unit: makeDelegate("unit"),
    tournamentContract: makeDelegate("tournamentContract"),
    tournamentContractTaBinding: makeDelegate("tournamentContractTaBinding"),
    tournament: makeDelegate("tournament"),
    tournamentAuditLogRecord: makeDelegate("tournamentAuditLogRecord"),
    tournamentConfigVersionRecord: makeDelegate("tournamentConfigVersionRecord"),
    tournamentChangeRequestRecord: makeDelegate("tournamentChangeRequestRecord"),
    manualAdjudicationRequestRecord: makeDelegate("manualAdjudicationRequestRecord"),
    tournamentScoreLedgerRecord: makeDelegate("tournamentScoreLedgerRecord"),
    tournamentEnrollmentRecord: makeDelegate("tournamentEnrollmentRecord"),
    tournamentStaffAssignmentRecord: makeDelegate("tournamentStaffAssignmentRecord"),
  } as unknown as PrismaClient;
  return { client, calls };
}

function buildCoreConfig(overrides?: Partial<TournamentCoreConfig>): TournamentCoreConfig {
  return {
    tournamentCode: "TOURNAMENT_PERSIST",
    tournamentName: "Giải Đấu Kiểm Thử Persistence",
    shortDescription: "",
    organizersText: "Khoa CNTT",
    competitionMode: "HUMAN_ONLINE",
    audienceScope: "PUBLIC_REGISTERED",
    allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY",
    maxParticipants: 8,
    minParticipantsToStart: 2,
    timezone: "Asia/Ho_Chi_Minh",
    registrationOpenAt: null,
    registrationCloseAt: null,
    checkinRequired: false,
    checkinOpenAt: null,
    checkinCloseAt: null,
    scheduledStartAt: "2026-11-01T08:00:00.000Z",
    scheduledEndAt: "2026-11-01T18:00:00.000Z",
    format: "ARENA_CONTINUOUS",
    pairingMethod: "SWISS_SCORE_ADJACENT",
    maxMatchesPerPlayer: null,
    maxPairMeetings: 2,
    rematchCooldownMinutes: 5,
    maxConcurrentMatches: 4,
    kFactor: 32,
    scoreFloor: 0,
    ...overrides,
  } as TournamentCoreConfig;
}

const adminActor = { userId: "admin-1", roles: ["ADMIN"], principalType: "USER" } as const;
const taActor = { userId: "ta-1", roles: ["TOURNAMENT_ADMIN"], principalType: "USER" } as const;

async function prepareContract(database?: PrismaClient) {
  const store = new TournamentStateStore();
  const unitContractService = new UnitContractService(store, database);
  await unitContractService.createUnit(adminActor, {
    unitCode: "CNTT",
    unitName: "Khoa Công nghệ thông tin",
    unitType: "KHOA",
    contactName: "Nguyễn Văn A",
    contactEmail: "cntt@example.edu",
    status: "ACTIVE",
  });
  const contract = await unitContractService.createContract(adminActor, {
    contractCode: "HD-PERSIST-01",
    unitId: Array.from(store.units.keys())[0]!,
    status: "ACTIVE",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-12-31T23:59:59.000Z",
    maxTournamentsTotal: 5,
    maxParticipantsPerTournament: 64,
    maxParticipantsTotal: 256,
    allowedModes: ["HUMAN_ONLINE"],
    policyEnvelope: {
      allowedModes: ["HUMAN_ONLINE"],
      turnSecondsMin: 15,
      turnSecondsMax: 60,
      totalMatchSecondsMin: 300,
      totalMatchSecondsMax: 1800,
      turnLimitMin: 20,
      turnLimitMax: 200,
      allowedNoProgressPlies: [30, 60],
      allowedRepetitionThresholds: [3, 5],
      allowedTieBreakPolicies: ["RANDOM_SEEDED", "MANUAL_REFEREE"],
    },
    technicalCaps: {
      botSourceMaxBytes: 65536,
      botRuntimeTimeoutMs: 1000,
      botMemoryLimitMb: 64,
      maxConcurrentMatchesPerTournament: 8,
      rosterImportMaxRows: 2000,
    },
    initialTaUserIds: ["ta-1"],
  });
  return { store, unitContractService, contract };
}

describe("UnitContractService — write-through persistence (fail-closed)", () => {
  it("persist đơn vị trước khi đưa vào store khi có database", async () => {
    const { client, calls } = createFakePrisma();
    const store = new TournamentStateStore();
    const service = new UnitContractService(store, client);

    const unit = await service.createUnit(adminActor, {
      unitCode: "CNTT",
      unitName: "Khoa Công nghệ thông tin",
      unitType: "KHOA",
      contactName: "Nguyễn Văn A",
      contactEmail: "cntt@example.edu",
      status: "ACTIVE",
    });

    expect(store.units.has(unit.id)).toBe(true);
    expect(calls.some((c) => c.model === "unit" && c.op === "upsert")).toBe(true);
  });

  it("Prisma lỗi → thao tác từ chối và store KHÔNG bị biến đổi", async () => {
    const { client } = createFakePrisma({ failOn: "unit" });
    const store = new TournamentStateStore();
    const service = new UnitContractService(store, client);

    await expect(
      service.createUnit(adminActor, {
        unitCode: "CNTT",
        unitName: "Khoa Công nghệ thông tin",
        unitType: "KHOA",
        contactName: "Nguyễn Văn A",
        contactEmail: "cntt@example.edu",
        status: "ACTIVE",
      })
    ).rejects.toThrow(/PostgreSQL/);

    expect(store.units.size).toBe(0);
  });

  it("tạo hợp đồng lưu cả hàng hợp đồng lẫn TA binding", async () => {
    const { client, calls } = createFakePrisma();
    const { contract } = await prepareContract(client);

    expect(
      calls.some((c) => c.model === "tournamentContract" && c.op === "upsert")
    ).toBe(true);
    const bindingCalls = calls.filter(
      (c) => c.model === "tournamentContractTaBinding" && c.op === "upsert"
    );
    expect(bindingCalls).toHaveLength(contract.taBindings.length);
  });

  it("cấp/thu hồi TA binding được ghi xuống Prisma", async () => {
    const { client, calls } = createFakePrisma();
    const { store, unitContractService, contract } = await prepareContract(client);
    const before = calls.length;

    await unitContractService.grantTaBinding(adminActor, contract.id, {
      userId: "ta-2",
      username: "ta-2",
      displayName: "TA Hai",
    });
    expect(calls.length).toBeGreaterThan(before);
    expect(store.contracts.get(contract.id)!.taBindings.some((b) => b.userId === "ta-2")).toBe(true);

    const afterGrant = calls.length;
    await unitContractService.revokeTaBinding(adminActor, contract.id, "ta-2", {
      reason: "Thu hồi thử nghiệm",
    });
    expect(calls.length).toBeGreaterThan(afterGrant);
    expect(
      store.contracts.get(contract.id)!.taBindings.find((b) => b.userId === "ta-2")!.status
    ).toBe("REVOKED");
  });
});

describe("CoreDraftService — tournament persistence (fail-closed)", () => {
  it("tạo nháp lưu giải + hạn mức hợp đồng xuống Prisma", async () => {
    const { client, calls } = createFakePrisma();
    const { store, contract } = await prepareContract(client);
    const draftService = new CoreDraftService(store, client);

    const draft = await draftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: buildCoreConfig(),
    });

    expect(store.tournaments.has(draft.id)).toBe(true);
    expect(calls.some((c) => c.model === "tournament" && c.op === "upsert")).toBe(true);
  });

  it("Prisma lỗi khi tạo nháp → từ chối, giải không vào store, hạn mức không bị giữ", async () => {
    const { client } = createFakePrisma({ failOn: "tournament" });
    const { store, contract } = await prepareContract(client);
    const reservedBefore = store.contracts.get(contract.id)!.quotaReservedCount;
    const draftService = new CoreDraftService(store, client);

    await expect(
      draftService.createDraft(taActor, {
        contractId: contract.id,
        coreConfig: buildCoreConfig(),
      })
    ).rejects.toThrow(/PostgreSQL/);

    expect(store.tournaments.size).toBe(0);
    expect(store.contracts.get(contract.id)!.quotaReservedCount).toBe(reservedBefore);
  });
});

describe("SanitizingAuditService — write-through vào PostgreSQL", () => {
  it("append ghi bản ghi đã làm sạch xuống Prisma", async () => {
    const { client, calls } = createFakePrisma();
    const records: never[] = [];
    const audit = new SanitizingAuditService(records, client);

    const record = audit.append({
      actorUserId: "ta-1",
      actorRole: "TOURNAMENT_ADMIN",
      action: "TOURNAMENT_DRAFT_CREATED",
      targetType: "TOURNAMENT",
      targetId: "tour-1",
      reason: "Lý do bình thường",
      afterSnapshot: { botSource: "def choose_move(view, memory):" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const upserts = calls.filter((c) => c.model === "tournamentAuditLogRecord" && c.op === "upsert");
    expect(upserts).toHaveLength(1);
    const args = upserts[0]!.args as { create: Record<string, unknown> };
    expect(args.create.id).toBe(record.id);
    expect(args.create.reason).toBe("Lý do bình thường");
    expect(JSON.stringify(args.create.afterSnapshot)).toContain("[REDACTED]");
  });

  it("Prisma lỗi khi ghi audit → không làm đổ nghiệp vụ, bản ghi vẫn nằm trong bộ nhớ", async () => {
    const { client } = createFakePrisma({ failOn: "tournamentAuditLogRecord" });
    const records: never[] = [];
    const audit = new SanitizingAuditService(records, client);

    expect(() =>
      audit.append({
        actorUserId: "ta-1",
        actorRole: "TOURNAMENT_ADMIN",
        action: "TOURNAMENT_DRAFT_CREATED",
        targetType: "TOURNAMENT",
        targetId: "tour-1",
      })
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(records).toHaveLength(1);
  });
});

describe("syncPrismaToTournamentStore — hydrate mở rộng", () => {
  it("nạp configVersions, changeRequests và dựng lại finishSequenceCounters", async () => {
    const { client } = createFakePrisma();
    const prisma = client as unknown as {
      unit: { findMany: ReturnType<typeof vi.fn> };
      tournamentContract: { findMany: ReturnType<typeof vi.fn> };
      tournament: { findMany: ReturnType<typeof vi.fn> };
      manualAdjudicationRequestRecord: { findMany: ReturnType<typeof vi.fn> };
      tournamentScoreLedgerRecord: { findMany: ReturnType<typeof vi.fn> };
      tournamentEnrollmentRecord: { findMany: ReturnType<typeof vi.fn> };
      tournamentStaffAssignmentRecord: { findMany: ReturnType<typeof vi.fn> };
      tournamentConfigVersionRecord: { findMany: ReturnType<typeof vi.fn> };
      tournamentChangeRequestRecord: { findMany: ReturnType<typeof vi.fn> };
    };
    prisma.unit.findMany = vi.fn(async () => []);
    prisma.tournamentContract.findMany = vi.fn(async () => []);
    prisma.tournament.findMany = vi.fn(async () => [
      {
        id: "tour-1",
        contractId: "hd-1",
        unitId: "u-1",
        ownerTaUserId: "ta-1",
        status: "APPROVED",
        revision: 2,
        coreConfig: { tournamentCode: "C32", tournamentName: "Giải thử" },
        ruleProfile: {},
        activeConfigVersionId: "cv-1",
        activeConfigVersionNumber: 1,
        approvedSnapshot: null,
        everApproved: true,
        quotaRefunded: false,
        submittedAt: new Date("2026-10-01T00:00:00Z"),
        approvedAt: new Date("2026-10-02T00:00:00Z"),
        rejectedAt: null,
        changesRequestedAt: null,
        lastReviewNote: null,
        startedAt: null,
        pausedAt: null,
        pauseReason: null,
        endedAt: null,
        cancelledAt: null,
        cancelReason: null,
        finalizedAt: null,
        copiedFromTournamentId: null,
        createdAt: new Date("2026-10-01T00:00:00Z"),
        updatedAt: new Date("2026-10-02T00:00:00Z"),
        contract: { contractCode: "HD-1" },
      },
    ]);
    prisma.manualAdjudicationRequestRecord.findMany = vi.fn(async () => []);
    prisma.tournamentScoreLedgerRecord.findMany = vi.fn(async () => [
      {
        id: "led-1",
        tournamentId: "tour-1",
        matchId: "m-1",
        finishSequence: 3,
        blueParticipantId: "p1",
        redParticipantId: "p2",
        winnerSide: "BLUE",
        resolutionSource: "NORMAL_WIN",
        blueEloBefore: 1000,
        blueEloAfter: 1016,
        blueScoreBefore: 0,
        blueScoreAfter: 1,
        redEloBefore: 1000,
        redEloAfter: 984,
        redScoreBefore: 0,
        redScoreAfter: 0,
        finishedAt: new Date("2026-10-03T00:00:00Z"),
      },
    ]);
    prisma.tournamentEnrollmentRecord.findMany = vi.fn(async () => []);
    prisma.tournamentStaffAssignmentRecord.findMany = vi.fn(async () => []);
    prisma.tournamentConfigVersionRecord.findMany = vi.fn(async () => [
      {
        id: "cv-1",
        tournamentId: "tour-1",
        versionNumber: 1,
        coreConfigSnapshot: { tournamentCode: "C32" },
        ruleProfileSnapshot: {},
        effectiveAt: new Date("2026-10-02T00:00:00Z"),
        publishedByUserId: "admin-1",
        changeSummary: "Phê duyệt ban đầu",
        createdAt: new Date("2026-10-02T00:00:00Z"),
      },
    ]);
    prisma.tournamentChangeRequestRecord.findMany = vi.fn(async () => [
      {
        id: "cr-1",
        tournamentId: "tour-1",
        contractId: "hd-1",
        requestedByTaUserId: "ta-1",
        status: "PENDING",
        reason: "Cần tăng số trận",
        proposedCoreConfigPatch: null,
        proposedRuleProfilePatch: null,
        effectiveAt: new Date("2026-10-05T00:00:00Z"),
        diffs: [],
        reviewedByAdminUserId: null,
        reviewNote: null,
        reviewedAt: null,
        appliedConfigVersionId: null,
        createdAt: new Date("2026-10-04T00:00:00Z"),
        updatedAt: new Date("2026-10-04T00:00:00Z"),
      },
    ]);

    const store = new TournamentStateStore();
    const result = await syncPrismaToTournamentStore(client, store);

    expect(result.tournamentsCount).toBe(1);
    expect(store.configVersions.get("tour-1")).toHaveLength(1);
    expect(store.changeRequests.get("cr-1")!.tournamentCode).toBe("C32");
    expect(store.finishSequenceCounters.get("tour-1")).toBe(3);
  });
});

describe("persistContractToPrisma — đồng bộ TA binding", () => {
  it("xóa binding còn sót trong DB nhưng không còn trong DTO", async () => {
    const { client, calls } = createFakePrisma();
    const contract = {
      id: "hd-x",
      contractCode: "HD-X",
      unitId: "u-1",
      unitCode: "CNTT",
      unitName: "Khoa CNTT",
      status: "ACTIVE",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: "2027-12-31T23:59:59.000Z",
      maxTournamentsTotal: 5,
      quotaReservedCount: 0,
      quotaConsumedCount: 0,
      quotaRemainingCount: 5,
      maxParticipantsPerTournament: 64,
      maxParticipantsTotal: 256,
      currentParticipantsTotal: 0,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope: {},
      technicalCaps: {},
      taBindings: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never;

    await persistContractToPrisma(client, contract);

    const deleteMany = calls.find(
      (c) => c.model === "tournamentContractTaBinding" && c.op === "deleteMany"
    );
    expect(deleteMany).toBeDefined();
  });
});
