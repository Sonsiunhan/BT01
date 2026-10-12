import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("L07-W5: Technical Handoff Package & Final Candidate Verification (L-06B.01 & L-06B.02)", () => {
  it("verifies CAND-F manifest exists and has valid composite fingerprint across 50 candidate files", () => {
    const manifestPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/candf-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);

    expect(manifest.schemaVersion).toBe("0.2.0");
    expect(manifest.candidateId).toBe("CAND-F");
    expect(manifest.securityAudit.status).toBe("PASSED");
    expect(manifest.securityAudit.zeroSecretLeaksVerified).toBe(true);
    expect(manifest.git.compositeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files.length).toBe(50);

    for (const file of manifest.files) {
      expect(file.bytes).toBeGreaterThan(0);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      const absPath = path.resolve(REPO_ROOT, file.path);
      expect(fs.existsSync(absPath)).toBe(true);
    }
  });

  it("verifies Technical Handoff Package contains required sections, ownership matrix, and L-06B.02 declaration", () => {
    const handoffPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/HANDOFF-L07-W5.md");
    expect(fs.existsSync(handoffPath)).toBe(true);

    const content = fs.readFileSync(handoffPath, "utf8");

    // Key sections
    expect(content).toContain("CAND-F Freeze Fingerprint");
    expect(content).toContain("Tổng hợp Kết quả Bàn giao 7 Wave Network Core");
    expect(content).toContain("Tổng hợp Phán quyết Đánh giá Độc lập");
    expect(content).toContain("Tóm lược Năng lực Hệ thống & Giới hạn An toàn");
    expect(content).toContain("Ma trận Sở hữu Thành phần & Đầu mối Phụ trách");
    expect(content).toContain("Danh mục Hạn chế Kỹ thuật, Đầu mối & Hành động Kế tiếp");
    expect(content).toContain("Danh mục Kiểm tra Phát hành");

    // Owners mentioned
    expect(content).toContain("Long");
    expect(content).toContain("Nam");
    expect(content).toContain("Đức");
    expect(content).toContain("Sơn");

    // Explicit declaration of L-06B.02 NOT RUN
    expect(content).toContain("L-06B.02: NOT RUN");
    expect(content).toContain("TUYỆT ĐỐI KHÔNG CẤP QUYỀN");
  });

  it("verifies operational runbook and CP-5 capacity report artifacts exist and are non-empty", () => {
    const runbookPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/CAND-2-RUNBOOK.md");
    const cp5ReportPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/evidence/CP-5-capacity-report-v1.md");

    expect(fs.existsSync(runbookPath)).toBe(true);
    expect(fs.existsSync(cp5ReportPath)).toBe(true);

    const runbookStat = fs.statSync(runbookPath);
    const cp5Stat = fs.statSync(cp5ReportPath);

    expect(runbookStat.size).toBeGreaterThan(1000);
    expect(cp5Stat.size).toBeGreaterThan(1000);
  });

  it("verifies zero secret leakage across all scanned manifest files", () => {
    const manifestPath = path.resolve(REPO_ROOT, "docs/team-handoff/network-core/candf-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    const dangerousPatterns = [
      /postgresql:\/\/[^:]+:(?!(?:password|pass|mock|test|disposable)[@'"`])[^@'"`]+@/i,
      /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
    ];

    for (const file of manifest.files) {
      const absPath = path.resolve(REPO_ROOT, file.path);
      const content = fs.readFileSync(absPath, "utf8");
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
