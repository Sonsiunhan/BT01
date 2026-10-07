import { useState } from "react";
import type { MatchSnapshot } from "@ottv2/contracts";
import type { Side } from "@ottv2/game-rules";
import { Button } from "../ui";

export function RefereeReplacementPanel({ match, viewerSide, isCandidate, disabled, onNominate, onApprove, onAccept }: { match: MatchSnapshot; viewerSide: Side | null; isCandidate: boolean; disabled: boolean; onNominate: (targetUserId: string) => void; onApprove: () => void; onAccept: () => void }) {
  const [target, setTarget] = useState("");
  if (match.status !== "PAUSED" || match.refereeConnected !== false || !match.refereeEnabled) return null;
  const candidate = match.replacementCandidateUserId;
  const approvals = match.replacementApprovedByUserIds ?? [];
  const approved = viewerSide ? approvals.includes(match.players.find((player) => player.side === viewerSide)?.userId ?? "") : false;
  return <section className="referee-replacement-panel" aria-label="Khôi phục trọng tài">
    <div><span className="eyebrow">KHÔI PHỤC TRỌNG TÀI</span><h3>Đề cử tài khoản thay thế</h3><p>Chỉ dùng khi trọng tài cũ mất kết nối. Trận vẫn dừng; không tự tiếp tục.</p></div>
    {isCandidate ? <div className="replacement-candidate-action"><strong>Bạn được đề cử làm trọng tài mới.</strong><Button onClick={onAccept} disabled={disabled}>Nhận vai trò Trọng tài</Button></div> : viewerSide !== null && <div className="replacement-player-action">{candidate ? <><p>Ứng viên: <code>{candidate}</code> · đã xác nhận {approvals.length}/2 người chơi.</p><Button variant="secondary" onClick={onApprove} disabled={disabled || approved}>{approved ? "Đã chấp thuận" : "Tôi chấp thuận"}</Button></> : <div className="replacement-nominate-form"><label>Tài khoản đăng nhập<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="user-id" maxLength={120} /></label><Button onClick={() => { const value = target.trim(); if (!value) return; onNominate(value); setTarget(""); }} disabled={disabled || !target.trim()}>Đề cử</Button></div>}</div>}
  </section>;
}
