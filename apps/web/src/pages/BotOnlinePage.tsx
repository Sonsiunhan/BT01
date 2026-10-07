import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { BotLibraryItem, BotRevision } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getMe } from "../services/auth/authApi";
import * as botLibraryApi from "../services/bot-library/botLibraryApi";
import { createRoom } from "../services/rooms/roomApi";
import { getBotOnline, selectBotOnline } from "../services/bot-online/botOnlineApi";
import { guestBotLibraryApi } from "../services/bot-library/guestBotLibrary";
import { stageGuestOnlineBot, testGuestOnlineBot, clearGuestOnlineStaging } from "../services/bot-library/guestOnlineBotApi";
import { ensureGuestSession } from "../services/guest/guestApi";

type SavedBotSelection = { botId?: string; revisionId?: string; localBotId?: string; localRevisionId?: string };

export default function BotOnlinePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinedRoomId = searchParams.get("room")?.trim() ?? "";
  const customRoom = searchParams.get("custom") === "1";
  const showCustomSetup = customRoom && !joinedRoomId;
  const [bots, setBots] = useState<BotLibraryItem[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [testedRevisionId, setTestedRevisionId] = useState("");
  const [refereeEnabled, setRefereeEnabled] = useState(false);
  const [spectatorsEnabled, setSpectatorsEnabled] = useState(true);
  const [spectatorCapacity, setSpectatorCapacity] = useState<1 | 2 | 5 | 10>(5);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guestMode, setGuestMode] = useState(false);
  const [onlineSelection, setOnlineSelection] = useState<{ botId: string; revisionId: string } | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ legalPreview: string[]; privateLog: string[]; validationMessage?: string | null }>({ legalPreview: [], privateLog: [] });

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId) ?? bots[0], [bots, selectedBotId]);
  const selectedRevision = useMemo(() => selectedBot?.revisions.find((revision) => revision.id === selectedRevisionId) ?? selectedBot?.revisions[0], [selectedBot, selectedRevisionId]);
  const statusLabel = (revision?: BotRevision) => revision?.status === "PASSED" ? "Đã kiểm tra" : revision?.status === "READY" ? "Cần kiểm tra" : revision ? "Chưa thể Sẵn sàng" : "Chưa chọn revision";

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setTestedRevisionId(""); setOnlineSelection(null); setTestFeedback({ legalPreview: [], privateLog: [] });
    try {
      let isGuest = searchParams.get("botId")?.startsWith("guest-bot:") ?? false;
      // Existing room handoff remains Guest even when an account logs in.
      if (joinedRoomId) {
        try { isGuest ||= Boolean((JSON.parse(sessionStorage.getItem("ottv2:bot-queue-selection") ?? "null") as SavedBotSelection | null)?.localBotId); } catch { /* cache is only a hint */ }
      }
      if (!isGuest) {
        try { await getMe(); }
        catch (reason) { if (!(reason instanceof ApiError) || reason.status !== 401) throw reason; isGuest = true; }
      }
      if (isGuest) await ensureGuestSession();
      setGuestMode(isGuest);
      const result = await (isGuest ? guestBotLibraryApi.getBotLibrary(signal) : botLibraryApi.getBotLibrary(signal));
      setBots(result.bots);
      const requestedBot = searchParams.get("botId");
      const requestedRevision = searchParams.get("revisionId");
      if (requestedBot && !result.bots.some((bot) => bot.id === requestedBot && bot.revisions.some((revision) => revision.id === requestedRevision))) throw new Error("Chiến thuật đã chọn không còn khả dụng. Hãy chọn lại trong Xưởng Bot.");
      let saved: SavedBotSelection | null = null;
      if (joinedRoomId) {
        try { saved = JSON.parse(sessionStorage.getItem("ottv2:bot-queue-selection") ?? "null") as SavedBotSelection | null; } catch { /* Invalid cache is not authority. */ }
      }
      const savedBot = result.bots.find((bot) => bot.id === (isGuest ? saved?.localBotId : saved?.botId));
      const nextBot = result.bots.find((bot) => bot.id === requestedBot) ?? savedBot ?? result.bots[0];
      setSelectedBotId(nextBot?.id ?? "");
      setSelectedRevisionId(nextBot?.revisions.find((revision) => revision.id === (requestedRevision ?? (isGuest ? saved?.localRevisionId : saved?.revisionId)))?.id ?? nextBot?.revisions[0]?.id ?? "");
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : "Không thể tải thư viện chiến thuật.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [joinedRoomId, searchParams]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    const bot = bots.find((item) => item.id === selectedBotId);
    if (!bot?.revisions.some((revision) => revision.id === selectedRevisionId)) {
      setSelectedRevisionId(bot?.revisions[0]?.id ?? "");
      setTestedRevisionId("");
    }
  }, [bots, selectedBotId, selectedRevisionId]);

  const runPreflight = async () => {
    if (!selectedBot || !selectedRevision) return;
    setPending(true); setError(""); setMessage(""); setTestedRevisionId(""); setOnlineSelection(null); setTestFeedback({ legalPreview: [], privateLog: [] });
    try {
      let target = { botId: selectedBot.id, revisionId: selectedRevision.id };
      if (guestMode) {
        const { source } = await guestBotLibraryApi.getBotSource(selectedBot.id, selectedRevision.id);
        const staged = await stageGuestOnlineBot({ name: selectedBot.name, source });
        target = { botId: staged.bot.id, revisionId: staged.revision.id };
      }
      const result = await (guestMode ? testGuestOnlineBot(target.botId, target.revisionId) : botLibraryApi.testBotRevision(target.botId, target.revisionId));
      setTestedRevisionId(result.revision.status === "PASSED" ? selectedRevision.id : "");
      setOnlineSelection(result.revision.status === "PASSED" ? target : null);
      setTestFeedback({ legalPreview: result.legalPreview ?? [], privateLog: result.privateLog ?? [], validationMessage: result.revision.validationMessage });
      setMessage(result.revision.status === "PASSED" ? "Kiểm tra đạt. Bạn có thể Tìm trận Online." : "Kiểm tra chưa đạt; hãy sửa code rồi kiểm tra lại.");
      const refreshed = await (guestMode ? guestBotLibraryApi.getBotLibrary() : botLibraryApi.getBotLibrary()); setBots(refreshed.bots);
    } catch (reason) { setTestedRevisionId(""); setTestFeedback({ legalPreview: [], privateLog: [] }); setError(reason instanceof ApiError ? reason.message : "Không thể kiểm tra code trong runtime cô lập."); }
    finally { setPending(false); }
  };

  const createBotRoom = async () => {
    if (!selectedBot || !selectedRevision || !onlineSelection || testedRevisionId !== selectedRevision.id) { setError("Hãy kiểm tra code đạt trước khi tạo phòng Bot."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      await assertPreparationIdentity();
      if (joinedRoomId) {
        // Reconcile the room immediately before committing the handoff. The
        // queue/sessionStorage hint is never authority: a matched room may
        // have entered countdown/playing while this page was loading.
        const current = await getBotOnline(joinedRoomId);
        if (current.snapshot.status !== "WAITING_READY") {
          try { sessionStorage.removeItem("ottv2:bot-queue-selection"); } catch { /* storage is best effort */ }
          throw new Error("Phòng đã bắt đầu chuẩn bị; không thể gắn revision mới.");
        }
        await selectBotOnline(joinedRoomId, onlineSelection);
        try { sessionStorage.removeItem("ottv2:bot-queue-selection"); } catch { /* storage is best effort */ }
        notifyAndNavigate(joinedRoomId, "Đã gắn Bot vào phòng. Hai bên cần chọn revision và Sẵn sàng.");
        return;
      }
      const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `bot-room-${Date.now()}`;
      const result = await createRoom({ name: `Bot Online · ${selectedBot.name}`, visibility: "PUBLIC", timerSeconds: 300, playMode: "BOT", refereeEnabled, spectatorsEnabled, ...(spectatorsEnabled ? { spectatorCapacity } : {}) }, idempotencyKey, guestMode ? "GUEST" : undefined);
      // Bind the creator's already-tested revision before entering the room.
      // The server still authorizes the account/slot and re-checks the revision;
      // this call never sends Python source to the browser snapshot.
      await selectBotOnline(result.room.roomId, onlineSelection);
      navigate(`/phong/${result.room.roomId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo phòng Bot Online."); }
    finally { setPending(false); }
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".py") || file.size > 65_536) { setError("Chỉ nhận file .py UTF-8 tối đa 64 KiB."); return; }
    setPending(true); setError(""); setMessage(""); setTestedRevisionId(""); setOnlineSelection(null); setTestFeedback({ legalPreview: [], privateLog: [] });
    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const name = file.name.replace(/\.py$/i, "").trim().slice(0, 40) || "Bot tải lên";
      const created = guestMode ? await guestBotLibraryApi.createBot({ name, source }) : await botLibraryApi.createBot({ name, source });
      const refreshed = await (guestMode ? guestBotLibraryApi.getBotLibrary() : botLibraryApi.getBotLibrary());
      setBots(refreshed.bots); setSelectedBotId(created.bot.id); setSelectedRevisionId(created.revision.id); setMessage(`Đã tải ${file.name}. Hãy bấm Kiểm tra code.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải file chiến thuật."); }
    finally { setPending(false); }
  };

  const loadSampleBot = async () => {
    setPending(true); setError(""); setMessage(""); setTestedRevisionId(""); setOnlineSelection(null); setTestFeedback({ legalPreview: [], privateLog: [] });
    try {
      const docs = guestMode ? await guestBotLibraryApi.getBotSdkDocs() : await botLibraryApi.getBotSdkDocs();
      const created = guestMode ? await guestBotLibraryApi.createBot({ name: `Bot mẫu Robot Lab ${Date.now()}`, source: docs.template }) : await botLibraryApi.createBot({ name: `Bot mẫu Robot Lab ${Date.now()}`, source: docs.template });
      const refreshed = await (guestMode ? guestBotLibraryApi.getBotLibrary() : botLibraryApi.getBotLibrary());
      setBots(refreshed.bots); setSelectedBotId(created.bot.id); setSelectedRevisionId(created.revision.id); setMessage("Đã nạp bot mẫu. Hãy bấm Kiểm tra code.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể nạp bot mẫu."); }
    finally { setPending(false); }
  };

  const assertPreparationIdentity = async () => {
    if (!guestMode || joinedRoomId) return;
    try { await getMe(); }
    catch (reason) { if (reason instanceof ApiError && reason.status === 401) return; throw reason; }
    setTestedRevisionId(""); setOnlineSelection(null);
    throw new Error("Bạn vừa đăng nhập. Hãy chọn bot trong Xưởng Bot tài khoản và kiểm tra code lại; thư viện Guest không tự nhập vào tài khoản.");
  };

  const joinBotQueue = async () => {
    if (!selectedBot || !selectedRevision || !onlineSelection || testedRevisionId !== selectedRevision.id) { setError("Hãy kiểm tra code đạt trước khi vào hàng chờ Bot."); return; }
    setPending(true); setError("");
    try {
      await assertPreparationIdentity();
      sessionStorage.setItem("ottv2:bot-queue-selection", JSON.stringify({ ...onlineSelection, ...(guestMode ? { localBotId: selectedBot.id, localRevisionId: selectedRevision.id } : {}) }));
      navigate(`${routes.queue}?mode=BOT`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tìm đối thủ Bot."); }
    finally { setPending(false); }
  };

  const notifyAndNavigate = (roomId: string, nextMessage: string) => {
    setMessage(nextMessage);
    navigate(`/phong/${encodeURIComponent(roomId)}`);
  };

  if (loading) return <LoadingState fullPage label="Đang tải phòng lab Bot Online…" />;

  return <section className="bot-online-page robot-lab-bot-online" aria-labelledby="bot-online-title">
    <header className="bot-online-header"><div><p className="eyebrow">ROBOT LAB · ĐẤU CHƯƠNG TRÌNH · ONLINE</p><h1 id="bot-online-title">{joinedRoomId ? "Chọn Bot vào phòng" : showCustomSetup ? "Tạo phòng Bot riêng" : "Chuẩn bị Bot Online"}</h1><p className="form-intro">{joinedRoomId ? `Bạn đã vào phòng #${joinedRoomId}. Chọn revision đã kiểm tra để gắn vào slot của mình.` : showCustomSetup ? "Tạo phòng Unranked riêng cho giải đấu, có thể bật Trọng tài và Khán giả." : "Tải code hoặc dùng bot mẫu → Kiểm tra code → Tìm trận Online. Code chỉ chạy trong runtime cô lập."}</p></div><div className="bot-online-header-actions"><Link className="button secondary" to={routes.botWorkbench}>Xưởng Bot</Link></div></header>
    {error && <div className="form-error" role="alert"><strong>{error}</strong><Button variant="secondary" onClick={() => void load()}>Thử lại</Button></div>}
    {guestMode && <div className="bot-online-note"><p>Thư viện Guest lưu trên trình duyệt này. Kiểm tra code chỉ tải revision bạn chọn lên server riêng cho Online, thời hạn 30 ngày; không tạo tài khoản hoặc đồng bộ toàn thư viện. Revision đang được trận dùng không bị dọn.</p><Button variant="secondary" disabled={pending} onClick={() => { setPending(true); setTestedRevisionId(""); setOnlineSelection(null); void clearGuestOnlineStaging().then(() => setMessage("Đã dọn bản Online chưa dùng. Thư viện trên thiết bị và revision đang thi đấu giữ nguyên.")).catch(reason => setError(reason instanceof Error ? reason.message : "Không thể dọn bản Online.")).finally(() => setPending(false)); }}>Dọn bản Online chưa dùng</Button></div>}
    <div className="bot-online-grid">
      <section className="bot-online-panel" aria-label="Chọn bot và revision"><p className="eyebrow">01 · CHỌN CHIẾN THUẬT</p><h2>Bot của bạn</h2>
        {bots.length === 0 ? <div className="bot-empty-state"><strong>Chưa có bot trong thư viện</strong><span>Tải code hoặc dùng bot mẫu ngay tại đây. Code chỉ được bật tìm trận sau khi kiểm tra đạt.</span><div className="bot-online-source-actions"><label className="button secondary" htmlFor="bot-online-upload-empty">Tải file Python<input id="bot-online-upload-empty" type="file" accept=".py,text/x-python" hidden disabled={pending} onChange={(event) => { void handleUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><Button variant="secondary" onClick={() => void loadSampleBot()} disabled={pending}>Dùng bot mẫu</Button></div><Link className="button secondary" to={routes.botWorkbench}>Mở Xưởng Bot</Link></div> : <>
          <label>Bot<select disabled={pending} value={selectedBot?.id ?? ""} onChange={(event) => { setSelectedBotId(event.target.value); setTestedRevisionId(""); }}>{bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></label>
          <label>Revision<select disabled={pending} value={selectedRevision?.id ?? ""} onChange={(event) => { setSelectedRevisionId(event.target.value); setTestedRevisionId(""); }}>{selectedBot?.revisions.map((revision) => <option key={revision.id} value={revision.id}>r{revision.revisionNumber} · {statusLabel(revision)}</option>)}</select></label>
          <div className="bot-online-status" role="status"><span className={testedRevisionId === selectedRevision?.id ? "status-ok" : "status-warn"} />{statusLabel(selectedRevision)}</div>
          <div className="bot-online-source-actions"><label className="button secondary" htmlFor="bot-online-upload">Tải file Python<input id="bot-online-upload" type="file" accept=".py,text/x-python" hidden disabled={pending} onChange={(event) => { void handleUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><Button variant="secondary" onClick={() => void loadSampleBot()} disabled={pending}>Dùng bot mẫu</Button></div>
          <Button variant="secondary" onClick={() => void runPreflight()} pending={pending} disabled={!selectedRevision}>Kiểm tra code</Button>
          <p className="bot-online-hint">Hàm bắt buộc: <code>choose_move(state, memory)</code>. Xem SDK và giới hạn trong Xưởng Bot.</p>
        </>}
      </section>
      <section className="bot-online-panel" aria-label={joinedRoomId ? "Gắn Bot vào phòng" : showCustomSetup ? "Cấu hình phòng riêng" : "Tìm trận Online"}><p className="eyebrow">02 · {joinedRoomId ? "GẮN VÀO PHÒNG" : showCustomSetup ? "PHÒNG CUSTOM" : "TÌM TRẬN"}</p><h2>{joinedRoomId ? "Slot của bạn" : showCustomSetup ? "Luật phòng" : "Tìm trận Online"}</h2><p className="bot-online-note">{joinedRoomId ? "Revision phải vượt qua kiểm tra trước khi Sẵn sàng. Bạn không thể đổi Bot sau khi phòng bắt đầu chuẩn bị." : showCustomSetup ? "Đấu chương trình là Unranked. Hai slot phải chọn revision và Sẵn sàng; bản chờ chỉ áp dụng ở lượt kế tiếp của chủ Bot." : "Chỉ Bot đã Kiểm tra đạt mới được vào hàng chờ. Hệ thống sẽ ghép tối đa một đối thủ Bot theo năng lực runtime."}</p>
        {showCustomSetup && <><label className="check-row"><input type="checkbox" checked={refereeEnabled} onChange={(event) => setRefereeEnabled(event.target.checked)} /> Có Trọng tài</label>
        <label className="check-row"><input type="checkbox" checked={spectatorsEnabled} onChange={(event) => setSpectatorsEnabled(event.target.checked)} /> Có Khán giả</label>
        {spectatorsEnabled && <label>Sức chứa khán giả<select value={spectatorCapacity} onChange={(event) => setSpectatorCapacity(Number(event.target.value) as typeof spectatorCapacity)}><option value={1}>1</option><option value={2}>2</option><option value={5}>5</option><option value={10}>10</option></select></label>}</>}
        {!joinedRoomId && !showCustomSetup && <Button onClick={joinBotQueue} pending={pending} disabled={pending || !selectedRevision || testedRevisionId !== selectedRevision.id}>Tìm trận Online</Button>}
        {showCustomSetup && <Button onClick={() => void createBotRoom()} pending={pending} disabled={!selectedRevision || testedRevisionId !== selectedRevision.id}>Tạo phòng Bot Online</Button>}
        {joinedRoomId && <Button onClick={() => void createBotRoom()} pending={pending} disabled={!selectedRevision || testedRevisionId !== selectedRevision.id}>Gắn Bot & vào phòng</Button>}
        {message && <p className="form-success" role="status">{message}</p>}
      </section>
      {(testFeedback.legalPreview.length > 0 || testFeedback.privateLog.length > 0 || testFeedback.validationMessage) && <section className="bot-online-panel bot-online-feedback" aria-label="Kết quả kiểm tra"><p className="eyebrow">KẾT QUẢ RIÊNG TƯ</p><h2>{testFeedback.validationMessage ? "Cần sửa code" : "Kiểm tra đạt"}</h2>{testFeedback.legalPreview.length > 0 && <p><strong>Nước thử:</strong> {testFeedback.legalPreview.join(" · ")}</p>}{testFeedback.validationMessage && <p className="form-error">{testFeedback.validationMessage}</p>}<ul>{testFeedback.privateLog.map((entry) => <li key={entry}>{entry}</li>)}</ul></section>}
      <aside className="bot-online-panel bot-online-contract" aria-label="Cam kết runtime"><p className="eyebrow">03 · AN TOÀN & MINH BẠCH</p><h2>Runtime cô lập</h2><ul><li>Không chạy Python trong process ứng dụng.</li><li>Không gửi source, memory hoặc log riêng vào snapshot công khai.</li><li>Giới hạn mỗi lượt và toàn trận hiển thị trước Ready.</li><li>Runtime chưa được kiểm chứng sẽ dừng fail-closed, không xử thua Bot.</li></ul></aside>
    </div>
  </section>;
}
