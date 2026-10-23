import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TournamentApiClient,
  saveLocalDraftBuffer,
  getLocalDraftBuffer,
  clearLocalDraftBuffer,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";
import { createDefaultCoreConfig } from "../../apps/web/src/features/admin/tournaments/tournamentTypes";
import { createTournamentRuntimeBundle } from "../../apps/server/src/modules/tournament-core/index.js";
import { ContractPolicyEnvelopeSchema, DEFAULT_TOURNAMENT_RULE_PROFILE } from "@ottv2/contracts";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("S03 — Tournament Draft Wizard (P02) Contract & Invariant Tests", () => {
  const client = new TournamentApiClient();

  it("AC-01: Router mounts TournamentWizardPage on /admin/tournaments/new and /admin/tournaments/:id", () => {
    const routerContent = read("apps/web/src/app/router.tsx");

    expect(routerContent).toContain("TournamentWizardPage");
    expect(routerContent).toContain("routes.adminTournamentNew");
    expect(routerContent).toContain("routes.adminTournamentDetail");
  });

  it("AC-02: Draft client manages local draft buffer for offline recovery and failure resilience", () => {
    const draftKey = "test-draft-001";
    const sampleData = {
      name: "Giải thử nghiệm cục bộ 2026",
      slug: "giai-thu-nghiem-cuc-bo-2026",
      contractId: "contract-1",
      organizerUnitId: "unit-1",
      visibility: "PRIVATE" as const,
      step: 1,
      lastSavedAt: new Date().toISOString(),
    };

    // Save to local buffer
    saveLocalDraftBuffer(draftKey, sampleData);

    // Retrieve from local buffer
    const recovered = getLocalDraftBuffer<typeof sampleData>(draftKey);
    expect(recovered).not.toBeNull();
    expect(recovered?.name).toBe(sampleData.name);
    expect(recovered?.slug).toBe(sampleData.slug);

    // Clear buffer
    clearLocalDraftBuffer(draftKey);
    expect(getLocalDraftBuffer(draftKey)).toBeNull();
  });

  it("AC-03: CoreDraftService creates tournament draft and reserves contract quota", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-22T08:00:00.000Z"),
    });

    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({
      userId: "admin-1",
      username: "sysadmin",
    });

    // Create a unit and an active contract
    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "CNTT_DHQG",
      unitName: "Khoa Công nghệ Thông tin",
      unitType: "KHOA",
      contactName: "Admin Khoa",
      contactEmail: "admin@fit.vnu.edu.vn",
    });

    const envelope = ContractPolicyEnvelopeSchema.parse({
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      turnSecondsMin: 10,
      turnSecondsMax: 60,
      totalMatchSecondsMin: 120,
      totalMatchSecondsMax: 1800,
      turnLimitMin: 40,
      turnLimitMax: 240,
      allowedNoProgressPlies: [40, 60, 80],
      allowedRepetitionThresholds: [3, 4],
      allowedTieBreakPolicies: [
        "RANDOM_SEEDED",
        "BLUE_ADVANTAGE",
        "RED_ADVANTAGE",
        "REPLAY_ONCE_THEN_SEEDED",
        "MANUAL_REFEREE",
      ],
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD-2026-S03-01",
      unitId: unit.id,
      validFrom: "2026-10-21T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 3,
      maxParticipantsTotal: 100,
      maxParticipantsPerTournament: 32,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: envelope,
      initialTaUserIds: ["ta-user-1"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({
      userId: "ta-user-1",
      username: "ta_one",
    });

    // Initial contract remaining quota
    expect(bundle.unitContractService.getContract(contract.id).quotaRemainingCount).toBe(3);

    // Create draft
    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: createDefaultCoreConfig({
        tournamentCode: "GIAI_KHOI_DONG_2026",
        tournamentName: "Giải Khởi động Robot Lab 2026",
        description: "Bản nháp thử nghiệm kiểm tra S03",
        scheduledStartAt: "2026-11-01T08:00:00.000Z",
        scheduledEndAt: "2026-11-01T18:00:00.000Z",
        maxParticipants: 16,
      }),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("DRAFT");
    expect(draft.revision).toBe(1);
    expect(draft.ownerTaUserId).toBe("ta-user-1");

    // Quota decremented
    expect(bundle.unitContractService.getContract(contract.id).quotaRemainingCount).toBe(2);
  });

  it("AC-04: CoreDraftService enforces Optimistic Concurrency Control (OCC) and rejects stale revision with 409 CONFLICT", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-22T08:00:00.000Z"),
    });

    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({
      userId: "admin-1",
      username: "sysadmin",
    });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "CNTT_MTA",
      unitName: "Khoa CNTT - Học viện",
      unitType: "KHOA",
      contactName: "Admin MTA",
      contactEmail: "admin@mta.edu.vn",
    });

    const envelope = ContractPolicyEnvelopeSchema.parse({
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      turnSecondsMin: 10,
      turnSecondsMax: 60,
      totalMatchSecondsMin: 120,
      totalMatchSecondsMax: 1800,
      turnLimitMin: 40,
      turnLimitMax: 240,
      allowedNoProgressPlies: [40, 60],
      allowedRepetitionThresholds: [3],
      allowedTieBreakPolicies: ["RANDOM_SEEDED", "BLUE_ADVANTAGE"],
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD-2026-S03-02",
      unitId: unit.id,
      validFrom: "2026-10-21T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 2,
      maxParticipantsTotal: 64,
      maxParticipantsPerTournament: 32,
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
      policyEnvelope: envelope,
      initialTaUserIds: ["ta-user-2"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({
      userId: "ta-user-2",
      username: "ta_two",
    });

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: createDefaultCoreConfig({
        tournamentCode: "KY_MON_DON_GIAP_2026",
        tournamentName: "Giải Kỳ Môn Độn Giáp 2026",
        scheduledStartAt: "2026-11-02T08:00:00.000Z",
        scheduledEndAt: "2026-11-02T18:00:00.000Z",
        maxParticipants: 24,
      }),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(draft.revision).toBe(1);

    // Patch with correct expectedRevision = 1
    const patched1 = await bundle.coreDraftService.patchDraft(taActor, draft.id, {
      expectedRevision: 1,
      coreConfig: {
        tournamentName: "Giải Kỳ Môn Độn Giáp Mùa Xuân 2026",
      },
    });
    expect(patched1.revision).toBe(2);
    expect(patched1.coreConfig.tournamentName).toBe("Giải Kỳ Môn Độn Giáp Mùa Xuân 2026");

    // Stale patch with expectedRevision = 1 (current is 2) -> must reject with 409 CONFLICT
    await expect(
      bundle.coreDraftService.patchDraft(taActor, draft.id, {
        expectedRevision: 1,
        coreConfig: {
          tournamentName: "Giải Cố Sửa Bản Cũ",
        },
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });
  });

  it("AC-05: Deleting draft restores contract quota atomically", async () => {
    const bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date("2026-10-22T08:00:00.000Z"),
    });

    bundle.store.grantSystemRole("admin-1", "ADMIN");
    const adminActor = bundle.store.resolveAuthoritativeActor({
      userId: "admin-1",
      username: "sysadmin",
    });

    const unit = await bundle.unitContractService.createUnit(adminActor, {
      unitCode: "CLB_AI",
      unitName: "CLB AI",
      unitType: "CLB",
      contactName: "Admin CLB",
      contactEmail: "admin@clb.ai",
    });

    const envelope = ContractPolicyEnvelopeSchema.parse({
      allowedModes: ["HUMAN_ONLINE"],
      turnSecondsMin: 10,
      turnSecondsMax: 60,
      totalMatchSecondsMin: 120,
      totalMatchSecondsMax: 1800,
      turnLimitMin: 40,
      turnLimitMax: 240,
      allowedNoProgressPlies: [40, 60],
      allowedRepetitionThresholds: [3],
      allowedTieBreakPolicies: ["RANDOM_SEEDED"],
    });

    const contract = await bundle.unitContractService.createContract(adminActor, {
      contractCode: "HD-2026-S03-03",
      unitId: unit.id,
      validFrom: "2026-10-21T00:00:00.000Z",
      validTo: "2026-12-31T23:59:59.000Z",
      maxTournamentsTotal: 1,
      maxParticipantsTotal: 32,
      maxParticipantsPerTournament: 16,
      allowedModes: ["HUMAN_ONLINE"],
      policyEnvelope: envelope,
      initialTaUserIds: ["ta-user-3"],
    });

    const taActor = bundle.store.resolveAuthoritativeActor({
      userId: "ta-user-3",
      username: "ta_three",
    });

    const draft = await bundle.coreDraftService.createDraft(taActor, {
      contractId: contract.id,
      coreConfig: createDefaultCoreConfig({
        tournamentCode: "GIAI_XOA_NHAP",
        tournamentName: "Giải Xóa Nháp",
        scheduledStartAt: "2026-11-03T08:00:00.000Z",
        scheduledEndAt: "2026-11-03T18:00:00.000Z",
        maxParticipants: 16,
      }),
      ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
    });

    expect(bundle.unitContractService.getContract(contract.id).quotaRemainingCount).toBe(0);

    // Delete draft
    const deleteResult = await bundle.coreDraftService.deleteDraft(taActor, draft.id);
    expect(deleteResult.deleted).toBe(true);

    // Quota restored
    expect(bundle.unitContractService.getContract(contract.id).quotaRemainingCount).toBe(1);
  });
});
