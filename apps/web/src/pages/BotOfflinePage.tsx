import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { applyMove, createInitialState, type RuleState, type Side } from "@ottv2/game-rules";
import { DEFAULT_BOT_LIMITS, createBotTurnState, parseBotMemoryCompatibility, validateBotSource, type BotMoveRecord, type LimitDecision } from "@ottv2/bot-sdk";
import { routes } from "../app/routes";
import { Button, LoadingState } from "../components/ui";
import { GameBoard } from "../components/board";
import { getBotOfflineSession, setBotOfflineSession, clearBotOfflineSession, type BotOfflineSlotSnapshot } from "../services/local/localGameStorage";
import { getOfflineKitStatus, installOfflineKit, type OfflineKitStatus } from "../services/local/offlineKit";
import * as offlineRunner from "../services/bot-offline/botOfflineRunner";
import { getBotSource } from "../services/bot-library/botLibraryApi";
import { offlineLimitResult, offlineAuthorFaultResult, isOfflineAuthorFault } from "../services/bot-offline/offlineMatchPolicy";

const { BotOfflineRunnerError, OFFLINE_RUNTIME_STATUS, runOfflineBotTurn } = offlineRunner;
const verifyOfflineRuntime: ((signal?: AbortSignal) => Promise<typeof OFFLINE_RUNTIME_STATUS>) | undefined = (() => {
  try { return Reflect.get(offlineRunner, "verifyOfflineRuntime") as ((signal?: AbortSignal) => Promise<typeof OFFLINE_RUNTIME_STATUS>);
  } catch { return undefined; }
})();

const SAMPLE_SOURCE = `# ottv2-memory-schema: sample-v1\ndef choose_move(state, memory):\n    return state["legal_moves"][0], memory\n`;
type RunState = "SETUP" | "PAUSED" | "RUNNING" | "PAUSING" | "FINISHED";
type Slot = BotOfflineSlotSnapshot & { validation: string; testPassed: boolean };
const emptySlot = (side: Side): Slot => ({ source: "", fileName: `${side === "BLUE" ? "bot-xanh" : "bot-do"}.py`, revision: "local-0", ready: false, memorySchema: null, memoryPolicy: "RESET_ON_NEW_REVISION", validation: "Chưa có chiến thuật.", testPassed: false });

function hydrateSlot(snapshot: BotOfflineSlotSnapshot, validation: string): Slot {
  const compatibility = parseBotMemoryCompatibility(snapshot.source);
  return { ...snapshot, memorySchema: snapshot.memorySchema ?? compatibility.schema, memoryPolicy: snapshot.memoryPolicy ?? "RESET_ON_NEW_REVISION", ready: false, testPassed: false, validation };
}

function validateSlot(slot: Slot): Slot {
  const result = validateBotSource(slot.source);
  return result.ok ? { ...slot, ready: false, testPassed: false, validation: `Kiểm tra tĩnh SDK đạt; chưa phải preflight thực thi. ${OFFLINE_RUNTIME_STATUS.message}` } : { ...slot, ready: false, testPassed: false, validation: result.message };
}

