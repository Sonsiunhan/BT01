import { AppError } from "../../../shared/errors/app-error.js";

export type LaneTask<T = unknown> = () => Promise<T> | T;

export interface LaneOptions {
  roomId: string;
  maxQueueDepth?: number;
}

export class MatchLane {
  readonly roomId: string;
  private readonly maxQueueDepth: number;
  private readonly queue: Array<{
    task: LaneTask;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    enqueuedAt: number;
  }> = [];
  private isProcessing = false;
  private isUnknownLocked = false;
  private lockReason: string | null = null;

  constructor(options: LaneOptions) {
    this.roomId = options.roomId;
    this.maxQueueDepth = options.maxQueueDepth ?? 50;
  }

  get queueDepth(): number {
    return this.queue.length;
  }

  get isLocked(): boolean {
    return this.isUnknownLocked;
  }

  get isBusy(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }

  lockOnUnknown(reason = "COMMIT_UNKNOWN"): void {
    this.isUnknownLocked = true;
    this.lockReason = reason;
  }

  unlock(): void {
    this.isUnknownLocked = false;
    this.lockReason = null;
  }

  async enqueue<T>(task: LaneTask<T>): Promise<T> {
    if (this.isUnknownLocked) {
      throw new AppError(
        "CONFLICT",
        `Trận đấu bị khóa tạm thời do giao dịch chưa xác định: ${this.lockReason}`,
        409,
        true,
        "RECOVERABLE",
        { reason: "LANE_UNKNOWN_LOCKED" }
      );
    }

    if (this.queue.length >= this.maxQueueDepth) {
      throw new AppError(
        "RATE_LIMITED",
        "Hàng đợi lệnh của trận đấu đã đầy. Vui lòng thử lại sau.",
        429,
        true,
        "RECOVERABLE",
        { reason: "LANE_QUEUE_FULL", depth: this.queue.length }
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as LaneTask,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      });

      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      if (this.isUnknownLocked) {
        item.reject(
          new AppError(
            "CONFLICT",
            `Trận đấu bị khóa tạm thời: ${this.lockReason}`,
            409,
            true,
            "RECOVERABLE",
            { reason: "LANE_UNKNOWN_LOCKED" }
          )
        );
        continue;
      }

      try {
        // Yield to event loop for fairness across concurrent matches
        await new Promise<void>((resolve) => setImmediate(resolve));
        const result = await item.task();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }

    this.isProcessing = false;
  }

  clear(): void {
    const error = new AppError("CONFLICT", "Hàng đợi bị xóa do ván đấu kết thúc hoặc hủy.", 409, false, "INVALID", {
      reason: "LANE_CLEARED",
    });
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      item?.reject(error);
    }
    this.isProcessing = false;
  }
}
