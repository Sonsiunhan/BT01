import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  defaultTournamentApi,
  type TournamentApiPort,
} from "./tournamentApi";
import type {
  TournamentConfigVersionDto,
  TournamentDto,
} from "@ottv2/contracts";
import { isDraftEditableStatus, tournamentStatusLabel } from "./tournamentStatusLabels";
import { TournamentRuleManagementPanel } from "./rules/TournamentRuleManagementPanel";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("vi-VN") : iso;
}

const RULE_FACTS: ReadonlyArray<{ key: string; label: string; unit?: string }> = [
  { key: "rulesVersion", label: "Phiên bản luật" },
  { key: "turnSeconds", label: "Thời gian mỗi lượt", unit: "giây" },
  { key: "totalMatchSeconds", label: "Tổng thời gian trận", unit: "giây" },
  { key: "turnLimit", label: "Giới hạn số lượt", unit: "lượt" },
  { key: "noProgressPlies", label: "Ngưỡng hòa không tiến triển", unit: "nước đi" },
  { key: "repetitionThreshold", label: "Ngưỡng lặp lại thế cờ", unit: "lần" },
  { key: "timeoutResultPolicy", label: "Kết quả khi hết giờ" },
  { key: "disconnectGraceSeconds", label: "Thời lượng tha thứ mất kết nối", unit: "giây" },
  { key: "disconnectGracePolicy", label: "Chính sách mất kết nối" },
  { key: "tieBreakPolicy", label: "Chính sách hòa cờ" },
  { key: "manualAdjudicationDeadlineSeconds", label: "Hạn phán quyết thủ công", unit: "giây" },
  { key: "manualAdjudicationFallbackPolicy", label: "Dự phòng phán quyết" },
  { key: "setupParityMode", label: "Chế độ bàn cờ" },
  { key: "allowSpectatorDelaySeconds", label: "Trễ khán giả", unit: "giây" },
];

function formatRuleValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : String(value);
  return unit ? `${text} ${unit}` : text;
}

/**
 * P04 — dedicated rules management page for one tournament.
 *
 * Read-first: shows the CURRENT rule profile and the immutable version
 * history, and only offers lifecycle-appropriate actions. It deliberately does
 * NOT reuse the creation wizard: draft-stage rules are edited inside the
 * wizard draft (explicit CTA below), while published tournaments use the
 * within-envelope version publish flow.
 */
