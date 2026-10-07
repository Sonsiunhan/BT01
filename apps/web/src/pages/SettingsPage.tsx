import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { BlockedUser } from "@ottv2/contracts";
import { Button, LoadingState, Modal, PasswordField, ThemeSwitcher } from "../components/ui";
import { routes } from "../app/routes";
import { changePassword, getMe, updateProfile, type UserProfile } from "../services/auth/authApi";
import { ApiError } from "../services/http/apiError";
import { RobotLabHost } from "../foundation/RobotLabHost";
import { PieceGlyph } from "../components/board/PieceGlyph";
import { applyPresentationPreferences, BGM_KEY, BGM_VOLUME_KEY, COUNTDOWN_SOUND_KEY, MASTER_VOLUME_KEY, notifyAudioPreferenceChanged, readAudioPreference, SFX_KEY, SFX_VOLUME_KEY, SOUND_KEY } from "../services/presentation/preferences";
import { getBlockedUsers, unblockUser } from "../services/social/socialApi";
import { ProfileForm } from "../components/profile/ProfileForm";
import { applyQualityPreference, readQualityPreference, type QualityPreference } from "../foundation/qualityTier";
import { clearLocalData, exportLocalData, getLocalDataSummary, type LocalDataSummary } from "../services/local/localData";
import { clearOfflineKit, getOfflineKitStatus, installOfflineKit, type OfflineKitStatus } from "../services/local/offlineKit";
import { loginReturnPath } from "../services/auth/returnUrl";

type SettingsTab = "account" | "appearance" | "audio" | "privacy" | "blocked" | "diagnostics" | "local-data";
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [{ id: "appearance", label: "Giao diện" }, { id: "audio", label: "Âm thanh" }, { id: "account", label: "Tài khoản" }, { id: "privacy", label: "Riêng tư" }, { id: "blocked", label: "Đã chặn" }, { id: "diagnostics", label: "Chẩn đoán" }, { id: "local-data", label: "Dữ liệu" }];
const isSettingsTab = (value: string | null): value is SettingsTab => settingsTabs.some((tab) => tab.id === value);

function readBoolean(key: string, defaultValue: boolean): boolean {
  return localStorage.getItem(key) === null ? defaultValue : localStorage.getItem(key) !== "off";
}

