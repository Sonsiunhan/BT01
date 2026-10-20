import { z } from "zod";

export const MetricRouteSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  count: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  averageMs: z.number().nonnegative(),
  p50Ms: z.number().nonnegative().optional(),
  p90Ms: z.number().nonnegative().optional(),
  p95Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative().optional(),
});

export const ResourceMetricsSchema = z.object({
  cpuUserUs: z.number().nonnegative().optional(),
  cpuSystemUs: z.number().nonnegative().optional(),
  rssBytes: z.number().nonnegative(),
  heapUsedBytes: z.number().nonnegative(),
  heapTotalBytes: z.number().nonnegative(),
  externalBytes: z.number().nonnegative(),
  eventLoopLagMs: z.number().nonnegative(),
});
export type ResourceMetrics = z.infer<typeof ResourceMetricsSchema>;

export const MetricsSnapshotSchema = z.object({
  uptimeSeconds: z.number().nonnegative(),
  requestCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  activeStreams: z.number().int().nonnegative(),
  fanoutEvents: z.number().int().nonnegative(),
  bytesTransferred: z.number().nonnegative().optional(),
  fanoutBytes: z.number().nonnegative().optional(),
  averageBytesPerEvent: z.number().nonnegative().optional(),
  resources: ResourceMetricsSchema.optional(),
  routes: z.array(MetricRouteSchema),
});

export type MetricRoute = z.infer<typeof MetricRouteSchema>;
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;
