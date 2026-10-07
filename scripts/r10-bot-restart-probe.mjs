import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

// This probe deliberately uses the narrow injected adapter only to exercise
// the durable BotOnline checkpoint seam. It never executes player Python.
// The real isolated provider is covered by the pinned Wasmtime integration
// tests; this probe covers the crash-window fence across two Node processes.
const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), "ott-r10-restart-"));
const roomFile = join(directory, "room.json");
const libraryFile = join(directory, "library.json");
const summaryFile = join(directory, "summary.json");
const matchDirectory = join(directory, "match");
const botDirectory = join(directory, "bot");

const source = "def choose_move(state, memory):\n    return state['legal_moves'][0], memory\n";
const childSource = [
  "import { readFileSync, writeFileSync } from 'node:fs';",
  "import { join } from 'node:path';",
  "import { pathToFileURL } from 'node:url';",
  "const root = process.env.R10_ROOT;",
  "const importDist = (path) => import(pathToFileURL(join(root, path)).href);",
  "const { RoomManager } = await importDist('apps/server/dist/modules/room/room.manager.js');",
  "const { MatchManager } = await importDist('apps/server/dist/modules/match/match.manager.js');",
  "const { FileMatchPersistence } = await importDist('apps/server/dist/modules/match/match.persistence.js');",
  "const { BotLibraryService } = await importDist('apps/server/dist/modules/bot-library/bot-library.service.js');",
  "const { BotOnlineService, FileBotOnlineStatePersistence } = await importDist('apps/server/dist/modules/bot-online/bot-online.service.js');",
  "const blue = { userId: 'r10-probe-blue', username: 'r10_probe_blue', displayName: 'Bot Xanh', principal: 'ACCOUNT' };",
  "const red = { userId: 'r10-probe-red', username: 'r10_probe_red', displayName: 'Bot Đỏ', principal: 'ACCOUNT' };",
  "const source = process.env.R10_SOURCE;",
  "const rows = JSON.parse(readFileSync(process.env.R10_LIBRARY_FILE, 'utf8'));",
  "const clone = (value) => structuredClone(value);",
  "const db = {",
  "  botLibrary: {",
  "    async findMany(args) { return clone(rows.filter((row) => row.ownerUserId === args.where.ownerUserId)); },",
  "    async findFirst(args) { return clone(rows.find((row) => row.ownerUserId === args.where.ownerUserId && (!args.where.name || row.name === args.where.name)) ?? null); },",
  "    async create() { throw new Error('probe database is read-only'); },",
  "    async update() { throw new Error('probe database is read-only'); },",
  "    async delete() { throw new Error('probe database is read-only'); },",
  "  },",
  "  botRevision: {",
  "    async findFirst(args) {",
  "      const revisionId = args.where.id ?? args.where.revisionId;",
  "      for (const row of rows) { const revision = row.revisions.find((candidate) => candidate.id === revisionId); if (revision) return clone({ ...revision, botLibrary: { ownerId: row.ownerUserId }, sourceText: revision.sourceText }); }",
  "      return null;",
  "    },",
  "    async create() { throw new Error('probe database is read-only'); },",
  "    async update() { throw new Error('probe database is read-only'); },",
  "    async delete() { throw new Error('probe database is read-only'); },",
  "  },",
  "};",
  "const adapter = { profile: { isolation: 'WASMTIME_SUPERVISOR', sourceParser: 'ISOLATED_PARSER', network: false, filesystem: false, secrets: false, applicationMounts: false }, async execute(request) { return { move: request.state.legalMoves[0], memory: request.memory }; } };",
  "const persistence = new FileMatchPersistence(process.env.R10_MATCH_DIR);",
  "const botPersistence = new FileBotOnlineStatePersistence(process.env.R10_BOT_DIR);",
  "if (process.env.R10_PHASE === 'write') {",
  "  let now = 40_000;",
  "  const rooms = new RoomManager();",
  "  const created = await rooms.create(blue, { name: 'R10 restart probe', visibility: 'PUBLIC', timerSeconds: 30, playMode: 'BOT', spectatorsEnabled: false });",
  "  await rooms.join(red, created.roomId, {});",
  "  const room = rooms.search(created.roomId, blue.userId);",
  "  const matches = new MatchManager(() => now, 30_000, persistence);",
  "  const library = new BotLibraryService(db);",
  "  const service = new BotOnlineService(library, matches, { adapter, persistence: botPersistence, now: () => now });",
  "  const blueBot = rows[0].revisions[0]; const redBot = rows[1].revisions[0];",
  "  await service.select(room, blue, rows[0].id, blueBot.id); await service.select(room, red, rows[1].id, redBot.id);",
  "  await service.ready(room, blue, true); await service.ready(room, red, true); service.stop(room.roomId);",
  "  now += 3_001; await service.tick(room);",
  "  const snapshot = service.snapshot(room, blue.userId);",
  "  if (snapshot.moves.length !== 1 || snapshot.sequence < 1) throw new Error('write phase did not commit exactly one Bot move');",
  "  writeFileSync(process.env.R10_ROOM_FILE, JSON.stringify(room));",
  "  writeFileSync(process.env.R10_SUMMARY_FILE, JSON.stringify({ roomId: room.roomId, sequence: snapshot.sequence, stateVersion: snapshot.stateVersion }));",
  "} else {",
  "  const room = JSON.parse(readFileSync(process.env.R10_ROOM_FILE, 'utf8'));",
  "  const summary = JSON.parse(readFileSync(process.env.R10_SUMMARY_FILE, 'utf8'));",
  "  const matches = new MatchManager(() => 50_000, 30_000, persistence);",
  "  const library = new BotLibraryService(db);",
  "  const service = new BotOnlineService(library, matches, { adapter, persistence: botPersistence, now: () => 50_000 });",
  "  const before = service.snapshot(room, blue.userId);",
  "  if (before.sequence !== summary.sequence || before.stateVersion !== summary.stateVersion) throw new Error('restart snapshot mismatch');",
  "  await service.tick(room);",
  "  const after = service.snapshot(room, blue.userId);",
  "  if (after.runtimeState !== 'UNAVAILABLE' || after.sequence !== before.sequence || after.stateVersion !== before.stateVersion) throw new Error('stale checkpoint was not fenced');",
  "  process.stdout.write(JSON.stringify({ roomId: room.roomId, sequence: after.sequence, stateVersion: after.stateVersion, runtimeState: after.runtimeState }));",
  "}",
].join("\n");