export default function SettingsPage() {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<UserProfile>();
  const [authResolved, setAuthResolved] = useState(false);
  const [authFailure, setAuthFailure] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCache, setConfirmCache] = useState(false);
  const [kitProgress, setKitProgress] = useState("");
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => isSettingsTab(searchParams.get("tab")) ? searchParams.get("tab") as SettingsTab : "appearance");
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(() => readQualityPreference());
  const [masterSound, setMasterSound] = useState(() => readBoolean(SOUND_KEY, true));
  const [sfxSound, setSfxSound] = useState(() => readBoolean(SFX_KEY, true));
  const [bgmSound, setBgmSound] = useState(() => readBoolean(BGM_KEY, false));
  const [countdownSound, setCountdownSound] = useState(() => readBoolean(COUNTDOWN_SOUND_KEY, true));
  const [masterVolume, setMasterVolume] = useState(() => readAudioPreference(MASTER_VOLUME_KEY, 100));
  const [sfxVolume, setSfxVolume] = useState(() => readAudioPreference(SFX_VOLUME_KEY, 55));
  const [bgmVolume, setBgmVolume] = useState(() => readAudioPreference(BGM_VOLUME_KEY, 30));
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("ottv2:reduced-motion") === "on");
  const [ambientMotion, setAmbientMotion] = useState(() => readBoolean("ottv2:ambient-motion", true));
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [offlineKit, setOfflineKit] = useState<OfflineKitStatus | null>(null);
  const [localSummary, setLocalSummary] = useState<LocalDataSummary | null>(null);
  const [localDataPending, setLocalDataPending] = useState(false);

  useEffect(() => {
    if (isSettingsTab(searchParams.get("tab"))) setActiveTab(searchParams.get("tab") as SettingsTab);
  }, [searchParams]);

  useEffect(() => {
    let live = true;
    setAuthFailure(false);
    getMe().then((result) => {
      if (live) setUser(result.user);
      // Viewing Settings must not overwrite an explicit browser theme choice.
    }).catch((reason) => {
      if (!live || (reason instanceof ApiError && reason.status === 401)) return;
      setAuthFailure(true);
      setError(reason instanceof ApiError ? reason.message : "Không thể tải cài đặt tài khoản.");
    }).finally(() => { if (live) setAuthResolved(true); });
    return () => { live = false; };
  }, [authAttempt]);

  useEffect(() => {
    if (activeTab !== "blocked" || !user) return;
    setBlockedLoading(true);
    getBlockedUsers().then((result) => setBlockedUsers(result.users)).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Không thể tải danh sách đã chặn.")).finally(() => setBlockedLoading(false));
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== "diagnostics") return;
    setOfflineKit(null);
    void getOfflineKitStatus().then(setOfflineKit).catch(() => setError("Không thể đọc trạng thái Offline kit trên thiết bị này."));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "local-data") return;
    setLocalSummary(null);
    void getLocalDataSummary().then(setLocalSummary).catch(() => setError("Không thể đọc dữ liệu cục bộ trên thiết bị này."));
  }, [activeTab]);

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const dirty = Boolean(password.currentPassword || password.newPassword || password.confirmPassword);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (password.newPassword !== password.confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setPending(true);
    try { await changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword }); setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" }); setMessage("Đã đổi mật khẩu. Các phiên khác đã được đăng xuất."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đổi mật khẩu."); }
    finally { setPending(false); }
  };

  const saveTheme = async (theme: "light" | "dark" | "system") => {
    setError(""); setMessage("");
    if (!user) { setMessage("Đã lưu giao diện trên thiết bị này."); return; }
    try { const result = await updateProfile({ theme }); setUser(result.user); setMessage("Đã lưu giao diện."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể đồng bộ giao diện; lựa chọn trên thiết bị vẫn được giữ."); }
  };
  const savePresenceVisibility = async (presenceVisibility: "FRIENDS" | "NOBODY") => {
    setError(""); setMessage(""); setPending(true);
    if (!user) { setPending(false); setMessage("Quyền hiện diện chỉ đồng bộ sau khi đăng nhập."); return; }
    try { const result = await updateProfile({ presenceVisibility }); setUser(result.user); setMessage("Đã lưu quyền riêng tư."); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể lưu quyền riêng tư."); }
    finally { setPending(false); }
  };

  const savePreference = (key: "reduced-motion" | "ambient-motion", value: boolean) => {
    if (key === "reduced-motion") { setReducedMotion(value); localStorage.setItem("ottv2:reduced-motion", value ? "on" : "off"); }
    else { setAmbientMotion(value); localStorage.setItem("ottv2:ambient-motion", value ? "on" : "off"); }
    applyPresentationPreferences();
    setMessage("Đã lưu tuỳ chọn trải nghiệm.");
  };

  const saveAudio = (key: "master" | "sfx" | "bgm" | "countdown" | "master-volume" | "sfx-volume" | "bgm-volume", value: boolean | number) => {
    if (key === "master") { setMasterSound(Boolean(value)); localStorage.setItem(SOUND_KEY, value ? "on" : "off"); }
    else if (key === "sfx") { setSfxSound(Boolean(value)); localStorage.setItem(SFX_KEY, value ? "on" : "off"); }
    else if (key === "bgm") { setBgmSound(Boolean(value)); localStorage.setItem(BGM_KEY, value ? "on" : "off"); }
    else if (key === "countdown") { setCountdownSound(Boolean(value)); localStorage.setItem(COUNTDOWN_SOUND_KEY, value ? "on" : "off"); }
    else if (key === "master-volume") { setMasterVolume(Number(value)); localStorage.setItem(MASTER_VOLUME_KEY, String(value)); }
    else if (key === "sfx-volume") { setSfxVolume(Number(value)); localStorage.setItem(SFX_VOLUME_KEY, String(value)); }
    else { setBgmVolume(Number(value)); localStorage.setItem(BGM_VOLUME_KEY, String(value)); }
    notifyAudioPreferenceChanged();
    setMessage("Đã lưu tuỳ chọn âm thanh.");
  };

  const removeBlock = async (blocked: BlockedUser) => {
    setError(""); setMessage(""); setPending(true);
    try { await unblockUser(blocked.userId); setBlockedUsers((users) => users.filter((user) => user.userId !== blocked.userId)); setMessage(`Đã bỏ chặn @${blocked.username}.`); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Không thể bỏ chặn người chơi."); }
    finally { setPending(false); }
  };

  const refreshLocalSummary = async () => {
    setLocalSummary(await getLocalDataSummary());
  };

  const downloadLocalExport = async () => {
    setLocalDataPending(true); setError(""); setMessage("");
    try {
      const payload = await exportLocalData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `ottv2-local-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click(); URL.revokeObjectURL(url);
      setMessage("Đã xuất dữ liệu chỉ trên thiết bị; dữ liệu tài khoản không nằm trong tệp này.");
    } catch { setError("Không thể xuất dữ liệu trên thiết bị này."); }
    finally { setLocalDataPending(false); }
  };

  const deleteLocalData = async () => {
    setConfirmDelete(false);
    setLocalDataPending(true); setError(""); setMessage("");
    try { await clearLocalData(); await refreshLocalSummary(); setMessage("Đã xóa dữ liệu local trên thiết bị này. Dữ liệu tài khoản vẫn được giữ nguyên."); }
    catch (reason) { setError(reason instanceof Error && "code" in reason && reason.code === "ACTIVE_LOCAL_SESSION" ? "Hãy tạm dừng hoặc kết thúc trận local trước khi xóa dữ liệu." : "Không thể xóa dữ liệu local lúc này."); }
    finally { setLocalDataPending(false); }
  };

  const reloadOfflineKit = async () => {
    setLocalDataPending(true); setError(""); setMessage("");
    setKitProgress("Đang chuẩn bị tải…");
    try { setOfflineKit(await installOfflineKit((done, total) => setKitProgress(`Đã tải ${done}/${total} tệp`))); setMessage("Đã tải Offline kit trên thiết bị này."); }
    catch { setError("Không thể tải Offline kit. Hãy thử lại khi có mạng."); }
    finally { setLocalDataPending(false); setKitProgress(""); }
  };

  const removeOfflineKit = async () => {
    setConfirmCache(false);
    setLocalDataPending(true); setError("");
    try {
      const summary = await getLocalDataSummary();
      if (summary.activeSession) { setError("Hãy tạm dừng hoặc kết thúc trận local trước khi xóa cache Offline."); return; }
      await clearOfflineKit(); setOfflineKit(await getOfflineKitStatus()); setMessage("Đã xóa cache Offline kit; không xóa dữ liệu tài khoản.");
    }
    catch { setError("Không thể xóa cache Offline kit."); }
    finally { setLocalDataPending(false); }
  };

  if (!authResolved) return <LoadingState fullPage label="Đang tải cài đặt…" />;

  return <section className="settings-layout robot-lab-settings-page"><div><p className="eyebrow">CÀI ĐẶT {user ? "TÀI KHOẢN" : "THIẾT BỊ"}</p><h1>Cài đặt</h1><p className="form-intro">{user ? <>Username <strong>{user.username}</strong> là định danh bất biến.</> : "Tuỳ chọn giao diện, hiệu năng và âm thanh được lưu trên thiết bị này."}</p></div><div className="settings-workspace">
    <div className="settings-tabs" role="tablist" aria-label="Nhóm cài đặt">{settingsTabs.map((tab, index) => <button
      ref={(node) => { tabRefs.current[index] = node; }}
      id={`settings-tab-${tab.id}`} className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
      key={tab.id} type="button" role="tab" tabIndex={activeTab === tab.id ? 0 : -1}
      aria-selected={activeTab === tab.id} aria-controls={activeTab === tab.id ? `settings-panel-${tab.id}` : undefined}
      onClick={() => selectTab(tab.id)} onKeyDown={(event) => {
        const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const target = event.key === "Home" ? 0 : event.key === "End" ? settingsTabs.length - 1 : (index + offset + settingsTabs.length) % settingsTabs.length;
        selectTab(settingsTabs[target].id);
        tabRefs.current[target]?.focus();
      }}>{tab.label}</button>)}</div>
    <div className="settings-grid" role="tabpanel" id={`settings-panel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`} tabIndex={0}>
    {activeTab === "account" && <>{user ? <><div className="settings-card"><h2>Hồ sơ</h2><ProfileForm user={user} onSaved={(next) => { setUser(next); setMessage("Đã lưu hồ sơ."); }} /></div><form className="settings-card form-stack" onSubmit={savePassword}><h2>Đổi mật khẩu</h2><label>Mật khẩu hiện tại<input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required /></label><PasswordField label="Mật khẩu mới" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><PasswordField label="Nhập lại mật khẩu mới" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} required autoComplete="new-password" /><Button type="submit" variant="secondary" pending={pending}>Đổi mật khẩu</Button></form></> : <div className="settings-card"><h2>Tài khoản</h2><p className="form-hint">Đăng nhập để chỉnh sửa hồ sơ, đổi mật khẩu và đồng bộ quyền riêng tư.</p><Link className="button primary" to={loginReturnPath(location)}>Đăng nhập</Link></div>}</>}
    {activeTab === "appearance" && <div className="settings-card form-stack"><h2>Giao diện & hiệu năng</h2><p className="form-hint">Thay đổi được áp dụng ngay và lưu trên thiết bị. Bạn có thể đồng bộ lựa chọn với hồ sơ khi đã đăng nhập.</p><ThemeSwitcher expanded onChange={saveTheme} /><label>Chất lượng hiệu ứng<select value={qualityPreference} onChange={(event) => { const next = event.target.value as QualityPreference; setQualityPreference(next); applyQualityPreference(next); setMessage("Đã áp dụng chất lượng hiển thị."); }}><option value="auto">Tự động</option><option value="high">Cao</option><option value="medium">Vừa</option><option value="low">Thấp</option></select></label><label className="check-row"><input type="checkbox" checked={reducedMotion} onChange={(event) => savePreference("reduced-motion", event.target.checked)} /> Giảm chuyển động</label><label className="check-row"><input type="checkbox" checked={ambientMotion} onChange={(event) => savePreference("ambient-motion", event.target.checked)} /> Chuyển động nền</label><p className="form-hint">Giảm chuyển động luôn được ưu tiên; mức Thấp tắt hiệu ứng nặng và chế độ Tự động có thể tự hạ khi thiết bị chậm.</p></div>}
    {activeTab === "appearance" && <aside className="settings-card settings-preview" data-settings-preview="robot-lab">
      <p className="eyebrow">XEM TRƯỚC</p><h2>Robot Lab của bạn</h2>
      <div className="settings-preview-host" aria-hidden="true"><RobotLabHost size={150} /></div>
      <div className="settings-preview-gestures"><PieceGlyph type="R" size={34} /><PieceGlyph type="P" size={34} /><PieceGlyph type="S" size={34} /></div>
      <p>Thẻ nổi khối, chữ rõ và quân găng trắng. Di chuột lên nút để thử phản hồi; nền đứng yên khi không thao tác.</p>
      <Button variant="secondary" onClick={() => setMessage("Phản hồi giao diện đã sẵn sàng.")}>Thử phản hồi</Button>
    </aside>}
    {activeTab === "audio" && <div className="settings-card form-stack"><h2>Âm thanh</h2><label className="check-row"><input type="checkbox" checked={masterSound} onChange={(event) => saveAudio("master", event.target.checked)} /> Master</label><label className="check-row"><input type="checkbox" checked={sfxSound} onChange={(event) => saveAudio("sfx", event.target.checked)} /> Hiệu ứng SFX</label><label className="check-row"><input type="checkbox" checked={bgmSound} onChange={(event) => saveAudio("bgm", event.target.checked)} /> Nhạc nền BGM</label><label className="check-row"><input type="checkbox" checked={countdownSound} onChange={(event) => saveAudio("countdown", event.target.checked)} /> Âm thanh đếm ngược</label><label>Âm lượng master <input type="range" min="0" max="100" value={masterVolume} onChange={(event) => saveAudio("master-volume", Number(event.target.value))} aria-valuetext={`${masterVolume}%`} /></label><label>Âm lượng SFX <input type="range" min="0" max="100" value={sfxVolume} onChange={(event) => saveAudio("sfx-volume", Number(event.target.value))} aria-valuetext={`${sfxVolume}%`} /></label><label>Âm lượng BGM <input type="range" min="0" max="100" value={bgmVolume} onChange={(event) => saveAudio("bgm-volume", Number(event.target.value))} aria-valuetext={`${bgmVolume}%`} /></label><p className="form-hint">Nếu trình duyệt chặn autoplay, âm thanh sẽ im lặng và không ảnh hưởng thao tác.</p></div>}
    {activeTab === "privacy" && <div className="settings-card form-stack"><h2>Quyền riêng tư</h2>{user ? <><label>Trạng thái hiện diện<select value={user.privacy.presenceVisibility} disabled={pending} onChange={(event) => void savePresenceVisibility(event.target.value as "FRIENDS" | "NOBODY")}><option value="FRIENDS">Chỉ bạn bè thấy</option><option value="NOBODY">Ẩn với mọi người</option></select></label><div><strong>Danh sách bạn bè</strong><p className="form-hint">Luôn riêng tư; không có endpoint công khai danh sách bạn bè.</p></div><div><strong>Họ và tên</strong><p className="form-hint">Luôn riêng tư; chỉ hồ sơ của chính bạn nhận được trường này.</p></div></> : <><p className="form-hint">Quyền hiện diện tài khoản cần đăng nhập; các tuỳ chọn thiết bị vẫn dùng được khi offline.</p><Link className="button secondary" to={routes.login}>Đăng nhập để đồng bộ</Link></>}</div>}
    {activeTab === "blocked" && <div className="settings-card form-stack"><h2>Người chơi đã chặn</h2>{user ? <><p className="form-hint">Người bị chặn không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn.</p>{blockedLoading ? <p className="form-hint">Đang tải danh sách…</p> : blockedUsers.length === 0 ? <p className="form-hint">Bạn chưa chặn người chơi nào.</p> : <div className="social-stack">{blockedUsers.map((blocked) => <div className="request-row" key={blocked.userId}><div className="avatar-mark small" aria-hidden="true">{blocked.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{blocked.displayName}</strong><span>@{blocked.username}</span><small>Đã chặn {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(blocked.blockedAt))}</small></div><Button variant="secondary" pending={pending} onClick={() => void removeBlock(blocked)}>Bỏ chặn</Button></div>)}</div>}</> : <><p className="form-hint">Đăng nhập để tải và quản lý danh sách đã chặn.</p><Link className="button secondary" to={routes.login}>Đăng nhập</Link></>}</div>}
    {activeTab === "diagnostics" && <div className="settings-card form-stack settings-diagnostics"><h2>Chẩn đoán thiết bị</h2><p className="form-hint">Thông tin kỹ thuật chỉ dùng để kiểm tra trên thiết bị này; không hiển thị trên Trang chủ hay cho người khác.</p>{offlineKit ? <div className="settings-data-list"><div><strong>Offline kit</strong><span>{offlineKit.message}</span></div><div><strong>Phiên bản runtime</strong><span>{offlineKit.version}</span></div><div><strong>Bộ nhớ cache</strong><span>{offlineKit.cached}/{offlineKit.total} tệp{offlineKit.ready ? " · Sẵn sàng" : " · Chưa đủ"}</span></div></div> : <p className="form-hint">Đang đọc trạng thái Offline kit…</p>}<div className="settings-inline-actions"><Button variant="secondary" pending={localDataPending} onClick={() => void reloadOfflineKit()}>Tải Offline kit</Button><Button variant="ghost" pending={localDataPending} onClick={() => setConfirmCache(true)}>Xóa cache Offline</Button></div><details><summary>Chi tiết kỹ thuật</summary><div className="settings-technical-details"><span>Kết nối: {typeof navigator !== "undefined" && navigator.onLine ? "Có mạng" : "Ngoại tuyến"}</span><span>Service worker: {typeof navigator !== "undefined" && "serviceWorker" in navigator ? "Có hỗ trợ" : "Không hỗ trợ"}</span><span>Cache API: {typeof caches !== "undefined" ? "Có hỗ trợ" : "Không hỗ trợ"}</span></div></details></div>}
    {activeTab === "local-data" && <div className="settings-card form-stack settings-local-data"><h2>Dữ liệu trên thiết bị</h2><p className="form-hint">Các thao tác dưới đây chỉ tác động dữ liệu local của thiết bị này; không xóa hồ sơ, Elo, lịch sử tài khoản hay Bot Library trên máy chủ.</p><ul className="settings-data-list">{[["Guest identity", "Danh tính Guest"], ["Local saves", "Bản lưu local"], ["Local history", "Lịch sử local"], ["Bot Offline library", "Thư viện Bot Offline"], ["Offline cache", "Cache Offline"]].map(([category, label]) => <li key={category}>{label}</li>)}</ul>{localSummary ? <div className="settings-data-counts"><span>Lịch sử local: <strong>{localSummary.counts.history}</strong></span><span>Bản lưu: <strong>{localSummary.counts.saves}</strong></span><span>Bot Offline: <strong>{localSummary.counts.library}</strong></span>{localSummary.activeSession && <span className="form-error">Đang có phiên {localSummary.activeSession.mode}; cần tạm dừng/kết thúc trước khi xóa.</span>}</div> : <p className="form-hint">Đang đọc dữ liệu trên thiết bị…</p>}<div className="settings-inline-actions"><Button variant="secondary" pending={localDataPending} onClick={() => void downloadLocalExport()}>Xuất dữ liệu trên thiết bị</Button><Button variant="danger" pending={localDataPending} onClick={() => setConfirmDelete(true)}>Xóa dữ liệu trên thiết bị</Button></div></div>}
  </div></div>{dirty && <p className="form-hint unsaved-notice" role="status">Bạn có thay đổi chưa lưu. Rời trang có thể làm mất dữ liệu.</p>}{message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {authFailure && <Button variant="secondary" onClick={() => { setError(""); setAuthAttempt((attempt) => attempt + 1); }}>Thử lại tài khoản</Button>}
    <Modal open={confirmDelete} title="Xóa dữ liệu trên thiết bị?" description="Danh tính Guest, bản lưu, lịch sử local, thư viện Bot Offline và cache sẽ bị xóa. Hồ sơ, Elo và dữ liệu tài khoản trên máy chủ không bị xóa." onClose={() => setConfirmDelete(false)}>
      <p>Xuất dữ liệu trước nếu bạn muốn giữ một bản sao. Trận local đang chạy phải được tạm dừng hoặc kết thúc.</p>
      <div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Giữ dữ liệu</Button><Button variant="danger" pending={localDataPending} onClick={() => void deleteLocalData()}>Xác nhận xóa</Button></div>
    </Modal>
    <Modal open={confirmCache} title="Xóa cache Offline?" description="Bạn phải tải lại Offline kit khi có mạng trước khi chạy Bot Offline. File bot và dữ liệu tài khoản được giữ nguyên." onClose={() => setConfirmCache(false)}>
      <div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmCache(false)}>Giữ cache</Button><Button variant="danger" onClick={() => void removeOfflineKit()}>Xác nhận xóa cache</Button></div>
    </Modal>
    {kitProgress && <p className="form-hint" role="status">{kitProgress}</p>}
  </section>;
}
