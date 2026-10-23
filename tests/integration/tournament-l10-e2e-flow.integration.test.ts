import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  ContractPolicyEnvelopeSchema,
  DEFAULT_TOURNAMENT_RULE_PROFILE,
  type RegisterRequest,
} from "@ottv2/contracts";
import { buildApp } from "../../apps/server/src/app.js";
import { loadEnv } from "../../apps/server/src/config/env.js";
import {
  AuthService,
  type AuthContext,
  type SelfProfile,
} from "../../apps/server/src/modules/auth/auth.service.js";
import {
  createTournamentRuntimeBundle,
  type TournamentRuntimeBundle,
} from "../../apps/server/src/modules/tournament-core/index.js";
import { AppError } from "../../apps/server/src/shared/errors/app-error.js";

class InMemoryTestAuthService extends AuthService {
  private readonly testSessions = new Map<string, AuthContext>();

  override async register(
    input: RegisterRequest
  ): Promise<{ user: SelfProfile; recoveryCode: string; token: string }> {
    const id = randomUUID();
    const token = `tok_${id}`;
    const now = new Date();
    const user: SelfProfile = {
      id,
      fullName: input.fullName,
      displayName: input.displayName,
      username: input.username,
      theme: "system",
      avatarPreset: "robot",
      privacy: {
        presenceVisibility: "FRIENDS",
        friendListVisibility: "PRIVATE",
        fullNameVisibility: "PRIVATE",
      },
      stats: {
        elo: 1000,
        rankedWins: 0,
        rankedLosses: 0,
        quickWins: 0,
        quickLosses: 0,
      },
      botStats: { wins: 0, losses: 0 },
    };
    const context: AuthContext = {
      principal: "ACCOUNT",
      session: {
        id: `sess_${id}`,
        userId: id,
        tokenHash: token,
        remember: true,
        expiresAt: new Date(now.getTime() + 86400_000),
        revokedAt: null,
        createdAt: now,
        lastUsedAt: now,
      },
      user: {
        id,
        fullName: input.fullName,
        displayName: input.displayName,
        username: input.username,
        usernameNormalized: input.username.toLowerCase(),
        passwordHash: "",
        recoveryCodeHash: "",
        recoveryUsedAt: null,
        createdAt: now,
        updatedAt: now,
        profile: null,
        stats: null,
      },
    };
    this.testSessions.set(token, context);
    return { user, recoveryCode: "REC-1234", token };
  }

  override async authenticate(token: string | undefined): Promise<AuthContext> {
    if (!token) {
      throw new AppError(
        "UNAUTHORIZED",
        "Vui lòng đăng nhập.",
        401,
        false,
        "FATAL_SESSION"
      );
    }
    const found = this.testSessions.get(token);
    if (!found) {
      throw new AppError(
        "UNAUTHORIZED",
        "Phiên đăng nhập không hợp lệ.",
        401,
        false,
        "FATAL_SESSION"
      );
    }
    return found;
  }
}

const ORIGIN = "https://frontend.example.com";

