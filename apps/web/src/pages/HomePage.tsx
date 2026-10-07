import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { HealthResponse } from "@ottv2/contracts";
import { Button, LoadingState } from "../components/ui";
import { getHealth, isCoreServiceReady } from "../services/health/healthApi";
import { RoomBrowser } from "../components/rooms/RoomBrowser";
import { FriendsPreview } from "../components/social/FriendsPreview";
import { getMe, type UserProfile } from "../services/auth/authApi";
import { routes } from "../app/routes";
import { getRankForElo } from "../foundation/rankConfig";
import { RobotLabHost } from "../foundation/RobotLabHost";
import { readActiveMatchHint, type ActiveMatchHint } from "../services/rooms/activeMatchHint";
import { getGuestProfile } from "../services/local/localGameStorage";

type HealthState = { kind: "loading" } | { kind: "ready"; data: HealthResponse } | { kind: "error" };
type AuthState = { kind: "loading" } | { kind: "guest" } | { kind: "authenticated"; user: UserProfile };
type OnlineMode = "UNRANKED" | "RANKED";
type HomeTab = "DIRECT" | "BOT";

const HOME_ONLINE_MODE_KEY = "ottv2.home.online-mode";
const HOME_TAB_KEY = "ottv2.home.tab";

function readOnlineMode(): OnlineMode | null {
  try {
    const value = window.localStorage.getItem(HOME_ONLINE_MODE_KEY);
    return value === "UNRANKED" || value === "RANKED" ? value : null;
  } catch {
    return null;
  }
}

function readHomeTab(): HomeTab {
  try { return window.localStorage.getItem(HOME_TAB_KEY) === "BOT" ? "BOT" : "DIRECT"; } catch { return "DIRECT"; }
}

function AvatarFrame({ displayName, preset, size = "default" }: { displayName: string; preset?: UserProfile["avatarPreset"]; size?: "default" | "small" }) {
  return <span className={`home-avatar home-avatar-${size} avatar-preset-${preset ?? "guest"}`} aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>;
}

function ProfilePanel({ state }: { state: AuthState }) {
  if (state.kind === "loading") return <aside className="home-panel home-profile-panel" aria-label="Hồ sơ người chơi" aria-busy="true"><LoadingState label="Đang tải hồ sơ…" /></aside>;
  if (state.kind === "guest") return <GuestProfilePanel />;

  const { user } = state;
  const rank = getRankForElo(user.stats.elo);
  return <aside className="home-panel home-profile-panel" aria-label="Hồ sơ người chơi"><div className="home-panel-heading"><p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p><Link className="home-panel-link" to={routes.profile}>Xem hồ sơ</Link></div><div className="home-profile-identity"><AvatarFrame displayName={user.displayName} preset={user.avatarPreset} /><div><h2>{user.displayName}</h2><p>@{user.username}</p></div></div><div className={`rank-badge rank-${rank.color}`} aria-label={`Rank ${rank.name}`}><span className="rank-shield" aria-hidden="true">◆</span><span><strong>{rank.name}</strong><small>RANKED TIER</small></span></div><dl className="home-profile-stats"><div><dt>ELO</dt><dd>{user.stats.elo}</dd></div><div><dt>W</dt><dd>{user.stats.rankedWins}</dd></div><div><dt>L</dt><dd>{user.stats.rankedLosses}</dd></div></dl><Link className="button secondary home-profile-cta" to={routes.profile}>Xem hồ sơ</Link></aside>;
}

function GuestProfilePanel() {
  const [guestName, setGuestName] = useState("Khách đấu trường");
  useEffect(() => { let active = true; void getGuestProfile().then((profile) => { if (active && profile?.displayName) setGuestName(profile.displayName); }).catch(() => undefined); return () => { active = false; }; }, []);
  return <aside className="home-panel home-profile-panel home-profile-guest" aria-label="Hồ sơ người chơi"><p className="eyebrow">HỒ SƠ KHÁCH</p><AvatarFrame displayName={guestName} /><h2>{guestName}</h2><p>Danh tính này được giữ trên thiết bị để bạn chơi thường và vào phòng online.</p><Link className="button primary home-profile-cta" to={routes.login}>ĐĂNG NHẬP ĐỂ XẾP HẠNG</Link><span className="home-profile-note">Guest history chỉ lưu trên thiết bị này.</span></aside>;
}

function ModeCard({ to, label, title, copy, className = "" }: { to: string; label: string; title: string; copy: string; className?: string }) {
  return <Link className={`home-mode-card ${className}`} to={to}><span className="home-mode-mark" aria-hidden="true">{label.slice(0, 1)}</span><span><strong>{title}</strong><small>{copy}</small></span><span className="home-mode-arrow" aria-hidden="true">→</span></Link>;
}

