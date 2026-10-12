export type DeadlineCategory =
  | "TURN"
  | "COUNTDOWN"
  | "RESUME"
  | "DISCONNECT"
  | "REFEREE_PAUSE"
  | "REPLACEMENT";

export interface ScheduledDeadline {
  roomId: string;
  key: string;
  category: DeadlineCategory;
  dueAt: number;
  onDue: () => void | Promise<void>;
  metadata?: Record<string, unknown>;
}

export class DeadlineScheduler {
  private readonly registeredRooms = new Set<string>();
  private readonly deadlines = new Map<string, Map<string, { deadline: ScheduledDeadline; timer?: NodeJS.Timeout }>>();
  private readonly roomTimers = new Map<string, NodeJS.Timeout>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  registerRoom(roomId: string): void {
    this.registeredRooms.add(roomId);
  }

  unregisterRoom(roomId: string): void {
    this.registeredRooms.delete(roomId);
    this.clearRoom(roomId);
  }

  has(roomId: string, key?: string): boolean {
    if (key !== undefined) {
      return this.deadlines.get(roomId)?.has(key) ?? false;
    }
    return (
      this.registeredRooms.has(roomId) ||
      this.roomTimers.has(roomId) ||
      (this.deadlines.get(roomId)?.size ?? 0) > 0
    );
  }

  startRoom(roomId: string, onTick: () => void, intervalMs = 1_000): void {
    this.registerRoom(roomId);
    if (this.roomTimers.has(roomId)) return;
    const timer = setInterval(() => {
      try {
        onTick();
      } catch {
        // Silently catch errors in background tick to prevent loop breakage
      }
    }, intervalMs);
    timer.unref?.();
    this.roomTimers.set(roomId, timer);
  }

  stopRoom(roomId: string): void {
    const timer = this.roomTimers.get(roomId);
    if (timer) clearInterval(timer);
    this.roomTimers.delete(roomId);
  }

  schedule(deadline: ScheduledDeadline): void {
    this.registerRoom(deadline.roomId);
    let roomMap = this.deadlines.get(deadline.roomId);
    if (!roomMap) {
      roomMap = new Map();
      this.deadlines.set(deadline.roomId, roomMap);
    }

    const existing = roomMap.get(deadline.key);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const delay = Math.max(0, deadline.dueAt - this.now());
    const timer = setTimeout(() => {
      this.cancel(deadline.roomId, deadline.key);
      try {
        void deadline.onDue();
      } catch {
        // Error handled in consumer
      }
    }, delay);
    timer.unref?.();

    roomMap.set(deadline.key, { deadline, timer });
  }

  cancel(roomId: string, key: string): boolean {
    const roomMap = this.deadlines.get(roomId);
    if (!roomMap) return false;
    const entry = roomMap.get(key);
    if (!entry) return false;
    if (entry.timer) clearTimeout(entry.timer);
    roomMap.delete(key);
    if (roomMap.size === 0) this.deadlines.delete(roomId);
    return true;
  }

  cancelCategory(roomId: string, category: DeadlineCategory): void {
    const roomMap = this.deadlines.get(roomId);
    if (!roomMap) return;
    for (const [key, entry] of [...roomMap.entries()]) {
      if (entry.deadline.category === category) {
        if (entry.timer) clearTimeout(entry.timer);
        roomMap.delete(key);
      }
    }
    if (roomMap.size === 0) this.deadlines.delete(roomId);
  }

  getDeadlines(roomId: string): ScheduledDeadline[] {
    const roomMap = this.deadlines.get(roomId);
    if (!roomMap) return [];
    return [...roomMap.values()].map((e) => e.deadline);
  }

  clearRoom(roomId: string): void {
    this.stopRoom(roomId);
    const roomMap = this.deadlines.get(roomId);
    if (roomMap) {
      for (const entry of roomMap.values()) {
        if (entry.timer) clearTimeout(entry.timer);
      }
      this.deadlines.delete(roomId);
    }
  }

  stop(): void {
    for (const roomId of [...this.roomTimers.keys()]) {
      this.stopRoom(roomId);
    }
    for (const roomMap of this.deadlines.values()) {
      for (const entry of roomMap.values()) {
        if (entry.timer) clearTimeout(entry.timer);
      }
    }
    this.deadlines.clear();
    this.registeredRooms.clear();
  }
}
