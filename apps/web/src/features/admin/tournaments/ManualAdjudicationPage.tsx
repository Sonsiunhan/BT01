import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { ManualAdjudicationViewDto } from "@ottv2/contracts";
import {
  listManualAdjudications,
  ManualAdjudicationHttpError,
  submitManualAdjudicationVerdict,
} from "./manualAdjudicationApi";
import "./ManualAdjudicationPage.css";

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; adjudications: ManualAdjudicationViewDto[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function statusLabel(status: ManualAdjudicationViewDto["status"]): string {
  return ({ WAITING: "Chờ phán quyết", DECIDED: "Đã quyết định", FALLBACK_APPLIED: "Đã áp dụng fallback", CANCELLED: "Đã hủy" } as const)[status];
}

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể tải danh sách phán quyết.";
}

function Snapshot({ item }: { item: ManualAdjudicationViewDto }) {
  const board = item.board;
  const metrics = item.tieIndicators;
  return (
    <section className="manual-adjudication-card__snapshot" aria-labelledby={`snapshot-${item.id}`}>
      <h3 id={`snapshot-${item.id}`}>Snapshot trận đã dừng</h3>
      <p className="manual-adjudication-card__meta">
        Lượt đi: {item.sideToMove ?? "—"} · Luật: {item.ruleVersion ?? "—"}
      </p>
      {board ? <p className="manual-adjudication-card__meta">Bàn {board.rows}×{board.columns} · {board.cells.length} ô có dữ liệu</p> : <p className="manual-adjudication-card__meta">Chưa có dữ liệu bàn an toàn để hiển thị.</p>}
      {metrics ? <div className="manual-adjudication-card__metrics">
        {(["blue", "red"] as const).map((side) => (
          <div className="manual-adjudication-card__metric" key={side}>
            <strong>{side === "blue" ? "BLUE" : "RED"}</strong>
            N/P/M: {metrics[side].pieceCounts.N}/{metrics[side].pieceCounts.P}/{metrics[side].pieceCounts.M}<br />
            Nước hợp lệ: {metrics[side].legalMoveCount} · Ăn quân: {metrics[side].captureCount}
          </div>
        ))}
      </div> : null}
    </section>
  );
}

export default function ManualAdjudicationPage() {
  const { tournamentId = "" } = useParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [winnerById, setWinnerById] = useState<Record<string, "BLUE" | "RED">>({});
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async (focus = false) => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", adjudications: await listManualAdjudications(tournamentId) });
      if (focus) window.setTimeout(() => headingRef.current?.focus(), 0);
    } catch (error) {
      if (error instanceof ManualAdjudicationHttpError && (error.status === 401 || error.status === 403)) {
        setState({ kind: "forbidden", message: error.message });
      } else {
        setState({ kind: "error", message: errorMessage(error) });
      }
    }
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (item: ManualAdjudicationViewDto) => {
    const winnerSide = winnerById[item.id];
    const reason = reasonById[item.id]?.trim() ?? "";
    if (!winnerSide || reason.length < 3 || reason.length > 1000) return;
    setSubmittingId(item.id);
    try {
      await submitManualAdjudicationVerdict(item.id, { winnerSide, reason });
      await load(true);
    } catch (error) {
      setState((current) => current.kind === "ready" ? current : { kind: "error", message: errorMessage(error) });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <main className="manual-adjudication-page">
      <header className="manual-adjudication-page__header">
        <div><p className="manual-adjudication-page__eyebrow">P05 · Exact-tie</p><h1 className="manual-adjudication-page__title" tabIndex={-1} ref={headingRef}>Phân xử trận hòa tuyệt đối</h1></div>
        <button className="manual-adjudication-card__button" type="button" onClick={() => void load(true)}>Tải lại</button>
      </header>
      <p className="manual-adjudication-page__notice" role="note">Chỉ quản trị giải sở hữu giải có thể quyết định. Hệ thống dùng thời gian máy chủ và fallback đã công bố.</p>
      {state.kind === "loading" ? <p className="manual-adjudication-page__state" role="status">Đang tải danh sách phán quyết…</p> : null}
      {state.kind === "forbidden" ? <p className="manual-adjudication-page__state" role="alert">{state.message}</p> : null}
      {state.kind === "error" ? <div className="manual-adjudication-page__state" role="alert"><p>{state.message}</p><button className="manual-adjudication-card__button" type="button" onClick={() => void load(true)}>Thử lại</button></div> : null}
      {state.kind === "ready" ? <section className="manual-adjudication-page__list" aria-label="Danh sách phán quyết">
        {state.adjudications.length === 0 ? <p className="manual-adjudication-page__state">Hiện không có trận exact-tie cần xử lý.</p> : state.adjudications.map((item) => {
          const waiting = item.status === "WAITING";
          const reason = reasonById[item.id] ?? "";
          return <article className="manual-adjudication-card" key={item.id}>
            <div className="manual-adjudication-card__top"><div><strong>Trận {item.matchId}</strong><p className="manual-adjudication-card__meta">Phòng {item.roomId} · Hạn {formatDeadline(item.deadlineAt)}</p></div><span>{statusLabel(item.status)}</span></div>
            <div className="manual-adjudication-card__participants"><div className="manual-adjudication-card__side manual-adjudication-card__side--blue"><strong>BLUE</strong><br />{item.blueParticipant.label}</div><span className="manual-adjudication-card__vs">VS</span><div className="manual-adjudication-card__side manual-adjudication-card__side--red"><strong>RED</strong><br />{item.redParticipant.label}</div></div>
            <Snapshot item={item} />
            {waiting ? <form className="manual-adjudication-card__form" onSubmit={(event) => { event.preventDefault(); void submit(item); }}>
              <fieldset><legend>Chọn bên thắng</legend><label><input type="radio" name={`winner-${item.id}`} checked={winnerById[item.id] === "BLUE"} onChange={() => setWinnerById((current) => ({ ...current, [item.id]: "BLUE" }))} /> BLUE</label><label><input type="radio" name={`winner-${item.id}`} checked={winnerById[item.id] === "RED"} onChange={() => setWinnerById((current) => ({ ...current, [item.id]: "RED" }))} /> RED</label></fieldset>
              <label htmlFor={`reason-${item.id}`}>Lý do phán quyết (3–1000 ký tự)</label><textarea id={`reason-${item.id}`} value={reason} maxLength={1000} onChange={(event) => setReasonById((current) => ({ ...current, [item.id]: event.target.value }))} />
              <div className="manual-adjudication-card__actions"><button className="manual-adjudication-card__button" type="submit" disabled={submittingId === item.id || !winnerById[item.id] || reason.trim().length < 3}>Gửi phán quyết</button><span className="manual-adjudication-card__meta">{reason.length}/1000</span></div>
            </form> : <div className="manual-adjudication-card__terminal"><strong>Kết quả:</strong> {item.winnerSide ?? "—"} · {item.reason ?? "Không có lý do hiển thị"} ({item.resolutionSource ?? "—"})</div>}
          </article>;
        })}
      </section> : null}
    </main>
  );
}
