import { useEffect, useRef, useState } from "react";
import type { MatchPauseReason, MatchStatus } from "@ottv2/contracts";
import FocusTrap from "focus-trap-react";
import { Button } from "../ui";
import { refereePauseCategoryLabels, type RefereePauseCategory } from "./RefereePauseCategories";

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function pauseReasonLabel(reason: MatchPauseReason | null | undefined): string {
  if (reason === "INFRASTRUCTURE") return "Sự cố hệ thống";
  if (reason === "PLAYER_DISCONNECT") return "Người chơi đang kết nối lại";
  return "Trọng tài đã tạm dừng";
}

export function RefereeControlPanel({ status, isReferee, disabled, onStop }: { status: MatchStatus; isReferee: boolean; disabled: boolean; onStop: (category: RefereePauseCategory) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RefereePauseCategory>("TECHNICAL_ISSUE");
  if (!isReferee || (status !== "PLAYING" && status !== "COUNTDOWN" && status !== "RESUMING")) return null;
  return <section className="referee-control-panel" aria-label="Điều khiển trọng tài">
    <div className="referee-control-copy"><span className="eyebrow">TRỌNG TÀI</span><strong>Điều khiển trận đấu</strong><small>Chỉ khóa trận khi cần xử lý sự cố hoặc thắc mắc.</small></div>
    {!open ? <Button variant="danger" className="referee-stop-button" onClick={() => setOpen(true)} disabled={disabled || status === "RESUMING"}>Dừng trận</Button> : <div className="referee-reason-picker" role="radiogroup" aria-label="Lý do dừng trận">
      <p>Chọn nhóm lý do công khai</p>
      {(Object.keys(refereePauseCategoryLabels) as RefereePauseCategory[]).map((value) => <label key={value}><input type="radio" name="referee-pause-category" value={value} checked={category === value} onChange={() => setCategory(value)} />{refereePauseCategoryLabels[value]}</label>)}
      <div className="referee-reason-actions"><Button variant="secondary" onClick={() => setOpen(false)}>Quay lại</Button><Button variant="danger" onClick={() => { setOpen(false); onStop(category); }} disabled={disabled}>Xác nhận dừng</Button></div>
    </div>}
  </section>;
}

export function RefereePauseOverlay({ status, pauseReason, pauseElapsedMs = 0, pausedAt = null, resumeEndsAt = null, isReferee, onResume, onHold }: { status: MatchStatus; pauseReason?: MatchPauseReason | null; pauseElapsedMs?: number; pausedAt?: number | null; resumeEndsAt?: number | null; isReferee: boolean; onResume: () => void; onHold: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const paused = status === "PAUSED";
  const resuming = status === "RESUMING";
  useEffect(() => {
    if (!paused && !resuming) return undefined;
    headingRef.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [paused, resuming]);
  const elapsed = pauseElapsedMs + (pausedAt && paused ? Math.max(0, now - pausedAt) : 0);
  const remaining = resumeEndsAt ? Math.max(0, Math.ceil((resumeEndsAt - now) / 1000)) : 0;
  if (!paused && !resuming) return null;
  const blockedByOtherReason = pauseReason !== undefined && pauseReason !== null && pauseReason !== "REFEREE";
  return <div className="referee-pause-overlay robot-lab-pause-overlay" role="presentation">
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, fallbackFocus: ".referee-pause-dialog" }}>
    <section className="referee-pause-dialog" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="referee-pause-title" aria-describedby="referee-pause-description">
      <span className="referee-pause-beacon" aria-hidden="true" />
      <h2 id="referee-pause-title" tabIndex={-1} ref={headingRef}>{resuming ? "Chuẩn bị tiếp tục" : "Trận đấu đã dừng"}</h2>
      <p id="referee-pause-description">{blockedByOtherReason ? pauseReasonLabel(pauseReason) : "Trọng tài đang xử lý trận đấu."}</p>
      <div className="referee-pause-meta"><span>Thời gian dừng</span><strong>{formatElapsed(elapsed)}</strong></div>
      {resuming ? <><strong className="referee-resume-countdown" aria-live="assertive">Tiếp tục sau {remaining}s</strong>{isReferee && <Button className="referee-resume-button" variant="secondary" onClick={onHold}>Giữ dừng</Button>}</> : isReferee && !blockedByOtherReason ? <Button className="referee-resume-button" onClick={onResume}>Tiếp tục</Button> : <p className="referee-wait-copy">{blockedByOtherReason ? "Đang chờ khôi phục điều kiện liên quan." : "Người chơi và khán giả vui lòng chờ trọng tài."}</p>}
    </section>
    </FocusTrap>
  </div>;
}

