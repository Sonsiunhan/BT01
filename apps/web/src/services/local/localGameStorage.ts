import type { RuleState, Side } from "@ottv2/game-rules";
import { getClientId, guestDisplayName } from "../session/clientIdentity";
import type { BotMoveRecord } from "@ottv2/bot-sdk";

export type LocalMode = "GUEST" | "AI" | "OFFLINE";
export type LocalResult = "WIN" | "LOSS" | "DRAW";

export type LocalHistoryRecord = {
  localId: string;
  mode: LocalMode | "BOT_ONLINE";
  result: LocalResult;
  playerName: string;
  opponentName: string;
  timerSeconds: number;
  durationSeconds: number;
  endedAt: string;
  scoreDelta: number;
};

export type GuestProfile = { displayName: string };
export type LocalSessionStats = { moves: number; captures: number; piecesLost: number };
export type BotOfflineMemoryPolicy = "RESET_ON_NEW_REVISION" | "PRESERVE_IF_COMPATIBLE";
export type BotOfflineSlotSnapshot = {
  source: string;
  fileName: string;
  revision: string;
  ready: boolean;
  /** Declared by the source; never inferred from an arbitrary memory value. */
  memorySchema?: string | null;
  /** Explicit user choice for a pending revision. */
  memoryPolicy?: BotOfflineMemoryPolicy;
};
export type BotOfflineSessionSnapshot = {
  state: RuleState;
  clocks: Record<Side, number>;
  history: readonly BotMoveRecord[];
  memories: Record<Side, unknown>;
  slots: Record<Side, BotOfflineSlotSnapshot>;
  status: "PAUSED" | "RUNNING" | "FINISHED";
  speedMs: number;
  savedAt: string;
  activeComputeMs?: number;
  endingReason?: string;
  pendingSlots?: Partial<Record<Side, BotOfflineSlotSnapshot>>;
  limitCriteria?: { BLUE: { N: number; P: number; M: number }; RED: { N: number; P: number; M: number } };
};
export type LocalSessionSnapshot = {
  mode: LocalMode;
  setup: { blueName: string; redName: string; timerSeconds: number };
  state: RuleState;
  clocks: Record<Side, number>;
  remaining: number;
  stats?: LocalSessionStats;
  savedAt: string;
};
type ImportDecision = "IMPORTED" | "DECLINED";

const DB_NAME = "ottv2-local";
const DB_VERSION = 1;
const HISTORY_STORE = "history";
const META_STORE = "meta";
const PROFILE_KEY = "guest-profile";
const IMPORT_KEY = "guest-import-decision";
const GUEST_SESSION_MIGRATION_KEY = "guest-session-migration-v1";
const FALLBACK_HISTORY = "ottv2.local.history";
const FALLBACK_PROFILE = "ottv2.local.profile";
const FALLBACK_IMPORT = "ottv2.local.import";
const SESSION_PREFIX = "local-session:";
const BOT_OFFLINE_SESSION_KEY = "local-session:BOT_OFFLINE";

function fallbackGet<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function fallbackSet<T>(key: string, value: T): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable in private mode */ }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("INDEXED_DB_UNAVAILABLE")); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_OPEN_FAILED"));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_REQUEST_FAILED"));
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("INDEXED_DB_TRANSACTION_FAILED")); };
  });
}

export async function getGuestProfile(): Promise<GuestProfile | null> {
  let profile: GuestProfile | null = null;
  try { profile = (await withStore<GuestProfile | undefined>(META_STORE, "readonly", (store) => store.get(PROFILE_KEY))) ?? null; }
  catch { profile = fallbackGet<GuestProfile | null>(FALLBACK_PROFILE, null); }
  if (profile?.displayName?.trim()) return profile;
  const generated = { displayName: guestDisplayName(getClientId()) };
  await setGuestProfile(generated);
  return generated;
}

export async function setGuestProfile(profile: GuestProfile): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.put(profile, PROFILE_KEY)); }
  catch { fallbackSet(FALLBACK_PROFILE, profile); }
}

/** Remove the device-only Guest identity without touching an authenticated account. */
export async function clearGuestProfile(): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.delete(PROFILE_KEY)); }
  catch { try { globalThis.localStorage?.removeItem(FALLBACK_PROFILE); } catch { /* storage can be unavailable */ } }
}

export async function getLocalHistory(): Promise<LocalHistoryRecord[]> {
  try { return await withStore<LocalHistoryRecord[]>(HISTORY_STORE, "readonly", (store) => store.getAll()); }
  catch { return fallbackGet<LocalHistoryRecord[]>(FALLBACK_HISTORY, []); }
}

export async function addLocalHistory(record: LocalHistoryRecord): Promise<void> {
  try { await withStore(HISTORY_STORE, "readwrite", (store) => store.put(record)); }
  catch {
    const records = fallbackGet<LocalHistoryRecord[]>(FALLBACK_HISTORY, []).filter((item) => item.localId !== record.localId);
    fallbackSet(FALLBACK_HISTORY, [record, ...records]);
  }
  // Notify only after the IndexedDB transaction (or fallback write) finishes;
  // the history page may have opened while the terminal summary was pending.
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ottv2:local-history-changed"));
}

