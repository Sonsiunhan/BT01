import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  BotReadinessItem,
  BotReadinessJob,
  BotReadinessSnapshot,
  BotReadinessStatus,
} from "@ottv2/contracts";

import { routes } from "../../../app/routes";
import "./BotReadinessPage.css";

const labels: Record<BotReadinessStatus, string> = {
  NOT_SUBMITTED: "Chưa chọn Bot",
  PENDING: "Đã xếp hàng",
  CHECKING: "Đang kiểm tra",
  READY: "Sẵn sàng",
  INCOMPATIBLE: "Không tương thích",
  BLOCKED_INFRA: "Hạ tầng đang chặn",
  STALE: "Mục tiêu đã thay đổi",
};

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: BotReadinessSnapshot; loadingMore: boolean }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type ActiveJob = { enrollmentId: string; job: BotReadinessJob } | null;

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path: string) => `${apiBase}${path}`;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p16-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function terminalJob(job: BotReadinessJob): boolean {
  return !["QUEUED", "CHECKING"].includes(job.state);
}

function safeError(response: Response): string {
  if (response.status === 403) return "Bạn không có quyền xem hoặc thao tác trạng thái Bot của giải này.";
  if (response.status === 401) return "Phiên làm việc đã hết hạn. Hãy đăng nhập lại.";
  return "Máy chủ chưa thể cung cấp trạng thái Bot. Hãy thử lại.";
}