function SystemPulse({ health, onRetry }: { health: HealthState; onRetry: () => void }) {
  const degraded = health.kind === "ready" && !isCoreServiceReady(health.data);
  if (health.kind === "loading" || (health.kind === "ready" && !degraded)) return null;
  return <div className="home-outage-banner" role="status" aria-live="polite"><span className={`status-dot ${health.kind === "error" ? "danger" : "warning"}`} />{health.kind === "error" ? <><strong>Không thể kết nối</strong><span>Thao tác online có thể bị gián đoạn.</span></> : <><strong>Dịch vụ đang chậm</strong><span>Một số thao tác online có thể cần thử lại.</span></>}<Button variant="ghost" onClick={onRetry}>Thử lại</Button></div>;
}

function OnlineMatchPanel({ user, guest }: { user?: UserProfile; guest: boolean }) {
  const [mode, setMode] = useState<OnlineMode>(() => readOnlineMode() ?? "RANKED");
  useEffect(() => {
    if (user) setMode(readOnlineMode() ?? "RANKED");
    else if (guest) setMode("UNRANKED");
  }, [guest, user]);
  const effectiveMode: OnlineMode = user ? mode : "UNRANKED";
  const chooseMode = (next: OnlineMode) => {
    if (next === "RANKED" && !user) return;
    setMode(next);
    try { window.localStorage.setItem(HOME_ONLINE_MODE_KEY, next); } catch { /* storage is an enhancement */ }
  };
  const destination = effectiveMode === "RANKED" ? routes.queue : `${routes.queue}?mode=UNRANKED`;
  return <section className="home-online-panel" aria-labelledby="home-online-title"><div><p className="eyebrow">ONLINE</p><h2 id="home-online-title">TÌM TRẬN</h2><p>Chọn nhịp chơi rồi vào sảnh phù hợp.</p></div><div className="home-online-choice" role="group" aria-label="Chế độ tìm trận"><button className={`home-online-tab ${effectiveMode === "UNRANKED" ? "active" : ""}`} type="button" aria-pressed={effectiveMode === "UNRANKED"} onClick={() => chooseMode("UNRANKED")}>Đấu thường</button><button className={`home-online-tab ${effectiveMode === "RANKED" ? "active" : ""}`} type="button" aria-pressed={effectiveMode === "RANKED"} disabled={!user} title={!user ? "Đăng nhập để chơi Xếp hạng" : undefined} onClick={() => chooseMode("RANKED")}>Xếp hạng</button></div><Link className="home-primary-cta" to={destination}><strong>TÌM TRẬN</strong><small>{effectiveMode === "RANKED" ? "Giữ Elo và rank của bạn" : "Vào phòng online không tính Elo"}</small><span aria-hidden="true">→</span></Link>{!user && <p className="home-online-hint">Xếp hạng dành cho tài khoản đã đăng nhập.</p>}</section>;
}

function BotHeroPanel() {
  return <section className="home-online-panel home-bot-panel" aria-labelledby="home-bot-title"><div><p className="eyebrow">ROBOT LAB</p><h2 id="home-bot-title">ĐẤU CHƯƠNG TRÌNH</h2><p>Đưa chiến thuật của bạn vào phòng đấu hoặc luyện bot trên thiết bị.</p></div><div className="home-bot-actions"><Link className="home-primary-cta" to={routes.botOnline} aria-label="ĐẤU BOT ONLINE"><strong>ĐẤU BOT ONLINE</strong><small>Tìm đối thủ cho chiến thuật</small><span aria-hidden="true">→</span></Link><Link className="button secondary" to={routes.botWorkbench}>XƯỞNG BOT</Link></div></section>;
}

function HomeTabs({ tab, onChange }: { tab: HomeTab; onChange: (next: HomeTab) => void }) {
  const refs = useRef<Record<HomeTab, HTMLButtonElement | null>>({ DIRECT: null, BOT: null });
  const choose = (next: HomeTab) => { onChange(next); window.setTimeout(() => refs.current[next]?.focus(), 0); };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); choose(tab === "DIRECT" ? "BOT" : "DIRECT"); }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); choose(tab === "BOT" ? "DIRECT" : "BOT"); }
    if (event.key === "Home") { event.preventDefault(); choose("DIRECT"); }
    if (event.key === "End") { event.preventDefault(); choose("BOT"); }
  };
  return <div className="home-tab-list" role="tablist" aria-label="Cách chơi"><button ref={(element) => { refs.current.DIRECT = element; }} className={`home-tab ${tab === "DIRECT" ? "active" : ""}`} type="button" role="tab" aria-selected={tab === "DIRECT"} aria-controls="home-panel-direct" tabIndex={tab === "DIRECT" ? 0 : -1} onClick={() => onChange("DIRECT")} onKeyDown={onKeyDown}>Chơi trực tiếp</button><button ref={(element) => { refs.current.BOT = element; }} className={`home-tab ${tab === "BOT" ? "active" : ""}`} type="button" role="tab" aria-selected={tab === "BOT"} aria-controls="home-panel-bot" tabIndex={tab === "BOT" ? 0 : -1} onClick={() => onChange("BOT")} onKeyDown={onKeyDown}>Đấu chương trình</button></div>;
}