function BotSlotWithMemory({ side, slot, onSample, onTest, onReady, onFile, onSource, onMemoryPolicy }: { side: Side; slot: Slot; onSample: () => void; onTest: () => void; onReady: () => void; onFile: (file: File | undefined) => void; onSource: (source: string) => void; onMemoryPolicy: (policy: "RESET_ON_NEW_REVISION" | "PRESERVE_IF_COMPATIBLE") => void }) {
  const name = side === "BLUE" ? "Xanh" : "Đỏ";
  return <section className={`bot-offline-slot ${side.toLowerCase()}`} aria-label={`Bot ${name}`}>
    <div className="bot-slot-heading"><div><p className="eyebrow">SLOT {side === "BLUE" ? "01" : "02"}</p><h2>Bot {name}</h2></div><span className={slot.ready ? "slot-ready" : "slot-not-ready"}>{slot.ready ? "READY" : "CHƯA READY"}</span></div>
    <label>File chiến thuật<input type="file" accept=".py,text/x-python" onChange={(event) => onFile(event.target.files?.[0])} /></label>
    <textarea value={slot.source} onChange={(event) => onSource(event.target.value)} placeholder="Dùng bot mẫu hoặc dán choose_move(state, memory)…" rows={5} spellCheck={false} />
    <div className="bot-slot-actions"><Button variant="secondary" onClick={onSample}>Bot mẫu</Button><Button variant="secondary" onClick={onTest}>Kiểm tra</Button><Button onClick={onReady} disabled={!slot.testPassed}>{slot.ready ? "Bỏ Ready" : "Sẵn sàng"}</Button></div>
    <label className="bot-memory-policy"><input type="checkbox" checked={slot.memoryPolicy === "PRESERVE_IF_COMPATIBLE"} disabled={!slot.memorySchema} onChange={(event) => onMemoryPolicy(event.target.checked ? "PRESERVE_IF_COMPATIBLE" : "RESET_ON_NEW_REVISION")} /> Giữ bộ nhớ khi revision mới khai báo schema tương thích{slot.memorySchema ? ` (${slot.memorySchema})` : " (chưa khai báo schema)"}</label>
    <p className="bot-slot-validation" role={slot.testPassed ? "status" : "alert"}>{slot.validation}</p><small>Revision {slot.revision} · schema {slot.memorySchema ?? "chưa khai báo"} · bộ nhớ riêng, không chia sẻ với đối thủ</small>
  </section>;
}

const BotSlot = BotSlotWithMemory;

