# 03_NETWORK_SPEC.md

# Network Protocol, Game State, Event Model & Serialization Specification

**Status:** PROTOCOL FROZEN — READY FOR IMPLEMENTATION  
**Version:** 1.0  
**Protocol Readiness:** 100%  
**Scope:** Core Network Protocol & OTTv2 Game Protocol  
**Game-specific extensions:** RESOLVED (OTTv2 9x9 Board Game + playfull.html sync)

---

# 1. Purpose

Tài liệu này là **technical contract** giữa Game Client và Game Server.

Nếu:

- `SRS.md` định nghĩa **WHAT**
- `01_PROJECT_SPEC.md` định nghĩa **PROJECT SCOPE**
- `02_ARCHITECTURE.md` định nghĩa **WHERE / RESPONSIBILITY**
- `03_NETWORK_SPEC.md` định nghĩa **EXACTLY HOW CLIENT ↔ SERVER COMMUNICATE**

thì mọi implementation liên quan đến Network Protocol, Game State Synchronization, Event, Snapshot, Delta, Resync, Reconnect và Serialization phải tuân thủ tài liệu này.

Đây là **Protocol Source of Truth** sau khi Protocol Freeze.

---

# 2. AI AGENT GUIDING

AI Coding Agent MUST:

1. Read:
   - `SRS.md`
   - `01_PROJECT_SPEC.md`
   - `02_ARCHITECTURE.md`
   - `03_NETWORK_SPEC.md`
   - Teacher Assignment

2. Treat this document as the authoritative Core Network Protocol contract.

3. MUST NOT:
   - invent game rules;
   - invent game-specific Commands;
   - invent game-specific Events;
   - allow Client to mutate Server-authoritative state;
   - silently change message semantics;
   - silently change sequence semantics;
   - silently change serialization/hash behavior;
   - bypass Validation / Concurrency / Sync layers;
   - introduce a new transport without an approved decision.

4. Game-specific requirements may extend:
   - Game State;
   - Game Commands;
   - Game Events;
   - World Objects;
   - Game Validation.

5. Game-specific extension MUST NOT silently modify Core Protocol semantics.

6. Any protocol change after Freeze MUST:
   - identify affected requirements;
   - identify affected messages;
   - identify implementation impact;
   - identify test impact;
   - update traceability;
   - update Change Log;
   - record Architecture/Protocol Decision when applicable.

7. Before implementation, AI MUST verify that no Critical Protocol Decision remains unresolved.

---

# 3. Protocol Principles

The Core Network Protocol follows these principles:

1. **Deterministic State & Recovery First**
2. Server-authoritative canonical state.
3. Client sends Commands/Inputs, not authoritative State mutations.
4. Explicit protocol contracts.
5. Deterministic serialization.
6. Explicit ordering semantics.
7. Explicit reliability semantics.
8. Idempotency and duplicate handling.
9. Sequence-based synchronization.
10. Snapshot + Delta/Event synchronization.
11. Replay before Snapshot fallback.
12. Room isolation.
13. Graceful reconnect.
14. Fail safely and isolate protocol errors.
15. Measure network behavior rather than assuming performance.
16. Core Protocol must remain independent from specific gameplay.

---

# 4. Transport Model

## 4.1 HTTP Control Plane

HTTP is used for control/lifecycle operations such as:

- Create Room
- Join Room
- Session-related operations
- Initial room authorization
- Other non-realtime control operations

HTTP MUST NOT be used as the primary realtime gameplay synchronization channel.

---

## 4.2 WebSocket Realtime Plane

WebSocket is used for:

- gameplay Commands;
- State synchronization;
- Game Events;
- Presence;
- Snapshot;
- Resync;
- Heartbeat;
- realtime Error reporting.

---

# 5. Direction Semantics

Message direction is defined in the protocol catalog.

Allowed directions:

| Direction | Meaning |
|---|---|
| `C→S` | Client to Server |
| `S→C` | Server to Client |
| `C↔S` | Bidirectional |
| `BROADCAST` | Server → all relevant Room members |
| `MULTICAST` | Server → selected clients / Room members |

Direction is **protocol documentation metadata**, not a runtime envelope field.

---

# 6. Message Categories

Core message categories:

1. `CONNECTION`
2. `SESSION`
3. `ROOM`
4. `PLAYER`
5. `GAME`
6. `STATE`
7. `EVENT`
8. `PRESENCE`
9. `ERROR`
10. `SNAPSHOT`
11. `RESYNC`
12. `HEARTBEAT`

---

# 7. Message Naming Convention

Message types MUST use:

```text
UPPER_SNAKE_CASE
```

Examples:

```text
CREATE_ROOM
JOIN_ROOM
JOIN_ROOM_ACCEPTED
PLAYER_READY
GAME_START
MOVE_INPUT
STATE_DELTA
GAME_EVENT
STATE_SNAPSHOT
RESYNC_REQUEST
ERROR
PING
PONG
```

---

# 8. Common Message Envelope

Baseline envelope:

```json
{
  "version": 1,
  "messageId": "...",
  "type": "...",
  "clientTimestamp": "...",
  "serverTimestamp": "...",
  "roomId": "...",
  "playerId": "...",
  "sequence": 123,
  "correlationId": "...",
  "payload": {}
}
```

