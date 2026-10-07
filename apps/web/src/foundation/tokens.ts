export type ThemeSurface = "light" | "dark";

/**
 * The single semantic token source for the Robot Lab visual system. Components
 * consume CSS variables; this object keeps the names and values auditable in
 * TypeScript and lets the app apply the same contract before first paint.
 */
export const DESIGN_TOKENS = {
  dark: {
    "--bg-root": "#0B1421",
    "--bg-secondary": "#142134",
    "--surface-1": "#142134",
    "--surface-2": "#1E3048",
    "--surface-3": "#263D57",
    "--glass": "rgba(20, 33, 52, 0.92)",
    "--text-primary": "#F1F7FC",
    "--text-secondary": "#A5BACD",
    "--text-muted": "#A5BACD",
    "--system-cyan": "#69EEE7",
    "--blue-player": "#70ADFF",
    "--blue-high": "#B5DBFF",
    "--red-player": "#FF8695",
    "--red-high": "#FFB4BE",
    "--violet": "#B9A0FF",
    "--magenta": "#E68CA0",
    "--amber": "#FFD487",
    "--success": "#70D7B1",
    "--warning": "#FFD487",
    "--error": "#FF8695",
  },
  light: {
    "--bg-root": "#EAF0F5",
    "--bg-secondary": "#E3EBF2",
    "--surface-1": "#FDFEFE",
    "--surface-2": "#E3EBF2",
    "--surface-3": "#D7E3EC",
    "--glass": "rgba(253, 254, 254, 0.95)",
    "--text-primary": "#10283C",
    "--text-secondary": "#486278",
    "--text-muted": "#486278",
    "--system-cyan": "#007381",
    "--blue-player": "#1957B8",
    "--blue-high": "#6D9FE0",
    "--red-player": "#B13244",
    "--red-high": "#D56D7E",
    "--violet": "#643EC0",
    "--magenta": "#A84B66",
    "--amber": "#8C5800",
    "--success": "#18795B",
    "--warning": "#8C5800",
    "--error": "#B13244",
  },
  shared: {
    "--font-display": "'Space Grotesk', 'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
    "--font-body": "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
    "--font-data": "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
    "--robot-lab-brand": "ROBOT LAB",
    "--piece-glove": "#F7FBFF",
    "--piece-outline": "#000000",
    "--gradient-arena-aurora": "linear-gradient(135deg, #38506A 0%, #69EEE7 100%)",
    "--gradient-system-pulse": "linear-gradient(135deg, #69EEE7 0%, #70ADFF 100%)",
    "--gradient-victory": "linear-gradient(135deg, #FFD487 0%, #70ADFF 100%)",
    "--gradient-defeat": "linear-gradient(135deg, #FF8695 0%, #38506A 100%)",
    "--gradient-legend": "linear-gradient(110deg, #FF8695 0%, #FFD487 48%, #69EEE7 100%)",
    "--motion-reduced": "0ms",
    "--elevation-card": "0 6px 0 #030A13, 0 16px 28px rgba(3, 10, 19, 0.26)",
    "--elevation-pressed": "0 2px 0 #030A13, 0 7px 14px rgba(3, 10, 19, 0.2)",
    "--board-line": "rgba(56, 80, 106, 0.42)",
    "--focus-ring": "#69EEE7",
    "--motion-micro": "120ms",
    "--motion-fast": "190ms",
    "--motion-normal": "220ms",
    "--motion-cinematic": "800ms",
    "--radius-sm": "0.5rem",
    "--radius-md": "0.85rem",
    "--radius-lg": "1.2rem",
    "--glow-card": "0 0 24px",
    "--glow-token": "0 0 14px",
    "--z-ambient": "0",
    "--z-content": "1",
    "--z-header": "20",
    "--z-overlay": "40",
  },
} as const;

export function applyDesignTokens(theme: ThemeSurface, root: HTMLElement = document.documentElement): void {
  const tokens = { ...DESIGN_TOKENS.shared, ...DESIGN_TOKENS[theme] };
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
