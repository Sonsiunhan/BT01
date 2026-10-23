import { describe, expect, it, vi } from "vitest";

import { RosterService } from "../../src/modules/roster/roster.service.js";

type Actor = { userId: string; role: string };

function createFixture() {
  const tournaments = new Map([
    ["tournament-a", { id: "tournament-a", contractId: "contract-a" }],
    ["tournament-b", { id: "tournament-b", contractId: "contract-b" }],
    ["tournament-c", { id: "tournament-c", contractId: "contract-c" }],
  ]);
  const contracts = new Map([
    ["contract-a", { id: "contract-a", status: "ACTIVE", validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31T23:59:59Z") }],
    ["contract-b", { id: "contract-b", status: "ACTIVE", validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31T23:59:59Z") }],
    ["contract-c", { id: "contract-c", status: "ACTIVE", validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31T23:59:59Z") }],
  ]);
  const bindings = [{ contractId: "contract-a", userId: "ta-a", status: "ACTIVE" }];
  const enrollments = [
    { id: "enrollment-a", tournamentId: "tournament-a", personKey: "UNIT_A:001", displayName: "A", unitCode: "UNIT_A" },
    { id: "enrollment-b", tournamentId: "tournament-b", personKey: "UNIT_B:001", displayName: "B", unitCode: "UNIT_B" },
    { id: "enrollment-c", tournamentId: "tournament-c", personKey: "UNIT_C:001", displayName: "C", unitCode: "UNIT_C" },
  ];
  const db = {
    tournament: {
      findUnique: vi.fn(async ({ where }: any) => tournaments.get(where.id) ?? null),
    },
    tournamentContractTaBinding: {
      findFirst: vi.fn(async ({ where }: any) => bindings.find((binding) =>
        binding.contractId === where.contractId &&
        binding.userId === where.userId &&
        binding.status === where.status,
      ) ?? null),
    },
    tournamentContract: {
      findUnique: vi.fn(async ({ where }: any) => contracts.get(where.id) ?? null),
    },
    tournamentEnrollmentRecord: {
      findMany: vi.fn(async ({ where }: any) => enrollments.filter((row) => row.tournamentId === where.tournamentId)),
    },
  } as any;

  return { db, enrollments };
}

async function list(service: RosterService, tournamentId: string, actor: Actor) {
  return (service.listEnrollments as unknown as (id: string, principal: Actor) => Promise<unknown>)(tournamentId, actor);
}

describe("D13-A / D12-F01 — roster authorization", () => {
  it("allows a bound Tournament Admin to read only the bound tournament", async () => {
    const fixture = createFixture();
    const service = new RosterService(fixture.db);

    await expect(list(service, "tournament-a", { userId: "ta-a", role: "TOURNAMENT_ADMIN" }))
      .resolves.toEqual([fixture.enrollments[0]]);
    await expect(list(service, "tournament-b", { userId: "ta-a", role: "TOURNAMENT_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(list(service, "tournament-c", { userId: "ta-a", role: "TOURNAMENT_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([
    ["normal participant", { userId: "player-a", role: "PLAYER" }],
    ["referee", { userId: "referee-a", role: "REFEREE" }],
    ["staff", { userId: "staff-a", role: "STAFF" }],
    ["guest", { userId: "guest-a", role: "GUEST" }],
    ["unbound Tournament Admin", { userId: "ta-unbound", role: "TOURNAMENT_ADMIN" }],
  ] as Array<[string, Actor]>)("%s cannot read administrative roster data", async (_label, actor) => {
      const fixture = createFixture();
      const service = new RosterService(fixture.db);

      await expect(list(service, "tournament-a", actor)).rejects.toMatchObject({ statusCode: 403 });
    });

  it("allows SYSTEM_ADMIN and rejects nonexistent or malformed IDs without enrollment data", async () => {
    const fixture = createFixture();
    const service = new RosterService(fixture.db);

    await expect(list(service, "tournament-a", { userId: "system", role: "SYSTEM_ADMIN" }))
      .resolves.toEqual([fixture.enrollments[0]]);
    await expect(list(service, "does-not-exist", { userId: "system", role: "SYSTEM_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(list(service, "%%%", { userId: "system", role: "SYSTEM_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it("performs no mutation when a foreign roster read is denied", async () => {
    const fixture = createFixture();
    const service = new RosterService(fixture.db);

    await expect(list(service, "tournament-b", { userId: "ta-a", role: "TOURNAMENT_ADMIN" }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(fixture.db.tournamentEnrollmentRecord.findMany).not.toHaveBeenCalled();
    expect(fixture.db).not.toHaveProperty("commandLedgerEntry");
  });
});
