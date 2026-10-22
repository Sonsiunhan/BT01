import type { FastifyInstance, FastifyRequest } from "fastify";
import { RosterPreviewRequestSchema } from "@ottv2/contracts";

import { readCookie, requireBody } from "../auth/auth.http.js";
import type { AuthService } from "../auth/auth.service.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { RosterService } from "./roster.service.js";

function decodeFileBuffer(fileContent: string, fileName: string): Buffer {
  const trimmed = fileContent.trim();
  // Strip data url prefix if present (e.g. data:text/csv;base64,... or data:application/vnd.openxmlformats...)
  const base64Match = trimmed.match(/^data:[^;]+;base64,(.+)$/s);
  if (base64Match && base64Match[1]) {
    return Buffer.from(base64Match[1], "base64");
  }

  // If fileName is xlsx/xls and content doesn't look like CSV text, parse as base64
  const lowerName = fileName.toLowerCase();
  const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
  if (isXlsx) {
    return Buffer.from(trimmed, "base64");
  }

  // Check if content is pure base64
  if (!trimmed.includes("\n") && !trimmed.includes(",") && trimmed.length > 50 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    try {
      return Buffer.from(trimmed, "base64");
    } catch {
      // fallback to utf-8
    }
  }

  return Buffer.from(fileContent, "utf-8");
}

export async function registerRosterRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: RosterService,
): Promise<void> {
  app.post("/admin/roster/preview", async (request: FastifyRequest, reply) => {
    // 1. Authenticate and enforce administrative authorization
    const cookie = readCookie(request);
    const context = await auth.authenticate(cookie);

    if (context.principal !== "ACCOUNT") {
      throw new AppError(
        "UNAUTHORIZED",
        "Principal not authenticated as ACCOUNT",
        401,
        false,
        "FATAL_SESSION",
      );
    }

    const userRole = (context.user as any).role;
    const userRoles: string[] = ((context.user as any).roles as string[]) ?? [];
    const isSystemAdmin =
      userRole === "SYSTEM_ADMIN" ||
      userRoles.includes("SYSTEM_ADMIN") ||
      userRoles.includes("ADMIN");
    const isTournamentAdmin =
      userRole === "TOURNAMENT_ADMIN" ||
      userRoles.includes("TOURNAMENT_ADMIN");

    if (!isSystemAdmin && !isTournamentAdmin) {
      throw new AppError(
        "UNAUTHORIZED",
        "Only System Admin or Tournament Admin can perform this operation",
        403,
        false,
        "INVALID",
      );
    }

    // 2. Parse request input
    let buffer: Buffer;
    let fileName: string;
    let allowedUnits: string[] | undefined;
    let maxRows: number | undefined;

    if (Buffer.isBuffer(request.body)) {
      buffer = request.body;
      fileName =
        (request.headers["x-file-name"] as string) ||
        (request.query as any)?.fileName ||
        "roster.csv";
    } else {
      const input = requireBody(request.body, RosterPreviewRequestSchema);
      fileName = input.fileName;
      buffer = decodeFileBuffer(input.fileContent, fileName);
      allowedUnits = input.allowedUnits;
      maxRows = input.maxRows;
    }

    // 3. Execute preview
    const result = await service.previewRoster(buffer, fileName, {
      ...(allowedUnits !== undefined ? { allowedUnits } : {}),
      ...(maxRows !== undefined ? { maxRows } : {}),
    });

    return reply.status(200).send(result);
  });
}
