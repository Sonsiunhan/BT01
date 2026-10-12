import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCand2RestartRehearsal } from "../../../../scripts/network/cand2-restart-rehearsal.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("CAND-2 Freeze & Restart Rehearsal Integration (L-06A.02 & L-07.09)", () => {
  it("verifies CAND-2 candidate manifest exists and contains complete inventory", () => {
    const manifestPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/cand2-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.candidateId).toBe("CAND-2");
    expect(manifest.schemaVersion).toBe("0.2.0");
    expect(manifest.git.baseSha).toBeDefined();
    expect(manifest.git.diffHash).toBeDefined();
    expect(manifest.git.compositeFingerprint).toBeDefined();
    expect(manifest.files.length).toBeGreaterThanOrEqual(40);
    expect(manifest.securityAudit.zeroSecretLeaksVerified).toBe(true);
  });

  it("verifies zero secret leakage in inventory and diagnostics configuration", () => {
    const manifestPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/cand2-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Check manifest security audit
    expect(manifest.securityAudit.status).toBe("PASSED");

    // Scan env.ts content to ensure no production database passwords are hardcoded
    const envPath = path.resolve(REPO_ROOT, "apps/server/src/config/env.ts");
    const envContent = fs.readFileSync(envPath, "utf8");
    expect(envContent).not.toMatch(/password:\s*["'][^"']+["']/i);
  });

  it("executes full CAND-2 process restart and recovery rehearsal cleanly", async () => {
    const result = await runCand2RestartRehearsal();
    expect(result.status).toBe("PASS");
    expect(result.primaryCheck).toBe(true);
    expect(result.restoredCheck).toBe(true);
    expect(result.checkpointSequence).toBeGreaterThan(0);
  });
});
