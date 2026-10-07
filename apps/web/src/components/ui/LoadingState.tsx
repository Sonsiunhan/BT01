import { Spinner } from "./Spinner";
import { FallbackArt } from "./FallbackArt";
export function LoadingState({ label = "Đang tải…", fullPage = false }: { label?: string; fullPage?: boolean }) {
  return <div className={`loading-state${fullPage ? " full-page robot-lab-loading-panel" : ""}`} role="status">{fullPage && <FallbackArt />}<Spinner /><span>{label}</span></div>;
}
