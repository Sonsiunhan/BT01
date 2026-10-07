import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { HistoryDetailResponse, HistoryListResponse, HistoryMatchCard } from "@ottv2/contracts";

import { routes } from "../app/routes";
import { Button, LoadingState, Modal } from "../components/ui";
import { ApiError } from "../services/http/apiError";
import { getHistory, getHistoryAudit, getHistoryDetail, type HistoryFilters } from "../services/history/historyApi";
import { clearGuestHistory, getImportDecision, getLocalHistory, setImportDecision, type LocalHistoryRecord } from "../services/local/localGameStorage";
import { importGuestHistory } from "../services/guest/guestApi";
import { loginReturnPath } from "../services/auth/returnUrl";
import { FinalPositionThumbnail } from "../components/history/FinalPositionThumbnail";
import { ReplayPanel } from "../components/history/ReplayPanel";
import { GuestBotHistoryImport } from "../components/history/GuestBotHistoryImport";

const modeFilters: Array<{ value: HistoryFilters["mode"]; label: string }> = [
  { value: "ALL", label: "Tất cả" }, { value: "RANKED", label: "Xếp hạng" }, { value: "UNRANKED", label: "Chơi Online" }, { value: "AI", label: "Đấu máy" }, { value: "OFFLINE", label: "Offline" }, { value: "BOT_ONLINE", label: "Bot Online" }, { value: "BOT_OFFLINE", label: "Bot Offline" }, { value: "GUEST", label: "Khách" },
];
const resultFilters: Array<{ value: HistoryFilters["result"]; label: string }> = [{ value: "ALL", label: "Kết quả" }, { value: "WIN", label: "Thắng" }, { value: "LOSS", label: "Thua" }];
const rangeFilters: Array<{ value: HistoryFilters["range"]; label: string }> = [{ value: "ALL", label: "Tất cả thời gian" }, { value: "7D", label: "7 ngày" }, { value: "30D", label: "30 ngày" }];

type PageState = { kind: "loading" } | { kind: "guest" } | { kind: "ready"; data: HistoryListResponse } | { kind: "error"; message: string };