function ActiveMatchResume() {
  const [hint, setHint] = useState<ActiveMatchHint | null>(() => readActiveMatchHint());
  useEffect(() => {
    const refresh = () => setHint(readActiveMatchHint());
    window.addEventListener("ottv2:active-match-hint", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("ottv2:active-match-hint", refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (!hint) return null;
  const statusLabel = hint.status === "PAUSED" ? "Đang tạm dừng" : hint.status === "WAITING_READY" ? "Đang chờ sẵn sàng" : "Đang diễn ra";
  return <section className="home-resume-card" aria-label="Trận đang mở"><div><p className="eyebrow">TRẬN ĐANG MỞ</p><strong>Tiếp tục trận đấu</strong><span>Phòng #{hint.roomId} · {statusLabel}</span></div><Link className="button secondary" to={`/game/${encodeURIComponent(hint.roomId)}`}>Mở trận</Link></section>;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<HomeTab>(() => readHomeTab());
  useEffect(() => {
    const controller = new AbortController();
    setHealth({ kind: "loading" });
    getHealth(controller.signal)
      .then((data) => setHealth({ kind: "ready", data }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setHealth({ kind: "error" });
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { let active = true; getMe().then((result) => { if (active) setAuth({ kind: "authenticated", user: result.user }); }).catch(() => { if (active) setAuth({ kind: "guest" }); }); return () => { active = false; }; }, []);

  const user = auth.kind === "authenticated" ? auth.user : undefined;
  const selectTab = (next: HomeTab) => { setTab(next); try { window.localStorage.setItem(HOME_TAB_KEY, next); } catch { /* storage is an enhancement */ } };
  return <div className="home-page home-lobby-page"><div className="home-lobby-grid"><section className="home-lobby-main" aria-label="Khu vực sảnh chính"><section className="home-lobby-hero"><div className="home-hero-copy"><p className="eyebrow">ROBOT LAB</p><h1>Đọc vị.<br /><span>Chiếm bàn.</span></h1><p>{user ? `Chào ${user.displayName}. Bạn đã sẵn sàng CHAN chưa?` : "Chào bạn. Bạn đã sẵn sàng CHAN chưa?"}</p></div><div className="hero-art robot-lab-hero-art"><div className="hero-robot" data-testid="robot-lab-hero-host"><RobotLabHost size={260} /></div></div></section><section className="home-mode-section" aria-labelledby="home-modes-title"><div className="home-section-heading"><div><p className="eyebrow">KHU VỰC CHƠI</p><h2 id="home-modes-title">Chọn cách chơi</h2></div><HomeTabs tab={tab} onChange={selectTab} /></div>{tab === "DIRECT" ? <div id="home-panel-direct" className="home-tab-panel" role="tabpanel"><OnlineMatchPanel user={user} guest={auth.kind === "guest"} /><div className="home-mode-group"><div className="home-mode-grid home-mode-grid-direct"><ModeCard to={routes.ai} label="AI" title="Tập luyện" copy="Đấu với máy · luyện đọc thế cờ" className="mode-ai" /><ModeCard to={routes.offline} label="OF" title="Offline 2P" copy="Hai người · một thiết bị" className="mode-offline" /></div></div></div> : <div id="home-panel-bot" className="home-tab-panel" role="tabpanel"><BotHeroPanel /><div className="home-mode-group"><div className="home-mode-grid home-mode-grid-bot"><ModeCard to={routes.botOnline} label="ON" title="Bot Online" copy="Tìm đối thủ Bot sau khi kiểm tra code" className="mode-bot-online" /><ModeCard to={routes.botOffline} label="OF" title="Bot Offline" copy="Chạy bot đã lưu trên thiết bị" className="mode-bot-offline" /><ModeCard to={routes.botWorkbench} label="LIB" title="Thư viện Bot" copy="Kiểm tra và quản lý chiến thuật" className="mode-workbench" /></div></div></div>}</section><ActiveMatchResume /><SystemPulse health={health} onRetry={() => setAttempt((value) => value + 1)} />{auth.kind === "guest" && <div className="guest-warning home-guest-invite" role="status"><strong>Đang xem với tư cách khách</strong><span>Lịch sử Guest chỉ lưu trên thiết bị này.</span><Link className="button secondary" to={routes.login}>Tạo tài khoản</Link></div>}<div className="home-lobby-support"><RoomBrowser /><FriendsPreview authState={auth.kind} /></div></section><ProfilePanel state={auth} /></div></div>;
}
