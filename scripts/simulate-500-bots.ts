import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";

const prisma = new PrismaClient();

// Helper tính toán Elo & Score chuẩn hệ thống ELO_WEIGHTED_V1
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

const UNIVERSITIES = [
  { code: "VNU_DHQG", name: "Đại học Quốc gia Hà Nội" },
  { code: "HUST_BK", name: "Đại học Bách Khoa Hà Nội" },
  { code: "UIT_CNTT", name: "ĐH Công nghệ Thông tin - ĐHQG TP.HCM" },
  { code: "FPT_TECH", name: "Đại học FPT" },
  { code: "PTIT_BCVT", name: "Học viện CNBC Viễn thông" },
  { code: "HCMUS_KHTN", name: "ĐH Khoa học Tự nhiên - ĐHQG TP.HCM" },
  { code: "DUT_BKDN", name: "Đại học Bách Khoa Đà Nẵng" },
  { code: "NEU_KTQD", name: "Đại học Kinh tế Quốc dân" },
];

const BOT_NAME_PREFIXES = [
  "Alpha", "Quantum", "Deep", "Cyber", "Neural", "Mega", "Hyper", "Vortex",
  "Titan", "Apex", "Shadow", "Falcon", "Iron", "Vector", "Optima", "Cosmo"
];
const BOT_NAME_SUFFIXES = [
  "Rook", "Knight", "Scissors", "Pawn", "Rock", "Paper", "Striker", "Sentinel",
  "Valkyrie", "Gladiator", "Oracle", "Matrix", "Reaper", "Blade", "Titan", "Phantom"
];