## 8.1 Envelope Fields

| Field | Status | Meaning |
|---|---|---|
| `version` | Required | Protocol version |
| `messageId` | Required | Unique message identity |
| `type` | Required | Message type |
| `clientTimestamp` | Conditional | Client-originated timestamp |
| `serverTimestamp` | Conditional | Server timestamp |
| `roomId` | Conditional | Room context |
| `playerId` | Conditional | Player context |
| `sequence` | Conditional | Room synchronization sequence |
| `correlationId` | Conditional | Request/response correlation |
| `payload` | Required | Message-specific payload |

Exact required/optional applicability MUST be defined by the message catalog/schema.

---

# 9. Message Identity

`messageId` is the primary identity of a protocol message.

It is used for:

- tracing;
- duplicate detection;
- idempotency;
- correlation support where applicable.

There is no separate `idempotencyKey`.

`messageId` SHOULD be globally collision-safe.

Recommended implementation:

- UUID;
- ULID;
- equivalent collision-safe identifier.

---

# 10. Correlation

`correlationId` is used when a message represents a request that has an independent outcome.

Example:

```text
JOIN_ROOM
correlationId = abc
        ↓
JOIN_ROOM_ACCEPTED
correlationId = abc
```

A fire-and-forget input such as `MOVE_INPUT` does not require a response correlation.

---

# 11. Sequence Model

## 11.1 Scope

Sequence is scoped per Room.

```text
Room A
  101
  102
  103

Room B
  101
  102
```

Sequences from different Rooms are independent.

---

## 11.2 Purpose

Sequence is used for:

- ordering;
- gap detection;
- replay;
- resynchronization;
- state recovery.

Sequence is **not** a generic packet counter.

---

## 11.3 Logical Synchronization Unit

A logical state transition is represented by one Room sequence.

A transition may contain:

```text
sequence N
├── STATE_DELTA
└── GAME_EVENT
```

`STATE_DELTA` and `GAME_EVENT` remain independent protocol message types but belong to the same logical synchronization transition.

The Server MUST publish the complete logical transition before exposing the resulting sequence as part of live synchronized state.

---

# 12. Ordering

Ordering semantics are message-specific.

Each catalog entry MUST define:

```text
STRICT
LATEST_STATE
NONE
BASELINE
```

Examples:

| Message | Ordering |
|---|---|
| `GAME_EVENT` | STRICT |
| `STATE_DELTA` | STRICT |
| `STATE_SNAPSHOT` | BASELINE |
| `PRESENCE_UPDATE` | LATEST_STATE |
| `MOVE_INPUT` | NONE / COALESCIBLE |

Client MUST NOT apply an ordered Delta/Event sequence that violates its synchronization contract.

---

# 13. Reliability

Reliability is a protocol property, not a runtime envelope field.

Baseline:

| Category | Reliability |
|---|---|
| CONTROL | Reliable |
| STATE | Reliable |
| SNAPSHOT | Reliable |
| ERROR | Reliable |
| COMMAND | Message-specific |
| EVENT | Message-specific |
| PRESENCE | Semantic-dependent |
| MOVE_INPUT | Unreliable / latest-state |
| HEARTBEAT | Transport-level |

Each message catalog entry MUST define its reliability semantics.

---

# 14. Duplicate Handling

Duplicate handling depends on message semantics.

### Idempotent message

Duplicate may safely be ignored.

Example:

```text
PLAYER_READY
```

### Non-idempotent message

Server MUST deduplicate using `messageId`.

If the original outcome is still available:

```text
duplicate request
      ↓
return previous outcome
```

If the original outcome is no longer available:

```text
duplicate request
      ↓
safe deterministic handling
```

Duplicate gameplay Commands MUST NOT cause unintended duplicate state mutation.

---

# 15. Client Input Model

Client sends:

```text
Command / Input
```

Client MUST NOT send authoritative:

```text
STATE_DELTA
SET_POSITION
SET_SCORE
SET_HP
SET_GAME_STATE
```

as a mechanism to mutate Server state.

---

# 16. MOVE_INPUT / PIECE_MOVE

Baseline payload for OTTv2 9x9 Board Game (King-like 8-direction movement):

```json
{
  "pieceId": "p1_rock_1",
  "from": {
    "x": 0,
    "y": 0
  },
  "to": {
    "x": 1,
    "y": 1
  }
}
```

Or algebraic notation representation:
```json
{
  "pieceId": "p1_rock_1",
  "from": "a1",
  "to": "b2"
}
```

Movement is:

- Client intent/command (`PIECE_MOVE`);
- Server authoritative;
- Strictly validated against 8-direction King-movement rules (`max(|dx|, |dy|) === 1`);
- Validated against 9x9 boundaries (`0 <= x <= 8, 0 <= y <= 8`);
- Validated against combat rules (Rock beats Scissors, Scissors beats Paper, Paper beats Rock);
- Validated against blocking rules (same-type pieces or friendly pieces block each other);
- Server reconciled and broadcast via `STATE_DELTA` / `PIECE_MOVED` / `PIECE_CAPTURED`.

Client prediction is permitted **only for local piece selection/highlighting and tentative movement visualization**.

`PIECE_MOVE` is:

