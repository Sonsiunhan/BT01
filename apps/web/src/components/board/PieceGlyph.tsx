import type { PieceType } from "@ottv2/game-rules";
import { RobotLabPieceGlyph } from "./RobotLabPieceGlyph";

/** One reference artwork set for boards, replays, thumbnails and legends. */
export function PieceGlyph({ type, size = 28, token = false }: { type: PieceType; size?: number; token?: boolean }) {
  return <RobotLabPieceGlyph type={type} size={size} token={token} />;
}