async function main() {
  console.log("\n================================================================================");
  console.log("🤖 [SIMULATOR 500 BOTS] KHỞI CHẠY GIẢ LẬP ĐẤU TRƯỜNG 500 BOT PYTHON (BOT_VS_BOT)");
  console.log("================================================================================\n");

  const tournamentId = "tour-bot-500";
  const contractId = "contract-001";

  // 1. Cập nhật giới hạn hợp đồng lên 1000 người/giải và 5000 người toàn hợp đồng
  console.log("📜 [1/7] Nâng trần kỹ thuật hợp đồng (Contract Technical Caps) cho giải đấu 500 thí sinh...");
  await prisma.tournamentContract.update({
    where: { id: contractId },
    data: {
      maxParticipantsPerTournament: 1000,
      maxParticipantsTotal: 5000,
      technicalCaps: {
        botMemoryLimitMb: 64,
        botSourceMaxBytes: 65536,
        botRuntimeTimeoutMs: 1000,
        rosterImportMaxRows: 2000,
        maxConcurrentMatchesPerTournament: 32,
      },
      allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
    },
  });
  console.log("  ✓ Hợp đồng contract-001: maxParticipantsPerTournament = 1000, maxConcurrentMatches = 32.");

  // 2. Tạo hoặc cập nhật Giải đấu 500 Bot
  console.log("\n🏆 [2/7] Khởi tạo giải đấu 500 Bot (tour-bot-500) với chế độ BOT_VS_BOT & Thể thức Swiss Adjacent...");
  
  // Lấy TA sở hữu
  const taUser = await prisma.user.findFirst({ where: { role: "TOURNAMENT_ADMIN" } });
  const ownerTaUserId = taUser?.id ?? "ta-001";

  const coreConfig = {
    tournamentCode: "BOT-ARENA-500",
    tournamentName: "Đại Chiến 500 Chiến Binh Bot Python (BOT_VS_BOT)",
    shortDescription: "Đấu trường lập trình cờ tự động quy mô lớn với 500 Bot Python nộp code tranh tài theo thuật toán Thụy Sĩ lân cận điểm (Swiss Score Adjacent).",
    organizersText: "Ban Chỉ Đạo Robot Lab - ĐHQG & Liên Minh Công Nghệ",
    competitionMode: "BOT_VS_BOT",
    audienceScope: "PUBLIC_COMMUNITY",
    allowedUnitCodes: [],
    registrationIntakeMode: "IMPORT_ONLY",
    maxParticipants: 500,
    minParticipantsToStart: 10,
    timezone: "Asia/Ho_Chi_Minh",
    registrationOpenAt: "2026-10-01T00:00:00.000Z",
    registrationCloseAt: "2026-10-24T17:00:00.000Z",
    checkinRequired: false,
    checkinOpenAt: null,
    checkinCloseAt: null,
    botDeadlineAt: "2026-10-24T18:00:00.000Z", // Đã chốt nộp code
    scheduledStartAt: "2026-10-24T18:30:00.000Z",
    scheduledEndAt: "2026-10-25T18:30:00.000Z",
    format: "ARENA_CONTINUOUS",
    pairingMethod: "SWISS_SCORE_ADJACENT",
    maxMatchesPerPlayer: null,
    maxPairMeetings: 2,
    rematchCooldownMinutes: 5,
    maxConcurrentMatches: 32,
    byeScorePoints: 10,
    spectatorPolicy: "PUBLIC_ANONYMOUS",
    chatPolicy: "SPECTATOR_MUTED",
    leaderboardVisibility: "LIVE_PUBLIC",
    topNExportCount: 50,
    finalizationMode: "AUTO_FINAL",
    scoringFormulaPreset: "ELO_WEIGHTED_V1",
    initialScore: 1000,
    initialElo: 1000,
    kFactor: 32,
    scoreFloor: 500,
  };

  const existingTour = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (existingTour) {
    // Xóa dữ liệu cũ của giải này để làm mới tinh
    await prisma.manualAdjudicationRequestRecord.deleteMany({ where: { tournamentId } });
    await prisma.tournamentScoreLedgerRecord.deleteMany({ where: { tournamentId } });
    await prisma.tournamentRulesAcknowledgement.deleteMany({ where: { tournamentId } });
    await prisma.tournamentConfigVersionRecord.deleteMany({ where: { tournamentId } });
    await prisma.tournamentEnrollmentRecord.deleteMany({ where: { tournamentId } });
    await prisma.tournamentStaffAssignmentRecord.deleteMany({ where: { tournamentId } });
    
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: "RUNNING",
        startedAt: new Date(Date.now() - 3 * 3600 * 1000), // Bắt đầu từ 3 tiếng trước
        coreConfig: coreConfig as any,
        activeConfigVersionId: `${tournamentId}-v1`,
        activeConfigVersionNumber: 1,
      },
    });
    console.log("  ✓ Đã cập nhật lại giải đấu tour-bot-500 sang trạng thái RUNNING.");
  } else {
    await prisma.tournament.create({
      data: {
        id: tournamentId,
        contractId,
        tournamentCode: "BOT-ARENA-500",
        unitId: "unit-dhqg",
        ownerTaUserId,
        status: "RUNNING",
        revision: 1,
        coreConfig: coreConfig as any,
        ruleProfile: {
          rulesVersion: "rps-v1",
          board: { rows: 9, cols: 9 },
          turnLimit: 120,
          turnTimeoutMs: 1000,
        } as any,
        activeConfigVersionId: `${tournamentId}-v1`,
        activeConfigVersionNumber: 1,
        startedAt: new Date(Date.now() - 3 * 3600 * 1000),
      },
    });
    console.log("  ✓ Đã tạo mới giải đấu tour-bot-500 với trạng thái RUNNING.");
  }

  // Tạo phiên bản cấu hình đã công bố (Config Version Record v1)
  const configVersionId = `${tournamentId}-v1`;
  await prisma.tournamentConfigVersionRecord.create({
    data: {
      id: configVersionId,
      tournamentId,
      versionNumber: 1,
      coreConfigSnapshot: coreConfig as any,
      ruleProfileSnapshot: { rulesVersion: "rps-v1" },
      effectiveAt: new Date(Date.now() - 4 * 3600 * 1000),
      publishedByUserId: ownerTaUserId,
      changeSummary: "Công bố cấu hình và điều lệ chính thức cho giải 500 Bot",
    },
  });
  console.log(`  ✓ Đã phát hành phiên bản cấu hình chính thức: ${configVersionId}.`);

  // 3. Phân công Trọng tài
  const adminUser = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (adminUser) {
    await prisma.tournamentStaffAssignmentRecord.create({
      data: {
        id: randomUUID(),
        tournamentId,
        userId: adminUser.id,
        role: "REFEREE",
        status: "ACTIVE",
      },
    });
    console.log(`  ✓ Phân công Trọng tài chính: ${adminUser.username} (${adminUser.displayName}).`);
  }

  // 4. Chuẩn bị 500 tài khoản người chơi nộp bot
  console.log("\n👥 [3/7] Sinh 500 tài khoản thí sinh và hồ sơ nộp code Bot...");
  const dummyPasswordHash = "$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6x8ecr2uG.XG6eI7d6mS"; // '123456'
  const dummyRecoveryHash = "$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6x8ecr2uG.XG6eI7d6mS";

  const userBatchData: any[] = [];
  const enrollmentBatchData: any[] = [];
  const ackBatchData: any[] = [];

  interface SimParticipant {
    index: number;
    enrollmentId: string;
    userId: string;
    personKey: string;
    botName: string;
    unitCode: string;
    elo: number;
    score: number;
    wins: number;
    losses: number;
    matchesPlayed: number;
    lastFinishedSeq: number;
    historyOpponents: Set<string>;
    displayName: string;
  }

  const participants: SimParticipant[] = [];

  for (let i = 1; i <= 500; i++) {
    const pad = String(i).padStart(3, "0");
    const userId = `user-bot-${pad}`;
    const enrollmentId = `enr-bot-${pad}`;
    const personKey = `BOT-${pad}`;
    const unit = UNIVERSITIES[(i - 1) % UNIVERSITIES.length]!;
    const prefix = BOT_NAME_PREFIXES[(i * 7) % BOT_NAME_PREFIXES.length];
    const suffix = BOT_NAME_SUFFIXES[(i * 11) % BOT_NAME_SUFFIXES.length];
    const botName = `${prefix}${suffix}-v${(i % 5) + 1}`;
    const displayName = `${botName} [${unit.code}]`;

    userBatchData.push({
      id: userId,
      fullName: `Tác giả lập trình ${botName}`,
      displayName,
      username: `bot_dev_${pad}`,
      usernameNormalized: `bot_dev_${pad}`,
      passwordHash: dummyPasswordHash,
      recoveryCodeHash: dummyRecoveryHash,
      role: "USER" as const,
    });

    const shaPrefix = createHash("sha256").update(`bot_code_${pad}`).digest("hex").slice(0, 12);

    enrollmentBatchData.push({
      id: enrollmentId,
      tournamentId,
      contractId,
      personKey,
      userId,
      displayName,
      unitCode: unit.code,
      email: `dev_${pad}@${unit.code.toLowerCase()}.edu.vn`,
      seedRating: 1000 + (500 - i), // Hạt giống giảm dần từ 1500 về 1000
      eligibilityStatus: "ELIGIBLE",
      pinnedBotRevisionId: `rev-wasi-${shaPrefix}`,
      botReadinessStatus: "READY", // Tất cả 500 bot đã qua Wasmtime Preflight & Sandbox Verification!
    });

    ackBatchData.push({
      id: randomUUID(),
      userId,
      contractId,
      tournamentId,
      configVersionId: `${tournamentId}-v1`,
      acknowledgedAt: new Date(Date.now() - 4 * 3600 * 1000),
    });

    participants.push({
      index: i,
      enrollmentId,
      userId,
      personKey,
      botName,
      unitCode: unit.code,
      displayName,
      elo: 1000,
      score: 1000,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      lastFinishedSeq: 0,
      historyOpponents: new Set<string>(),
    });
  }

  // Batch insert Users
  console.log("  + Đang ghi 500 tài khoản người chơi vào CSDL...");
  await prisma.user.createMany({
    data: userBatchData,
    skipDuplicates: true,
  });

  // Batch insert Enrollments
  console.log("  + Đang ghi 500 hồ sơ Bot đạt chuẩn READY vào CSDL...");
  await prisma.tournamentEnrollmentRecord.createMany({
    data: enrollmentBatchData,
    skipDuplicates: true,
  });

  // Batch insert Acknowledgements
  console.log("  + Đang xác nhận điều lệ thi đấu cho 500 thí sinh...");
  await prisma.tournamentRulesAcknowledgement.createMany({
    data: ackBatchData,
    skipDuplicates: true,
  });
  console.log("  ✓ Hoàn tất ghi danh và kiểm thử preflight cho 500 Bot.");

  // 5. Mô phỏng thuật toán Swiss Pairing cho 500 Bot qua 3 Vòng
  console.log("\n⚡ [4/7] Mô phỏng thuật toán Swiss Pairing lân cận điểm (SWISS_SCORE_ADJACENT) qua 3 Vòng...");
  let currentFinishSequence = 1;
  const ledgerBatchData: any[] = [];

  const RESOLUTIONS = ["DIRECT_WIN", "DIRECT_WIN", "DIRECT_WIN", "TIME_OUT", "STALEMATE"];

  function runSwissRound(roundNumber: number) {
    console.log(`\n  --- 🥊 VÒNG ${roundNumber}: 250 Trận đấu (500 Bot) ---`);

    // Sắp xếp bot theo Điểm giải đấu giảm dần, tiếp theo là Elo giảm dần (Swiss Score Brackets)
    participants.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.elo !== a.elo) return b.elo - a.elo;
      return a.personKey.localeCompare(b.personKey);
    });

    const paired = new Set<number>();
    const matchesInRound: Array<[SimParticipant, SimParticipant]> = [];

    for (let i = 0; i < participants.length; i++) {
      if (paired.has(i)) continue;
      const p1 = participants[i]!;

      // Tìm đối thủ thích hợp nhất: cùng bracket điểm, chưa từng gặp hoặc gặp <= maxPairMeetings
      let chosenIdx = -1;
      for (let j = i + 1; j < participants.length; j++) {
        if (paired.has(j)) continue;
        const p2 = participants[j]!;
        if (!p1.historyOpponents.has(p2.enrollmentId)) {
          chosenIdx = j;
          break;
        }
      }

      // Nếu tất cả đã từng gặp, chọn đối thủ lân cận nhất
      if (chosenIdx === -1) {
        for (let j = i + 1; j < participants.length; j++) {
          if (!paired.has(j)) {
            chosenIdx = j;
            break;
          }
        }
      }

      if (chosenIdx !== -1) {
        paired.add(i);
        paired.add(chosenIdx);
        matchesInRound.push([p1, participants[chosenIdx]!]);
      }
    }

    console.log(`    + Đã ghép thành công ${matchesInRound.length} cặp đấu.`);

    // Thực thi kết quả các trận
    for (const [blue, red] of matchesInRound) {
      blue.historyOpponents.add(red.enrollmentId);
      red.historyOpponents.add(blue.enrollmentId);

      // Bot có seed rating ban đầu cao hơn có xác suất thắng nhỉnh hơn
      const blueAdvantage = (500 - blue.index) - (500 - red.index);
      const blueWinChance = 0.5 + (blueAdvantage / 1500);
      const isBlueWin = Math.random() < Math.max(0.2, Math.min(0.8, blueWinChance));
      const winnerSide: "BLUE" | "RED" = isBlueWin ? "BLUE" : "RED";

      const step = computeEloWeightedStep({
        blueElo: blue.elo,
        redElo: red.elo,
        blueScore: blue.score,
        redScore: red.score,
        winnerSide,
        kFactor: 32,
        scoreFloor: 500,
      });

      const matchId = `match-500-r${roundNumber}-${String(currentFinishSequence).padStart(4, "0")}`;
      const resolutionSource = RESOLUTIONS[currentFinishSequence % RESOLUTIONS.length]!;

      ledgerBatchData.push({
        id: randomUUID(),
        tournamentId,
        matchId,
        finishSequence: currentFinishSequence,
        blueParticipantId: blue.userId,
        redParticipantId: red.userId,
        winnerSide,
        resolutionSource,
        blueEloBefore: blue.elo,
        blueEloAfter: step.blueEloAfter,
        blueScoreBefore: blue.score,
        blueScoreAfter: step.blueScoreAfter,
        redEloBefore: red.elo,
        redEloAfter: step.redEloAfter,
        redScoreBefore: red.score,
        redScoreAfter: step.redScoreAfter,
        finishedAt: new Date(Date.now() - (3 * 3600 - currentFinishSequence * 12) * 1000),
      });

      // Cập nhật trạng thái bot
      blue.elo = step.blueEloAfter;
      blue.score = step.blueScoreAfter;
      blue.matchesPlayed += 1;
      blue.lastFinishedSeq = currentFinishSequence;
      if (winnerSide === "BLUE") blue.wins += 1; else blue.losses += 1;

      red.elo = step.redEloAfter;
      red.score = step.redScoreAfter;
      red.matchesPlayed += 1;
      red.lastFinishedSeq = currentFinishSequence;
      if (winnerSide === "RED") red.wins += 1; else red.losses += 1;

      currentFinishSequence += 1;
    }
  }

  // Chạy 3 vòng đấu Thụy Sĩ (750 trận)
  runSwissRound(1);
  runSwissRound(2);
  runSwissRound(3);

  console.log(`\n💾 [5/7] Lưu toàn bộ ${ledgerBatchData.length} kết quả trận đấu vào Sổ cái tính điểm (Score Ledger)...`);
  await prisma.tournamentScoreLedgerRecord.createMany({
    data: ledgerBatchData,
    skipDuplicates: true,
  });
  console.log(`  ✓ Đã ghi nhận ${ledgerBatchData.length} trận đấu vào PostgreSQL.`);

  // 6. Tạo 1 trận đấu phán quyết hòa đặc biệt (P05) ở vòng tiếp theo
  console.log("\n⚖️ [6/7] Tạo 1 trận đấu Bot đỉnh cao hòa kịch tính chờ Trọng tài phán quyết (P05)...");
  // Lấy 2 bot đang dẫn đầu bảng xếp hạng
  participants.sort((a, b) => b.score - a.score || b.elo - a.elo);
  const top1 = participants[0]!;
  const top2 = participants[1]!;

  const sampleBoardCells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let side: "BLUE" | "RED" | null = null;
      let pieceType: "R" | "P" | "S" | null = null;
      if (r === 0 && c === 4) { side = "RED"; pieceType = "R"; }
      if (r === 2 && c === 2) { side = "RED"; pieceType = "P"; }
      if (r === 8 && c === 4) { side = "BLUE"; pieceType = "R"; }
      if (r === 6 && c === 6) { side = "BLUE"; pieceType = "P"; }
      sampleBoardCells.push({ row: r, column: c, side, pieceType });
    }
  }

  const frozenSnapshot = {
    ruleVersion: "1.0.0",
    ruleVersionNumber: 1,
    sideToMove: "BLUE",
    board: {
      rows: 9,
      columns: 9,
      cells: sampleBoardCells,
    },
    tieIndicators: {
      blue: {
        materialByType: { R: 1, P: 1, S: 0 },
        goalDistance: 3,
        mobility: 14,
      },
      red: {
        materialByType: { R: 1, P: 1, S: 0 },
        goalDistance: 3,
        mobility: 14,
      },
    },
  };

  const tieMatchId = `match-tie-500-final-01`;
  await prisma.manualAdjudicationRequestRecord.create({
    data: {
      id: randomUUID(),
      tournamentId,
      matchId: tieMatchId,
      roomId: `room-tie-500-top`,
      blueParticipantId: top1.userId,
      redParticipantId: top2.userId,
      status: "WAITING",
      frozenSnapshot: frozenSnapshot as any,
      deadlineAt: new Date(Date.now() + 6 * 3600 * 1000), // Còn 6 tiếng phán quyết
      fallbackPolicy: "BLUE_ADVANTAGE",
    },
  });
  console.log(`  ✓ Đã kích hoạt vụ phán quyết: ${top1.displayName} (Top 1) vs ${top2.displayName} (Top 2) tại P05!`);

  // 7. Thống kê và hiển thị Top 10
  console.log("\n📊 [7/7] THỐNG KÊ TOP 10 CHIẾN BINH BOT SAU 3 VÒNG (750 TRẬN ĐẤU):");
  console.log("--------------------------------------------------------------------------------");
  console.log("Hạng | Tên Bot & Đơn vị                    | Điểm   | Elo  | Thắng | Thua | Trận");
  console.log("--------------------------------------------------------------------------------");
  for (let rank = 1; rank <= 10; rank++) {
    const p = participants[rank - 1]!;
    const namePadded = p.displayName.padEnd(35, " ");
    const scorePadded = String(p.score).padStart(6, " ");
    const eloPadded = String(p.elo).padStart(4, " ");
    const winsPadded = String(p.wins).padStart(5, " ");
    const lossesPadded = String(p.losses).padStart(4, " ");
    const matchesPadded = String(p.matchesPlayed).padStart(4, " ");
    console.log(` #${String(rank).padStart(2, "0")}  | ${namePadded} | ${scorePadded} | ${eloPadded} | ${winsPadded} | ${lossesPadded} | ${matchesPadded}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`Tổng số Bot tham gia:       500`);
  console.log(`Tổng số trận đấu hoàn tất:  ${ledgerBatchData.length}`);
  console.log(`Số vòng Thụy Sĩ đã chạy:     3 vòng`);
  console.log(`Trận đấu đang chờ Trọng tài: 1 trận (Top 1 vs Top 2)`);
  console.log("================================================================================");
  console.log("\n🔗 TRUY CẬP TRÊN GIAO DIỆN WEB:");
  console.log(`1. Bảng xếp hạng 500 Bot (P04): http://localhost:3000/admin/tournaments/${tournamentId}`);
  console.log(`2. Danh sách 500 thí sinh (P03): http://localhost:3000/admin/tournaments/${tournamentId}/roster`);
  console.log(`3. Phán quyết hòa trận đỉnh cao (P05): http://localhost:3000/admin/tournaments/${tournamentId}/adjudications`);
  console.log(`4. Điều hành giải đấu (P06):    http://localhost:3000/admin/tournaments/${tournamentId}/operations`);
  console.log("================================================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi giả lập giải đấu 500 bot:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
