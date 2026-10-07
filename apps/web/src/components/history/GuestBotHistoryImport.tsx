import { useEffect, useState } from "react";
import { GuestBotMatchRecordSchema, GuestBotHistoryArchiveSchema, type GuestBotMatchRecord } from "@ottv2/contracts";
import { Button, Modal } from "../ui";
import { getImportedGuestBotHistory, importGuestBotHistory } from "../../services/guest/guestApi";
import type { LocalHistoryRecord } from "../../services/local/localGameStorage";

/** Account-only archive of explicitly imported, unverified device summaries. */
export function GuestBotHistoryImport({ records }: { records: LocalHistoryRecord[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [archive, setArchive] = useState<GuestBotMatchRecord[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState<GuestBotMatchRecord[]>([]);
  const candidates = records.filter(record => record.mode === "BOT_ONLINE").sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 100);
  function openPreview() {
    setError("");
    try {
      // Freeze exactly the whitelisted summaries reviewed in this dialog.
      setPreview(candidates.map(({ localId, result, playerName, opponentName, timerSeconds, durationSeconds, endedAt }) => GuestBotMatchRecordSchema.parse({ localId, mode: "BOT_ONLINE", result, playerName, opponentName, timerSeconds, durationSeconds, endedAt, scoreDelta: 0 })));
      setOpen(true);
    } catch { setError("Tóm tắt trên thiết bị không hợp lệ để nhập. Dữ liệu được giữ nguyên."); }
  }
  useEffect(() => {
    const controller = new AbortController();
    getImportedGuestBotHistory(controller.signal).then(result => {
      if (!controller.signal.aborted) setArchive(GuestBotHistoryArchiveSchema.parse(result).records);
    }).catch(() => { if (!controller.signal.aborted) setError("Không tải được lịch sử Guest đã nhập. Hãy thử lại."); });
    return () => controller.abort();
  }, [refresh]);
  async function confirm() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const saved = await importGuestBotHistory(preview);
      setMessage(`Đã nhập ${saved.importedCount}; bỏ qua ${saved.skippedCount} bản trùng. Dữ liệu thiết bị được giữ nguyên.`);
      setOpen(false); setRefresh(current => current + 1);
    } catch { setError("Không thể nhập tóm tắt. Dữ liệu thiết bị được giữ nguyên; bạn có thể thử lại."); }
    finally { setPending(false); }
  }
  return <section className="local-history-section" aria-label="Kho tóm tắt Guest của tài khoản">
    {candidates.length > 0 && <Button variant="secondary" onClick={openPreview}>Nhập lịch sử Bot Guest</Button>}
    {message && <p role="status">{message}</p>}
    {error && !open && <p role="alert">{error} <Button variant="secondary" onClick={() => { setError(""); setRefresh(current => current + 1); }}>Thử lại</Button></p>}
    {archive.length > 0 && <><h2>Lịch sử Bot Guest đã nhập</h2><p>100 tóm tắt mới nhất do người chơi nhập từ thiết bị · Không xác minh kết quả, không tính Elo hoặc thống kê thi đấu chính thức.</p><div className="local-history-list">{archive.map(record => <article className="local-history-card" key={record.localId}><strong>{record.result === "WIN" ? "THẮNG" : record.result === "LOSS" ? "THUA" : "GIÁN ĐOẠN"}</strong><span>{record.playerName} · {record.opponentName}</span><small>{new Date(record.endedAt).toLocaleString("vi-VN")} · Tóm tắt Guest đã nhập</small></article>)}</div></>}
    <Modal open={open} title="Nhập tóm tắt Bot Guest?" description="Không tải Python, bộ nhớ hoặc log. Không thay đổi Elo; dữ liệu trên thiết bị được giữ nguyên." dismissible={!pending} onClose={() => setOpen(false)}>
      <p>Nhập {preview.length} tóm tắt gần nhất (tối đa 100 mỗi lần); server tự loại bản trùng.</p>
      <ul>{preview.map(record => <li key={record.localId}>{record.playerName} · {record.opponentName} · {record.result === "WIN" ? "Thắng" : record.result === "LOSS" ? "Thua" : "Gián đoạn"}</li>)}</ul>
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Hủy</Button><Button pending={pending} disabled={preview.length === 0} onClick={() => void confirm()}>Xác nhận nhập tóm tắt</Button></div>
    </Modal>
  </section>;
}
