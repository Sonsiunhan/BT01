import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { routes } from "../../app/routes";
import {
  tournamentRosterApi,
  type TournamentRosterApi,
  type EnrollmentRecordItem,
} from "./tournamentRosterApi";
import type {
  RosterPreviewResponse,
  RosterCommitResponse,
} from "@ottv2/contracts";

export function TournamentRosterPage({
  apiClient = tournamentRosterApi,
  tournamentId: propTournamentId,
}: {
  apiClient?: TournamentRosterApi;
  tournamentId?: string;
} = {}) {
  const { tournamentId = "" } = useParams<{ tournamentId: string }>();
  const resolvedTournamentId = propTournamentId ?? tournamentId;

  const [enrollments, setEnrollments] = useState<EnrollmentRecordItem[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);

  // File upload & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<RosterPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Commit state
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<RosterCommitResponse | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Activation issuance state
  const [issuingForId, setIssuingForId] = useState<string | null>(null);
  const [issuedTokenInfo, setIssuedTokenInfo] = useState<{
    enrollmentId: string;
    personKey: string;
    claimToken: string;
    expiresAt: string;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadEnrollments = useCallback(async () => {
    if (!resolvedTournamentId) return;
    setLoadingEnrollments(true);
    setEnrollmentsError(null);
    try {
      const res = await apiClient.listEnrollments(resolvedTournamentId);
      setEnrollments(res.enrollments ?? []);
    } catch (cause) {
      setEnrollmentsError(cause instanceof Error ? cause.message : "Không thể tải danh sách thí sinh.");
    } finally {
      setLoadingEnrollments(false);
    }
  }, [apiClient, resolvedTournamentId]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewResult(null);
    setPreviewError(null);
    setCommitResult(null);
    setCommitError(null);

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          // If data URL, extract base64 part
          const commaIndex = result.indexOf(",");
          setFileBase64(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setFileBase64("");
    }
  };

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileBase64) {
      setPreviewError("Vui lòng chọn một tệp CSV hoặc XLSX.");
      return;
    }

    setPreviewing(true);
    setPreviewError(null);
    setCommitResult(null);
    try {
      const result = await apiClient.preview({
        fileName: selectedFile.name,
        fileContent: fileBase64,
      });
      setPreviewResult(result);
    } catch (cause) {
      setPreviewError(cause instanceof Error ? cause.message : "Không thể kiểm tra tệp danh sách.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!previewResult || !resolvedTournamentId) return;

    setCommitting(true);
    setCommitError(null);
    try {
      const rows = previewResult.rows.filter((r) => r.valid).map((r) => r.data);
      const res = await apiClient.commit({
        tournamentId: resolvedTournamentId,
        rows,
        fileName: selectedFile?.name,
        fileContent: fileBase64,
        idempotencyKey: `commit-${resolvedTournamentId}-${Date.now()}`,
      });
      setCommitResult(res);
      setActionMessage(`Đã import thành công ${res.importedCount} thí sinh vào giải đấu.`);
      await loadEnrollments();
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : "Xảy ra lỗi khi lưu danh sách thí sinh.");
    } finally {
      setCommitting(false);
    }
  };

  const handleIssueActivation = async (enrollmentId: string) => {
    setIssuingForId(enrollmentId);
    setActionMessage(null);
    try {
      const res = await apiClient.issueActivationToken({
        enrollmentId,
        idempotencyKey: `issue-${enrollmentId}-${Date.now()}`,
      });
      setIssuedTokenInfo({
        enrollmentId,
        personKey: res.personKey,
        claimToken: res.claimToken,
        expiresAt: res.expiresAt,
      });
      setActionMessage("Đã phát hành mã kích hoạt cho thí sinh.");
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : "Không thể phát hành mã kích hoạt.");
    } finally {
      setIssuingForId(null);
    }
  };

  return (
    <main
      className="page-container"
      data-testid="tournament-roster-page"
      style={{ maxWidth: 1100, margin: "0 auto", width: "100%", padding: "1.5rem 1rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow">P10 // QUẢN LÝ THÍ SINH & IMPORT ROSTER</p>
          <h1 style={{ margin: "0.25rem 0 0.5rem" }}>Danh sách thí sinh giải đấu</h1>
        </div>
        <Link
          to={routes.adminTournamentDetail.replace(":tournamentId", resolvedTournamentId)}
          className="button secondary"
          style={{ fontSize: "0.85rem" }}
        >
          ← Quay lại chi tiết giải
        </Link>
      </div>

      {actionMessage && (
        <div role="status" style={{ padding: "0.75rem 1rem", background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: "0.5rem", marginBottom: "1.25rem" }}>
          {actionMessage}
        </div>
      )}

      {/* SECTION 1: Upload & Preview */}
      <section
        style={{
          padding: "1.25rem",
          border: "1px solid var(--border)",
          borderRadius: "0.8rem",
          background: "var(--surface)",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>Tải lên tệp danh sách thí sinh (CSV / XLSX)</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.25rem 0 1rem" }}>
          Hỗ trợ các cột chuẩn: <code>unit_code</code>, <code>student_or_member_id</code>, <code>full_name</code>, <code>username</code>, <code>email</code>.
        </p>

        <form onSubmit={handlePreview} style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            data-testid="roster-file-input"
            aria-label="Chọn tệp danh sách thí sinh"
          />
          <button
            type="submit"
            className="button primary"
            disabled={!selectedFile || previewing}
            data-testid="roster-preview-btn"
          >
            {previewing ? "Đang đọc tệp…" : "Xem trước (Preview)"}
          </button>
        </form>

        {previewError && (
          <div role="alert" style={{ marginTop: "1rem", color: "#ef4444" }}>
            {previewError}
          </div>
        )}

        {/* Preview Results Panel */}
        {previewResult && (
          <div style={{ marginTop: "1.5rem" }} data-testid="roster-preview-result">
            <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Kết quả kiểm tra trước import</h3>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                marginBottom: "1rem",
              }}
            >
              <span className="badge" data-testid="badge-total">Tổng số: {previewResult.totalRows}</span>
              <span className="badge" data-testid="badge-valid" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>
                Hợp lệ: {previewResult.validRows}
              </span>
              <span className="badge" data-testid="badge-error" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                Lỗi: {previewResult.errorRows}
              </span>
              <span className="badge" data-testid="badge-warning" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
                Cảnh báo: {previewResult.warningRows}
              </span>
            </div>

            {/* Preview Rows Table */}
            <div style={{ overflowX: "auto", maxHeight: "360px", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>#</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Đơn vị</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Mã định danh</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Họ và tên</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Tên đăng nhập</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Email</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Trạng thái</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Ghi chú / Lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: row.valid ? "transparent" : "rgba(239, 68, 68, 0.08)",
                      }}
                    >
                      <td style={{ padding: "0.5rem 0.75rem" }}>{row.rowNumber}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{String(row.data.unit_code ?? "")}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{String(row.data.student_or_member_id ?? "")}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{String(row.data.full_name ?? "")}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{String(row.data.username ?? "")}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{String(row.data.email ?? "")}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: row.valid ? "#10b981" : "#ef4444" }}>
                        {row.valid ? "Hợp lệ" : "Lỗi"}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: row.valid ? "var(--muted)" : "#ef4444" }}>
                        {row.errors.length > 0
                          ? row.errors.join("; ")
                          : row.warnings.length > 0
                          ? `Cảnh báo: ${row.warnings.join("; ")}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Commit Action */}
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <button
                type="button"
                className="button primary"
                disabled={committing || previewResult.validRows === 0}
                onClick={handleCommit}
                data-testid="roster-commit-btn"
              >
                {committing ? "Đang lưu thí sinh…" : `Xác nhận lưu ${previewResult.validRows} thí sinh`}
              </button>
              {commitError && <span role="alert" style={{ color: "#ef4444" }}>{commitError}</span>}
            </div>
          </div>
        )}

        {/* Commit Outcome Display */}
        {commitResult && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid #10b981",
            }}
            data-testid="roster-commit-outcome"
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Kết quả Import</h3>
            <p style={{ margin: 0 }}>
              Đã ghi nhận thành công <strong>{commitResult.importedCount}</strong> / {commitResult.totalRows} thí sinh.
            </p>
          </div>
        )}
      </section>

      {/* SECTION 2: Token Handoff Banner */}
      {issuedTokenInfo && (
        <section
          style={{
            padding: "1.25rem",
            border: "2px solid #3b82f6",
            borderRadius: "0.8rem",
            background: "rgba(59, 130, 246, 0.1)",
            marginBottom: "1.5rem",
          }}
          data-testid="token-handoff-banner"
        >
          <h2 style={{ fontSize: "1.1rem", marginTop: 0, color: "#60a5fa" }}>Mã kích hoạt bàn giao</h2>
          <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.9rem" }}>
            Thí sinh: <strong>{issuedTokenInfo.personKey}</strong> | Hết hạn: {new Date(issuedTokenInfo.expiresAt).toLocaleString("vi-VN")}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <code
              data-testid="claim-token-value"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.4rem",
                background: "var(--background)",
                border: "1px solid var(--border)",
                fontSize: "1rem",
                fontWeight: "bold",
                letterSpacing: "0.05em",
              }}
            >
              {issuedTokenInfo.claimToken}
            </code>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(issuedTokenInfo.claimToken);
                setActionMessage("Đã sao chép mã kích hoạt vào bộ nhớ đệm.");
              }}
              style={{ fontSize: "0.85rem" }}
            >
              Sao chép mã
            </button>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              * Mã chỉ hiển thị trong lần này. Hãy gửi mã này cho thí sinh để kích hoạt tài khoản.
            </span>
          </div>
        </section>
      )}

      {/* SECTION 3: Current Tournament Enrollments */}
      <section
        style={{
          padding: "1.25rem",
          border: "1px solid var(--border)",
          borderRadius: "0.8rem",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Thí sinh hiện tại trong giải ({enrollments.length})</h2>
          <button
            type="button"
            className="button secondary"
            onClick={() => void loadEnrollments()}
            disabled={loadingEnrollments}
            style={{ fontSize: "0.85rem" }}
          >
            Làm mới
          </button>
        </div>

        {loadingEnrollments ? (
          <p data-testid="roster-loading">Đang tải danh sách thí sinh…</p>
        ) : enrollmentsError ? (
          <div role="alert" style={{ color: "#ef4444" }}>{enrollmentsError}</div>
        ) : enrollments.length === 0 ? (
          <p data-testid="roster-empty" style={{ color: "var(--muted)" }}>
            Giải đấu hiện chưa có thí sinh nào được ghi danh. Hãy tải tệp danh sách phía trên để nhập thí sinh.
          </p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }} data-testid="roster-table">
              <thead>
                <tr style={{ background: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Mã định danh (personKey)</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Họ và tên</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Đơn vị</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Email</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Hạt giống</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}>Trạng thái tài khoản</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => (
                  <tr key={enr.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>{enr.personKey}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{enr.displayName}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{enr.unitCode}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{enr.email ?? "—"}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{enr.seedRating}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <span
                        className="badge"
                        style={{
                          background: enr.userId ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: enr.userId ? "#10b981" : "#f59e0b",
                        }}
                      >
                        {enr.userId ? "Đã liên kết" : "Chưa kích hoạt"}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={issuingForId === enr.id}
                        onClick={() => void handleIssueActivation(enr.id)}
                        data-testid={`issue-btn-${enr.id}`}
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                      >
                        {issuingForId === enr.id ? "Đang tạo…" : "Tạo mã kích hoạt"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default TournamentRosterPage;
