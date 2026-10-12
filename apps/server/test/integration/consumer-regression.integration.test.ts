import { describe, expect, it } from "vitest";
import { RoomManager } from "../../src/modules/room/room.manager.js";
import { MatchManager } from "../../src/modules/match/match.manager.js";
import { RatingService } from "../../src/modules/rating/rating.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import { CommandLedger } from "../../src/modules/match/commit/command-ledger.js";

describe("L07-W4: Consumer Regression Suite (L-07.08)", () => {
  it("PvP Human vs Human: full move progression, sequence ordering and game completion", async () => {
    const rooms = new RoomManager();
    const ledger = new CommandLedger();
    const matches = new MatchManager(() => Date.now(), 15_000, undefined, undefined, ledger);

    const blueActor = { userId: "user-blue-1", username: "blue", displayName: "Blue Player", principal: "ACCOUNT" as const };
    const redActor = { userId: "user-red-1", username: "red", displayName: "Red Player", principal: "ACCOUNT" as const };

    // 1. Create Room & Join
    const room = await rooms.create(blueActor, { name: "ConsumerPvPRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(redActor, room.roomId, {});
    const roomDetail = rooms.search(room.roomId, blueActor.userId);

    // 2. Ready & FastReady
    matches.ensure(roomDetail);
    matches.ready(roomDetail, blueActor, true);
    matches.ready(roomDetail, redActor, true);
    matches.fastReady(roomDetail, blueActor);
    const activeMatch = matches.fastReady(roomDetail, redActor);

    expect(activeMatch.status).toBe("PLAYING");
    expect(activeMatch.stateVersion).toBe(2);

    // 3. Move Turn 1 (Blue)
    const move1 = matches.move(roomDetail, blueActor, "e1", "e2", activeMatch.stateVersion, "cmd-c1");
    expect(move1.sequence).toBeGreaterThan(activeMatch.sequence);
    expect(move1.stateVersion).toBe(3);
    expect(move1.currentTurn).toBe("RED");

    // 4. Move Turn 2 (Red)
    const move2 = matches.move(roomDetail, redActor, "e9", "e8", move1.stateVersion, "cmd-c2");
    expect(move2.sequence).toBeGreaterThan(move1.sequence);
    expect(move2.stateVersion).toBe(4);
    expect(move2.currentTurn).toBe("BLUE");

    // 5. Surrender (Blue surrenders -> Red wins)
    const finishRes = matches.surrender(roomDetail, blueActor, move2.stateVersion);
    expect(finishRes.sequence).toBeGreaterThan(move2.sequence);
    expect(finishRes.status).toBe("FINISHED");
    expect(finishRes.winner).toBe("RED");
    expect(finishRes.resultReason).toBe("SURRENDER");
  });

  it("Auth & Principal Matrix: Elo eligibility applies to ranked manual accounts only; Guest is ineligible", async () => {
    const ratingService = new RatingService(undefined);

    // 1. Guest Match snapshot
    const guestBlue = { userId: "guest-1", username: "g1", displayName: "g1", side: "BLUE" as const, ready: true, connected: true, principal: "GUEST" as const };
    const guestRed = { userId: "guest-2", username: "g2", displayName: "g2", side: "RED" as const, ready: true, connected: true, principal: "GUEST" as const };

    const guestMatch: any = {
      matchId: "guest-match-1",
      roomId: "GUEST1",
      mode: "UNRANKED",
      playMode: "MANUAL",
      status: "FINISHED",
      winner: "BLUE",
      resultReason: "CHECKMATE",
      players: [guestBlue, guestRed],
    };

    // Guest matches are strictly ineligible for Elo rating update (L-05.08)
    const guestRating = await ratingService.finalize(guestMatch);
    expect(guestRating).toBeNull();

    // 2. Direct Elo mathematical calculation
    const { calculateElo } = await import("../../src/modules/rating/rating.service.js");
    const eloResult = calculateElo({ blueElo: 1000, redElo: 1000, winner: "BLUE" });
    expect(eloResult.blueBefore).toBe(1000);
    expect(eloResult.blueDelta).toBeGreaterThan(0);
    expect(eloResult.redDelta).toBeLessThan(0);
    expect(eloResult.blueAfter).toBe(1000 + eloResult.blueDelta);
  });

  it("Referee & Spectator Invariants: Role separation, pause/resume authority, and guest referee rejection", async () => {
    const rooms = new RoomManager();
    let currentTime = 1000;
    const matches = new MatchManager(() => currentTime, 15_000);

    const blueActor = { userId: "host-acc", username: "host", displayName: "Host", principal: "ACCOUNT" as const };
    const redActor = { userId: "guest-player", username: "player", displayName: "Player", principal: "ACCOUNT" as const };
    const refereeActor = { userId: "ref-acc", username: "referee", displayName: "Referee", principal: "ACCOUNT" as const };
    const spectatorActor = { userId: "spectator-1", username: "spec", displayName: "Spectator", principal: "ACCOUNT" as const };

    // 1. Create room with referee enabled
    const room = await rooms.create(blueActor, { name: "RefRoom", visibility: "PUBLIC", timerSeconds: 300, refereeEnabled: true });
    await rooms.join(redActor, room.roomId, {});

    // 2. Invite & Accept Referee
    const invite = await rooms.inviteReferee(blueActor, room.roomId, refereeActor.userId);
    await rooms.acceptRefereeInvite(refereeActor, invite.inviteId);
    rooms.markRefereeConnected(room.roomId, refereeActor.userId, true);

    const roomDetail = rooms.search(room.roomId, blueActor.userId);
    matches.ensure(roomDetail);
    matches.ready(roomDetail, blueActor, true);
    matches.ready(roomDetail, redActor, true);
    matches.refereeConnected(roomDetail, refereeActor);

    // In a referee room, match start is authoritative from Referee
    const matchStart = matches.start(roomDetail, refereeActor);
    expect(matchStart.status).toBe("COUNTDOWN");

    // Advance past countdown
    currentTime += 3500;
    const playingMatch = matches.tick(roomDetail);
    expect(playingMatch.status).toBe("PLAYING");

    // 3. Referee Pause & Freeze Clocks
    const paused = matches.stopByReferee(roomDetail, refereeActor, "TECHNICAL_ISSUE");
    expect(paused.status).toBe("PAUSED");
    expect(paused.pauseReason).toBe("REFEREE");

    // 4. Referee Resume
    const resuming = matches.resumeByReferee(roomDetail, refereeActor);
    expect(resuming.status).toBe("RESUMING");

    // 5. Invariant check: Spectator or Referee cannot execute move
    expect(() => {
      matches.move(roomDetail, spectatorActor as any, "e1", "e2", resuming.stateVersion);
    }).toThrow(AppError);

    expect(() => {
      matches.move(roomDetail, refereeActor as any, "e1", "e2", resuming.stateVersion);
    }).toThrow(AppError);

    // 6. Guest Referee Rejection: Guest is forbidden from appointing or becoming Referee
    const guestActor = { userId: "guest-ref-attempt", username: "g", displayName: "g", principal: "GUEST" as const };
    await expect(rooms.inviteReferee(guestActor as any, room.roomId, "someone")).rejects.toThrow(AppError);
  });

  it("Web Client Contract Parity: public snapshots have zero private token/source leakage", async () => {
    const rooms = new RoomManager();
    const matches = new MatchManager();

    const blue = { userId: "b1", username: "b1", displayName: "b1", principal: "GUEST" as const };
    const red = { userId: "r1", username: "r1", displayName: "r1", principal: "GUEST" as const };

    const room = await rooms.create(blue, { name: "ParityRoom", visibility: "PUBLIC", timerSeconds: 300 });
    await rooms.join(red, room.roomId, {});
    const roomDetail = rooms.search(room.roomId, blue.userId);

    const snapshot = matches.ensure(roomDetail);

    // Contract asserts
    expect(snapshot).toHaveProperty("matchId");
    expect(snapshot).toHaveProperty("roomId");
    expect(snapshot).toHaveProperty("board");
    expect(snapshot).toHaveProperty("clocksMs");
    expect(snapshot).toHaveProperty("status");
    expect(snapshot).toHaveProperty("sequence");
    expect(snapshot).toHaveProperty("stateVersion");

    // Zero secret leak asserts
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("python_source");
    expect(serialized).not.toContain("executionCheckpoint");
  });
});