- ordered per room;
- validated upon arrival;
- processed deterministically.

---

# 17. Room Lifecycle Messages

## 17.1 CREATE_ROOM

Transport:

```text
HTTP
```

Flow:

```text
CREATE_ROOM
    ↓
Session Validation
    ↓
Room Creation
    ↓
HTTP Response
    ↓
WebSocket Authentication
    ↓
STATE_SNAPSHOT
```

---

## 17.2 JOIN_ROOM

HTTP request contains:

```json
{
  "roomId": "...",
  "joinCode": "...",
  "displayName": "..."
}
```

Server:

1. validates Session;
2. validates Room;
3. validates Join Code / authorization;
4. creates membership;
5. generates `playerId`;
6. returns acceptance;
7. establishes WebSocket;
8. sends Snapshot.

---

## 17.3 JOIN_ROOM_ACCEPTED

Payload:

```json
{
  "roomId": "...",
  "playerId": "..."
}
```

Snapshot is a separate message.

---

# 18. Identity Model

The following identifiers are distinct:

```text
sessionId
playerId
roomId
messageId
correlationId
```

Server generates `playerId`.

Client supplies `displayName`.

`roomId` alone is not authorization.

Room access requires valid:

- Session;
- Join Code / Room Token;
- Room membership.

---

# 19. Player State

Player State consists of:

```text
Identity
Presence
Gameplay
Network Metadata
```

The Server owns the canonical Player State.

Client receives only network metadata necessary for the Client's function.

Server-only metadata MUST NOT be serialized into Client-visible State.

---

# 20. Room State

Room State includes:

- lifecycle;
- members;
- player membership;
- configuration;
- game status;
- relevant presence information.

Room Manager owns Room lifecycle.

Game Engine owns gameplay state.

---

# 21. Match State

Match State is independent from Room State but linked to the Room.

Example conceptual relationship:

```text
Room
 ├── lifecycle
 ├── members
 └── Match
      ├── gameplay state
      ├── world state
      └── result
```

Exact gameplay fields for OTTv2:

```json
{
  "boardSize": 9,
  "board": [
    ["p1_r1", "p1_p1", "p1_s1", "p1_r2", "p1_p2", "p1_s2", "p1_r3", "p1_p3", "p1_s3"],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    ["p2_s1", "p2_p1", "p2_r1", "p2_s2", "p2_p2", "p2_r2", "p2_s3", "p2_p3", "p2_r3"]
  ],
  "currentTurn": "player1",
  "remainingCounts": {
    "player1": { "ROCK": 3, "PAPER": 3, "SCISSORS": 3 },
    "player2": { "ROCK": 3, "PAPER": 3, "SCISSORS": 3 }
  },
  "goalSquares": {
    "a1": { "x": 0, "y": 0 },
    "i9": { "x": 8, "y": 8 }
  },
  "winnerId": null,
  "winReason": null
}
```

---

# 22. World Object Model

World Objects MUST have a Server-generated identifier.

Authority is modeled through:

```text
authorityOwner
```

A World Object does not necessarily have an `ownerPlayerId`.

The OTTv2 World Object is the **Piece (Quân cờ)**:

```typescript
interface PieceObject {
  objectId: string;             // e.g. "p1_rock_1", "p2_scissors_2"
  type: "ROCK" | "PAPER" | "SCISSORS";
  ownerPlayerId: string;        // "player1" | "player2"
  position: {
    x: number;                  // 0..8 (columns a..i)
    y: number;                  // 0..8 (rows 1..9)
  };
  isAlive: boolean;             // true if on board, false if captured
  lastMovedAt?: number;         // timestamp for cooldown tracking
}
```

---

# 23. State Ownership

Baseline ownership model:

| State | Authority |
|---|---|
| Canonical Game State | Server |
| Room Lifecycle | Server |
| Player Identity | Server |
| Player Presence | Server |
| Player Gameplay State | Server |
| Movement Prediction | Client temporary prediction |
| Shared Read-only State | Server → Client |
| Client UI State | Client |

The State Ownership Matrix in `SRS.md` is authoritative for detailed field-level ownership.

---

# 24. State Mutation Pipeline

Every game-critical Client command follows:

```text
Client Command
      ↓
Protocol Validation
      ↓
Game Validation
      ↓
Concurrency / Ordering
      ↓
Game Engine
      ↓
Canonical Game State
      ↓
Sync Engine
      ↓
STATE_DELTA / GAME_EVENT
      ↓
Clients
```

Client MUST NOT bypass this pipeline.

---

# 25. STATE_DELTA

`STATE_DELTA` represents a change to canonical State.

Payload:

```json
{
  "changes": [
    {
      "path": "players.p1.position",
      "value": {
        "x": 100,
        "y": 200
      }
    }
  ]
}
```

Delta semantics are **replacement/set**.

There is no generic operation field such as:

```text
ADD
REMOVE
PATCH
```

unless a future game-specific protocol extension explicitly requires it.

---

# 26. Delta Granularity

Delta granularity is:

```text
Object / Property Group
```

rather than necessarily one individual scalar property.

Example:

```json
{
  "path": "players.p1.position",
  "value": {
    "x": 100,
    "y": 200
  }
}
```

---

