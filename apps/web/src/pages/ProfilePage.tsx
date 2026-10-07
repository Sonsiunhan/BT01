import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AvatarGlyph, Button, LoadingState, Modal, useToast } from "../components/ui";
import { ProfileForm } from "../components/profile/ProfileForm";
import { RankBadge } from "../components/profile/RankBadge";
import { getMe, getPublicProfile, type AvatarPreset, type PublicProfile, type UserProfile } from "../services/auth/authApi";
import { getGuestProfile, getLocalHistory, type GuestProfile, type LocalHistoryRecord } from "../services/local/localGameStorage";
import { ApiError } from "../services/http/apiError";
import { routes } from "../app/routes";
import { useParams } from "react-router-dom";
import { blockUser, createInvite, sendFriendRequest } from "../services/social/socialApi";
import { loginReturnPath } from "../services/auth/returnUrl";

type ProfileState =
  | { kind: "loading" }
  | { kind: "ready"; profile: UserProfile | PublicProfile; isSelf: boolean }
  | { kind: "guest"; profile: GuestProfile; history: LocalHistoryRecord[] }
  | { kind: "error"; message: string };

export default function ProfilePage() {
  const { notify } = useToast();
  const location = useLocation();
  const { username } = useParams<{ username?: string }>();
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PublicProfile | null>(null);
  const [roomId, setRoomId] = useState("");
  const [actionPending, setActionPending] = useState(false);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    if (username) {
      getPublicProfile(username)
        .then((result) => { if (active) setState({ kind: "ready", profile: result.profile, isSelf: Boolean(result.profile.isSelf) }); })
        .catch((reason) => { if (active) setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải hồ sơ." }); });
    } else {
      getMe()
        .then((result) => { if (active) setState({ kind: "ready", profile: result.user, isSelf: true }); })
        .catch(async (reason) => {
          if (!(reason instanceof ApiError && reason.status === 401)) {
            if (active) setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải hồ sơ." });
            return;
          }
          try {
            const [guestProfile, history] = await Promise.all([getGuestProfile(), getLocalHistory()]);
            if (!guestProfile) throw reason;
            if (active) setState({ kind: "guest", profile: guestProfile, history });
          } catch {
            if (active) setState({ kind: "error", message: reason instanceof ApiError ? reason.message : "Không thể tải hồ sơ." });
          }
        });
    }
    return () => { active = false; };
  }, [username]);
  if (state.kind === "loading") return <LoadingState fullPage label="Đang tải hồ sơ…" />;
  if (state.kind === "error") return <section className="placeholder robot-lab-profile-error"><p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p><h1>Cần đăng nhập</h1><p className="form-intro">{state.message}</p><Link className="button primary" to={loginReturnPath(location)}>Đăng nhập</Link></section>;
  if (state.kind === "guest") return <GuestProfileView profile={state.profile} history={state.history} loginPath={loginReturnPath(location)} />;
  const { profile, isSelf } = state;
  const rankedGames = profile.stats.rankedWins + profile.stats.rankedLosses;
  const winRate = rankedGames === 0 ? 0 : Math.round((profile.stats.rankedWins / rankedGames) * 1000) / 10;
  const publicProfile = isSelf ? null : profile as PublicProfile;
  const botStats = profile.botStats ?? { wins: 0, losses: 0 };
  const runAction = async (action: () => Promise<unknown>, success: string) => { setActionPending(true); try { await action(); notify(success, "success"); if (username) { const result = await getPublicProfile(username); setState({ kind: "ready", profile: result.profile, isSelf: Boolean(result.profile.isSelf) }); } return true; } catch (reason) { notify(reason instanceof ApiError ? reason.message : "Thao tác không thành công.", "error"); return false; } finally { setActionPending(false); } };
  const invite = async () => { if (!publicProfile) return; const normalized = roomId.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(normalized)) { notify("Room ID phải gồm 6 ký tự.", "warning"); return; } if (await runAction(() => createInvite(normalized, publicProfile.userId), "Đã gửi lời mời vào phòng.")) { setInviteOpen(false); setRoomId(""); } };
  const closeEditor = () => { if (!editDirty || window.confirm("Bạn có thay đổi chưa lưu. Đóng mà không lưu?")) setEditing(false); };
 return <><section className="profile-layout robot-lab-profile-shell"><div className="profile-hero"><div className="avatar-frame" aria-hidden="true"><div className="avatar-mark" aria-label={`Avatar ${profile.displayName}`}>{avatarSymbol(profile.avatarPreset)}</div></div><div className="profile-identity"><p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p><h1>{profile.displayName}</h1><p className="profile-handle">@{profile.username}{isSelf && " · " + (profile as UserProfile).fullName}{publicProfile?.presence ? ` · ${presenceLabel(publicProfile.presence)}` : ""}</p><RankBadge elo={profile.stats.elo} /></div>{isSelf ? <Button variant="secondary" onClick={() => setEditing(true)}>Chỉnh sửa hồ sơ</Button> : publicProfile && <div className="profile-actions">{publicProfile.isFriend ? <Button disabled={actionPending || publicProfile.presence === "IN_GAME"} title={publicProfile.presence === "IN_GAME" ? "Người chơi đang ở trong trận." : undefined} onClick={() => setInviteOpen(true)}>Mời chơi</Button> : publicProfile.requestStatus ? <Button disabled>Đang chờ phản hồi</Button> : <Button pending={actionPending} onClick={() => void runAction(() => sendFriendRequest(publicProfile.userId), "Đã gửi lời mời kết bạn.")}>Kết bạn</Button>}<Button variant="danger" disabled={actionPending} onClick={() => setBlockTarget(publicProfile)}>Chặn</Button></div>}</div><div className="stats-grid profile-stats"><div className="stat-card"><span>ĐIỂM ELO RANKED</span><strong>{profile.stats.elo}</strong><small>Chỉ thay đổi ở trận xếp hạng</small></div><div className="stat-card"><span>TRẬN RANKED</span><strong>{rankedGames}</strong><small>{profile.stats.quickWins + profile.stats.quickLosses} trận nhanh</small></div><div className="stat-card"><span>THẮNG RANKED</span><strong>{profile.stats.rankedWins}</strong><small>Trận xếp hạng</small></div><div className="stat-card"><span>THUA RANKED</span><strong>{profile.stats.rankedLosses}</strong><small>Trận xếp hạng</small></div><div className="stat-card"><span>TỶ LỆ THẮNG</span><strong>{winRate}%</strong><small>Ranked</small></div>{publicProfile && <div className="stat-card"><span>BẠN BÈ</span><strong>{publicProfile.friendCount}</strong><small>Kết nối</small></div>}</div><section className="profile-bot-panel" aria-labelledby="bot-profile-title"><div><p className="eyebrow" id="bot-profile-title">ĐẤU BOT · KHÔNG XẾP HẠNG</p><strong>{botStats.wins} thắng · {botStats.losses} thua</strong></div><span>Bot không thay đổi Elo Ranked</span></section>{publicProfile && <div className="profile-note"><strong>Phong độ gần đây</strong><span className="recent-form" aria-label="Năm trận gần nhất">{publicProfile.recentForm.length ? publicProfile.recentForm.map((result, index) => <i className={result.toLowerCase()} key={`${result}-${index}`}>{result === "WIN" ? "T" : "B"}</i>) : "Chưa có trận xếp hạng"}</span></div>}<div className="profile-note"><strong>{isSelf ? "Hồ sơ sẵn sàng" : "Hồ sơ công khai"}</strong><span>{isSelf ? "Thông tin riêng tư chỉ hiển thị cho bạn." : "Theo dõi phong độ và kết nối của người chơi."}</span></div>{isSelf && <div className="profile-note"><strong>Thư viện chiến thuật riêng</strong><span>Mã nguồn và revision Bot chỉ hiển thị cho tài khoản của bạn.</span><Link className="button secondary" to={routes.botWorkbench}>Mở thư viện Bot</Link></div>}</section>{isSelf && <Modal open={editing} title="Chỉnh sửa hồ sơ" description="Avatar và tên hiển thị sẽ được cập nhật trên toàn bộ đấu trường." onClose={closeEditor}><ProfileForm user={profile as UserProfile} onDirtyChange={setEditDirty} onSaved={(user) => { setState({ kind: "ready", profile: user, isSelf: true }); notify("Đã cập nhật hồ sơ.", "success"); setEditing(false); }} /></Modal>}{publicProfile && <Modal open={inviteOpen} title="Mời bạn vào phòng" description={`Mời @${publicProfile.username} vào phòng đang chờ của bạn.`} onClose={() => { setInviteOpen(false); setRoomId(""); }}><div className="form-stack"><label>Mã phòng<input value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase())} maxLength={6} placeholder="ABC234" /></label><div className="modal-actions"><Button variant="secondary" onClick={() => setInviteOpen(false)}>Hủy</Button><Button pending={actionPending} onClick={() => void invite()}>Gửi lời mời</Button></div></div></Modal>}{blockTarget && <Modal open title={`Chặn @${blockTarget.username}?`} description="Người này sẽ không thể gửi lời mời kết bạn, mời vào phòng hoặc xem trạng thái của bạn. Các kết nối hiện tại cũng sẽ bị ngắt và không thể khôi phục tự động." onClose={() => { if (!actionPending) setBlockTarget(null); }}><div className="modal-actions"><Button variant="secondary" disabled={actionPending} onClick={() => setBlockTarget(null)}>Hủy</Button><Button variant="danger" pending={actionPending} onClick={() => void runAction(() => blockUser(blockTarget.userId), `Đã chặn @${blockTarget.username}.`).then((success) => { if (success) setBlockTarget(null); })}>Chặn</Button></div></Modal>}</>;
}

