import { createHash, randomUUID } from "node:crypto";
import {
  ManualAdjudicationRequestSchema,
  ManualAdjudicationBoardSchema,
  ManualAdjudicationTieIndicatorsSchema,
  ManualAdjudicationViewSchema,
  SubmitManualAdjudicationVerdictInputSchema,
  TournamentLeaderboardSnapshotSchema,
  TournamentScoreLedgerEntrySchema,
  type ManualAdjudicationRequestDto,
  type ManualAdjudicationBoard,
  type ManualAdjudicationTieIndicators,
  type ManualAdjudicationViewDto,
  type SubmitManualAdjudicationVerdictInput,
  type TournamentLeaderboardSnapshotDto,
  type TournamentScoreLedgerEntryDto,
  type TournamentStandingRowDto,
} from "@ottv2/contracts";
import { sanitizeAuditSnapshot } from "../tournament-foundation/audit.port.js";
import {
  assertTaContractOrTournamentAccess,
  createTournamentError,
  type TournamentActorContext,
  type TournamentStateStore,
} from "../tournament-foundation/tournament-store.js";

function computeEloWeightedStep(params: {
  blueElo: number;
  redElo: number;
  blueScore: number;
  redScore: number;
  winnerSide: "BLUE" | "RED";
  kFactor: number;
  scoreFloor: number;
}): {
  blueEloAfter: number;
  redEloAfter: number;
  blueScoreAfter: number;
  redScoreAfter: number;
} {
  const expectedBlue = 1 / (1 + Math.pow(10, (params.redElo - params.blueElo) / 400));
  const actualBlue = params.winnerSide === "BLUE" ? 1 : 0;
  const blueEloDelta = Math.round(params.kFactor * (actualBlue - expectedBlue));
  const redEloDelta = -blueEloDelta;

  const blueEloAfter = params.blueElo + blueEloDelta;
  const redEloAfter = params.redElo + redEloDelta;

  let blueScoreDelta = 0;
  let redScoreDelta = 0;

  if (params.winnerSide === "BLUE") {
    blueScoreDelta = Math.max(10, Math.round(25 + Math.max(0, blueEloDelta)));
    redScoreDelta = -Math.round(Math.max(4, Math.abs(redEloDelta) / 2));
  } else {
    redScoreDelta = Math.max(10, Math.round(25 + Math.max(0, redEloDelta)));
    blueScoreDelta = -Math.round(Math.max(4, Math.abs(blueEloDelta) / 2));
  }

  const blueScoreAfter = Math.max(params.scoreFloor, params.blueScore + blueScoreDelta);
  const redScoreAfter = Math.max(params.scoreFloor, params.redScore + redScoreDelta);

  return {
    blueEloAfter,
    redEloAfter,
    blueScoreAfter,
    redScoreAfter,
  };
}

