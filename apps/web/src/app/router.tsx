import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { longAdminRouteDefinitions } from "../features/admin/long-routes";
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
const TournamentRulesPage = lazy(() => import("../features/admin/tournaments/TournamentRulesPage"));
const OfflineHubPage = lazy(() => import("../features/admin/offline/OfflineHubPage"));
const OfflineBotsPage = lazy(() => import("../features/admin/offline/OfflineBotsPage"));
const OfflinePracticeHumanBotPage = lazy(() => import("../features/admin/offline/OfflinePracticeHumanBotPage"));
const OfflinePracticeHumanHumanPage = lazy(() => import("../features/admin/offline/OfflinePracticeHumanHumanPage"));
const AdminTaPage = lazy(() => import("../pages/AdminTaPage"));
const TournamentStaffPage = lazy(() => import("../features/tournament-staff/TournamentStaffPage"));
const TournamentRosterPage = lazy(() => import("../features/tournament-roster/TournamentRosterPage"));
const BotReadinessPage = lazy(() => import("../features/admin/tournaments/BotReadinessPage"));
const InvitationAcceptancePage = lazy(() => import("../features/tournament-staff/InvitationAcceptancePage"));
const AccountActivationPage = lazy(() => import("../pages/AccountActivationPage"));
const AccountAccessPage = lazy(() => import("../pages/AccountAccessPage"));
const SupportRecoveryPage = lazy(() => import("../features/admin/support/SupportRecoveryPage"));
const AuditLogsViewerPage = lazy(() => import("../features/admin/tournaments/AuditLogsViewerPage"));
const RulesAcknowledgementPage = lazy(() => import("../features/account/RulesAcknowledgementPage"));

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
        <Route path={routes.accountActivation} element={<AccountActivationPage />} />
        <Route path={routes.canonicalAccountActivation} element={<AccountActivationPage />} />
        <Route path={routes.accountAccess} element={<AccountAccessPage />} />
        <Route path={routes.accountAccessReset} element={<AccountAccessPage />} />
        <Route path={routes.tournamentRulesAcknowledgement} element={<RulesAcknowledgementPage />} />
      </Route>

      {/* Admin Console Shell (S01: No Online CTA, Role-aware, Lazy routes) */}
      <Route element={<AdminLayout />}>
        <Route path={routes.admin} element={<Navigate to={routes.adminTournaments} replace />} />
        <Route path={routes.adminTa} element={<AdminTaPage />} />
        <Route path={routes.adminAccounts} element={<AdminTaPage />} />
        {longAdminRouteDefinitions.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
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
          path={routes.adminTournamentRules}
          element={<TournamentRulesPage />}
        />
        <Route
          path={routes.adminTournamentStaff}
          element={<TournamentStaffPage />}
        />
        <Route
          path={routes.adminTournamentRoster}
          element={<TournamentRosterPage />}
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
        <Route path={routes.adminTournamentBotReadiness} element={<BotReadinessPage />} />
        <Route
          path={routes.adminAudit}
          element={<AuditLogsViewerPage />}
        />
        <Route
          path={routes.adminTournamentAudit}
          element={<AuditLogsViewerPage />}
        />
        <Route path={routes.adminOffline} element={<OfflineHubPage />} />
        <Route path="/admin/offline-hub" element={<Navigate to={routes.adminOffline} replace />} />
        <Route path="/admin/offline-tools" element={<Navigate to={routes.adminOffline} replace />} />
        <Route path={routes.adminOfflineBots} element={<OfflineBotsPage />} />
        <Route path={routes.adminOfflinePracticeHumanBot} element={<OfflinePracticeHumanBotPage />} />
        <Route path={routes.adminOfflinePracticeHumanHuman} element={<OfflinePracticeHumanHumanPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
