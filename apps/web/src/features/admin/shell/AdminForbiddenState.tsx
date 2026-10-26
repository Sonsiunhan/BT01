import React from "react";
import { routes } from "../../../app/routes";
import { UiGlyph } from "../../../components/ui/UiGlyph";

export interface AdminForbiddenStateProps {
  title?: string;
  message?: string;
  featureName?: string;
  backTo?: string;
  backText?: string;
  testId?: string;
}

export const AdminForbiddenState: React.FC<AdminForbiddenStateProps> = ({
  title = "Yêu cầu thẩm quyền Quản trị viên Hệ thống (System Admin)",
  message,
  featureName,
  backTo = routes.adminTournaments,
  backText = "Quay lại Bảng điều khiển Giải đấu",
  testId = "admin-forbidden-state",
}) => {
  const displayMessage =
    message ||
    (featureName
      ? `Tính năng "${featureName}" chỉ dành cho Quản trị viên Hệ thống (SYSTEM_ADMIN). Tài khoản Quản trị giải đấu (TOURNAMENT_ADMIN) chỉ có quyền quản lý các giải đấu được phân công.`
      : "Khu vực này yêu cầu thẩm quyền Quản trị viên Hệ thống (SYSTEM_ADMIN). Tài khoản hiện tại không có quyền truy cập.");

  return (
    <div
      role="alert"
      aria-label="Thông báo không đủ thẩm quyền"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "450px",
        padding: "2rem 1rem",
        width: "100%",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          padding: "2.5rem 2rem",
          borderRadius: "1rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--elevation-card)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
        data-testid={testId}
      >
        <div
          style={{
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--system-red, #ef4444) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--system-red, #ef4444) 35%, transparent)",
            display: "grid",
            placeItems: "center",
            color: "var(--system-red, #ef4444)",
            marginBottom: "0.25rem",
          }}
        >
          <UiGlyph name="lock" size={30} />
        </div>

        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0.2rem 0.6rem",
            borderRadius: "999px",
            background: "color-mix(in srgb, var(--system-red, #ef4444) 12%, transparent)",
            color: "var(--system-red, #ef4444)",
            border: "1px solid color-mix(in srgb, var(--system-red, #ef4444) 30%, transparent)",
          }}
        >
          Truy cập bị từ chối (403)
        </span>

        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text)",
            margin: "0.25rem 0 0",
            lineHeight: 1.35,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 0.5rem",
            maxWidth: "460px",
          }}
        >
          {displayMessage}
        </p>

        <a
          href={backTo}
          className="button secondary"
          style={{
            marginTop: "0.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.4rem",
            fontSize: "0.92rem",
            fontWeight: 600,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {backText}
        </a>
      </div>
    </div>
  );
};

export default AdminForbiddenState;
