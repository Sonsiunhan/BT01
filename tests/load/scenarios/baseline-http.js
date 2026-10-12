import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const healthDuration = new Trend("health_req_duration", true);
const diagnosticsDuration = new Trend("diagnostics_req_duration", true);
const successfulChecks = new Rate("successful_checks");
const requestsTotal = new Counter("requests_total");

export const options = {
  vus: Number(__ENV.VUS) || 5,
  duration: __ENV.DURATION || "5s",
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<1000"],
    successful_checks: ["rate>0.95"],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3001";
  const params = {
    headers: {
      "Accept": "application/json",
      "X-OTT-Request": `k6-baseline-${__VU}-${__ITER}`,
    },
  };

  // 1. Consolidated Health
  const resHealth = http.get(`${baseUrl}/health`, params);
  requestsTotal.add(1);
  healthDuration.add(resHealth.timings.duration);
  const okHealth = check(resHealth, {
    "health status 200": (r) => r.status === 200,
    "health has service": (r) => r.json("service") === "ottv2-server",
  });
  successfulChecks.add(okHealth ? 1 : 0);

  // 2. Segregated App Health
  const resApp = http.get(`${baseUrl}/health/app`, params);
  requestsTotal.add(1);
  const okApp = check(resApp, {
    "health/app status 200": (r) => r.status === 200,
    "health/app component is application": (r) => r.json("component") === "application",
  });
  successfulChecks.add(okApp ? 1 : 0);

  // 3. Segregated DB Readiness
  const resDb = http.get(`${baseUrl}/health/db`, params);
  requestsTotal.add(1);
  const okDb = check(resDb, {
    "health/db status 200 or 503": (r) => r.status === 200 || r.status === 503,
    "health/db component is database": (r) => r.json("component") === "database",
  });
  successfulChecks.add(okDb ? 1 : 0);

  // 4. Diagnostics Metrics
  const resMetrics = http.get(`${baseUrl}/diagnostics/metrics`, params);
  requestsTotal.add(1);
  diagnosticsDuration.add(resMetrics.timings.duration);
  const okMetrics = check(resMetrics, {
    "metrics status 200": (r) => r.status === 200,
    "metrics has requestCount": (r) => typeof r.json("requestCount") === "number",
  });
  successfulChecks.add(okMetrics ? 1 : 0);

  // 5. Diagnostics Inventory
  const resInventory = http.get(`${baseUrl}/diagnostics/inventory`, params);
  requestsTotal.add(1);
  diagnosticsDuration.add(resInventory.timings.duration);
  const okInventory = check(resInventory, {
    "inventory status 200": (r) => r.status === 200,
    "inventory has nodeVersion": (r) => typeof r.json("nodeVersion") === "string",
  });
  successfulChecks.add(okInventory ? 1 : 0);

  sleep(0.05);
}
