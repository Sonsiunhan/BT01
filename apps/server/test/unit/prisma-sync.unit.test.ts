import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { syncPrismaToTournamentStore } from "../../src/modules/tournament-foundation/prisma-sync.js";
import { TournamentStateStore } from "../../src/modules/tournament-foundation/tournament-store.js";

function createMockPrismaClient(overrides: Record<string, unknown> = {}): PrismaClient {
  const findManyEmpty = vi.fn(async () => []);
  return {
    unit: { findMany: findManyEmpty },
    tournamentContract: { findMany: findManyEmpty },
    tournament: { findMany: findManyEmpty },
    manualAdjudicationRequestRecord: { findMany: findManyEmpty },
    tournamentScoreLedgerRecord: { findMany: findManyEmpty },
    tournamentEnrollmentRecord: { findMany: findManyEmpty },
    tournamentStaffAssignmentRecord: { findMany: findManyEmpty },
    tournamentConfigVersionRecord: { findMany: findManyEmpty },
    tournamentChangeRequestRecord: { findMany: findManyEmpty },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("Tournament foundation — syncPrismaToTournamentStore hydration", () => {
  it("hydrates without error when PostgreSQL returns no rows and reports zero counts", async () => {
    const store = new TournamentStateStore();
    const result = await syncPrismaToTournamentStore(createMockPrismaClient(), store);

    expect(result).toEqual({ unitsCount: 0, contractsCount: 0, tournamentsCount: 0 });
    expect(store.units.size).toBe(0);
    expect(store.contracts.size).toBe(0);
    expect(store.tournaments.size).toBe(0);
  });

  it("propagates hydration failures instead of booting with an empty authoritative store", async () => {
    const store = new TournamentStateStore();
    const prisma = createMockPrismaClient({
      unit: {
        findMany: vi.fn(async () => {
          throw new Error("P1001: Can't reach the database server");
        }),
      },
    });

    const outcome = syncPrismaToTournamentStore(prisma, store);
    await expect(outcome).rejects.toThrow(
      "Không thể nạp dữ liệu giải đấu từ PostgreSQL khi khởi động: P1001: Can't reach the database server"
    );

    const error = await outcome.catch((e: unknown) => e as Error & { cause?: unknown });
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).message).toContain("P1001");
  });

  it("propagates failures raised by a later hydration query (tournaments), not only the first one", async () => {
    const store = new TournamentStateStore();
    const prisma = createMockPrismaClient({
      tournament: {
        findMany: vi.fn(async () => {
          throw new Error("connection terminated unexpectedly");
        }),
      },
    });

    await expect(syncPrismaToTournamentStore(prisma, store)).rejects.toThrow(
      "Không thể nạp dữ liệu giải đấu từ PostgreSQL khi khởi động"
    );
  });
});
