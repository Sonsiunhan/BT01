import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { routes } from "./routes";

const HomePage = lazy(() => import("../pages/HomePage"));
const QueuePage = lazy(() => import("../pages/QueuePage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const GameRoomPage = lazy(() => import("../pages/GameRoomPage"));
const HistoryPage = lazy(() => import("../pages/HistoryPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const FriendsPage = lazy(() => import("../pages/FriendsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const GuestSetupPage = lazy(() => import("../pages/GuestSetupPage"));
const LocalGamePage = lazy(() => import("../pages/LocalGamePage"));
const SpectatorPage = lazy(() => import("../pages/SpectatorPage"));
const OnlineRoomsPage = lazy(() => import("../pages/OnlineRoomsPage"));
const BotOnlinePage = lazy(() => import("../pages/BotOnlinePage"));
const BotWorkbenchPage = lazy(() => import("../pages/BotWorkbenchPage"));
const BotOfflinePage = lazy(() => import("../pages/BotOfflinePage"));

const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminRoutePending = lazy(() => import("../features/admin/shell/AdminRoutePending"));
const TournamentListPage = lazy(() => import("../features/admin/tournaments/TournamentListPage"));
const TournamentWizardPage = lazy(() => import("../features/admin/tournaments/TournamentWizardPage"));
const TournamentDetailPage = lazy(() => import("../features/admin/tournaments/TournamentDetailPage"));
const AdminTaPage = lazy(() => import("../pages/AdminTaPage"));
const TournamentStaffPage = lazy(() => import("../features/tournament-staff/TournamentStaffPage"));
const InvitationAcceptancePage = lazy(() => import("../features/tournament-staff/InvitationAcceptancePage"));
const AccountAccessPage = lazy(() => import("../pages/AccountAccessPage"));
const SupportRecoveryPage = lazy(() => import("../features/admin/support/SupportRecoveryPage"));

export function AppRouter() {
  return (
    <Routes>
      {/* Client Player Shell */}
      <Route element={<AppLayout />}>
        <Route path={routes.home} element={<HomePage />} />
        <Route path={routes.login} element={<LoginPage />} />
        <Route path={routes.canonicalLogin} element={<LoginPage />} />
        <Route path={routes.register} element={<RegisterPage />} />
        <Route path={routes.canonicalRegister} element={<RegisterPage />} />
        <Route path={routes.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.canonicalForgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.canonicalHome} element={<HomePage />} />
        <Route path={routes.queue} element={<QueuePage />} />
        <Route path={routes.rooms} element={<OnlineRoomsPage />} />
        <Route path={routes.gameRoom} element={<GameRoomPage />} />
        <Route path={routes.canonicalGameRoom} element={<GameRoomPage />} />
        <Route path={routes.canonicalGame} element={<GameRoomPage />} />
        <Route path={routes.history} element={<HistoryPage />} />
        <Route path={routes.canonicalHistory} element={<HistoryPage />} />
        <Route path={routes.matchHistory} element={<HistoryPage />} />
        <Route path={routes.profile} element={<ProfilePage />} />
        <Route path={routes.canonicalProfile} element={<ProfilePage />} />
        <Route path={routes.friends} element={<FriendsPage />} />
        <Route path={routes.canonicalFriends} element={<FriendsPage />} />
        <Route path={routes.settings} element={<SettingsPage />} />
        <Route path={routes.canonicalSettings} element={<SettingsPage />} />
        <Route path={routes.guest} element={<GuestSetupPage />} />
        <Route path={routes.guestPlay} element={<Navigate to={routes.offline} replace />} />
        <Route path={routes.ai} element={<LocalGamePage mode="AI" />} />
        <Route path={routes.offline} element={<LocalGamePage mode="OFFLINE" />} />
        <Route path={routes.spectator} element={<SpectatorPage />} />
        <Route path={routes.botOnline} element={<BotOnlinePage />} />
        <Route path={routes.botOffline} element={<BotOfflinePage />} />
        <Route path={routes.botWorkbench} element={<BotWorkbenchPage />} />
        <Route path={routes.staffInvitation} element={<InvitationAcceptancePage />} />
        <Route path={routes.accountAccess} element={<AccountAccessPage />} />
        <Route path={routes.accountAccessReset} element={<AccountAccessPage />} />
      </Route>

      {/* Admin Console Shell (S01: No Online CTA, Role-aware, Lazy routes) */}
      <Route element={<AdminLayout />}>
        <Route path={routes.admin} element={<Navigate to={routes.adminTournaments} replace />} />
        <Route path={routes.adminTa} element={<AdminTaPage />} />
        <Route path={routes.adminAccounts} element={<AdminTaPage />} />
        <Route path={routes.adminSupport} element={<SupportRecoveryPage />} />
        <Route path={routes.adminTournaments} element={<TournamentListPage />} />
        <Route
          path={routes.adminTournamentNew}
          element={<TournamentWizardPage />}
        />
        <Route
          path={routes.adminTournamentEdit}
          element={<TournamentWizardPage />}
        />
        <Route
          path={routes.adminTournamentDetail}
          element={<TournamentDetailPage />}
        />
        <Route
          path={routes.adminTournamentStaff}
          element={<TournamentStaffPage />}
        />
        <Route
          path={routes.adminTournamentOperations}
          element={
            <AdminRoutePending
              pageCode="P03"
              title="Điều hành & Xử lý sự cố giải đấu"
              targetTask="S05"
              description="Các thao tác điều hành giải đấu, xử lý hoãn trận, gia hạn và nhật ký sự cố trọng tài."
            />
          }
        />
        <Route
          path={routes.adminAudit}
          element={
            <AdminRoutePending
              pageCode="P14"
              title="Nhật ký kiểm toán hệ thống"
              targetTask="S06"
              description="Lịch sử các thao tác quản trị toàn hệ thống đã được lọc và che dấu dữ liệu nhạy cảm."
            />
          }
        />
        <Route
          path={routes.adminTournamentAudit}
          element={
            <AdminRoutePending
              pageCode="P14"
              title="Nhật ký kiểm toán giải đấu"
              targetTask="S06"
              description="Truy vết các thao tác thay đổi cấu hình, phân công nhân sự và duyệt trận trong giải đấu."
            />
          }
        />
        <Route
          path={routes.adminOffline}
          element={
            <AdminRoutePending
              pageCode="P15"
              title="Hub công cụ Offline"
              targetTask="S08"
              description="Cổng truy cập tập trung vào các công cụ thực thi offline: Kho Bot, Đấu Bot và Phòng luyện tập."
            />
          }
        />
        <Route
          path={routes.adminOfflineBots}
          element={
            <AdminRoutePending
              pageCode="P15"
              title="Kho Bot của tôi"
              targetTask="S08"
              description="Quản lí danh sách mã nguồn Bot cá nhân và theo dõi trạng thái tương thích với các bộ luật."
            />
          }
        />
        <Route
          path={routes.adminOfflinePracticeHumanBot}
          element={
            <AdminRoutePending
              pageCode="P15"
              title="Phòng tập Người – Bot Offline"
              targetTask="S08"
              description="Môi trường thi đấu luyện tập cục bộ giữa người chơi và Bot Python trong sandbox an toàn."
            />
          }
        />
        <Route
          path={routes.adminOfflinePracticeHumanHuman}
          element={
            <AdminRoutePending
              pageCode="P15"
              title="Phòng tập Người – Người Offline"
              targetTask="S08"
              description="Chế độ chơi hai người trên cùng một thiết bị với luật thi đấu tùy biến."
            />
          }
        />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
