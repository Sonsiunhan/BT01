import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMe, type UserProfile } from "../../../services/auth/authApi";
import { loginReturnPath } from "../../../services/auth/returnUrl";
import { UiGlyph } from "../../../components/ui/UiGlyph";

export interface AdminCapabilityGuardProps {
  requiredCapability?: string;
  children: React.ReactNode;
}

export const AdminCapabilityGuard: React.FC<AdminCapabilityGuardProps> = ({
  children,
}) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then((res) => {
        if (active) {
          setUser(res.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setLoading(false);
        }
      });

    const onAuthChange = (event: Event) => {
      const detail = (event as CustomEvent<{ user: UserProfile | null }>).detail;
      if (active) {
        setUser(detail?.user ?? null);
      }
    };

    window.addEventListener("ottv2:auth-change", onAuthChange);
    return () => {
      active = false;
      window.removeEventListener("ottv2:auth-change", onAuthChange);
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-body)",
        }}
        data-testid="admin-guard-loading"
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "2rem",
              height: "2rem",
              border: "3px solid var(--border)",
              borderTopColor: "var(--primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p>Đang kiểm tra quyền truy cập console...</p>
        </div>
      </div>
    );
  }

  // Nếu chưa đăng nhập: yêu cầu đăng nhập
  if (!user) {
    return (
      <div
        style={{
          padding: "3rem 1.5rem",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center",
        }}
        data-testid="admin-guard-unauthenticated"
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            padding: "2.5rem 2rem",
            boxShadow: "var(--elevation-card)",
          }}
        >
          <div
            style={{
              display: "grid",
              placeItems: "center",
              minHeight: "2.5rem",
              marginBottom: "1rem",
            }}
          >
            <UiGlyph name="lock" size={40} />
          </div>
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "0.75rem",
            }}
          >
            Yêu cầu đăng nhập quản trị
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            Khu vực quản trị giải đấu yêu cầu xác thực danh tính. Vui lòng đăng nhập bằng tài khoản có thẩm quyền để tiếp tục.
          </p>
          <Link
            to={loginReturnPath(location)}
            style={{
              display: "inline-block",
              padding: "0.6rem 1.5rem",
              borderRadius: "0.5rem",
              background: "var(--primary)",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  // Kiểm tra vai trò quản trị (chặn người dùng thường USER truy cập Console Quản trị)
  const userRoles = (user as UserProfile & { roles?: string[] }).roles;
  const isAdmin =
    user.role === "SYSTEM_ADMIN" ||
    user.role === "TOURNAMENT_ADMIN" ||
    Boolean(userRoles?.includes("ADMIN")) ||
    Boolean(userRoles?.includes("SYSTEM_ADMIN")) ||
    Boolean(userRoles?.includes("TOURNAMENT_ADMIN"));

  if (!isAdmin) {
    return (
      <div
        style={{
          padding: "3rem 1.5rem",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center",
        }}
        data-testid="admin-guard-forbidden"
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            padding: "2.5rem 2rem",
            boxShadow: "var(--elevation-card)",
          }}
        >
          <div
            style={{
              display: "grid",
              placeItems: "center",
              minHeight: "2.5rem",
              marginBottom: "1rem",
            }}
          >
            <UiGlyph name="lock" size={40} />
          </div>
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "var(--system-red, #ef4444)",
              marginBottom: "0.75rem",
            }}
          >
            Từ chối quyền truy cập
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            Tài khoản hiện tại ({user.username}) không có thẩm quyền Quản trị viên (System Admin hoặc Tournament Admin) để truy cập Console Quản trị. Vui lòng liên hệ ban tổ chức giải đấu.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "0.6rem 1.5rem",
              borderRadius: "0.5rem",
              background: "var(--surface-raised)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Quay về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminCapabilityGuard;