# 27. Delta Application

Client MUST:

1. verify expected sequence;
2. validate message schema;
3. apply changes deterministically;
4. update local sequence;
5. detect application failure.

If Delta application fails:

```text
log
  ↓
RESYNC_REQUEST
```

Client MUST NOT silently continue with potentially corrupted state.

---

# 28. GAME_EVENT

A Game Event describes:

> What happened.

An Event does not itself represent the complete resulting State.

Concrete Event Types in OTTv2:

```text
- PIECE_MOVED: { pieceId, from, to, nextTurn }
- PIECE_CAPTURED: { attackerId, victimId, at: {x, y}, remainingCounts }
- PIECE_BLOCKED: { pieceId, blockedAt: {x, y}, reason: "SAME_TYPE" | "FRIENDLY" }
- GOAL_SQUARE_REACHED: { pieceId, ownerId, square: "a1" | "i9" }
- PIECE_TYPE_EXTINCT: { victimPlayerId, extinctType: "ROCK" | "PAPER" | "SCISSORS" }
- GAME_OVER: { winnerId, winReason, finalScores }
```

`type` in the common envelope is the Event type.

There is no duplicate `eventType` field.

---

# 29. Event Persistence

Events are transient by default.

Events may be persisted only when required for:

- replay;
- debugging;
- audit;
- history;
- benchmark analysis.

Live gameplay does not depend on persistent event storage.

---

# 30. STATE_TRANSITION Logical Model

A logical Server state transition may consist of:

```text
Transition N
 ├── STATE_DELTA
 └── GAME_EVENT
```

Both belong to the same Room sequence.

This is a **logical synchronization concept**, not an additional mandatory wire message.

`STATE_DELTA` and `GAME_EVENT` remain independently typed protocol messages.

---

# 31. Snapshot

Snapshot is the canonical state representation at a specific Room sequence.

Payload:

```json
{
  "state": {},
  "stateSchemaVersion": 1,
  "stateHash": "..."
}
```

The envelope contains:

```json
{
  "sequence": 110
}
```

Therefore:

```text
STATE_SNAPSHOT @ sequence 110
```

means the included State represents canonical Room state at sequence 110.

---

# 32. Snapshot Visibility

Snapshot MUST contain all state required by the Client for the Room.

Snapshot MUST NOT contain:

- Server-only internal state;
- secrets;
- internal error information;
- unauthorized Room state;
- unrelated Room state.

---

# 33. State Hash

Default algorithm:

```text
SHA-256
```

Hashing MUST use deterministic canonical serialization.

The hash algorithm MUST be abstracted so it can be changed without redesigning the State model.

---

# 34. Canonical Serialization

Canonical State serialization:

```text
Deterministic JSON
+
sorted object keys
+
schema-defined array semantics
```

Object key order MUST NOT affect the logical hash.

Array ordering is determined by the semantics of the field.

Arrays MUST NOT be blindly sorted when their order has semantic meaning.

---

# 35. State Schema Version

Protocol version and State Schema Version are separate.

```text
Protocol Version
    ≠
State Schema Version
```

Example:

```json
{
  "stateSchemaVersion": 1
}
```

An incompatible State Schema MUST result in a clear protocol/schema error.

---

# 36. RESYNC_REQUEST

Payload:

```json
{
  "lastAppliedSequence": 105,
  "receivedSequence": 107
}
```

Meaning:

- Client believes it has applied through `105`;
- Client observed a later sequence `107`;
- sequence `106` or another required transition is missing.

---

# 37. Resynchronization Strategy

Recovery priority:

```text
1. Replay
2. Snapshot fallback
```

Server first determines whether the replay buffer can satisfy the requested recovery.

If yes:

```text
Replay logical synchronization bundles
```

If no:

```text
STATE_SNAPSHOT
```

---

# 38. Replay Buffer

Replay buffer is bounded per Room.

The replay unit is the logical synchronization transition:

```text
Sequence 101
Sequence 102
...
Sequence 110
```

Each transition preserves the associated:

- State Delta;
- Game Event(s);
- sequence.

Replay MUST preserve deterministic ordering and semantics.

---

# 39. Replay Fallback

If the required replay range is no longer available:

```text
RESYNC_REQUEST
      ↓
Replay unavailable
      ↓
STATE_SNAPSHOT
      ↓
Hash verification
      ↓
Continue live synchronization
```

---

# 40. Resync Completion

Resync is complete when:

1. Client has recovered the required sequence range;
2. Client's State is valid;
3. sequence is continuous;
4. hash verification succeeds where applicable;
5. Client resumes live synchronization.

Persistent hash mismatch:

```text
log
→ retry/resync
→ disconnect if recovery persistently fails
```

---

# 41. Presence Model

Presence is latest-state oriented.

Typical states include:

```text
CONNECTED
READY
PLAYING
DISCONNECTED
```

Exact gameplay presence states may be extended.

Presence does not require complete historical replay.

If Presence updates arrive out of order, latest valid state semantics apply according to the message catalog.

---

# 42. Disconnect

Transport disconnect is detected by:

- WebSocket close;
- PING/PONG failure;
- transport-level failure.

Gateway detects transport failure.

Session Manager handles player/session lifecycle.

Room Manager updates membership/presence as required.