function GuestProfileView({ profile, history, loginPath }: { profile: GuestProfile; history: LocalHistoryRecord[]; loginPath: string }) {
  const wins = history.filter((record) => record.result === "WIN").length;
  const losses = history.filter((record) => record.result === "LOSS").length;
  return <section className="profile-layout guest-profile-layout robot-lab-profile-shell"><div className="profile-hero guest-profile-hero"><div className="avatar-frame" aria-hidden="true"><div className="avatar-mark"><AvatarGlyph preset="robot" size={54} /></div></div><div className="profile-identity"><p className="eyebrow">HỒ SƠ GUEST</p><h1>{profile.displayName}</h1><p className="profile-handle">Hồ sơ Guest trên thiết bị</p></div><Link className="button primary" to={loginPath}>Đăng nhập để đồng bộ</Link></div><div className="stats-grid profile-stats guest-profile-stats"><div className="stat-card"><span>TRẬN LOCAL</span><strong>{history.length}</strong><small>{history.length} ván local</small></div><div className="stat-card"><span>THẮNG</span><strong>{wins}</strong><small>Trên thiết bị</small></div><div className="stat-card"><span>THUA</span><strong>{losses}</strong><small>Trên thiết bị</small></div></div><div className="profile-note"><strong>Lịch sử Guest chỉ lưu trên thiết bị này.</strong><span>Xóa dữ liệu trình duyệt có thể xóa tên Guest và lịch sử local.</span></div></section>;
}

function avatarSymbol(preset: AvatarPreset) { return <AvatarGlyph preset={preset} size={54} />; }
function presenceLabel(presence: PublicProfile["presence"]): string { return presence === "ONLINE" ? "Đang online" : presence === "IN_GAME" ? "Đang chơi" : "Ngoại tuyến"; }
