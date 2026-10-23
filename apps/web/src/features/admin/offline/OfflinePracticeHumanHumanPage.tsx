import { useState } from "react";
import { Link } from "react-router-dom";
import {
  applyMove,
  createInitialState,
  type Coordinate,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import { routes } from "../../../app/routes";
import { GameBoard } from "../../../components/board/GameBoard";

export default function OfflinePracticeHumanHumanPage() {
  const [state, setState] = useState<RuleState>(() => createInitialState());
  const [error, setError] = useState<string | null>(null);
  const [flipBoard, setFlipBoard] = useState(false);

  const handleMove = (from: Coordinate, to: Coordinate) => {
    if (state.status !== "PLAYING" || !state.currentTurn) return;

    const currentTurn = state.currentTurn;
    const nextResult = applyMove(state, {
      side: currentTurn,
      from,
      to,
    });

    if (nextResult.kind === "accepted") {
      setError(null);
      setState(nextResult.state);
    } else {
      setError("Nước đi không hợp lệ theo luật chơi");
    }
  };

  const handleReset = () => {
    setState(createInitialState());
    setError(null);
  };

  // Determine viewing side
  const viewSide: Side = flipBoard && state.currentTurn ? state.currentTurn : "BLUE";

  return (
    <div className="admin-page-container" style={{ padding: "2rem 1.5rem", maxWidth: "960px", margin: "0 auto" }}>
      {/* Navigation */}
      <nav aria-label="Đường dẫn điều hướng" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <Link to={routes.adminOffline} style={{ color: "var(--primary)", textDecoration: "none" }}>
            Hub công cụ Offline
          </Link>
          <span style={{ color: "var(--muted)" }}>/</span>
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>Phòng tập Người – Người</span>
        </div>
      </nav>

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.25rem 0", color: "var(--foreground)" }}>
            Phòng tập Người – Người (Pass & Play)
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.875rem" }}>
            Hai người chơi đối kháng trực tiếp trên cùng một màn hình thiết bị. Không cần mạng.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => setFlipBoard(!flipBoard)}
            style={{ padding: "0.45rem 0.85rem", borderRadius: "0.375rem" }}
          >
            {flipBoard ? "Góc nhìn: Theo lượt" : "Góc nhìn: Cố định Xanh"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={handleReset}
            style={{ padding: "0.45rem 0.85rem", borderRadius: "0.375rem" }}
          >
            Ván mới
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          style={{
            background: "color-mix(in srgb, var(--danger, #ef4444) 12%, transparent)",
            border: "1px solid var(--danger, #ef4444)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            color: "var(--danger, #ef4444)",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Match HUD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "1rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>XANH (PLAYER 1)</span>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>Người chơi 1</div>
          <div style={{ fontSize: "0.8rem", color: state.currentTurn === "BLUE" ? "var(--primary)" : "var(--muted)" }}>
            {state.currentTurn === "BLUE" && state.status === "PLAYING" ? "● Đang đến lượt" : "Chờ"}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Trạng thái</div>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--foreground)" }}>
            {state.status === "FINISHED"
              ? state.winner === "BLUE"
                ? "Xanh thắng!"
                : state.winner === "RED"
                ? "Đỏ thắng!"
                : "Hòa cờ"
              : state.currentTurn === "BLUE"
              ? "Lượt của Xanh"
              : "Lượt của Đỏ"}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger, #ef4444)" }}>ĐỎ (PLAYER 2)</span>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>Người chơi 2</div>
          <div style={{ fontSize: "0.8rem", color: state.currentTurn === "RED" ? "var(--danger, #ef4444)" : "var(--muted)" }}>
            {state.currentTurn === "RED" && state.status === "PLAYING" ? "● Đang đến lượt" : "Chờ"}
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <GameBoard
          state={state}
          viewSide={viewSide}
          interactionSide={state.status === "PLAYING" ? state.currentTurn : null}
          onMove={handleMove}
          disabled={state.status !== "PLAYING"}
        />
      </div>
    </div>
  );
}
