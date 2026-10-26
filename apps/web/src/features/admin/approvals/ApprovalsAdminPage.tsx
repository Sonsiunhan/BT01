import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  ApprovalDecisionType,
  TournamentChangeRequestDto,
  TournamentDto,
} from "@ottv2/contracts";
import { ApiError } from "../../../services/http/apiError";
import { safeErrorMessage } from "../../../services/http/safeErrorMessage";
import { routes } from "../../../app/routes";
import {
  defaultTournamentAdminApi,
  type TournamentAdminApiPort,
} from "../services/tournamentAdminApi";
import { AdminForbiddenState } from "../shell/AdminForbiddenState";

export interface ApprovalsAdminPageProps {
  api?: TournamentAdminApiPort;
}

export function ApprovalsAdminPage({
  api = defaultTournamentAdminApi,
}: ApprovalsAdminPageProps) {
  // Route /admin/approvals/:tournamentId tập trung hàng đợi vào một hồ sơ cụ thể.
  const { tournamentId: routeTournamentId } = useParams<{ tournamentId?: string }>();
  const [activeTab, setActiveTab] = useState<"INITIAL" | "CHANGE_REQUEST">(
    "INITIAL"
  );
  const [initialSubmissions, setInitialSubmissions] = useState<TournamentDto[]>(
    []
  );
  const [changeRequests, setChangeRequests] = useState<
    TournamentChangeRequestDto[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [selectedTournamentId, setSelectedTournamentId] = useState<
    string | null
  >(null);
  const [selectedCrId, setSelectedCrId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reviewNote, setReviewNote] = useState<string>("");
  // Missing-note feedback: REJECT/REQUEST_CHANGES require a reason; without an
  // inline red mark + focus the SA only saw a top-of-page banner and believed
  // the buttons were dead.
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [draftFieldKey, setDraftFieldKey] = useState<string>("");
  const [draftFieldText, setDraftFieldText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadQueue = useCallback(
    async (overrideStatus?: string) => {
      setLoading(true);
      setErrorBanner(null);
      const effectiveStatus =
        overrideStatus !== undefined ? overrideStatus : statusFilter;
      try {
        const res = await api.listApprovals(
          effectiveStatus ? { status: effectiveStatus } : undefined
        );
        setInitialSubmissions(res.initialSubmissions);
        setChangeRequests(res.changeRequests);
        if (!selectedTournamentId && res.initialSubmissions[0]) {
          setSelectedTournamentId(res.initialSubmissions[0].id);
        }
        if (!selectedCrId && res.changeRequests[0]) {
          setSelectedCrId(res.changeRequests[0].id);
        }
        setForbiddenError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setForbiddenError(safeErrorMessage(err, "Bạn không có quyền xem hàng đợi phê duyệt."));
        } else {
          setErrorBanner(safeErrorMessage(err, "Không thể tải hàng đợi phê duyệt."));
        }
      } finally {
        setLoading(false);
      }
    },
    [api, selectedCrId, selectedTournamentId, statusFilter]
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleAddFieldNote = () => {
    const key = draftFieldKey.trim();
    const text = draftFieldText.trim();
    if (!key || !text) return;
    setFieldNotes((prev) => ({ ...prev, [key]: text }));
    setDraftFieldKey("");
    setDraftFieldText("");
  };

  const handleRemoveFieldNote = (key: string) => {
    setFieldNotes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Highlight + focus the reason textarea so the SA sees WHY the decision did
  // not go through instead of a banner far above the action area.
  const flagMissingNote = (message: string) => {
    setErrorBanner(message);
    setNoteError(message);
    const el = noteInputRef.current;
    if (el) {
      el.focus();
      // jsdom (test environment) does not implement scrollIntoView.
      el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  };

  const handleDecideInitial = async (
    tournament: TournamentDto,
    decision: ApprovalDecisionType
  ) => {
    setErrorBanner(null);
    setSuccessBanner(null);

    if (
      (decision === "REJECT" || decision === "REQUEST_CHANGES") &&
      reviewNote.trim().length < 3
    ) {
      flagMissingNote(
        "Bắt buộc nhập lý do (ít nhất 3 ký tự) khi Từ chối hoặc Yêu cầu chỉnh sửa (T022)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const hasFieldNotes = Object.keys(fieldNotes).length > 0;
      const res = await api.decideInitialApproval(tournament.id, {
        decision,
        expectedRevision: tournament.revision,
        note: reviewNote.trim() || undefined,
        ...(hasFieldNotes ? { fieldNotes } : {}),
      });
      setInitialSubmissions((prev) =>
        prev.map((t) => (t.id === tournament.id ? res.tournament : t))
      );
      setReviewNote("");
      setFieldNotes({});
      setNoteError(null);
      setSuccessBanner(
        `Đã xử lý hồ sơ giải "${res.tournament.coreConfig.tournamentCode}" -> trạng thái ${res.tournament.status}.`
      );
    } catch (err) {
      setErrorBanner(safeErrorMessage(err, "Không thể thực hiện quyết định."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecideChangeRequest = async (
    cr: TournamentChangeRequestDto,
    decision: ApprovalDecisionType
  ) => {
    setErrorBanner(null);
    setSuccessBanner(null);

    if (
      (decision === "REJECT" || decision === "REQUEST_CHANGES") &&
      reviewNote.trim().length < 3
    ) {
      flagMissingNote(
        "Bắt buộc nhập lý do (ít nhất 3 ký tự) khi Từ chối hoặc Yêu cầu chỉnh sửa ChangeRequest."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.decideChangeRequest(cr.id, {
        decision,
        note: reviewNote.trim() || undefined,
      });
      setChangeRequests((prev) =>
        prev.map((item) => (item.id === cr.id ? res.changeRequest : item))
      );
      setNoteError(null);
      setReviewNote("");
      setSuccessBanner(
        `Đã xử lý ChangeRequest của giải "${cr.tournamentCode}" -> ${res.changeRequest.status}.`
      );
    } catch (err) {
      setErrorBanner(safeErrorMessage(err, "Xử lý yêu cầu thay đổi thất bại."));
    } finally {
      setSubmitting(false);
    }
  };

  if (forbiddenError) {
    return (
      <AdminForbiddenState
        featureName="Xét duyệt hồ sơ & ChangeRequest giải đấu"
        message={forbiddenError}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div
          style={{
            width: "2rem",
            height: "2rem",
            border: "3px solid var(--border)",
            borderTopColor: "var(--system-cyan)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem",
          }}
        />
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Đang tải danh sách xét duyệt...</p>
      </div>
    );
  }

  // Khi có :tournamentId trên route, chỉ hiển thị hồ sơ tương ứng trong hàng đợi.
  const visibleInitialSubmissions = routeTournamentId
    ? initialSubmissions.filter((t) => t.id === routeTournamentId)
    : initialSubmissions;

  const selectedTournament =
    visibleInitialSubmissions.find((t) => t.id === selectedTournamentId) ??
    visibleInitialSubmissions[0] ??
    null;

  const selectedCr =
    changeRequests.find((c) => c.id === selectedCrId) ??
    changeRequests[0] ??
    null;

  return (
    <main aria-labelledby="p08-heading" className="admin-approvals-page space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <h1 id="p08-heading" className="text-2xl font-bold">
            Hàng đợi Phê duyệt Giải đấu &amp; Yêu cầu Thay đổi (P08)
          </h1>
          <p className="text-sm text-slate-300">
            Rà soát hồ sơ khởi tạo giải (UNDER_REVIEW) và phê duyệt ChangeRequest hậu duyệt tách biệt (BR-07).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>Bộ lọc trạng thái:</span>
            <select
              data-testid="approval-status-filter"
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value;
                setStatusFilter(next);
                void loadQueue(next);
              }}
              className="rounded border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-xs"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="UNDER_REVIEW">Chờ duyệt (UNDER_REVIEW)</option>
              <option value="CHANGES_REQUESTED">
                Yêu cầu sửa (CHANGES_REQUESTED)
              </option>
              <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
              <option value="REJECTED">Đã từ chối (REJECTED)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm"
          >
            Đồng bộ hàng đợi
          </button>
        </div>
      </header>

      {routeTournamentId && (
        <div
          data-testid="approval-focused-tournament-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-cyan-500/50 bg-cyan-950/30 p-3 text-sm text-cyan-100"
        >
          <span>
            Đang tập trung hàng đợi vào hồ sơ giải đấu:{" "}
            <strong className="font-mono">{routeTournamentId}</strong>
          </span>
          <Link
            to={routes.adminApprovals}
            data-testid="approval-back-to-full-queue"
            className="rounded border border-cyan-500/60 px-3 py-1.5 text-xs font-semibold"
          >
            Xem toàn bộ hàng đợi
          </Link>
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          data-testid="approval-error-banner"
          className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {errorBanner}
        </div>
      )}

      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="approval-success-banner"
          className="rounded border border-emerald-500/50 bg-emerald-950/40 p-3 text-sm text-emerald-200"
        >
          {successBanner}
        </div>
      )}

      <div role="tablist" aria-label="Phân loại phê duyệt" className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "INITIAL"}
          onClick={() => setActiveTab("INITIAL")}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "INITIAL"
              ? "bg-cyan-600 text-white"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Hồ sơ duyệt lần đầu ({visibleInitialSubmissions.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "CHANGE_REQUEST"}
          onClick={() => setActiveTab("CHANGE_REQUEST")}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "CHANGE_REQUEST"
              ? "bg-cyan-600 text-white"
              : "bg-slate-900 text-slate-300"
          }`}
        >
          Yêu cầu thay đổi sau duyệt ({changeRequests.length})
        </button>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-slate-400">
          Đang tải hàng đợi phê duyệt...
        </p>
      ) : activeTab === "INITIAL" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Danh sách Hồ sơ Giải đấu</h2>
            {visibleInitialSubmissions.length === 0 ? (
              <div
                data-testid={routeTournamentId ? "approval-focused-not-found" : undefined}
                className="rounded border border-slate-800 p-4 text-sm text-slate-400"
              >
                {routeTournamentId ? (
                  <>
                    Không tìm thấy hồ sơ giải đấu có mã{" "}
                    <strong className="font-mono">{routeTournamentId}</strong> trong hàng đợi phê
                    duyệt. Hồ sơ có thể chưa được nộp duyệt, đã được xử lý hoặc không tồn tại.
                  </>
                ) : (
                  "Không có hồ sơ giải đấu nào trong hàng đợi."
                )}
              </div>
            ) : (
              visibleInitialSubmissions.map((t) => (
                <article
                  key={t.id}
                  data-testid={`submission-card-${t.coreConfig.tournamentCode}`}
                  onClick={() => setSelectedTournamentId(t.id)}
                  className={`cursor-pointer rounded border p-4 ${
                    selectedTournament?.id === t.id
                      ? "border-cyan-500 bg-slate-900"
                      : "border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">
                      {t.coreConfig.tournamentCode}
                    </span>
                    <span
                      data-testid={`submission-status-${t.coreConfig.tournamentCode}`}
                      className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold"
                    >
                      {t.status} (rev v{t.revision})
                    </span>
                  </div>
                  <div className="mt-1 font-medium">
                    {t.coreConfig.tournamentName}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Hợp đồng: {t.contractCode} | Chế độ:{" "}
                    {t.coreConfig.competitionMode} | Tối đa:{" "}
                    {t.coreConfig.maxParticipants} người
                  </div>
                </article>
              ))
            )}
          </div>

          {selectedTournament && (
            <aside className="space-y-4 rounded border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-lg font-semibold">
                Chi tiết Hồ sơ — {selectedTournament.coreConfig.tournamentName}
              </h2>

              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <dt className="text-slate-400">Mã giải:</dt>
                  <dd className="font-mono font-semibold">
                    {selectedTournament.coreConfig.tournamentCode}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Trạng thái &amp; Revision:</dt>
                  <dd>
                    {selectedTournament.status} (v{selectedTournament.revision})
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Lịch bắt đầu (F33):</dt>
                  <dd>{selectedTournament.coreConfig.scheduledStartAt}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Lịch kết thúc (F34):</dt>
                  <dd>{selectedTournament.coreConfig.scheduledEndAt}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Thông số Luật (RuleProfile):</dt>
                  <dd>
                    {selectedTournament.ruleProfile.turnSeconds}s/lượt, tổng{" "}
                    {selectedTournament.ruleProfile.totalMatchSeconds}s, tie-break{" "}
                    {selectedTournament.ruleProfile.tieBreakPolicy}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Hoàn trả hạn mức:</dt>
                  <dd>{selectedTournament.quotaRefunded ? "Đã hoàn 1 slot" : "Đang giữ 1 slot"}</dd>
                </div>
              </dl>

              <div
                data-testid="approval-envelope-checklist"
                className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3 text-xs"
              >
                <h3 className="font-semibold text-slate-200">
                  Bảng đối chiếu Hợp đồng &amp; Khung Luật (Envelope / N02)
                </h3>
                <ul className="grid grid-cols-1 gap-1.5 text-slate-300 sm:grid-cols-2">
                  <li>
                    • Chế độ thi đấu:{" "}
                    <span className="font-mono font-semibold text-cyan-300">
                      {selectedTournament.coreConfig.competitionMode}
                    </span>
                  </li>
                  <li>
                    • Trần thí sinh:{" "}
                    <span className="font-mono font-semibold">
                      {selectedTournament.coreConfig.maxParticipants}
                    </span>{" "}
                    (tối thiểu {selectedTournament.coreConfig.minParticipantsToStart})
                  </li>
                  <li>
                    • Trần trận đồng thời:{" "}
                    <span className="font-mono font-semibold">
                      {selectedTournament.coreConfig.maxConcurrentMatches}
                    </span>
                  </li>
                  <li>
                    • Giới hạn lượt &amp; Hòa không tiến triển:{" "}
                    <span className="font-mono font-semibold">
                      {selectedTournament.ruleProfile.turnLimit} lượt /{" "}
                      {selectedTournament.ruleProfile.noProgressPlies} plies
                    </span>
                  </li>
                  <li>
                    • Ngưỡng lặp lại:{" "}
                    <span className="font-mono font-semibold">
                      {selectedTournament.ruleProfile.repetitionThreshold} lần
                    </span>
                  </li>
                  <li>
                    • Phiên bản luật:{" "}
                    <span className="font-mono font-semibold">
                      {selectedTournament.ruleProfile.rulesVersion}
                    </span>
                  </li>
                </ul>
              </div>

              {selectedTournament.approvedSnapshot && (
                <div
                  data-testid="approved-snapshot-summary"
                  className="rounded border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200"
                >
                  <div className="font-semibold">
                    Snapshot Phê duyệt Bất biến (v
                    {selectedTournament.approvedSnapshot.configVersionNumber})
                  </div>
                  <div className="mt-1 text-emerald-300/90">
                    Duyệt bởi: {selectedTournament.approvedSnapshot.approvedByUserId}{" "}
                    lúc {selectedTournament.approvedSnapshot.approvedAt}
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded border border-slate-800 bg-slate-950/50 p-3">
                <span className="block text-xs font-semibold text-slate-300">
                  Ghi chú theo trường (Field Notes — T022)
                </span>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    data-testid="field-note-field-input"
                    value={draftFieldKey}
                    onChange={(e) => setDraftFieldKey(e.target.value)}
                    placeholder="Tên trường (vd: scheduledStartAt)"
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    data-testid="field-note-text-input"
                    value={draftFieldText}
                    onChange={(e) => setDraftFieldText(e.target.value)}
                    placeholder="Nội dung nhận xét trường..."
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    data-testid="add-field-note-button"
                    onClick={handleAddFieldNote}
                    className="rounded border border-cyan-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-950/50"
                  >
                    + Thêm ghi chú trường
                  </button>
                </div>
                {Object.keys(fieldNotes).length > 0 && (
                  <ul className="space-y-1 pt-1 text-xs">
                    {Object.entries(fieldNotes).map(([fieldKey, noteVal]) => (
                      <li
                        key={fieldKey}
                        data-testid={`field-note-item-${fieldKey}`}
                        className="flex items-center justify-between rounded bg-slate-900 px-2 py-1"
                      >
                        <span>
                          <strong className="font-mono text-cyan-300">
                            {fieldKey}:
                          </strong>{" "}
                          {noteVal}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFieldNote(fieldKey)}
                          className="text-slate-400 hover:text-red-300"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="approval-note-input" className="block text-sm font-medium">
                  Ghi chú thẩm định / Lý do phản hồi (Bắt buộc khi Từ chối hoặc Yêu cầu sửa)
                </label>
                <textarea
                  id="approval-note-input"
                  ref={noteInputRef}
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => {
                    setReviewNote(e.target.value);
                    if (noteError) setNoteError(null);
                    if (errorBanner) setErrorBanner(null);
                  }}
                  placeholder="Nhập nhận xét hoặc lý do yêu cầu chỉnh sửa..."
                  className={noteError
                    ? "w-full rounded border-2 border-red-500 bg-slate-950 p-2 text-sm"
                    : "w-full rounded border border-slate-600 bg-slate-950 p-2 text-sm"}
                  aria-invalid={noteError ? true : undefined}
                  aria-describedby={noteError ? "approval-note-error" : undefined}
                />
                {noteError && (
                  <p id="approval-note-error" role="alert" className="text-xs font-semibold" style={{ color: "var(--system-red, #ef4444)" }}>
                    {noteError}
                  </p>
                )}
              </div>

              {selectedTournament.status === "UNDER_REVIEW" && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideInitial(selectedTournament, "APPROVE")
                    }
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Phê duyệt (APPROVED)
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideInitial(
                        selectedTournament,
                        "REQUEST_CHANGES"
                      )
                    }
                    className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                  >
                    Yêu cầu chỉnh sửa (CHANGES_REQUESTED)
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideInitial(selectedTournament, "REJECT")
                    }
                    className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                  >
                    Từ chối &amp; Hoàn hạn mức (REJECTED)
                  </button>
                </div>
              )}
            </aside>
          )}
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Danh sách Yêu cầu Thay đổi sau duyệt (ChangeRequest)
            </h2>
            {changeRequests.length === 0 ? (
              <div className="rounded border border-slate-800 p-4 text-sm text-slate-400">
                Chưa có yêu cầu thay đổi (ChangeRequest) nào.
              </div>
            ) : (
              changeRequests.map((cr) => (
                <article
                  key={cr.id}
                  data-testid={`cr-card-${cr.tournamentCode}`}
                  onClick={() => setSelectedCrId(cr.id)}
                  className={`cursor-pointer rounded border p-4 ${
                    selectedCr?.id === cr.id
                      ? "border-cyan-500 bg-slate-900"
                      : "border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">{cr.tournamentCode}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold">
                      {cr.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{cr.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Số trường thay đổi: {cr.diffs.length} | Hiệu lực từ:{" "}
                    {cr.effectiveAt}
                  </p>
                </article>
              ))
            )}
          </div>

          {selectedCr && (
            <aside className="space-y-4 rounded border border-slate-700 bg-slate-900/50 p-4">
              <h2 className="text-lg font-semibold">
                Bảng đối chiếu Before / After — {selectedCr.tournamentCode}
              </h2>

              <table className="w-full border border-slate-800 text-left text-xs">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="p-2">Trường</th>
                    <th className="p-2">Giá trị trước</th>
                    <th className="p-2">Giá trị đề xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedCr.diffs.map((d) => (
                    <tr key={d.fieldPath}>
                      <td className="p-2 font-mono">{d.fieldPath}</td>
                      <td className="p-2 font-mono text-slate-400">
                        {JSON.stringify(d.beforeValue)}
                      </td>
                      <td className="p-2 font-mono text-cyan-300">
                        {JSON.stringify(d.afterValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2">
                <label htmlFor="cr-note-input" className="block text-sm font-medium">
                  Ghi chú phản hồi ChangeRequest
                </label>
                <textarea
                  id="cr-note-input"
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Nhập ghi chú duyệt hoặc lý do từ chối..."
                  className="w-full rounded border border-slate-600 bg-slate-950 p-2 text-sm"
                />
              </div>

              {selectedCr.status === "PENDING" && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideChangeRequest(selectedCr, "APPROVE")
                    }
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Duyệt ChangeRequest
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideChangeRequest(
                        selectedCr,
                        "REQUEST_CHANGES"
                      )
                    }
                    className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Yêu cầu chỉnh sửa
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void handleDecideChangeRequest(selectedCr, "REJECT")
                    }
                    className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Từ chối ChangeRequest
                  </button>
                </div>
              )}
            </aside>
          )}
        </section>
      )}
    </main>
  );
}

export default ApprovalsAdminPage;
