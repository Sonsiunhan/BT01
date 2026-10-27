import React, { useState, useEffect, useCallback, useId } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { routes } from "../../../app/routes";
import {
  defaultTournamentApi,
  saveLocalDraftBuffer,
  getLocalDraftBuffer,
  clearLocalDraftBuffer,
  type TournamentApiPort,
} from "./tournamentApi";
import {
  createDefaultCoreConfig,
  tournamentDtoToDraftFormData,
  type DraftFormData,
} from "./tournamentTypes";
import {
  DEFAULT_TOURNAMENT_RULE_PROFILE,
} from "@ottv2/contracts";
import { defaultRulePreviewApi, defaultRuleVersionApi } from "./rules";
import { TournamentRuleManagementPanel } from "./rules/TournamentRuleManagementPanel";
import type { RulePreviewApiPort } from "./rules/rulePreviewApi";
import type { RuleVersionApiPort } from "./rules/ruleVersionApi";

interface TournamentWizardPageProps {
  apiClient?: TournamentApiPort;
  initialData?: Partial<DraftFormData>;
  rulePreviewApi?: RulePreviewApiPort;
  ruleVersionApi?: RuleVersionApiPort;
  initialStep?: number;
}

const DEFAULT_FORM_DATA: DraftFormData = {
  name: "",
  slug: "",
  description: "",
  contractId: "HD-2026-CHUNG",
  organizerUnitId: "unit-fit-vnu",
  visibility: "PRIVATE",
  timeModel: "FIXED_WINDOW",
  timezone: "Asia/Ho_Chi_Minh",
  rosterOpenAt: "",
  rosterCloseAt: "",
  startAt: "",
  endAt: "",
  competitionMode: "HUMAN_ONLINE",
  pairingStrategy: "ARENA",
  minParticipants: 4,
  maxParticipants: 32,
  checkinRequired: false,
  allowedUnitCodes: ["unit-fit-vnu"],
  checkinOpenAt: "",
  checkinCloseAt: "",
  botDeadlineAt: "",
  organizersText: "Ban Tổ chức Giải đấu",
  regulationsText: "Điều lệ tiêu chuẩn Robot Lab",
  contactChannel: "contact@fit.vnu.edu.vn",
  maxMatchesPerPlayer: null,
  maxPairMeetings: 2,
  rematchCooldownMinutes: 5,
  maxConcurrentMatches: 8,
  byeScorePoints: 0,
  spectatorPolicy: "ROSTER_ONLY",
  chatPolicy: "SPECTATOR_MUTED",
  leaderboardVisibility: "LIVE_PUBLIC",
  initialScore: 1000,
  initialElo: 1000,
  kFactor: 32,
  scoreFloor: 0,
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 36);
}

function errorRecord(error: unknown): Record<string, unknown> {
  return typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
}

