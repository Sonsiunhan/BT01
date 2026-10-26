import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const targetTournamentId = process.argv[2] ?? "tour-001";
  console.log(`\n🚀 [SIMULATOR] Bắt đầu giả lập giải đấu: ${targetTournamentId}...`);

  // 1. Kiểm tra giải đấu
  const tournament = await prisma.tournament.findUnique({
    where: { id: targetTournamentId },
    include: { contract: true },
  });

  if (!tournament) {
    console.error(`❌ Không tìm thấy giải đấu có ID: ${targetTournamentId}`);
    process.exit(1);
  }

  console.log(`✓ Đã tìm thấy giải đấu: "${(tournament.coreConfig as any)?.tournamentName ?? tournament.tournamentCode}" (Trạng thái hiện tại: ${tournament.status})`);

  // 2. Lấy danh sách tài khoản người chơi mẫu
  const players = await prisma.user.findMany({
    where: { username: { in: ["player_1", "player_2", "player_3", "player_4"] } },
    select: { id: true, username: true, displayName: true },
  });

  if (players.length < 4) {
    console.error("❌ Không đủ 4 tài khoản người chơi mẫu (player_1..player_4).");
    process.exit(1);
  }

  const p1 = players.find((p) => p.username === "player_1")!;
  const p2 = players.find((p) => p.username === "player_2")!;
  const p3 = players.find((p) => p.username === "player_3")!;
  const p4 = players.find((p) => p.username === "player_4")!;

  // 3. Ghi danh 4 thí sinh vào giải đấu nếu chưa có
  console.log("📋 [1/5] Đang ghi danh thí sinh vào giải...");
  const participantMap = new Map<string, string>(); // username -> enrollmentId

  for (const p of [p1, p2, p3, p4]) {
    let enr = await prisma.tournamentEnrollmentRecord.findFirst({
      where: { tournamentId: targetTournamentId, userId: p.id },
    });
    if (!enr) {
      enr = await prisma.tournamentEnrollmentRecord.create({
        data: {
          id: randomUUID(),
          tournamentId: targetTournamentId,
          contractId: tournament.contractId,
          personKey: `SV-${p.username.toUpperCase()}`,
          userId: p.id,
          displayName: p.displayName || p.username,
          unitCode: "DHQG",
          email: `${p.username}@vnu.edu.vn`,
          eligibilityStatus: "ELIGIBLE",
          seedRating: 1000,
        },
      });
      console.log(`  + Đã ghi danh thí sinh: ${p.username} (Mã thí sinh: ${enr.id})`);
    } else {
      console.log(`  = Thí sinh ${p.username} đã được ghi danh từ trước (Mã thí sinh: ${enr.id})`);
    }
    participantMap.set(p.username, enr.id);

    // Xác nhận điều lệ nếu chưa có
    const versionId = tournament.activeConfigVersionId ?? `${targetTournamentId}-v1`;
    const ack = await prisma.tournamentRulesAcknowledgement.findFirst({
      where: { tournamentId: targetTournamentId, userId: p.id },
    });
    if (!ack) {
      await prisma.tournamentRulesAcknowledgement.create({
        data: {
          id: randomUUID(),
          userId: p.id,
          contractId: tournament.contractId,
          tournamentId: targetTournamentId,
          configVersionId: versionId,
          acknowledgedAt: new Date(),
        },
      });
    }
  }

  // 4. Phân công Trọng tài điều hành
  console.log("⚖️ [2/5] Đang thiết lập Trọng tài điều hành giải...");
  const adminUser = await prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } });
  if (adminUser) {
    const existingStaff = await prisma.tournamentStaffAssignmentRecord.findFirst({
      where: { tournamentId: targetTournamentId, role: "REFEREE" },
    });
    if (!existingStaff) {
      await prisma.tournamentStaffAssignmentRecord.create({
        data: {
          id: randomUUID(),
          tournamentId: targetTournamentId,
          userId: adminUser.id,
          role: "REFEREE",
          status: "ACTIVE",
          assignedAt: new Date(),
        },
      });
      console.log(`  + Đã phân công ${adminUser.username} làm Trọng tài chính (ACTIVE).`);
    }
  }

  // 5. Cập nhật giải đấu sang trạng thái RUNNING
  console.log("🏁 [3/5] Kích hoạt trạng thái giải đấu: RUNNING...");
  await prisma.tournament.update({
    where: { id: targetTournamentId },
    data: {
      status: "RUNNING",
      startedAt: tournament.startedAt ?? new Date(),
    },
  });

  // 6. Tạo kết quả các trận đấu đã xong vào Sổ cái tính điểm (Score Ledger)
  console.log("⚔️ [4/5] Giả lập diễn biến các trận đấu vòng 1...");
  const enr1 = participantMap.get("player_1")!;
  const enr2 = participantMap.get("player_2")!;
  const enr3 = participantMap.get("player_3")!;
  const enr4 = participantMap.get("player_4")!;

  const match1Id = `match-sim-${targetTournamentId}-01`;
  const match2Id = `match-sim-${targetTournamentId}-02`;

  const existingM1 = await prisma.tournamentScoreLedgerRecord.findUnique({
    where: { matchId: match1Id },
  });
  if (!existingM1) {
    await prisma.tournamentScoreLedgerRecord.create({
      data: {
        id: randomUUID(),
        tournamentId: targetTournamentId,
        matchId: match1Id,
        finishSequence: 1,
        blueParticipantId: enr1,
        redParticipantId: enr2,
        winnerSide: "BLUE",
        resolutionSource: "DIRECT_WIN",
        blueEloBefore: 1000,
        blueEloAfter: 1016,
        blueScoreBefore: 1000,
        blueScoreAfter: 1041,
        redEloBefore: 1000,
        redEloAfter: 984,
        redScoreBefore: 1000,
        redScoreAfter: 992,
        finishedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });
    console.log("  + Trận 1: player_1 (Xanh) thắng player_2 (Đỏ) -> player_1: 1041đ (Elo 1016), player_2: 992đ (Elo 984)");
  }

  const existingM2 = await prisma.tournamentScoreLedgerRecord.findUnique({
    where: { matchId: match2Id },
  });
  if (!existingM2) {
    await prisma.tournamentScoreLedgerRecord.create({
      data: {
        id: randomUUID(),
        tournamentId: targetTournamentId,
        matchId: match2Id,
        finishSequence: 2,
        blueParticipantId: enr3,
        redParticipantId: enr4,
        winnerSide: "RED",
        resolutionSource: "DIRECT_WIN",
        blueEloBefore: 1000,
        blueEloAfter: 984,
        blueScoreBefore: 1000,
        blueScoreAfter: 992,
        redEloBefore: 1000,
        redEloAfter: 1016,
        redScoreBefore: 1000,
        redScoreAfter: 1041,
        finishedAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });
    console.log("  + Trận 2: player_4 (Đỏ) thắng player_3 (Xanh) -> player_4: 1041đ (Elo 1016), player_3: 992đ (Elo 984)");
  }

  // 7. Tạo trận đấu hòa kịch tính cần Trọng tài phán quyết (P05)
  console.log("⚖️ [5/5] Tạo trận đấu hòa chỉ số đang chờ Trọng tài phán quyết (P05)...");
  const tieMatchId = `match-tie-${targetTournamentId}-03`;
  const existingAdj = await prisma.manualAdjudicationRequestRecord.findUnique({
    where: { matchId: tieMatchId },
  });

  if (!existingAdj) {
    const sampleBoardCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        let side: "BLUE" | "RED" | null = null;
        let pieceType: "R" | "P" | "S" | null = null;
        if (r === 0 && c === 4) { side = "RED"; pieceType = "R"; }
        if (r === 1 && c === 3) { side = "RED"; pieceType = "P"; }
        if (r === 1 && c === 5) { side = "RED"; pieceType = "S"; }
        if (r === 8 && c === 4) { side = "BLUE"; pieceType = "R"; }
        if (r === 7 && c === 3) { side = "BLUE"; pieceType = "P"; }
        if (r === 7 && c === 5) { side = "BLUE"; pieceType = "S"; }
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
          materialByType: { R: 1, P: 1, S: 1 },
          goalDistance: 4,
          mobility: 12,
        },
        red: {
          materialByType: { R: 1, P: 1, S: 1 },
          goalDistance: 4,
          mobility: 12,
        },
      },
    };

    const adj = await prisma.manualAdjudicationRequestRecord.create({
      data: {
        id: randomUUID(),
        tournamentId: targetTournamentId,
        matchId: tieMatchId,
        roomId: `room-tie-${targetTournamentId}`,
        blueParticipantId: enr1,
        redParticipantId: enr4,
        status: "WAITING",
        frozenSnapshot: frozenSnapshot as any,
        deadlineAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // Còn 4 tiếng
        fallbackPolicy: "BLUE_ADVANTAGE",
      },
    });
    console.log(`  + Đã tạo yêu cầu phán quyết hòa thủ công: ${adj.id} (Trận đấu: player_1 vs player_4)`);
  } else {
    console.log(`  = Yêu cầu phán quyết hòa đã tồn tại (ID: ${existingAdj.id})`);
  }

  console.log("\n==================================================================");
  console.log("🎉 GIẢ LẬP GIẢI ĐẤU HOÀN TẤT THÀNH CÔNG!");
  console.log("==================================================================");
  console.log(`1. Xem Chi tiết & Bảng xếp hạng: http://localhost:3000/admin/tournaments/${targetTournamentId}`);
  console.log(`2. Xem Danh sách thí sinh:        http://localhost:3000/admin/tournaments/${targetTournamentId}/roster`);
  console.log(`3. Thao tác Phán quyết hòa (P05): http://localhost:3000/admin/tournaments/${targetTournamentId}/adjudications`);
  console.log(`4. Điều hành sự cố giải đấu:     http://localhost:3000/admin/tournaments/${targetTournamentId}/operations`);
  console.log("==================================================================\n");
}

main()
  .catch((e) => {
    console.error("Lỗi khi giả lập giải đấu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