function resolveDeterministicFallbackSide(
  fallbackPolicy: ManualAdjudicationRequestDto["fallbackPolicy"],
  matchId: string
): "BLUE" | "RED" {
  if (fallbackPolicy === "BLUE_ADVANTAGE") return "BLUE";
  if (fallbackPolicy === "RED_ADVANTAGE") return "RED";
  const digest = createHash("sha256").update(matchId).digest();
  return (digest[0]! & 1) === 0 ? "BLUE" : "RED";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function safeSide(value: unknown): "BLUE" | "RED" | null {
  return value === "BLUE" || value === "RED" ? value : null;
}

function safePiece(value: unknown): "R" | "P" | "S" | null {
  return value === "R" || value === "P" || value === "S" ? value : null;
}

function projectSafeBoard(snapshot: Record<string, unknown>): ManualAdjudicationBoard | null {
  const boardSource = Array.isArray(snapshot.board)
    ? { cells: snapshot.board }
    : asRecord(snapshot.board);
  const rows = nonNegativeInt(boardSource.rows ?? boardSource.height);
  const columns = nonNegativeInt(boardSource.columns ?? boardSource.width);
  const rawCells = Array.isArray(boardSource.cells) ? boardSource.cells : null;
  if (!rows || !columns || rows > 15 || columns > 15 || !rawCells) return null;
  if (rawCells.length !== rows * columns) return null;

  const cells: Array<{ row: number; column: number; side: "BLUE" | "RED" | null; pieceType: "R" | "P" | "S" | null }> = [];
  const positions = new Set<string>();
  for (const value of rawCells) {
    const cell = asRecord(value);
    const row = nonNegativeInt(cell.row);
    const column = nonNegativeInt(cell.column ?? cell.col);
    if (row === null || column === null || row >= rows || column >= columns) return null;
    const position = `${row}:${column}`;
    if (positions.has(position)) return null;
    positions.add(position);
    const side = safeSide(cell.side ?? cell.owner);
    const pieceType = safePiece(cell.pieceType ?? cell.type);
    if ((side === null) !== (pieceType === null)) return null;
    cells.push({ row, column, side, pieceType });
  }

  const parsed = ManualAdjudicationBoardSchema.safeParse({ rows, columns, cells });
  return parsed.success ? parsed.data : null;
}

function projectSafeMetrics(value: unknown): ManualAdjudicationTieIndicators["blue"] | null {
  const item = asRecord(value);
  const material = asRecord(item.materialByType ?? item.pieceCounts);
  const candidate = {
    materialByType: {
      R: material.R,
      P: material.P,
      S: material.S,
    },
    goalDistance: item.goalDistance ?? null,
    mobility: item.mobility,
  };
  const parsed = ManualAdjudicationTieIndicatorsSchema.shape.blue.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function projectSafeTieIndicators(snapshot: Record<string, unknown>): ManualAdjudicationTieIndicators | null {
  const rawIndicators = asRecord(snapshot.tieIndicators);
  const blue = projectSafeMetrics(rawIndicators.BLUE ?? rawIndicators.blue);
  const red = projectSafeMetrics(rawIndicators.RED ?? rawIndicators.red);
  return blue && red ? { blue, red } : null;
}

function projectSafeSnapshot(request: ManualAdjudicationRequestDto): Pick<
  ManualAdjudicationViewDto,
  "board" | "sideToMove" | "tieIndicators" | "ruleVersion"
> {
  const snapshot = asRecord(request.frozenSnapshot);
  const board = projectSafeBoard(snapshot);
  const tieIndicators = projectSafeTieIndicators(snapshot);
  const ruleVersion = typeof snapshot.ruleVersion === "string"
    ? snapshot.ruleVersion
    : typeof snapshot.ruleVersionNumber === "number"
      ? String(snapshot.ruleVersionNumber)
      : null;

  return {
    board,
    sideToMove: safeSide(snapshot.sideToMove),
    tieIndicators,
    ruleVersion,
  };
}

function hasReviewableSnapshot(request: ManualAdjudicationRequestDto): boolean {
  const projected = projectSafeSnapshot(request);
  return projected.board !== null
    && projected.sideToMove !== null
    && projected.tieIndicators !== null
    && projected.ruleVersion !== null;
}

interface ParticipantRunningStats {
  elo: number;
  score: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  lastFinishedSequence: number;
  lastFinishedAt: string | null;
}

export class AdjudicationLedgerService {
  private readonly cachedStatsByTournament = new Map<
    string,
    Map<string, ParticipantRunningStats>
  >();

  constructor(private readonly store: TournamentStateStore) {}

  private getOrInitTournamentStats(
    tournamentId: string
  ): Map<string, ParticipantRunningStats> {
    let map = this.cachedStatsByTournament.get(tournamentId);
    if (!map) {
      const existingEntries = this.store.scoreLedger.get(tournamentId) ?? [];
      map = this.replayEntriesMap(tournamentId, existingEntries);
      this.cachedStatsByTournament.set(tournamentId, map);
    }
    return map;
  }

  private appendLedgerEntryInternal(params: {
    tournamentId: string;
    matchId: string;
    blueParticipantId: string;
    redParticipantId: string;
    winnerSide: "BLUE" | "RED";
    resolutionSource: TournamentScoreLedgerEntryDto["resolutionSource"];
    finishedAtIso: string;
  }): TournamentScoreLedgerEntryDto {
    const tournament = this.store.tournaments.get(params.tournamentId);
    if (!tournament) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy giải đấu.",
        details: { reason: "RESOURCE_NOT_FOUND", tournamentId: params.tournamentId },
      });
    }

    const existingEntries = this.store.scoreLedger.get(params.tournamentId) ?? [];
    const duplicate = existingEntries.find((e) => e.matchId === params.matchId);
    if (duplicate) {
      throw createTournamentError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Trận đấu này đã được ghi nhận vào sổ cái tính điểm.",
        details: {
          reason: "MATCH_ALREADY_SETTLED_IN_LEDGER",
          matchId: params.matchId,
          finishSequence: duplicate.finishSequence,
        },
      });
    }

    const finishSequence = this.store.allocateFinishSequence(params.tournamentId);

    // O(1) incremental lookup from running stats cache
    const currentStats = this.getOrInitTournamentStats(params.tournamentId);

    const blueCurrent = currentStats.get(params.blueParticipantId) ?? {
      elo: tournament.coreConfig.initialElo,
      score: tournament.coreConfig.initialScore,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      lastFinishedSequence: 0,
      lastFinishedAt: null,
    };
    const redCurrent = currentStats.get(params.redParticipantId) ?? {
      elo: tournament.coreConfig.initialElo,
      score: tournament.coreConfig.initialScore,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      lastFinishedSequence: 0,
      lastFinishedAt: null,
    };

    const nextStep = computeEloWeightedStep({
      blueElo: blueCurrent.elo,
      redElo: redCurrent.elo,
      blueScore: blueCurrent.score,
      redScore: redCurrent.score,
      winnerSide: params.winnerSide,
      kFactor: tournament.coreConfig.kFactor,
      scoreFloor: tournament.coreConfig.scoreFloor,
    });

    currentStats.set(params.blueParticipantId, {
      elo: nextStep.blueEloAfter,
      score: nextStep.blueScoreAfter,
      wins: blueCurrent.wins + (params.winnerSide === "BLUE" ? 1 : 0),
      losses: blueCurrent.losses + (params.winnerSide === "RED" ? 1 : 0),
      matchesPlayed: blueCurrent.matchesPlayed + 1,
      lastFinishedSequence: finishSequence,
      lastFinishedAt: params.finishedAtIso,
    });

    currentStats.set(params.redParticipantId, {
      elo: nextStep.redEloAfter,
      score: nextStep.redScoreAfter,
      wins: redCurrent.wins + (params.winnerSide === "RED" ? 1 : 0),
      losses: redCurrent.losses + (params.winnerSide === "BLUE" ? 1 : 0),
      matchesPlayed: redCurrent.matchesPlayed + 1,
      lastFinishedSequence: finishSequence,
      lastFinishedAt: params.finishedAtIso,
    });

    const entry = TournamentScoreLedgerEntrySchema.parse({
      id: randomUUID(),
      tournamentId: params.tournamentId,
      matchId: params.matchId,
      finishSequence,
      blueParticipantId: params.blueParticipantId,
      redParticipantId: params.redParticipantId,
      winnerSide: params.winnerSide,
      resolutionSource: params.resolutionSource,
      blueEloBefore: blueCurrent.elo,
      blueEloAfter: nextStep.blueEloAfter,
      blueScoreBefore: blueCurrent.score,
      blueScoreAfter: nextStep.blueScoreAfter,
      redEloBefore: redCurrent.elo,
      redEloAfter: nextStep.redEloAfter,
      redScoreBefore: redCurrent.score,
      redScoreAfter: nextStep.redScoreAfter,
      finishedAt: params.finishedAtIso,
    });

    this.store.scoreLedger.set(params.tournamentId, [...existingEntries, entry]);

    const match = this.store.matches.get(params.matchId);
    if (match) {
      this.store.matches.set(params.matchId, {
        ...match,
        status: "FINISHED",
        winnerSide: params.winnerSide,
        finishSequence,
        endedAt: params.finishedAtIso,
      });
    }

    return entry;
  }

  /**
   * Sweeps all WAITING manual adjudication requests whose deadlineAt <= serverNow
   * and deterministically resolves them via their configured fallbackPolicy (BR-32, T060).
   */
  sweepExpiredAdjudicationsSync(tournamentId?: string): ManualAdjudicationRequestDto[] {
    const nowIso = this.store.nowIso();
    const nowMs = Date.parse(nowIso);
    const resolved: ManualAdjudicationRequestDto[] = [];

    for (const [adjId, req] of this.store.adjudicationRequests.entries()) {
      if (tournamentId && req.tournamentId !== tournamentId) continue;
      if (req.status !== "WAITING") continue;
      if (nowMs >= Date.parse(req.deadlineAt)) {
        const fallbackSide = resolveDeterministicFallbackSide(
          req.fallbackPolicy,
          req.matchId
        );
        const ledgerEntry = this.appendLedgerEntryInternal({
          tournamentId: req.tournamentId,
          matchId: req.matchId,
          blueParticipantId: req.blueParticipantId,
          redParticipantId: req.redParticipantId,
          winnerSide: fallbackSide,
          resolutionSource: "FALLBACK_POLICY",
          finishedAtIso: nowIso,
        });

        const fallbackResolved = ManualAdjudicationRequestSchema.parse({
          ...req,
          status: "FALLBACK_APPLIED",
          winnerSide: fallbackSide,
          decidedByUserId: "SYSTEM_FALLBACK",
          decisionReason: `Quá hạn ${req.deadlineAt}, áp dụng fallback ${req.fallbackPolicy}`,
          decidedAt: nowIso,
          finishSequence: ledgerEntry.finishSequence,
          updatedAt: nowIso,
        });
        this.store.adjudicationRequests.set(adjId, fallbackResolved);
        resolved.push(fallbackResolved);
      }
    }

    return resolved;
  }

  async sweepExpiredAdjudications(
    tournamentId?: string
  ): Promise<ManualAdjudicationRequestDto[]> {
    return this.store.withLock(() => this.sweepExpiredAdjudicationsSync(tournamentId));
  }

  private replayEntriesMap(
    tournamentId: string,
    entries: TournamentScoreLedgerEntryDto[]
  ): Map<
    string,
    {
      elo: number;
      score: number;
      wins: number;
      losses: number;
      matchesPlayed: number;
      lastFinishedSequence: number;
      lastFinishedAt: string | null;
    }
  > {
    const tournament = this.store.tournaments.get(tournamentId)!;
    const map = new Map<
      string,
      {
        elo: number;
        score: number;
        wins: number;
        losses: number;
        matchesPlayed: number;
        lastFinishedSequence: number;
        lastFinishedAt: string | null;
      }
    >();

    for (const e of this.store.enrollments.values()) {
      if (e.tournamentId !== tournamentId) continue;
      if (e.eligibilityStatus === "WITHDRAWN" || e.eligibilityStatus === "DISQUALIFIED") {
        continue;
      }
      const key = e.userId ?? e.personKey;
      map.set(key, {
        elo: e.seedRating ?? tournament.coreConfig.initialElo,
        score: tournament.coreConfig.initialScore,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        lastFinishedSequence: 0,
        lastFinishedAt: null,
      });
    }

    const sorted = [...entries].sort((a, b) => a.finishSequence - b.finishSequence);
    for (const item of sorted) {
      const bStat = map.get(item.blueParticipantId) ?? {
        elo: tournament.coreConfig.initialElo,
        score: tournament.coreConfig.initialScore,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        lastFinishedSequence: 0,
        lastFinishedAt: null,
      };
      const rStat = map.get(item.redParticipantId) ?? {
        elo: tournament.coreConfig.initialElo,
        score: tournament.coreConfig.initialScore,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        lastFinishedSequence: 0,
        lastFinishedAt: null,
      };

      const step = computeEloWeightedStep({
        blueElo: bStat.elo,
        redElo: rStat.elo,
        blueScore: bStat.score,
        redScore: rStat.score,
        winnerSide: item.winnerSide,
        kFactor: tournament.coreConfig.kFactor,
        scoreFloor: tournament.coreConfig.scoreFloor,
      });

      map.set(item.blueParticipantId, {
        elo: step.blueEloAfter,
        score: step.blueScoreAfter,
        wins: bStat.wins + (item.winnerSide === "BLUE" ? 1 : 0),
        losses: bStat.losses + (item.winnerSide === "RED" ? 1 : 0),
        matchesPlayed: bStat.matchesPlayed + 1,
        lastFinishedSequence: item.finishSequence,
        lastFinishedAt: item.finishedAt,
      });

      map.set(item.redParticipantId, {
        elo: step.redEloAfter,
        score: step.redScoreAfter,
        wins: rStat.wins + (item.winnerSide === "RED" ? 1 : 0),
        losses: rStat.losses + (item.winnerSide === "BLUE" ? 1 : 0),
        matchesPlayed: rStat.matchesPlayed + 1,
        lastFinishedSequence: item.finishSequence,
        lastFinishedAt: item.finishedAt,
      });
    }

    return map;
  }

  async openManualAdjudicationRequest(input: {
    tournamentId: string;
    matchId: string;
    roomId: string;
    blueParticipantId: string;
    redParticipantId: string;
    frozenSnapshot: Record<string, unknown>;
    deadlineSeconds?: number;
  }): Promise<ManualAdjudicationRequestDto> {
    return this.store.withLock(() => {
      const tournament = this.store.tournaments.get(input.tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId: input.tournamentId },
        });
      }

      if (
        tournament.status === "CANCELLED" ||
        tournament.status === "ENDED" ||
        tournament.status === "ARCHIVED"
      ) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Không thể mở yêu cầu phân xử cho giải đấu ở trạng thái "${tournament.status}".`,
          details: {
            reason: "TOURNAMENT_NOT_ACCEPTING_ADJUDICATIONS",
            status: tournament.status,
            tournamentId: input.tournamentId,
          },
        });
      }

      for (const existing of this.store.adjudicationRequests.values()) {
        if (existing.matchId === input.matchId) {
          return existing;
        }
      }

      const nowIso = this.store.nowIso();
      const deadlineSeconds =
        input.deadlineSeconds ??
        tournament.ruleProfile.manualAdjudicationDeadlineSeconds;
      const deadlineIso = new Date(
        Date.parse(nowIso) + deadlineSeconds * 1000
      ).toISOString();

      const sanitizedSnapshot = sanitizeAuditSnapshot(input.frozenSnapshot) ?? {};

      const req = ManualAdjudicationRequestSchema.parse({
        id: randomUUID(),
        tournamentId: input.tournamentId,
        matchId: input.matchId,
        roomId: input.roomId,
        blueParticipantId: input.blueParticipantId,
        redParticipantId: input.redParticipantId,
        status: "WAITING",
        frozenSnapshot: sanitizedSnapshot,
        deadlineAt: deadlineIso,
        fallbackPolicy: tournament.ruleProfile.manualAdjudicationFallbackPolicy,
        winnerSide: null,
        decidedByUserId: null,
        decisionReason: null,
        decidedAt: null,
        finishSequence: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      this.store.adjudicationRequests.set(req.id, req);

      const match = this.store.matches.get(input.matchId);
      if (match) {
        this.store.matches.set(input.matchId, {
          ...match,
          status: "PAUSED_ADJUDICATION",
        });
      }

      return req;
    });
  }

  /**
   * BR-31..BR-35, T009, T059, T060:
   * - Only owner TA can submit a manual adjudication verdict (Admin, Referee, Staff, and other TAs are rejected with 403).
   * - If serverNow >= deadlineAt, fallbackPolicy takes priority and rejects late manual override.
   * - CAS on status === "WAITING": only 1 verdict can ever commit.
   */
  async submitManualVerdict(
    actor: TournamentActorContext,
    adjudicationRequestId: string,
    rawInput: SubmitManualAdjudicationVerdictInput
  ): Promise<{
    adjudication: ManualAdjudicationRequestDto;
    ledgerEntry: TournamentScoreLedgerEntryDto;
  }> {
    const parsed = SubmitManualAdjudicationVerdictInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw createTournamentError({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: parsed.error.issues[0]?.message ?? "Dữ liệu phán quyết không hợp lệ.",
        details: { reason: "SCHEMA_VALIDATION_FAILED", field: "reason" },
      });
    }

    return this.store.withLock(() => {
      const req = this.store.adjudicationRequests.get(adjudicationRequestId);
      if (!req) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy yêu cầu phán quyết thủ công.",
          details: { reason: "RESOURCE_NOT_FOUND", adjudicationRequestId },
        });
      }

      const tournament = this.store.tournaments.get(req.tournamentId);
      if (!tournament) {
        throw createTournamentError({
          code: "NOT_FOUND",
          statusCode: 404,
          message: "Không tìm thấy giải đấu.",
          details: { reason: "RESOURCE_NOT_FOUND", tournamentId: req.tournamentId },
        });
      }

      const contract = this.store.contracts.get(tournament.contractId)!;
      const nowIso = this.store.nowIso();

      // Strict owner-TA ACL check (T009, T059)
      assertTaContractOrTournamentAccess(actor, contract, {
        mode: "ADJUDICATE_MATCH",
        tournament,
        serverNowIso: nowIso,
      });

      // CAS check on status === "WAITING" (T060)
      if (req.status !== "WAITING") {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Yêu cầu phán quyết đã ở trạng thái "${req.status}", không thể ghi đè.`,
          details: {
            reason: "ADJUDICATION_ALREADY_RESOLVED",
            status: req.status,
            adjudicationRequestId,
          },
        });
      }

      if (
        tournament.status === "CANCELLED" ||
        tournament.status === "ARCHIVED"
      ) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Giải đấu đã ở trạng thái "${tournament.status}", không thể tiếp nhận phán quyết phân xử.`,
          details: {
            reason: "TOURNAMENT_NOT_ACCEPTING_ADJUDICATIONS",
            status: tournament.status,
            tournamentId: tournament.id,
          },
        });
      }

      // BR-32: If deadline has passed, fallbackPolicy takes strict priority
      if (Date.parse(nowIso) >= Date.parse(req.deadlineAt)) {
        const fallbackSide = resolveDeterministicFallbackSide(
          req.fallbackPolicy,
          req.matchId
        );
        const ledgerEntry = this.appendLedgerEntryInternal({
          tournamentId: req.tournamentId,
          matchId: req.matchId,
          blueParticipantId: req.blueParticipantId,
          redParticipantId: req.redParticipantId,
          winnerSide: fallbackSide,
          resolutionSource: "FALLBACK_POLICY",
          finishedAtIso: nowIso,
        });

        const fallbackResolved = ManualAdjudicationRequestSchema.parse({
          ...req,
          status: "FALLBACK_APPLIED",
          winnerSide: fallbackSide,
          decidedByUserId: "SYSTEM_FALLBACK",
          decisionReason: `Quá hạn ${req.deadlineAt}, áp dụng fallback ${req.fallbackPolicy}`,
          decidedAt: nowIso,
          finishSequence: ledgerEntry.finishSequence,
          updatedAt: nowIso,
        });
        this.store.adjudicationRequests.set(adjudicationRequestId, fallbackResolved);

        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: `Đã quá thời hạn phán quyết thủ công (${req.deadlineAt}). Hệ thống đã tự động áp dụng chính sách dự phòng (${req.fallbackPolicy}).`,
          details: {
            reason: "ADJUDICATION_DEADLINE_EXPIRED",
            adjudicationRequestId,
            finishSequence: ledgerEntry.finishSequence,
          },
        });
      }

      if (!hasReviewableSnapshot(req)) {
        throw createTournamentError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Không thể ghi phán quyết khi snapshot trận đấu thiếu dữ liệu canonical.",
          details: {
            reason: "ADJUDICATION_SNAPSHOT_INCOMPLETE",
            adjudicationRequestId,
          },
        });
      }

      const ledgerEntry = this.appendLedgerEntryInternal({
        tournamentId: req.tournamentId,
        matchId: req.matchId,
        blueParticipantId: req.blueParticipantId,
        redParticipantId: req.redParticipantId,
        winnerSide: parsed.data.winnerSide,
        resolutionSource: "MANUAL_ADJUDICATION",
        finishedAtIso: nowIso,
      });

      const decided = ManualAdjudicationRequestSchema.parse({
        ...req,
        status: "DECIDED",
        winnerSide: parsed.data.winnerSide,
        decidedByUserId: actor.userId,
        decisionReason: parsed.data.reason,
        decidedAt: nowIso,
        finishSequence: ledgerEntry.finishSequence,
        updatedAt: nowIso,
      });

      this.store.adjudicationRequests.set(adjudicationRequestId, decided);
      this.store.audit.append({
        actorUserId: actor.userId,
        actorRole: "TOURNAMENT_ADMIN",
        action: "MANUAL_ADJUDICATION_DECIDED",
        targetType: "ADJUDICATION",
        targetId: adjudicationRequestId,
        beforeSnapshot: req,
        afterSnapshot: decided,
        reason: parsed.data.reason,
        correlationId: actor.correlationId ?? null,
        nowIso,
      });

      return { adjudication: decided, ledgerEntry };
    });
  }

  async recordNormalMatchFinish(input: {
    tournamentId: string;
    matchId: string;
    blueParticipantId: string;
    redParticipantId: string;
    winnerSide: "BLUE" | "RED";
    finishedAtIso?: string;
  }): Promise<TournamentScoreLedgerEntryDto> {
    return this.store.withLock(() => {
      const finishedAtIso = input.finishedAtIso ?? this.store.nowIso();
      return this.appendLedgerEntryInternal({
        tournamentId: input.tournamentId,
        matchId: input.matchId,
        blueParticipantId: input.blueParticipantId,
        redParticipantId: input.redParticipantId,
        winnerSide: input.winnerSide,
        resolutionSource: "NORMAL_FINISH",
        finishedAtIso,
      });
    });
  }

  /**
   * T072, T073, T081: Computes the canonical leaderboard by replaying the tournament's
   * score ledger in ascending `finishSequence` order, independent of wall-clock arrival jitter.
   */
  computeLeaderboardSnapshot(tournamentId: string): TournamentLeaderboardSnapshotDto {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) {
      throw createTournamentError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Không tìm thấy giải đấu.",
        details: { reason: "RESOURCE_NOT_FOUND", tournamentId },
      });
    }

    this.sweepExpiredAdjudicationsSync(tournamentId);

    const entries = [...(this.store.scoreLedger.get(tournamentId) ?? [])].sort(
      (a, b) => a.finishSequence - b.finishSequence
    );
    const replayedMap = this.replayEntriesMap(tournamentId, entries);

    const participantMeta = new Map<
      string,
      { personKey: string; displayName: string; unitCode: string }
    >();
    for (const e of this.store.enrollments.values()) {
      if (e.tournamentId !== tournamentId) continue;
      const key = e.userId ?? e.personKey;
      participantMeta.set(key, {
        personKey: e.personKey,
        displayName: e.displayName,
        unitCode: e.unitCode,
      });
    }

    const rows: Omit<TournamentStandingRowDto, "rank">[] = [];
    for (const [participantId, stat] of replayedMap.entries()) {
      const meta = participantMeta.get(participantId) ?? {
        personKey: participantId,
        displayName: participantId,
        unitCode: "UNKNOWN",
      };
      rows.push({
        participantId,
        personKey: meta.personKey,
        displayName: meta.displayName,
        unitCode: meta.unitCode,
        tournamentScore: stat.score,
        tournamentElo: stat.elo,
        wins: stat.wins,
        losses: stat.losses,
        matchesPlayed: stat.matchesPlayed,
        lastFinishedSequence: stat.lastFinishedSequence,
        lastFinishedAt: stat.lastFinishedAt,
      });
    }

    // 6-level deterministic tie-break order (Section 15 & T072)
    rows.sort((a, b) => {
      if (b.tournamentScore !== a.tournamentScore) {
        return b.tournamentScore - a.tournamentScore;
      }
      if (b.tournamentElo !== a.tournamentElo) {
        return b.tournamentElo - a.tournamentElo;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }
      if (a.lastFinishedSequence !== b.lastFinishedSequence) {
        if (a.lastFinishedSequence === 0) return 1;
        if (b.lastFinishedSequence === 0) return -1;
        return a.lastFinishedSequence - b.lastFinishedSequence;
      }
      return a.personKey.localeCompare(b.personKey);
    });

    const standings: TournamentStandingRowDto[] = rows.map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

    const topNExport = standings.slice(0, tournament.coreConfig.topNExportCount);
    const lastFinishSequence =
      entries.length > 0 ? entries[entries.length - 1]!.finishSequence : 0;

    return TournamentLeaderboardSnapshotSchema.parse({
      tournamentId,
      formulaPreset: "ELO_WEIGHTED_V1",
      lastFinishSequence,
      standings,
      topNExport,
      computedAt: this.store.nowIso(),
    });
  }

  getLedgerEntries(tournamentId: string): TournamentScoreLedgerEntryDto[] {
    return [...(this.store.scoreLedger.get(tournamentId) ?? [])];
  }

  toManualAdjudicationView(request: ManualAdjudicationRequestDto): ManualAdjudicationViewDto {
    const safeSnapshot = projectSafeSnapshot(request);
    const participantLabel = (participantId: string): string => {
      const enrollment = this.store.enrollments.get(participantId);
      return enrollment?.tournamentId === request.tournamentId
        ? enrollment.displayName
        : participantId;
    };
    return ManualAdjudicationViewSchema.parse({
      id: request.id,
      tournamentId: request.tournamentId,
      matchId: request.matchId,
      roomId: request.roomId,
      blueParticipant: { id: request.blueParticipantId, label: participantLabel(request.blueParticipantId) },
      redParticipant: { id: request.redParticipantId, label: participantLabel(request.redParticipantId) },
      status: request.status,
      ...safeSnapshot,
      deadlineAt: request.deadlineAt,
      fallbackPolicy: request.fallbackPolicy,
      winnerSide: request.winnerSide,
      reason: request.decisionReason,
      resolutionSource: request.status === "DECIDED"
        ? "MANUAL"
        : request.status === "FALLBACK_APPLIED"
          ? "FALLBACK_POLICY"
          : null,
      decidedByUserId: request.decidedByUserId,
      finishedAtIso: request.decidedAt,
      finishSequence: request.finishSequence,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }

  getAdjudicationRequest(adjudicationRequestId: string): ManualAdjudicationRequestDto | undefined {
    return this.store.adjudicationRequests.get(adjudicationRequestId);
  }
}
