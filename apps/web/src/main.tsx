import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { applyPresentationPreferences } from "./services/presentation/preferences";
import { applyDesignTokens } from "./foundation/tokens";
import { applyQualityTier } from "./foundation/qualityTier";
import { registerOfflineServiceWorker } from "./services/local/offlineKit";
import "./styles/globals.css";
import "./styles/b3-lobby.css";
import "./styles/robot-lab.css";
import "./styles/visual-rebuild/home.css";
import "./styles/visual-rebuild/queue.css";
import "./styles/visual-rebuild/friends.css";
import "./styles/visual-rebuild/game.css";
import "./styles/visual-rebuild/profile.css";
import "./styles/visual-rebuild/bot.css";
import "./styles/visual-rebuild/history.css";
import "./styles/visual-rebuild/settings-auth.css";

applyPresentationPreferences();
applyDesignTokens(document.documentElement.dataset.theme === "light" ? "light" : "dark");
applyQualityTier();
document.documentElement.dataset.designSystem = "robot-lab";
registerOfflineServiceWorker();

const root = document.getElementById("root");
if (!root) throw new Error("Không tìm thấy phần tử #root.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
