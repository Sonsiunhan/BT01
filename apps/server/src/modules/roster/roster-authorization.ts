import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../shared/errors/app-error.js";

export type RosterActor = {
  userId: string;
  role: string;
};

/**
 * Authorize a roster operation against the authoritative contract binding.
 * This is shared by roster reads and activation operations so their
 * Tournament Admin permission rules cannot drift apart.
 */
export async function assertActorScopeForContract(
  db: PrismaClient,
  actor: RosterActor,
  contractId: string,
): Promise<void> {
  if (actor.role === "SYSTEM_ADMIN" || actor.role === "ADMIN") return;

  if (actor.role !== "TOURNAMENT_ADMIN") {
    throw new AppError(
      "UNAUTHORIZED",
      "Chỉ quản trị hệ thống hoặc quản trị giải đấu được phép thực hiện thao tác này.",
      403,
      false,
      "INVALID",
    );
  }

  const now = new Date();
  const binding = await db.tournamentContractTaBinding.findFirst({
    where: {
      contractId,
      userId: actor.userId,
      status: "ACTIVE",
    },
  });

  if (!binding) {
    throw new AppError(
      "UNAUTHORIZED",
      "Bạn không có quyền truy cập hợp đồng này.",
      403,
      false,
      "INVALID",
      { reason: "OUT_OF_SCOPE" },
    );
  }

  const contract = await db.tournamentContract.findUnique({
    where: { id: contractId },
    select: { status: true, validFrom: true, validTo: true },
  });

  if (!contract || contract.status !== "ACTIVE" || contract.validFrom > now || contract.validTo < now) {
    throw new AppError(
      "UNAUTHORIZED",
      "Hợp đồng không còn hiệu lực.",
      403,
      false,
      "INVALID",
      { reason: "CONTRACT_INACTIVE" },
    );
  }
}