---

# 43. Grace Period

On disconnect:

```text
Player
   ↓
DISCONNECTED
   ↓
Grace Period
```

During the grace period:

- identity is retained;
- state is retained;
- membership is retained.

Reconnect within grace restores the previous identity.

After grace expires:

```text
old player session expires
```

A later reconnect creates a new player identity.

Grace period is configurable.

---

# 44. Reconnect

Reconnect uses the previous valid Session Token.

Flow:

```text
Reconnect
    ↓
Session validation
    ↓
Identity restoration
    ↓
Room restoration
    ↓
Replay if possible
    ↓
Snapshot fallback if necessary
    ↓
Hash verification
    ↓
Live synchronization
```

Reconnect generates the appropriate Event/state updates so other players receive correct presence.

---

# 45. Heartbeat

WebSocket heartbeat uses:

```text
PING
PONG
```

Heartbeat exists to:

- detect stale connections;
- support disconnect detection;
- maintain transport liveness.

Heartbeat is transport/control behavior and is not part of game simulation tick.

---

# 46. Server Tick vs Network Messages

Network messages are independent from the Game Tick.

The Server may process network messages asynchronously while Game simulation executes at a fixed/configurable tick.

For movement:

```text
MOVE_INPUT
      ↓
Input handling
      ↓
Game Tick
      ↓
Authoritative movement
```

The Game Tick determines simulation time.

---

# 47. Input Coalescing

Input coalescing is allowed when message semantics permit it.

`MOVE_INPUT` is the primary example.

The Server MUST NOT coalesce Commands when doing so changes their required semantics.

---

# 48. Concurrency

For concurrent valid game Commands:

```text
first valid request received by Server wins
```

The relevant ordering point is the Server-side accepted request after required protocol validation.

Concurrency handling MUST produce deterministic canonical state.

---

# 49. Validation Layers

Two validation layers exist.

## Protocol Validation

Validates:

- envelope;
- message type;
- schema;
- version;
- field format;
- required fields;
- payload structure.

## Game Validation

Validates:

- gameplay rules;
- permissions within gameplay;
- state-dependent legality;
- game-specific constraints.

Pipeline:

```text
Protocol Validation
        ↓
Game Validation
        ↓
Concurrency / Ordering
        ↓
Game Engine
```

---

# 50. Client Inbound Validation

Client MUST validate inbound messages before applying them.

Validation includes:

- schema;
- version;
- expected message type;
- sequence;
- payload;
- State Schema Version;
- authorization/context assumptions where applicable.

Client validation failure MUST NOT corrupt local State.

---

# 51. Server Inbound Validation

Server MUST validate every inbound protocol message before processing.

Invalid input MUST NOT directly mutate canonical State.

---

# 52. Error Model

Unified semantic Error payload:

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found",
  "retryable": false,
  "details": {}
}
```

`details` is optional.

Internal details MUST NOT be exposed to Client.

---

# 53. Error Severity

Three semantic levels:

```text
RECOVERABLE
INVALID
FATAL
```

Baseline mapping:

```text
RECOVERABLE
    → ERROR

INVALID
    → ERROR

FATAL
    → ERROR
    → disconnect when necessary
```

Transport-specific HTTP status / WebSocket close code is a mapping layer and MUST NOT redefine the semantic Error Catalog.

---

# 54. Error Catalog

Semantic Error Codes SHOULD include categories such as:

```text
ROOM_NOT_FOUND
INVALID_JOIN_CODE
UNAUTHORIZED
SESSION_INVALID
PROTOCOL_VERSION_MISMATCH
STATE_SCHEMA_VERSION_UNSUPPORTED
INVALID_MESSAGE
INVALID_COMMAND
RATE_LIMITED
RESYNC_REQUIRED
STATE_HASH_MISMATCH
```

Exact catalog may be extended as implementation requires.

Each error MUST define:

- semantic code;
- severity;
- retryability;
- transport mapping;
- whether connection/session isolation is required.

---

# 55. Malformed Messages

Malformed messages MUST NOT crash the Server or Room.

Baseline behavior:

```text
Malformed input
    ↓
Protocol validation failure
    ↓
ERROR
```

The connection remains safe when possible.

Repeated/severe/malicious protocol violations may result in disconnection.

---

# 56. Unknown Messages

## Unknown Optional Message

```text
ignore
+
log
```

## Unknown Critical Message

```text
protocol error
+
terminate affected session/connection
if unsafe to continue
```

The Room process itself MUST remain isolated from the protocol error.

---

# 57. Version Compatibility

Protocol compatibility MUST test:

- same version;
- supported older version where compatibility is intentionally provided;
- unsupported version;
- invalid version.

Incompatible versions MUST fail clearly.

No silent protocol downgrade is permitted unless explicitly defined by the compatibility contract.

---

# 58. Security Boundaries

The Client MUST NOT be trusted for authoritative State.

Examples of forbidden direct state mutation Commands:

```text
SET_POSITION
SET_SCORE
SET_HP
SET_GAME_STATE
```

If the Client sends an unauthorized state mutation request:

```text
Protocol/Game Validation
        ↓
reject
        ↓
