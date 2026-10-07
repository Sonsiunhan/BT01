import type { PieceType } from "@ottv2/game-rules";
import fist from "../../assets/pieces/white-glove-fist.png";
import palm from "../../assets/pieces/white-glove-palm.png";
import peace from "../../assets/pieces/white-glove-peace.png";
import fistToken from "../../assets/pieces/white-glove-fist-token.png";
import palmToken from "../../assets/pieces/white-glove-palm-token.png";
import peaceToken from "../../assets/pieces/white-glove-peace-token.png";

const artwork = {
  R: { label: "Đấm", gesture: "fist", image: fist, token: fistToken },
  P: { label: "Bao", gesture: "palm", image: palm, token: palmToken },
  S: { label: "Kéo", gesture: "peace", image: peace, token: peaceToken },
};

/** Frozen original demo rendering; no OS emoji or recoloring at runtime. */
export function RobotLabPieceGlyph({ type, size = 28, token = false }: { type: PieceType; size?: number; token?: boolean }) {
  const item = artwork[type];
  return <img className="piece-glyph robot-lab-reference-gesture" data-glyph={type}
    data-gesture={item.gesture} data-piece-style="white-glove" data-artwork="robot-lab-demo"
    data-token={token} src={token ? item.token : item.image} width={size} height={size}
    alt={item.label} draggable={false} />;
}
