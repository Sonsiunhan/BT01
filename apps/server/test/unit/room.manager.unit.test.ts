import { describe, expect, it, vi } from "vitest";

import { RoomManager, ROOM_ID_ALPHABET, type RoomActor } from "../../src/modules/room/room.manager.js";

const host: RoomActor = { userId: "u-host", username: "host_user", displayName: "Host" };
const guest: RoomActor = { userId: "u-guest", username: "guest_user", displayName: "Guest" };
const third: RoomActor = { userId: "u-third", username: "third_user", displayName: "Third" };
const accountRef: RoomActor = { userId: "u-ref", username: "ref_user", displayName: "Ref", principal: "ACCOUNT" };
const publicInput = { name: "Public Test", visibility: "PUBLIC" as const, timerSeconds: 300 as const, spectatorsEnabled: false };

describe("W3 RoomManager", () => {
  it("generates safe IDs and keeps private rooms out of browse", async () => {
    const manager = new RoomManager();
    const publicRoom = await manager.create(host, publicInput, "create-public");
    const privateRoom = await manager.create(guest, { ...publicInput, name: "Private Test", visibility: "PRIVATE", password: "secret" }, "create-private");
    expect(publicRoom.roomId).toMatch(/^[A-Z2-9]{6}$/);
    expect([...publicRoom.roomId].every((character) => ROOM_ID_ALPHABET.includes(character))).toBe(true);
    expect(manager.list().map((room) => room.roomId)).toEqual([publicRoom.roomId]);
    expect(manager.search(privateRoom.roomId).requiresPassword).toBe(true);
    expect(manager.search(privateRoom.roomId).members).toEqual([]);
  });

  it("publishes only public waiting metadata to Room Browser subscribers", async () => {
    const manager = new RoomManager();
    const snapshots: string[][] = [];
    const unsubscribe = manager.subscribe((rooms) => snapshots.push(rooms.map((room) => room.roomId)));
    const publicRoom = await manager.create(host, publicInput);
    await manager.create(guest, { ...publicInput, visibility: "PRIVATE", password: "secret" });
    await manager.join(guest, publicRoom.roomId, {});
    unsubscribe();
    expect(snapshots).toEqual([[publicRoom.roomId], [publicRoom.roomId], []]);
  });
  it("enforces private password and a two-player active capacity", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, { ...publicInput, visibility: "PRIVATE", password: "secret" });
    await expect(manager.join(guest, room.roomId, { password: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const joined = await manager.join(guest, room.roomId, { password: "secret" });
    expect(joined.players).toBe(2);
    await expect(manager.join(third, room.roomId, {})).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it.each([
    { refereeEnabled: false, spectatorsEnabled: false },
    { refereeEnabled: true, spectatorsEnabled: false },
    { refereeEnabled: false, spectatorsEnabled: true },
    { refereeEnabled: true, spectatorsEnabled: true },
  ])("preserves the independent Referee/Spectator room toggles (%o)", async ({ refereeEnabled, spectatorsEnabled }) => {
    const manager = new RoomManager();
    const room = await manager.create({ ...host, principal: "ACCOUNT" }, {
      ...publicInput,
      visibility: "PRIVATE",
      password: "secret",
      refereeEnabled,
      spectatorsEnabled,
      ...(spectatorsEnabled ? { spectatorCapacity: 10 as const } : {}),
    });
    expect(room.refereeEnabled).toBe(refereeEnabled);
    expect(room.spectatorsEnabled).toBe(spectatorsEnabled);
    expect(room.spectatorCapacity).toBe(spectatorsEnabled ? 10 : null);
  });

  it("makes create and join idempotent", async () => {
    const manager = new RoomManager();
    const first = await manager.create(host, publicInput, "same-create");
    const duplicateCreate = await manager.create(host, publicInput, "same-create");
    expect(duplicateCreate.roomId).toBe(first.roomId);
    expect(manager.size()).toBe(1);
    const firstJoin = await manager.join(guest, first.roomId, {}, "same-join");
    const duplicateJoin = await manager.join(guest, first.roomId, {}, "same-join");
    expect(duplicateJoin.roomId).toBe(firstJoin.roomId);
    expect(duplicateJoin.players).toBe(2);
    expect(manager.search(first.roomId, guest.userId).members).toHaveLength(2);
  });

  it("transfers host, retains waiting rooms and cleans up empty rooms", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, publicInput);
    await manager.join(guest, room.roomId, {});
    const afterGuestLeaves = manager.leave(guest, room.roomId);
    expect(afterGuestLeaves?.players).toBe(1);
    expect(afterGuestLeaves?.hostUserId).toBe(host.userId);
    await manager.join(guest, room.roomId, {});
    const afterHostLeaves = manager.leave(host, room.roomId);
    expect(afterHostLeaves?.hostUserId).toBe(guest.userId);
    expect(manager.search(room.roomId, guest.userId).members[0]?.isHost).toBe(true);
    expect(manager.leave(guest, room.roomId)).toBeNull();
    expect(manager.size()).toBe(0);
  });

  it("keeps Room A and Room B membership isolated", async () => {
    const manager = new RoomManager();
    const roomA = await manager.create(host, { ...publicInput, name: "Room A" });
    const roomB = await manager.create(guest, { ...publicInput, name: "Room B" });
    await manager.join(third, roomB.roomId, {});
    expect(manager.search(roomA.roomId, host.userId).members.map((member) => member.userId)).toEqual([host.userId]);
    expect(manager.search(roomB.roomId, guest.userId).members.map((member) => member.userId)).toEqual([guest.userId, third.userId]);
  });

  it("authorizes spectator access, exposes public players and enforces capacity", async () => {
    const manager = new RoomManager();
    const room = await manager.create(host, { ...publicInput, spectatorsEnabled: true, spectatorCapacity: 1 });
    await manager.join(guest, room.roomId, {});
    const spectatorRoom = await manager.spectate(third, room.roomId, {});
    expect(spectatorRoom.members).toHaveLength(2);
    expect(spectatorRoom.spectators).toBe(1);
    expect(manager.isSpectator(room.roomId, third.userId)).toBe(true);
    await expect(manager.spectate({ ...third, userId: "u-fourth" }, room.roomId, {})).rejects.toMatchObject({ details: { reason: "SPECTATOR_CAPACITY" } });
    manager.leaveSpectator(room.roomId, third.userId);
    expect(manager.isSpectator(room.roomId, third.userId)).toBe(false);
  });

  it("denies disabled/private spectator access and keeps players out of spectator role", async () => {
    const manager = new RoomManager();
    const disabled = await manager.create(host, publicInput);
    await manager.join(guest, disabled.roomId, {});
    await expect(manager.spectate(third, disabled.roomId, {})).rejects.toMatchObject({ details: { reason: "SPECTATOR_DISABLED" } });
    const privateHost = { ...third, userId: "u-private-host" };
    const privateRoom = await manager.create(privateHost, { ...publicInput, visibility: "PRIVATE", password: "secret", spectatorsEnabled: true, spectatorCapacity: 5 });
    await expect(manager.spectate(host, privateRoom.roomId, {})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(manager.spectate(host, privateRoom.roomId, { password: "secret" })).resolves.toMatchObject({ spectators: 1 });
    await expect(manager.spectate(privateHost, privateRoom.roomId, { password: "secret" })).rejects.toMatchObject({ details: { reason: "SPECTATOR_PLAYER_CONFLICT" } });
  });

  it("keeps the referee role separate from players and binds an invite to one account", async () => {
    const manager = new RoomManager();
    const room = await manager.create({ ...host, principal: "ACCOUNT" }, { ...publicInput, visibility: "PRIVATE", password: "secret", refereeEnabled: true });
    const invite = await manager.inviteReferee(host, room.roomId, accountRef.userId);
    await expect(manager.acceptRefereeInvite({ ...guest, principal: "GUEST" }, invite.inviteId)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(manager.acceptRefereeInvite(accountRef, invite.inviteId)).resolves.toMatchObject({ role: "REFEREE", isReferee: true, refereeUserId: accountRef.userId });
    await expect(manager.join(accountRef, room.roomId, { password: "secret" })).rejects.toMatchObject({ details: { reason: "PLAYER_REFEREE_CONFLICT" } });
    expect(manager.search(room.roomId, accountRef.userId).members).toHaveLength(1);
  });

  it("lists only pending referee invites for the target account and preserves inviter metadata", async () => {
    const manager = new RoomManager();
    const room = await manager.create({ ...host, principal: "ACCOUNT" }, { ...publicInput, visibility: "PRIVATE", password: "secret", refereeEnabled: true });
    const invite = await manager.inviteReferee(host, room.roomId, accountRef.userId);
    expect(manager.refereeInvitesFor(accountRef.userId)).toEqual([expect.objectContaining({ inviteId: invite.inviteId, targetUserId: accountRef.userId, from: { userId: host.userId, username: host.username, displayName: host.displayName }, status: "PENDING" })]);
    expect(manager.refereeInvitesFor(guest.userId)).toEqual([]);
    manager.declineRefereeInvite(accountRef, invite.inviteId);
    expect(manager.refereeInvitesFor(accountRef.userId)).toEqual([]);
  });

  it("supports a host referee with two independent player slots", async () => {
    const manager = new RoomManager();
    const room = await manager.create({ ...host, principal: "ACCOUNT" }, { ...publicInput, visibility: "PRIVATE", password: "secret", refereeEnabled: true, hostRole: "REFEREE" });
    expect(room.players).toBe(0);
    expect(room.role).toBe("REFEREE");
    await manager.join(guest, room.roomId, { password: "secret" });
    await manager.join(third, room.roomId, { password: "secret" });
    expect(manager.search(room.roomId, host.userId).players).toBe(2);
    expect(manager.search(room.roomId, guest.userId).role).toBe("PLAYER");
  });

  it("expires one-use Referee invites and locks role changes after the room starts", async () => {
    vi.useFakeTimers();
    try {
      const manager = new RoomManager();
      const room = await manager.create({ ...host, principal: "ACCOUNT" }, { ...publicInput, visibility: "PRIVATE", password: "secret", refereeEnabled: true });
      const invite = await manager.inviteReferee(host, room.roomId, accountRef.userId, 30);
      vi.advanceTimersByTime(31);
      await expect(manager.acceptRefereeInvite(accountRef, invite.inviteId)).rejects.toMatchObject({ details: { reason: "REFEREE_INVITE_EXPIRED" } });
      const fresh = await manager.inviteReferee(host, room.roomId, accountRef.userId);
      await manager.acceptRefereeInvite(accountRef, fresh.inviteId);
      await manager.join(guest, room.roomId, { password: "secret" });
      const waiting = manager.search(room.roomId, host.userId);
      manager.markPlaying(room.roomId);
      await expect(manager.inviteReferee(host, room.roomId, "u-another")).rejects.toMatchObject({ details: { reason: "ROOM_CONFIG_LOCKED" } });
      expect(() => manager.leaveReferee(room.roomId, accountRef.userId)).toThrowError(expect.objectContaining({ details: { reason: "ROOM_CONFIG_LOCKED" } }));
      expect(waiting.players).toBe(2);

      const raceRoom = await manager.create({ ...third, principal: "ACCOUNT" }, { ...publicInput, visibility: "PRIVATE", password: "secret", refereeEnabled: true });
      const raceInvite = await manager.inviteReferee(third, raceRoom.roomId, accountRef.userId);
      const claims = await Promise.allSettled([
        manager.acceptRefereeInvite(accountRef, raceInvite.inviteId),
        manager.acceptRefereeInvite(accountRef, raceInvite.inviteId),
      ]);
      expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
      expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
