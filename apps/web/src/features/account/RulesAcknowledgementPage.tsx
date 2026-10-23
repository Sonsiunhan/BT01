import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { RulesAcknowledgementStatus } from "@ottv2/contracts";
import { rulesAcknowledgementApi, type RulesAcknowledgementApi } from "./rulesAcknowledgementApi";
import { safeErrorMessage } from "../../services/http/safeErrorMessage";

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; status: RulesAcknowledgementStatus }
  | { kind: "error"; message: string };

export type RulesAcknowledgementPageProps = {
  apiClient?: RulesAcknowledgementApi;
  contractId?: string;
  tournamentId?: string;
};

function safeError(cause: unknown): string {
  return safeErrorMessage(cause, "Không thể tải điều lệ hiện hành.");
}

export function RulesAcknowledgementPage({ apiClient = rulesAcknowledgementApi, contractId: propContractId, tournamentId: propTournamentId }: RulesAcknowledgementPageProps = {}) {
  const params = useParams<{ contractId: string; tournamentId: string }>();
  const contractId = propContractId ?? params.contractId ?? "";
  const tournamentId = propTournamentId ?? params.tournamentId ?? "";
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId || !tournamentId) {
      setState({ kind: "error", message: "Thiếu phạm vi giải đấu để tải điều lệ." });
      return;
    }
    setState({ kind: "loading" });
    setMessage(null);
    try {
      setState({ kind: "ready", status: await apiClient.getStatus(contractId, tournamentId) });
    } catch (cause) {
      setState({ kind: "error", message: safeError(cause) });
    }
  }, [apiClient, contractId, tournamentId]);

  useEffect(() => { void load(); }, [load]);

  const acknowledge = async () => {
    if (state.kind !== "ready" || !state.status.required || state.status.satisfied) return;
    setBusy(true);
    setMessage(null);
    try {
      // The version ID is read from the authoritative response; identity comes only from the session cookie.
      const next = await apiClient.acknowledge(contractId, tournamentId, state.status.configVersionId);
      setState({ kind: "ready", status: next });
      setMessage("Đã xác nhận đúng phiên bản điều lệ hiện hành.");
    } catch (cause) {
      setMessage(safeError(cause));
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") return <main className="page-container" data-testid="rules-loading" aria-busy="true"><p>Đang tải điều lệ hiện hành…</p></main>;
  if (state.kind === "error") return <main className="page-container" data-testid="rules-error"><div role="alert">{state.message}</div><button className="button secondary" type="button" onClick={() => void load()}>Thử lại</button></main>;

  const { status } = state;
  const needsAck = status.required && !status.satisfied;
  return <main className="page-container" data-testid="rules-ack-page" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
    <p className="eyebrow">D08 // ĐIỀU LỆ GIẢI ĐẤU</p>
    <section style={{ padding: "1.25rem", border: "1px solid var(--border)", borderRadius: "0.8rem", background: "var(--surface)" }}>
      <h1 style={{ marginTop: 0 }}>Điều lệ và xác nhận phiên bản</h1>
      <p>Máy chủ xác định phiên bản áp dụng cho tài khoản và giải đấu này.</p>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.65rem 1rem" }}>
        <dt>Phiên bản</dt><dd data-testid="rules-version">{status.versionNumber}</dd>
        <dt>Hiệu lực từ</dt><dd>{new Date(status.effectiveAt).toLocaleString("vi-VN")}</dd>
        <dt>Trạng thái</dt><dd data-testid="rules-ack-status">{status.required ? (status.satisfied ? "Đã xác nhận phiên bản hiện hành" : "Cần xác nhận phiên bản hiện hành") : "Không yêu cầu xác nhận"}</dd>
      </dl>
      <article style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
        <h2>Nội dung điều lệ</h2>
        <p>{status.regulationsFull}</p>
        {status.rulesQuickSummary && <p><strong>Tóm tắt:</strong> {status.rulesQuickSummary}</p>}
      </article>
      {needsAck && <div style={{ marginTop: "1rem" }}>
        <button className="button primary" type="button" disabled={busy} onClick={() => void acknowledge()}>
          {busy ? "Đang xác nhận…" : "Xác nhận điều lệ phiên bản hiện hành"}
        </button>
        <p data-testid="ack-consumer-pending" role="status" style={{ marginTop: "0.75rem" }}>Kiểm tra ACK trong luồng tạo trận đang chờ Long tích hợp; máy chủ vẫn là nguồn quyết định.</p>
      </div>}
      {message && <p role={message.includes("Đã xác nhận") ? "status" : "alert"}>{message}</p>}
    </section>
  </main>;
}

export default RulesAcknowledgementPage;
