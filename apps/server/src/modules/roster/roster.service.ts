import { createHash, randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import {
  CANDIDATE_POLICY_DEFAULTS_V1,
  type RosterCommitRequest,
  type RosterCommitResponse,
  type RosterCommitRowOutcome,
  type RosterPreviewResponse,
  type RosterPreviewRow,
} from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

export type RosterPreviewOptions = {
  allowedUnits?: string[] | undefined;
  maxRows?: number | undefined;
};

export const LEGACY_PASSWORD_COLUMNS = [
  "password",
  "mat_khau",
  "matkhau",
  "pass",
  "pwd",
];

export function decodeFileBuffer(fileContent: string, fileName: string): Buffer {
  const trimmed = fileContent.trim();
  const base64Match = trimmed.match(/^data:[^;]+;base64,(.+)$/s);
  if (base64Match && base64Match[1]) {
    return Buffer.from(base64Match[1], "base64");
  }

  const lowerName = fileName.toLowerCase();
  const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
  if (isXlsx) {
    return Buffer.from(trimmed, "base64");
  }

  if (
    !trimmed.includes("\n") &&
    !trimmed.includes(",") &&
    trimmed.length > 50 &&
    /^[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    try {
      return Buffer.from(trimmed, "base64");
    } catch {
      // fallback to utf-8
    }
  }

  return Buffer.from(fileContent, "utf-8");
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Idempotency compares the canonical import payload, not only person_key.
 * A command key reused with a changed display name, unit or seed must fail
 * closed instead of replaying a response for a different request.
 */
function rosterPayloadDigest(rows: readonly NormalizedCommitRow[]): string {
  return createHash("sha256")
    .update(JSON.stringify(rows.map(({ rowNumber: _rowNumber, ...row }) => row)))
    .digest("hex");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

interface NormalizedCommitRow {
  rowNumber: number;
  unitCode: string;
  studentId: string;
  fullName: string;
  username: string;
  email?: string | undefined;
  seedRating?: number | undefined;
  personKey: string;
}

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
   * NOTE: Preview does NOT commit or persist any data.
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

  /**
   * Commit verified roster rows transactionally to permanent storage.
   * Revalidates:
   * 1. Actor authorization (SYSTEM_ADMIN or active bound TOURNAMENT_ADMIN)
   * 2. Tournament state & contract validity
   * 3. Plaintext password absence (never accepts passwords)
   * 4. Scope (unit_code matches tournament / allowed units)
   * 5. Batch & authoritative capacity/quota (maxParticipantsPerTournament & maxParticipantsTotal)
   * 6. Uniqueness (person_key within batch and database)
   * 7. Idempotency against duplicate commit / retry
   * 8. Atomic transaction: failure rolls back everything (no partial commit)
   */
  async commitRosterImport(
    request: RosterCommitRequest,
    actor: { userId: string; role: string },
  ): Promise<RosterCommitResponse> {
    // 1. Authorization check on role
    const isSystemAdmin = actor.role === "SYSTEM_ADMIN";
    const isTournamentAdmin = actor.role === "TOURNAMENT_ADMIN";
    if (!isSystemAdmin && !isTournamentAdmin) {
      throw new AppError(
        "UNAUTHORIZED",
        "Chỉ quản trị hệ thống hoặc quản trị giải đấu được thực hiện import danh sách.",
        403,
        false,
        "INVALID",
      );
    }

    if (!this.db) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Chưa thể kết nối cơ sở dữ liệu để thực hiện commit.",
        503,
        true,
        "RECOVERABLE",
      );
    }

    // 2. Fetch authoritative tournament & contract state
    const tournament = await (this.db as any).tournament.findUnique({
      where: { id: request.tournamentId },
      include: {
        unit: true,
        contract: {
          include: {
            taBindings: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new AppError("NOT_FOUND", "Không tìm thấy giải đấu.", 404, false, "INVALID");
    }

    if (["CANCELLED", "ARCHIVED", "ENDED"].includes(tournament.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Không thể import danh sách vào giải đấu ở trạng thái ${tournament.status}.`,
        400,
        false,
        "INVALID",
        { reason: "INVALID_STATE" },
      );
    }

    // Verify actor tournament scope
    if (!isSystemAdmin) {
      const isOwner = tournament.ownerTaUserId === actor.userId;
      const isBound = tournament.contract?.taBindings?.some(
        (b: any) => b.userId === actor.userId && b.status === "ACTIVE",
      );
      if (!isOwner && !isBound) {
        throw new AppError(
          "UNAUTHORIZED",
          "Bạn không có quyền quản trị giải đấu này.",
          403,
          false,
          "INVALID",
        );
      }
    }

    // Verify contract validity
    if (!tournament.contract) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Giải đấu không có hợp đồng gắn kèm.",
        400,
        false,
        "INVALID",
        { reason: "CONTRACT_INVALID" },
      );
    }

    const now = new Date();
    if (
      tournament.contract.status !== "ACTIVE" ||
      new Date(tournament.contract.validFrom) > now ||
      new Date(tournament.contract.validTo) < now
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Hợp đồng giải đấu không còn hiệu lực.",
        400,
        false,
        "INVALID",
        { reason: "CONTRACT_INVALID" },
      );
    }

    // 3. Normalize and validate input rows before idempotency lookup so the
    // server can compare the complete canonical payload, not just person_key.
    const normalizedRows: NormalizedCommitRow[] = [];
    const seenPersonKeys = new Map<string, number>();
    const seenUsernames = new Map<string, number>();

    if (request.fileContent && request.fileName) {
      const buffer = decodeFileBuffer(request.fileContent, request.fileName);
      // Run through previewRoster parser to obtain validated rows
      const previewRes = await this.previewRoster(buffer, request.fileName, {
        maxRows: CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxRows,
      });

      if (previewRes.errorRows > 0) {
        const firstErrorRow = previewRes.rows.find((r) => !r.valid);
        throw new AppError(
          "VALIDATION_ERROR",
          `Tệp có dòng lỗi (dòng ${firstErrorRow?.rowNumber}: ${firstErrorRow?.errors.join(", ")}). Không thể commit khi còn dòng lỗi.`,
          400,
          false,
          "INVALID",
        );
      }

      for (const pr of previewRes.rows) {
        const d = pr.data as Record<string, unknown>;
        const unitCode = String(d.unit_code ?? "").trim();
        const studentId = String(d.student_or_member_id ?? "").trim();
        const fullName = String(d.full_name ?? "").trim();
        const username = String(d.username ?? "").trim();
        const email = d.email ? String(d.email).trim() : undefined;
        const personKey = pr.person_key || `${unitCode.toUpperCase()}:${studentId}`;

        normalizedRows.push({
          rowNumber: pr.rowNumber,
          unitCode,
          studentId,
          fullName,
          username,
          ...(email !== undefined ? { email } : {}),
          personKey,
        });
      }
    } else if (request.rows) {
      if (request.rows.length === 0) {
        throw new AppError("VALIDATION_ERROR", "Danh sách thí sinh không được rỗng.", 400, false, "INVALID");
      }
      if (request.rows.length > CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxRows) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Số lượng dòng commit (${request.rows.length}) vượt quá giới hạn tối đa (${CANDIDATE_POLICY_DEFAULTS_V1.rosterImportMaxRows}).`,
          400,
          false,
          "INVALID",
          { reason: "BATCH_CAPACITY_EXCEEDED" },
        );
      }

      for (let i = 0; i < request.rows.length; i++) {
        const rawRow = request.rows[i] ?? {};
        const rowNumber = i + 1;

        // Strictly reject plaintext password columns
        for (const key of Object.keys(rawRow)) {
          const normKey = normalizeHeader(key);
          if (LEGACY_PASSWORD_COLUMNS.includes(normKey)) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Dữ liệu commit chứa trường mật khẩu. Không chấp nhận mật khẩu trong danh sách thí sinh.",
              400,
              false,
              "INVALID",
            );
          }
        }

        const unitCode = String(rawRow.unit_code ?? rawRow.unitCode ?? "").trim();
        const studentId = String(rawRow.student_or_member_id ?? rawRow.studentId ?? "").trim();
        const fullName = String(rawRow.full_name ?? rawRow.fullName ?? "").trim();
        const username = String(rawRow.username ?? "").trim();
        const email = rawRow.email ? String(rawRow.email).trim() : undefined;
        const seedRating = Number.isInteger(rawRow.seedRating) ? Number(rawRow.seedRating) : 1000;

        if (!unitCode) throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Thiếu mã đơn vị (unit_code).`, 400, false, "INVALID");
        if (!studentId) throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Thiếu mã số sinh viên/thành viên (student_or_member_id).`, 400, false, "INVALID");
        if (!fullName) throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Thiếu họ và tên (full_name).`, 400, false, "INVALID");
        if (!username) throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Thiếu tên đăng nhập (username).`, 400, false, "INVALID");
        if (!USERNAME_REGEX.test(username)) {
          throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Tên đăng nhập không hợp lệ.`, 400, false, "INVALID");
        }
        if (email && !EMAIL_REGEX.test(email)) {
          throw new AppError("VALIDATION_ERROR", `Dòng ${rowNumber}: Email không đúng định dạng.`, 400, false, "INVALID");
        }

        const personKey = `${unitCode.toUpperCase()}:${studentId}`;

        if (seenPersonKeys.has(personKey)) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Trùng khóa định danh person_key (${personKey}) giữa dòng ${rowNumber} và dòng ${seenPersonKeys.get(personKey)}.`,
            400,
            false,
            "INVALID",
          );
        }
        seenPersonKeys.set(personKey, rowNumber);

        const uNorm = normalizeUsername(username);
        if (seenUsernames.has(uNorm)) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Trùng tên đăng nhập (${username}) giữa dòng ${rowNumber} và dòng ${seenUsernames.get(uNorm)}.`,
            400,
            false,
            "INVALID",
          );
        }
        seenUsernames.set(uNorm, rowNumber);

        normalizedRows.push({
          rowNumber,
          unitCode,
          studentId,
          fullName,
          username,
          ...(email !== undefined ? { email } : {}),
          seedRating,
          personKey,
        });
      }
    }

    const payloadDigest = rosterPayloadDigest(normalizedRows);

    // 4. Idempotency fast-path: the same scoped key may replay only the same
    // canonical payload. A changed payload is a conflict and never mutates.
    if (request.idempotencyKey && (this.db as any).commandLedgerEntry) {
      const existingLedger = await (this.db as any).commandLedgerEntry.findUnique({
        where: {
          principalId_targetId_operation_commandId: {
            principalId: actor.userId,
            targetId: request.tournamentId,
            operation: "ROSTER_IMPORT_COMMIT",
            commandId: request.idempotencyKey,
          },
        },
      });

      if (existingLedger && existingLedger.outcome === "COMMITTED" && existingLedger.ackPayload) {
        if (existingLedger.payloadDigest !== payloadDigest) {
          throw new AppError(
            "CONFLICT",
            "Khóa idempotency đã được dùng cho dữ liệu import khác.",
            409,
            false,
            "INVALID",
            { reason: "IDEMPOTENCY_KEY_REUSED" },
          );
        }
        return existingLedger.ackPayload as unknown as RosterCommitResponse;
      }
    }

    // 5. Revalidate Unit Scope for every row against tournament and contract allowed units
    const allowedUnitsSet = new Set<string>();
    if (tournament.unit?.unitCode) {
      allowedUnitsSet.add(tournament.unit.unitCode.trim().toUpperCase());
    }
    const policyEnv = tournament.contract.policyEnvelope as any;
    if (Array.isArray(policyEnv?.allowedUnits)) {
      for (const u of policyEnv.allowedUnits) allowedUnitsSet.add(String(u).trim().toUpperCase());
    }
    if (Array.isArray(policyEnv?.allowedUnitCodes)) {
      for (const u of policyEnv.allowedUnitCodes) allowedUnitsSet.add(String(u).trim().toUpperCase());
    }
    try {
      const taUnits = await this.readAllowedUnits(actor.userId, actor.role);
      for (const u of taUnits) allowedUnitsSet.add(u.trim().toUpperCase());
    } catch {
      // Keep existing tournament/policy units
    }

    for (const row of normalizedRows) {
      if (!allowedUnitsSet.has(row.unitCode.toUpperCase())) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Đơn vị ${row.unitCode} nằm ngoài phạm vi được phép của giải đấu.`,
          400,
          false,
          "INVALID",
          { reason: "OUT_OF_SCOPE" },
        );
      }
    }

    // 6. Authoritative Capacity & Quota Recheck at commit time
    const existingTournamentCount = await (this.db as any).tournamentEnrollmentRecord.count({
      where: { tournamentId: request.tournamentId },
    });
    const existingContractCount = await (this.db as any).tournamentEnrollmentRecord.count({
      where: { contractId: tournament.contractId },
    });

    const newRowsCount = normalizedRows.length;
    if (existingTournamentCount + newRowsCount > tournament.contract.maxParticipantsPerTournament) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Số lượng thí sinh sau khi import (${existingTournamentCount + newRowsCount}) vượt quá hạn mức tối đa của giải đấu (${tournament.contract.maxParticipantsPerTournament} người). Hiện tại đã có ${existingTournamentCount} người, import thêm ${newRowsCount} người.`,
        400,
        false,
        "INVALID",
        { reason: "BATCH_CAPACITY_EXCEEDED" },
      );
    }

    if (existingContractCount + newRowsCount > tournament.contract.maxParticipantsTotal) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Số lượng thí sinh sau khi import (${existingContractCount + newRowsCount}) vượt quá hạn mức tối đa của hợp đồng (${tournament.contract.maxParticipantsTotal} người). Hiện tại đã có ${existingContractCount} người, import thêm ${newRowsCount} người.`,
        400,
        false,
        "INVALID",
        { reason: "BATCH_CAPACITY_EXCEEDED" },
      );
    }

    // 7. Atomic Transactional Import Execution. A transaction can commit while
    // the client loses the response, and a concurrent loser can observe a
    // unique-key error after the winner commits. In both cases the committed
    // ledger is the only replay authority.
    let response: RosterCommitResponse;
    try {
      response = await (this.db as any).$transaction(async (tx: any) => {
      // Recheck uniqueness of personKeys in DB within transaction
      const personKeys = normalizedRows.map((r) => r.personKey);
      const existingInDb = await tx.tournamentEnrollmentRecord.findMany({
        where: {
          tournamentId: request.tournamentId,
          personKey: { in: personKeys },
        },
        select: { personKey: true },
      });

      if (existingInDb.length > 0) {
        const dupes = existingInDb.map((e: any) => e.personKey).join(", ");
        throw new AppError(
          "CONFLICT",
          `Thí sinh có person_key (${dupes}) đã được ghi danh trong giải đấu này.`,
          409,
          false,
          "INVALID",
          { reason: "DUPLICATE_PERSON_KEY" },
        );
      }

      const outcomes: RosterCommitRowOutcome[] = [];

      for (const row of normalizedRows) {
        let userId: string | null = null;
        let outcomeStatus: "IMPORTED" | "LINKED_EXISTING" = "IMPORTED";

        // D04-B: Account reuse boundary.
        // Priority 1 — canonical person_key lookup: reuse the userId from any existing
        // enrollment for this person_key across ALL tournaments (same physical person).
        // This is the ONLY identity merge allowed. Name and email are NEVER used for merging.
        if (tx.tournamentEnrollmentRecord) {
          const priorEnrollment = await tx.tournamentEnrollmentRecord.findFirst({
            where: {
              personKey: row.personKey,
              userId: { not: null },
              contractId: tournament.contractId,
            },
            select: { userId: true },
            orderBy: { createdAt: "desc" },
          });

          if (priorEnrollment?.userId) {
            userId = priorEnrollment.userId;
            outcomeStatus = "LINKED_EXISTING";
          }
        }

        // Priority 2 — username-based user lookup (only if person_key had no prior enrollment).
        // Do NOT change credentials, do NOT issue password reset, do NOT create credentials.
        if (!userId && tx.user) {
          const existingUser = await tx.user.findUnique({
            where: { usernameNormalized: row.username.toLowerCase() },
            select: { id: true, username: true },
          });

          if (existingUser) {
            userId = existingUser.id;
            outcomeStatus = "LINKED_EXISTING";
          }
        }

        // If no user exists yet, enrollment is created with userId = null.
        // D05 activation will link the account when the person activates.

        const enrollmentId = randomUUID();
        await tx.tournamentEnrollmentRecord.create({
          data: {
            id: enrollmentId,
            tournamentId: request.tournamentId,
            contractId: tournament.contractId,
            personKey: row.personKey,
            userId,
            displayName: row.fullName,
            unitCode: row.unitCode,
            email: row.email || null,
            seedRating: row.seedRating ?? 1000,
            eligibilityStatus: "ELIGIBLE",
            botReadinessStatus: "NOT_REQUIRED",
          },
        });

        outcomes.push({
          rowNumber: row.rowNumber,
          person_key: row.personKey,
          username: row.username,
          displayName: row.fullName,
          unitCode: row.unitCode,
          status: outcomeStatus,
          enrollmentId,
          userId: userId ?? undefined,
        });
      }

      const responsePayload: RosterCommitResponse = {
        success: true,
        tournamentId: request.tournamentId,
        totalRows: outcomes.length,
        importedCount: outcomes.length,
        idempotencyKey: request.idempotencyKey,
        committedAt: new Date().toISOString(),
        outcomes,
      };

      // Record idempotency ledger entry
      if (request.idempotencyKey && tx.commandLedgerEntry) {
        await tx.commandLedgerEntry.create({
          data: {
            id: randomUUID(),
            principalId: actor.userId,
            targetId: request.tournamentId,
            operation: "ROSTER_IMPORT_COMMIT",
            commandId: request.idempotencyKey,
            payloadDigest,
            outcome: "COMMITTED",
            stateVersion: tournament.revision ?? 1,
            sequence: 1,
            ackPayload: responsePayload as any,
            expiresAt: new Date(Date.now() + 86400000), // 24h retention
          },
        });
      }

      // Record audit log
      if (tx.tournamentAuditLogRecord) {
        await tx.tournamentAuditLogRecord.create({
          data: {
            id: randomUUID(),
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "ROSTER_IMPORT_COMMIT",
            targetType: "TOURNAMENT",
            targetId: request.tournamentId,
            afterSnapshot: {
              importedCount: responsePayload.importedCount,
              idempotencyKey: request.idempotencyKey,
            },
            reason: "Import roster commit",
          },
        });
      }

        return responsePayload;
      });
    } catch (error) {
      if (request.idempotencyKey && (this.db as any).commandLedgerEntry) {
        const committedLedger = await (this.db as any).commandLedgerEntry.findUnique({
          where: {
            principalId_targetId_operation_commandId: {
              principalId: actor.userId,
              targetId: request.tournamentId,
              operation: "ROSTER_IMPORT_COMMIT",
              commandId: request.idempotencyKey,
            },
          },
        });
        if (committedLedger?.outcome === "COMMITTED" && committedLedger.ackPayload) {
          if (committedLedger.payloadDigest !== payloadDigest) {
            throw new AppError(
              "CONFLICT",
              "Khóa idempotency đã được dùng cho dữ liệu import khác.",
              409,
              false,
              "INVALID",
              { reason: "IDEMPOTENCY_KEY_REUSED" },
            );
          }
          return committedLedger.ackPayload as unknown as RosterCommitResponse;
        }
      }

      // The database uniqueness fence remains authoritative for different
      // idempotency keys racing on one logical person_key. Convert the raw
      // Prisma error into the canonical conflict taxonomy without masking
      // unrelated unique constraints (for example username).
      const prismaError = error as { code?: string; meta?: { target?: unknown } };
      const target = Array.isArray(prismaError.meta?.target)
        ? prismaError.meta?.target.join("_")
        : String(prismaError.meta?.target ?? "");
      if (prismaError.code === "P2002" && target.includes("personKey")) {
        throw new AppError(
          "CONFLICT",
          "Thí sinh có person_key đã được ghi danh trong giải đấu này.",
          409,
          false,
          "INVALID",
          { reason: "DUPLICATE_PERSON_KEY" },
        );
      }
      throw error;
    }

    return response;
  }
}
