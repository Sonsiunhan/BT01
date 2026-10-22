import React from "react";
import { Link } from "react-router-dom";
import { routes } from "../../../app/routes";

interface AdminRoutePendingProps {
  pageCode: string;
  title: string;
  targetTask: string;
  description?: string;
}

export const AdminRoutePending: React.FC<AdminRoutePendingProps> = ({
  pageCode,
  title,
  targetTask,
  description,
}) => {
  return (
    <div
      className="admin-pending-container"
      style={{
        padding: "2.5rem 1.5rem",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "1rem",
          background: "var(--surface)",
          padding: "2rem",
          boxShadow: "var(--elevation-card)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              display: "inline-block",
              padding: "0.25rem 0.65rem",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-data)",
              fontWeight: 700,
              background: "color-mix(in srgb, var(--primary) 15%, transparent)",
              color: "var(--primary)",
              border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            {pageCode}
          </span>
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-data)",
            }}
          >
            Lộ trình: Task {targetTask}
          </span>
        </div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            margin: 0,
          }}
        >
          {description ||
            `Giao diện này đang được hoàn thiện theo đúng kế hoạch triển khai của đợt Khởi tạo giải đấu (giao thức bàn giao trong Task ${targetTask}). Mọi logic nghiệp vụ và form validation sẽ được tích hợp trực tiếp từ module tương ứng.`}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <Link
            to={routes.adminTournaments}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--primary)",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            ← Về danh sách giải đấu
          </Link>
          <Link
            to={routes.adminOffline}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--surface-raised)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 500,
              border: "1px solid var(--border)",
            }}
          >
            Hub công cụ Offline
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminRoutePending;
