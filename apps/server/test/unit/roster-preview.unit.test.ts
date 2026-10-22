import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { RosterService } from "../../src/modules/roster/roster.service.js";
import { registerRosterRoutes } from "../../src/modules/roster/roster.route.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import type { AuthService, AuthContext } from "../../src/modules/auth/auth.service.js";

function createXlsxBuffer(
  rows: (string | number | undefined | null)[][],
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function fakeReply(): FastifyReply {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  (reply.send as unknown as ReturnType<typeof vi.fn>).mockReturnValue(reply);
  return reply;
}

describe("D03 — Roster Preview Service and Route Tests", () => {
  const service = new RosterService();

  describe("RosterService CSV parsing", () => {
    it("1. parses valid CSV successfully and generates correct person_key", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username,email",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a,a@example.com",
        "KHOA_CNTT,SV002,Tran Thi B,user_b,b@example.com",
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "roster.csv",
      );

      expect(result.fileType).toBe("CSV");
      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.rows[0].person_key).toBe("KHOA_CNTT:SV001");
      expect(result.rows[0].valid).toBe(true);
      expect(result.rows[0].data.username).toBe("user_a");
      expect(result.rows[1].person_key).toBe("KHOA_CNTT:SV002");
    });

    it("2. preserves leading zeros in student_or_member_id for CSV", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username",
        "KHOA_CNTT,00123,Nguyen Van Zero,user_zero",
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "test.csv",
      );

      expect(result.validRows).toBe(1);
      expect(result.rows[0].data.student_or_member_id).toBe("00123");
      expect(result.rows[0].person_key).toBe("KHOA_CNTT:00123");
      expect(result.rows[0].data.student_or_member_id).not.toBe("123");
    });

    it("3. validates missing required fields", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username",
        ",SV001,Nguyen Van A,user_a", // Missing unit_code
        "KHOA_CNTT,,Nguyen Van B,user_b", // Missing student_or_member_id
        "KHOA_CNTT,SV003,,user_c", // Missing full_name
        "KHOA_CNTT,SV004,Nguyen Van D,", // Missing username
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "missing.csv",
      );

      expect(result.totalRows).toBe(4);
      expect(result.errorRows).toBe(4);
      expect(result.validRows).toBe(0);
      expect(result.rows[0].errors).toContain("Thiếu mã đơn vị (unit_code)");
      expect(result.rows[1].errors).toContain(
        "Thiếu mã số sinh viên/thành viên (student_or_member_id)",
      );
      expect(result.rows[2].errors).toContain("Thiếu họ và tên (full_name)");
      expect(result.rows[3].errors).toContain("Thiếu tên đăng nhập (username)");
    });

    it("4. validates unit scope when allowedUnits is provided", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a",
        "KHOA_UNKNOWN,SV002,Nguyen Van B,user_b",
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "units.csv",
        { allowedUnits: ["KHOA_CNTT"] },
      );

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(1);
      expect(result.errorRows).toBe(1);
      expect(result.rows[0].valid).toBe(true);
      expect(result.rows[1].valid).toBe(false);
      expect(result.rows[1].errors).toContain(
        "Đơn vị lạ hoặc ngoài phạm vi giải: KHOA_UNKNOWN",
      );
    });

    it("5. detects duplicate person_key and duplicate username in same file without auto-merging", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a",
        "KHOA_CNTT,SV001,Nguyen Van A Dup,user_diff", // Duplicate person_key (KHOA_CNTT:SV001)
        "KHOA_CNTT,SV002,Nguyen Van C,user_a", // Duplicate username (user_a)
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "dups.csv",
      );

      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(1);
      expect(result.errorRows).toBe(2);
      expect(result.rows[1].valid).toBe(false);
      expect(result.rows[1].errors.some((e) => e.includes("Trùng khóa định danh person_key"))).toBe(true);
      expect(result.rows[2].valid).toBe(false);
      expect(result.rows[2].errors.some((e) => e.includes("Trùng tên đăng nhập"))).toBe(true);
    });

    it("6. supports optional email and validates email format when provided", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username,email",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a,", // empty email -> valid
        "KHOA_CNTT,SV002,Nguyen Van B,user_b,valid@domain.com", // valid email -> valid
        "KHOA_CNTT,SV003,Nguyen Van C,user_c,not-an-email", // invalid email -> error
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "emails.csv",
      );

      expect(result.rows[0].valid).toBe(true);
      expect(result.rows[0].data.email).toBeUndefined();
      expect(result.rows[1].valid).toBe(true);
      expect(result.rows[1].data.email).toBe("valid@domain.com");
      expect(result.rows[2].valid).toBe(false);
      expect(result.rows[2].errors).toContain("Email không đúng định dạng");
    });

    it("7. produces warnings for duplicate name and email without invalidating row", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username,email",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a,shared@domain.com",
        "KHOA_CNTT,SV002,Nguyen Van A,user_b,shared@domain.com", // same name & same email, different person_key
      ].join("\n");

      const result = await service.previewRoster(
        Buffer.from(csv, "utf-8"),
        "warnings.csv",
      );

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.warningRows).toBe(1);
      expect(result.rows[1].valid).toBe(true);
      expect(result.rows[1].warnings.some((w) => w.includes("Trùng họ và tên"))).toBe(true);
      expect(result.rows[1].warnings.some((w) => w.includes("Trùng email"))).toBe(true);
    });

    it("8. rejects legacy password-based template safely without exposing secret", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username,password",
        "KHOA_CNTT,SV001,Nguyen Van A,user_a,SuperSecret123!",
      ].join("\n");

      await expect(
        service.previewRoster(Buffer.from(csv, "utf-8"), "legacy.csv"),
      ).rejects.toThrowError(AppError);

      try {
        await service.previewRoster(Buffer.from(csv, "utf-8"), "legacy.csv");
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain("mẫu cũ có chứa mật khẩu");
        expect(JSON.stringify(err)).not.toContain("SuperSecret123!");
      }
    });

    it("9. enforces configured batch capacity", async () => {
      const csv = [
        "unit_code,student_or_member_id,full_name,username",
        "KHOA_CNTT,SV001,Nguyen Van 1,user_1",
        "KHOA_CNTT,SV002,Nguyen Van 2,user_2",
        "KHOA_CNTT,SV003,Nguyen Van 3,user_3",
      ].join("\n");

      // maxRows = 2
      await expect(
        service.previewRoster(Buffer.from(csv, "utf-8"), "batch.csv", {
          maxRows: 2,
        }),
      ).rejects.toThrowError(
        /vượt quá giới hạn cho phép \(2 dòng\)/,
      );
    });

    it("10. rejects empty file and malformed CSV", async () => {
      await expect(
        service.previewRoster(Buffer.from(""), "empty.csv"),
      ).rejects.toThrowError(/Tệp rỗng/);

      await expect(
        service.previewRoster(Buffer.from("   \n\n  "), "blank.csv"),
      ).rejects.toThrowError(/không có dòng dữ liệu nào/);
    });
  });

  describe("RosterService XLSX parsing & leading zero regression", () => {
    it("11. parses valid XLSX successfully", async () => {
      const buf = createXlsxBuffer([
        ["unit_code", "student_or_member_id", "full_name", "username", "email"],
        ["KHOA_TOAN", "SV_MATH_01", "Le Van C", "user_c", "c@math.edu.vn"],
      ]);

      const result = await service.previewRoster(buf, "roster.xlsx");
      expect(result.fileType).toBe("XLSX");
      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.rows[0].person_key).toBe("KHOA_TOAN:SV_MATH_01");
      expect(result.rows[0].data.email).toBe("c@math.edu.vn");
    });

    it("12. REGRESSION: 00123 in student_or_member_id is preserved as 00123 in XLSX (never silently converted to 123)", async () => {
      const buf = createXlsxBuffer([
        ["unit_code", "student_or_member_id", "full_name", "username"],
        ["KHOA_CNTT", "00123", "Tran Thi Leading Zero", "user_zero_xlsx"],
      ]);

      const result = await service.previewRoster(buf, "leading_zero.xlsx");

      expect(result.validRows).toBe(1);
      const studentId = result.rows[0].data.student_or_member_id;
      expect(studentId).toBe("00123");
      expect(studentId).not.toBe("123");
      expect(studentId).not.toBe(123);
      expect(result.rows[0].person_key).toBe("KHOA_CNTT:00123");
    });

    it("13. rejects legacy template in XLSX", async () => {
      const buf = createXlsxBuffer([
        ["unit_code", "student_or_member_id", "full_name", "username", "password"],
        ["KHOA_CNTT", "SV001", "A", "user_a", "secret"],
      ]);

      await expect(
        service.previewRoster(buf, "legacy.xlsx"),
      ).rejects.toThrowError(/mẫu cũ có chứa mật khẩu/);
    });
  });

  describe("Route POST /admin/roster/preview", () => {
    beforeEach(() => {
      vi.spyOn(service, "readAllowedUnits").mockResolvedValue(["KHOA_CNTT", "KHOA_LY"]);
    });
    let routeHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

    const fakeApp = {
      post: vi.fn((path: string, _options: unknown, handler: any) => {
        if (path === "/admin/roster/preview") {
          routeHandler = handler;
        }
      }),
    } as unknown as FastifyInstance;

    const mockAuthService = {
      authenticate: vi.fn(),
    } as unknown as AuthService;

    // Register route once
    registerRosterRoutes(fakeApp, mockAuthService, service);

    it("14. enforces authentication: rejects when principal is not ACCOUNT (401)", async () => {
      (mockAuthService.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        principal: "GUEST",
        user: { role: "USER" },
      });

      const req = {
        headers: {},
        body: { fileName: "roster.csv", fileContent: "unit_code,student_or_member_id,full_name,username\nKHOA,01,A,u_a" },
      } as FastifyRequest;

      await expect(routeHandler(req, fakeReply())).rejects.toThrowError(
        /Vui lòng đăng nhập/,
      );
    });

    it("15. enforces authorization: rejects regular USER role (403)", async () => {
      (mockAuthService.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        principal: "ACCOUNT",
        user: { role: "USER" },
      });

      const req = {
        headers: {},
        body: { fileName: "roster.csv", fileContent: "unit_code,student_or_member_id,full_name,username\nKHOA,01,A,u_a" },
      } as FastifyRequest;

      await expect(routeHandler(req, fakeReply())).rejects.toThrowError(
        /Chỉ quản trị hệ thống/,
      );
    });

    it("16. allows SYSTEM_ADMIN and successfully previews roster via JSON body", async () => {
      (mockAuthService.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        principal: "ACCOUNT",
        user: { role: "SYSTEM_ADMIN" },
      });

      const csv = "unit_code,student_or_member_id,full_name,username\nKHOA_CNTT,00456,Admin Import,user_adm";
      const req = {
        headers: {},
        body: {
          fileName: "admin_test.csv",
          fileContent: csv,
        },
      } as FastifyRequest;

      const reply = fakeReply();
      await routeHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRows: 1,
          validRows: 1,
          rows: expect.arrayContaining([
            expect.objectContaining({
              person_key: "KHOA_CNTT:00456",
              data: expect.objectContaining({
                student_or_member_id: "00456",
              }),
            }),
          ]),
        }),
      );
    });

    it("17. allows TOURNAMENT_ADMIN and previews base64-encoded XLSX", async () => {
      (mockAuthService.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        principal: "ACCOUNT",
        user: { role: "TOURNAMENT_ADMIN" },
      });

      const xlsxBuf = createXlsxBuffer([
        ["unit_code", "student_or_member_id", "full_name", "username"],
        ["KHOA_LY", "00789", "Le Thi Physics", "user_phys"],
      ]);
      const base64Content = xlsxBuf.toString("base64");

      const req = {
        headers: {},
        body: {
          fileName: "physics.xlsx",
          fileContent: base64Content,
        },
      } as FastifyRequest;

      const reply = fakeReply();
      await routeHandler(req, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRows: 1,
          validRows: 1,
          fileType: "XLSX",
          rows: expect.arrayContaining([
            expect.objectContaining({
              person_key: "KHOA_LY:00789",
              data: expect.objectContaining({
                student_or_member_id: "00789",
              }),
            }),
          ]),
        }),
      );
    });
  });
});