export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { matchId } = useParams<{ matchId?: string }>();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [retryNonce, setRetryNonce] = useState(0);
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [localRecords, setLocalRecords] = useState<LocalHistoryRecord[]>([]);
  const [localGuestRecords, setLocalGuestRecords] = useState<LocalHistoryRecord[]>([]);
  const [importingGuest, setImportingGuest] = useState(false);
  const [importError, setImportError] = useState("");
  const [auditState, setAuditState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    const controller = new AbortController();
    getHistory(filters, controller.signal).then((data) => { if (active) setState({ kind: "ready", data }); }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) setState({ kind: "guest" });
      else setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải lịch sử đấu." });
    });
    return () => { active = false; controller.abort(); };
  }, [filters, location, navigate, retryNonce]);

  useEffect(() => {
    if (!matchId) { setDetail(null); return; }
    let active = true;
    setDetailLoading(true);
    getHistoryDetail(matchId).then((result) => { if (active) setDetail(result); }).catch((reason) => { if (active) setDetail(null); if (reason instanceof ApiError && reason.status === 401) navigate(loginReturnPath(location), { replace: true }); else if (reason instanceof ApiError && reason.status === 404) navigate(routes.history, { replace: true }); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [location, matchId, navigate]);

  useEffect(() => { setAuditState("idle"); }, [matchId]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const requested = ++generation;
      void Promise.all([getLocalHistory(), getImportDecision()]).then(([records, decision]) => {
        if (!active || requested !== generation) return;
        setLocalRecords(records);
        setLocalGuestRecords(!decision ? records.filter((record) => record.mode === "GUEST") : []);
      });
    };
    window.addEventListener("ottv2:local-history-changed", refresh);
    refresh();
    return () => { active = false; window.removeEventListener("ottv2:local-history-changed", refresh); };
  }, []);

  async function syncGuestHistory(): Promise<void> {
    setImportingGuest(true);
    setImportError("");
    try {
      const records = localGuestRecords.map(({ localId, result, playerName, opponentName, timerSeconds, durationSeconds, endedAt, scoreDelta }) => ({ localId, mode: "GUEST" as const, result, playerName, opponentName, timerSeconds, durationSeconds, endedAt, scoreDelta }));
      await importGuestHistory(records);
      await setImportDecision("IMPORTED");
      await clearGuestHistory();
      setLocalGuestRecords([]);
      setLocalRecords((current) => current.filter((record) => record.mode !== "GUEST"));
    } catch (reason) {
      setImportError(reason instanceof ApiError ? reason.message : "Không thể đồng bộ lịch sử Guest.");
    } finally { setImportingGuest(false); }
  }

  async function deferGuestHistory(): Promise<void> {
    await setImportDecision("DECLINED");
    setLocalGuestRecords([]);
  }

  const updateFilter = <K extends "mode" | "result" | "range">(key: K, value: HistoryFilters[K]) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("cursor");
    setSearchParams(next, { replace: true });
  };
  const retry = () => setRetryNonce((current) => current + 1);
  const closeDetail = () => navigate({ pathname: routes.history, search: location.search });
  const openDetail = (match: HistoryMatchCard) => navigate({ pathname: `/history/${encodeURIComponent(match.matchId)}`, search: location.search });
  const loadMore = () => {
    if (state.kind !== "ready" || !state.data.nextCursor) return;
    const controller = new AbortController();
    getHistory({ ...filters, cursor: state.data.nextCursor }, controller.signal).then((data) => setState((current) => current.kind === "ready" ? { kind: "ready", data: { ...data, matches: [...current.data.matches, ...data.matches] } } : current)).catch(() => undefined);
  };

  return <section className="history-page robot-lab-history-page">
    <header className="history-header"><div><p className="eyebrow">LỊCH SỬ THI ĐẤU</p><h1>Lịch sử đấu</h1><p className="form-intro">Theo dõi Elo, kết quả và những ván đấu đã hoàn tất.</p></div><Link className="button primary" to={routes.queue}>Chơi xếp hạng</Link></header>
    {state.kind === "ready" ? <div className="history-summary" aria-label="Tóm tắt lịch sử"><div><span>ELO HIỆN TẠI</span><strong>{state.data.summary.elo}</strong></div><div><span>THẮNG – THUA</span><strong>{state.data.summary.wins}–{state.data.summary.losses}</strong></div><div><span>WIN RATE</span><strong>{state.data.summary.winRate}%</strong></div></div> : <div className="history-summary history-summary-skeleton" aria-hidden="true"><div><span /><strong /></div><div><span /><strong /></div><div><span /><strong /></div></div>}
    <div className="history-filters" aria-label="Bộ lọc lịch sử"><div className="filter-group"><span>CHẾ ĐỘ</span>{modeFilters.map((item) => <button className={`filter-chip ${filters.mode === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("mode", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>KẾT QUẢ</span>{resultFilters.map((item) => <button className={`filter-chip ${filters.result === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("result", item.value)}>{item.label}</button>)}</div><div className="filter-group"><span>THỜI GIAN</span>{rangeFilters.map((item) => <button className={`filter-chip ${filters.range === item.value ? "active" : ""}`} type="button" key={item.value} onClick={() => updateFilter("range", item.value)}>{item.label}</button>)}</div></div>
    <div className="history-local-region">
      <LocalHistorySection records={localRecords} mode={filters.mode} result={filters.result} />
      {state.kind === "ready" && ["ALL", "BOT_ONLINE", "GUEST"].includes(filters.mode) && <GuestBotHistoryImport records={localRecords} />}
    </div>
    <div className="history-state-region">
      {state.kind === "loading" && <HistoryLoadingSkeleton />}
      {state.kind === "guest" && <div className="history-state"><h2>Lịch sử Guest được lưu trên thiết bị này.</h2><p>Đăng nhập để xem lịch sử tài khoản. Dữ liệu trên thiết bị không tự đồng bộ.</p><Link className="button secondary" to={loginReturnPath(location)}>Đăng nhập</Link></div>}
      {state.kind === "error" && <div className="history-state"><p className="eyebrow">KẾT NỐI</p><h2>Không thể tải lịch sử đấu.</h2><p>{state.message}</p><Button onClick={retry}>Thử lại</Button></div>}
      {state.kind === "ready" && state.data.matches.length === 0 && <div className="history-state"><p className="eyebrow">CHƯA CÓ DỮ LIỆU</p><h2>Chưa có trận đấu nào.</h2><p>Hãy bắt đầu trận đầu tiên của bạn.</p><Link className="button primary" to={routes.queue}>Chơi 1vs1 Online</Link></div>}
      {state.kind === "ready" && state.data.matches.length > 0 && <div className="history-list">{state.data.matches.map((match) => <HistoryCard key={match.matchId} match={match} onOpen={() => openDetail(match)} />)}{state.data.hasMore && <Button variant="secondary" onClick={loadMore}>Tải thêm 20 trận</Button>}</div>}
    </div>
    <Modal open={Boolean(matchId)} title={detailLoading ? "Đang tải chi tiết trận…" : detail ? "Chi tiết trận đấu" : "Không thể tải chi tiết trận"} description={detail ? `${formatMode(detail.match.mode)} · ${detail.match.matchId}` : undefined} onClose={closeDetail}>
      {detailLoading && <LoadingState label="Đang tải chi tiết…" />}{detail && <DetailPanel match={detail.match} auditState={auditState} onDownloadAudit={async () => {
        setAuditState("loading");
        try {
          const audit = await getHistoryAudit(detail.match.matchId);
          const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `ottv2-audit-${detail.match.matchId}.json`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 0);
          setAuditState("idle");
        } catch {
          setAuditState("error");
        }
      }} />}{!detailLoading && !detail && <div className="history-state compact"><p>Trận đấu không tồn tại hoặc bạn không có quyền xem.</p><Button onClick={() => navigate(routes.history)}>Đóng</Button></div>}
    </Modal>
    <Modal open={state.kind === "ready" && localGuestRecords.length > 0} title="ĐỒNG BỘ LỊCH SỬ?" description="Lịch sử Guest đang nằm trên thiết bị này. Bạn có muốn đưa vào tài khoản hiện tại không?" onClose={() => void deferGuestHistory()}><div className="import-prompt"><p><strong>{localGuestRecords.length} ván Guest</strong> sẽ được kiểm tra trùng lặp trước khi lưu.</p>{importError && <p className="form-error" role="alert">{importError}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => void deferGuestHistory()} disabled={importingGuest}>Để sau</Button><Button onClick={() => void syncGuestHistory()} pending={importingGuest} pendingLabel="Đang đồng bộ…">Đồng bộ</Button></div></div></Modal>
  </section>;
}

