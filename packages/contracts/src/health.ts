import { z } from "zod";

import { ProtocolVersionSchema } from "./version.js";

export const ServiceStatusSchema = z.enum(["ok", "degraded"]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const HealthComponentSchema = z.object({
  status: ServiceStatusSchema,
  reason: z.string().min(1).optional(),
  latencyMs: z.number().nonnegative().optional()
});

export const ComponentHealthResponseSchema = z.object({
  status: ServiceStatusSchema,
  component: z.enum(["application", "database", "transport", "bot"]),
  service: z.literal("ottv2-server"),
  timestamp: z.string().datetime(),
  details: HealthComponentSchema,
});
export type ComponentHealthResponse = z.infer<typeof ComponentHealthResponseSchema>;

export const HealthResponseSchema = z.object({
  status: ServiceStatusSchema,
  service: z.literal("ottv2-server"),
  version: z.string().min(1),
  protocolVersion: ProtocolVersionSchema,
  timestamp: z.string().datetime(),
  components: z.object({
    application: HealthComponentSchema,
    database: HealthComponentSchema,
    realtime: HealthComponentSchema,
    transport: HealthComponentSchema.optional(),
    bot: HealthComponentSchema.optional(),
  }),
});

export type HealthComponent = z.infer<typeof HealthComponentSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
