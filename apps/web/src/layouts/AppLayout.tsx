import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Modal, ThemeSwitcher, UiGlyph, useToast } from "../components/ui";
import { routes } from "../app/routes";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { getMe, logout, type UserProfile } from "../services/auth/authApi";
import { RobotLabWordmark } from "../foundation/RobotLabWordmark";
import { loginReturnPath } from "../services/auth/returnUrl";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const isGame = /^\/(?:game|room|phong)\//.test(location.pathname);
  const isHome = location.pathname === routes.home || location.pathname === routes.canonicalHome;
  const [network, setNetwork] = useState<"checking" | "online" | "offline" | "reconnecting" | "degraded">("checking");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => getHealth().then((health) => { if (active) setNetwork(isCoreServiceReady(health) ? "online" : "degraded"); }).catch(() => { if (active) setNetwork("offline"); });
    check();
    const timer = window.setInterval(check, 30000);
    getMe().then((result) => { if (active) setUser(result.user); }).catch(() => { if (active) setUser(null); });
    const onNetworkState = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (!active) return;
      if (state === "OFFLINE") setNetwork("offline");
      else if (state === "RECONNECTING") setNetwork("reconnecting");
      else if (state === "DEGRADED") setNetwork("degraded");
      else if (state === "CONNECTED") setNetwork("online");
    };
    const onSessionExpired = () => { if (active) { setUser(null); setSessionExpired(true); } };
    window.addEventListener("ottv2:network-state", onNetworkState);
    window.addEventListener("ottv2:session-expired", onSessionExpired);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ottv2:network-state", onNetworkState);
      window.removeEventListener("ottv2:session-expired", onSessionExpired);
    };
  }, []);

  useEffect(() => {
    const onQualityDowngrade = (event: Event) => {
      const detail = (event as CustomEvent<{ from?: string; to?: string }>).detail;
      notify(`Hiệu năng giảm từ ${detail.from ?? "auto"} xuống ${detail.to ?? "thấp hơn"}.`, "warning", 8000, { label: "Mở cài đặt", onClick: () => navigate(`${routes.settings}?tab=appearance`) });
    };
    window.addEventListener("ottv2:quality-downgrade", onQualityDowngrade);
    return () => window.removeEventListener("ottv2:quality-downgrade", onQualityDowngrade);
  }, [navigate, notify]);

  const signOut = async () => { await logout().catch(() => undefined); setUser(null); navigate(routes.login); };
  return <div className={`app-shell ${isGame ? "game-shell" : ""}`}>
    {!isGame && <header className="app-header">
      <NavLink className="brand" to={routes.home} aria-label="OTT v2 — Oẳn Tù Tì v2 — Trang chủ"><RobotLabWordmark /></NavLink>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <NavLink to={routes.home}>Sảnh</NavLink>
        <NavLink to={routes.botWorkbench}>Xưởng Bot</NavLink>
        <NavLink to={routes.rooms}>Đấu trường</NavLink>
        <NavLink to={routes.friends}>Bạn bè</NavLink>
        <NavLink to={routes.history}>Lịch sử</NavLink>
        <NavLink to={routes.profile}>Hồ sơ</NavLink>
      </nav>
      <div className="header-actions"><ThemeSwitcher />{user ? <details className="profile-menu"><summary aria-label="Mở menu hồ sơ">{user.displayName}</summary><div><NavLink to={routes.profile}>Xem hồ sơ</NavLink><NavLink to={routes.settings}>Cài đặt</NavLink><button type="button" onClick={signOut}>Đăng xuất</button></div></details> : <NavLink className="header-login" to={routes.login}>Đăng nhập</NavLink>}</div>
    </header>}
    {!isGame && !isHome && network !== "online" && network !== "checking" && <div className={`network-banner ${network}`} role="status" aria-live="polite"><strong>{network === "offline" ? "Mất kết nối mạng" : network === "degraded" ? "Dịch vụ đang suy giảm" : "Đang kết nối lại"}</strong><span>{network === "offline" ? "Các thao tác online đang tạm khoá; dữ liệu sẽ được đồng bộ khi kết nối trở lại." : network === "degraded" ? "Một số thao tác có thể chậm hoặc cần thử lại." : "Đang thử khôi phục kết nối realtime…"}</span></div>}
    <main className="page-container"><Outlet /></main>
    {!isGame && <nav className="bottom-nav" aria-label="Điều hướng di động"><NavLink to={routes.home}><UiGlyph name="home" /><span>Trang chủ</span></NavLink><NavLink to={routes.history}><UiGlyph name="history" /><span>Lịch sử</span></NavLink><NavLink to={routes.friends}><UiGlyph name="friends" /><span>Bạn bè</span></NavLink><NavLink to={routes.profile}><UiGlyph name="profile" /><span>Hồ sơ</span></NavLink></nav>}
    <Modal open={sessionExpired} title="Phiên đăng nhập đã hết hạn" description="Vui lòng đăng nhập lại để tiếp tục. Các thao tác đang chờ sẽ không được gửi lại tự động." dismissible={false} onClose={() => undefined}><div className="modal-actions"><Button onClick={() => { setSessionExpired(false); navigate(loginReturnPath(location)); }}>Đăng nhập lại</Button></div></Modal>
  </div>;
}