ERROR
```

Repeated malicious behavior may trigger rate limiting and eventual disconnect.

---

# 59. Room Isolation

A Client belonging to Room A MUST NOT:

- read Room B State;
- mutate Room B State;
- receive Room B Snapshot;
- receive Room B private synchronization data.

Room isolation is enforced through:

- Session;
- Authorization;
- Room Manager;
- state boundaries;
- WebSocket membership;
- protocol validation.

Room ID is not itself an authorization credential.

---

# 60. Rate Limiting

Rate limiting is hybrid.

## Gateway / Connection Level

Protects:

- connection creation;
- message throughput;
- transport abuse.

## Game Action Level

Protects:

- gameplay Commands;
- action frequency;
- abuse of game-critical operations.

On rate limit:

```text
ERROR
+
temporary throttling
```

Repeated/severe violations may cause disconnect.

---

# 61. Persistence

Live gameplay State exists in memory.

Database is a soft dependency.

Persistence may store:

- match history;
- selected logs;
- benchmark data;
- selected audit/replay information.

Database failure MUST NOT terminate an otherwise healthy live match.

If persistence is unavailable:

```text
Live match continues
Persistence becomes degraded
```

---

# 62. Server Restart

Server restart may terminate a live match.

The protocol does not require live-match continuation across restart.

Selected match history may survive when persistence is available.

---

# 63. Protocol and Game Engine Separation

Game Engine MUST NOT depend directly on:

- WebSocket;
- HTTP;
- Session transport;
- network serialization.

Game Engine receives application-level Command/Input.

Network layer translates transport messages into application Commands.

---

# 64. Sync Engine Responsibility

Sync Engine is responsible for:

- Snapshot;
- Delta;
- Event synchronization;
- sequence tracking;
- gap detection;
- replay;
- resync;
- State hash verification.

Sync Engine MUST NOT directly mutate canonical Game State.

Canonical State mutation belongs to Game Engine / Game State Store.

---

# 65. Message Processing Pipeline

General Server processing:

```text
Transport
    ↓
Protocol Decode
    ↓
Protocol Validation
    ↓
Session / Authorization
    ↓
Game Validation
    ↓
Concurrency / Ordering
    ↓
Game Engine
    ↓
Canonical State
    ↓
Sync Engine
    ↓
Serialize
    ↓
WebSocket / HTTP
```

---

# 66. Serialization Contract

Protocol source of truth consists of:

1. JSON Schema;
2. typed implementation models;
3. Markdown examples in this specification.

All three MUST remain consistent.

Contract tests MUST verify:

```text
JSON Schema
    ↔
Typed Model
    ↔
Serialized JSON
```

---

# 67. Serialization Round-trip

Serialization tests MUST verify:

- structural equality;
- semantic equality.

Byte-identical serialization is not required as a universal acceptance condition, although canonical serialization MUST be deterministic for hashing.

---

# 68. Protocol Test Ownership

Protocol tests are owned by both:

```text
Client
+
Server
```

Protocol correctness is not considered complete if only one side is tested.

---

# 69. Protocol Test Matrix

Minimum test classes:

| Test | Required |
|---|---|
| Schema validation | Yes |
| Typed model validation | Yes |
| Serialization | Yes |
| Contract | Yes |
| Unit | Yes |
| Integration | Yes |
| E2E | Yes |
| Concurrency | Yes |
| Network degradation | Yes |
| Load | Yes |
| Benchmark | Yes |

---

# 70. Required Acceptance Scenarios

## Create Room

Acceptance requires:

```text
HTTP Create
+
Session
+
Room created
+
WebSocket authentication
+
Snapshot
+
automated evidence
```

---

## Join Room

Acceptance requires:

```text
Join authorization
+
membership
+
WebSocket
+
Snapshot
+
Presence
+
automated evidence
```

---

## State Synchronization

Acceptance requires:

```text
Server State mutation
+
correct Delta/Event
+
relevant clients receive it
+
sequence verification
+
hash verification where applicable
```

---

## Sequence Gap

Acceptance:

```text
Gap detected
+
RESYNC_REQUEST
+
Replay/Snapshot
+
state recovered
+
final hash consistent
```

---

## Duplicate

Acceptance:

```text
No crash
+
no unintended duplicate mutation
+
deterministic result
+
idempotency/non-idempotency semantics verified
```

---

## Concurrent Commands

Acceptance:

```text
No crash
+
deterministic processing
+
first valid Server receipt wins
+
final canonical State consistent
```

---

## Reconnect

Acceptance:

```text
WebSocket reconnect
+
identity restored
+
State restored
+
other players receive correct presence
```

---

## Reconnect After Grace

Acceptance:

```text
old identity expires
+
new player identity created
+
Room remains consistent
```

---

# 71. Network Degradation Tests

Required scenarios:

## Latency

Measure:

- RTT;
- message latency;
- gameplay/reconciliation impact.

## Packet Loss

Verify:

- missing ordered message detection;
- recovery;
- final State/hash consistency.

## Disconnect

Verify:

- Server detection;
- Presence update;
- Grace Period;
- reconnect recovery.

---

# 72. Snapshot Integrity Test

Verify:

```text
same logical State
+
same State Hash
+
same sequence
```

between expected and recovered Snapshot.

---

# 73. Replay Integrity Test

Example:

```text
Snapshot @ 100
+
Transitions 101..110
```

must result in:

```text
State == live State @ 110
sequence == 110
hash == expected hash
```

---

# 74. Snapshot Fallback Test

When replay buffer cannot satisfy recovery:

```text
Snapshot sent
+
State recovered
+
hash matches
+
sequence valid
```

must be demonstrated automatically.

---

# 75. Unknown Message Tests

Tests MUST cover both:

### Optional unknown

```text
ignore + log
```

### Critical unknown

```text
protocol error
+
safe termination when required
```

---

# 76. Security Acceptance

Minimum security acceptance includes:

- unauthorized state mutation rejected;
- cross-Room access rejected;
- no state leakage;
- internal error details not exposed;
- rate limiting works;
- malicious repeated requests eventually isolated.

---

# 77. Performance Metrics

Protocol performance MUST measure:

### Network

- messages/sec;
- bytes/sec;
- message latency;
- RTT;
- packet loss/recovery.

### Server

- CPU;
- memory;
- active connections;
- tick processing time.

### Correctness

- desynchronization;
- duplicate processing;
- missing message recovery;
- reconnect success;
- conflict resolution.

---

# 78. Protocol Benchmark

Mandatory comparison:

```text
STATE_SNAPSHOT
        vs
