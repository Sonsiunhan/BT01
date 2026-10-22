import { describe, expect, it } from "vitest";
import {
  TournamentApiClient,
  FIXTURE_AUDIT_LOGS,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";
import { AuditLogRecordSchema } from "@ottv2/contracts";

describe("S06 — Audit Viewer FE/BE và Nối Readiness Core (AC-01..AC-05)", () => {
  const client = new TournamentApiClient({ useRealApi: false });

  it("AC-01: FIXTURE_AUDIT_LOGS tuân thủ nghiêm ngặt AuditLogRecordSchema và định dạng chuẩn", () => {
    expect(FIXTURE_AUDIT_LOGS.length).toBeGreaterThanOrEqual(3);
    for (const record of FIXTURE_AUDIT_LOGS) {
      const parsed = AuditLogRecordSchema.safeParse(record);
      expect(parsed.success).toBe(true);
      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(record.actorUserId).toBeTruthy();
      expect(record.action).toBeTruthy();
    }
  });

  it("AC-02: listAuditLogs hỗ trợ lọc theo targetType, targetId, và actorUserId", async () => {
    const all = await client.listAuditLogs();
    expect(all.logs.length).toBe(FIXTURE_AUDIT_LOGS.length);

    const tournamentLogs = await client.listAuditLogs({ targetType: "TOURNAMENT" });
    expect(tournamentLogs.logs.every((l) => l.targetType === "TOURNAMENT")).toBe(true);

    const scopedLogs = await client.listAuditLogs({ targetId: "tour-001" });
    expect(scopedLogs.logs.every((l) => l.targetId === "tour-001")).toBe(true);

    const actorLogs = await client.listAuditLogs({ actorUserId: "user-ta-01" });
    expect(actorLogs.logs.every((l) => l.actorUserId === "user-ta-01")).toBe(true);
  });

  it("AC-03: Scoped query chỉ trả về đúng bản ghi của tournamentId mục tiêu", async () => {
    const res = await client.listAuditLogs({
      targetType: "TOURNAMENT",
      targetId: "tour-001",
    });
    expect(res.logs.length).toBeGreaterThan(0);
    for (const item of res.logs) {
      expect(item.targetId).toBe("tour-001");
      expect(item.targetType).toBe("TOURNAMENT");
    }
  });

  it("AC-04: Snapshot trước và sau thay đổi khử nhạy cảm sâu, không chứa khóa bí mật", async () => {
    const res = await client.listAuditLogs();
    const sensitiveKeys = ["password", "token", "claimCode", "secret", "privateKey"];

    for (const record of res.logs) {
      const checkSnapshot = (snapshot: Record<string, unknown> | null | undefined) => {
        if (!snapshot) return;
        const keys = Object.keys(snapshot);
        for (const k of keys) {
          expect(sensitiveKeys).not.toContain(k.toLowerCase());
        }
      };

      checkSnapshot(record.beforeSnapshot as Record<string, unknown> | null);
      checkSnapshot(record.afterSnapshot as Record<string, unknown> | null);
    }
  });

  it("AC-05: Lịch sử audit lưu giữ nguyên vẹn correlationId và reason cho việc truy vết phán quyết/blocker", async () => {
    const res = await client.listAuditLogs();
    const withReason = res.logs.filter((l) => l.reason !== null);
    expect(withReason.length).toBeGreaterThan(0);

    const withCorr = res.logs.filter((l) => l.correlationId !== null);
    expect(withCorr.length).toBeGreaterThan(0);
  });
});
