import { useState, type FormEvent } from "react";
import type { MatchSnapshot, RoomDetail } from "@ottv2/contracts";
import type { Side } from "@ottv2/game-rules";
import { Button, UiGlyph } from "../ui";

export type WaitingRoomProps = {
  match: MatchSnapshot;
  roomMeta?: RoomDetail | null;
  viewerSide: Side | null;
  isRefereeViewer?: boolean;
  spectatorEnabled?: boolean;
  spectatorCount?: number;
  spectatorCapacity?: number | null;
  disabled: boolean;
  copyStatus: "idle" | "copied" | "failed";
  onCopy: () => void;
  onLeave: () => void;
  onReady: () => void;
  onStart?: () => void;
  onInviteReferee?: (targetUserId: string) => Promise<boolean>;
  leavePending: boolean;
};

export function WaitingRoom({ match, roomMeta, viewerSide, isRefereeViewer = false, spectatorEnabled = roomMeta?.spectatorsEnabled ?? false, spectatorCount = roomMeta?.spectators ?? 0, spectatorCapacity = roomMeta?.spectatorCapacity, disabled, copyStatus, onCopy, onLeave, onReady, onStart, onInviteReferee, leavePending }: WaitingRoomProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const playersReady = match.players.length === 2 && match.players.every((player) => player.ready);
  const refereeEnabled = Boolean(match.refereeEnabled || roomMeta?.refereeEnabled);
  const hasReferee = Boolean(match.refereeUserId || roomMeta?.refereeUserId);
  const hostIsPlayer = Boolean(match.hostUserId && match.players.some((player) => player.userId === match.hostUserId));
  const canInviteReferee = refereeEnabled && !hasReferee && hostIsPlayer && viewerSide !== null && match.players.some((player) => player.userId === match.hostUserId && player.side === viewerSide);
  const modeLabel = roomMeta?.playMode === "BOT" ? "ĐẤU CHƯƠNG TRÌNH" : "CHƠI TRỰC TIẾP";
  const visibilityLabel = roomMeta?.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = targetUserId.trim();
    if (!normalized || !onInviteReferee) return;
    const accepted = await onInviteReferee(normalized);
    if (accepted) {
      setTargetUserId("");
      setInviteOpen(false);
    }
  };

  return <section className="waiting-room waiting-visual-grid" aria-labelledby="waiting-room-title">
    <div className="waiting-room-header"><div><p className="eyebrow">PHÒNG CHỜ</p><h2 id="waiting-room-title">Sẵn sàng vào trận</h2><p>{modeLabel} <span aria-hidden="true">•</span> {visibilityLabel} <span aria-hidden="true">•</span> {Math.round(match.timerSeconds / 60)} PHÚT</p></div><button type="button" className="room-code-chip" onClick={onCopy} aria-label={`Sao chép mã phòng ${match.roomId}`}><span>MÃ PHÒNG</span><strong>{match.roomId}</strong><small>{copyStatus === "copied" ? "ĐÃ SAO CHÉP" : copyStatus === "failed" ? "CHỌN ĐỂ SAO CHÉP" : "SAO CHÉP ID"}</small></button></div>
    <div className="waiting-role-strip" aria-label="Vai trò phòng"><span className={`waiting-role-chip ${refereeEnabled ? "active" : ""}`}><UiGlyph name="lock" size={14} /> Trọng tài {refereeEnabled ? "bật" : "tắt"}</span><span className={`waiting-role-chip ${spectatorEnabled ? "active" : ""}`}><UiGlyph name="spectator" size={14} /> Khán giả {spectatorEnabled ? `${spectatorCount}${spectatorCapacity ? ` / ${spectatorCapacity}` : ""}` : "tắt"}</span><span className="waiting-role-note">Chủ phòng chỉ quản lý; không trở thành vai trò thứ tư.</span></div>
    <div className="waiting-slots"><WaitingSlot match={match} side="BLUE" viewerSide={viewerSide} disabled={disabled} onReady={onReady} /><div className="waiting-vs" aria-hidden="true">VS</div><WaitingSlot match={match} side="RED" viewerSide={viewerSide} disabled={disabled} onReady={onReady} /></div>
    {refereeEnabled && <div className={`waiting-referee-slot ${hasReferee ? "assigned" : "unassigned"}`} aria-label="Trọng tài"><div><span className="slot-side">TRỌNG TÀI</span><strong>{hasReferee ? (isRefereeViewer ? "Bạn · Trọng tài" : "Đã chỉ định") : "Chưa có Trọng tài"}</strong><small>{hasReferee ? (match.refereeConnected || roomMeta?.refereeConnected ? "Đang có mặt" : "Đang chờ kết nối") : "Cần tài khoản đăng nhập được chủ phòng mời"}</small></div>{isRefereeViewer && <span className="role-presence connected">ĐANG ĐIỀU HÀNH</span>}{canInviteReferee && onInviteReferee && (inviteOpen ? <form className="waiting-invite-form" onSubmit={(event) => void submitInvite(event)}><label className="visually-hidden" htmlFor="referee-user-id">Mã tài khoản trọng tài</label><input id="referee-user-id" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="Mã tài khoản" required /><Button type="submit" disabled={disabled}>Gửi lời mời</Button><Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Huỷ</Button></form> : <Button type="button" variant="secondary" onClick={() => setInviteOpen(true)} disabled={disabled}>Mời trọng tài</Button>)}</div>}
    {spectatorEnabled && <div className="waiting-spectator-row" aria-label="Khán giả"><span className="slot-side">KHÁN GIẢ</span><strong>{spectatorCount} / {spectatorCapacity ?? "—"}</strong><small>Khán giả chỉ xem bàn cờ canonical Xanh ở dưới.</small></div>}
    {refereeEnabled ? (isRefereeViewer ? <div className="waiting-gate referee-gate" role="status"><strong>{playersReady ? "Cả hai người chơi đã sẵn sàng" : "Chờ hai người chơi Sẵn sàng"}</strong><span>Trọng tài là người duy nhất được phép bắt đầu trận.</span><Button onClick={onStart} disabled={disabled || !playersReady}>Bắt đầu trận</Button></div> : <p className="waiting-hint" role="status">Chờ trọng tài bấm <strong>Bắt đầu</strong> sau khi cả hai người chơi đã sẵn sàng.</p>) : <p className="waiting-hint" role="status">Cả hai người chơi cần Sẵn sàng; trận sẽ tự đếm ngược khi máy chủ xác nhận.</p>}
    <div className="waiting-actions"><Button variant="secondary" onClick={onCopy}>Sao chép ID</Button><Button variant="danger" onClick={onLeave} pending={leavePending} pendingLabel="Đang rời…">Rời phòng</Button></div>
  </section>;
}

