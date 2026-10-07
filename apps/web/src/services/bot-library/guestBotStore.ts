import type { BotLibraryItem } from "@ottv2/contracts";

export type GuestBotVault = { bots: BotLibraryItem[]; sources: Record<string, string>; nextRevision: Record<string, number> };
/** Single read/write transaction serializes quota/revision changes across tabs. */
export function updateGuestBotVault<T>(change: (vault: GuestBotVault) => T, write = true): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Bộ nhớ thư viện Guest không khả dụng trên trình duyệt này.")); return; }
    const opening = indexedDB.open("ottv2-guest-bots", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("vault");
    opening.onerror = () => reject(new Error("Không thể mở thư viện Guest trên thiết bị."));
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction("vault", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("vault");
      let result: T;
      let failure: unknown;
      const request = store.get("library");
      request.onsuccess = () => {
        try {
          const vault: GuestBotVault = request.result ?? { bots: [], sources: {}, nextRevision: {} };
          result = change(vault);
          if (write) store.put(vault, "library");
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(failure ?? new Error("Không thể lưu thư viện Guest. Kiểm tra dung lượng thiết bị.")); };
    };
  });
}
