import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { routes } from "../app/routes";
import { RobotLabMark } from "../foundation/RobotLabMark";
import { FallbackArt } from "../components/ui/FallbackArt";

export default function NotFoundPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="placeholder not-found-page robot-lab-fallback-panel">
      <Link className="not-found-logo" to={routes.home} aria-label="ROBOT LAB — Về sảnh">
        <RobotLabMark size={32} />
        <span>ROBOT</span>
        <strong>LAB</strong>
      </Link>
      <FallbackArt />
      <p className="eyebrow">404 · KHÔNG TÌM THẤY</p>
      <h1 ref={headingRef} tabIndex={-1}>Trang này không tồn tại</h1>
      <p className="form-intro">Đường dẫn có thể đã đổi hoặc trận đấu đã được đóng. Bạn vẫn có thể quay lại sảnh để tiếp tục.</p>
      <Link className="button primary" to={routes.home}>Về sảnh</Link>
    </section>
  );
}
