import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  type RosterPreviewResponse,
  type RosterPreviewRow,
} from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

export type RosterPreviewOptions = {
  allowedUnits?: string[] | undefined;
  maxRows?: number | undefined;
};

const LEGACY_PASSWORD_COLUMNS = [
  "password",
  "mat_khau",
  "matkhau",
  "pass",
  "pwd",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

export class RosterService {
  constructor(private readonly db?: PrismaClient) {}

  /** Resolve authority from persisted bindings, never from upload content. */
  async readAllowedUnits(userId: string, role: string): Promise<string[]> {
    if (!this.db) throw new AppError("SERVICE_UNAVAILABLE", "Chưa thể xác minh phạm vi đơn vị.", 503, true, "RECOVERABLE");
    const now = new Date();
    try {
      const units = await this.db.unit.findMany({
        where: {
          status: "ACTIVE",
          ...(role === "SYSTEM_ADMIN" ? {} : {
            contracts: { some: {
              status: "ACTIVE", validFrom: { lte: now }, validTo: { gte: now },
              taBindings: { some: { userId, status: "ACTIVE" } },
            } },
          }),
        },
        select: { unitCode: true },
      });
      return units.map((unit) => unit.unitCode);
    } catch {
      throw new AppError("SERVICE_UNAVAILABLE", "Chưa thể xác minh phạm vi đơn vị.", 503, true, "RECOVERABLE");
    }
  }

  /**
   * Parse and validate CSV or XLSX roster file for preview.
   * Enforces security, schema, person_key identity, unit scope, and batch limits.
   */
  async previewRoster(
    fileBuffer: Buffer,
    fileName: string,
    options?: RosterPreviewOptions,
  ): Promise<RosterPreviewResponse> {
    const maxBytes = CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxBytes;
    if (fileBuffer.length > maxBytes) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Kích thước tệp vượt quá giới hạn cho phép (${Math.round(maxBytes / (1024 * 1024))}MB).`,
        413,
        false,
        "INVALID",
      );
    }

    if (fileBuffer.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tệp rỗng hoặc không có dữ liệu.",
        400,
        false,
        "INVALID",
      );
    }

    const lowerName = fileName.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");

    if (!isCsv && !isXlsx) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Chỉ hỗ trợ tệp định dạng .csv hoặc .xlsx.",
        400,
        false,
        "INVALID",
      );
    }

    const fileType = isCsv ? "CSV" : "XLSX";

    // 1. Raw matrix parsing: headers + rows
    let rawHeaders: string[] = [];
    let rawRows: (string | unknown)[][] = [];

    if (isCsv) {
      try {
        const text = fileBuffer.toString("utf-8");
        const parsed = parse(text, {
          skip_empty_lines: true,
          trim: true,
          cast: false, // Ensure leading zeros in strings like "00123" are preserved
          relax_column_count: true,
        }) as string[][];

        if (!parsed || parsed.length === 0 || !parsed[0]) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Tệp không có dòng dữ liệu nào.",
            400,
            false,
            "INVALID",
          );
        }

        rawHeaders = parsed[0].map(String);
        rawRows = parsed.slice(1);
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          "VALIDATION_ERROR",
          "Tệp CSV không đúng định dạng.",
          400,
          false,
          "INVALID",
        );
      }
    } else {
      try {
        const workbook = XLSX.read(fileBuffer, {
          type: "buffer",
          raw: false, // Formatted text preserves leading zeros
          cellText: true,
        });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Tệp bảng tính không có trang dữ liệu nào.",
            400,
            false,
            "INVALID",
          );
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Trang dữ liệu bảng tính không khả dụng.",
            400,
            false,
            "INVALID",
          );
        }

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        if (!rows || rows.length === 0 || !rows[0]) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Tệp không có dòng dữ liệu nào.",
            400,
            false,
            "INVALID",
          );
        }

        rawHeaders = (rows[0] as unknown[]).map((h) => String(h ?? ""));
        rawRows = rows.slice(1) as (string | unknown)[][];
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          "VALIDATION_ERROR",
          "Tệp XLSX không đúng định dạng hoặc bị hỏng.",
          400,
          false,
          "INVALID",
        );
      }
    }

    // 2. Reject legacy password column
    const normalizedHeaders = rawHeaders.map(normalizeHeader);
    const hasPasswordCol = normalizedHeaders.some((h) =>
      LEGACY_PASSWORD_COLUMNS.includes(h),
    );
    if (hasPasswordCol) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tệp sử dụng mẫu cũ có chứa mật khẩu. Vui lòng chuyển sang mẫu mới gồm: unit_code, student_or_member_id, full_name, username, email.",
        400,
        false,
        "INVALID",
      );
    }

    // Filter out completely blank rows
    const dataRows = rawRows.filter((row) =>
      row && row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""),
    );

    if (dataRows.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tệp không có dòng dữ liệu nào.",
        400,
        false,
        "INVALID",
      );
    }

    // 3. Batch capacity validation
    const requestedMaxRows = options?.maxRows ?? CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxRows;
    if (!Number.isSafeInteger(requestedMaxRows) || requestedMaxRows < 1) {
      throw new AppError("VALIDATION_ERROR", "Giới hạn số dòng không hợp lệ.", 400, false, "INVALID");
    }
    const maxRows = Math.min(requestedMaxRows, CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxRows);

    if (dataRows.length > maxRows) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Số lượng dòng dữ liệu (${dataRows.length}) vượt quá giới hạn cho phép (${maxRows} dòng).`,
        400,
        false,
        "INVALID",
      );
    }

    // 4. Resolve allowed units scope if DB or options provided
    let allowedUnitsSet: Set<string> | null = null;
    if (options?.allowedUnits !== undefined) {
      allowedUnitsSet = new Set(options.allowedUnits.map((u) => u.trim().toUpperCase()));
    } else if (this.db) {
      try {
        const units = await this.db.unit.findMany({
          where: { status: "ACTIVE" },
          select: { unitCode: true },
        });
        allowedUnitsSet = new Set(units.map((u) => u.unitCode.trim().toUpperCase()));
      } catch {
        throw new AppError("SERVICE_UNAVAILABLE", "Chưa thể xác minh phạm vi đơn vị.", 503, true, "RECOVERABLE");
      }
    }

    // 5. Column mapping
    const colMap: Record<string, number> = Object.create(null) as Record<string, number>;
    normalizedHeaders.forEach((h, idx) => {
      if (h) colMap[h] = idx;
    });

    const getCell = (row: (string | unknown)[], colName: string): string => {
      const idx = colMap[colName];
      if (idx === undefined || idx >= row.length) return "";
      const val = row[idx];
      if (val === undefined || val === null) return "";
      return String(val).trim();
    };

    // Tracking for duplicates and warnings
    const seenPersonKeys = new Map<string, number>(); // personKey -> rowNumber
    const seenUsernames = new Map<string, number>(); // usernameNormalized -> rowNumber
    const seenFullNames = new Map<string, number>(); // fullNameNormalized -> rowNumber
    const seenEmails = new Map<string, number>(); // emailNormalized -> rowNumber

    const previewRows: RosterPreviewRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row) continue;
      const rowNumber = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Extract canonical fields preserving exact string representation
      const unitCodeRaw = getCell(row, "unit_code");
      const studentIdRaw = getCell(row, "student_or_member_id");
      const fullNameRaw = getCell(row, "full_name");
      const usernameRaw = getCell(row, "username");
      const emailRaw = getCell(row, "email");

      // Validate required fields
      if (!unitCodeRaw) {
        errors.push("Thiếu mã đơn vị (unit_code)");
      }
      if (!studentIdRaw) {
        errors.push("Thiếu mã số sinh viên/thành viên (student_or_member_id)");
      }
      if (!fullNameRaw) {
        errors.push("Thiếu họ và tên (full_name)");
      }
      if (!usernameRaw) {
        errors.push("Thiếu tên đăng nhập (username)");
      } else if (!USERNAME_REGEX.test(usernameRaw)) {
        errors.push("Tên đăng nhập không hợp lệ (yêu cầu 3-32 ký tự chữ, số, gạch ngang hoặc gạch dưới)");
      }

      // Email validation (optional)
      if (emailRaw && !EMAIL_REGEX.test(emailRaw)) {
        errors.push("Email không đúng định dạng");
      }

      // Unit scope validation
      const unitCodeUpper = unitCodeRaw.toUpperCase();
      if (unitCodeRaw && allowedUnitsSet !== null) {
        if (!allowedUnitsSet.has(unitCodeUpper)) {
          errors.push(`Đơn vị lạ hoặc ngoài phạm vi giải: ${unitCodeRaw}`);
        }
      }

      // Identity: person_key = (unit_code, student_or_member_id)
      let personKey: string | undefined;
      if (unitCodeRaw && studentIdRaw) {
        personKey = `${unitCodeUpper}:${studentIdRaw}`;
        if (seenPersonKeys.has(personKey)) {
          errors.push(
            `Trùng khóa định danh person_key (${personKey}) với dòng ${seenPersonKeys.get(personKey)}`,
          );
        } else {
          seenPersonKeys.set(personKey, rowNumber);
        }
      }

      // Username uniqueness within file
      if (usernameRaw) {
        const uNorm = normalizeUsername(usernameRaw);
        if (seenUsernames.has(uNorm)) {
          errors.push(`Trùng tên đăng nhập (${usernameRaw}) với dòng ${seenUsernames.get(uNorm)}`);
        } else {
          seenUsernames.set(uNorm, rowNumber);
        }
      }

      // Duplicate name / email warnings (Do NOT invalidate row)
      if (fullNameRaw) {
        const fNorm = fullNameRaw.toLowerCase();
        if (seenFullNames.has(fNorm)) {
          warnings.push(`Trùng họ và tên (${fullNameRaw}) với dòng ${seenFullNames.get(fNorm)}`);
        } else {
          seenFullNames.set(fNorm, rowNumber);
        }
      }

      if (emailRaw) {
        const eNorm = emailRaw.toLowerCase();
        if (seenEmails.has(eNorm)) {
          warnings.push(`Trùng email (${emailRaw}) với dòng ${seenEmails.get(eNorm)}`);
        } else {
          seenEmails.set(eNorm, rowNumber);
        }
      }

      // Cleaned data record without any secrets
      const rowData: Record<string, unknown> = {
        unit_code: unitCodeRaw,
        student_or_member_id: studentIdRaw, // Preserves leading zeros
        full_name: fullNameRaw,
        username: usernameRaw,
      };
      if (emailRaw) {
        rowData.email = emailRaw;
      }

      previewRows.push({
        rowNumber,
        data: rowData,
        person_key: personKey,
        valid: errors.length === 0,
        errors,
        warnings,
      });
    }

    const totalRows = previewRows.length;
    const validRows = previewRows.filter((r) => r.valid).length;
    const errorRows = previewRows.filter((r) => !r.valid).length;
    const warningRows = previewRows.filter((r) => r.warnings.length > 0).length;

    return {
      totalRows,
      validRows,
      errorRows,
      warningRows,
      batchCapacity: maxRows,
      fileName,
      fileType,
      rows: previewRows,
    };
  }
}
