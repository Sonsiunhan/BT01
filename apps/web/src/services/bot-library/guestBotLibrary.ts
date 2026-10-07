import { BotLibraryCreateRequestSchema, BotRevisionCreateRequestSchema, type BotLibraryListResponse, type BotRevision, type BotRevisionTestResponse } from "@ottv2/contracts";
import { BOT_SDK_VERSION, BOT_STATE_SCHEMA_VERSION, DEFAULT_BOT_LIMITS, createBotTurnState, validateBotSource } from "@ottv2/bot-sdk";
import { createInitialState } from "@ottv2/game-rules";
import { runOfflineBotTurn } from "../bot-offline/botOfflineRunner";
import { updateGuestBotVault, type GuestBotVault } from "./guestBotStore";
import { getBotOfflineSession } from "../local/localGameStorage";

const QUOTA = 262144;
const template = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
function library(vault: GuestBotVault): BotLibraryListResponse {
  return { bots: structuredClone(vault.bots), quotaBytes: QUOTA, usedBytes: vault.bots.reduce((sum, bot) => sum + bot.usedBytes, 0) };
}
function owned(vault: GuestBotVault, botId: string, revisionId?: string) {
  const bot = vault.bots.find(bot => bot.id === botId);
  const revision = revisionId ? bot?.revisions.find(revision => revision.id === revisionId) : undefined;
  if (!bot || revisionId && !revision) throw new Error("Không tìm thấy revision trong thư viện Guest của trình duyệt này.");
  return { bot, revision };
}
async function revision(source: string, number: number): Promise<BotRevision> {
  const validation = validateBotSource(source);
  if (!validation.ok) throw new Error(validation.message);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const now = new Date().toISOString();
  return { id: `guest-rev:${crypto.randomUUID()}`, revisionNumber: number, status: "READY", sdkVersion: BOT_SDK_VERSION, schemaVersion: BOT_STATE_SCHEMA_VERSION, sourceDigest: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join(""), sourceBytes: validation.sourceBytes, createdAt: now, updatedAt: now, memoryPolicy: "RESET_ON_NEW_REVISION", availability: ["OFFLINE", "ONLINE"] };
}
export const guestBotLibraryApi = {
  async getBotLibrary(signal?: AbortSignal) { if (signal?.aborted) throw new Error("Đã hủy tải thư viện."); return updateGuestBotVault(library, false); },
  async getBotSdkDocs() { return { sdkVersion: BOT_SDK_VERSION, schemaVersion: BOT_STATE_SCHEMA_VERSION, allowlist: ["collections", "functools", "heapq", "itertools", "json", "math", "statistics", "typing"], template, limits: DEFAULT_BOT_LIMITS }; },
  async getBotSource(botId: string, revisionId: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("Đã hủy đọc source.");
    return updateGuestBotVault(vault => { owned(vault, botId, revisionId); if (!Object.hasOwn(vault.sources, revisionId)) throw new Error("Không còn source của revision này."); return { botId, revisionId, source: vault.sources[revisionId]! }; }, false);
  },
  async createBot(input: { name: string; source: string }) {
    const parsed = BotLibraryCreateRequestSchema.parse(input);
    const next = await revision(parsed.source, 1);
    return updateGuestBotVault(vault => {
      if (library(vault).usedBytes + next.sourceBytes > QUOTA) throw new Error("Thư viện Guest vượt 256 KiB. Xuất và xóa revision cũ trước.");
      const bot = { id: `guest-bot:${crypto.randomUUID()}`, name: parsed.name, createdAt: next.createdAt, updatedAt: next.updatedAt, usedBytes: next.sourceBytes, revisions: [next] };
      vault.bots.unshift(bot); vault.sources[next.id] = parsed.source; vault.nextRevision[bot.id] = 2;
      return { bot: structuredClone(bot), revision: next };
    });
  },
  async createBotRevision(botId: string, input: { source: string }) {
    const parsed = BotRevisionCreateRequestSchema.parse(input);
    const next = await revision(parsed.source, 1);
    return updateGuestBotVault(vault => {
      const { bot } = owned(vault, botId);
      if (library(vault).usedBytes + next.sourceBytes > QUOTA) throw new Error("Thư viện Guest vượt 256 KiB.");
      next.revisionNumber = vault.nextRevision[botId] ?? Math.max(0, ...bot.revisions.map(item => item.revisionNumber)) + 1;
      vault.nextRevision[botId] = next.revisionNumber + 1;
      bot.revisions.unshift(next); bot.usedBytes += next.sourceBytes; bot.updatedAt = next.updatedAt; vault.sources[next.id] = parsed.source;
      return { bot: structuredClone(bot), revision: next };
    });
  },
  async testBotRevision(botId: string, revisionId: string): Promise<BotRevisionTestResponse> {
    const { source } = await guestBotLibraryApi.getBotSource(botId, revisionId);
    const state = createBotTurnState(createInitialState(), "BLUE", [], { BLUE: 30000, RED: 30000 }, 1);
    const tested = await runOfflineBotTurn({ source, state, memory: null, preflight: true });
    return updateGuestBotVault(vault => {
      const { revision: current } = owned(vault, botId, revisionId);
      current!.status = "PASSED"; current!.preflightMs = Math.ceil(tested.computeMs); current!.updatedAt = new Date().toISOString();
      return { revision: structuredClone(current!), legalPreview: [`${tested.move.from} → ${tested.move.to}`], privateLog: ["Preflight cô lập đạt; mã nguồn/bộ nhớ chỉ ở thư viện local của bạn."] };
    });
  },
  async deleteBotRevision(botId: string, revisionId: string): Promise<void> {
    const checkpoint = await getBotOfflineSession();
    if (checkpoint && checkpoint.status !== "FINISHED" && [...Object.values(checkpoint.slots), ...Object.values(checkpoint.pendingSlots ?? {})].some(slot => slot.revision === revisionId)) throw new Error("Revision đang được checkpoint tham chiếu. Kết thúc hoặc xóa phiên trước.");
    await updateGuestBotVault(vault => { const { bot, revision: current } = owned(vault, botId, revisionId); bot.usedBytes -= current!.sourceBytes; bot.revisions = bot.revisions.filter(item => item.id !== revisionId); delete vault.sources[revisionId]; });
  },
};
