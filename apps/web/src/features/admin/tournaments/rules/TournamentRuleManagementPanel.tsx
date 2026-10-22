import React, { useEffect, useMemo, useState } from "react";
import type {
  PublishRuleVersionResponse,
  RuleVersionDiffResponse,
  RuleVersionListResponse,
  TournamentRulePreviewResponse,
} from "@ottv2/contracts";
import { TournamentRuleProfileWidgetSchema } from "@ottv2/contracts";
import { RuleEditor } from "./RuleEditor";
import { createDefaultRuleEditorValue } from "./ruleEditorDefaults";
import { createRulePreviewRequest, type RuleEditorValue } from "./ruleEditorTypes";
import { defaultRulePreviewApi, type RulePreviewApiPort } from "./rulePreviewApi";
import { defaultRuleVersionApi, type RuleVersionApiPort } from "./ruleVersionApi";

interface TournamentRuleManagementPanelProps {
  tournamentId?: string;
  configRevision: number;
  onConfigRevisionChange?: (revision: number) => void;
  previewApi?: RulePreviewApiPort;
  versionApi?: RuleVersionApiPort;
  headingId?: string;
  testIdPrefix?: string;
}

function readLocalRuleDraft(storageKey: string): RuleEditorValue {
  if (typeof window === "undefined") return createDefaultRuleEditorValue();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return createDefaultRuleEditorValue();
    const parsed = TournamentRuleProfileWidgetSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : createDefaultRuleEditorValue();
  } catch {
    return createDefaultRuleEditorValue();
  }
}

function renderDiffValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const IMPACT_LABELS = {
  MATCHES_PINNED: "Các trận đã ghim phiên bản cũ",
  NEW_MATCHES_ONLY: "Chỉ trận tạo mới",
  DISPLAY_ONLY: "Chỉ thay đổi hiển thị",
} as const;

