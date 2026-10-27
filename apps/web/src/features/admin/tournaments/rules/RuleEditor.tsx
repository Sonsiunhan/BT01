import React, { useState } from "react";
import type {
  TournamentRuleGoalProfile,
  TournamentRuleMovementPattern,
} from "@ottv2/contracts";
import { Button } from "../../../../components/ui/Button";
import { MOVEMENT_PRESETS, type MovementPresetId } from "./ruleEditorDefaults";
import type { RuleEditorError, RuleEditorPieceType, RuleEditorProps, RuleEditorSide } from "./ruleEditorTypes";

const SIDES: readonly RuleEditorSide[] = ["BLUE", "RED"];
const PIECES: readonly RuleEditorPieceType[] = ["R", "P", "S"];
const PIECE_LABELS: Record<RuleEditorPieceType, string> = { R: "Rook", P: "Pawn", S: "Scout" };
const SIDE_LABELS: Record<RuleEditorSide, string> = { BLUE: "Xanh", RED: "Đỏ" };

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  border: "1px solid color-mix(in srgb, var(--system-cyan) 25%, var(--border))",
  borderRadius: "var(--radius-md)",
  background: "var(--surface)",
};

const fieldStyle: React.CSSProperties = { display: "grid", gap: "0.35rem" };
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" };
const inputStyle: React.CSSProperties = {
  minHeight: "2.35rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-raised)",
  color: "var(--text)",
  padding: "0.45rem 0.6rem",
  font: "inherit",
};

function clonePreset(id: MovementPresetId): TournamentRuleMovementPattern {
  const pattern = MOVEMENT_PRESETS[id];
  return pattern.kind === "RAY"
    ? { ...pattern, directions: pattern.directions.map((direction) => ({ ...direction })) }
    : { ...pattern, offsets: pattern.offsets.map((offset) => ({ ...offset })) };
}

function patternPreset(pattern: TournamentRuleMovementPattern | undefined): MovementPresetId {
  if (pattern?.kind === "LEAP") return "KNIGHT_LEAP";
  if (pattern?.kind === "RAY") {
    const directions = pattern.directions.map(({ fileDelta, rankDelta }) => `${fileDelta},${rankDelta}`).sort().join(";");
    if (directions === "-1,-1;-1,1;1,-1;1,1") return "DIAGONAL_RAY";
  }
  return "ORTHOGONAL_RAY";
}

function isGoalEnabled(value: RuleEditorProps["value"]): boolean {
  return value.profile.winConditions.includes("GOAL_REACHED");
}

function goalMode(goal: TournamentRuleGoalProfile | undefined): "NONE" | TournamentRuleGoalProfile["mode"] {
  return goal?.mode ?? "NONE";
}

function goalFallback(side: RuleEditorSide): string {
  return side === "BLUE" ? "a5" : "e1";
}

function validCoordinate(value: string): boolean {
  return /^[a-o](?:[1-9]|1[0-5])$/.test(value);
}

function localError(errors: readonly RuleEditorError[], paths: readonly string[]): RuleEditorError | undefined {
  return errors.find((error) => paths.includes(error.path));
}

function fieldError(errors: readonly RuleEditorError[], paths: readonly string[]) {
  const error = localError(errors, paths);
  return error ? <span role="alert" style={{ color: "var(--danger)", fontSize: "0.76rem" }}>{error.message}</span> : null;
}

function copyValue<T>(value: T): T {
  return structuredClone(value);
}

