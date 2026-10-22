import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { BotReadinessSnapshot, BotReadinessStatus } from "@ottv2/contracts";
import { routes } from "../../../app/routes";

const labels: Record<BotReadinessStatus, string> = {
  NOT_SUBMITTED: "Chưa nộp",
  PENDING: "Đang chờ",
  CHECKING: "Đang kiểm tra",
  READY: "Sẵn sàng",
  INCOMPATIBLE: "Không tương thích",
  BLOCKED_INFRA: "Hạ tầng đang chặn",
  STALE: "Dữ liệu cũ",
};

type PageState = { kind: "loading" } | { kind: "ready"; snapshot: BotReadinessSnapshot } | { kind: "blocked"; message: string };

export default function BotReadinessPage() {
  const { tournamentId = "" } = useParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [filter, setFilter] = useState<BotReadinessStatus | "ALL">("ALL");
  const liveRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/bot-readiness`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 403 ? "Bạn không có quyền xem trạng thái Bot của giải này." : "Máy chủ chưa cung cấp trạng thái Bot.");
      const payload = await response.json() as { snapshot: BotReadinessSnapshot };
      setState({ kind: "ready", snapshot: payload.snapshot });
    } catch (error) {
      setState({ kind: "blocked", message: error instanceof Error ? error.message : "Không thể tải trạng thái Bot." });
    }
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { liveRef.current?.focus(); }, [state]);

  const items = state.kind === "ready" ? state.snapshot.items.filter((item) => filter === "ALL" || item.status === filter) : [];
  return <main className="admin-page" aria-labelledby="bot-readiness-title">
    <div className="page-header">
      <div><p className="eyebrow">P16 · ROBOT LAB</p><h1 id="bot-readiness-title">Trạng thái Bot của giải</h1><p className="page-subtitle">Kiểm tra runtime cô lập, policy gate và revision đã ghim cho từng thí sinh.</p></div>
      <Link className="button secondary" to={routes.adminTournamentDetail.replace(":tournamentId", tournamentId)}>Về chi tiết giải</Link>
    </div>
    <div className="admin-toolbar" aria-label="Bộ lọc trạng thái Bot">
      <label>Trạng thái<select value={filter} onChange={(event) => setFilter(event.target.value as BotReadinessStatus | "ALL")}><option value="ALL">Tất cả</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="button secondary" type="button" onClick={() => void load()}>Kiểm tra lại</button>
    </div>
    <div ref={liveRef} tabIndex={-1} aria-live="polite" className="sr-only">{state.kind === "loading" ? "Đang tải trạng thái Bot" : state.kind === "blocked" ? state.message : `${items.length} đăng ký được hiển thị`}</div>
    {state.kind === "loading" && <div className="admin-empty-state" role="status">Đang đọc trạng thái runtime…</div>}
    {state.kind === "blocked" && <section className="admin-empty-state" role="alert"><h2>Chưa thể đọc trạng thái</h2><p>{state.message}</p><button className="button" type="button" onClick={() => void load()}>Thử lại</button></section>}
    {state.kind === "ready" && <section className="admin-table-card" aria-labelledby="bot-readiness-table-title"><div className="section-heading"><div><p className="eyebrow">SERVER AUTHORITATIVE</p><h2 id="bot-readiness-table-title">Danh sách kiểm tra</h2></div><span className="muted">Cập nhật {new Date(state.snapshot.evaluatedAt).toLocaleString("vi-VN")}</span></div><div className="table-scroll"><table><caption className="sr-only">Trạng thái runtime Bot theo đăng ký</caption><thead><tr><th>Thí sinh</th><th>Revision</th><th>Trạng thái</th><th>Kết quả</th></tr></thead><tbody>{items.map((item) => <tr key={item.enrollmentId}><th scope="row">{item.displayName}<small>{item.personKey}</small></th><td>{item.revisionId ? item.revisionId.slice(0, 8) : "—"}</td><td><span className={`status-pill status-${item.status.toLowerCase()}`}>{labels[item.status]}</span></td><td>{item.receipt?.safeMessage ?? "Chưa có lượt kiểm tra"}</td></tr>)}{items.length === 0 && <tr><td colSpan={4}>Không có đăng ký phù hợp bộ lọc.</td></tr>}</tbody></table></div></section>}
  </main>;
}
