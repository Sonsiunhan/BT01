import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";
import type { MetricRoute, MetricsSnapshot, ResourceMetrics } from "@ottv2/contracts";

type Sample = { durationMs: number; statusCode: number };

const MAX_SAMPLES_PER_ROUTE = 200;
const MAX_ROUTES = 100;

export function normalizeRoutePath(rawPath: string): string {
  if (!rawPath || rawPath === "/") return "/";
  const withoutQuery = rawPath.split("?", 1)[0] ?? "/";
  return withoutQuery
    .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "/:id")
    .replace(/\/(?:match|room|user|usr|bot|cmd)-[a-zA-Z0-9_-]+/g, "/:id")
    .replace(/\/[0-9]{4,}/g, "/:id");
}

function percentile(samples: readonly Sample[], fraction: number): number {
  if (samples.length === 0) return 0;
  const sorted = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
}

export class MetricsRegistry {
  private readonly startedAt = Date.now();
  private readonly routes = new Map<string, Sample[]>();
  private requests = 0;
  private errors = 0;
  private activeStreams = 0;
  private fanoutEvents = 0;
  private fanoutBytes = 0;
  private bytesTransferred = 0;
  private eventLoopMonitor?: IntervalHistogram;

  constructor() {
    try {
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
      this.eventLoopMonitor.enable();
    } catch {
      // Event loop delay monitor fallback gracefully on unsupported environments
    }
  }

  observeHttp(method: string, path: string, statusCode: number, durationMs: number, bytes = 0): void {
    this.requests += 1;
    if (statusCode >= 400) this.errors += 1;
    if (bytes > 0) this.bytesTransferred += bytes;

    const normalizedPath = normalizeRoutePath(path);
    let key = `${method.toUpperCase()} ${normalizedPath}`;

    // Enforce finite cardinality: if capacity reached, aggregate unknown into OTHER
    if (this.routes.size >= MAX_ROUTES && !this.routes.has(key)) {
      key = "OTHER /*";
    }

    const samples = this.routes.get(key) ?? [];
    samples.push({ durationMs: Math.max(0, durationMs), statusCode });
    if (samples.length > MAX_SAMPLES_PER_ROUTE) {
      samples.splice(0, samples.length - MAX_SAMPLES_PER_ROUTE);
    }
    this.routes.set(key, samples);
  }

  recordBytesTransferred(bytes: number): void {
    if (bytes > 0) this.bytesTransferred += bytes;
  }

  streamOpened(): void {
    this.activeStreams += 1;
  }

  streamClosed(): void {
    this.activeStreams = Math.max(0, this.activeStreams - 1);
  }

  recordFanout(eventCount = 1, bytes = 0): void {
    const validCount = Math.max(0, Math.round(eventCount));
    this.fanoutEvents += validCount;
    if (bytes > 0) {
      this.fanoutBytes += bytes;
      this.bytesTransferred += bytes;
    }
  }

  getEventLoopLagMs(): number {
    if (!this.eventLoopMonitor) return 0;
    const meanNs = this.eventLoopMonitor.mean;
    return Number.isFinite(meanNs) ? Number((meanNs / 1e6).toFixed(2)) : 0;
  }

  snapshot(): MetricsSnapshot {
    const routes: MetricRoute[] = [...this.routes.entries()]
      .map(([key, samples]) => {
        const [method, ...pathParts] = key.split(" ");
        const averageMs =
          samples.length === 0
            ? 0
            : samples.reduce((sum, sample) => sum + sample.durationMs, 0) / samples.length;
        return {
          method: method ?? "UNKNOWN",
          path: pathParts.join(" ") || "/",
          count: samples.length,
          errorCount: samples.filter((sample) => sample.statusCode >= 400).length,
          averageMs: Number(averageMs.toFixed(2)),
          p50Ms: Number(percentile(samples, 0.50).toFixed(2)),
          p90Ms: Number(percentile(samples, 0.90).toFixed(2)),
          p95Ms: Number(percentile(samples, 0.95).toFixed(2)),
          p99Ms: Number(percentile(samples, 0.99).toFixed(2)),
        };
      })
      .sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));

    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const lagMs = this.getEventLoopLagMs();

    const resources: ResourceMetrics = {
      cpuUserUs: cpu.user,
      cpuSystemUs: cpu.system,
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      eventLoopLagMs: Math.max(0, lagMs),
    };

    const averageBytesPerEvent =
      this.fanoutEvents > 0 ? Number((this.fanoutBytes / this.fanoutEvents).toFixed(2)) : 0;

    return {
      uptimeSeconds: Math.max(0, (Date.now() - this.startedAt) / 1000),
      requestCount: this.requests,
      errorCount: this.errors,
      activeStreams: this.activeStreams,
      fanoutEvents: this.fanoutEvents,
      bytesTransferred: this.bytesTransferred,
      fanoutBytes: this.fanoutBytes,
      averageBytesPerEvent,
      resources,
      routes,
    };
  }
}