const libraryRows = [
  { id: "r10-probe-blue-bot", ownerUserId: "r10-probe-blue", name: "Bot Xanh", createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z", usedBytes: source.length, revisions: [{ id: "r10-probe-blue-rev", revisionNumber: 1, sdkVersion: "0.1", schemaVersion: "0.1", sourceDigest: "probe", sourceBytes: source.length, status: "PASSED", validationCode: null, validationMessage: null, preflightMs: 0, createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z", memoryPolicy: "RESET_ON_NEW_REVISION", sourceExpiresAt: null, sourceText: source }] },
  { id: "r10-probe-red-bot", ownerUserId: "r10-probe-red", name: "Bot Đỏ", createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z", usedBytes: source.length, revisions: [{ id: "r10-probe-red-rev", revisionNumber: 1, sdkVersion: "0.1", schemaVersion: "0.1", sourceDigest: "probe", sourceBytes: source.length, status: "PASSED", validationCode: null, validationMessage: null, preflightMs: 0, createdAt: "2026-10-04T00:00:00.000Z", updatedAt: "2026-10-04T00:00:00.000Z", memoryPolicy: "RESET_ON_NEW_REVISION", sourceExpiresAt: null, sourceText: source }] },
];

writeFileSync(libraryFile, JSON.stringify(libraryRows));

function run(phase) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", childSource], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, R10_ROOT: root, R10_PHASE: phase, R10_SOURCE: source, R10_LIBRARY_FILE: libraryFile, R10_ROOM_FILE: roomFile, R10_SUMMARY_FILE: summaryFile, R10_MATCH_DIR: matchDirectory, R10_BOT_DIR: botDirectory },
  });
  if (result.status !== 0) throw new Error(`R10 ${phase} phase failed:\n${result.stderr}`);
  return result.stdout.trim();
}

try {
  run("write");
  const checkpointPath = readdirSync(botDirectory).find((entry) => entry.endsWith(".json"));
  if (!checkpointPath) throw new Error("Bot checkpoint was not written");
  const checkpointFile = join(botDirectory, checkpointPath);
  const checkpoint = JSON.parse(readFileSync(checkpointFile, "utf8"));
  checkpoint.lastCommittedStateVersion += 1;
  checkpoint.lastCommittedSequence += 1;
  writeFileSync(checkpointFile, JSON.stringify(checkpoint));
  const restored = run("read");
  console.log(JSON.stringify({ probe: "R10_PROCESS_RESTART_CHECKPOINT_FENCE", restored }));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
