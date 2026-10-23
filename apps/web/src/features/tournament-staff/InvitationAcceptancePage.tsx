import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { tournamentStaffApi } from "./tournamentStaffApi";
import type { StaffInvitationDecision, StaffInvitationRecipientView } from "@ottv2/contracts";
import { safeErrorMessage } from "../../services/http/safeErrorMessage";

const roleLabel = (role: string) => role === "REFEREE" ? "Trọng tài (REFEREE)" : "Nhân sự (STAFF)";

type TournamentStaffApi = typeof tournamentStaffApi;

export function InvitationAcceptancePage({ apiClient = tournamentStaffApi, tournamentId: propTournamentId, token: propToken }: { apiClient?: TournamentStaffApi; tournamentId?: string; token?: string } = {}) {
  const { tournamentId = "", token = "" } = useParams<{ tournamentId: string; token: string }>();
  const resolvedTournamentId = propTournamentId ?? tournamentId;
  const resolvedToken = propToken ?? token;
  const [invitation, setInvitation] = useState<StaffInvitationRecipientView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setInvitation(await apiClient.viewInvitation(resolvedTournamentId, resolvedToken)); }
    catch (cause) { setError(safeErrorMessage(cause, "Không thể tải lời mời.")); }
    finally { setLoading(false); }
  }, [apiClient, resolvedToken, resolvedTournamentId]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (action: "acceptInvitation" | "rejectInvitation") => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result: StaffInvitationDecision = await apiClient[action](resolvedTournamentId, resolvedToken);
      setInvitation(result.invitation);
      setMessage(result.replayed ? "Trạng thái trước đó đã được giữ nguyên." : action === "acceptInvitation" ? "Bạn đã chấp nhận lời mời." : "Bạn đã từ chối lời mời.");
    } catch (cause) { setError(safeErrorMessage(cause, "Không thể cập nhật lời mời.")); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="page-container" data-testid="invitation-loading"><p>Đang tải lời mời…</p></main>;
  if (error || !invitation) return <main className="page-container" data-testid="invitation-error"><div role="alert">{error ?? "Lời mời không khả dụng."}</div><button type="button" className="button secondary" onClick={() => void load()}>Thử lại</button></main>;

  const actionable = invitation.status === "INVITED" && new Date(invitation.expiresAt).getTime() > Date.now();
  return <main className="page-container" data-testid="invitation-page" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
    <p className="eyebrow">P17 // INVITATION ACCEPTANCE</p>
    <section style={{ padding: "1.25rem", border: "1px solid var(--border)", borderRadius: "0.8rem", background: "var(--surface)" }}>
      <h1 style={{ marginTop: 0 }}>Lời mời tham gia nhân sự giải đấu</h1>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.65rem 1rem" }}>
        <dt>Giải đấu</dt><dd>{invitation.tournamentCode}</dd>
        <dt>Vai trò</dt><dd>{roleLabel(invitation.role)}</dd>
        <dt>Trạng thái</dt><dd data-testid="invitation-status">{invitation.status}</dd>
        <dt>Hết hạn</dt><dd>{new Date(invitation.expiresAt).toLocaleString("vi-VN")}</dd>
      </dl>
      {message && <p role="status">{message}</p>}
      {invitation.status === "EXPIRED" && <p role="alert">Lời mời đã hết hạn và không thể chấp nhận.</p>}
      {invitation.status === "REVOKED" && <p role="alert">Lời mời đã bị thu hồi.</p>}
      {invitation.status === "ACTIVE" && <p role="status">Bạn đã là nhân sự đang hoạt động trong giải đấu.</p>}
      {invitation.status === "DECLINED" && <p role="status">Bạn đã từ chối lời mời này.</p>}
      {actionable && <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}><button className="button primary" type="button" disabled={busy} onClick={() => void decide("acceptInvitation")}>Chấp nhận</button><button className="button secondary" type="button" disabled={busy} onClick={() => void decide("rejectInvitation")}>Từ chối</button></div>}
      {error && <div role="alert" style={{ marginTop: "1rem" }}>{error} <button type="button" className="button secondary" onClick={() => void load()}>Thử lại</button></div>}
    </section>
  </main>;
}

export default InvitationAcceptancePage;
