import { getJson } from "../http/httpClient";

/**
 * API cho khu vực "Giải đấu của tôi" phía người chơi: chỉ đọc các giải mà
 * tài khoản hiện tại được Ban tổ chức ghi danh, kèm trạng thái cá nhân,
 * bảng xếp hạng theo chính sách công bố và các trận engine đã ghép.
 */

export interface MyTournamentSummary {
  id: string;
  tournamentCode: string;
  tournamentName: string;
  organizersText: string;
  status: string;
  revision: number;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  timezone: string;
  competitionMode: string;
  format: string | null;
  pairingMethod: string | null;
  maxParticipants: number | null;
  checkinRequired: boolean;
  checkinOpenAt: string | null;
  checkinCloseAt: string | null;
  leaderboardVisibility: string;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
}

export interface MyEnrollment {
  enrollmentId: string;
  personKey: string;
  displayName: string;
  unitCode: string;
  seedRating: number;
  eligibilityStatus: string;
  checkedInAt: string | null;
  pinnedBotRevisionId: string | null;
  botReadinessStatus: string;
}

export interface MyMatch {
  matchId: string;
  roomId: string;
  mySide: "BLUE" | "RED";
  opponentId: string;
  opponentName: string;
  status: string;
  winnerSide: "BLUE" | "RED" | null;
  iWon: boolean;
  finishSequence: number | null;
  pinnedConfigVersionNumber: number;
  createdAt: string;
  endedAt: string | null;
}

export interface StandingRow {
  rank: number;
  participantId: string;
  personKey: string;
  displayName: string;
  unitCode: string;
  tournamentScore: number;
  tournamentElo: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  lastFinishedSequence: number;
  lastFinishedAt: string | null;
}

export interface MyTournamentDetail {
  tournament: MyTournamentSummary;
  enrollment: MyEnrollment;
  myMatches: MyMatch[];
  standings: { standings: StandingRow[]; computedAt: string; formulaPreset: string } | null;
  standingsHiddenReason: string | null;
}

export function fetchMyTournaments(): Promise<{ items: Array<{ tournament: MyTournamentSummary; enrollment: MyEnrollment }> }> {
  return getJson("/api/me/tournaments") as Promise<{ items: Array<{ tournament: MyTournamentSummary; enrollment: MyEnrollment }> }>;
}

export function fetchMyTournamentDetail(tournamentId: string): Promise<MyTournamentDetail> {
  return getJson(`/api/me/tournaments/${encodeURIComponent(tournamentId)}`) as Promise<MyTournamentDetail>;
}