function HistoryLoadingSkeleton() {
  return <div className="history-loading" role="status" aria-label="Đang tải lịch sử đấu">
    <div className="history-summary history-summary-skeleton" aria-hidden="true">{[1, 2, 3].map((item) => <div key={item}><span /><strong /></div>)}</div>
    <div className="history-list" aria-hidden="true">{[1, 2, 3].map((item) => <div className="history-card history-card-skeleton" key={item}><span /><div><span /><strong /><small /></div><div><span /><small /></div></div>)}</div>
    <span className="visually-hidden">Đang tải lịch sử đấu…</span>
  </div>;
}

function LocalHistorySection({ records, mode, result }: { records: LocalHistoryRecord[]; mode: HistoryFilters["mode"]; result: HistoryFilters["result"] }) {
  const visible = records.filter((record) => (mode === "ALL" || mode === record.mode) && (result === "ALL" || (result === "WIN" ? record.result === "WIN" : record.result === "LOSS")));
  if (visible.length === 0) return null;
  return <section className="local-history-section" aria-label="Lịch sử trên thiết bị"><div className="local-history-heading"><div><p className="eyebrow">NGUỒN LOCAL</p><h2>Trên thiết bị</h2></div><span className="history-source-badge">Không đồng bộ tự động</span></div><div className="local-history-list">{visible.map((record) => <article className={`local-history-card ${record.result.toLowerCase()}`} key={record.localId}><div><span className="history-source-badge">Trên thiết bị</span><strong>{record.result === "WIN" ? "THẮNG" : record.result === "LOSS" ? "THUA" : "KẾT QUẢ CHƯA PHÂN ĐỊNH"}</strong><small>{formatLocalMode(record.mode)}</small></div><div><strong>{record.playerName}</strong><span>VS</span><strong>{record.opponentName}</strong></div><div><span>{record.timerSeconds}s/người · {formatDuration(record.durationSeconds)}</span><span>{formatDate(record.endedAt)}</span><small>Chỉ lưu tóm tắt local · Replay không khả dụng</small></div></article>)}</div></section>;
}

