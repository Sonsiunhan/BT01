import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), "ott-r4-restart-"));
const roomFile = join(directory, "room.json");
const childSource = [
  "import { readFileSync, writeFileSync } from 'node:fs';",
  "import { join } from 'node:path';",
  "import { pathToFileURL } from 'node:url';",
  "const root = process.env.R4_ROOT;",
  "const { RoomManager } = await import(pathToFileURL(join(root, 'apps/server/dist/modules/room/room.manager.js')).href);",
  "const { MatchManager } = await import(pathToFileURL(join(root, 'apps/server/dist/modules/match/match.manager.js')).href);",
  "const { FileMatchPersistence } = await import(pathToFileURL(join(root, 'apps/server/dist/modules/match/match.persistence.js')).href);",
  "const phase = process.env.R4_PHASE;",
  "if (phase === 'write') {",
  "  const host = { userId: 'r4-probe-blue', username: 'r4_probe_blue', displayName: 'Blue' };",
  "  const guest = { userId: 'r4-probe-red', username: 'r4_probe_red', displayName: 'Red' };",
  "  const rooms = new RoomManager();",
  "  const created = await rooms.create(host, { name: 'R4 restart probe', visibility: 'PRIVATE', password: 'secret', timerSeconds: 30, spectatorsEnabled: false });",
  "  await rooms.join(guest, created.roomId, { password: 'secret' });",
  "  const room = rooms.search(created.roomId, host.userId);",
  "  const persistence = new FileMatchPersistence(process.env.R4_DIR);",
  "  let now = 40_000;",
  "  const matches = new MatchManager(() => now, 30_000, persistence);",
  "  matches.ready(room, host, true);",
  "  matches.ready(room, guest, true);",
  "  now += 3_001;",
  "  const started = matches.tick(room);",
  "  const moved = matches.move(room, host, 'b1', 'b2', started.stateVersion);",
  "  writeFileSync(process.env.R4_ROOM_FILE, JSON.stringify(room));",
  "  if (moved.board.b2?.side !== 'BLUE') throw new Error('write phase did not commit move');",
  "} else {",
  "  const room = JSON.parse(readFileSync(process.env.R4_ROOM_FILE, 'utf8'));",
  "  const persistence = new FileMatchPersistence(process.env.R4_DIR);",
  "  const matches = new MatchManager(() => 50_000, 30_000, persistence);",
  "  const restored = matches.ensure(room);",
  "  if (restored.board.b2?.side !== 'BLUE' || restored.currentTurn !== 'RED') throw new Error('restart restore mismatch');",
  "  process.stdout.write(JSON.stringify({ matchId: restored.matchId, sequence: restored.sequence, stateVersion: restored.stateVersion, currentTurn: restored.currentTurn }));",
  "}"
].join("\n");

function run(phase) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", childSource], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, R4_ROOT: root, R4_DIR: directory, R4_ROOM_FILE: roomFile, R4_PHASE: phase },
  });
  if (result.status !== 0) throw new Error("R4 " + phase + " phase failed:\n" + result.stderr);
  return result.stdout.trim();
}

try {
  run("write");
  const restored = run("read");
  const room = JSON.parse(readFileSync(roomFile, "utf8"));
  console.log(JSON.stringify({ probe: "R4_PROCESS_RESTART", roomId: room.roomId, restored }));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