function WaitingSlot({ match, side, viewerSide, disabled, onReady }: { match: MatchSnapshot; side: Side; viewerSide: Side | null; disabled: boolean; onReady: () => void }) {
  const player = match.players.find((item) => item.side === side);
  const isMine = viewerSide === side;
  const isHost = Boolean(player && match.hostUserId === player.userId);
  return <article className={`waiting-slot ${side.toLowerCase()} ${player?.ready ? "ready" : ""}`} aria-label={`${side} slot`}><div className="waiting-slot-top"><span className="slot-side">{side === "BLUE" ? "XANH" : "ĐỎ"}</span>{isHost && <span className="host-mark" title="Chủ phòng"><HostMark /><span className="visually-hidden">Chủ phòng</span></span>}</div><div className="slot-avatar" aria-hidden="true">{player ? player.displayName.slice(0, 2).toUpperCase() : "··"}</div><strong>{player?.displayName ?? "Đang chờ người chơi"}</strong><small>{player ? `@${player.username}` : "Slot đang mở"}</small><span className="slot-ready-state">{player?.ready ? "ĐÃ SẴN SÀNG" : "CHƯA SẴN SÀNG"}</span>{isMine && player && <Button onClick={onReady} disabled={disabled}>{player.ready ? "Huỷ sẵn sàng" : "Sẵn sàng"}</Button>}</article>;
}

function HostMark() {
  return <svg viewBox="0 0 32 24" aria-hidden="true"><path d="m2 4 6 5 8-8 8 8 6-5-3 17H5L2 4Z" /><path d="M5 21h22" /></svg>;
}
