import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  applyMove,
  createInitialState,
  type Coordinate,
  type RuleState,
} from "@ottv2/game-rules";
import { createBotTurnState, type BotMoveRecord } from "@ottv2/bot-sdk";
import { routes } from "../../../app/routes";
import { GameBoard } from "../../../components/board/GameBoard";
import { runOfflineBotTurn } from "../../../services/bot-offline/botOfflineRunner";

const SAMPLE_PYTHON_BOT = `def choose_move(state, memory):
    moves = state['legal_moves']
    return moves[0], memory
`;

export default function OfflinePracticeHumanBotPage() {
  const [state, setState] = useState<RuleState>(() => createInitialState());
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botSource] = useState<string>(SAMPLE_PYTHON_BOT);
  const [botMemory, setBotMemory] = useState<unknown>(null);
  const historyRef = useRef<BotMoveRecord[]>([]);

  // When turn is RED (Bot), execute bot move in sandbox
  useEffect(() => {
    if (state.status !== "PLAYING" || state.currentTurn !== "RED") return;

    let cancelled = false;
    setThinking(true);
    setError(null);

    const abortController = new AbortController();

    async function executeBot() {
      try {
        const turnState = createBotTurnState(
          state,
          "RED",
          historyRef.current,
          { BLUE: 60000, RED: 60000 },
          historyRef.current.length + 1
        );

        const result = await runOfflineBotTurn({
          source: botSource,
          state: turnState,
          memory: botMemory,
          signal: abortController.signal,
        });

        if (cancelled) return;

        setBotMemory(result.memory);
        const applied = applyMove(state, {
          side: "RED",
          from: result.move.from as Coordinate,
          to: result.move.to as Coordinate,
        });

        if (applied.kind === "accepted") {
          historyRef.current.push({
            side: "RED",
            from: result.move.from as Coordinate,
            to: result.move.to as Coordinate,
            captured: null,
          });
          setState(applied.state);
        } else {
          setError(`Nước đi của Bot không hợp lệ: ${applied.error}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `Lỗi Bot: ${err.message}`
              : "Bot gặp lỗi trong quá trình tính toán"
          );
        }
      } finally {
        if (!cancelled) {
          setThinking(false);
        }
      }
    }

    // Small delay to simulate thinking feel and not block UI
    const timer = setTimeout(() => {
      void executeBot();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      abortController.abort();
    };
  }, [state, botSource, botMemory]);

  const handlePlayerMove = (from: Coordinate, to: Coordinate) => {
    if (state.status !== "PLAYING" || state.currentTurn !== "BLUE" || thinking) return;

    const nextResult = applyMove(state, {
      side: "BLUE",
      from,
      to,
    });

    if (nextResult.kind === "accepted") {
      historyRef.current.push({
        side: "BLUE",
        from,
        to,
        captured: null,
      });

      setState(nextResult.state);
    } else {
      setError("Nước đi không hợp lệ theo luật chơi");
    }
  };

  const handleReset = () => {
    setState(createInitialState());
    historyRef.current = [];
    setBotMemory(null);
    setError(null);
    setThinking(false);
  };

  return (
    <div className="admin-page-container" style={{ padding: "2rem 1.5rem", maxWidth: "960px", margin: "0 auto" }}>
      {/* Navigation */}
      <nav aria-label="Đường dẫn điều hướng" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <Link to={routes.adminOffline} style={{ color: "var(--primary)", textDecoration: "none" }}>
            Hub công cụ Offline
          </Link>
          <span style={{ color: "var(--muted)" }}>/</span>
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>Phòng tập Người – Bot</span>
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
            Phòng tập Người – Bot (Offline)
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.875rem" }}>
            Luyện tập cờ trực tiếp với Bot Python trong Web Worker cô lập. Không cần kết nối mạng.
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={handleReset}
          style={{ padding: "0.45rem 0.85rem", borderRadius: "0.375rem" }}
        >
          Ván mới
        </button>
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
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>XANH (BẠN)</span>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>Người chơi</div>
          <div style={{ fontSize: "0.8rem", color: state.currentTurn === "BLUE" ? "var(--primary)" : "var(--muted)" }}>
            {state.currentTurn === "BLUE" && state.status === "PLAYING" ? "● Đang đến lượt" : "Chờ"}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Trạng thái</div>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--foreground)" }}>
            {state.status === "FINISHED"
              ? state.winner === "BLUE"
                ? "Bạn thắng!"
                : state.winner === "RED"
                ? "Bot thắng!"
                : "Hòa cờ"
              : thinking
              ? "Bot đang tính..."
              : state.currentTurn === "BLUE"
              ? "Lượt của bạn"
              : "Lượt của Bot"}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger, #ef4444)" }}>ĐỎ (BOT)</span>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>Python Bot</div>
          <div style={{ fontSize: "0.8rem", color: state.currentTurn === "RED" ? "var(--danger, #ef4444)" : "var(--muted)" }}>
            {state.currentTurn === "RED" && state.status === "PLAYING" ? (thinking ? "Đang suy nghĩ..." : "● Đang đến lượt") : "Chờ"}
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
          viewSide="BLUE"
          interactionSide={state.status === "PLAYING" && state.currentTurn === "BLUE" && !thinking ? "BLUE" : null}
          onMove={handlePlayerMove}
          disabled={state.status !== "PLAYING" || state.currentTurn !== "BLUE" || thinking}
          thinkingSide={thinking ? "RED" : null}
        />
      </div>
    </div>
  );
}
