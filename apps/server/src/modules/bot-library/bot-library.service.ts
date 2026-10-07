import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { DEFAULT_BOT_LIMITS, BOT_SDK_VERSION, BOT_STATE_SCHEMA_VERSION, validateBotSource, utf8ByteLength, createIsolatedRuntimeHarness, createBotTurnState, BotOutputValidationError, type IsolatedRuntimeAdapter } from "@ottv2/bot-sdk";
import { createInitialState } from "@ottv2/game-rules";
import type { BotLibraryItem, BotLibraryListResponse, BotRevision, BotRevisionTestResponse, BotSdkDocsResponse } from "@ottv2/contracts";
import { BotRevisionSchema } from "@ottv2/contracts";

import { AppError } from "../../shared/errors/app-error.js";

const LIBRARY_QUOTA_BYTES = 256 * 1024;
const ALLOWLIST = ["collections", "functools", "heapq", "itertools", "json", "math", "statistics", "typing"];
const TEMPLATE = "def choose_move(state, memory):\n    # Chọn một nước trong state['legal_moves'] và trả về (nước đi, bộ nhớ JSON).\n    return state['legal_moves'][0], memory\n";

type RevisionRecord = BotRevision & { ownerUserId: string; botId: string; source: string };
type BotRecord = BotLibraryItem & { ownerUserId: string; revisionRecords: RevisionRecord[] };