STATE_DELTA + GAME_EVENT
```

The benchmark MUST measure the practical trade-off between:

- payload size;
- bytes/sec;
- messages/sec;
- latency;
- processing overhead;
- CPU;
- memory;
- recovery cost.

The benchmark MUST use actual implementation measurements.

---

# 79. Load Test

Load testing MUST include:

1. One Room with many players.
2. Multiple Rooms with multiple players.

Load should represent:

```text
game capacity × N rooms
```

where the concrete N is adapted to:

- game requirements;
- hardware;
- lecturer/demo environment.

No autoscaling requirement exists.

---

# 80. Load Test Evidence

A completed load test requires:

```text
stability
+
sufficient load
+
metrics
+
results
+
charts
+
analysis
```

---

# 81. Protocol Traceability

Every Core Protocol requirement MUST be traceable through:

```text
Requirement
    ↓
Message
    ↓
Implementation
    ↓
Test
    ↓
Acceptance
```

Example:

```text
SRS-NET-XXX
    ↓
STATE_DELTA
    ↓
Sync Engine
    ↓
State Sync Integration Test
    ↓
Hash/Sequence Acceptance
```

Actual IDs MUST be linked to the authoritative requirement IDs when the final requirement catalog is generated.

---

# 82. Message Catalog Contract

Every message in the official Message Catalog MUST define at minimum:

| Field | Required |
|---|---|
| Message Type | Yes |
| Group | Yes |
| Scope | Yes |
| Direction | Yes |
| Transport | Yes |
| Payload Schema | Yes |
| Reliability | Yes |
| Ordering | Yes |
| Idempotency | Yes |
| Correlation | Yes |
| Behavior | Yes |
| Test Coverage | Yes |
| Example | Yes |

Scope:

```text
CORE
CORE-CONDITIONAL
GAME-DEPENDENT
```

---

# 83. Core Message Catalog Baseline

| Message | Scope | Transport | Direction | Purpose |
|---|---|---|---|---|
| `CREATE_ROOM` | CORE | HTTP | C→S | Create Room |
| `JOIN_ROOM` | CORE | HTTP | C→S | Request membership |
| `JOIN_ROOM_ACCEPTED` | CORE | HTTP/WS flow | S→C | Confirm membership |
| `PLAYER_READY` | CORE | WS | C→S | Ready state |
| `GAME_START` | CORE | WS | S→C | Match start Event |
| `MOVE_INPUT` | CORE-CONDITIONAL | WS | C→S | Movement input |
| `STATE_SNAPSHOT` | CORE | WS | S→C | Canonical state |
| `STATE_DELTA` | CORE | WS | S→C | State changes |
| `GAME_EVENT` | CORE | WS | S→C | Domain event |
| `RESYNC_REQUEST` | CORE | WS | C→S | Request recovery |
| `ERROR` | CORE | HTTP/WS | S→C | Semantic error |
| `PING` | CORE | WS | C↔S | Heartbeat |
| `PONG` | CORE | WS | C↔S | Heartbeat response |
| `PIECE_MOVE` | OTTv2-CORE | WS | C→S | 8-direction King move intent |
| `PIECE_MOVED` | OTTv2-CORE | WS | S→C | Broadcast successful move |
| `PIECE_CAPTURED` | OTTv2-CORE | WS | S→C | Broadcast RPS piece captured |
| `PIECE_BLOCKED` | OTTv2-CORE | WS | S→C | Broadcast blocked collision |
| `GAME_OVER` | OTTv2-CORE | WS | S→C | Match conclusion event |
| `PLAYFULL_SYNC` | PLAYFULL | WS | C↔S | playfull.html element attribute sync |

The catalog may be extended with required infrastructure messages without changing the Core semantics, provided the addition is documented and tested.

---

# 84. OTTv2 Protocol & playfull.html Extensions

The Teacher Assignment for Bài 2 (OTTv2 + playfull.html) defines:

```text
Game Mode: OTTv2 9x9 Board Game (Rock-Paper-Scissors v2)
Grid: 9x9 (a1..i9)
Movement: 8 directions, 1 square distance (like Chess King)
Combat: Rock beats Scissors, Scissors beats Paper, Paper beats Rock
Blocking: Same-type pieces block each other; friendly pieces block
Victory Conditions:
  1. Complete extinction of any one piece type of the opponent
  2. Reaching goal square a1 or i9 with any piece
