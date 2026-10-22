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
  type DraftFormData,
} from "./tournamentTypes";
import { DEFAULT_TOURNAMENT_RULE_PROFILE, type TournamentDto } from "@ottv2/contracts";

interface TournamentWizardPageProps {
  apiClient?: TournamentApiPort;
  initialData?: Partial<DraftFormData>;
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

export const TournamentWizardPage: React.FC<TournamentWizardPageProps> = ({
  apiClient = defaultTournamentApi,
  initialData,
}) => {
  const { id: tournamentIdParam } = useParams<{ id: string }>();
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

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<DraftFormData>(() => {
    const buffered = getLocalDraftBuffer<DraftFormData>(draftStorageKey);
    return {
      ...DEFAULT_FORM_DATA,
      ...buffered,
      ...initialData,
      tournamentId: tournamentIdParam,
    };
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [serverRevision, setServerRevision] = useState<number>(formData.expectedRevision ?? 1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(isEditMode);
  const [recoveredFromLocal, setRecoveredFromLocal] = useState<boolean>(false);

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
      .then((res: { tournament: TournamentDto; configVersions: any[] }) => {
        if (!isMounted) return;
        const dto = res.tournament;
        setServerRevision(dto.revision);
        setFormData((prev) => ({
          ...prev,
          tournamentId: dto.id,
          name: dto.coreConfig.tournamentName,
          slug: dto.coreConfig.tournamentCode,
          description: dto.coreConfig.shortDescription || "",
          contractId: dto.contractId,
          organizerUnitId: dto.unitId,
          visibility: dto.coreConfig.audienceScope === "PUBLIC_REGISTERED" ? "PUBLIC" : "PRIVATE",
          timezone: dto.coreConfig.timezone,
          startAt: dto.coreConfig.scheduledStartAt || "",
          endAt: dto.coreConfig.scheduledEndAt || "",
          rosterOpenAt: dto.coreConfig.registrationOpenAt || "",
          rosterCloseAt: dto.coreConfig.registrationCloseAt || "",
          competitionMode: dto.coreConfig.competitionMode,
          minParticipants: dto.coreConfig.minParticipantsToStart,
          maxParticipants: dto.coreConfig.maxParticipants,
          checkinRequired: dto.coreConfig.checkinRequired,
          expectedRevision: dto.revision,
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

  // Save draft to server
  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    setErrorMessage(null);
    setConflictWarning(null);

    const nowIso = new Date().toISOString();
    const effectiveStart = formData.startAt || new Date(Date.now() + 86400000).toISOString();
    const effectiveEnd = formData.endAt || new Date(Date.now() + 86400000 * 2).toISOString();

    const coreConfig = createDefaultCoreConfig({
      tournamentCode: formData.slug || `TOUR_${Date.now()}`,
      tournamentName: formData.name || "Bản nháp giải đấu chưa đặt tên",
      description: formData.description,
      organizersText: "Ban Tổ chức Giải đấu",
      competitionMode: formData.competitionMode,
      audienceScope: formData.visibility === "PUBLIC" ? "PUBLIC_REGISTERED" : "INTERNAL_UNIT",
      scheduledStartAt: effectiveStart,
      scheduledEndAt: effectiveEnd,
      maxParticipants: formData.maxParticipants,
      minParticipantsToStart: formData.minParticipants,
      timezone: formData.timezone,
      checkinRequired: formData.checkinRequired,
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
        navigate(`/admin/tournaments/${created.id}`, { replace: true });
      }
    } catch (err: any) {
      if (err?.code === "CONFLICT" || err?.statusCode === 409) {
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
        name: dto.coreConfig.tournamentName,
        slug: dto.coreConfig.tournamentCode,
        description: dto.coreConfig.shortDescription || "",
        timezone: dto.coreConfig.timezone,
        startAt: dto.coreConfig.scheduledStartAt || "",
        endAt: dto.coreConfig.scheduledEndAt || "",
        competitionMode: dto.coreConfig.competitionMode,
        maxParticipants: dto.coreConfig.maxParticipants,
        expectedRevision: dto.revision,
      }));
      setConflictWarning(null);
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage("Không thể tải lại bản mới từ máy chủ: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

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
              backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              fontWeight: 700,
            }}
          >
            BẢN NHÁP (DRAFT r{serverRevision})
          </span>

          {/* Save Draft Button */}
          <button
            type="button"
            data-testid="wizard-save-draft-btn"
            onClick={handleSaveDraft}
            disabled={saving}
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
          { step: 4, title: "4. Tổng quan", sub: "Xem lại & Lưu nháp" },
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
                style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontFamily: "monospace" }}
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

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label htmlFor={visibilityInputId} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Chế độ hiển thị giải đấu
              </label>
              <select
                id={visibilityInputId}
                className="select"
                value={formData.visibility}
                onChange={(e) => updateField("visibility", e.target.value as any)}
                style={{ padding: "0.55rem 0.75rem", fontSize: "0.9rem" }}
              >
                <option value="PRIVATE">PRIVATE — Chỉ thành viên được mời và ban tổ chức</option>
                <option value="PUBLIC">PUBLIC — Công khai cho toàn hệ thống theo dõi</option>
                <option value="UNLISTED">UNLISTED — Không liệt kê công khai, truy cập qua liên kết trực tiếp</option>
              </select>
            </div>

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
                  onChange={(e) => updateField("timeModel", e.target.value as any)}
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
                  onChange={(e) => updateField("competitionMode", e.target.value as any)}
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
          </div>
        )}

        {/* Step 4: Summary & Overview */}
        {currentStep === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
              Bước 4: Tổng quan cấu hình bản nháp
            </h2>

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
              <strong>Trạng thái sẵn sàng nộp duyệt:</strong> Bản nháp cơ bản đã hợp lệ và được lưu an toàn. Các bước bổ sung luật thi đấu tùy biến (P04) và cấu hình điều hành (S04 / S07) sẽ được nối tiếp theo kế hoạch.
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
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="button primary"
                style={{ fontSize: "0.85rem" }}
              >
                {saving ? "Đang lưu..." : "Hoàn tất lưu nháp"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentWizardPage;
