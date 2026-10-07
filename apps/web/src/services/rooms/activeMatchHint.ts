import type { MatchSnapshot } from "@ottv2/contracts";

const STORAGE_KEY = "ottv2:active-match-hint";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ActiveMatchHint = { roomId: string; mode: MatchSnapshot["mode"]; status: MatchSnapshot["status"]; updatedAt: number };

function readRaw(): ActiveMatchHint | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ActiveMatchHint>;
    if (typeof value.roomId !== "string" || typeof value.updatedAt !== "number" || typeof value.mode !== "string" || typeof value.status !== "string") return null;
    return value as ActiveMatchHint;
  } catch {
    return null;
  }
}

export function readActiveMatchHint(now = Date.now()): ActiveMatchHint | null {
  const hint = readRaw();
  if (!hint || now - hint.updatedAt > MAX_AGE_MS) {
    if (hint) clearActiveMatchHint();
    return null;
  }
  return hint;
}

export function saveActiveMatchHint(match: Pick<MatchSnapshot, "roomId" | "mode" | "status">): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...match, updatedAt: Date.now() } satisfies ActiveMatchHint));
    window.dispatchEvent(new CustomEvent("ottv2:active-match-hint"));
  } catch {
    // Resume is an enhancement; server state remains authoritative.
  }
}

export function clearActiveMatchHint(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("ottv2:active-match-hint"));
  } catch {
    // Ignore storage failures; opening the room still performs server auth.
  }
}