export function TournamentRuleManagementPanel({
  tournamentId,
  configRevision,
  onConfigRevisionChange,
  previewApi = defaultRulePreviewApi,
  versionApi = defaultRuleVersionApi,
  headingId = "tournament-rules-heading",
  testIdPrefix = "wizard-rule",
}: TournamentRuleManagementPanelProps) {
  const storageKey = useMemo(
    () => `ottv2.rule-draft.${tournamentId ?? "unsaved"}`,
    [tournamentId],
  );
  const [value, setValue] = useState<RuleEditorValue>(() => readLocalRuleDraft(storageKey));
  const [preview, setPreview] = useState<TournamentRulePreviewResponse | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [versions, setVersions] = useState<RuleVersionListResponse | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<RuleVersionDiffResponse | null>(null);
  const [reason, setReason] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [publishPending, setPublishPending] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey)) {
      setValue(readLocalRuleDraft(storageKey));
    }
    setPreview(null);
    setSelectedDiff(null);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    }
  }, [storageKey, value]);

  useEffect(() => {
    setPreview(null);
  }, [configRevision]);

  useEffect(() => {
    if (!tournamentId) {
      setVersions(null);
      return;
    }
    let mounted = true;
    setVersionsError(null);
    versionApi.list(tournamentId)
      .then((result) => {
        if (!mounted) return;
        setVersions(result);
        onConfigRevisionChange?.(result.configRevision);
      })
      .catch((error: unknown) => {
        if (mounted) setVersionsError(error instanceof Error ? error.message : "Không thể tải các phiên bản luật.");
      });
    return () => { mounted = false; };
  }, [onConfigRevisionChange, tournamentId, versionApi]);

  const handleValueChange = (nextValue: RuleEditorValue) => {
    setValue(nextValue);
    setPreview(null);
    setPreviewError(null);
    setPublishMessage("Cấu hình đã thay đổi. Hãy kiểm tra luật lại trước khi phát hành.");
  };

  const handlePreview = async () => {
    if (!tournamentId) {
      setPreviewError("Hãy lưu bản nháp trước khi kiểm tra luật.");
      return;
    }
    setPreviewPending(true);
    setPreviewError(null);
    setPublishMessage(null);
    try {
      const result = await previewApi.preview(
        tournamentId,
        createRulePreviewRequest(value, configRevision, configRevision),
      );
      setPreview(result);
      if (result.normalizedProfile) {
        setValue((current) => ({ ...current, profile: result.normalizedProfile! }));
      }
    } catch (error: unknown) {
      setPreview(null);
      setPreviewError(error instanceof Error ? error.message : "Không thể kiểm tra luật.");
    } finally {
      setPreviewPending(false);
    }
  };

  const handlePublish = async () => {
    if (!tournamentId || !preview?.valid || !preview.profileDigest || reason.trim().length < 3 || !effectiveAt) return;
    setPublishPending(true);
    setPublishMessage(null);
    try {
      const result: PublishRuleVersionResponse = await versionApi.publish(tournamentId, {
        expectedRevision: configRevision,
        profileRef: { draftId: tournamentId, revision: configRevision },
        profileDigest: preview.profileDigest,
        reason: reason.trim(),
        effectiveAt: new Date(effectiveAt).toISOString(),
        idempotencyKey: `rules-${tournamentId}-${configRevision}-${preview.profileDigest.slice(0, 12)}`,
      });
      if (result.outcome === "PUBLISHED") {
        const refreshed = await versionApi.list(tournamentId);
        setVersions(refreshed);
        onConfigRevisionChange?.(refreshed.configRevision);
        setPreview(null);
        setReason("");
        setEffectiveAt("");
        setPublishMessage(`Đã phát hành phiên bản luật v${result.version.versionNumber}. Phiên bản cũ vẫn bất biến.`);
      } else {
        setPublishMessage(`Cần yêu cầu thay đổi trước khi phát hành (${result.changeRequestId}): ${result.reason}`);
      }
    } catch (error: unknown) {
      setPublishMessage(error instanceof Error ? error.message : "Không thể phát hành phiên bản luật.");
    } finally {
      setPublishPending(false);
    }
  };

  const handleDiff = async (versionId: string) => {
    if (!tournamentId) return;
    setVersionsError(null);
    try {
      setSelectedDiff(await versionApi.diff(tournamentId, versionId));
    } catch (error: unknown) {
      setVersionsError(error instanceof Error ? error.message : "Không thể tải diff phiên bản luật.");
    }
  };

  return (
    <section aria-labelledby={headingId} data-testid={`${testIdPrefix}-section`} style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", border: "1px solid color-mix(in srgb, var(--system-cyan) 30%, var(--border))", borderRadius: "8px", background: "color-mix(in srgb, var(--system-cyan) 4%, var(--surface))" }}>
      <div>
        <h3 id={headingId} style={{ margin: 0, fontSize: "1rem" }}>Luật thi đấu & phiên bản</h3>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>Chỉnh sửa bằng RuleEditor V1, kiểm tra trên server rồi mới phát hành. Phiên bản đã phát hành là bất biến và chỉ áp dụng cho trận tạo sau thời điểm hiệu lực.</p>
      </div>

      <RuleEditor value={value} onChange={handleValueChange} errors={preview?.errors ?? []} disabled={previewPending || publishPending} />

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="button secondary" onClick={handlePreview} disabled={!tournamentId || previewPending} data-testid={`${testIdPrefix}-preview-btn`}>{previewPending ? "Đang kiểm tra..." : "Kiểm tra luật"}</button>
        {preview && <span role="status" aria-live="polite" data-testid={`${testIdPrefix}-preview-status`} style={{ fontSize: "0.8rem", color: preview.valid ? "var(--system-green)" : "var(--system-red)" }}>{preview.valid ? "Hợp lệ" : `Chưa hợp lệ · ${preview.errors.length} lỗi`}</span>}
      </div>
      {previewError && <div role="alert" data-testid={`${testIdPrefix}-preview-error`} style={{ color: "var(--system-red)", fontSize: "0.8rem" }}>{previewError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.8rem", fontWeight: 600 }}>Lý do phát hành<input className="input" value={reason} minLength={3} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Cập nhật goal cho vòng chung kết" data-testid={`${testIdPrefix}-reason-input`} /></label>
        <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.8rem", fontWeight: 600 }}>Có hiệu lực từ<input className="input" type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} data-testid={`${testIdPrefix}-effective-input`} /></label>
      </div>
      <button type="button" className="button primary" onClick={handlePublish} disabled={!tournamentId || !preview?.valid || reason.trim().length < 3 || !effectiveAt || publishPending} data-testid={`${testIdPrefix}-publish-btn`}>{publishPending ? "Đang phát hành..." : "Phát hành phiên bản luật"}</button>
      {publishMessage && <div role="status" aria-live="polite" data-testid={`${testIdPrefix}-publish-message`} style={{ fontSize: "0.8rem" }}>{publishMessage}</div>}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
        <strong style={{ fontSize: "0.8rem" }}>Lịch sử phiên bản</strong>
        {versionsError && <div role="alert" style={{ color: "var(--system-red)", fontSize: "0.78rem", marginTop: "0.35rem" }}>{versionsError}</div>}
        {!versions?.items.length ? <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>Chưa có phiên bản luật được phát hành.</p> : (
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", fontSize: "0.78rem" }}>
            {versions.items.map((version) => <li key={version.id} style={{ marginBottom: "0.3rem" }}><span>v{version.versionNumber} · {new Date(version.effectiveAt).toLocaleString("vi-VN")} · {version.reason}</span><button type="button" className="button secondary" style={{ marginLeft: "0.5rem", padding: "0.15rem 0.4rem", fontSize: "0.72rem" }} onClick={() => handleDiff(version.id)} data-testid={`${testIdPrefix}-diff-${version.id}`}>Xem diff</button></li>)}
          </ul>
        )}
        {selectedDiff && <div data-testid={`${testIdPrefix}-diff-panel`} style={{ marginTop: "0.6rem", padding: "0.6rem", borderRadius: "6px", background: "var(--surface-subtle)", fontSize: "0.76rem" }}>
          <strong>Diff {selectedDiff.baseVersionId} → {selectedDiff.targetVersionId}</strong>
          <div>{selectedDiff.changes.length} thay đổi · Trận cũ không bị ảnh hưởng: {selectedDiff.oldMatchesUnaffected ? "Có" : "Không"}</div>
          {selectedDiff.changes.length > 0 && <div style={{ overflowX: "auto", marginTop: "0.5rem" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th scope="col">Trường</th><th scope="col">Trước</th><th scope="col">Sau</th><th scope="col">Phạm vi tác động</th></tr></thead><tbody>{selectedDiff.changes.map((change) => <tr key={`${change.path}-${renderDiffValue(change.after)}`}><td><code>{change.path}</code></td><td>{renderDiffValue(change.before)}</td><td>{renderDiffValue(change.after)}</td><td>{IMPACT_LABELS[change.impact]}</td></tr>)}</tbody></table></div>}
        </div>}
      </div>
    </section>
  );
}

