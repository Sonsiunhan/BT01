import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { routes } from "../../app/routes";
import { tournamentStaffApi, type StaffListResponse } from "./tournamentStaffApi";

const roleLabel = (role: string) => role === "REFEREE" ? "Trọng tài (REFEREE)" : "Nhân sự (STAFF)";

type TournamentStaffApi = typeof tournamentStaffApi;

export function TournamentStaffPage({ apiClient = tournamentStaffApi, tournamentId: propTournamentId }: { apiClient?: TournamentStaffApi; tournamentId?: string } = {}) {
  const { tournamentId = "" } = useParams<{ tournamentId: string }>();
  const resolvedTournamentId = propTournamentId ?? tournamentId;
  const [data, setData] = useState<StaffListResponse | null>(null);
  const [readiness, setReadiness] = useState<{ activeRefereeCount: number; hasAcceptedReferee: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [role, setRole] = useState<"REFEREE" | "STAFF">("REFEREE");
  const [busy, setBusy] = useState(false);
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!resolvedTournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, readiness] = await Promise.all([apiClient.list(resolvedTournamentId), apiClient.readiness(resolvedTournamentId)]);
      setData(list);
      setReadiness(readiness);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải nhân sự giải đấu.");
    } finally {
      setLoading(false);
    }
  }, [apiClient, resolvedTournamentId]);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!recipientUserId.trim()) return;
    setBusy(true); setMessage(null); setHandoffToken(null);
    try {
      const handoff = await apiClient.createInvitation(resolvedTournamentId, { recipientUserId: recipientUserId.trim(), role });
      setHandoffToken(handoff.rawToken);
      setMessage("Đã tạo lời mời. Token chỉ được hiển thị trong lần bàn giao này.");
      setRecipientUserId("");
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể tạo lời mời.");
    } finally { setBusy(false); }
  };

  const revoke = async (assignmentId: string) => {
    setBusy(true); setMessage(null);
    try {
      await apiClient.revoke(resolvedTournamentId, assignmentId);
      setMessage("Đã thu hồi phân công trong giải đấu.");
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể thu hồi phân công.");
    } finally { setBusy(false); }
  };

  if (loading) return <main className="page-container" data-testid="tournament-staff-loading"><p>Đang tải nhân sự giải đấu…</p></main>;
  if (error) return <main className="page-container" data-testid="tournament-staff-error"><div role="alert">{error}</div><button type="button" className="button secondary" onClick={() => void load()}>Thử lại</button></main>;

  const invitations = data?.invitations ?? [];
  const assignments = data?.assignments ?? [];
  return (
    <main className="page-container" data-testid="tournament-staff-page" style={{ maxWidth: 1080, margin: "0 auto", width: "100%" }}>
      <p className="eyebrow">P11 // STAFF / REFEREE MANAGEMENT</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div><h1 style={{ marginBottom: "0.35rem" }}>Nhân sự giải đấu</h1><p style={{ color: "var(--text-secondary)" }}>Quản lý phân công theo đúng tournament scope.</p></div>
        <Link className="button secondary" to={routes.adminTournamentDetail.replace(":tournamentId", resolvedTournamentId)}>Quay lại chi tiết giải</Link>
      </div>
      <section aria-label="Referee readiness" data-testid="staff-readiness" style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "0.75rem", background: "var(--surface)" }}>
        <strong>{readiness?.hasAcceptedReferee ? "Đã có trọng tài được chấp nhận" : "Chưa có trọng tài được chấp nhận"}</strong>
        <span style={{ marginLeft: "0.75rem", color: "var(--text-secondary)" }}>{readiness?.activeRefereeCount ?? 0} REFEREE đang ACTIVE</span>
      </section>
      <section style={{ marginTop: "1rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: "0.75rem", background: "var(--surface)" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Mời nhân sự</h2>
        <form onSubmit={invite} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>User ID recipient<input aria-label="Recipient User ID" value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)} placeholder="user-id" /></label>
          <label style={{ display: "grid", gap: "0.35rem" }}>Vai trò<select aria-label="Staff role" value={role} onChange={(event) => setRole(event.target.value as "REFEREE" | "STAFF")}><option value="REFEREE">REFEREE</option><option value="STAFF">STAFF</option></select></label>
          <button className="button primary" type="submit" disabled={busy || !recipientUserId.trim()}>Tạo lời mời</button>
        </form>
        {handoffToken && <div role="status" data-testid="invitation-handoff" style={{ marginTop: "0.75rem" }}><strong>Bàn giao token một lần:</strong> <code>{handoffToken}</code><button type="button" className="button secondary" onClick={() => setHandoffToken(null)} style={{ marginLeft: "0.5rem" }}>Ẩn token</button></div>}
        {message && <p role="status" style={{ color: "var(--text-secondary)" }}>{message}</p>}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Phân công hiện tại</h2>
        {assignments.length === 0 ? <p data-testid="staff-empty">Chưa có phân công.</p> : <div style={{ display: "grid", gap: "0.6rem" }}>{assignments.map((assignment) => <article key={assignment.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", padding: "0.8rem 1rem", border: "1px solid var(--border)", borderRadius: "0.6rem" }}><div><strong>{roleLabel(assignment.role)}</strong><div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>User ID: {assignment.userId} · {assignment.status}</div></div>{assignment.status !== "REVOKED" && <button className="button secondary" type="button" disabled={busy} onClick={() => void revoke(assignment.id)}>Thu hồi</button>}</article>)}</div>}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Lời mời</h2>
        {invitations.length === 0 ? <p>Chưa có lời mời.</p> : <div style={{ display: "grid", gap: "0.6rem" }}>{invitations.map((invitation) => <article key={invitation.id} style={{ padding: "0.8rem 1rem", border: "1px solid var(--border)", borderRadius: "0.6rem" }}><strong>{roleLabel(invitation.role)}</strong><div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>User ID: {invitation.recipientUserId} · {invitation.status} · Hết hạn {new Date(invitation.expiresAt).toLocaleString("vi-VN")}</div></article>)}</div>}
      </section>
    </main>
  );
}

export default TournamentStaffPage;