export function RuleEditor({
  value,
  onChange,
  errors = [],
  previewRequest = null,
  onPreviewRequestChange,
  disabled = false,
}: RuleEditorProps) {
  // Keep the text being edited separate from the normalized profile. A user must
  // be able to clear "a5" and type a replacement; validation belongs at blur/
  // preview time, not in an onChange handler that restores the old value.
  const [goalDraftValues, setGoalDraftValues] = useState<Partial<Record<RuleEditorSide, string>>>({});

  const goalText = (side: RuleEditorSide, goal: TournamentRuleGoalProfile | undefined): string => {
    const draft = goalDraftValues[side];
    if (draft !== undefined) return draft;
    if (!goal) return "";
    return goal.mode === "STATIC"
      ? goal.cell
      : goal.mode === "CYCLE"
        ? goal.cells.join(", ")
        : goal.mode === "SEEDED"
          ? goal.candidateCells.join(", ")
          : "";
  };

  const restoreGoalDraft = (side: RuleEditorSide, goal: TournamentRuleGoalProfile | undefined) => {
    setGoalDraftValues((current) => {
      const next = { ...current };
      delete next[side];
      return next;
    });
    void goal;
  };
  const updateProfile = (patch: Partial<RuleEditorProps["value"]["profile"]>) => {
    onChange({ ...copyValue(value), profile: { ...copyValue(value.profile), ...patch } });
  };

  const updateMovement = (side: RuleEditorSide, piece: RuleEditorPieceType, preset: MovementPresetId) => {
    const movementProfiles = copyValue(value.profile.movementProfiles);
    movementProfiles[side][piece] = [clonePreset(preset)];
    onChange({ ...copyValue(value), profile: { ...copyValue(value.profile), movementProfiles } });
  };

  const updateGoal = (side: RuleEditorSide, nextMode: "NONE" | "STATIC" | "CYCLE" | "SEEDED") => {
    const goalProfiles = copyValue(value.profile.goalProfiles ?? {});
    if (nextMode === "NONE") {
      delete goalProfiles[side];
    } else if (nextMode === "STATIC") {
      goalProfiles[side] = { mode: "STATIC", cell: goalFallback(side) };
    } else if (nextMode === "CYCLE") {
      goalProfiles[side] = { mode: "CYCLE", cells: [goalFallback(side)], roundInterval: 1 };
    } else {
      goalProfiles[side] = {
        mode: "SEEDED",
        candidateCells: [goalFallback(side)],
        roundInterval: 1,
        policyVersion: "goal-prng-v1",
      };
    }
    setGoalDraftValues((current) => ({ ...current, [side]: nextMode === "STATIC" ? goalFallback(side) : nextMode === "NONE" ? "" : `${goalFallback(side)}` }));
    updateProfile({ goalProfiles });
  };

  const updateGoalCoordinate = (side: RuleEditorSide, coordinate: string) => {
    setGoalDraftValues((current) => ({ ...current, [side]: coordinate }));
    const goal = value.profile.goalProfiles?.[side];
    if (!goal || goal.mode !== "STATIC") return;
    if (coordinate !== "" && !validCoordinate(coordinate)) return;
    updateProfile({ goalProfiles: { ...value.profile.goalProfiles, [side]: { ...goal, cell: coordinate } } });
  };

  const updateGoalCells = (side: RuleEditorSide, raw: string) => {
    setGoalDraftValues((current) => ({ ...current, [side]: raw }));
    const parts = raw.split(",").map((cell) => cell.trim());
    const cells = parts.filter(Boolean);
    const goal = value.profile.goalProfiles?.[side];
    if (!goal || (goal.mode !== "CYCLE" && goal.mode !== "SEEDED") || parts.some((cell) => cell !== "" && !validCoordinate(cell)) || cells.length === 0) return;
    const nextGoal = goal.mode === "CYCLE" ? { ...goal, cells } : { ...goal, candidateCells: cells };
    updateProfile({ goalProfiles: { ...value.profile.goalProfiles, [side]: nextGoal } });
  };

  const updateGoalInterval = (side: RuleEditorSide, raw: string) => {
    const interval = Number(raw);
    const goal = value.profile.goalProfiles?.[side];
    if (!Number.isInteger(interval) || interval < 1 || !goal || (goal.mode !== "CYCLE" && goal.mode !== "SEEDED")) return;
    updateProfile({ goalProfiles: { ...value.profile.goalProfiles, [side]: { ...goal, roundInterval: interval } } });
  };

  const toggleWinCondition = (condition: "EXTINCTION" | "GOAL_REACHED", enabled: boolean) => {
    const winConditions = value.profile.winConditions.filter((item) => item !== condition);
    if (enabled) winConditions.push(condition);
    updateProfile({ winConditions });
  };

  const handlePreview = () => {
    if (previewRequest && onPreviewRequestChange) {
      onPreviewRequestChange({ ...previewRequest, profile: copyValue(value) });
    }
  };

  return (
    <section aria-labelledby="rule-editor-title" data-testid="rule-editor" style={{ display: "grid", gap: "1rem" }}>
      <header style={panelStyle}>
        <div>
          <span style={{ color: "var(--system-cyan)", fontFamily: "var(--font-data)", fontSize: "0.72rem" }}>P04 // RULE EDITOR V1</span>
          <h2 id="rule-editor-title" style={{ margin: "0.25rem 0 0", fontSize: "1.25rem" }}>Cấu hình luật thi đấu</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.84rem" }}>Chọn movement và goal. Server sẽ kiểm tra luật thật khi xem preview.</p>
        </div>
        {errors.length > 0 && (
          <div role="alert" data-testid="rule-editor-error-summary" style={{ padding: "0.65rem 0.75rem", borderRadius: "var(--radius-sm)", background: "color-mix(in srgb, var(--danger) 12%, var(--surface))", color: "var(--danger)" }}>
            <strong>Cần kiểm tra {errors.length} mục</strong>
            <ul style={{ margin: "0.35rem 0 0 1.1rem", padding: 0 }}>
              {errors.map((error) => <li key={`${error.path}-${error.message}`}>{error.message}</li>)}
            </ul>
          </div>
        )}
      </header>

      <div style={{ ...panelStyle, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Phiên bản luật</span>
          <input aria-label="Phiên bản luật" style={inputStyle} value={value.profile.version} disabled={disabled} onChange={(event) => updateProfile({ version: event.target.value })} />
          {fieldError(errors, ["profile.profile.version", "profile.version"])}
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Số hàng bàn</span>
          <input aria-label="Số hàng bàn" type="number" min={5} max={15} style={inputStyle} value={value.profile.board.rows} disabled={disabled} onChange={(event) => updateProfile({ board: { ...value.profile.board, rows: Number(event.target.value) } })} />
          {fieldError(errors, ["profile.board.rows", "board.rows"])}
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Số cột bàn</span>
          <input aria-label="Số cột bàn" type="number" min={5} max={15} style={inputStyle} value={value.profile.board.cols} disabled={disabled} onChange={(event) => updateProfile({ board: { ...value.profile.board, cols: Number(event.target.value) } })} />
          {fieldError(errors, ["profile.board.cols", "board.cols"])}
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Bên đi trước</span>
          <select aria-label="Bên đi trước" style={inputStyle} value={value.profile.initialTurn} disabled={disabled} onChange={(event) => updateProfile({ initialTurn: event.target.value as RuleEditorSide })}>
            <option value="BLUE">Xanh</option>
            <option value="RED">Đỏ</option>
          </select>
        </label>
        <label style={{ ...fieldStyle, alignContent: "center" }}>
          <span style={labelStyle}>Movement đối xứng</span>
          <span><input type="checkbox" checked={value.sameMovementForBothSides} disabled={disabled} onChange={(event) => onChange({ ...copyValue(value), sameMovementForBothSides: event.target.checked })} /> Dùng cấu hình Xanh cho cả hai bên</span>
        </label>
      </div>

      <fieldset style={{ ...panelStyle, border: "none" }}>
        <legend style={{ ...labelStyle, padding: 0 }}>Điều kiện kết thúc</legend>
        <label><input type="checkbox" checked={value.profile.winConditions.includes("EXTINCTION")} disabled={disabled} onChange={(event) => toggleWinCondition("EXTINCTION", event.target.checked)} /> Hạ hết quân đối thủ</label>
        <label><input type="checkbox" checked={isGoalEnabled(value)} disabled={disabled} onChange={(event) => toggleWinCondition("GOAL_REACHED", event.target.checked)} /> Chạm ô đích</label>
        {fieldError(errors, ["winConditions", "profile.winConditions"])}
      </fieldset>

      {SIDES.map((side) => (
        <section key={side} aria-labelledby={`movement-${side}`} style={panelStyle}>
          <div>
            <h3 id={`movement-${side}`} style={{ margin: 0, fontSize: "1rem" }}>Movement — bên {SIDE_LABELS[side]}</h3>
            <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.78rem" }}>Chọn mẫu di chuyển được gửi nguyên vẹn cho engine.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
            {PIECES.map((piece) => {
              const pattern = value.profile.movementProfiles[side][piece][0];
              return (
                <label key={piece} style={fieldStyle}>
                  <span style={labelStyle}>{PIECE_LABELS[piece]} ({piece})</span>
                  <select aria-label={`Movement ${SIDE_LABELS[side]} ${piece}`} style={inputStyle} value={patternPreset(pattern)} disabled={disabled} onChange={(event) => updateMovement(side, piece, event.target.value as MovementPresetId)}>
                    <option value="ORTHOGONAL_RAY">Ray ngang/dọc</option>
                    <option value="DIAGONAL_RAY">Ray chéo</option>
                    <option value="KNIGHT_LEAP">Leap 2–1</option>
                  </select>
                  {fieldError(errors, [`profile.movementProfiles.${side}.${piece}`, `movementProfiles.${side}.${piece}`])}
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <section style={panelStyle} aria-labelledby="goal-editor-title">
        <div>
          <h3 id="goal-editor-title" style={{ margin: 0, fontSize: "1rem" }}>Goal profile</h3>
          <p style={{ margin: "0.2rem 0 0", color: "var(--text-secondary)", fontSize: "0.78rem" }}>Goal chỉ có hiệu lực khi điều kiện “Chạm ô đích” được bật.</p>
        </div>
        {SIDES.map((side) => {
          const goal = value.profile.goalProfiles?.[side];
          const mode = goalMode(goal);
          return (
            <div key={side} style={{ display: "grid", gap: "0.65rem", paddingTop: "0.65rem", borderTop: "1px solid var(--border)" }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Đích bên {SIDE_LABELS[side]}</span>
                <select aria-label={`Goal mode ${SIDE_LABELS[side]}`} style={inputStyle} value={mode} disabled={disabled || !isGoalEnabled(value)} onChange={(event) => updateGoal(side, event.target.value as "NONE" | "STATIC" | "CYCLE" | "SEEDED")}>
                  <option value="NONE">Không dùng</option>
                  <option value="STATIC">Tĩnh</option>
                  <option value="CYCLE">Chu kỳ</option>
                  <option value="SEEDED">Theo seed</option>
                </select>
              </label>
              {mode === "STATIC" && goal?.mode === "STATIC" && (
                <label style={fieldStyle}>
                  <span style={labelStyle}>Ô đích</span>
                  <input aria-label={`Ô đích ${SIDE_LABELS[side]}`} style={inputStyle} value={goalText(side, goal)} disabled={disabled || !isGoalEnabled(value)} onChange={(event) => updateGoalCoordinate(side, event.target.value.trim().toLowerCase())} onBlur={() => restoreGoalDraft(side, goal)} />
                  {fieldError(errors, [`profile.goalProfiles.${side}`, `goalProfiles.${side}`])}
                </label>
              )}
              {(mode === "CYCLE" || mode === "SEEDED") && goal && (goal.mode === "CYCLE" || goal.mode === "SEEDED") && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px", gap: "0.65rem" }}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>{mode === "CYCLE" ? "Các ô đích" : "Các ô ứng viên"}</span>
                    <input aria-label={`Danh sách goal ${SIDE_LABELS[side]}`} style={inputStyle} value={goalText(side, goal)} disabled={disabled || !isGoalEnabled(value)} onChange={(event) => updateGoalCells(side, event.target.value)} onBlur={() => restoreGoalDraft(side, goal)} />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Mỗi số round</span>
                    <input aria-label={`Khoảng goal ${SIDE_LABELS[side]}`} type="number" min={1} max={1000} style={inputStyle} value={goal.roundInterval} disabled={disabled || !isGoalEnabled(value)} onChange={(event) => updateGoalInterval(side, event.target.value)} />
                  </label>
                </div>
              )}
              {mode === "SEEDED" && goal?.mode === "SEEDED" && <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Chính sách seed cố định: <code>goal-prng-v1</code></span>}
              {fieldError(errors, [`profile.goalProfiles.${side}`, `goalProfiles.${side}`])}
            </div>
          );
        })}
      </section>

      {previewRequest && onPreviewRequestChange && <div style={{ display: "flex", justifyContent: "flex-end" }}><Button type="button" onClick={handlePreview} disabled={disabled}>Kiểm tra preview bằng server</Button></div>}
    </section>
  );
}

export default RuleEditor;
