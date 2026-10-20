import { z } from "zod";

export const ComponentReadinessSchema = z.object({
  status: z.enum(["ok", "degraded", "unavailable"]),
  owner: z.string().min(1),
  latencyMs: z.number().nonnegative().optional(),
  details: z.string().optional(),
});
export type ComponentReadiness = z.infer<typeof ComponentReadinessSchema>;

export const SystemInventorySchema = z.object({
  service: z.literal("ottv2-server"),
  nodeVersion: z.string().min(1),
  platform: z.string().min(1),
  arch: z.string().min(1),
  packageVersion: z.string().min(1),
  protocolVersion: z.string().min(1),
  startedAt: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  environmentKeys: z.array(z.string()),
  components: z.record(z.string(), ComponentReadinessSchema),
  build: z.object({
    gitCommit: z.string().optional(),
    buildTime: z.string().optional(),
  }).optional(),
});
export type SystemInventory = z.infer<typeof SystemInventorySchema>;
