import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { BotLibraryItem, BotRevision, BotSdkDocsResponse } from "@ottv2/contracts";
import { DEFAULT_BOT_LIMITS } from "@ottv2/bot-sdk";

import { routes } from "../app/routes";
import { Button, LoadingState } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import * as botLibraryApi from "../services/bot-library/botLibraryApi";
import { guestBotLibraryApi } from "../services/bot-library/guestBotLibrary";
import { loginReturnPath } from "../services/auth/returnUrl";

const statusCopy: Record<BotRevision["status"], string> = { READY: "Sẵn sàng", INVALID: "Không hợp lệ", TESTING: "Đang kiểm tra", PASSED: "Kiểm tra đạt", FAILED: "Kiểm tra thất bại" };
const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KiB`;
const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function BotWorkbenchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotLibraryItem[]>([]);
  const [quota, setQuota] = useState({ usedBytes: 0, quotaBytes: 262144 });
  const [sdk, setSdk] = useState<BotSdkDocsResponse>();
  const [selectedBotId, setSelectedBotId] = useState<string>();
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>();
  const [source, setSource] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [fileSource, setFileSource] = useState("");
  const [botName, setBotName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState("");
  const [privateLog, setPrivateLog] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const libraryApi = useRef<typeof botLibraryApi>(botLibraryApi);
  const [guestLibrary, setGuestLibrary] = useState(false);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) ?? bots[0], [bots, selectedBotId]);
  const selectedRevision = useMemo(() => selectedBot?.revisions.find((revision) => revision.id === selectedRevisionId) ?? selectedBot?.revisions[0], [selectedBot, selectedRevisionId]);

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setNeedsLogin(false);
    try {
      let library;
      try { library = await libraryApi.current.getBotLibrary(signal); }
      catch (reason) {
        if (!(reason instanceof ApiError) || reason.status !== 401 || signal?.aborted) throw reason;
        libraryApi.current = guestBotLibraryApi; setGuestLibrary(true);
        library = await guestBotLibraryApi.getBotLibrary(signal);
      }
      const docs = await libraryApi.current.getBotSdkDocs(signal);
      if (signal?.aborted) return;
      setBots(library.bots); setQuota({ usedBytes: library.usedBytes, quotaBytes: library.quotaBytes }); setSdk(docs);
      setSelectedBotId((current) => current && library.bots.some((bot) => bot.id === current) ? current : library.bots[0]?.id);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : "Không thể tải thư viện chiến thuật."); setNeedsLogin(reason instanceof ApiError && reason.status === 401);
    } finally { setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);

  useEffect(() => { const nextBot = bots.find((bot) => bot.id === selectedBotId); setSelectedRevisionId(nextBot?.revisions[0]?.id); setSource(undefined); }, [bots, selectedBotId]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setMessage("");
    if (!file.name.toLowerCase().endsWith(".py")) { setError("Chỉ nhận tệp chiến thuật .py."); return; }
    if (file.size > DEFAULT_BOT_LIMITS.uploadBytes) { setError("Tệp chiến thuật vượt giới hạn 64 KiB."); return; }
    try { const decoded = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); setFileName(file.name); setFileSource(decoded); if (!botName) setBotName(file.name.replace(/\.py$/i, "").slice(0, 80)); }
    catch { setError("Không thể đọc tệp chiến thuật trên thiết bị."); }
  };

  const refreshAfterMutation = async (nextBotId?: string) => {
    const result = await libraryApi.current.getBotLibrary(); setBots(result.bots); setQuota({ usedBytes: result.usedBytes, quotaBytes: result.quotaBytes });
    if (nextBotId) setSelectedBotId(nextBotId);
  };
  const saveUpload = async () => {
    if (!fileSource.trim()) { setError("Hãy chọn một tệp .py trước."); return; }
    if (!botName.trim()) { setError("Hãy đặt tên cho bot."); return; }
    setPending(true); setError(""); setMessage("");
    try { const result = selectedBot ? await libraryApi.current.createBotRevision(selectedBot.id, { source: fileSource }) : await libraryApi.current.createBot({ name: botName.trim(), source: fileSource }); await refreshAfterMutation(result.bot.id); setFileSource(""); setFileName(""); setMessage("Đã lưu revision vào thư viện; chưa tự áp dụng vào trận."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu revision."); }
    finally { setPending(false); }
  };
  const useSample = () => { setFileName("bot-mau.py"); setBotName("Bot mẫu Robot Lab"); setFileSource(sdk?.template ?? "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n"); setMessage("Đã nạp template SDK. Hãy lưu để chạy preflight."); };
  const viewSource = async () => {
    if (!selectedBot || !selectedRevision) return;
    setPending(true); setError("");
    try { const result = await libraryApi.current.getBotSource(selectedBot.id, selectedRevision.id); setSource(result.source); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể tải mã nguồn riêng tư."); }
    finally { setPending(false); }
  };
  const testRevision = async () => {
    if (!selectedBot || !selectedRevision) return;
    setPending(true); setError(""); setMessage("");
    try { const result = await libraryApi.current.testBotRevision(selectedBot.id, selectedRevision.id); setPrivateLog(result.privateLog); setMessage(result.revision.status === "PASSED" ? "Preflight SDK đạt; revision vẫn cần được chọn rõ trước khi vào trận." : "Preflight không đạt; revision chưa thể Ready."); await refreshAfterMutation(selectedBot.id); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể kiểm tra revision."); }
    finally { setPending(false); }
  };
  const downloadSource = async () => {
    if (!selectedBot || !selectedRevision) return;
    try { const result = await libraryApi.current.getBotSource(selectedBot.id, selectedRevision.id); const url = URL.createObjectURL(new Blob([result.source], { type: "text/x-python" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selectedBot.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-r${selectedRevision.revisionNumber}.py`; anchor.click(); URL.revokeObjectURL(url); setMessage("Đã chuẩn bị bản tải xuống riêng tư."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể xuất mã nguồn."); }
  };
  const deleteRevision = async () => {
    if (!selectedBot || !selectedRevision || !window.confirm("Xoá revision này khỏi thư viện? Nếu đang được trận tham chiếu, hệ thống sẽ từ chối.")) return;
    setPending(true); setError("");
    try { await libraryApi.current.deleteBotRevision(selectedBot.id, selectedRevision.id); setMessage("Đã xoá revision."); await refreshAfterMutation(selectedBot.id); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể xoá revision đang được tham chiếu."); }
    finally { setPending(false); }
  };
  const announceUse = (mode: "Online" | "Offline") => {
    if (!selectedBot || !selectedRevision || !["READY", "PASSED"].includes(selectedRevision.status)) return;
    const selection = new URLSearchParams({ botId: selectedBot.id, revisionId: selectedRevision.id });
    navigate(`${mode === "Online" ? routes.botOnline : routes.botOffline}?${selection}`);
  };

  if (loading) return <LoadingState fullPage label="Đang tải Workbench chiến thuật…" />;
  return <section className="bot-workbench-page robot-lab-bot-workbench" aria-labelledby="bot-workbench-title">
    {guestLibrary && <p className="form-intro" role="status">Thư viện Guest lưu riêng trên hồ sơ trình duyệt này; không tự đồng bộ hoặc nhập vào tài khoản khi đăng nhập.</p>}
    <header className="bot-workbench-header"><div><p className="eyebrow">ROBOT LAB · THƯ VIỆN RIÊNG</p><h1 id="bot-workbench-title">Workbench chiến thuật</h1><p className="form-intro">Kiểm tra, lưu và chọn revision Python. Mã nguồn chỉ hiển thị cho chủ sở hữu; không có trình soạn thảo tích hợp.</p></div><Link className="button secondary" to={routes.home}>Về sảnh</Link></header>
    {error && <div className="form-error" role="alert"><strong>{error}</strong>{needsLogin ? <Link className="button secondary" to={loginReturnPath(location)}>Đăng nhập</Link> : <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>}</div>}
    <div className="bot-workbench-grid">
      <section className="bot-workbench-panel bot-library-list" aria-label="Danh sách bot"><div className="bot-panel-heading"><div><p className="eyebrow">01 · THƯ VIỆN</p><h2>Bot & revision</h2></div><span className="bot-quota">{formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}</span></div>{bots.length === 0 ? <div className="bot-empty-state"><strong>Chưa có chiến thuật nào</strong><span>Upload file .py hoặc dùng bot mẫu để bắt đầu.</span></div> : <div className="bot-list">{bots.map((bot) => <article className={`bot-list-item ${selectedBot?.id === bot.id ? "selected" : ""}`} key={bot.id}><button type="button" className="bot-list-button" onClick={() => setSelectedBotId(bot.id)}><span className="bot-mark" aria-hidden="true">AI</span><span><strong>{bot.name}</strong><small>{bot.revisions.length} revision · {formatBytes(bot.usedBytes)}</small></span></button>{selectedBot?.id === bot.id && <div className="revision-list">{bot.revisions.map((revision) => <button type="button" className={`revision-chip ${selectedRevision?.id === revision.id ? "selected" : ""}`} key={revision.id} onClick={() => { setSelectedRevisionId(revision.id); setSource(undefined); }}><span>r{revision.revisionNumber}</span><small>{statusCopy[revision.status]}</small>{revision.activeForMatchId && <em>Đang dùng</em>}{revision.pendingForMatchId && <em>Chờ áp dụng</em>}</button>)}</div>}</article>)}</div>}</section>
      <section className="bot-workbench-panel bot-upload-panel" aria-label="Nạp chiến thuật"><div className="bot-panel-heading"><div><p className="eyebrow">02 · NẠP & KIỂM TRA</p><h2>Đưa chiến thuật vào lab</h2></div></div><div className="bot-upload-actions"><label className="file-drop"><span>Tệp Python</span><strong>{fileName || "Chọn file .py"}</strong><small>UTF-8 · tối đa 64 KiB · preflight SDK trước Ready</small><input ref={fileInput} type="file" accept=".py,text/x-python" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label><label>Tên bot{!selectedBot && <input value={botName} onChange={(event) => setBotName(event.target.value)} placeholder="Ví dụ: Bot xanh" maxLength={80} />}{selectedBot && <input value={selectedBot.name} readOnly aria-label="Tên bot đang chọn" />}</label><Button onClick={() => void saveUpload()} pending={pending} disabled={!fileSource}>Lưu revision</Button><Button variant="secondary" onClick={useSample}>Dùng bot mẫu</Button></div><div className="bot-sdk-card"><div><strong>SDK {sdk?.sdkVersion ?? "—"} · Schema {sdk?.schemaVersion ?? "—"}</strong><span>Allowlist: {sdk?.allowlist.join(", ") || "đang tải"}</span><span>Mã trong thư viện giữ đến khi bạn xoá; bản tạm của trận có thể hết hạn sau 30 ngày.</span></div><button type="button" className="text-button" onClick={() => { if (sdk?.template) { void navigator.clipboard?.writeText(sdk.template); setMessage("Đã chép template SDK vào clipboard."); } }}>Chép template</button></div></section>
      <section className="bot-workbench-panel bot-inspector-panel" aria-label="Kiểm tra và nhật ký riêng"><div className="bot-panel-heading"><div><p className="eyebrow">03 · KẾT QUẢ RIÊNG</p><h2>Kiểm tra revision</h2></div></div>{selectedRevision ? <><div className="revision-inspector"><div><span>Revision r{selectedRevision.revisionNumber}</span><strong>{statusCopy[selectedRevision.status]}</strong></div><dl><div><dt>Digest</dt><dd>{selectedRevision.sourceDigest.slice(0, 12)}…</dd></div><div><dt>SDK / Schema</dt><dd>{selectedRevision.sdkVersion} / {selectedRevision.schemaVersion}</dd></div><div><dt>Dung lượng</dt><dd>{formatBytes(selectedRevision.sourceBytes)}</dd></div><div><dt>Cập nhật</dt><dd>{formatDate(selectedRevision.updatedAt)}</dd></div></dl>{selectedRevision.validationMessage && <p className="bot-validation-error" role="alert">{selectedRevision.validationMessage}</p>}<div className="bot-action-grid"><Button onClick={() => void testRevision()} pending={pending}>Chạy preflight</Button><Button variant="secondary" onClick={() => void viewSource()} pending={pending}>Xem mã nguồn</Button><Button variant="secondary" onClick={() => void downloadSource()}>Xuất .py</Button><Button variant="danger" onClick={() => void deleteRevision()} pending={pending}>Xoá</Button></div><div className="bot-mode-actions"><Button variant="secondary" disabled={selectedRevision.status !== "PASSED" && selectedRevision.status !== "READY"} onClick={() => announceUse("Online")}>Dùng Online</Button><Button variant="secondary" disabled={selectedRevision.status !== "PASSED" && selectedRevision.status !== "READY"} onClick={() => announceUse("Offline")}>Dùng Offline</Button></div></div><div className="bot-private-log"><strong>Log kiểm tra riêng</strong>{privateLog.length === 0 ? <span>Chưa chạy preflight ở phiên này.</span> : privateLog.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>{source !== undefined && <div className="bot-source-view"><div><strong>Mã nguồn riêng tư</strong><span>Chỉ chủ sở hữu mới xem được mã nguồn.</span></div><pre>{source}</pre></div>}</> : <div className="bot-empty-state"><strong>Chọn một revision</strong><span>Kết quả kiểm tra, source và log riêng sẽ xuất hiện ở đây.</span></div>}</section>
    </div>
    {message && <p className="form-success" role="status">{message}</p>}
  </section>;
}
