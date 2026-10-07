import { useState } from "react";
import type { BotOnlineSnapshot } from "@ottv2/contracts";
import { uploadBotOnline } from "../../services/bot-online/botOnlineApi";

export function BotRevisionUpload({ roomId, snapshot, connected }: { roomId: string; snapshot: BotOnlineSnapshot | null; connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const owner = snapshot?.players.find(player => player.owner);
  if (!owner?.botId) return null;
  const locked = !connected || snapshot?.status !== "PLAYING" || snapshot.runtimeState === "UNAVAILABLE";
  const upload = async (file: File | undefined) => {
    if (!file || locked || busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".py") || file.size > 64 * 1024) throw new Error("Chọn tệp .py UTF-8 tối đa 64 KiB.");
      const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const result = await uploadBotOnline(roomId, { botId: owner.botId!, source });
      const updated = result.snapshot.players.find(player => player.owner);
      setNotice(updated?.pendingRevisionNumber ? `Đã kiểm tra r${updated.pendingRevisionNumber}; chờ lượt kế tiếp của bạn. Trận không tạm dừng.` : "Đã lưu phiên bản. Kiểm tra trạng thái trận trước khi áp dụng.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải chiến thuật mới."); }
    finally { setBusy(false); }
  };
  return <section className="bot-strategy-upload" aria-label="Cập nhật chiến thuật riêng">
    <label>Tải bản mới<input aria-label="Tải chiến thuật Python mới" type="file" accept=".py" disabled={busy || locked} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></label>
    <p>{busy ? "Đang kiểm tra sandbox… Bản active vẫn giữ nguyên." : locked ? "Chỉ cập nhật khi trận đang chạy và kết nối ổn định." : "Tệp .py ≤64 KiB. Bản hợp lệ thay pending cũ; đổi revision mặc định reset bộ nhớ."}</p>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