const SAMPLE_ENVELOPE = ContractPolicyEnvelopeSchema.parse({
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

function extractCookieHeader(headers: Record<string, unknown>): string {
  const raw = headers["set-cookie"];
  if (!raw) return "";
  const list = Array.isArray(raw) ? raw : [String(raw)];
  return list.map((c) => c.split(";")[0]).join("; ");
}

describe("L10 — End-to-End Tournament Initialization & C32 HTTP Integration Flow", () => {
  let app: FastifyInstance;
  let bundle: TournamentRuntimeBundle;
  let currentIso = "2026-10-21T08:00:00.000Z";

  beforeAll(async () => {
    bundle = createTournamentRuntimeBundle({
      clockFn: () => new Date(currentIso),
    });
    app = await buildApp({
      env: loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/l10_never_connect",
        CORS_ORIGINS: ORIGIN,
      }),
      database: { check: async () => 0, close: async () => {} },
      auth: new InMemoryTestAuthService(),
      tournamentBundle: bundle,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(username: string, fullName: string) {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
      },
      payload: {
        fullName,
        displayName: fullName,
        username,
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload) as { user: { id: string; username: string } };
    return {
      user: body.user,
      cookie: extractCookieHeader(res.headers),
    };
  }

  it("executes the full lifecycle P06 -> P07 -> Draft -> P08 Approval -> ChangeRequest -> Rule Publish -> Readiness -> Start -> C32 Admission Gate -> Adjudication -> Leaderboard -> End -> Finalize -> Audit", async () => {
    const adminAuth = await registerUser("sysadmin", "Quản trị Hệ thống");
    bundle.store.grantSystemRole(adminAuth.user.id, "ADMIN");
    const taAuth = await registerUser("ta_cntt", "Quản trị Giải CNTT");
    const blueAuth = await registerUser("player_blue", "Đấu thủ Xanh");
    const redAuth = await registerUser("player_red", "Đấu thủ Đỏ");
    const outsiderAuth = await registerUser("outsider_user", "Người Chơi Ngoài");

    const guestRes = await app.inject({
      method: "POST",
      url: "/guest/session",
      headers: { origin: ORIGIN, "x-ott-request": "1" },
      payload: { clientId: "client-guest-1", displayName: "Khách Thử Nghiệm" },
    });
    expect(guestRes.statusCode).toBe(200);
    const guestCookie = extractCookieHeader(guestRes.headers);

    // 1. Non-admin cannot read or create Admin resources (/api/admin/* -> 403)
    const forbiddenGetUnitsRes = await app.inject({
      method: "GET",
      url: "/api/admin/units",
      headers: { origin: ORIGIN, cookie: taAuth.cookie },
    });
    expect(forbiddenGetUnitsRes.statusCode).toBe(403);

    const forbiddenGetContractsRes = await app.inject({
      method: "GET",
      url: "/api/admin/contracts",
      headers: { origin: ORIGIN, cookie: taAuth.cookie },
    });
    expect(forbiddenGetContractsRes.statusCode).toBe(403);

    const forbiddenGetApprovalsRes = await app.inject({
      method: "GET",
      url: "/api/admin/approvals",
      headers: { origin: ORIGIN, cookie: taAuth.cookie },
    });
    expect(forbiddenGetApprovalsRes.statusCode).toBe(403);

    const forbiddenGetAuditRes = await app.inject({
      method: "GET",
      url: "/api/admin/audit-logs",
      headers: { origin: ORIGIN, cookie: taAuth.cookie },
    });
    expect(forbiddenGetAuditRes.statusCode).toBe(403);

    const forbiddenUnitRes = await app.inject({
      method: "POST",
      url: "/api/admin/units",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        unitCode: "KHOA_CNTT",
        unitName: "Khoa Công nghệ Thông tin",
        unitType: "KHOA",
        contactName: "Nguyễn Văn A",
        contactEmail: "cntt@example.edu.vn",
      },
    });
    expect(forbiddenUnitRes.statusCode).toBe(403);

    // 2. Admin creates Unit on P06
    const createUnitRes = await app.inject({
      method: "POST",
      url: "/api/admin/units",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: {
        unitCode: "KHOA_CNTT",
        unitName: "Khoa Công nghệ Thông tin",
        unitType: "KHOA",
        contactName: "Nguyễn Văn A",
        contactEmail: "cntt@example.edu.vn",
      },
    });
    expect(createUnitRes.statusCode).toBe(201);
    const { unit } = JSON.parse(createUnitRes.payload) as {
      unit: { id: string; unitCode: string };
    };

    // 3. Admin creates Contract & binds ta_cntt on P07
    const createContractRes = await app.inject({
      method: "POST",
      url: "/api/admin/contracts",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: {
        contractCode: "HD_CNTT_E2E",
        unitId: unit.id,
        validFrom: "2026-10-01T00:00:00.000Z",
        validTo: "2026-12-31T23:59:59.000Z",
        maxTournamentsTotal: 2,
        maxParticipantsPerTournament: 16,
        maxParticipantsTotal: 32,
        allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
        policyEnvelope: SAMPLE_ENVELOPE,
        initialTaUserIds: [taAuth.user.id],
      },
    });
    expect(createContractRes.statusCode).toBe(201);
    const { contract } = JSON.parse(createContractRes.payload) as {
      contract: { id: string; quotaReservedCount: number };
    };

    // Deleting referenced unit on P06 is blocked with 409 (T002)
    const deleteUnitRes = await app.inject({
      method: "DELETE",
      url: `/api/admin/units/${unit.id}`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
    });
    expect(deleteUnitRes.statusCode).toBe(409);

    // 4. TA creates Draft Tournament
    const createDraftRes = await app.inject({
      method: "POST",
      url: "/api/tournaments/drafts",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        contractId: contract.id,
        coreConfig: {
          tournamentCode: "CNTT_CHAMP_2026",
          tournamentName: "Giải Vô địch CNTT 2026",
          shortDescription: "Bản nháp lần 1",
          organizersText: "Khoa CNTT",
          competitionMode: "HUMAN_ONLINE",
          audienceScope: "PUBLIC_REGISTERED",
          allowedUnitCodes: [],
          registrationIntakeMode: "IMPORT_ONLY",
          maxParticipants: 16,
          minParticipantsToStart: 2,
          timezone: "Asia/Ho_Chi_Minh",
          registrationOpenAt: null,
          registrationCloseAt: null,
          checkinRequired: false,
          checkinOpenAt: null,
          checkinCloseAt: null,
          scheduledStartAt: "2026-11-01T08:00:00.000Z",
          scheduledEndAt: "2026-11-01T12:00:00.000Z",
          format: "ARENA_CONTINUOUS",
          pairingMethod: "SWISS_SCORE_ADJACENT",
          maxMatchesPerPlayer: null,
          maxPairMeetings: 2,
          rematchCooldownMinutes: 5,
          maxConcurrentMatches: 8,
          byeScorePoints: 0,
          spectatorPolicy: "ROSTER_ONLY",
          chatPolicy: "SPECTATOR_MUTED",
          leaderboardVisibility: "LIVE_PUBLIC",
          topNExportCount: 2,
          finalizationMode: "AUTO_FINAL",
          scoringFormulaPreset: "ELO_WEIGHTED_V1",
          initialScore: 1000,
          initialElo: 1000,
          kFactor: 32,
          scoreFloor: 0,
          botDeadlineAt: null,
        },
        ruleProfile: {
          ...DEFAULT_TOURNAMENT_RULE_PROFILE,
          tieBreakPolicy: "MANUAL_REFEREE",
        },
      },
    });
    expect(createDraftRes.statusCode).toBe(201);
    const { tournament: draft } = JSON.parse(createDraftRes.payload) as {
      tournament: { id: string; revision: number };
    };

    // 5. TA submits Draft -> UNDER_REVIEW
    const submit1Res = await app.inject({
      method: "POST",
      url: `/api/tournaments/${draft.id}/submit`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: { expectedRevision: draft.revision },
    });
    expect(submit1Res.statusCode).toBe(200);
    const { tournament: sub1 } = JSON.parse(submit1Res.payload) as {
      tournament: { revision: number; status: string };
    };
    expect(sub1.status).toBe("UNDER_REVIEW");

    // 6. Admin inspects approval detail (GET /api/admin/approvals/:tournamentId) & requests changes on P08 -> CHANGES_REQUESTED
    const detailForbiddenRes = await app.inject({
      method: "GET",
      url: `/api/admin/approvals/${draft.id}`,
      headers: {
        cookie: taAuth.cookie,
      },
    });
    expect(detailForbiddenRes.statusCode).toBe(403);

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/admin/approvals/${draft.id}`,
      headers: {
        cookie: adminAuth.cookie,
      },
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = JSON.parse(detailRes.payload) as {
      envelopeCheck: { withinEnvelope: boolean };
    };
    expect(detailBody.envelopeCheck.withinEnvelope).toBe(true);

    const reqChangesRes = await app.inject({
      method: "POST",
      url: `/api/admin/approvals/${draft.id}/decision`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: {
        decision: "REQUEST_CHANGES",
        expectedRevision: sub1.revision,
        note: "Vui lòng cập nhật mô tả chi tiết hơn.",
        fieldNotes: {
          shortDescription: "Ghi rõ đối tượng sinh viên CNTT",
        },
      },
    });
    expect(reqChangesRes.statusCode).toBe(200);
    const { tournament: afterReqChanges } = JSON.parse(
      reqChangesRes.payload
    ) as {
      tournament: {
        revision: number;
        status: string;
        lastReviewFieldNotes: Record<string, string>;
      };
    };
    expect(afterReqChanges.status).toBe("CHANGES_REQUESTED");
    expect(afterReqChanges.lastReviewFieldNotes).toEqual({
      shortDescription: "Ghi rõ đối tượng sinh viên CNTT",
    });

    // 7. TA patches draft, resubmits, and Admin approves on P08 -> APPROVED (v1)
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/tournaments/${draft.id}`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        expectedRevision: afterReqChanges.revision,
        coreConfig: { shortDescription: "Giải chính thức cấp Khoa CNTT" },
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const { tournament: patched } = JSON.parse(patchRes.payload) as {
      tournament: { revision: number };
    };

    const submit2Res = await app.inject({
      method: "POST",
      url: `/api/tournaments/${draft.id}/submit`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: { expectedRevision: patched.revision },
    });
    expect(submit2Res.statusCode).toBe(200);
    const { tournament: sub2 } = JSON.parse(submit2Res.payload) as {
      tournament: { revision: number };
    };

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/admin/approvals/${draft.id}/decision`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: {
        decision: "APPROVE",
        expectedRevision: sub2.revision,
        note: "Duyệt hồ sơ giải CNTT 2026",
      },
    });
    expect(approveRes.statusCode).toBe(200);
    const { tournament: approved } = JSON.parse(approveRes.payload) as {
      tournament: { id: string; revision: number; status: string };
    };
    expect(approved.status).toBe("APPROVED");

    // 7b. Post-approval ChangeRequest & SA Approval (T024, T061)
    const crRes = await app.inject({
      method: "POST",
      url: `/api/tournaments/${approved.id}/change-requests`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        reason: "Cập nhật mô tả giải đấu sau khi đã được phê duyệt",
        effectiveAt: "2026-11-01T08:00:00.000Z",
        proposedCoreConfigPatch: { shortDescription: "Giải chính thức cấp Khoa CNTT - Phiên bản nâng cấp" },
      },
    });
    expect(crRes.statusCode).toBe(201);
    const { changeRequest } = JSON.parse(crRes.payload) as {
      changeRequest: { id: string; status: string };
    };
    expect(changeRequest.status).toBe("PENDING");

    const crDecisionRes = await app.inject({
      method: "POST",
      url: `/api/admin/change-requests/${changeRequest.id}/decision`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: {
        decision: "APPROVE",
        note: "Chấp thuận thay đổi cấu hình",
      },
    });
    expect(crDecisionRes.statusCode).toBe(200);

    // 7c. Within-Envelope Rule Update by TA directly without re-review (BR-10, T025)
    const latestTourRes = await app.inject({
      method: "GET",
      url: `/api/tournaments/${approved.id}`,
      headers: { cookie: taAuth.cookie },
    });
    const latestTour = JSON.parse(latestTourRes.payload).tournament;

    const ruleUpdateRes = await app.inject({
      method: "POST",
      url: `/api/tournaments/${approved.id}/rule-versions`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        expectedRevision: latestTour.revision,
        effectiveAt: "2026-11-01T08:00:00.000Z",
        changeSummary: "Điều chỉnh thời gian lượt đi trong khung hợp đồng",
        ruleProfilePatch: { turnSeconds: 20 },
      },
    });
    expect(ruleUpdateRes.statusCode).toBe(200);

    // 7d. Evaluate Readiness before participant enrollment -> blocked
    const readinessBeforeRes = await app.inject({
      method: "GET",
      url: `/api/tournaments/${approved.id}/readiness`,
      headers: { cookie: taAuth.cookie },
    });
    expect(readinessBeforeRes.statusCode).toBe(200);
    const readinessBefore = JSON.parse(readinessBeforeRes.payload).readiness;
    expect(readinessBefore.canStartRunning).toBe(false);
    expect(readinessBefore.blockers).toContain("INSUFFICIENT_ELIGIBLE_PARTICIPANTS");

    // 7e. P15 Offline Hub Capabilities route check
    const offlineCapsRes = await app.inject({
      method: "GET",
      url: "/api/admin/offline/capabilities",
      headers: { cookie: adminAuth.cookie },
    });
    expect(offlineCapsRes.statusCode).toBe(200);
    expect(JSON.parse(offlineCapsRes.payload).capabilities["offline.hub.read"]).toBe(true);

    // 8. Enroll 2 eligible participants & start tournament -> RUNNING
    const taActor = bundle.store.resolveAuthoritativeActor({
      userId: taAuth.user.id,
      username: taAuth.user.username,
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "SV_BLUE",
      userId: blueAuth.user.id,
      displayName: "Đấu thủ Xanh",
      unitCode: "KHOA_CNTT",
    });
    await bundle.coreDraftService.enrollParticipant(taActor, approved.id, {
      personKey: "SV_RED",
      userId: redAuth.user.id,
      displayName: "Đấu thủ Đỏ",
      unitCode: "KHOA_CNTT",
    });

    const readinessRes = await app.inject({
      method: "GET",
      url: `/api/tournaments/${approved.id}/readiness`,
      headers: { cookie: taAuth.cookie },
    });
    expect(readinessRes.statusCode).toBe(200);
    expect(JSON.parse(readinessRes.payload).readiness.canStartRunning).toBe(true);

    const startRes = await app.inject({
      method: "POST",
      url: `/api/tournaments/${approved.id}/start`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
    });
    expect(startRes.statusCode).toBe(200);
    expect(JSON.parse(startRes.payload).tournament.status).toBe("RUNNING");

    // 9. C32 Online Admission Gate verification on /matchmaking/queue and /rooms:
    // - Admin is blocked (403 ADMIN_CANNOT_PLAY_ONLINE)
    const adminQueueRes = await app.inject({
      method: "POST",
      url: "/matchmaking/queue",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: adminAuth.cookie,
      },
      payload: { mode: "MANUAL" },
    });
    expect(adminQueueRes.statusCode).toBe(403);
    expect(JSON.parse(adminQueueRes.payload).details.reason).toBe(
      "ADMIN_CANNOT_PLAY_ONLINE"
    );

    // - Guest is blocked during RUNNING tournament window (403 GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW)
    const guestQueueRes = await app.inject({
      method: "POST",
      url: "/matchmaking/queue",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: guestCookie,
      },
      payload: { mode: "MANUAL" },
    });
    expect(guestQueueRes.statusCode).toBe(403);
    expect(JSON.parse(guestQueueRes.payload).details.reason).toBe(
      "GUEST_BLOCKED_DURING_TOURNAMENT_WINDOW"
    );

    // - Outsider user is blocked during RUNNING tournament window (403 OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW)
    const outsiderRoomRes = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: outsiderAuth.cookie,
      },
      payload: { mode: "UNRANKED", playMode: "MANUAL" },
    });
    expect(outsiderRoomRes.statusCode).toBe(403);
    expect(JSON.parse(outsiderRoomRes.payload).details.reason).toBe(
      "OUTSIDE_USER_BLOCKED_DURING_TOURNAMENT_WINDOW"
    );

    // - Eligible tournament participant (player_blue) is ALLOWED to join matchmaking queue!
    const blueQueueRes = await app.inject({
      method: "POST",
      url: "/matchmaking/queue",
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: blueAuth.cookie,
      },
      payload: { mode: "UNRANKED" },
    });
    expect(blueQueueRes.statusCode).toBe(200);

    // 10. Manual Adjudication & Leaderboard over HTTP
    const adjReq =
      await bundle.adjudicationLedgerService.openManualAdjudicationRequest({
        tournamentId: approved.id,
        matchId: "e2e-match-1",
        roomId: "e2e-room-1",
        blueParticipantId: blueAuth.user.id,
        redParticipantId: redAuth.user.id,
        frozenSnapshot: {
          board: {
            rows: 1,
            columns: 1,
            cells: [{ row: 0, column: 0, side: null, pieceType: null }],
          },
          sideToMove: "BLUE",
          ruleVersion: "rps-v1",
          tieIndicators: {
            blue: { materialByType: { R: 0, P: 0, S: 0 }, goalDistance: null, mobility: 0 },
            red: { materialByType: { R: 0, P: 0, S: 0 }, goalDistance: null, mobility: 0 },
          },
          turn: 120,
        },
      });

    const verdictRes = await app.inject({
      method: "POST",
      url: `/api/tournaments/adjudications/${adjReq.id}/verdict`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
      payload: {
        winnerSide: "BLUE",
        reason: "Đấu thủ Xanh thắng theo phán quyết của TA",
      },
    });
    expect(verdictRes.statusCode).toBe(200);

    const lbRes = await app.inject({
      method: "GET",
      url: `/api/tournaments/${approved.id}/leaderboard`,
      headers: { cookie: taAuth.cookie },
    });
    expect(lbRes.statusCode).toBe(200);
    const lb = JSON.parse(lbRes.payload).leaderboard;
    expect(lb.lastFinishSequence).toBe(1);
    expect(lb.standings[0].participantId).toBe(blueAuth.user.id);

    // 11. Advance clock past scheduledEndAt -> auto-ends -> finalize -> inspect audit logs
    currentIso = "2026-11-01T12:30:00.000Z";
    const getTourAfterEnd = await app.inject({
      method: "GET",
      url: `/api/tournaments/${approved.id}`,
      headers: { cookie: taAuth.cookie },
    });
    expect(JSON.parse(getTourAfterEnd.payload).tournament.status).toBe("ENDED");

    const finalizeRes = await app.inject({
      method: "POST",
      url: `/api/tournaments/${approved.id}/finalize`,
      headers: {
        origin: ORIGIN,
        "x-ott-request": "1",
        cookie: taAuth.cookie,
      },
    });
    expect(finalizeRes.statusCode).toBe(200);
    expect(JSON.parse(finalizeRes.payload).tournament.status).toBe("ARCHIVED");

    const auditRes = await app.inject({
      method: "GET",
      url: `/api/admin/audit-logs?targetType=TOURNAMENT&targetId=${approved.id}`,
      headers: { cookie: adminAuth.cookie },
    });
    expect(auditRes.statusCode).toBe(200);
    const logs = JSON.parse(auditRes.payload).logs as Array<{ action: string }>;
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining([
        "TOURNAMENT_DRAFT_CREATED",
        "TOURNAMENT_SUBMITTED_FOR_REVIEW",
        "TOURNAMENT_CHANGES_REQUESTED",
        "TOURNAMENT_APPROVED",
        "TOURNAMENT_STARTED",
        "TOURNAMENT_FINALIZED",
      ])
    );
  });
});
