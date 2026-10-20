import { SystemInventorySchema } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";
import type { InventoryService } from "./inventory.service.js";

export async function registerInventoryRoute(
  app: FastifyInstance,
  inventoryService: InventoryService
): Promise<void> {
  app.get("/diagnostics/inventory", async (_request, reply) => {
    const inventory = await inventoryService.getInventory();
    return reply.status(200).send(SystemInventorySchema.parse(inventory));
  });
}
