import { Link, useLocation } from "react-router-dom";
import { routes } from "../app/routes";

const copyByPath: Record<string, { eyebrow: string; title: string; copy: string }> = {
  [routes.botOnline]: { eyebrow: "ĐẤU CHƯƠNG TRÌNH · ONLINE", title: "Bot Online đang được chuẩn bị", copy: "Phòng đấu bot, kiểm tra phiên bản và quyền riêng tư sẽ mở trong các Wave runtime tiếp theo." },
  [routes.botOffline]: { eyebrow: "ĐẤU CHƯƠNG TRÌNH · OFFLINE", title: "Bot Offline đang được chuẩn bị", copy: "Bạn sẽ có thể chạy hai bot trong trình duyệt sau khi runtime cache và checkpoint hoàn tất." },
  [routes.botWorkbench]: { eyebrow: "ROBOT LAB · THƯ VIỆN", title: "Thư viện Bot đang được chuẩn bị", copy: "Workbench sẽ nhận file chiến thuật, kiểm tra an toàn và lưu revision ở Wave R9." },
};

export default function RobotLabEntryPage() {
  const { pathname } = useLocation();
  const copy = copyByPath[pathname] ?? copyByPath[routes.botWorkbench];
  return <section className="placeholder robot-lab-entry"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="form-intro">{copy.copy}</p><div className="result-actions"><Link className="button primary" to={routes.home}>Về sảnh</Link><Link className="button secondary" to={routes.rooms}>Danh sách Phòng Online</Link></div></section>;
}