Synchronization Library / Paradigm: playfull.html (similar to playhtml.fun)
  - DOM elements bind to shared board state
  - WebSocket synchronizes state changes to play-element attributes
```

---

# 85. Protocol Freeze Rules

Core Protocol is frozen after:

- AI Audit ≥95%;
- no Critical Protocol Decision;
- User/Team confirmation;
- no unresolved Core Protocol TODO.

This document has reached:

```text
PROTOCOL FREEZE — CONFIRMED
```

---

# 86. Post-Freeze Change Process

Any Core Protocol change requires:

1. Identify affected requirement.
2. Identify affected message.
3. Identify affected state.
4. Identify affected implementation.
5. Identify affected tests.
6. Identify compatibility impact.
7. Update Schema.
8. Update typed model.
9. Update examples.
10. Update traceability.
11. Update Change Log.
12. Re-run Protocol Consistency Audit.

No silent protocol modification is permitted.

---

# 87. Protocol Definition of Done

Network Protocol is DONE only when:

- [ ] Message Schema complete
- [ ] Typed implementation complete
- [ ] Serialization complete
- [ ] Message Catalog complete
- [ ] State Ownership implemented
- [ ] Snapshot implemented
- [ ] Delta implemented
- [ ] Event model implemented
- [ ] Sequence implemented
- [ ] Ordering implemented
- [ ] Duplicate handling implemented
- [ ] Resync implemented
- [ ] Replay implemented
- [ ] Snapshot fallback implemented
- [ ] Reconnect implemented
- [ ] Heartbeat implemented
- [ ] Validation implemented
- [ ] Security boundaries verified
- [ ] Room isolation verified
- [ ] Error handling verified
- [ ] Contract tests pass
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Concurrency tests pass
- [ ] Network degradation tests pass
- [ ] Load test completed
- [ ] Benchmark completed
- [ ] Performance evidence collected
- [ ] Traceability complete
- [ ] Documentation updated

---

# 88. Protocol Acceptance Gate

Protocol implementation can be considered accepted only when:

```text
Schema
+
Implementation
+
Tests
+
Failure / Recovery
+
Performance Evidence
+
Traceability
```

are all present.

---

# 89. Final AI Implementation Instruction

When implementing this specification:

```text
DO NOT START BY WRITING GAMEPLAY CODE.
```

First:

```text
1. Read SRS
2. Read Project Spec
3. Read Architecture
4. Read Network Spec
5. Read Teacher Assignment
6. Verify OTTv2 Game & playfull.html Protocol areas
7. Generate implementation map
8. Verify protocol contracts
9. Generate protocol schemas/models
10. Implement transport adapters
11. Implement validation
12. Implement Session/Room integration
13. Implement concurrency/ordering
14. Implement Game Engine interface
15. Implement Sync Engine
16. Implement Snapshot/Delta/Event
17. Implement Resync/Replay
18. Implement Reconnect
19. Implement tests
20. Run network degradation tests
21. Run load/benchmark
22. Generate traceability
23. Run final self-audit
```

AI MUST stop and report if:

- SRS conflicts with this document;
- Architecture conflicts with this document;
- a required protocol field is ambiguous;
- a game-dependent requirement is missing;
- a security boundary is unclear;
- a synchronization invariant cannot be implemented deterministically.

AI MUST NOT silently guess.

---

# 90. Final Network Protocol Principle

The project follows:

> **Deterministic State & Recovery First.**

The fundamental model is:

```text
Client Intent
     ↓
Protocol Validation
     ↓
Game Validation
     ↓
Concurrency / Ordering
     ↓
Authoritative Game Engine
     ↓
Canonical Server State
     ↓
Logical State Transition
     ├── STATE_DELTA
     └── GAME_EVENT
     ↓
Sync Engine
     ↓
Client Replica
     ↓
Hash / Sequence Verification
```

When synchronization fails:

```text
Detect
  ↓
Resync
  ↓
Replay
  ↓
Snapshot Fallback
  ↓
Verify
  ↓
Resume
```

When recovery is impossible or unsafe:

```text
Isolate
  ↓
Disconnect only when necessary
```

This is the Core Network Contract for the project.

---

# 91. Change Log

| Version | Status | Description |
|---|---|---|
| 1.0 | PROTOCOL FROZEN | Initial Core Network Protocol after Q1–Q191 discovery and final consistency audit |

---

# 92. Document Status

```text
SRS.md
   ↓
01_PROJECT_SPEC.md
   ↓
02_ARCHITECTURE.md
   ↓
03_NETWORK_SPEC.md
   ↓
PROTOCOL FREEZE
   ↓
Implementation
```

**Core Protocol Status: FROZEN**

**Game-specific extensions: PENDING TEACHER ASSIGNMENT**

**Implementation may proceed only within the frozen contract above.**