export default function BotOfflinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<RuleState>(() => createInitialState());
  const [slots, setSlots] = useState<Record<Side, Slot>>({ BLUE: emptySlot("BLUE"), RED: emptySlot("RED") });
  const [pendingSlots, setPendingSlots] = useState<Partial<Record<Side, Slot>>>({});
  const pendingSlotsRef = useRef<Partial<Record<Side, Slot>>>({});
  const [clocks, setClocks] = useState<Record<Side, number>>({ BLUE: 30_000, RED: 30_000 });
  const [history, setHistory] = useState<BotMoveRecord[]>([]);
  const [memories, setMemories] = useState<Record<Side, unknown>>({ BLUE: null, RED: null });
  const [runState, setRunState] = useState<RunState>("SETUP");
  const [speedMs, setSpeedMs] = useState(450);
  const [thinking, setThinking] = useState<Side | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [kit, setKit] = useState<OfflineKitStatus | null>(null);
  const [kitProgress, setKitProgress] = useState(0);
  const [runtimeReady, setRuntimeReady] = useState(OFFLINE_RUNTIME_STATUS.ready);
  const [runtimeMessage, setRuntimeMessage] = useState(OFFLINE_RUNTIME_STATUS.message);
  const [restored, setRestored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const selectionImport = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  const slotsRef = useRef(slots);
  const historyRef = useRef(history);
  const memoriesRef = useRef(memories);
  const clocksRef = useRef(clocks);
  const speedRef = useRef(speedMs);
  const runRef = useRef(false);
  const pauseRequested = useRef(false);
  const activeAbort = useRef<AbortController | null>(null);
  const testAborts = useRef<Partial<Record<Side, AbortController>>>({});
  const activeComputeMs = useRef(0);
  const endingReason = useRef("");
  const limitCriteria = useRef<Pick<LimitDecision, "BLUE" | "RED"> | undefined>(undefined);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  useEffect(() => { clocksRef.current = clocks; }, [clocks]);
  useEffect(() => { speedRef.current = speedMs; }, [speedMs]);

  useEffect(() => {
    let active = true;
    const testControllers = testAborts.current;
    void Promise.all([getOfflineKitStatus(), getBotOfflineSession()]).then(([nextKit, session]) => {
      if (!active) return;
      setKit(nextKit);
      if (!nextKit.ready) {
        setRuntimeReady(false);
        setRuntimeMessage(nextKit.message);
      }
      if (nextKit.ready && typeof verifyOfflineRuntime === "function") {
        setRuntimeReady(false);
        setRuntimeMessage("Đang xác minh Offline kit và sandbox cô lập…");
        void verifyOfflineRuntime().then((status) => {
          if (!active) return;
          setRuntimeReady(status.ready);
          setRuntimeMessage(status.message);
          if (!status.ready) setError(status.message);
        });
      }
      if (session) {
        activeComputeMs.current = session.activeComputeMs ?? Math.max(0, 60000 - session.clocks.BLUE - session.clocks.RED);
        endingReason.current = session.endingReason ?? "";
        limitCriteria.current = session.limitCriteria;
        const pending: Partial<Record<Side, Slot>> = {};
        for (const side of ["BLUE", "RED"] as const) { const saved = session.pendingSlots?.[side]; if (saved) pending[side] = hydrateSlot(saved, "Bản chờ được giữ; cần preflight lại trước khi áp dụng."); }
        pendingSlotsRef.current = pending; setPendingSlots(pending);
        setState(session.state); setClocks(session.clocks); setHistory([...session.history]); setMemories(session.status === "FINISHED" ? { BLUE: null, RED: null } : session.memories);
        setSlots({ BLUE: hydrateSlot(session.slots.BLUE, "Đã khôi phục revision; cần preflight thực thi lại trước khi Ready."), RED: hydrateSlot(session.slots.RED, "Đã khôi phục revision; cần preflight thực thi lại trước khi Ready.") });
        setSpeedMs(session.speedMs); setRunState(session.status === "FINISHED" ? "FINISHED" : "PAUSED"); setRestored(true);
      }
    }).catch(() => setError("Không thể đọc bộ nhớ Offline trên thiết bị này.")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; activeAbort.current?.abort(); selectionImport.current?.abort(); for (const abort of Object.values(testControllers)) abort?.abort(); };
  }, []);

  async function checkpoint(nextStatus: "PAUSED" | "FINISHED" = "PAUSED"): Promise<boolean> {
    try {
      await setBotOfflineSession({ state: stateRef.current, clocks: clocksRef.current, history: historyRef.current, memories: memoriesRef.current, slots: { BLUE: slotsRef.current.BLUE, RED: slotsRef.current.RED }, status: nextStatus, speedMs: speedRef.current, savedAt: new Date().toISOString(), activeComputeMs: activeComputeMs.current, endingReason: endingReason.current, pendingSlots: pendingSlotsRef.current, limitCriteria: limitCriteria.current });
      return true;
    } catch {
      setError("Không đủ bộ nhớ để lưu checkpoint. Hãy Xuất checkpoint rồi Xóa checkpoint cũ trước khi tiếp tục.");
      return false;
    }
  }

  function updateSlot(side: Side, patch: Partial<Slot>): void {
    testAborts.current[side]?.abort();
    const previous = pendingSlotsRef.current[side] ?? slotsRef.current[side];
    const source = patch.source ?? previous.source;
    const compatibility = parseBotMemoryCompatibility(source);
    const sourceChanged = patch.source !== undefined && source !== previous.source;
    const slot = {
      ...previous,
      ...patch,
      source,
      memorySchema: compatibility.schema,
      memoryPolicy: sourceChanged ? "RESET_ON_NEW_REVISION" as const : (patch.memoryPolicy ?? previous.memoryPolicy ?? "RESET_ON_NEW_REVISION" as const),
      validation: patch.validation ?? "Chiến thuật đã đổi; cần kiểm tra lại trước khi Sẵn sàng.",
      ready: false,
      testPassed: false,
      revision: patch.revision ?? crypto.randomUUID(),
    };
    if (runState !== "SETUP" && stateRef.current.status === "PLAYING") { pendingSlotsRef.current = { ...pendingSlotsRef.current, [side]: slot }; setPendingSlots(pendingSlotsRef.current); }
    else { slotsRef.current = { ...slotsRef.current, [side]: slot }; setSlots(slotsRef.current); }
    if (runState !== "SETUP" && stateRef.current.status === "PLAYING") void checkpoint();
  }
  function storeCandidate(side: Side, slot: Slot, pending: boolean): void {
    if (pending) { pendingSlotsRef.current = { ...pendingSlotsRef.current, [side]: slot }; setPendingSlots(pendingSlotsRef.current); }
    else { slotsRef.current = { ...slotsRef.current, [side]: slot }; setSlots(slotsRef.current); }
    if (runState !== "SETUP" && stateRef.current.status === "PLAYING") void checkpoint();
  }
  async function importSelection(side: Side): Promise<void> {
    const botId = searchParams.get("botId");
    const revisionId = searchParams.get("revisionId");
    if (!botId || !revisionId || runState !== "SETUP" || loading || selectionImport.current) return;
    const controller = new AbortController();
    selectionImport.current = controller;
    setImporting(true);
    setError("");
    try {
      const result = await getBotSource(botId, revisionId, controller.signal);
      if (controller.signal.aborted) return;
      const validation = validateBotSource(result.source);
      if (!validation.ok) throw new Error(validation.message);
      updateSlot(side, { source: result.source, fileName: `chien-thuat-${side.toLowerCase()}.py`, revision: revisionId, validation: "Đã nạp chiến thuật từ Xưởng Bot; hãy kiểm tra rồi Sẵn sàng.", testPassed: false });
      setSearchParams({}, { replace: true });
      setMessage(`Đã nạp chiến thuật vào slot ${side === "BLUE" ? "Xanh" : "Đỏ"}.`);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không thể nạp chiến thuật đã chọn."); }
    finally { selectionImport.current = null; if (!controller.signal.aborted) setImporting(false); }
  }
  function loadSample(side: Side): void { updateSlot(side, { source: SAMPLE_SOURCE, fileName: "bot-mau.py", validation: "Bot mẫu đã nạp; hãy chạy kiểm tra.", testPassed: false, revision: "sample-r11" }); }
  async function testSlot(side: Side): Promise<void> {
    const beganFinished = stateRef.current.status === "FINISHED";
    const pending = !!pendingSlotsRef.current[side];
    const slot = pendingSlotsRef.current[side] ?? slotsRef.current[side];
    const checked = validateSlot(slot);
    storeCandidate(side, checked, pending);
    if (!runtimeReady || !validateBotSource(slot.source).ok) return;
    testAborts.current[side]?.abort();
    const controller = new AbortController(); testAborts.current[side] = controller;
    try {
      const initial = { ...createInitialState(), currentTurn: side };
      await runOfflineBotTurn({ source: slot.source, state: createBotTurnState(initial, side, [], { BLUE: 30000, RED: 30000 }, 1), memory: null, signal: controller.signal, preflight: true });
      const current = pending ? pendingSlotsRef.current[side] : slotsRef.current[side];
      if (controller.signal.aborted || !beganFinished && stateRef.current.status === "FINISHED" || current?.source !== slot.source || current.revision !== checked.revision) return;
      storeCandidate(side, { ...checked, testPassed: true, validation: "Preflight thực thi cô lập đạt. Bạn có thể Sẵn sàng." }, pending);
    } catch (reason) { const current = pending ? pendingSlotsRef.current[side] : slotsRef.current[side]; if (reason instanceof BotOfflineRunnerError && ["OFFLINE_KIT_MISSING", "RUNTIME_HASH_MISMATCH", "FRAME_ISOLATION_FAILED", "RUNTIME_ISOLATION_FAILED", "OFFLINE_SANDBOX_NOT_VERIFIED"].includes(reason.code)) { setRuntimeReady(false); setRuntimeMessage(reason.message); } if (!controller.signal.aborted && (beganFinished || stateRef.current.status !== "FINISHED") && current?.revision === checked.revision && current.source === checked.source) storeCandidate(side, { ...checked, testPassed: false, ready: false, validation: reason instanceof Error ? reason.message : "Preflight thất bại." }, pending); }
    finally { if (testAborts.current[side] === controller) delete testAborts.current[side]; }
  }
  function toggleReady(side: Side): void { const pending = !!pendingSlotsRef.current[side]; const slot = pendingSlotsRef.current[side] ?? slotsRef.current[side]; storeCandidate(side, { ...slot, ready: slot.testPassed && !slot.ready }, pending); }
  function clearTerminalMemory(): void { for (const controller of Object.values(testAborts.current)) controller?.abort(); memoriesRef.current = { BLUE: null, RED: null }; pendingSlotsRef.current = {}; setMemories(memoriesRef.current); setPendingSlots({}); }
  function resetCandidates(): void {
    for (const controller of Object.values(testAborts.current)) controller?.abort();
    pendingSlotsRef.current = {}; setPendingSlots({}); limitCriteria.current = undefined;
    activeComputeMs.current = 0; endingReason.current = "";
  }

  async function executeTurn(): Promise<boolean> {
    if (activeAbort.current) return false;
    if (!runtimeReady) { setError(runtimeMessage); return false; }
    const snapshot = stateRef.current;
    const side = snapshot.currentTurn;
    if (!side || snapshot.status !== "PLAYING") return false;
    const pending = pendingSlotsRef.current[side];
    if (pending?.ready) {
      const current = slotsRef.current[side];
      const preserveMemory = pending.memoryPolicy === "PRESERVE_IF_COMPATIBLE"
        && Boolean(pending.memorySchema)
        && pending.memorySchema === current.memorySchema;
      slotsRef.current = { ...slotsRef.current, [side]: pending }; setSlots(slotsRef.current);
      delete pendingSlotsRef.current[side]; setPendingSlots({ ...pendingSlotsRef.current });
      if (!preserveMemory) { memoriesRef.current = { ...memoriesRef.current, [side]: null }; setMemories(memoriesRef.current); }
    }
    const slot = slotsRef.current[side];
    if (!slot.ready) { setError(`Slot ${side === "BLUE" ? "Xanh" : "Đỏ"} chưa Sẵn sàng.`); return false; }
    const abort = new AbortController(); activeAbort.current = abort; setThinking(side); setError("");
    try {
      const turnState = createBotTurnState(snapshot, side, historyRef.current, { BLUE: clocksRef.current.BLUE, RED: clocksRef.current.RED }, historyRef.current.length + 1);
      const result = await runOfflineBotTurn({ source: slot.source, state: turnState, memory: memoriesRef.current[side], signal: abort.signal });
      if (abort.signal.aborted) return false;
      const applied = applyMove(snapshot, { side, ...result.move });
      if (applied.kind !== "accepted") throw new BotOfflineRunnerError("ILLEGAL_MOVE", "Bot trả về nước đi không hợp lệ.");
      const defender = snapshot.board[result.move.to];
      const record: BotMoveRecord = { side, from: result.move.from, to: result.move.to, captured: defender?.type ?? null };
      const nextHistory = [...historyRef.current, record];
      activeComputeMs.current += result.computeMs;
      clocksRef.current = { ...clocksRef.current, [side]: Math.max(0, clocksRef.current[side] - result.computeMs) };
      const limit = offlineLimitResult(applied.state, nextHistory.length, activeComputeMs.current);
      stateRef.current = limit?.state ?? applied.state; historyRef.current = nextHistory; memoriesRef.current = { ...memoriesRef.current, [side]: result.memory };
      if (limit) { endingReason.current = limit.reason; limitCriteria.current = limit.criteria; }
      setState(stateRef.current); setHistory(nextHistory); setMemories(memoriesRef.current); setClocks(clocksRef.current);
      if (stateRef.current.status === "FINISHED") { clearTerminalMemory(); setRunState("FINISHED"); await checkpoint("FINISHED"); return false; }
      return await checkpoint("PAUSED");
    } catch (reason) {
      if (reason instanceof BotOfflineRunnerError && reason.code !== "ABORTED") {
        if (["OFFLINE_KIT_MISSING", "RUNTIME_HASH_MISMATCH", "FRAME_ISOLATION_FAILED", "RUNTIME_ISOLATION_FAILED", "OFFLINE_SANDBOX_NOT_VERIFIED"].includes(reason.code)) { setRuntimeReady(false); setRuntimeMessage(reason.message); }
        setError(reason.message);
        if (isOfflineAuthorFault(reason.code)) { const result = offlineAuthorFaultResult(snapshot, side, reason.code); stateRef.current = result.state; endingReason.current = result.reason; clearTerminalMemory(); setState(result.state); setRunState("FINISHED"); await checkpoint("FINISHED"); }
      }
      return false;
    } finally { activeAbort.current = null; setThinking(null); }
  }

  async function runLoop(): Promise<void> {
    if (!runtimeReady) { setError(runtimeMessage); return; }
    if (runRef.current || activeAbort.current || stateRef.current.status === "FINISHED") return;
    if (!kit?.ready) { setError("Hãy tải đủ Offline kit trước khi chạy; không tự chuyển sang máy chủ."); return; }
    if (!(["BLUE", "RED"] as const).every(side => slotsRef.current[side].ready || pendingSlotsRef.current[side]?.ready)) { setError("Cả hai bot phải kiểm tra đạt và Sẵn sàng trước khi chạy."); return; }
    runRef.current = true; pauseRequested.current = false; setRunState("RUNNING");
    while (runRef.current && stateRef.current.status === "PLAYING") {
      const moved = await executeTurn();
      if (pauseRequested.current || !moved) break;
      await new Promise((resolve) => window.setTimeout(resolve, speedRef.current));
    }
    runRef.current = false;
    const finalState: RuleState = stateRef.current;
    if (finalState.status !== "FINISHED") { setRunState("PAUSED"); await checkpoint("PAUSED"); }
  }

  function pause(): void { pauseRequested.current = true; if (thinking) setRunState("PAUSING"); else { setRunState("PAUSED"); void checkpoint("PAUSED"); } }
  async function step(): Promise<void> { if (runRef.current || activeAbort.current || stateRef.current.status === "FINISHED") return; setRunState("PAUSED"); await executeTurn(); }
  function resetMatchState(status: "PAUSED" | "SETUP"): void {
    resetCandidates();
    stateRef.current = createInitialState(); setState(stateRef.current);
    historyRef.current = []; setHistory([]);
    memoriesRef.current = { BLUE: null, RED: null }; setMemories(memoriesRef.current);
    clocksRef.current = { BLUE: 30000, RED: 30000 }; setClocks(clocksRef.current);
    setRestored(false); setRunState(status);
  }
  async function startMatch(): Promise<void> {
    if (!runtimeReady) { setError(runtimeMessage); return; }
    if (selectionImport.current || runRef.current || activeAbort.current) return;
    const next = { BLUE: pendingSlotsRef.current.BLUE ?? slotsRef.current.BLUE, RED: pendingSlotsRef.current.RED ?? slotsRef.current.RED };
    if (!kit?.ready || !next.BLUE.ready || !next.RED.ready) { setError("Tải Offline kit và Ready cả hai bot trước khi bắt đầu."); return; }
    slotsRef.current = next; setSlots(next);
    resetMatchState("PAUSED"); await checkpoint("PAUSED");
  }
  async function clearSession(): Promise<void> {
    if (runRef.current || activeAbort.current || !window.confirm("Xóa checkpoint Bot Offline trên thiết bị này?")) return;
    await clearBotOfflineSession(); resetMatchState("SETUP");
    setMessage("Đã xóa checkpoint local; không xóa dữ liệu tài khoản.");
  }
  function exportSession(): void {
    const snapshot = { state: stateRef.current, clocks: clocksRef.current, history: historyRef.current, memories: memoriesRef.current, slots: { BLUE: slotsRef.current.BLUE, RED: slotsRef.current.RED }, status: stateRef.current.status === "FINISHED" ? "FINISHED" as const : "PAUSED" as const, speedMs: speedRef.current, savedAt: new Date().toISOString(), activeComputeMs: activeComputeMs.current, endingReason: endingReason.current, pendingSlots: pendingSlotsRef.current, limitCriteria: limitCriteria.current };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ottv2-bot-offline-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("Đã xuất checkpoint local. File này không được gửi lên máy chủ.");
  }
  async function downloadKit(): Promise<void> {
    setError(""); setMessage("Đang tải Offline kit công khai…");
    try {
      const next = await installOfflineKit((done) => setKitProgress(done));
      setKit(next); setKitProgress(next.cached);
      if (!verifyOfflineRuntime) { setError("Trình duyệt chưa nạp được bộ xác minh Offline; hệ thống giữ khóa chạy."); return; }
      const verified = await verifyOfflineRuntime();
      setRuntimeReady(verified.ready);
      setRuntimeMessage(verified.message);
      if (!verified.ready) { setError(verified.message); return; }
      setMessage("Offline kit đã sẵn sàng và sandbox đã được xác minh; Bot Offline không cần server.");
    } catch { setError("Không tải đủ hoặc không xác minh được Offline kit. Kiểm tra mạng rồi thử lại; không tự chuyển sang server."); }
  }
  async function chooseFile(side: Side, file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".py") || file.size > DEFAULT_BOT_LIMITS.uploadBytes) { setError("Chỉ nhận file chiến thuật .py tối đa 64 KiB."); return; }
    try { updateSlot(side, { source: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()), fileName: file.name }); }
    catch { setError("Không thể đọc file UTF-8 hợp lệ. Chiến thuật đang chạy được giữ nguyên."); }
  }

  if (loading) return <section className="bot-offline-page"><LoadingState fullPage label="Đang kiểm tra Offline kit và checkpoint…" /></section>;
  const candidates = { BLUE: pendingSlots.BLUE ?? slots.BLUE, RED: pendingSlots.RED ?? slots.RED };
  return <section className="bot-offline-page robot-lab-bot-offline" aria-labelledby="bot-offline-title">
    {!runtimeReady && <div className="form-error" role="alert">{runtimeMessage}</div>}
    <p className="form-intro">Ngân sách mỗi nước 500 ms · tổng tính toán 30 giây · tối đa 60 vòng. Chạm trần phân định N/P/M sau đủ vòng; bằng mọi tiêu chí thì Đỏ đi sau thắng.</p>
    <p role="status">Tính toán đã dùng: {(activeComputeMs.current / 1000).toFixed(2)} giây · Xanh còn {(clocks.BLUE / 1000).toFixed(2)} giây · Đỏ còn {(clocks.RED / 1000).toFixed(2)} giây</p>
    {(["BLUE", "RED"] as const).map(side => pendingSlots[side] && <p key={side} role="status">{side === "BLUE" ? "Xanh" : "Đỏ"}: bản đang chạy {slots[side].revision}; bản chờ {pendingSlots[side]?.revision} chỉ áp dụng khi đã kiểm tra và Sẵn sàng, ở lượt kế tiếp của mình. Bộ nhớ bản mới được đặt lại.</p>)}
    {state.status === "FINISHED" && limitCriteria.current && <p>Kết quả N/P/M: Xanh {limitCriteria.current.BLUE.N}/{limitCriteria.current.BLUE.P}/{limitCriteria.current.BLUE.M} · Đỏ {limitCriteria.current.RED.N}/{limitCriteria.current.RED.P}/{limitCriteria.current.RED.M}. {endingReason.current === "LIMIT_EXACT_TIE" ? "Bằng mọi tiêu chí: Đỏ đi sau thắng theo luật ưu tiên đã công bố." : "Phân định theo thứ tự số quân, tiến độ, độ linh hoạt."}</p>}
    {searchParams.get("botId") && searchParams.get("revisionId") && <section className="bot-workbench-panel" aria-label="Chiến thuật từ Xưởng Bot"><h2>Chiến thuật đã chọn</h2><p>{runState === "SETUP" ? "Chọn slot để nạp. Bot chưa Sẵn sàng; bạn cần kiểm tra lại trước khi chơi." : "Đang giữ checkpoint hiện tại. Không tự ghi đè chiến thuật; hãy xuất và kết thúc phiên trước khi nạp bản đã chọn."}</p><Button disabled={runState !== "SETUP" || importing} onClick={() => void importSelection("BLUE")}>Nạp vào slot Xanh</Button><Button variant="secondary" disabled={runState !== "SETUP" || importing} onClick={() => void importSelection("RED")}>Nạp vào slot Đỏ</Button></section>}
    <header className="bot-offline-header"><div><p className="eyebrow">ROBOT LAB · ĐẤU CHƯƠNG TRÌNH OFFLINE</p><h1 id="bot-offline-title">Bot Offline</h1><p className="form-intro">Chuẩn bị hai chiến thuật và quản lý checkpoint trên trình duyệt. Chạy trận chỉ được mở khi sandbox thực tế đạt kiểm thử an toàn.</p></div><Link className="button secondary" to={routes.home}>Về sảnh</Link></header>
    <section className="bot-offline-kit" aria-label="Offline kit"><div><strong>OFFLINE KIT · {kit?.version ?? "—"}</strong><span>{kit?.message ?? "Chưa kiểm tra"}</span><span className={runtimeReady ? "bot-offline-runtime-ready" : "bot-offline-runtime-pending"} role="status">{runtimeMessage}</span></div><div className="bot-offline-kit-progress" aria-label={`Đã tải ${kitProgress || kit?.cached || 0} trên ${kit?.total ?? 5}`}>{kitProgress || kit?.cached || 0}/{kit?.total ?? 5}</div><Button variant="secondary" onClick={() => void downloadKit()}>{kit?.ready ? "Kiểm tra lại kit" : "Tải Offline kit"}</Button></section>
    {error && <div className="form-error" role="alert"><strong>{error}</strong></div>}{message && <div className="form-success" role="status">{message}</div>}{restored && <div className="bot-offline-restore" role="status">Đã khôi phục checkpoint. Phiên đang TẠM DỪNG để bạn kiểm tra trước khi chạy tiếp.</div>}
    <div className="bot-offline-layout"><div className="bot-offline-board"><GameBoard state={state} viewSide="BLUE" disabled /><div className="bot-offline-status"><span className={thinking ? "bot-thinking" : ""}>{thinking ? `Đang tính lượt ${thinking === "BLUE" ? "Xanh" : "Đỏ"}…` : runState === "FINISHED" ? "Trận đã kết thúc" : runState === "PAUSING" ? "Đang hoàn tất lượt rồi dừng…" : runState === "RUNNING" ? "Đang chạy" : "Tạm dừng ở ranh giới lượt"}</span><strong>Lượt {state.currentTurn === "BLUE" ? "Xanh" : state.currentTurn === "RED" ? "Đỏ" : "—"}</strong></div><div className="bot-offline-controls"><Button onClick={() => void startMatch()} disabled={!runtimeReady || !kit?.ready || thinking !== null || runState === "RUNNING"}>Ván mới</Button><Button onClick={() => void runLoop()} disabled={!runtimeReady || thinking !== null || runState === "RUNNING" || runState === "FINISHED" || runState === "SETUP"}>Chạy</Button><Button variant="secondary" onClick={pause} disabled={runState !== "RUNNING"}>Tạm dừng</Button><Button variant="secondary" onClick={() => void step()} disabled={!runtimeReady || thinking !== null || runState === "SETUP" || runState === "RUNNING" || runState === "FINISHED" || state.status !== "PLAYING"}>Từng nước</Button><label>Tốc độ<select value={speedMs} onChange={(event) => setSpeedMs(Number(event.target.value))}><option value={100}>Nhanh</option><option value={450}>Chuẩn</option><option value={1000}>Chậm</option></select></label></div><div className="bot-offline-result">{state.status === "FINISHED" ? <strong>Kết quả: {state.winner === "BLUE" ? "Xanh thắng" : "Đỏ thắng"}</strong> : <span>{history.length} lượt đã commit · checkpoint sau mỗi lượt</span>}</div></div>
      <aside className="bot-offline-slots" aria-label="Hai slot chiến thuật"><BotSlot side="BLUE" slot={candidates.BLUE} onSample={() => loadSample("BLUE")} onTest={() => void testSlot("BLUE")} onReady={() => toggleReady("BLUE")} onFile={(file) => void chooseFile("BLUE", file)} onSource={(source) => updateSlot("BLUE", { source })} onMemoryPolicy={(memoryPolicy) => updateSlot("BLUE", { memoryPolicy })} /><BotSlot side="RED" slot={candidates.RED} onSample={() => loadSample("RED")} onTest={() => void testSlot("RED")} onReady={() => toggleReady("RED")} onFile={(file) => void chooseFile("RED", file)} onSource={(source) => updateSlot("RED", { source })} onMemoryPolicy={(memoryPolicy) => updateSlot("RED", { memoryPolicy })} /><div className="bot-offline-actions"><Button variant="secondary" onClick={exportSession}>Xuất checkpoint</Button><Button variant="danger" onClick={() => void clearSession()} disabled={thinking !== null || runState === "RUNNING" || runState === "PAUSING"}>Xóa checkpoint</Button><span>Pause chỉ dừng sau khi lượt hiện tại commit; Step chạy đúng một lượt.</span></div></aside></div>
  </section>;
}

