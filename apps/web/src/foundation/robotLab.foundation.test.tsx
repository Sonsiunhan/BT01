import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PieceGlyph } from "../components/board/PieceGlyph";
import { DESIGN_TOKENS } from "./tokens";
import { RobotLabMark } from "./RobotLabMark";
import { RobotLabHost } from "./RobotLabHost";
import { RobotLabWordmark } from "./RobotLabWordmark";
import { resolveMotionPolicy } from "./motionPolicy";

describe("V1 Robot Lab foundation", () => {
  function contrastRatio(foreground: string, background: string): number {
    const relativeLuminance = (hex: string): number => {
      const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  }

  it("publishes the Robot Lab semantic palette and shared surface geometry", () => {
    expect(DESIGN_TOKENS.shared["--robot-lab-brand"]).toBe("ROBOT LAB");
    expect(DESIGN_TOKENS.shared["--piece-glove"]).toMatch(/^#/);
    expect(DESIGN_TOKENS.shared["--piece-outline"]).toMatch(/^#/);
    expect(DESIGN_TOKENS.shared["--motion-reduced"]).toBe("0ms");
    expect(DESIGN_TOKENS.shared["--elevation-card"]).toContain("0 ");
    expect(DESIGN_TOKENS.light["--blue-player"]).toBe("#1957B8");
    expect(DESIGN_TOKENS.light["--red-player"]).toBe("#B13244");
    // V1 visual contract: these values are copied from the approved Robot Lab
    // reference, not from the older neon/B3 surface palette.
    expect(DESIGN_TOKENS.dark["--bg-root"]).toBe("#0B1421");
    expect(DESIGN_TOKENS.dark["--surface-1"]).toBe("#142134");
    expect(DESIGN_TOKENS.dark["--surface-2"]).toBe("#1E3048");
    expect(DESIGN_TOKENS.dark["--text-primary"]).toBe("#F1F7FC");
    expect(DESIGN_TOKENS.dark["--text-secondary"]).toBe("#A5BACD");
    expect(DESIGN_TOKENS.dark["--system-cyan"]).toBe("#69EEE7");
    expect(DESIGN_TOKENS.light["--bg-root"]).toBe("#EAF0F5");
    expect(DESIGN_TOKENS.light["--surface-1"]).toBe("#FDFEFE");
    expect(DESIGN_TOKENS.light["--surface-2"]).toBe("#E3EBF2");
  });

  it("keeps the white glove silhouette at or above the 3:1 glyph/body contrast floor", () => {
    const outline = DESIGN_TOKENS.shared["--piece-outline"];
    expect(contrastRatio(outline, DESIGN_TOKENS.light["--blue-player"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outline, DESIGN_TOKENS.light["--red-player"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outline, DESIGN_TOKENS.dark["--blue-player"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outline, DESIGN_TOKENS.dark["--red-player"])).toBeGreaterThanOrEqual(3);
  });

  it("renders the original Robot Lab mark as an accessible vector asset", () => {
    render(<RobotLabMark />);
    const mark = screen.getByRole("img", { name: "OTT v2 Robot Lab" });
    expect(mark).toHaveAttribute("data-brand", "robot-lab");
    expect(mark.querySelectorAll("path").length).toBeGreaterThan(2);
  });

  it("provides the deterministic full-body host and shell wordmark", () => {
    render(<><RobotLabHost /><RobotLabWordmark /></>);
    expect(screen.getByRole("img", { name: "Robot chủ nhà Robot Lab" })).toHaveAttribute("data-robot", "full-body");
    expect(screen.getByText("OTT v2")).toBeInTheDocument();
    expect(screen.getByText("OẲN TÙ TÌ")).toBeInTheDocument();
  });

  it("keeps motion event-safe across quality and reduced-motion preferences", () => {
    expect(resolveMotionPolicy({ tier: "high", reducedMotion: false, ambientMotion: true })).toEqual({ ambient: true, events: true });
    expect(resolveMotionPolicy({ tier: "low", reducedMotion: false, ambientMotion: true })).toEqual({ ambient: false, events: true });
    expect(resolveMotionPolicy({ tier: "high", reducedMotion: true, ambientMotion: true })).toEqual({ ambient: false, events: false });
  });

  it.each(["R", "P", "S"] as const)("uses the deterministic original demo white-glove artwork for %s", (type) => {
    render(<PieceGlyph type={type} />);
    const glyph = screen.getByRole("img", { name: type === "R" ? "Đấm" : type === "P" ? "Bao" : "Kéo" });
    expect(glyph).toHaveAttribute("data-piece-style", "white-glove");
    expect(glyph.tagName).toBe("IMG");
    expect(glyph).toHaveAttribute("data-artwork", "robot-lab-demo");
    expect(glyph.getAttribute("src")).toMatch(/white-glove-(fist|palm|peace)\.png/);
  });
});
