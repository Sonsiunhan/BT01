import type { MatchmakingMode, MatchmakingSnapshot } from "@ottv2/contracts";
import { cancelQueue, getQueue, joinMatchmakingQueue, joinRankedQueue } from "./matchmakingApi";

type Admission = {
  promise: Promise<{ queue: MatchmakingSnapshot }>;
  consumers: number;
  snapshot?: MatchmakingSnapshot;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};
export type QueueAdmissionLease = {
  promise: Admission["promise"];
  update: (snapshot: MatchmakingSnapshot) => void;
  release: () => void;
};
const currentByMode = new Map<MatchmakingMode, Admission>();
let cleanup: Promise<unknown> = Promise.resolve();

/** StrictMode/remount transfers the same admission instead of cancelling its replacement. */
export function acquireQueueAdmission(mode: MatchmakingMode = "RANKED"): QueueAdmissionLease {
  let current = currentByMode.get(mode);
  if (!current) {
    const admission: Admission = { consumers: 0, promise: cleanup.then(() => mode === "RANKED" ? joinRankedQueue() : joinMatchmakingQueue(mode)) };
    admission.promise.then(({ queue }) => { admission.snapshot ??= queue; }).catch(() => undefined);
    currentByMode.set(mode, admission);
    current = admission;
  }
  if (!current) throw new Error("Không thể khởi tạo hàng chờ.");
  const admission = current;
  admission.consumers += 1;
  if (admission.cleanupTimer !== undefined) clearTimeout(admission.cleanupTimer);
  let released = false;
  return {
    promise: admission.promise,
    update: (snapshot) => {
      if (admission.snapshot && admission.snapshot.queueId !== snapshot.queueId) return;
      if (admission.snapshot && admission.snapshot.status !== "QUEUED" && snapshot.status !== admission.snapshot.status) return;
      admission.snapshot = snapshot;
    },
    release: () => {
      if (released) return;
      released = true;
      admission.consumers -= 1;
      if (admission.consumers !== 0) return;
      admission.cleanupTimer = setTimeout(() => {
        if (admission.consumers !== 0) return;
        if (currentByMode.get(mode) === admission) currentByMode.delete(mode);
        // Await the pending POST: discarding its response can orphan a server entry.
        cleanup = admission.promise.then(async ({ queue }) => {
          if ((admission.snapshot ?? queue).status !== "QUEUED") return;
          try { admission.snapshot = (await cancelQueue(queue.queueId)).queue; }
          catch {
            // Matching or a lost response can win the race. Never undo a match.
            try { admission.snapshot = (await getQueue(queue.queueId)).queue; }
            catch { /* A subsequent admission reconciles using the server's client identity. */ }
          }
        }).catch(() => undefined);
      }, 0);
    },
  };
}
