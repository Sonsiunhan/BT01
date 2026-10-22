import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { RosterService } from "../../src/modules/roster/roster.service.js";
import Fastify from "fastify";
import { registerRosterRoutes } from "../../src/modules/roster/roster.route.js";
import type { AuthService } from "../../src/modules/auth/auth.service.js";

const csv = Buffer.from("unit_code,student_or_member_id,full_name,username\nFOREIGN,001,Nguyen A,user_a");

describe("D03 integration safety", () => {
  it("does not let a caller increase the canonical row cap", async () => {
    const result = await new RosterService().previewRoster(csv, "test.csv", { maxRows: 999999 });
    expect(result.batchCapacity).toBe(2000);
  });

  it("an explicit empty unit scope permits no units", async () => {
    const result = await new RosterService().previewRoster(csv, "test.csv", { allowedUnits: [] });
    expect(result.validRows).toBe(0);
  });

  it("fails closed when the database unit lookup fails", async () => {
    const db = { unit: { findMany: vi.fn().mockRejectedValue(new Error("offline")) } };
    await expect(new RosterService(db as unknown as PrismaClient).previewRoster(csv, "test.csv"))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it("scopes a TA lookup to active persisted contract bindings", async () => {
    const findMany = vi.fn().mockResolvedValue([{ unitCode: "OWN" }]);
    const service = new RosterService({ unit: { findMany } } as unknown as PrismaClient);
    expect(await service.readAllowedUnits("ta-1", "TOURNAMENT_ADMIN")).toEqual(["OWN"]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      status: "ACTIVE", contracts: { some: expect.objectContaining({
        status: "ACTIVE", taBindings: { some: { userId: "ta-1", status: "ACTIVE" } },
      }) },
    }) }));
  });

  it("HTTP input cannot grant a foreign unit or an increased batch cap", async () => {
    const app = Fastify();
    const service = new RosterService();
    vi.spyOn(service, "readAllowedUnits").mockResolvedValue(["OWN"]);
    const auth = { authenticate: vi.fn().mockResolvedValue({ principal: "ACCOUNT", user: { id: "ta-1", role: "TOURNAMENT_ADMIN" } }) } as unknown as AuthService;
    await registerRosterRoutes(app, auth, service);
    try {
      const response = await app.inject({ method: "POST", url: "/admin/roster/preview", payload: {
        fileName: "test.csv", fileContent: csv.toString(), allowedUnits: ["FOREIGN"], maxRows: 999999,
      } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ validRows: 0, batchCapacity: 2000 });
      expect(service.readAllowedUnits).toHaveBeenCalledWith("ta-1", "TOURNAMENT_ADMIN");
    } finally { await app.close(); }
  });
});
