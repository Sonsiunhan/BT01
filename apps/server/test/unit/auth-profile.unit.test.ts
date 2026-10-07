import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../../src/modules/auth/auth.service.js";

describe("R14 profile statistics", () => {
  it("returns Bot wins/losses separately from Ranked stats and ignores non-Bot rows", async () => {
    const user = {
      id: "profile-r14",
      fullName: "Người R14",
      displayName: "Robot Pilot",
      username: "robot_pilot",
      usernameNormalized: "robot_pilot",
      passwordHash: "",
      recoveryCodeHash: "",
      recoveryUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: { userId: "profile-r14", theme: "dark", avatarPreset: "robot", presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" },
      stats: { userId: "profile-r14", elo: 1450, rankedWins: 8, rankedLosses: 3, quickWins: 1, quickLosses: 0 },
    };
    const matchPlayerFindMany = vi.fn(async () => [
      { isWinner: true, match: { playMode: "BOT", status: "FINISHED" } },
      { isWinner: false, match: { playMode: "BOT", status: "FINISHED" } },
      { isWinner: true, match: { playMode: "BOT", status: "ABORTED" } },
      { isWinner: true, match: { playMode: "MANUAL", status: "FINISHED" } },
    ]);
    const db = {
      user: { findUnique: vi.fn(async () => user) },
      friendship: { count: vi.fn(async () => 2) },
      matchPlayer: { findMany: matchPlayerFindMany },
    };

    const profile = await new AuthService(db as never).publicProfile("robot_pilot");

    expect(profile.stats).toMatchObject({ elo: 1450, rankedWins: 8, rankedLosses: 3 });
    expect(profile.botStats).toEqual({ wins: 1, losses: 1 });
    expect(profile).not.toHaveProperty("fullName");
    expect(profile).not.toHaveProperty("passwordHash");
    expect(profile).not.toHaveProperty("recoveryCodeHash");
    expect(profile).not.toHaveProperty("library");
    expect(matchPlayerFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "profile-r14", isWinner: { not: null } }, select: { isWinner: true, match: { select: { playMode: true, status: true } } } }));
  });
});
