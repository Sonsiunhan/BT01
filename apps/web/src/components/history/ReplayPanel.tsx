import { useEffect, useMemo, useState } from "react";
import { applyMove, createInitialState, type Coordinate, type RuleState } from "@ottv2/game-rules";
import type { HistoryMatchCard, HistoryReplay } from "@ottv2/contracts";

import { Button } from "../ui";
import { GameBoard } from "../board";

type ReplayPanelProps = { replay: HistoryReplay; finalBoard: HistoryMatchCard["finalBoard"] };

function buildFrames(replay: HistoryReplay): RuleState[] {
  const frames: RuleState[] = [createInitialState()];
  let current = frames[0];
  for (const move of replay.moves) {
    const result = applyMove(current, { side: move.side, from: move.from as Coordinate, to: move.to as Coordinate });
    if (result.kind !== "accepted") break;
    current = result.state;
    frames.push(current);
  }
  return frames;
}

export function ReplayPanel({ replay, finalBoard }: ReplayPanelProps) {
  const frames = useMemo(() => replay.available ? buildFrames(replay) : [], [replay]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { setIndex(0); setPlaying(false); }, [replay]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [frames.length, playing]);

  if (!replay.available || frames.length < 2) {
    return <section className="history-replay history-replay-fallback robot-lab-replay-panel" aria-label="Replay trận đấu">
      <div><p className="eyebrow">REPLAY</p><h3>Chỉ còn vị trí cuối</h3><p>Bản lưu cũ chỉ có vị trí cuối, không thể dựng lại các nước đi mà không bịa dữ liệu.</p></div>
      {finalBoard ? <p className="history-replay-fallback-note">Đã giữ thumbnail cuối trận ở phía trên.</p> : null}
    </section>;
  }

  const state = frames[index] ?? frames[0];
  return <section className="history-replay robot-lab-replay-panel" aria-label="Replay trận đấu">
    <div className="history-replay-heading"><div><p className="eyebrow">REPLAY · CHỈ XEM</p><h3>Diễn biến từng nước</h3><p className="history-replay-orientation">Bàn cờ cố định, canonical Xanh ở dưới.</p></div><strong>Nước {index}/{frames.length - 1}</strong></div>
    <GameBoard state={state} viewSide="BLUE" interactionSide={null} disabled />
    <div className="history-replay-controls" aria-label="Điều khiển replay">
      <Button onClick={() => setPlaying((value) => !value)}>{playing ? "Tạm dừng" : "Phát"}</Button>
      <Button variant="secondary" onClick={() => setIndex((value) => Math.min(frames.length - 1, value + 1))} disabled={index >= frames.length - 1}>Từng nước</Button>
      <Button variant="secondary" onClick={() => { setPlaying(false); setIndex(0); }} disabled={index === 0}>Về đầu</Button>
    </div>
    <ol className="history-replay-timeline" aria-label="Mốc diễn biến">{replay.timeline.map((event) => <li key={`${event.sequence}-${event.type}`}><span>{event.sequence}</span><strong>{formatTimeline(event)}</strong><small>{event.reason ?? ""}</small></li>)}</ol>
  </section>;
}

function formatTimeline(event: HistoryReplay["timeline"][number]): string {
  if (event.type === "BOT_REVISION_APPLIED") return `Bot đổi revision #${event.revisionNumber ?? "?"}`;
  return ({ MATCH_STARTED: "Bắt đầu", PIECE_MOVE_ACCEPTED: "Nước đi", MATCH_PAUSED: "Trọng tài dừng", MATCH_RESUMED: "Tiếp tục", REFEREE_REPLACED: "Đổi trọng tài", BOT_REVISION_APPLIED: "Bot đổi revision", MATCH_FINISHED: "Kết thúc", MATCH_ABORTED: "Gián đoạn" } as const)[event.type];
}