export const TournamentRulesPage: React.FC<{ apiClient?: TournamentApiPort }> = ({
  apiClient = defaultTournamentApi,
}) => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [loading, setLoading] = useState<boolean>(Boolean(tournamentId));
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentDto | null>(null);
  const [versions, setVersions] = useState<TournamentConfigVersionDto[]>([]);

  useEffect(() => {
    if (!tournamentId) {
      setLoading(false);
      setError("Không xác định được giải đấu cần xem luật. Vui lòng mở lại từ trang chi tiết giải.");
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    apiClient
      .getTournamentDetail(tournamentId)
      .then((res) => {
        if (!mounted) return;
        setTournament(res.tournament);
        setVersions(res.configVersions ?? []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(errorMessage(err, "Không thể tải luật thi đấu của giải."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [apiClient, tournamentId]);

  if (loading) {
    return (
      <div className="page-container" data-testid="tournament-rules-loading" style={{ padding: "2.5rem 1.5rem" }}>
        <p style={{ color: "var(--text-secondary)" }}>Đang tải luật thi đấu…</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="page-container" data-testid="tournament-rules-error" style={{ padding: "2.5rem 1.5rem", maxWidth: 800, margin: "0 auto" }}>
        <div role="alert" style={{ color: "var(--danger, #ef4444)", fontWeight: 600 }}>{error ?? "Không tìm thấy giải đấu."}</div>
        <Link to="/admin/tournaments" className="button secondary" style={{ display: "inline-block", marginTop: "1rem" }}>
          ← Về danh sách giải đấu
        </Link>
      </div>
    );
  }

  const editable = isDraftEditableStatus(tournament.status);
  const publishable = !editable && !["UNDER_REVIEW", "SUBMITTED", "REJECTED", "CANCELLED", "ENDED", "FINALIZED", "ARCHIVED"].includes(tournament.status);
  const profile = (tournament.ruleProfile ?? {}) as Record<string, unknown>;

  return (
    <div className="page-container" data-testid="tournament-rules-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem" }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <Link to={`/admin/tournaments/${tournament.id}`} style={{ color: "var(--system-cyan)", fontWeight: 600 }}>
          ← Chi tiết giải đấu
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span className="eyebrow" style={{ fontSize: "0.72rem", fontWeight: 700 }}>P04 // LUẬT THI ĐẤU</span>
      </nav>

      <header style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{tournament.coreConfig?.tournamentName ?? tournament.id}</h1>
        <span className="badge" style={{ padding: "0.25rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700 }}>
          {tournamentStatusLabel(tournament.status).toUpperCase()} ({tournament.status} r{tournament.revision})
        </span>
      </header>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.4rem 0 1.25rem 0" }}>
        Mã giải: <code>{tournament.coreConfig?.tournamentCode}</code> — Luật đã phát hành là bất biến và chỉ áp dụng cho trận đấu tạo sau thời điểm hiệu lực.
      </p>

      {editable && (
        <div
          role="status"
          data-testid="rules-draft-notice"
          style={{ padding: "0.85rem 1rem", border: "1px solid var(--system-cyan)", borderRadius: 8, background: "color-mix(in srgb, var(--system-cyan) 10%, var(--surface))", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}
        >
          <span style={{ fontSize: "0.85rem" }}>
            Giải đang ở trạng thái “{tournamentStatusLabel(tournament.status)}” — luật là một phần của bản nháp và được chỉnh sửa cùng hồ sơ.
          </span>
          <Link to={`/admin/tournaments/${tournament.id}/edit`} className="button primary" style={{ flexShrink: 0 }}>
            Mở bản nháp để chỉnh sửa luật (bước 4) →
          </Link>
        </div>
      )}

      {!editable && !publishable && (
        <div
          role="status"
          data-testid="rules-locked-notice"
          style={{ padding: "0.85rem 1rem", border: "1px solid var(--text-muted)", borderRadius: 8, background: "var(--surface)", marginBottom: "1.25rem", fontSize: "0.85rem" }}
        >
          Luật đang được cố định theo trạng thái “{tournamentStatusLabel(tournament.status)}”. Không thể phát hành phiên bản luật mới ở trạng thái này.
        </div>
      )}

      <section aria-labelledby="rules-current-heading" style={{ marginBottom: "1.5rem" }}>
        <h2 id="rules-current-heading" style={{ fontSize: "1.05rem", margin: "0 0 0.5rem 0" }}>Luật hiện hành</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.5rem" }}>
          {RULE_FACTS.map((fact) => (
            <div key={fact.key} style={{ border: "1px solid var(--border, transparent)", borderRadius: 6, padding: "0.5rem 0.75rem", background: "var(--surface-subtle, var(--surface))" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{fact.label}</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{formatRuleValue(profile[fact.key], fact.unit)}</div>
            </div>
          ))}
        </div>
      </section>

      {publishable && (
        <section aria-labelledby="rules-publish-heading" style={{ marginBottom: "1.5rem" }}>
          <h2 id="rules-publish-heading" style={{ fontSize: "1.05rem", margin: "0 0 0.25rem 0" }}>Phát hành phiên bản luật mới (trong khung hợp đồng)</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 0.75rem 0" }}>
            Trình soạn dưới đây dùng để tạo PHIÊN BẢN MỚI cho giải đã phê duyệt — luật hiện hành được liệt kê phía trên. Thay đổi vượt khung envelope của hợp đồng phải đi qua yêu cầu thay đổi (ChangeRequest).
          </p>
          <TournamentRuleManagementPanel
            tournamentId={tournament.id}
            configRevision={tournament.revision}
          />
        </section>
      )}

      <section aria-labelledby="rules-history-heading">
        <h2 id="rules-history-heading" style={{ fontSize: "1.05rem", margin: "0 0 0.5rem 0" }}>Lịch sử phiên bản luật ({versions.length})</h2>
        {versions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có phiên bản luật nào được phát hành — giải đang dùng bộ luật Robot Lab mặc định kèm bản nháp.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Phiên bản</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Hiệu lực từ</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Lý do phát hành</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Người phát hành</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: "0.4rem 0.6rem", fontWeight: 700 }}>v{v.versionNumber}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{formatIso(v.effectiveAt)}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{v.changeSummary}</td>
                  <td style={{ padding: "0.4rem 0.6rem", fontFamily: "var(--font-data, monospace)", fontSize: "0.78rem" }}>{v.publishedByUserId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default TournamentRulesPage;
