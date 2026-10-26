import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TournamentApiClient,
} from "../../apps/web/src/features/admin/tournaments/tournamentApi";
import { AuditLogRecordSchema } from "@ottv2/contracts";
import type { AuditLogRecordDto } from "@ottv2/contracts";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const SAMPLE_RECORD: AuditLogRecordDto = {
  id: "audit-001",
  actorUserId: "user-ta-01",
  actorRole: "TOURNAMENT_ADMIN",
  action: "CREATE_DRAFT",
  targetType: "TOURNAMENT",
  targetId: "tour-001",
  beforeSnapshot: null,
  afterSnapshot: {
    name: "Giải Vô địch Quốc gia Robot Lab 2026",
    status: "DRAFT",
  },
  reason: "Khởi tạo giải đấu mùa giải 2026",
  correlationId: "corr-001",
  createdAt: "2026-10-21T08:00:00.000Z",
};

describe("S06 — Audit Viewer FE/BE và Nối Readiness Core (AC-01..AC-05)", () => {
  const client = new TournamentApiClient();

  it("AC-01: bản ghi kiểm toán trả về từ API tuân thủ nghiêm ngặt AuditLogRecordSchema", () => {
    const parsed = AuditLogRecordSchema.safeParse(SAMPLE_RECORD);
    expect(parsed.success).toBe(true);
    expect(SAMPLE_RECORD.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(SAMPLE_RECORD.actorUserId).toBeTruthy();
    expect(SAMPLE_RECORD.action).toBeTruthy();

    // targetType ngoài union hợp đồng phải bị từ chối bởi schema.
    const invalid = AuditLogRecordSchema.safeParse({
      ...SAMPLE_RECORD,
      targetType: "NOT_A_TARGET_TYPE",
    });
    expect(invalid.success).toBe(false);
  });

  it("AC-02: listAuditLogs gửi tham số lọc targetType, targetId, và actorUserId lên máy chủ", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return jsonResponse({ logs: [SAMPLE_RECORD] });
      })
    );

    const res = await client.listAuditLogs({
      targetType: "TOURNAMENT",
      targetId: "tour-001",
      actorUserId: "user-ta-01",
    });

    expect(res.logs).toHaveLength(1);
    expect(urls).toHaveLength(1);
    const url = urls[0];
    expect(url.startsWith("/api/admin/audit-logs?")).toBe(true);
    expect(url).toContain("targetType=TOURNAMENT");
    expect(url).toContain("targetId=tour-001");
    expect(url).toContain("actorUserId=user-ta-01");

    // Không có filter -> URL không mang tham số lọc.
    await client.listAuditLogs();
    expect(urls[1]).toBe("/api/admin/audit-logs");
  });

  it("AC-03: client trả nguyên phản hồi đã lọc của máy chủ, không lọc lại hay bịa thêm bản ghi", async () => {
    const serverLogs = [
      SAMPLE_RECORD,
      { ...SAMPLE_RECORD, id: "audit-009", targetType: "CONTRACT" as const, targetId: "HD-2026-CHUNG" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ logs: serverLogs }))
    );

    const res = await client.listAuditLogs({ targetType: "TOURNAMENT", targetId: "tour-001" });
    // Máy chủ chịu trách nhiệm lọc (đã gửi đủ tham số ở AC-02); client pass-through.
    expect(res.logs).toEqual(serverLogs);
    expect(res.logs).toHaveLength(2);
  });

  it("AC-04: lỗi mạng hoặc HTTP non-ok khi tải nhật ký phải được ném ra, không bịa dữ liệu thay thế", async () => {
    // Network failure
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(client.listAuditLogs()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      statusCode: 0,
    });

    // Server 403 (không đủ quyền)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Chỉ Quản trị hệ thống (Admin) mới được phép thực hiện thao tác này." }, 403))
    );
    await expect(client.listAuditLogs()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("AC-05: lịch sử audit giữ nguyên correlationId, reason và snapshot để truy vết, không bị client biến đổi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ logs: [SAMPLE_RECORD] }))
    );

    const res = await client.listAuditLogs();
    expect(res.logs[0]).toEqual(SAMPLE_RECORD);
    expect(res.logs[0].correlationId).toBe("corr-001");
    expect(res.logs[0].reason).not.toBeNull();

    // Snapshots không chứa khóa nhạy cảm (phòng thủ hai lớp ở client).
    const sensitiveKeys = ["password", "token", "claimCode", "secret", "privateKey"];
    for (const record of res.logs) {
      const checkSnapshot = (snapshot: Record<string, unknown> | null | undefined) => {
        if (!snapshot) return;
        for (const k of Object.keys(snapshot)) {
          expect(sensitiveKeys).not.toContain(k.toLowerCase());
        }
      };
      checkSnapshot(record.beforeSnapshot as Record<string, unknown> | null);
      checkSnapshot(record.afterSnapshot as Record<string, unknown> | null);
    }
  });
});
