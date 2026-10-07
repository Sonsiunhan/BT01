import {
  clearBotOfflineSession,
  clearGuestProfile,
  clearImportDecision,
  clearLocalHistory,
  clearLocalSession,
  getBotOfflineSession,
  getGuestProfile,
  getLocalHistory,
  getLocalSession,
  type BotOfflineSessionSnapshot,
  type GuestProfile,
  type LocalHistoryRecord,
  type LocalMode,
  type LocalSessionSnapshot,
} from "./localGameStorage";
import { clearOfflineKit, getOfflineKitStatus, type OfflineKitStatus } from "./offlineKit";
import { updateGuestBotVault, type GuestBotVault } from "../bot-library/guestBotStore";

export const LOCAL_DATA_CATEGORIES = [
  "Guest identity",
  "Local saves",
  "Local history",
  "Bot Offline library",
  "Offline cache",
] as const;

export type LocalDataCategory = typeof LOCAL_DATA_CATEGORIES[number];
export type LocalDataSummary = {
  categories: readonly LocalDataCategory[];
  counts: { history: number; saves: number; library: number };
  activeSession: { mode: string } | null;
  offlineKit: OfflineKitStatus;
};
export type LocalDataExport = {
  schemaVersion: 1;
  exportedAt: string;
  scope: "LOCAL_DEVICE_ONLY";
  categories: readonly LocalDataCategory[];
  guestProfile: GuestProfile | null;
  history: LocalHistoryRecord[];
  saves: Partial<Record<LocalMode, LocalSessionSnapshot>>;
  botOfflineSession: BotOfflineSessionSnapshot | null;
  guestBotLibrary: GuestBotVault | null;
  offlineKit: OfflineKitStatus;
};

export class LocalDataError extends Error {
  constructor(public readonly code: "ACTIVE_LOCAL_SESSION", message = "Hãy tạm dừng hoặc kết thúc trận local trước khi xóa dữ liệu trên thiết bị.") {
    super(message);
    this.name = "LocalDataError";
  }
}

type ActiveHint = { mode?: unknown; state?: { status?: unknown } };

function readActiveHint(): { mode: string } | null {
  try {
    const raw = globalThis.localStorage?.getItem("ottv2.local.active-session");
    if (!raw) return null;
    const value = JSON.parse(raw) as ActiveHint;
    return value.state?.status === "PLAYING" ? { mode: typeof value.mode === "string" ? value.mode : "LOCAL" } : null;
  } catch { return null; }
}

async function findActiveLocalSession(): Promise<{ mode: string } | null> {
  const hinted = readActiveHint();
  if (hinted) return hinted;
  for (const mode of ["GUEST", "AI", "OFFLINE"] as const) {
    const snapshot = await getLocalSession(mode);
    if (snapshot?.state?.status === "PLAYING") return { mode };
  }
  const bot = await getBotOfflineSession();
  if (bot && (bot.status === "RUNNING" || bot.state?.status === "PLAYING")) return { mode: "BOT_OFFLINE" };
  return null;
}

async function readLocalSnapshot() {
  const guestBotLibrary = typeof indexedDB === "undefined" ? null : await updateGuestBotVault(vault => structuredClone(vault), false);
  const [guestProfile, history, botOfflineSession, ...sessions] = await Promise.all([
    getGuestProfile(), getLocalHistory(), getBotOfflineSession(),
    getLocalSession("GUEST"), getLocalSession("AI"), getLocalSession("OFFLINE"),
  ]);
  const saves: Partial<Record<LocalMode, LocalSessionSnapshot>> = {};
  ([("GUEST"), ("AI"), ("OFFLINE")] as const).forEach((mode, index) => {
    const session = sessions[index];
    if (session) saves[mode] = session;
  });
  return { guestProfile, history, botOfflineSession, saves, guestBotLibrary };
}

export async function getLocalDataSummary(): Promise<LocalDataSummary> {
  const [snapshot, offlineKit, activeSession] = await Promise.all([readLocalSnapshot(), getOfflineKitStatus(), findActiveLocalSession()]);
  return {
    categories: LOCAL_DATA_CATEGORIES,
    counts: { history: snapshot.history.length, saves: Object.keys(snapshot.saves).length, library: (snapshot.guestBotLibrary?.bots.reduce((sum, bot) => sum + bot.revisions.length, 0) ?? 0) + (snapshot.botOfflineSession ? 1 : 0) },
    activeSession,
    offlineKit,
  };
}

export async function exportLocalData(): Promise<LocalDataExport> {
  const [snapshot, offlineKit] = await Promise.all([readLocalSnapshot(), getOfflineKitStatus()]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    scope: "LOCAL_DEVICE_ONLY",
    categories: LOCAL_DATA_CATEGORIES,
    ...snapshot,
    offlineKit,
  };
}

export async function clearLocalData(): Promise<void> {
  const active = await findActiveLocalSession();
  if (active) throw new LocalDataError("ACTIVE_LOCAL_SESSION");
  if (typeof indexedDB !== "undefined") await updateGuestBotVault(vault => { vault.bots = []; vault.sources = {}; vault.nextRevision = {}; });
  await Promise.all([
    clearGuestProfile(), clearLocalHistory(), clearImportDecision(),
    clearLocalSession("GUEST"), clearLocalSession("AI"), clearLocalSession("OFFLINE"), clearBotOfflineSession(), clearOfflineKit(),
  ]);
  try { globalThis.localStorage?.removeItem("ottv2.local.active-session"); } catch { /* storage can be unavailable */ }
}