export type BotLibraryDatabase = {
  botLibrary: {
    findMany(args: unknown): Promise<any[]>;
    findFirst(args: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
    update(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
    deleteMany(args: unknown): Promise<any>;
  };
  botRevision: {
    findFirst(args: unknown): Promise<any | null>;
    create(args: unknown): Promise<any>;
    update(args: unknown): Promise<any>;
    delete(args: unknown): Promise<any>;
    deleteMany(args: unknown): Promise<any>;
    updateMany(args: unknown): Promise<any>;
  };
};

function digest(source: string): string { return createHash("sha256").update(source, "utf8").digest("hex"); }
function ownerWhere(ownerId: string): { ownerGuestId: string } | { ownerUserId: string } {
  return ownerId.startsWith("guest:") ? { ownerGuestId: ownerId } : { ownerUserId: ownerId };
}
function sourceExpiry(ownerId: string): Date | null { return ownerId.startsWith("guest:") ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null; }
function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function publicRevision(revision: RevisionRecord): BotRevision {
  const { ownerUserId: _owner, botId: _bot, source: _source, ...publicValue } = revision;
  // Prisma records include sourceText and internal ownership fields. Serialize
  // only the contract, rather than spreading storage records into responses.
  return BotRevisionSchema.parse(publicValue);
}
function publicBot(bot: BotRecord): BotLibraryItem {
  return { id: bot.id, name: bot.name, createdAt: bot.createdAt, updatedAt: bot.updatedAt, usedBytes: bot.usedBytes, revisions: bot.revisionRecords.map(publicRevision) };
}

export class BotLibraryService {
  private readonly memoryBots = new Map<string, BotRecord>();
  private readonly runtime: ReturnType<typeof createIsolatedRuntimeHarness>;
  private preflightBusy = false;
  private readonly writingOwners = new Set<string>();
  private readonly matchReferences = new Map<string, Set<string>>();

  async retainMatchRevisions(matchId: string, revisionIds: string[]): Promise<void> {
    // Protect both the acknowledged state and candidate during storage I/O.
    // Failed/partial persistence retains conservative pins, never live authority.
    const previous = this.matchReferences.get(matchId) ?? new Set<string>();
    this.matchReferences.set(matchId, new Set([...previous, ...revisionIds]));
    if (this.db) {
      if (revisionIds.length) await this.db.botRevision.updateMany({ where: { id: { in: revisionIds } }, data: { activeForMatchId: matchId } });
      await this.db.botRevision.updateMany({ where: { activeForMatchId: matchId, id: { notIn: revisionIds } }, data: { activeForMatchId: null } });
    }
    if (revisionIds.length) this.matchReferences.set(matchId, new Set(revisionIds));
    else this.matchReferences.delete(matchId);
  }

  private protectedRevisionIds(): string[] { return [...this.matchReferences.values()].flatMap(value => [...value]); }

  async pruneExpiredGuestSources(): Promise<void> {
    const protectedIds = this.protectedRevisionIds();
    if (this.db) {
      await this.db.botRevision.deleteMany({ where: { botLibrary: { ownerGuestId: { not: null } }, sourceExpiresAt: { lte: new Date() }, activeForMatchId: null, pendingForMatchId: null, id: { notIn: protectedIds } } });
      await this.db.botLibrary.deleteMany({ where: { ownerGuestId: { not: null }, revisions: { none: {} } } });
    } else {
      for (const bot of this.memoryBots.values()) if (bot.ownerUserId.startsWith("guest:")) {
        bot.revisionRecords = bot.revisionRecords.filter(row => !row.sourceExpiresAt || new Date(row.sourceExpiresAt).getTime() > Date.now() || protectedIds.includes(row.id) || row.activeForMatchId || row.pendingForMatchId);
        bot.revisions = bot.revisionRecords.map(publicRevision);
        bot.usedBytes = bot.revisionRecords.reduce((sum, row) => sum + row.sourceBytes, 0);
        if (bot.revisionRecords.length === 0) this.memoryBots.delete(bot.id);
      }
    }
  }

  async clearGuestStaging(owner: string): Promise<void> {
    if (!owner.startsWith("guest:")) throw new AppError("UNAUTHORIZED", "Cần phiên Guest hợp lệ.", 401, false, "FATAL_SESSION");
    await this.writeFor(owner, async () => {
      const protectedIds = this.protectedRevisionIds();
      if (this.db) {
        await this.db.botRevision.deleteMany({ where: { botLibrary: ownerWhere(owner), activeForMatchId: null, pendingForMatchId: null, id: { notIn: protectedIds } } });
        await this.db.botLibrary.deleteMany({ where: { ...ownerWhere(owner), revisions: { none: {} } } });
      }
      else for (const bot of this.memoryBots.values()) if (bot.ownerUserId === owner) {
        bot.revisionRecords = bot.revisionRecords.filter(row => protectedIds.includes(row.id) || row.activeForMatchId || row.pendingForMatchId);
        bot.revisions = bot.revisionRecords.map(publicRevision); bot.usedBytes = bot.revisionRecords.reduce((sum, row) => sum + row.sourceBytes, 0);
        if (bot.revisionRecords.length === 0) this.memoryBots.delete(bot.id);
      }
    });
  }

  constructor(private readonly db?: BotLibraryDatabase, options: { adapter?: IsolatedRuntimeAdapter } = {}) {
    this.runtime = createIsolatedRuntimeHarness(options.adapter);
  }

  private assertAccount(ownerUserId: string): void {
    // Routes supply only an authenticated server principal, never a body owner.
    if (!ownerUserId) throw new AppError("UNAUTHORIZED", "Cần phiên người chơi hợp lệ.", 401, false, "FATAL_SESSION");
  }

  private async writeFor<T>(owner: string, work: () => Promise<T>): Promise<T> {
    if (this.writingOwners.has(owner)) throw new AppError("CONFLICT", "Thư viện đang cập nhật. Hãy thử lại.", 409, true, "RECOVERABLE");
    this.writingOwners.add(owner);
    try { return await work(); } finally { this.writingOwners.delete(owner); }
  }

  async stageGuest(owner: string, name: string, source: string): Promise<{ bot: BotLibraryItem; revision: BotRevision }> {
    if (!owner.startsWith("guest:")) throw new AppError("UNAUTHORIZED", "Cần phiên Guest hợp lệ.", 401, false, "FATAL_SESSION");
    return this.writeFor(owner, async () => {
      await this.pruneExpiredGuestSources();
      const { bots } = await this.list(owner);
      for (const bot of bots) {
        const revision = bot.revisions.find(row => row.sourceDigest === digest(source) && row.sourceExpiresAt && new Date(row.sourceExpiresAt).getTime() > Date.now());
        if (revision) return { bot, revision };
      }
      return this.createBotUnlocked(owner, `${name.slice(0, 40)} · ${randomUUID().slice(0, 8)}`, source);
    });
  }

  private async findMemoryBot(ownerUserId: string, botId: string): Promise<BotRecord> {
    const bot = [...this.memoryBots.values()].find((candidate) => candidate.ownerUserId === ownerUserId && candidate.id === botId);
    if (!bot) throw new AppError("NOT_FOUND", "Không tìm thấy thư viện bot.", 404, false, "INVALID");
    return bot;
  }

  private buildRevision(ownerUserId: string, botId: string, revisionNumber: number, source: string): RevisionRecord {
    const validation = validateBotSource(source);
    const now = new Date().toISOString();
    const sourceBytes = utf8ByteLength(source);
    return {
      id: randomUUID(), botId, ownerUserId, revisionNumber, status: validation.ok ? "READY" : "INVALID",
      sdkVersion: validation.ok ? validation.sdkVersion : BOT_SDK_VERSION, schemaVersion: validation.ok ? validation.schemaVersion : BOT_STATE_SCHEMA_VERSION,
      sourceDigest: digest(source), sourceBytes, validationCode: validation.ok ? null : validation.code, validationMessage: validation.ok ? null : validation.message,
      preflightMs: 0, createdAt: now, updatedAt: now, memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE", "OFFLINE"], activeForMatchId: null, pendingForMatchId: null,
      sourceExpiresAt: sourceExpiry(ownerUserId)?.toISOString() ?? null, source,
    };
  }

  async list(ownerUserId: string): Promise<BotLibraryListResponse> {
    this.assertAccount(ownerUserId);
    if (this.db) {
      const rows = await this.db.botLibrary.findMany({ where: ownerWhere(ownerUserId), orderBy: { updatedAt: "desc" }, include: { revisions: { orderBy: { revisionNumber: "desc" } } } });
      const bots = rows.map((row) => ({ id: row.id, name: row.name, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), usedBytes: row.revisions.reduce((sum: number, revision: any) => sum + revision.sourceBytes, 0), revisions: row.revisions.map((revision: any) => publicRevision({ ...revision, botId: row.id, ownerUserId, createdAt: iso(revision.createdAt), updatedAt: iso(revision.updatedAt), memoryPolicy: revision.memoryPolicy, availability: ["ONLINE", "OFFLINE"], sourceExpiresAt: revision.sourceExpiresAt ? iso(revision.sourceExpiresAt) : null, source: revision.sourceText })) }));
      return { bots, quotaBytes: LIBRARY_QUOTA_BYTES, usedBytes: bots.reduce((sum, bot) => sum + bot.usedBytes, 0) };
    }
    const bots = [...this.memoryBots.values()].filter((bot) => bot.ownerUserId === ownerUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(publicBot);
    return { bots, quotaBytes: LIBRARY_QUOTA_BYTES, usedBytes: bots.reduce((sum, bot) => sum + bot.usedBytes, 0) };
  }

  async createBot(ownerUserId: string, name: string, source: string): Promise<{ bot: BotLibraryItem; revision: BotRevision }> {
    return this.writeFor(ownerUserId, () => this.createBotUnlocked(ownerUserId, name, source));
  }

  private async createBotUnlocked(ownerUserId: string, name: string, source: string): Promise<{ bot: BotLibraryItem; revision: BotRevision }> {
    this.assertAccount(ownerUserId);
    const sourceBytes = utf8ByteLength(source);
    if (sourceBytes > DEFAULT_BOT_LIMITS.uploadBytes) throw new AppError("VALIDATION_ERROR", "Tệp chiến thuật vượt giới hạn 64 KiB.", 400, false, "INVALID");
    const current = await this.list(ownerUserId);
    if (current.usedBytes + sourceBytes > LIBRARY_QUOTA_BYTES) throw new AppError("CONFLICT", "Dung lượng thư viện đã đầy. Hãy xoá revision cũ trước.", 409, false, "INVALID", { reason: "LIBRARY_QUOTA" });
    if (this.db) {
      const existing = await this.db.botLibrary.findFirst({ where: { ...ownerWhere(ownerUserId), name } });
      if (existing) throw new AppError("CONFLICT", "Tên bot đã tồn tại trong thư viện.", 409, false, "INVALID");
      const validation = validateBotSource(source);
      const started = performance.now();
      const row = await this.db.botLibrary.create({ data: { ...ownerWhere(ownerUserId), name, revisions: { create: { revisionNumber: 1, sdkVersion: validation.ok ? validation.sdkVersion : BOT_SDK_VERSION, schemaVersion: validation.ok ? validation.schemaVersion : BOT_STATE_SCHEMA_VERSION, sourceDigest: digest(source), sourceBytes, sourceText: source, status: validation.ok ? "READY" : "INVALID", validationCode: validation.ok ? null : validation.code, validationMessage: validation.ok ? null : validation.message, preflightMs: Math.round(performance.now() - started), sourceExpiresAt: sourceExpiry(ownerUserId) } } }, include: { revisions: true } });
      const revisionRow = row.revisions[0];
      const revision = publicRevision({ ...revisionRow, botId: row.id, ownerUserId, createdAt: iso(revisionRow.createdAt), updatedAt: iso(revisionRow.updatedAt), memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["ONLINE", "OFFLINE"], sourceExpiresAt: revisionRow.sourceExpiresAt ? iso(revisionRow.sourceExpiresAt) : null, source: revisionRow.sourceText });
      return { bot: { id: row.id, name: row.name, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), usedBytes: sourceBytes, revisions: [revision] }, revision };
    }
    if ([...this.memoryBots.values()].some((bot) => bot.ownerUserId === ownerUserId && bot.name === name)) throw new AppError("CONFLICT", "Tên bot đã tồn tại trong thư viện.", 409, false, "INVALID");
    const botId = randomUUID();
    const revision = this.buildRevision(ownerUserId, botId, 1, source);
    const bot: BotRecord = { id: botId, ownerUserId, name, createdAt: revision.createdAt, updatedAt: revision.updatedAt, usedBytes: sourceBytes, revisions: [publicRevision(revision)], revisionRecords: [revision] };
    this.memoryBots.set(botId, bot);
    return { bot: publicBot(bot), revision: publicRevision(revision) };
  }

  async createRevision(ownerUserId: string, botId: string, source: string): Promise<{ bot: BotLibraryItem; revision: BotRevision }> {
    return this.writeFor(ownerUserId, () => this.createRevisionUnlocked(ownerUserId, botId, source));
  }

  private async createRevisionUnlocked(ownerUserId: string, botId: string, source: string): Promise<{ bot: BotLibraryItem; revision: BotRevision }> {
    this.assertAccount(ownerUserId);
    const sourceBytes = utf8ByteLength(source);
    if (sourceBytes > DEFAULT_BOT_LIMITS.uploadBytes) throw new AppError("VALIDATION_ERROR", "Tệp chiến thuật vượt giới hạn 64 KiB.", 400, false, "INVALID");
    if (this.db) {
      const bot = await this.db.botLibrary.findFirst({ where: { id: botId, ...ownerWhere(ownerUserId) }, include: { revisions: true } });
      if (!bot) throw new AppError("NOT_FOUND", "Không tìm thấy thư viện bot.", 404, false, "INVALID");
      const usedBytes = bot.revisions.reduce((sum: number, row: any) => sum + row.sourceBytes, 0);
      if ((await this.list(ownerUserId)).usedBytes + sourceBytes > LIBRARY_QUOTA_BYTES) throw new AppError("CONFLICT", "Dung lượng thư viện đã đầy. Hãy xoá revision cũ trước.", 409, false, "INVALID", { reason: "LIBRARY_QUOTA" });
      const identical = bot.revisions.find((row: any) => row.sourceDigest === digest(source));
      if (identical) throw new AppError("CONFLICT", "Mã nguồn này đã có trong bot. Hãy chọn revision hiện có.", 409, false, "INVALID");
      const validation = validateBotSource(source);
      const revisionNumber = Math.max(0, ...bot.revisions.map((row: any) => row.revisionNumber)) + 1;
      const row = await this.db.botRevision.create({ data: { botLibraryId: botId, revisionNumber, sdkVersion: validation.ok ? validation.sdkVersion : BOT_SDK_VERSION, schemaVersion: validation.ok ? validation.schemaVersion : BOT_STATE_SCHEMA_VERSION, sourceDigest: digest(source), sourceBytes, sourceText: source, status: validation.ok ? "READY" : "INVALID", validationCode: validation.ok ? null : validation.code, validationMessage: validation.ok ? null : validation.message, preflightMs: 0, sourceExpiresAt: sourceExpiry(ownerUserId) } });
      const revision = publicRevision({ ...row, botId, ownerUserId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), memoryPolicy: row.memoryPolicy, availability: ["ONLINE", "OFFLINE"], sourceExpiresAt: row.sourceExpiresAt ? iso(row.sourceExpiresAt) : null, source: row.sourceText });
      return { bot: { id: bot.id, name: bot.name, createdAt: iso(bot.createdAt), updatedAt: iso(row.updatedAt), usedBytes: usedBytes + sourceBytes, revisions: [...bot.revisions, row].map((entry: any) => publicRevision({ ...entry, botId, ownerUserId, createdAt: iso(entry.createdAt), updatedAt: iso(entry.updatedAt), memoryPolicy: entry.memoryPolicy, availability: ["ONLINE", "OFFLINE"], sourceExpiresAt: entry.sourceExpiresAt ? iso(entry.sourceExpiresAt) : null, source: entry.sourceText })) }, revision };
    }
    const bot = await this.findMemoryBot(ownerUserId, botId);
    if ((await this.list(ownerUserId)).usedBytes + sourceBytes > LIBRARY_QUOTA_BYTES) throw new AppError("CONFLICT", "Dung lượng thư viện đã đầy. Hãy xoá revision cũ trước.", 409, false, "INVALID", { reason: "LIBRARY_QUOTA" });
    const revision = this.buildRevision(ownerUserId, botId, bot.revisionRecords.length + 1, source);
    bot.revisionRecords.push(revision); bot.revisions.push(publicRevision(revision)); bot.usedBytes += sourceBytes; bot.updatedAt = revision.updatedAt;
    return { bot: publicBot(bot), revision: publicRevision(revision) };
  }

  async source(ownerUserId: string, botId: string, revisionId: string): Promise<string> {
    this.assertAccount(ownerUserId);
    if (this.db) {
      const row = await this.db.botRevision.findFirst({ where: { id: revisionId, botLibraryId: botId, botLibrary: ownerWhere(ownerUserId) }, include: { botLibrary: true } });
      if (!row) throw new AppError("UNAUTHORIZED", "Bạn không có quyền xem mã nguồn này.", 401, false, "FATAL_SESSION");
      if (row.sourceExpiresAt && new Date(row.sourceExpiresAt).getTime() <= Date.now() && !row.activeForMatchId) throw new AppError("NOT_FOUND", "Mã nguồn đã hết thời hạn truy cập.", 404, false, "INVALID");
      return row.sourceText;
    }
    const bot = [...this.memoryBots.values()].find((candidate) => candidate.id === botId);
    if (!bot || bot.ownerUserId !== ownerUserId) throw new AppError("UNAUTHORIZED", "Bạn không có quyền xem mã nguồn này.", 401, false, "FATAL_SESSION");
    const revision = bot.revisionRecords.find((candidate) => candidate.id === revisionId);
    if (!revision) throw new AppError("UNAUTHORIZED", "Bạn không có quyền xem mã nguồn này.", 401, false, "FATAL_SESSION");
    if (revision.sourceExpiresAt && new Date(revision.sourceExpiresAt).getTime() <= Date.now() && !revision.activeForMatchId) throw new AppError("NOT_FOUND", "Mã nguồn đã hết thời hạn truy cập.", 404, false, "INVALID");
    return revision.source;
  }

  async testRevision(ownerUserId: string, botId: string, revisionId: string): Promise<BotRevisionTestResponse> {
    this.assertAccount(ownerUserId);
    const source = await this.source(ownerUserId, botId, revisionId);
    const started = performance.now();
    const validation = validateBotSource(source);
    let passed = false;
    let validationCode: string | null = validation.ok ? null : validation.code;
    let validationMessage = validation.ok ? null : validation.message;
    const legalPreview: string[] = [];
    if (validation.ok) {
      if (this.preflightBusy) throw new AppError("CONFLICT", "Runtime đang bận. Hãy thử kiểm tra lại sau.", 409, false, "INVALID", { reason: "BOT_RUNTIME_BUSY" });
      this.preflightBusy = true;
      try {
        for (const side of ["BLUE", "RED"] as const) {
          const state = createBotTurnState({ ...createInitialState(), currentTurn: side }, side, [], { BLUE: DEFAULT_BOT_LIMITS.wholeMatchMs, RED: DEFAULT_BOT_LIMITS.wholeMatchMs }, 1);
          const result = await this.runtime.runTurn({ source, state, memory: null, seed: 42, phase: "PREFLIGHT" }, { aborted: false });
          legalPreview.push(`${side === "BLUE" ? "Xanh" : "Đỏ"}: ${result.move.from.toUpperCase()} → ${result.move.to.toUpperCase()}`);
        }
        passed = true;
      } catch (error) {
        if (!(error instanceof BotOutputValidationError)) throw new AppError("SERVICE_UNAVAILABLE", "Không thể kiểm tra bot an toàn lúc này. Hãy thử lại sau.", 503, true, "RECOVERABLE", { reason: "BOT_PREFLIGHT_UNAVAILABLE" });
        validationCode = "BOT_PREFLIGHT_FAILED";
        validationMessage = "Bot không hoàn tất nước thử hợp lệ trong ngân sách sandbox.";
        legalPreview.length = 0;
      } finally { this.preflightBusy = false; }
    }
    const preflightMs = Math.round(performance.now() - started);
    let revision: BotRevision;
    if (this.db) {
      const row = await this.db.botRevision.update({ where: { id: revisionId }, data: { status: passed ? "PASSED" : "FAILED", validationCode, validationMessage, preflightMs } });
      revision = publicRevision({ ...row, botId, ownerUserId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), memoryPolicy: row.memoryPolicy, availability: ["ONLINE", "OFFLINE"], sourceExpiresAt: row.sourceExpiresAt ? iso(row.sourceExpiresAt) : null, source: row.sourceText });
    } else {
      const bot = await this.findMemoryBot(ownerUserId, botId);
      const found = bot.revisionRecords.find((candidate) => candidate.id === revisionId);
      if (!found) throw new AppError("NOT_FOUND", "Không tìm thấy revision.", 404, false, "INVALID");
      found.status = passed ? "PASSED" : "FAILED"; found.preflightMs = preflightMs; found.validationCode = validationCode; found.validationMessage = validationMessage; found.updatedAt = new Date().toISOString();
      const publicValue = publicRevision(found); bot.revisions = bot.revisions.map((candidate) => candidate.id === revisionId ? publicValue : candidate); revision = publicValue;
    }
    return { revision, legalPreview, privateLog: [passed ? `Hai nước thử sandbox hợp lệ; tổng thời gian kiểm tra ${preflightMs}ms (gồm khởi tạo runtime).` : validationMessage ?? "Kiểm tra bot thất bại."] };
  }

  async deleteRevision(ownerUserId: string, botId: string, revisionId: string): Promise<void> {
    this.assertAccount(ownerUserId);
    if (this.protectedRevisionIds().includes(revisionId)) throw new AppError("CONFLICT", "Revision đang được trận sử dụng.", 409, false, "INVALID");
    if (this.db) {
      const row = await this.db.botRevision.findFirst({ where: { id: revisionId, botLibraryId: botId, botLibrary: ownerWhere(ownerUserId) } });
      if (!row) throw new AppError("NOT_FOUND", "Không tìm thấy revision.", 404, false, "INVALID");
      if (row.activeForMatchId || row.pendingForMatchId) throw new AppError("CONFLICT", "Revision đang được một trận sử dụng; hãy lưu bản mới cho trận sau.", 409, false, "INVALID", { reason: "ACTIVE_REFERENCE" });
      await this.db.botRevision.delete({ where: { id: revisionId } });
      return;
    }
    const bot = await this.findMemoryBot(ownerUserId, botId);
    const revision = bot.revisionRecords.find((candidate) => candidate.id === revisionId);
    if (!revision) throw new AppError("NOT_FOUND", "Không tìm thấy revision.", 404, false, "INVALID");
    if (revision.activeForMatchId || revision.pendingForMatchId) throw new AppError("CONFLICT", "Revision đang được một trận sử dụng; hãy lưu bản mới cho trận sau.", 409, false, "INVALID", { reason: "ACTIVE_REFERENCE" });
    bot.revisionRecords = bot.revisionRecords.filter((candidate) => candidate.id !== revisionId); bot.revisions = bot.revisions.filter((candidate) => candidate.id !== revisionId); bot.usedBytes = bot.revisionRecords.reduce((sum, candidate) => sum + candidate.sourceBytes, 0); bot.updatedAt = new Date().toISOString();
  }

  markRevisionActive(revisionId: string, matchId = "r9-test-match"): void {
    for (const bot of this.memoryBots.values()) for (const revision of bot.revisionRecords) if (revision.id === revisionId) revision.activeForMatchId = matchId;
  }

  sdkDocs(): BotSdkDocsResponse {
    return { sdkVersion: BOT_SDK_VERSION, schemaVersion: BOT_STATE_SCHEMA_VERSION, allowlist: ALLOWLIST, template: TEMPLATE, limits: { sourceBytes: DEFAULT_BOT_LIMITS.sourceBytes, memoryBytes: DEFAULT_BOT_LIMITS.memoryBytes, perTurnMs: DEFAULT_BOT_LIMITS.perTurnMs, wholeMatchMs: DEFAULT_BOT_LIMITS.wholeMatchMs } };
  }
}
