import { SystemInventorySchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/auth.service.js";
import type { InventoryService } from "./inventory.service.js";
import { assertDiagnosticsAdmin } from "./diagnostics-auth.js";

export async function registerInventoryRoute(
  app: FastifyInstance,
  inventoryService: InventoryService,
  auth: AuthService
): Promise<void> {
  app.get("/diagnostics/inventory", async (request, reply) => {
    await assertDiagnosticsAdmin(request, auth);
    const inventory = await inventoryService.getInventory();
    return reply.status(200).send(SystemInventorySchema.parse(inventory));
  });
}
