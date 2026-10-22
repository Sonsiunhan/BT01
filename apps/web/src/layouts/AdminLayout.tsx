import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeSwitcher, UiGlyph, useToast } from "../components/ui";
import { routes } from "../app/routes";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { getMe, logout, type UserProfile } from "../services/auth/authApi";
import { RobotLabWordmark } from "../foundation/RobotLabWordmark";
import { AdminCapabilityGuard } from "../features/admin/shell/AdminCapabilityGuard";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [network, setNetwork] = useState<"checking" | "online" | "offline" | "reconnecting" | "degraded">("checking");
  const [user, setUser] = useState<UserProfile | null>(null);
  const profileDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      if (profileDetailsRef.current?.open && !profileDetailsRef.current.contains(event.target as Node)) {
        profileDetailsRef.current.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    let active = true;
    const check = () =>
      getHealth()
        .then((health) => {
          if (active) setNetwork(isCoreServiceReady(health) ? "online" : "degraded");
        })
        .catch(() => {
          if (active) setNetwork("offline");
        });
    check();
    const timer = window.setInterval(check, 30000);

    getMe()
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    const onAuthChange = (event: Event) => {
      const detail = (event as CustomEvent<{ user: UserProfile | null }>).detail;
      if (active) setUser(detail?.user ?? null);
    };
    window.addEventListener("ottv2:auth-change", onAuthChange);

    const onNetworkState = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (!active) return;
      if (state === "OFFLINE") setNetwork("offline");
      else if (state === "RECONNECTING") setNetwork("reconnecting");
      else if (state === "DEGRADED") setNetwork("degraded");
      else if (state === "CONNECTED") setNetwork("online");
    };
    window.addEventListener("ottv2:network-state", onNetworkState);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ottv2:network-state", onNetworkState);
      window.removeEventListener("ottv2:auth-change", onAuthChange);
    };
  }, []);

  const signOut = async () => {
    await logout().catch(() => undefined);
    setUser(null);
    navigate(routes.login);
  };

  return (
    <AdminCapabilityGuard>
      <div className="admin-shell app-shell" data-testid="admin-shell">
        {/* Header Admin */}
        <header
          className="app-header admin-header"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "0.5rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <NavLink
              className="brand"
              to={routes.adminTournaments}
              aria-label="OTT v2 Console Quản trị"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}
            >
              <RobotLabWordmark />
              <span
                style={{
                  display: "inline-block",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-data)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: "var(--surface-raised)",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Console Quản trị
              </span>
            </NavLink>
          </div>

          {/* Navigation 2 nhóm chính: Quản lí giải & Công cụ Offline */}
          <nav
            className="main-nav admin-nav"
            aria-label="Điều hướng quản trị"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <NavLink
                to={routes.adminTa}
                className={({ isActive }) =>
                  `nav-link ${isActive || location.pathname.startsWith("/admin/ta") ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Tài khoản TA
              </NavLink>
              <NavLink
                to={routes.adminTournaments}
                className={({ isActive }) =>
                  `nav-link ${isActive || location.pathname.startsWith("/admin/tournaments") ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Giải đấu
              </NavLink>
              <NavLink
                to={routes.adminAudit}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Nhật ký
              </NavLink>
            </div>

            <span style={{ color: "var(--border)", userSelect: "none" }}>|</span>

            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <NavLink
                to={routes.adminOffline}
                className={({ isActive }) =>
                  `nav-link ${isActive || location.pathname.startsWith("/admin/offline") ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Công cụ Offline
              </NavLink>
              <NavLink
                to={routes.adminOfflineBots}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Kho Bot
              </NavLink>
            </div>
          </nav>

          {/* Header Actions */}
          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeSwitcher />
            {user ? (
              <details ref={profileDetailsRef} className="profile-menu">
                <summary aria-label="Mở menu quản trị viên">{user.displayName || user.username}</summary>
                <div>
                  <NavLink to={routes.profile}>Hồ sơ cá nhân</NavLink>
                  <NavLink to={routes.home}>Về sảnh game</NavLink>
                  <button type="button" onClick={signOut}>
                    Đăng xuất
                  </button>
                </div>
              </details>
            ) : (
              <NavLink className="header-login" to={routes.login}>
                Đăng nhập
              </NavLink>
            )}
          </div>
        </header>

        {/* Network status banner */}
        {network !== "online" && network !== "checking" && (
          <div className={`network-banner ${network}`} role="status" aria-live="polite">
            <strong>
              {network === "offline"
                ? "Mất kết nối mạng"
                : network === "degraded"
                ? "Dịch vụ đang suy giảm"
                : "Đang kết nối lại"}
            </strong>
            <span>
              {network === "offline"
                ? "Các thao tác console đang tạm khoá; dữ liệu sẽ được đồng bộ khi kết nối trở lại."
                : network === "degraded"
                ? "Một số thao tác có thể chậm hoặc cần thử lại."
                : "Đang thử khôi phục kết nối realtime…"}
            </span>
          </div>
        )}

        {/* Nội dung chính của trang quản trị */}
        <main className="page-container admin-page-container" style={{ padding: "1.5rem" }}>
          <Outlet />
        </main>
      </div>
    </AdminCapabilityGuard>
  );
}

export default AdminLayout;
