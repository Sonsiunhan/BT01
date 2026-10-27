import { PrismaClient } from "@prisma/client";
import { hashSecret, createRecoveryCode, verifySecret } from "../apps/server/src/modules/auth/auth.crypto.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 [SEED] Bắt đầu khởi tạo dữ liệu sạch trên main...");

  // 1. Xóa toàn bộ dữ liệu người dùng cũ nếu có
  await prisma.session.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.userStats.deleteMany({});
  await prisma.tournamentRulesAcknowledgement.deleteMany({});
  await prisma.tournamentStaffAssignmentRecord.deleteMany({});
  await prisma.tournamentStaffInvitation.deleteMany({});
  await prisma.supportRecoveryTicket.deleteMany({});
  await prisma.friendRequest.deleteMany({});
  await prisma.friendship.deleteMany({});
  await prisma.block.deleteMany({});
  await prisma.guestHistoryImport.deleteMany({});
  await prisma.botLibrary.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🧹 Đã làm sạch toàn bộ dữ liệu người dùng và các liên kết.");

  // 2. Tạo tài khoản SA duy nhất
  const username = "sa_local";
  const password = "sa123@";
  const passwordHash = await hashSecret(password);
  const recoveryCode = createRecoveryCode();
  const recoveryCodeHash = await hashSecret(recoveryCode);

  const saUser = await prisma.user.create({
    data: {
      username,
      usernameNormalized: username.toLowerCase(),
      fullName: "System Admin",
      displayName: "System Admin",
      role: "SYSTEM_ADMIN",
      passwordHash,
      recoveryCodeHash,
      profile: {
        create: {
          theme: "system",
          avatarPreset: "robot",
          presenceVisibility: "FRIENDS",
          friendListVisibility: "PRIVATE",
          fullNameVisibility: "PRIVATE",
        },
      },
      stats: {
        create: {
          elo: 1000,
          rankedWins: 0,
          rankedLosses: 0,
          quickWins: 0,
          quickLosses: 0,
        },
      },
    },
    include: {
      profile: true,
      stats: true,
    },
  });

  // 3. Kiểm tra tính hợp lệ của mật khẩu
  const isValid = await verifySecret(password, saUser.passwordHash);
  if (!isValid) {
    throw new Error("Lỗi xác thực mật khẩu SA vừa tạo!");
  }

  console.log("✅ Tạo tài khoản SA thành công:");
  console.log(`   - Username: ${saUser.username}`);
  console.log(`   - Password: ${password}`);
  console.log(`   - Role: ${saUser.role}`);
  console.log(`   - ID: ${saUser.id}`);
  console.log(`   - Recovery Code: ${recoveryCode}`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi khởi tạo tài khoản SA:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