function HistoryCard({ match, onOpen }: { match: HistoryMatchCard; onOpen: () => void }) {
  const resultLabel = match.result === "WIN" ? "THẮNG" : match.result === "LOSS" ? "THUA" : "GIÁN ĐOẠN";
  return <button className={`history-card ${match.result.toLowerCase()}`} type="button" onClick={onOpen}><div className="history-card-result"><strong>{resultLabel}</strong><span>{formatMode(match.mode)}</span><small className="history-source-badge">{match.source === "LOCAL" ? "Trên thiết bị" : "Tài khoản"}</small></div><div className="history-card-versus"><div><small>BẠN · {formatSide(match.viewer.side)}</small><strong>{match.viewer.displayName}</strong><span>{match.viewer.ratingAfter ?? match.viewer.ratingBefore ?? "—"}</span></div><b>VS</b><div><small>ĐỐI THỦ · {match.opponent ? formatSide(match.opponent.side) : "—"}</small><strong>{match.opponent?.displayName ?? "Không có đối thủ"}</strong><span>{match.opponent?.ratingAfter ?? match.opponent?.ratingBefore ?? "—"}</span></div></div><div className="history-card-meta"><span>{match.result === "ABORTED" ? "Trận bị gián đoạn" : formatReason(match.resultReason)}</span><span>{match.timerSeconds}s/người · {formatDate(match.endedAt)}</span><span>{match.replayAvailable ? `Replay · ${match.moveCount ?? 0} nước` : "Chỉ thumbnail cuối"}</span>{match.ratingDelta !== null && <b>{match.ratingDelta > 0 ? "+" : ""}{match.ratingDelta} Elo</b>}</div></button>;
}

function DetailPanel({ match, auditState, onDownloadAudit }: { match: HistoryDetailResponse["match"]; auditState: "idle" | "loading" | "error"; onDownloadAudit: () => Promise<void> }) {
  const replay = match.replay ?? { available: false, moves: [], timeline: [], legacyFinalBoardOnly: true };
  return <div className="history-detail"><div className="detail-result"><span>{match.result === "ABORTED" ? "GIÁN ĐOẠN" : match.result === "WIN" ? "THẮNG" : "THUA"}</span><strong>{match.result === "ABORTED" ? "Trận bị gián đoạn" : match.result === "WIN" ? "Bạn thắng" : "Bạn thua"}</strong><small>{match.source === "LOCAL" ? "Nguồn: Trên thiết bị" : "Nguồn: Tài khoản"}</small></div><FinalPositionThumbnail board={match.finalBoard} /><ReplayPanel replay={replay} finalBoard={match.finalBoard} />{match.botAdjudication && <BotAdjudicationPanel adjudication={match.botAdjudication} />}<div className="history-audit-actions"><Button variant="secondary" onClick={() => void onDownloadAudit()} pending={auditState === "loading"} pendingLabel="Đang chuẩn bị…">Tải audit công khai</Button><small>Chỉ gồm nước đi, timeline công khai và thời hạn lưu trữ; không gồm source, memory hay log riêng.</small>{auditState === "error" && <span className="form-error" role="alert">Không thể tải audit công khai. Vui lòng thử lại.</span>}</div><dl><div><dt>Mã trận</dt><dd>{match.matchId}</dd></div><div><dt>Phòng</dt><dd>{match.roomId}</dd></div><div><dt>Kết quả</dt><dd>{formatReason(match.resultReason)}</dd></div><div><dt>Thời lượng</dt><dd>{formatDuration(match.durationSeconds)}</dd></div><div><dt>Bắt đầu</dt><dd>{match.startedAt ? formatDate(match.startedAt) : "—"}</dd></div><div><dt>Kết thúc</dt><dd>{formatDate(match.endedAt)}</dd></div><div><dt>Thời gian</dt><dd>{match.timerSeconds}s/người</dd></div><div><dt>Elo thay đổi</dt><dd>{match.ratingDelta === null ? "—" : `${match.ratingDelta > 0 ? "+" : ""}${match.ratingDelta}`}</dd></div></dl><div className="detail-players">{match.players.map((player) => <div key={player.userId}><span>{formatSide(player.side)}</span><strong>{player.displayName}</strong><small>@{player.username} · {player.ratingBefore ?? "—"} → {player.ratingAfter ?? "—"}</small></div>)}</div></div>;
}

