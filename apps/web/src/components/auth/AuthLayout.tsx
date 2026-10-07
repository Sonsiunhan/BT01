import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../app/routes";
import { RobotLabHost } from "../../foundation/RobotLabHost";

/** Shared Robot Lab composition; never gates ordinary play behind authentication. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return <section className="auth-layout robot-lab-auth-layout">
    <aside className="auth-companion">
      <div className="auth-robot" aria-hidden="true"><RobotLabHost size={210} /></div>
      <h2>Sẵn sàng CHAN!</h2>
      <p>Chơi trực tiếp hoặc thử chiến thuật của bạn trong Đấu chương trình.</p>
      <Link to={routes.home} className="button secondary">Chơi với tư cách khách</Link>
    </aside>
    {children}
  </section>;
}