export default function BotReadinessPage() {
  const { tournamentId = "" } = useParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [filter, setFilter] = useState<BotReadinessStatus | "ALL">("ALL");
  const [activeJob, setActiveJob] = useState<ActiveJob>(null);
  const [notice, setNotice] = useState("");
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestIdRef = useRef(0);
  const focusRequestRef = useRef<"status" | "safe" | null>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const safeHeadingRef = useRef<HTMLHeadingElement>(null);

  const announce = useCallback((message: string, focus: "status" | "safe" | null = null) => {
    setNotice(message);
    if (focus) focusRequestRef.current = focus;
  }, []);

  const abortPending = useCallback(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
  }, []);

  const load = useCallback(async (options?: { append?: boolean; cursor?: string | null; focusOnResult?: boolean }) => {
    abortPending();
    const controller = new AbortController();
    const id = ++requestIdRef.current;
    requestRef.current = { id, controller };
    const append = options?.append === true;
    if (!append) setState({ kind: "loading" });
    else setState((current) => current.kind === "ready" ? { ...current, loadingMore: true } : current);
    const query = new URLSearchParams({ limit: "50" });
    if (filter !== "ALL") query.set("status", filter);
    if (options?.cursor) query.set("cursor", options.cursor);
    try {
      const response = await fetch(api(`/api/tournaments/${encodeURIComponent(tournamentId)}/bot-readiness?${query.toString()}`), {
        headers: { Accept: "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      if (id !== requestIdRef.current) return;
      if (response.status === 403 || response.status === 401) {
        setState({ kind: "forbidden", message: safeError(response) });
        announce("Không có quyền truy cập trạng thái Bot.", "safe");
        return;
      }
      if (!response.ok) throw new Error(safeError(response));
      const payload = await response.json() as { snapshot: BotReadinessSnapshot };
      const next = payload.snapshot;
      setState((current) => {
        if (!append || current.kind !== "ready") return { kind: "ready", snapshot: next, loadingMore: false };
        return {
          kind: "ready",
          loadingMore: false,
          snapshot: { ...next, items: [...current.snapshot.items, ...next.items] },
        };
      });
      if (options?.focusOnResult) announce("Đã cập nhật trạng thái Bot.", next.applicable ? "status" : "safe");
    } catch (error) {
      if (controller.signal.aborted || id !== requestIdRef.current) return;
      setState({ kind: "error", message: error instanceof Error ? error.message : "Không thể tải trạng thái Bot." });
      announce("Không thể tải trạng thái Bot.", "safe");
    } finally {
      if (requestRef.current?.id === id) requestRef.current = null;
    }
  }, [abortPending, announce, filter, tournamentId]);

  useEffect(() => {
    setActiveJob(null);
    setNotice("");
    void load({ focusOnResult: requestIdRef.current > 0 });
    return abortPending;
  }, [abortPending, load]);

  useEffect(() => {
    const requested = focusRequestRef.current;
    if (!requested) return;
    focusRequestRef.current = null;
    window.setTimeout(() => {
      if (requested === "status") statusHeadingRef.current?.focus();
      else safeHeadingRef.current?.focus();
    }, 0);
  }, [state, notice]);

  const pollJob = useCallback(async (job: BotReadinessJob, enrollmentId: string) => {
    let current = job;
    for (let attempt = 0; attempt < 20 && !terminalJob(current); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const response = await fetch(api(`/api/tournaments/${encodeURIComponent(tournamentId)}/bot-readiness/jobs/${encodeURIComponent(current.jobId)}`), {
        headers: { Accept: "application/json" }, credentials: "include",
      });
      if (!response.ok) {
        setActiveJob(null);
        const message = safeError(response);
        if (response.status === 401 || response.status === 403) setState({ kind: "forbidden", message });
        announce(message, "safe");
        return;
      }
      current = (await response.json() as { job: BotReadinessJob }).job;
      setActiveJob({ enrollmentId, job: current });
    }
    setActiveJob(null);
    if (terminalJob(current)) {
      await load({ focusOnResult: true });
      return;
    }
    announce("Lượt kiểm tra vẫn đang chờ runtime. Bạn có thể tải lại để xem tiếp.", "status");
  }, [announce, load, tournamentId]);

  const recheck = useCallback(async (item: BotReadinessItem) => {
    if (!item.permittedActions.canRecheck || activeJob) return;
    try {
      const response = await fetch(api(`/api/tournaments/${encodeURIComponent(tournamentId)}/bot-readiness/rechecks`), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enrollmentId: item.enrollmentId,
          expectedEnrollmentRevision: item.revision,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      if (response.status === 403 || response.status === 401) {
        setState({ kind: "forbidden", message: safeError(response) });
        announce("Không có quyền yêu cầu kiểm tra lại.", "safe");
        return;
      }
      if (!response.ok) throw new Error(safeError(response));
      const payload = await response.json() as { item: BotReadinessItem; job: BotReadinessJob };
      setActiveJob({ enrollmentId: item.enrollmentId, job: payload.job });
      announce("Đã gửi yêu cầu kiểm tra Bot. Hệ thống đang theo dõi kết quả.", "status");
      await pollJob(payload.job, item.enrollmentId);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Không thể gửi yêu cầu kiểm tra lại.", "safe");
    }
  }, [activeJob, announce, pollJob, tournamentId]);

  const snapshot = state.kind === "ready" ? state.snapshot : null;
  const rows = snapshot?.items ?? [];

  return <main className="admin-page bot-readiness-page" aria-labelledby="bot-readiness-title">
    <div className="page-header bot-readiness-header">
      <div>
        <p className="eyebrow">P16 · ROBOT LAB</p>
        <h1 id="bot-readiness-title">Trạng thái sẵn sàng Bot</h1>
        <p className="page-subtitle">Theo dõi revision đã ghim, policy gate và kết quả runtime cô lập của từng đăng ký.</p>
      </div>
      <Link className="button secondary" to={routes.adminTournamentDetail.replace(":tournamentId", tournamentId)}>Quay lại chi tiết giải</Link>
    </div>

    <div className="bot-readiness-toolbar" aria-label="Bộ lọc trạng thái Bot">
      <label htmlFor="bot-readiness-filter">Trạng thái
        <select id="bot-readiness-filter" value={filter} onChange={(event) => setFilter(event.target.value as BotReadinessStatus | "ALL")}>
          <option value="ALL">Tất cả trạng thái</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button className="button secondary" type="button" onClick={() => void load({ focusOnResult: true })}>Làm mới trạng thái</button>
    </div>

    <p className="sr-only" aria-live="polite" aria-atomic="true">{notice}</p>

    {state.kind === "loading" && <section className="bot-readiness-state" role="status"><h2>Đang tải trạng thái Bot</h2><p>Hệ thống đang đọc dữ liệu authoritative từ máy chủ.</p></section>}

    {state.kind === "forbidden" && <section className="bot-readiness-state" role="alert" aria-labelledby="bot-readiness-safe-heading"><h2 ref={safeHeadingRef} id="bot-readiness-safe-heading" tabIndex={-1}>Không có quyền truy cập</h2><p>{state.message}</p><Link className="button secondary" to={routes.adminTournaments}>Về danh sách giải</Link></section>}

    {state.kind === "error" && <section className="bot-readiness-state" role="alert" aria-labelledby="bot-readiness-safe-heading"><h2 ref={safeHeadingRef} id="bot-readiness-safe-heading" tabIndex={-1}>Chưa thể đọc trạng thái</h2><p>{state.message}</p><button className="button" type="button" onClick={() => void load({ focusOnResult: true })}>Thử lại</button></section>}

    {snapshot && !snapshot.applicable && <section className="bot-readiness-state" aria-labelledby="bot-readiness-safe-heading"><h2 ref={safeHeadingRef} id="bot-readiness-safe-heading" tabIndex={-1}>Không áp dụng cho giải này</h2><p>{snapshot.notApplicableMessage}</p></section>}

    {snapshot?.applicable && <section className="bot-readiness-card" aria-labelledby="bot-readiness-status-heading">
      <div className="bot-readiness-card-heading">
        <div>
          <p className="eyebrow">SERVER AUTHORITATIVE</p>
          <h2 ref={statusHeadingRef} id="bot-readiness-status-heading" tabIndex={-1}>Danh sách readiness</h2>
        </div>
        <span className="bot-readiness-updated">Cập nhật {new Date(snapshot.evaluatedAt).toLocaleString("vi-VN")}</span>
      </div>
      {rows.length === 0 ? <div className="bot-readiness-empty"><p>Không có đăng ký phù hợp bộ lọc hiện tại.</p></div> : <div className="bot-readiness-table-scroll"><table><caption className="sr-only">Trạng thái runtime Bot theo đăng ký</caption><thead><tr><th>Thí sinh</th><th>Target đã ghim</th><th>Trạng thái</th><th>Kết quả an toàn</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{rows.map((item) => {
        const job = activeJob?.enrollmentId === item.enrollmentId ? activeJob.job : null;
        const busy = Boolean(job && !terminalJob(job));
        return <tr key={item.enrollmentId}>
          <th scope="row"><span>{item.displayName}</span><small>{item.personKey}</small></th>
          <td>{item.target ? <dl className="bot-readiness-target"><div><dt>Revision</dt><dd>#{item.revisionNumber ?? "—"}</dd></div><div><dt>Luật / cấu hình</dt><dd>{item.target.ruleVersion} · v{item.target.configVersionNumber}</dd></div><div><dt>Digest</dt><dd>{item.target.sourceDigestPrefix}</dd></div></dl> : <span className="muted">Chưa có revision</span>}</td>
          <td><span className={`bot-readiness-pill is-${item.status.toLowerCase()}`}>{labels[item.status]}</span>{busy && <small className="bot-readiness-job">{job?.state === "QUEUED" ? "Đang xếp hàng runtime" : "Đang chạy runtime"}</small>}</td>
          <td><span>{item.receipt?.safeMessage ?? (item.safeReason === "NOT_SELECTED" ? "Chưa có Bot được chọn." : "Đang chờ kết quả kiểm tra.")}</span>{item.retryable && <small>Có thể kiểm tra lại sau.</small>}</td>
          <td>{item.permittedActions.canRecheck && <button className="button secondary bot-readiness-action" type="button" disabled={busy || Boolean(activeJob)} aria-describedby={busy ? `job-${item.enrollmentId}` : undefined} onClick={() => void recheck(item)}>{busy ? "Đang kiểm tra" : "Kiểm tra lại"}</button>}<span id={`job-${item.enrollmentId}`} className="sr-only">{busy ? "Lượt kiểm tra đang được xử lý" : ""}</span></td>
        </tr>;
      })}</tbody></table></div>}
      {snapshot.nextCursor && <div className="bot-readiness-more"><button className="button secondary" type="button" disabled={state.kind !== "ready" || state.loadingMore} onClick={() => void load({ append: true, cursor: snapshot.nextCursor })}>{state.kind === "ready" && state.loadingMore ? "Đang tải…" : "Tải thêm đăng ký"}</button></div>}
    </section>}
  </main>;
}