function BotAdjudicationPanel({ adjudication }: { adjudication: NonNullable<HistoryMatchCard["botAdjudication"]> }) {
  const reason = adjudication.reason === "LIMIT_EXACT_TIE" ? "Bằng tuyệt đối · Đỏ thắng theo luật công bố" : adjudication.reason === "LIMIT_CRITERIA" ? "Phân định theo thứ tự N → P → M" : adjudication.reason === "AUTHOR_FAULT" ? `Lỗi chiến thuật của phe ${formatSide(adjudication.faultSide ?? "BLUE")}` : "Sự cố hạ tầng · không gán lỗi Bot";
  return <section className="bot-adjudication" aria-label="Phân định Bot"><div><p className="eyebrow">BOT · PHÂN ĐỊNH CÔNG KHAI</p><h3>{reason}</h3><small>Không phải đánh giá Elo hay suy luận source riêng.</small></div><div className="bot-criteria-grid"><div><strong>Xanh</strong><span>N {adjudication.BLUE.N} · P {adjudication.BLUE.P} · M {adjudication.BLUE.M}</span></div><div><strong>Đỏ</strong><span>N {adjudication.RED.N} · P {adjudication.RED.P} · M {adjudication.RED.M}</span></div></div></section>;
}

function parseFilters(params: URLSearchParams): HistoryFilters {
  const mode = params.get("mode");
  const result = params.get("result");
  const range = params.get("range");
  return {
    mode: mode === "RANKED" || mode === "UNRANKED" || mode === "GUEST" || mode === "AI" || mode === "OFFLINE" || mode === "BOT_ONLINE" || mode === "BOT_OFFLINE" ? mode : "ALL",
    result: result === "WIN" || result === "LOSS" ? result : "ALL",
    range: range === "7D" || range === "30D" ? range : "ALL",
  };
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number): string { return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
function formatSide(side: "BLUE" | "RED"): string { return side === "BLUE" ? "Xanh" : "Đỏ"; }
function formatMode(mode: HistoryMatchCard["mode"]): string { return ({ RANKED: "Xếp hạng", UNRANKED: "Chơi Online", GUEST: "Khách", AI: "Đấu máy", OFFLINE: "Offline", BOT_ONLINE: "Bot Online", BOT_OFFLINE: "Bot Offline" } as const)[mode]; }
function formatLocalMode(mode: LocalHistoryRecord["mode"]): string { return ({ GUEST: "Guest", AI: "Đấu máy", OFFLINE: "Offline", BOT_ONLINE: "Bot Online · Guest" } as const)[mode]; }
function formatReason(reason: string | null): string { return reason ? ({ GOAL_REACHED: "Chiếm ô đích", SURRENDER: "Đầu hàng", TIMEOUT: "Hết giờ", DISCONNECTED: "Mất kết nối", DISCONNECT_TIMEOUT: "Đối thủ không kết nối lại", SERVER_INTERRUPTION: "Máy chủ bị gián đoạn", BOT_AUTHOR_FAULT: "Bot vi phạm giới hạn / trả kết quả lỗi", BOT_INFRASTRUCTURE: "Sự cố hạ tầng · kết quả trung tính", BOT_LIMIT_CRITERIA: "Chạm giới hạn · N/P/M", BOT_LIMIT_EXACT_TIE: "Hòa tiêu chí · Đỏ thắng theo luật", EXTINCTION: "Đối thủ mất toàn bộ Kéo", ABORTED: "Đã hủy" } as Record<string, string>)[reason] ?? reason.replaceAll("_", " ") : "—"; }
