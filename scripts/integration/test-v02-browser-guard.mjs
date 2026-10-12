import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
// Historical E2E suites mock API routes on localhost:3001. Bind our own
// read/write-denying endpoint; fail if another service already owns the port.
export default async function setup() {
  const requests = new Map();
  const server = createServer((req, res) => {
    const key = req.method + " " + req.url;
    requests.set(key, (requests.get(key) ?? 0) + 1);
    res.writeHead(req.method === "OPTIONS" ? 204 : 503, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type,X-OTT-Request,X-Command-Id",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    });
    res.end(req.method === "OPTIONS" ? undefined : JSON.stringify({ code: "INTEGRATION_FIXTURE_ONLY", message: "API thật không được dùng trong bộ test fixture này." }));
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(3001, "127.0.0.1", ok); });
  return async () => {
    await new Promise(ok => server.close(ok));
    writeFileSync("docs/integration/test-v0.2/browser-isolation.json", JSON.stringify({ apiMode: "fixture-only; unmocked API denied", productionMutation: false, requests: Object.fromEntries(requests), stopped: true }, null, 2) + "\n");
  };
}