export async function getImportDecision(): Promise<ImportDecision | null> {
  try { return (await withStore<ImportDecision | undefined>(META_STORE, "readonly", (store) => store.get(IMPORT_KEY))) ?? null; }
  catch { return fallbackGet<ImportDecision | null>(FALLBACK_IMPORT, null); }
}

export async function setImportDecision(decision: ImportDecision): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.put(decision, IMPORT_KEY)); }
  catch { fallbackSet(FALLBACK_IMPORT, decision); }
}

export async function clearImportDecision(): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.delete(IMPORT_KEY)); }
  catch { try { globalThis.localStorage?.removeItem(FALLBACK_IMPORT); } catch { /* storage can be unavailable */ } }
}

export async function getLocalSession(mode: LocalMode): Promise<LocalSessionSnapshot | null> {
  const key = `${SESSION_PREFIX}${mode}`;
  try { return (await withStore<LocalSessionSnapshot | undefined>(META_STORE, "readonly", (store) => store.get(key))) ?? null; }
  catch { return fallbackGet<LocalSessionSnapshot | null>(key, null); }
}

export async function setLocalSession(session: LocalSessionSnapshot): Promise<void> {
  const key = `${SESSION_PREFIX}${session.mode}`;
  try { await withStore(META_STORE, "readwrite", (store) => store.put(session, key)); }
  catch { fallbackSet(key, session); }
}

export async function clearLocalSession(mode: LocalMode): Promise<void> {
  const key = `${SESSION_PREFIX}${mode}`;
  try {
    await withStore(META_STORE, "readwrite", (store) => store.delete(key));
  } catch {
    try { globalThis.localStorage?.removeItem(key); } catch { /* storage can be unavailable in private mode */ }
  }
}

/** Bot Offline checkpoint is local-only and is always restored paused. */
export async function getBotOfflineSession(): Promise<BotOfflineSessionSnapshot | null> {
  try { return (await withStore<BotOfflineSessionSnapshot | undefined>(META_STORE, "readonly", (store) => store.get(BOT_OFFLINE_SESSION_KEY))) ?? null; }
  catch { return fallbackGet<BotOfflineSessionSnapshot | null>(BOT_OFFLINE_SESSION_KEY, null); }
}

export async function setBotOfflineSession(session: BotOfflineSessionSnapshot): Promise<void> {
  // Freeze the checkpoint before opening IndexedDB asynchronously: live refs may
  // advance while the database connection opens.
  const paused = structuredClone({ ...session, status: session.status === "FINISHED" ? "FINISHED" as const : "PAUSED" as const, savedAt: new Date().toISOString() });
  try { await withStore(META_STORE, "readwrite", (store) => store.put(paused, BOT_OFFLINE_SESSION_KEY)); }
  catch {
    try {
      if (!globalThis.localStorage) throw new Error("LOCAL_STORAGE_UNAVAILABLE");
      globalThis.localStorage.setItem(BOT_OFFLINE_SESSION_KEY, JSON.stringify(paused));
    } catch {
      throw new Error("LOCAL_STORAGE_QUOTA");
    }
  }
}

export async function clearBotOfflineSession(): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.delete(BOT_OFFLINE_SESSION_KEY)); }
  catch { try { globalThis.localStorage?.removeItem(BOT_OFFLINE_SESSION_KEY); } catch { /* storage can be unavailable */ } }
}

export async function migrateLegacyGuestSessionToOffline(): Promise<LocalSessionSnapshot | null> {
  const migratedAlready = await readMetaValue<string>(GUEST_SESSION_MIGRATION_KEY);
  if (migratedAlready === "DONE") return null;
  const current = await getLocalSession("OFFLINE");
  if (current) {
    if (await getLocalSession("GUEST")) await writeMetaValue(GUEST_SESSION_MIGRATION_KEY, "DONE");
    return current;
  }
  const legacy = await getLocalSession("GUEST");
  if (!legacy) return null;
  const migrated = { ...legacy, mode: "OFFLINE" as const };
  await setLocalSession(migrated);
  await writeMetaValue(GUEST_SESSION_MIGRATION_KEY, "DONE");
  return migrated;
}

async function readMetaValue<T>(key: string): Promise<T | null> {
  try { return (await withStore<T | undefined>(META_STORE, "readonly", (store) => store.get(key))) ?? null; }
  catch { return fallbackGet<T | null>(`ottv2.local.meta.${key}`, null); }
}

async function writeMetaValue<T>(key: string, value: T): Promise<void> {
  try { await withStore(META_STORE, "readwrite", (store) => store.put(value, key)); }
  catch { fallbackSet(`ottv2.local.meta.${key}`, value); }
}

export async function clearGuestHistory(): Promise<void> {
  const records = await getLocalHistory();
  const keep = records.filter((record) => record.mode !== "GUEST");
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(HISTORY_STORE, "readwrite");
      const store = transaction.objectStore(HISTORY_STORE);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    });
    await Promise.all(keep.map((record) => withStore(HISTORY_STORE, "readwrite", (store) => store.put(record))));
  } catch { fallbackSet(FALLBACK_HISTORY, keep); }
}

/** Clear every device-only history record. Account/cloud history is never stored here. */
export async function clearLocalHistory(): Promise<void> {
  try {
    await withStore(HISTORY_STORE, "readwrite", (store) => store.clear());
  } catch {
    try { globalThis.localStorage?.removeItem(FALLBACK_HISTORY); } catch { /* storage can be unavailable */ }
  }
}
