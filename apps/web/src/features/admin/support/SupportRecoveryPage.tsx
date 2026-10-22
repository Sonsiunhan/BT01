import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { D07SupportRequestStatus, SupportRequestView } from "@ottv2/contracts";
import { Button } from "../../../components/ui";
import { ApiError } from "../../../services/http/apiError";
import { recoveryApi, type RecoveryApi } from "../../../services/support/recoveryApi";

export interface SupportRecoveryPageProps {
  api?: RecoveryApi;
}

const statuses: D07SupportRequestStatus[] = ["OPEN", "IN_PROGRESS", "VERIFIED", "REJECTED", "RESOLVED", "ESCALATED", "CLOSED"];
const statusLabel: Record<D07SupportRequestStatus, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang xử lý",
  VERIFIED: "Đã xác minh",
  REJECTED: "Từ chối",
  RESOLVED: "Đã giải quyết",
  ESCALATED: "Đã chuyển cấp",
  CLOSED: "Đã đóng",
};

export default function SupportRecoveryPage({ api = recoveryApi }: SupportRecoveryPageProps) {
  const [filter, setFilter] = useState<D07SupportRequestStatus | "">("");
  const [requests, setRequests] = useState<SupportRequestView[]>([]);
  const [selected, setSelected] = useState<SupportRequestView | null>(null);
  const [verificationReference, setVerificationReference] = useState("");
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list(filter || undefined);
      setRequests(result.requests);
      setSelected((current) => current ? result.requests.find((item) => item.id === current.id) ?? current : result.requests[0] ?? null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) setError("Bạn không có quyền truy cập hàng đợi hỗ trợ.");
      else setError(cause instanceof Error ? cause.message : "Không thể tải hàng đợi hỗ trợ.");
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => { void load(); }, [load]);

  const select = async (item: SupportRequestView) => {
    setSelected(item);
    setHandoffToken(null);
    try {
      setSelected(await api.detail(item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải chi tiết yêu cầu.");
    }
  };

  const transition = async (action: "IN_PROGRESS" | "VERIFY" | "REJECT" | "RESOLVE" | "CLOSE") => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.transition(selected.id, {
        action,
        ...(action === "VERIFY" ? { verificationReference: verificationReference.trim() } : {}),
      });
      setSelected(result.request);
      setRequests((current) => current.map((item) => item.id === result.request.id ? result.request : item));
      setVerificationReference("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  const issueToken = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.issueResetToken(selected.id);
      // Keep the raw token only in component memory for this first handoff.
      setHandoffToken(result.rawToken);
      setSelected(result.request);
      setRequests((current) => current.map((item) => item.id === result.request.id ? result.request : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cấp mã khôi phục.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main data-testid="support-recovery-loading"><p>Đang tải hàng đợi hỗ trợ…</p></main>;
  if (error && !selected && requests.length === 0) {
    return <main data-testid="support-recovery-error"><div role="alert">{error}</div><Button variant="secondary" onClick={() => void load()}>Thử lại</Button></main>;
  }

  return (
    <main className="support-recovery-page" data-testid="support-recovery-page" aria-labelledby="support-recovery-title">
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow">P12 // SUPPORT / RECOVERY</p>
          <h1 id="support-recovery-title">Hàng đợi hỗ trợ tài khoản</h1>
          <p style={{ color: "var(--text-secondary)" }}>Chỉ tài khoản SYSTEM_ADMIN được phép review và cấp handoff khôi phục.</p>
        </div>
        <label>Trạng thái
          <select aria-label="Lọc trạng thái" value={filter} onChange={(event) => setFilter(event.target.value as D07SupportRequestStatus | "")}>
            <option value="">Tất cả</option>
            {statuses.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
          </select>
        </label>
      </header>
      {error && <div role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(16rem, 0.8fr) minmax(0, 1.2fr)", gap: "1rem" }}>
        <section aria-label="Danh sách yêu cầu" style={{ display: "grid", gap: "0.5rem", alignContent: "start" }}>
          {requests.length === 0 ? <p data-testid="support-recovery-empty">Không có yêu cầu.</p> : requests.map((item) => (
            <button type="button" key={item.id} onClick={() => void select(item)} aria-pressed={selected?.id === item.id} style={{ textAlign: "left", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "0.5rem", background: selected?.id === item.id ? "var(--surface-raised)" : "var(--surface)" }}>
              <strong>{item.targetUserId}</strong><br /><span>{statusLabel[item.status]}</span><br /><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>
            </button>
          ))}
        </section>
        <section aria-label="Chi tiết yêu cầu" style={{ border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1rem", background: "var(--surface)" }}>
          {!selected ? <p>Chọn một yêu cầu để xem chi tiết.</p> : <>
            <h2 style={{ marginTop: 0 }}>Chi tiết yêu cầu</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1rem" }}>
              <dt>Mã yêu cầu</dt><dd><code>{selected.id}</code></dd>
              <dt>User ID</dt><dd><code>{selected.targetUserId}</code></dd>
              <dt>Trạng thái</dt><dd>{statusLabel[selected.status]}</dd>
              <dt>Lý do</dt><dd>{selected.reason}</dd>
              <dt>Tham chiếu xác minh</dt><dd>{selected.verificationReference ?? "Chưa có"}</dd>
            </dl>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
              {selected.status === "OPEN" && <Button variant="secondary" disabled={busy} onClick={() => void transition("IN_PROGRESS")}>Nhận xử lý</Button>}
              {selected.status === "IN_PROGRESS" && <>
                <label>Evidence/reference<input aria-label="Verification reference" value={verificationReference} onChange={(event) => setVerificationReference(event.target.value)} /></label>
                <Button variant="primary" disabled={busy || !verificationReference.trim()} onClick={() => void transition("VERIFY")}>Xác minh</Button>
                <Button variant="danger" disabled={busy} onClick={() => void transition("REJECT")}>Từ chối</Button>
              </>}
              {selected.status === "VERIFIED" && <Button variant="primary" disabled={busy} onClick={() => void issueToken()}>Cấp handoff reset</Button>}
              {selected.status === "RESOLVED" && <Button variant="secondary" disabled={busy} onClick={() => void transition("CLOSE")}>Đóng yêu cầu</Button>}
              {selected.status === "REJECTED" && <Button variant="secondary" disabled={busy} onClick={() => void transition("CLOSE")}>Đóng yêu cầu</Button>}
            </div>
            {handoffToken && <div role="status" data-testid="support-reset-handoff" style={{ marginTop: "1rem" }}>
              <strong>Token chỉ hiển thị trong lần bàn giao này.</strong>
              <p><code>{handoffToken}</code></p>
              <Link className="button secondary" to={`/account-access?token=${encodeURIComponent(handoffToken)}`}>Mở luồng đặt lại</Link>
            </div>}
          </>}
        </section>
      </div>
    </main>
  );
}