export const TournamentWizardPage: React.FC<TournamentWizardPageProps> = ({
  apiClient = defaultTournamentApi,
  initialData,
  rulePreviewApi = defaultRulePreviewApi,
  ruleVersionApi = defaultRuleVersionApi,
  initialStep = 1,
}) => {
  const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const nameInputId = useId();
  const slugInputId = useId();
  const contractInputId = useId();
  const unitInputId = useId();
  const visibilityInputId = useId();
  const descInputId = useId();
  const timezoneInputId = useId();
  const timeModelInputId = useId();
  const rosterOpenInputId = useId();
  const rosterCloseInputId = useId();
  const startAtInputId = useId();
  const endAtInputId = useId();
  const compModeInputId = useId();
  const pairingInputId = useId();
  const minPartInputId = useId();
  const maxPartInputId = useId();
  const checkinInputId = useId();

  const isEditMode = Boolean(tournamentIdParam);
  const draftStorageKey = tournamentIdParam ? `draft_${tournamentIdParam}` : "new_tournament_draft";

  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [formData, setFormData] = useState<DraftFormData>(() => {
    const buffered = getLocalDraftBuffer<DraftFormData>(draftStorageKey);
    return {
      ...DEFAULT_FORM_DATA,
      ...buffered,
      ...initialData,
      tournamentId: tournamentIdParam ?? initialData?.tournamentId,
    };
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [serverRevision, setServerRevision] = useState<number>(formData.expectedRevision ?? 1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(isEditMode);
  const [recoveredFromLocal, setRecoveredFromLocal] = useState<boolean>(false);

  // S07: Submit Draft states
  const [submittingDraft, setSubmittingDraft] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [submissionNote, setSubmissionNote] = useState<string>("");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [tournamentStatus, setTournamentStatus] = useState<string | null>(null);

  const isUnderReview = tournamentStatus === "UNDER_REVIEW" || tournamentStatus === "SUBMITTED";

  // Check if buffer existed on mount
  useEffect(() => {
    const buffered = getLocalDraftBuffer<DraftFormData>(draftStorageKey);
    if (buffered && buffered.name && !isEditMode) {
      setRecoveredFromLocal(true);
    }
  }, [draftStorageKey, isEditMode]);

  // Load existing draft if in edit mode
  useEffect(() => {
    if (!isEditMode || !tournamentIdParam) return;

    let isMounted = true;
    setLoadingInitial(true);

    apiClient
      .getDraft(tournamentIdParam)
      .then((res) => {
        if (!isMounted) return;
        const dto = res.tournament;
        setServerRevision(dto.revision);
        setTournamentStatus(dto.status);
        setFormData((prev) => ({
          ...prev,
          ...tournamentDtoToDraftFormData(dto),
        }));
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : "Không thể tải bản nháp từ máy chủ.");
      })
      .finally(() => {
        if (isMounted) setLoadingInitial(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiClient, isEditMode, tournamentIdParam]);

  // Auto-persist to local buffer on formData change
  useEffect(() => {
    saveLocalDraftBuffer(draftStorageKey, formData);
  }, [formData, draftStorageKey]);

  const updateField = <K extends keyof DraftFormData>(field: K, value: DraftFormData[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && !prev.slug && typeof value === "string") {
        updated.slug = slugify(value);
      }
      return updated;
    });
    setErrorMessage(null);
  };

  const handleRuleConfigRevisionChange = useCallback((revision: number) => {
    setServerRevision(revision);
    setFormData((current) => ({ ...current, expectedRevision: revision }));
  }, []);

  // Save draft to server
  const handleSaveDraft = useCallback(async (): Promise<{ id: string; revision: number } | null> => {
    setSaving(true);
    setErrorMessage(null);
    setConflictWarning(null);

    const effectiveStart = formData.startAt || new Date(Date.now() + 86400000).toISOString();
    const effectiveEnd = formData.endAt || new Date(Date.now() + 86400000 * 2).toISOString();

    const coreConfig = createDefaultCoreConfig({
      tournamentCode: formData.slug || `TOUR_${Date.now()}`,
      tournamentName: formData.name || "Bản nháp giải đấu chưa đặt tên",
      description: formData.description,
      organizersText: formData.organizersText || "Ban Tổ chức Giải đấu",
      registrationOpenAt: formData.rosterOpenAt || null,
      registrationCloseAt: formData.rosterCloseAt || null,
      regulationsFull: formData.regulationsText || undefined,
      competitionMode: formData.competitionMode,
      audienceScope: formData.visibility === "PUBLIC" ? "PUBLIC_REGISTERED" : "INTERNAL_UNIT",
      allowedUnitCodes: formData.allowedUnitCodes,
      scheduledStartAt: effectiveStart,
      scheduledEndAt: effectiveEnd,
      maxParticipants: formData.maxParticipants,
      minParticipantsToStart: formData.minParticipants,
      timezone: formData.timezone,
      checkinRequired: formData.checkinRequired,
      checkinOpenAt: formData.checkinOpenAt || null,
      checkinCloseAt: formData.checkinCloseAt || null,
      botDeadlineAt: formData.botDeadlineAt || null,
      maxMatchesPerPlayer: formData.maxMatchesPerPlayer,
      maxPairMeetings: formData.maxPairMeetings,
      rematchCooldownMinutes: formData.rematchCooldownMinutes,
      maxConcurrentMatches: formData.maxConcurrentMatches,
      byeScorePoints: formData.byeScorePoints,
      spectatorPolicy: formData.spectatorPolicy,
      chatPolicy: formData.chatPolicy,
      leaderboardVisibility: formData.leaderboardVisibility,
      initialScore: formData.initialScore,
      initialElo: formData.initialElo,
      kFactor: formData.kFactor,
      scoreFloor: formData.scoreFloor,
    });

    try {
      if (formData.tournamentId) {
        // PATCH existing draft
        const patched = await apiClient.patchDraft(formData.tournamentId, {
          expectedRevision: serverRevision,
          coreConfig,
        });
        setServerRevision(patched.revision);
        setFormData((prev) => ({ ...prev, expectedRevision: patched.revision }));
        setLastSavedTime(new Date().toLocaleTimeString("vi-VN"));
        return { id: formData.tournamentId, revision: patched.revision };
      } else {
        // CREATE new draft
        const created = await apiClient.createDraft({
          contractId: formData.contractId,
          coreConfig,
          ruleProfile: DEFAULT_TOURNAMENT_RULE_PROFILE,
        });
        setServerRevision(created.revision);
        setFormData((prev) => ({
          ...prev,
          tournamentId: created.id,
          expectedRevision: created.revision,
        }));
        setLastSavedTime(new Date().toLocaleTimeString("vi-VN"));
        // Update URL to edit mode without full reload
        navigate(`/admin/tournaments/${created.id}/edit`, { replace: true });
        return { id: created.id, revision: created.revision };
      }
    } catch (err: unknown) {
      const details = errorRecord(err);
      if (details.code === "CONFLICT" || details.statusCode === 409) {
        setConflictWarning(
          "Bản nháp đã được cập nhật từ phiên khác (Mã lỗi: 409 CONFLICT). Hãy tải lại bản mới nhất từ máy chủ để tránh ghi đè dữ liệu hoặc kiểm tra lại lịch sử thay đổi."
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Lỗi kết nối máy chủ khi lưu nháp. Dữ liệu đã được lưu trữ an toàn trong bộ nhớ đệm cục bộ của trình duyệt."
        );
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [apiClient, formData, navigate, serverRevision]);

  // Reload draft from server on conflict
  const handleReloadLatest = async () => {
    if (!formData.tournamentId) return;
    try {
      setSaving(true);
      const res = await apiClient.getDraft(formData.tournamentId);
      const dto = res.tournament;
      setServerRevision(dto.revision);
      setFormData((prev) => ({
        ...prev,
        ...tournamentDtoToDraftFormData(dto),
      }));
      setConflictWarning(null);
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage("Không thể tải lại bản mới từ máy chủ: " + (error instanceof Error ? error.message : ""));
    } finally {
      setSaving(false);
    }
  };

  // Open submit modal (auto-saving draft first if needed)
  const handleOpenSubmitModal = useCallback(async () => {
    let currentId = formData.tournamentId;
    // New drafts need an id before the modal can be opened. Existing drafts
    // are saved once, on confirmation, so opening the modal does not create an
    // unnecessary revision and submit always uses the latest form state.
    if (!currentId) {
      const saved = await handleSaveDraft();
      if (saved) currentId = saved.id;
    }
    if (!currentId) return;
    setShowSubmitModal(true);
  }, [formData.tournamentId, handleSaveDraft]);

  // S07: Submit draft for review
  const handleSubmitDraft = useCallback(async () => {
    const saved = await handleSaveDraft();
    const targetId = saved?.id ?? formData.tournamentId;
    const expectedRevision = saved?.revision ?? serverRevision;
    if (!targetId) {
      setErrorMessage("Vui lòng lưu bản nháp lên máy chủ trước khi nộp duyệt.");
      return;
    }
    setSubmittingDraft(true);
    setErrorMessage(null);
    setConflictWarning(null);

    try {
      const res = await apiClient.submitDraft(targetId, {
        expectedRevision,
        submissionNote: submissionNote.trim() || undefined,
      });
      setServerRevision(res.tournament.revision);
      setTournamentStatus(res.tournament.status);
      setShowSubmitModal(false);
      setSubmitSuccessMessage(
        "Giải đấu đã được nộp duyệt thành công và chuyển sang trạng thái ĐANG CHỜ PHÊ DUYỆT (UNDER_REVIEW). Quản trị viên hệ thống sẽ kiểm tra và phản hồi."
      );
      clearLocalDraftBuffer(targetId);
    } catch (err: unknown) {
      const details = errorRecord(err);
      if (details.code === "CONFLICT" || details.statusCode === 409) {
        setConflictWarning(
          "Xung đột phiên bản khi nộp duyệt (Mã lỗi: 409 CONFLICT). Bản nháp đã được chỉnh sửa ở một phiên khác, vui lòng tải lại bản mới nhất."
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Không thể nộp duyệt bản nháp giải đấu. Vui lòng kiểm tra lại cấu hình hoặc thử lại sau."
        );
      }
    } finally {
      setSubmittingDraft(false);
    }
  }, [apiClient, formData.tournamentId, handleSaveDraft, serverRevision, submissionNote]);

  const handleDiscardLocalBuffer = () => {
    clearLocalDraftBuffer(draftStorageKey);
    setFormData(DEFAULT_FORM_DATA);
    setRecoveredFromLocal(false);
  };

  if (loadingInitial) {
    return (
      <div
        data-testid="tournament-wizard-page"
        className="page-container"
        style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}
      >
        <UiGlyph name="refresh" size={24} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "1rem" }}>Đang tải bản nháp giải đấu...</p>
      </div>
    );
  }

  return (
    <div
      data-testid="tournament-wizard-page"
      className="page-container tournament-wizard-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        minHeight: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Top Breadcrumb & Title */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
            <Link
              to={routes.adminTournaments}
              style={{
                fontSize: "0.75rem",
                color: "var(--system-cyan)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Danh sách giải đấu
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/</span>
            <span className="eyebrow" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
              {isEditMode ? "P02 // CHỈNH SỬA BẢN NHÁP" : "P02 // KHỞI TẠO BẢN NHÁP MỚI"}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            {formData.name || (isEditMode ? "Chỉnh sửa bản nháp giải đấu" : "Khởi tạo giải đấu mới")}
          </h1>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Status badge */}
          <span
            className="badge"
            style={{
              backgroundColor: isUnderReview
                ? "color-mix(in srgb, var(--system-cyan) 20%, transparent)"
                : "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: isUnderReview ? "var(--system-cyan)" : "var(--accent)",
              border: isUnderReview
                ? "1px solid var(--system-cyan)"
                : "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              fontWeight: 700,
            }}
          >
            {isUnderReview
              ? `ĐANG CHỜ PHÊ DUYỆT (UNDER_REVIEW r${serverRevision})`
              : `BẢN NHÁP (DRAFT r${serverRevision})`}
          </span>

          {/* Save Draft Button */}
          {!isUnderReview && (
            <button
              type="button"
              data-testid="wizard-save-draft-btn"
              onClick={handleSaveDraft}
              disabled={saving || submittingDraft}
              className="button secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                padding: "0.45rem 0.9rem",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {saving ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
          )}

          {/* Submit Draft Button */}
          {!isUnderReview && (
            <button
              type="button"
              data-testid="wizard-top-submit-draft-btn"
              onClick={handleOpenSubmitModal}
              disabled={saving || submittingDraft}
              className="button primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                padding: "0.45rem 0.9rem",
                background: "var(--system-cyan)",
                color: "var(--text-on-cyan, #ffffff)",
                fontWeight: 700,
              }}
            >
              Nộp duyệt
            </button>
          )}
        </div>
      </div>

      {/* Save Status / Resilience Notice */}
      <div
        data-testid="wizard-save-status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          padding: "0.4rem 0.8rem",
          background: "var(--surface-subtle)",
          borderRadius: "6px",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--system-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>
            {lastSavedTime
              ? `Đã lưu máy chủ lúc ${lastSavedTime} (Phiên bản: r${serverRevision})`
              : "Bản nháp tự động lưu vào bộ nhớ cục bộ an toàn"}
          </span>
        </div>
        {recoveredFromLocal && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--accent)" }}>Đã khôi phục từ bộ nhớ đệm cục bộ</span>
            <button
              type="button"
              onClick={handleDiscardLocalBuffer}
              style={{
                background: "none",
                border: "none",
                color: "var(--system-red)",
                cursor: "pointer",
                fontSize: "0.75rem",
                textDecoration: "underline",
              }}
            >
              Xóa đệm
            </button>
          </div>
        )}
      </div>

      {/* S07: Locked Banner when UNDER_REVIEW */}
      {isUnderReview && (
        <div
          data-testid="wizard-locked-banner"
          role="status"
          style={{
            padding: "0.85rem 1rem",
            background: "color-mix(in srgb, var(--system-cyan) 12%, var(--surface))",
            border: "1px solid var(--system-cyan)",
            borderRadius: "8px",
            color: "var(--text)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <UiGlyph name="lock" size={20} style={{ color: "var(--system-cyan)", flexShrink: 0 }} />
          <div>
            <strong style={{ color: "var(--system-cyan)", display: "block" }}>
              Bản nháp đang trong quá trình phê duyệt (UNDER_REVIEW)
            </strong>
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Giải đấu đã được nộp duyệt và tạm thời bị khóa chỉnh sửa tự do để Hội đồng Ban Quản trị thẩm định.
            </p>
          </div>
        </div>
      )}

      {/* S07: Submit Success Banner */}
      {submitSuccessMessage && (
        <div
          data-testid="wizard-submit-success-banner"
          role="status"
          style={{
            padding: "0.85rem 1rem",
            background: "color-mix(in srgb, var(--success) 12%, var(--surface))",
            border: "1px solid var(--success)",
            borderRadius: "8px",
            color: "var(--text)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--system-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{submitSuccessMessage}</span>
          </div>
          {formData.tournamentId && (
            <Link
              to={`/admin/tournaments/${formData.tournamentId}`}
              className="button primary"
              style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem", textDecoration: "none" }}
            >
              Xem trang chi tiết →
            </Link>
          )}
        </div>
      )}

      {/* Conflict Alert Banner (409 CONFLICT) */}
      {conflictWarning && (
        <div
          data-testid="wizard-conflict-banner"
          role="alert"
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--system-red) 12%, var(--surface))",
            border: "1px solid var(--system-red)",
            color: "var(--text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <UiGlyph name="warning" size={20} style={{ color: "var(--system-red)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", color: "var(--system-red)", marginBottom: "0.25rem" }}>
                Xung đột phiên bản bản nháp (Optimistic Concurrency Control)
              </strong>
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {conflictWarning}
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleReloadLatest}
                  className="button primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                >
                  Tải lại bản mới nhất từ máy chủ
                </button>
                <button
                  type="button"
                  onClick={() => setConflictWarning(null)}
                  className="button secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                >
                  Đóng cảnh báo và tiếp tục chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--system-red) 10%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--system-red) 40%, var(--border))",
            color: "var(--system-red)",
            fontSize: "0.85rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Step Indicator Navigation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.5rem",
          background: "var(--surface)",
          padding: "0.6rem",
          borderRadius: "8px",
          border: "1px solid var(--border)",
        }}
      >
        {[
          { step: 1, title: "1. Hồ sơ & Đơn vị", sub: "Tên, slug, hợp đồng" },
          { step: 2, title: "2. Lịch trình", sub: "Thời gian, múi giờ" },
          { step: 3, title: "3. Quy mô & Thể thức", sub: "Thí sinh, ARENA" },
          { step: 4, title: "4. Tổng quan & Luật", sub: "Luật chơi & Lưu nháp" },
        ].map((item) => {
          const isActive = currentStep === item.step;
          const isPassed = currentStep > item.step;
          return (
            <button
              key={item.step}
              type="button"
              data-testid={`wizard-step-${item.step}-btn`}
              onClick={() => setCurrentStep(item.step)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.6rem 0.75rem",
                borderRadius: "6px",
                border: "none",
                background: isActive
                  ? "color-mix(in srgb, var(--system-cyan) 15%, var(--surface))"
                  : isPassed
                  ? "var(--surface-subtle)"
                  : "transparent",
                color: isActive ? "var(--system-cyan)" : isPassed ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{item.title}</span>
              <span style={{ fontSize: "0.72rem", opacity: 0.8 }}>{item.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Wizard Step Content Container */}
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          padding: "1.5rem",
        }}
      >
        {/* Step 1: Profile & Unit */}
        {currentStep === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
              Bước 1: Hồ sơ cơ bản & Đơn vị tổ chức
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor={nameInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Tên giải đấu <span style={{ color: "var(--system-red)" }}>*</span>
              </label>
              <input
                id={nameInputId}
                type="text"
                data-testid="wizard-name-input"
                className="input"
                placeholder="Ví dụ: Giải Vô địch Quốc gia Robot Lab 2026"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Từ 3 đến 120 ký tự, hiển thị chính thức trên thẻ giải và banner.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor={slugInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Mã định danh giải đấu (Slug / Code) <span style={{ color: "var(--system-red)" }}>*</span>
              </label>
              <input
                id={slugInputId}
                type="text"
                data-testid="wizard-slug-input"
                className="input"
                placeholder="VLD_ROBOT_LAB_2026"
                value={formData.slug}
                onChange={(e) => updateField("slug", slugify(e.target.value))}
                style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontFamily: "var(--font-data)" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Mã duy nhất viết hoa gồm chữ cái, số và dấu gạch dưới (_). Tự động gợi ý từ tên giải.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={contractInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Mã Hợp đồng bảo trợ (Contract) <span style={{ color: "var(--system-red)" }}>*</span>
                </label>
                <input
                  id={contractInputId}
                  type="text"
                  data-testid="wizard-contract-input"
                  className="input"
                  value={formData.contractId}
                  onChange={(e) => updateField("contractId", e.target.value)}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Hợp đồng xác định hạn mức số giải đấu và trần thí sinh được phép tổ chức.
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={unitInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Đơn vị tổ chức (Unit) <span style={{ color: "var(--system-red)" }}>*</span>
                </label>
                <input
                  id={unitInputId}
                  type="text"
                  data-testid="wizard-unit-input"
                  className="input"
                  value={formData.organizerUnitId}
                  onChange={(e) => updateField("organizerUnitId", e.target.value)}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Khoa, Viện, hoặc CLB bảo trợ đứng tên tổ chức giải đấu.
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={visibilityInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Chế độ hiển thị giải đấu
                </label>
                <select
                  id={visibilityInputId}
                  className="select"
                  value={formData.visibility}
                  onChange={(e) => updateField("visibility", e.target.value as DraftFormData["visibility"])}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                >
                  <option value="PRIVATE">PRIVATE / INTERNAL — Nội bộ đơn vị</option>
                  <option value="PUBLIC">PUBLIC — Công khai cho toàn hệ thống theo dõi</option>
                  <option value="UNLISTED">UNLISTED — Không liệt kê công khai</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor="wizard-organizers" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Tên ban tổ chức hiển thị
                </label>
                <input
                  id="wizard-organizers"
                  type="text"
                  data-testid="wizard-organizers-input"
                  className="input"
                  value={formData.organizersText || ""}
                  onChange={(e) => updateField("organizersText", e.target.value)}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>
            </div>

            {formData.visibility === "PRIVATE" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor="wizard-allowed-units" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Mã đơn vị được phép tham gia (INTERNAL_UNIT) <span style={{ color: "var(--system-red)" }}>*</span>
                </label>
                <input
                  id="wizard-allowed-units"
                  type="text"
                  data-testid="wizard-allowed-units-input"
                  className="input"
                  placeholder="unit-fit-vnu, unit-khtn"
                  value={(formData.allowedUnitCodes || []).join(", ")}
                  onChange={(e) =>
                    updateField(
                      "allowedUnitCodes",
                      e.target.value
                        .split(",")
                        .map((u) => u.trim())
                        .filter(Boolean)
                    )
                  }
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Nhập danh sách mã khoa/viện cách nhau bằng dấu phẩy. Bắt buộc có ít nhất 1 đơn vị khi chọn giải nội bộ.
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor={descInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Mô tả giải đấu
              </label>
              <textarea
                id={descInputId}
                className="textarea"
                rows={3}
                placeholder="Giới thiệu mục đích giải đấu, điều lệ vắn tắt và đối tượng tham gia..."
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {currentStep === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
              Bước 2: Lịch trình & Thời gian tổ chức
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={timezoneInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Múi giờ tổ chức (Timezone)
                </label>
                <input
                  id={timezoneInputId}
                  type="text"
                  className="input"
                  value={formData.timezone}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={timeModelInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Mô hình thời gian
                </label>
                <select
                  id={timeModelInputId}
                  className="select"
                  value={formData.timeModel}
                  onChange={(e) => updateField("timeModel", e.target.value as DraftFormData["timeModel"])}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                >
                  <option value="FIXED_WINDOW">FIXED_WINDOW — Khung giờ tập trung cố định</option>
                  <option value="MULTIDAY">MULTIDAY — Thi đấu trải dài nhiều ngày</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={rosterOpenInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Mở cổng đăng ký / nhập thí sinh
                </label>
                <input
                  id={rosterOpenInputId}
                  type="datetime-local"
                  className="input"
                  value={formData.rosterOpenAt ? formData.rosterOpenAt.slice(0, 16) : ""}
                  onChange={(e) => updateField("rosterOpenAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={rosterCloseInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Đóng cổng đăng ký / chốt danh sách
                </label>
                <input
                  id={rosterCloseInputId}
                  type="datetime-local"
                  className="input"
                  value={formData.rosterCloseAt ? formData.rosterCloseAt.slice(0, 16) : ""}
                  onChange={(e) => updateField("rosterCloseAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={startAtInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Thời gian bắt đầu thi đấu <span style={{ color: "var(--system-red)" }}>*</span>
                </label>
                <input
                  id={startAtInputId}
                  type="datetime-local"
                  data-testid="wizard-start-at-input"
                  className="input"
                  value={formData.startAt ? formData.startAt.slice(0, 16) : ""}
                  onChange={(e) => updateField("startAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={endAtInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Thời gian kết thúc thi đấu <span style={{ color: "var(--system-red)" }}>*</span>
                </label>
                <input
                  id={endAtInputId}
                  type="datetime-local"
                  data-testid="wizard-end-at-input"
                  className="input"
                  value={formData.endAt ? formData.endAt.slice(0, 16) : ""}
                  onChange={(e) => updateField("endAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>
            </div>

            {/* S04: Conditional Check-in Window */}
            {formData.checkinRequired && (
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "6px",
                  background: "color-mix(in srgb, var(--system-cyan) 6%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--system-cyan)" }}>
                  <UiGlyph name="players" size={15} />
                  Điểm danh bắt buộc — Cửa sổ check-in
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="wizard-checkin-open" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Mở check-in
                    </label>
                    <input
                      id="wizard-checkin-open"
                      type="datetime-local"
                      data-testid="wizard-checkin-open-input"
                      className="input"
                      value={formData.checkinOpenAt ? String(formData.checkinOpenAt).slice(0, 16) : ""}
                      onChange={(e) => updateField("checkinOpenAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                      style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="wizard-checkin-close" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Đóng check-in (trước giờ thi đấu)
                    </label>
                    <input
                      id="wizard-checkin-close"
                      type="datetime-local"
                      data-testid="wizard-checkin-close-input"
                      className="input"
                      value={formData.checkinCloseAt ? String(formData.checkinCloseAt).slice(0, 16) : ""}
                      onChange={(e) => updateField("checkinCloseAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                      style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
                  Thời gian đóng check-in phải trước thời gian bắt đầu thi đấu.
                </span>
              </div>
            )}

            {/* S04: Conditional Bot Deadline */}
            {formData.competitionMode === "BOT_VS_BOT" && (
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "6px",
                  background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--accent) 25%, var(--border))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>
                  <UiGlyph name="brand" size={15} />
                  Chế độ BOT_VS_BOT — Hạn nộp bot
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="wizard-bot-deadline" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Hạn nộp bot (trước giờ thi đấu)
                  </label>
                  <input
                    id="wizard-bot-deadline"
                    type="datetime-local"
                    data-testid="wizard-bot-deadline-input"
                    className="input"
                    value={formData.botDeadlineAt ? String(formData.botDeadlineAt).slice(0, 16) : ""}
                    onChange={(e) => updateField("botDeadlineAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                    style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                  />
                  <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
                    Bot phải được nộp trước thời điểm này. Hạn nộp phải trước giờ thi đấu bắt đầu.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Format & Scale */}
        {currentStep === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
              Bước 3: Quy mô & Thể thức thi đấu
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={compModeInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Chế độ thi đấu (Competition Mode)
                </label>
                <select
                  id={compModeInputId}
                  className="select"
                  value={formData.competitionMode}
                  onChange={(e) => {
                    const newMode = e.target.value as DraftFormData["competitionMode"];
                    setFormData((prev) => ({
                      ...prev,
                      competitionMode: newMode,
                      botDeadlineAt: newMode === "BOT_VS_BOT" ? prev.botDeadlineAt : null,
                    }));
                  }}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                >
                  <option value="HUMAN_ONLINE">HUMAN_ONLINE — Đấu thủ người trực tuyến</option>
                  <option value="BOT_VS_BOT">BOT_VS_BOT — Đấu trường Bot Python tự động</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={pairingInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Thể thức thi đấu
                </label>
                <input
                  id={pairingInputId}
                  type="text"
                  className="input"
                  disabled
                  value="ARENA (Đấu trường liên tục tính điểm Elo)"
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem", opacity: 0.8 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={minPartInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Số thí sinh tối thiểu để bắt đầu
                </label>
                <input
                  id={minPartInputId}
                  type="number"
                  className="input"
                  min={2}
                  max={500}
                  value={formData.minParticipants}
                  onChange={(e) => updateField("minParticipants", Number(e.target.value))}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label htmlFor={maxPartInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Số thí sinh tối đa (Trần giải)
                </label>
                <input
                  id={maxPartInputId}
                  type="number"
                  className="input"
                  min={2}
                  max={2000}
                  value={formData.maxParticipants}
                  onChange={(e) => updateField("maxParticipants", Number(e.target.value))}
                  style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Không được vượt quá hạn mức tối đa quy định trong hợp đồng bảo trợ.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem" }}>
              <input
                id={checkinInputId}
                type="checkbox"
                checked={formData.checkinRequired}
                onChange={(e) => updateField("checkinRequired", e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
              <label htmlFor={checkinInputId} style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                Yêu cầu thí sinh điểm danh trực tuyến trước giờ khai mạc
              </label>
            </div>

            {/* S04: Operational Controls */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "6px",
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", fontWeight: 700 }}>
                <UiGlyph name="settings" size={16} />
                Kiểm soát vận hành trận đấu
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-max-matches" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Số trận tối đa / thí sinh
                  </label>
                  <input
                    id="wizard-max-matches"
                    type="number"
                    data-testid="wizard-max-matches-input"
                    className="input"
                    min={1}
                    placeholder="Không giới hạn"
                    value={formData.maxMatchesPerPlayer ?? ""}
                    onChange={(e) => updateField("maxMatchesPerPlayer", e.target.value ? Number(e.target.value) : null)}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-max-pair" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Gặp tối đa / cặp thí sinh
                  </label>
                  <input
                    id="wizard-max-pair"
                    type="number"
                    data-testid="wizard-max-pair-input"
                    className="input"
                    min={1}
                    max={10}
                    value={formData.maxPairMeetings ?? 2}
                    onChange={(e) => updateField("maxPairMeetings", Number(e.target.value))}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-rematch-cooldown" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Rematch cooldown (phút)
                  </label>
                  <input
                    id="wizard-rematch-cooldown"
                    type="number"
                    data-testid="wizard-rematch-cooldown-input"
                    className="input"
                    min={0}
                    value={formData.rematchCooldownMinutes ?? 5}
                    onChange={(e) => updateField("rematchCooldownMinutes", Number(e.target.value))}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-max-concurrent" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Trận đồng thời tối đa
                  </label>
                  <input
                    id="wizard-max-concurrent"
                    type="number"
                    data-testid="wizard-max-concurrent-input"
                    className="input"
                    min={1}
                    max={64}
                    value={formData.maxConcurrentMatches ?? 8}
                    onChange={(e) => updateField("maxConcurrentMatches", Number(e.target.value))}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.3rem" }}>
                <label htmlFor="wizard-bye-score" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Điểm trận bye (bye score points)
                </label>
                <input
                  id="wizard-bye-score"
                  type="number"
                  data-testid="wizard-bye-score-input"
                  className="input"
                  min={0}
                  value={formData.byeScorePoints ?? 0}
                  onChange={(e) => updateField("byeScorePoints", Number(e.target.value))}
                  style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem", maxWidth: "200px" }}
                />
              </div>
            </div>

            {/* S04: Scoring Preset Group */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "6px",
                background: "color-mix(in srgb, var(--system-cyan) 5%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--system-cyan) 20%, var(--border))",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", fontWeight: 700 }}>
                <UiGlyph name="trophy" size={16} />
                Cấu hình tính điểm (ELO_WEIGHTED_V1)
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-initial-score" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                    Điểm khởi đầu
                  </label>
                  <input
                    id="wizard-initial-score"
                    type="number"
                    data-testid="wizard-initial-score-input"
                    className="input"
                    value={formData.initialScore ?? 1000}
                    onChange={(e) => updateField("initialScore", Number(e.target.value))}
                    style={{ padding: "0.45rem 0.5rem", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-initial-elo" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                    Elo khởi đầu
                  </label>
                  <input
                    id="wizard-initial-elo"
                    type="number"
                    data-testid="wizard-initial-elo-input"
                    className="input"
                    value={formData.initialElo ?? 1000}
                    onChange={(e) => updateField("initialElo", Number(e.target.value))}
                    style={{ padding: "0.45rem 0.5rem", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-k-factor" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                    K-Factor
                  </label>
                  <input
                    id="wizard-k-factor"
                    type="number"
                    data-testid="wizard-k-factor-input"
                    className="input"
                    min={1}
                    max={128}
                    value={formData.kFactor ?? 32}
                    onChange={(e) => updateField("kFactor", Number(e.target.value))}
                    style={{ padding: "0.45rem 0.5rem", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-score-floor" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                    Sàn điểm
                  </label>
                  <input
                    id="wizard-score-floor"
                    type="number"
                    data-testid="wizard-score-floor-input"
                    className="input"
                    value={formData.scoreFloor ?? 0}
                    onChange={(e) => updateField("scoreFloor", Number(e.target.value))}
                    style={{ padding: "0.45rem 0.5rem", fontSize: "0.85rem" }}
                  />
                </div>
              </div>
            </div>

            {/* S04: Privacy & Spectator Policies */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "6px",
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", fontWeight: 700 }}>
                <UiGlyph name="spectator" size={16} />
                Quyền riêng tư & Chế độ khán giả
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-spectator" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Spectator Policy
                  </label>
                  <select
                    id="wizard-spectator"
                    data-testid="wizard-spectator-select"
                    className="select"
                    value={formData.spectatorPolicy || "ROSTER_ONLY"}
                    onChange={(e) => updateField("spectatorPolicy", e.target.value as DraftFormData["spectatorPolicy"])}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.82rem" }}
                  >
                    <option value="ROSTER_ONLY">ROSTER_ONLY — Chỉ thí sinh</option>
                    <option value="PUBLIC_WATCH">PUBLIC_WATCH — Công khai xem</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-chat" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Chat Policy
                  </label>
                  <select
                    id="wizard-chat"
                    data-testid="wizard-chat-select"
                    className="select"
                    value={formData.chatPolicy || "SPECTATOR_MUTED"}
                    onChange={(e) => updateField("chatPolicy", e.target.value as DraftFormData["chatPolicy"])}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.82rem" }}
                  >
                    <option value="SPECTATOR_MUTED">SPECTATOR_MUTED — Tắt chat khán giả</option>
                    <option value="ENABLED">ENABLED — Bật chat cho tất cả</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="wizard-leaderboard" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    Leaderboard
                  </label>
                  <select
                    id="wizard-leaderboard"
                    data-testid="wizard-leaderboard-select"
                    className="select"
                    value={formData.leaderboardVisibility || "LIVE_PUBLIC"}
                    onChange={(e) => updateField("leaderboardVisibility", e.target.value as DraftFormData["leaderboardVisibility"])}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.82rem" }}
                  >
                    <option value="LIVE_PUBLIC">LIVE_PUBLIC — BXH công khai</option>
                    <option value="HIDDEN_UNTIL_END">HIDDEN_UNTIL_END — Ẩn đến khi kết thúc</option>
                  </select>
                </div>
              </div>
            </div>

            {/* S04: Regulations & Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label htmlFor="wizard-regulations" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Điều lệ giải đấu
                </label>
                <input
                  id="wizard-regulations"
                  type="text"
                  data-testid="wizard-regulations-input"
                  className="input"
                  value={formData.regulationsText || ""}
                  onChange={(e) => updateField("regulationsText", e.target.value)}
                  style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label htmlFor="wizard-contact" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Kênh liên hệ
                </label>
                <input
                  id="wizard-contact"
                  type="text"
                  data-testid="wizard-contact-input"
                  className="input"
                  placeholder="email hoặc link chat group"
                  value={formData.contactChannel || ""}
                  onChange={(e) => updateField("contactChannel", e.target.value)}
                  style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary & Overview */}
        {currentStep === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
              Bước 4: Tổng quan cấu hình bản nháp
            </h2>

            <TournamentRuleManagementPanel
              tournamentId={formData.tournamentId}
              configRevision={serverRevision}
              onConfigRevisionChange={handleRuleConfigRevisionChange}
              previewApi={rulePreviewApi}
              versionApi={ruleVersionApi}
              headingId="wizard-rules-heading"
              testIdPrefix="wizard-rule"
            />

            {/* Core identity */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
                background: "var(--surface-subtle)",
                padding: "1rem",
                borderRadius: "6px",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>TÊN GIẢI:</span>
                <strong>{formData.name || "(Chưa nhập tên)"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>MÃ GIẢI (SLUG):</span>
                <code style={{ color: "var(--system-cyan)" }}>{formData.slug || "(Chưa có mã)"}</code>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>HỢP ĐỒNG:</span>
                <span>{formData.contractId}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>ĐƠN VỊ TỔ CHỨC:</span>
                <span>{formData.organizerUnitId}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>CHẾ ĐỘ THI ĐẤU:</span>
                <span>{formData.competitionMode}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>QUY MÔ THÍ SINH:</span>
                <span>{formData.minParticipants} – {formData.maxParticipants} thí sinh</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>BAN TỔ CHỨC:</span>
                <span>{formData.organizersText || "(Chưa nhập)"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>HIỂN THỊ:</span>
                <span>{formData.visibility}</span>
              </div>
            </div>

            {/* S04: Schedule summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.75rem",
                background: "var(--surface-subtle)",
                padding: "1rem",
                borderRadius: "6px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>LỊCH TRÌNH & ĐIỂM DANH</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>BẮT ĐẦU:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.startAt ? new Date(formData.startAt).toLocaleString("vi-VN") : "—"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>KẾT THÚC:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.endAt ? new Date(formData.endAt).toLocaleString("vi-VN") : "—"}</span>
              </div>
              {formData.checkinRequired && (
                <>
                  <div>
                    <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>MỞ CHECK-IN:</span>
                    <span style={{ fontSize: "0.85rem" }}>{formData.checkinOpenAt ? new Date(formData.checkinOpenAt).toLocaleString("vi-VN") : "—"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>ĐÓNG CHECK-IN:</span>
                    <span style={{ fontSize: "0.85rem" }}>{formData.checkinCloseAt ? new Date(formData.checkinCloseAt).toLocaleString("vi-VN") : "—"}</span>
                  </div>
                </>
              )}
              {formData.competitionMode === "BOT_VS_BOT" && (
                <div>
                  <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>HẠN NỘP BOT:</span>
                  <span style={{ fontSize: "0.85rem" }}>{formData.botDeadlineAt ? new Date(formData.botDeadlineAt).toLocaleString("vi-VN") : "—"}</span>
                </div>
              )}
            </div>

            {/* S04: Operational & Scoring summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                background: "var(--surface-subtle)",
                padding: "1rem",
                borderRadius: "6px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>KIỂM SOÁT VẬN HÀNH & TÍNH ĐIỂM</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>TRẬN/THÍ SINH:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.maxMatchesPerPlayer ?? "∞"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>GẶP/CẶP:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.maxPairMeetings ?? 2}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>COOLDOWN:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.rematchCooldownMinutes ?? 5} phút</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>ĐỒNG THỜI:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.maxConcurrentMatches ?? 8}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>SCORE KHỞI:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.initialScore ?? 1000}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>ELO KHỞI:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.initialElo ?? 1000}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>K-FACTOR:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.kFactor ?? 32}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>SÀN ĐIỂM:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.scoreFloor ?? 0}</span>
              </div>
            </div>

            {/* S04: Privacy summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
                background: "var(--surface-subtle)",
                padding: "1rem",
                borderRadius: "6px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>QUYỀN RIÊNG TƯ & KHÁN GIẢ</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>SPECTATOR:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.spectatorPolicy || "ROSTER_ONLY"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>CHAT:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.chatPolicy || "SPECTATOR_MUTED"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "block" }}>LEADERBOARD:</span>
                <span style={{ fontSize: "0.85rem" }}>{formData.leaderboardVisibility || "LIVE_PUBLIC"}</span>
              </div>
            </div>

            <div
              style={{
                padding: "0.8rem 1rem",
                borderRadius: "6px",
                background: "color-mix(in srgb, var(--system-cyan) 8%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--system-cyan) 30%, transparent)",
                fontSize: "0.85rem",
              }}
            >
              <strong>Trạng thái sẵn sàng nộp duyệt:</strong> Bản nháp cơ bản đã hợp lệ và được lưu an toàn. Cấu hình mở rộng (S04) đã hoàn tất. Bước tiếp theo: nối Rule Editor (S07) và nộp duyệt.
            </div>
          </div>
        )}

        {/* Step Navigation Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                data-testid="wizard-prev-step-btn"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                className="button secondary"
                style={{ fontSize: "0.85rem" }}
              >
                ← Quay lại bước trước
              </button>
            ) : (
              <Link to={routes.adminTournaments} className="button secondary" style={{ fontSize: "0.85rem" }}>
                Hủy bỏ
              </Link>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {currentStep < 4 ? (
              <button
                type="button"
                data-testid="wizard-next-step-btn"
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                className="button primary"
                style={{ fontSize: "0.85rem" }}
              >
                Tiếp theo →
              </button>
            ) : (
              <>
                {!isUnderReview && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving || submittingDraft}
                    className="button secondary"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {saving ? "Đang lưu..." : "Lưu bản nháp"}
                  </button>
                )}
                {!isUnderReview && (
                  <button
                    type="button"
                    data-testid="wizard-submit-draft-btn"
                    onClick={handleOpenSubmitModal}
                    disabled={saving || submittingDraft}
                    className="button primary"
                    style={{
                      fontSize: "0.85rem",
                      background: "var(--system-cyan)",
                      color: "var(--text-on-cyan, #ffffff)",
                      fontWeight: 700,
                    }}
                  >
                    {submittingDraft ? "Đang gửi duyệt..." : "Nộp duyệt giải đấu"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* S07: Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          data-testid="wizard-submit-modal"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              maxWidth: "540px",
              width: "100%",
              padding: "1.5rem",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: "color-mix(in srgb, var(--system-cyan) 15%, transparent)",
                  color: "var(--system-cyan)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <UiGlyph name="lock" size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                  Xác nhận nộp duyệt giải đấu
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Mã giải: <code style={{ color: "var(--system-cyan)" }}>{formData.slug || formData.tournamentId}</code>
                </p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Sau khi nộp duyệt, bản nháp sẽ chuyển sang trạng thái <strong>ĐANG CHỜ PHÊ DUYỆT (UNDER_REVIEW)</strong>. Cấu hình giải và các phiên bản luật sẽ được cố định để Hội đồng Ban Quản trị thẩm định.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label
                htmlFor="wizard-submission-note"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)" }}
              >
                Ghi chú nộp duyệt (Tùy chọn, tối đa 500 ký tự):
              </label>
              <textarea
                id="wizard-submission-note"
                data-testid="wizard-submission-note-input"
                rows={3}
                maxLength={500}
                placeholder="VD: Đã hoàn tất cấu hình bàn cờ tiêu chuẩn 6x6 và lịch thi đấu theo phê duyệt của Khoa."
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                style={{
                  padding: "0.6rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-root)",
                  color: "var(--text)",
                  fontSize: "0.85rem",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                data-testid="wizard-cancel-submit-btn"
                onClick={() => setShowSubmitModal(false)}
                disabled={submittingDraft}
                className="button secondary"
                style={{ fontSize: "0.85rem" }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                data-testid="wizard-confirm-submit-btn"
                onClick={handleSubmitDraft}
                disabled={submittingDraft}
                className="button primary"
                style={{
                  fontSize: "0.85rem",
                  background: "var(--system-cyan)",
                  color: "var(--text-on-cyan, #ffffff)",
                  fontWeight: 700,
                }}
              >
                {submittingDraft ? "Đang gửi duyệt..." : "Xác nhận nộp duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentWizardPage;
