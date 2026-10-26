import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Modal, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { getMe, logout, type UserProfile } from "../services/auth/authApi";
import { RobotLabWordmark } from "../foundation/RobotLabWordmark";
import { AdminCapabilityGuard } from "../features/admin/shell/AdminCapabilityGuard";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [network, setNetwork] = useState<"checking" | "online" | "offline" | "reconnecting" | "degraded">("checking");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const profileDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const userRoles = (user as (UserProfile & { roles?: string[] }) | null)?.roles;
  const isSystemAdmin =
    user?.role === "SYSTEM_ADMIN" ||
    user?.role === "ADMIN" ||
    Boolean(userRoles?.includes("ADMIN")) ||
    Boolean(userRoles?.includes("SYSTEM_ADMIN"));

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
              {isSystemAdmin && (
                <NavLink
                  to={routes.adminTa}
                  className={({ isActive }) =>
                    `nav-link ${isActive || location.pathname.startsWith("/admin/ta") ? "active font-bold text-primary" : ""}`
                  }
                  style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
                >
                  Tài khoản TA
                </NavLink>
              )}
              <NavLink
                to={routes.adminTournaments}
                className={({ isActive }) =>
                  `nav-link ${isActive || location.pathname.startsWith("/admin/tournaments") ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Giải đấu
              </NavLink>
              {isSystemAdmin && (
                <>
                  <NavLink
                    to={routes.adminUnits}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                    }
                    style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
                  >
                    Đơn vị
                  </NavLink>
                  <NavLink
                    to={routes.adminContracts}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                    }
                    style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
                  >
                    Hợp đồng
                  </NavLink>
                  <NavLink
                    to={routes.adminApprovals}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                    }
                    style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
                  >
                    Xét duyệt
                  </NavLink>
                </>
              )}
              <NavLink
                to={routes.adminAudit}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Nhật ký
              </NavLink>
              <NavLink
                to={routes.adminSupport}
                className={({ isActive }) =>
                  `nav-link ${isActive || location.pathname.startsWith("/admin/support") ? "active font-bold text-primary" : ""}`
                }
                style={{ padding: "0.4rem 0.75rem", borderRadius: "0.375rem" }}
              >
                Hỗ trợ
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
                <summary
                  aria-label="Mở menu quản trị viên"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: isSystemAdmin ? "var(--system-cyan, #06b6d4)" : "var(--system-amber, #f59e0b)",
                    }}
                  />
                  <span>{user.displayName || user.username}</span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "0.25rem",
                      background: isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 15%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 15%, transparent)",
                      color: isSystemAdmin ? "var(--system-cyan, #06b6d4)" : "var(--system-amber, #f59e0b)",
                      fontWeight: 700,
                      border: `1px solid ${isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 30%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 30%, transparent)"}`,
                    }}
                  >
                    {isSystemAdmin ? "SA" : "TA"}
                  </span>
                </summary>
                <div style={{ minWidth: "15rem", padding: "0.5rem" }}>
                  <div
                    style={{
                      padding: "0.5rem 0.6rem 0.65rem",
                      borderBottom: "1px solid var(--border)",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>
                      {user.displayName || user.username}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      @{user.username}
                    </div>
                    <div style={{ marginTop: "0.4rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          background: isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 12%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 12%, transparent)",
                          color: isSystemAdmin ? "var(--system-cyan, #06b6d4)" : "var(--system-amber, #f59e0b)",
                          border: `1px solid ${isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 25%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 25%, transparent)"}`,
                        }}
                      >
                        {isSystemAdmin ? "🛡️ Quản trị hệ thống (SA)" : "📋 Quản trị giải đấu (TA)"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (profileDetailsRef.current) profileDetailsRef.current.removeAttribute("open");
                      setAccountModalOpen(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      padding: "0.5rem 0.6rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>ℹ️</span>
                    <span>Thông tin tài khoản</span>
                  </button>

                  <button
                    type="button"
                    onClick={signOut}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      padding: "0.5rem 0.6rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.85rem",
                      color: "var(--system-red, #ef4444)",
                      marginTop: "0.2rem",
                    }}
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
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
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "350px",
                  color: "var(--text-secondary)",
                }}
              >
                <div style={{ textAlign: "center" }}>
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
                  <p style={{ fontSize: "0.9rem" }}>Đang tải...</p>
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>

        {user && (
          <Modal
            open={accountModalOpen}
            title="Thông tin Quản trị viên"
            description="Định danh và phạm vi thẩm quyền của tài khoản quản trị"
            onClose={() => setAccountModalOpen(false)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "var(--surface-raised)",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  display: "grid",
                  gridTemplateColumns: "130px 1fr",
                  gap: "0.6rem 1rem",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>Họ và tên:</span>
                <strong>{user.displayName || "Chưa thiết lập"}</strong>

                <span style={{ color: "var(--text-muted)" }}>Tài khoản:</span>
                <code>@{user.username}</code>

                <span style={{ color: "var(--text-muted)" }}>Mã người dùng:</span>
                <code style={{ fontSize: "0.78rem" }}>{user.id}</code>

                <span style={{ color: "var(--text-muted)" }}>Vai trò hệ thống:</span>
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 15%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 15%, transparent)",
                      color: isSystemAdmin ? "var(--system-cyan, #06b6d4)" : "var(--system-amber, #f59e0b)",
                      border: `1px solid ${isSystemAdmin ? "color-mix(in srgb, var(--system-cyan, #06b6d4) 30%, transparent)" : "color-mix(in srgb, var(--system-amber, #f59e0b) 30%, transparent)"}`,
                    }}
                  >
                    {isSystemAdmin ? "SYSTEM_ADMIN (Quản trị hệ thống)" : "TOURNAMENT_ADMIN (Quản trị giải đấu)"}
                  </span>
                </div>

                <span style={{ color: "var(--text-muted)" }}>Phạm vi phụ trách:</span>
                <span style={{ lineHeight: 1.4 }}>
                  {isSystemAdmin
                    ? "Toàn quyền hệ thống: Cấp tài khoản TA, quản lý đơn vị tổ chức, phê duyệt hợp đồng thương mại, kiểm toán nhật ký hệ thống."
                    : "Vận hành giải đấu: Khởi tạo và thiết lập giải đấu, giám sát tiến độ trận đấu, quản lý kho Bot và công cụ offline."}
                </span>
              </div>

              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "color-mix(in srgb, var(--blue-side, rgb(59, 130, 246)) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--blue-side, rgb(59, 130, 246)) 20%, transparent)",
                  borderRadius: "0.5rem",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                <strong>Chính sách phân tách thẩm quyền (Best Practice):</strong> Tài khoản quản trị chỉ phục vụ mục đích vận hành và giám sát hệ thống, tách biệt hoàn toàn khỏi hoạt động thi đấu của người chơi nhằm ngăn chặn xung đột lợi ích. Để tham gia các giải đấu với tư cách vận động viên, vui lòng sử dụng tài khoản người chơi riêng biệt.
              </div>

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <Button variant="secondary" onClick={() => setAccountModalOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AdminCapabilityGuard>
  );
}

export default AdminLayout;
