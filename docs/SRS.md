# SRS.md — Software Requirements Specification
## Multiplayer Real-time Network Game — AI-Completable Template

> **Document status:** Baseline Template v0.1  
> **Purpose:** Khung SRS bắt buộc phải được AI Agent hoàn thiện sau khi nhận đề bài game chính thức từ giảng viên.  
> **Language:** Vietnamese  
> **Scope:** Network Programming / Multiplayer / Realtime Synchronization / Performance  
> **Development method:** Vibe Coding (defined in `TEAM_WORKFLOW.md`, not as a system requirement)

---

# 0. AI AGENT GUIDING — MANDATORY

## 0.1 Mục đích của file này

File này là **SRS sống (living specification)** của project.

AI Agent nhận codebase hoặc nhận đề bài game **KHÔNG được coi file này là tài liệu tham khảo tĩnh**.

Sau khi nhận được đề bài chính thức, AI Agent **BẮT BUỘC** phải:

1. Đọc toàn bộ file `SRS.md`.
2. Đọc đề bài game / yêu cầu của giảng viên.
3. Đối chiếu đề bài với toàn bộ baseline requirements trong file này.
4. Hoàn thiện tất cả phần còn để `[TODO]`, `[GAME-DEPENDENT]`, `[TBD]`.
5. Không tự bịa requirement nếu đề bài chưa cung cấp.
6. Nếu một quyết định phụ thuộc game, phải xác định rõ dependency và cập nhật sau khi game concept được xác định.
7. Chuyển các yêu cầu game-specific thành requirement có ID.
8. Hoàn thiện Functional Requirements và Network Requirements đủ chi tiết để một AI Agent khác có thể implement mà không phải đoán.
9. Hoàn thiện State Ownership Matrix.
10. Hoàn thiện Protocol / Message Specification.
11. Hoàn thiện Room / Game State Machine.
12. Hoàn thiện Acceptance Criteria.
13. Kiểm tra tính nhất quán giữa:
    - Game Rules
    - Functional Requirements
    - State Model
    - Protocol
    - Synchronization
    - Concurrency
    - Reconnection
    - Security
    - Performance
    - Testing
14. Chạy **Implementation-Readiness Audit** trước khi cho phép bắt đầu implementation.
15. Nếu chưa đạt mức implementation-ready, AI Agent phải sửa SRS trước; **không được tự ý code để bù cho requirement còn thiếu**.

### HARD RULE

> **Không bắt đầu implementation chỉ vì code có thể được viết.**
>
> **SRS phải xác định WHAT + BEHAVIOR + CONTRACT + ACCEPTANCE trước khi AI code.**

---

## 0.2 AI Agent MUST NOT

AI Agent không được:

- Tự chọn game rule khi đề bài chưa xác định.
- Tự thay đổi network architecture đã được khóa mà không ghi nhận lý do.
- Tự bỏ requirement để làm project "dễ hơn".
- Tự coi feature là hoàn thành chỉ vì code compile/build.
- Tự coi feature là hoàn thành chỉ vì manual test thành công.
- Tự tạo protocol riêng ở client hoặc server ngoài `Protocol Specification`.
- Tự thay đổi ownership của state mà không cập nhật `State Ownership Matrix`.
- Tự bỏ qua concurrency, reconnect, resync hoặc failure handling vì khó implement.
- Đưa Vibe Coding thành functional requirement.
- Đưa implementation detail không cần thiết vào SRS chỉ để khóa công nghệ.
- Dùng AI-generated code làm bằng chứng duy nhất cho requirement completion.

---

## 0.3 AI Agent MUST PRESERVE

Các nguyên tắc sau đã được **BASELINE-LOCKED** và chỉ được thay đổi khi có requirement mới từ giảng viên hoặc team chủ động quyết định:

- Multiplayer bắt buộc.
- Shared realtime state trong cùng room.
- HTTP + WebSocket.
- Unified message envelope.
- Sequence number.
- Hybrid authority.
- Client prediction chỉ bắt buộc cho movement.
- Server validation cho game-critical action.
- Snapshot + Delta/Event synchronization.
- Replay missing messages + Full Snapshot fallback.
- Strict room isolation.
- Guest identity + secure session token.
- Deterministic conflict resolution.
- Default conflict rule: first request received by server wins.
- Grace-period reconnect.
- State hash/checksum + sequence cho desync detection.
- Automated network simulation.
- Latency + Packet Loss + Disconnect là network degradation scope.
- Full Snapshot vs Delta/Event benchmark.
- Metrics + tables + charts + analysis.
- Requirement traceability.
- Requirement → Implementation → Test → Acceptance.
- Project DoD = Game + Multiplayer + Network + Tests + Benchmark/Report.

Nếu đề bài mới mâu thuẫn với baseline, AI phải ghi nhận conflict trong `Open Issues / Requirement Changes`, không được âm thầm thay đổi.

---

# 1. Project Overview

## 1.1 Project Name

`[TODO — điền tên project]`

## 1.2 Course

`INT3304 — Lập trình mạng / Network Programming`

## 1.3 Team

| Role | Member | Responsibility |
|---|---|---|
| Person A | `[TODO]` | Game / Client / UX |
| Person B | `[TODO]` | Network / Server |
| Person C | `[TODO]` | Integration / Performance / QA |

## 1.4 Project Objective

`[TODO — AI hoàn thiện sau khi nhận đề bài]`

Objective phải giải thích rõ project chứng minh được:

- Multiplayer networking
- Realtime communication
- Shared state synchronization
- Concurrency
- Failure handling
- Performance / scalability
- Testing / benchmarking

---

# 2. Scope

## 2.1 In Scope

- Multiplayer
- Realtime shared game state
- Room / session
- HTTP API
- WebSocket communication
- Network protocol
- State synchronization
- Concurrency
- Reconnection
- Resynchronization
- Server validation
- Rate limiting
- Performance measurement
- Load testing
- Network degradation testing
- Automated testing
- Benchmarking

## 2.2 Out of Scope

`[TODO — AI phải hoàn thiện theo đề bài]`

## 2.3 Game-dependent Scope

`[GAME-DEPENDENT]`

---

# 3. Game Concept

> **AI MUST COMPLETE THIS SECTION AFTER RECEIVING THE TEACHER'S GAME TOPIC.**

## 3.1 Game Type

`[GAME-DEPENDENT]`

Current baseline:

> Real-time Action Multiplayer Game

## 3.2 Core Gameplay

`[TODO]`

## 3.3 Player Roles

`[TODO]`

## 3.4 Game Objective

`[TODO]`

## 3.5 Win / Lose Conditions

`[TODO]`

## 3.6 Scoring

`[TODO]`

## 3.7 Game Capacity

`[GAME-DEPENDENT]`

Must distinguish:

- Maximum players per game/room
- Number of simultaneous rooms
- Load-test clients

These are not the same metric.

---

# 4. Actors and Users

| Actor | Description | Permissions |
|---|---|---|
| Player | `[TODO]` | `[TODO]` |
| Spectator | `[TODO]` | `[TODO]` |
| Server | Authoritative system | `[TODO]` |

---

# 5. Game Rules

> Every game rule must have a unique requirement ID.

| ID | Rule | Trigger | Expected Result | Priority |
|---|---|---|---|---|
| GAME-001 | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

AI must expand this table after the game topic is known.

---

# 6. Functional Requirements

## 6.1 Room

| ID | Requirement | Acceptance |
|---|---|---|
| FR-ROOM-001 | Player can create room | Automated test + acceptance scenario |
| FR-ROOM-002 | Player can join room | Automated test + acceptance scenario |
| FR-ROOM-003 | Quick Play is supported | Automated test + acceptance scenario |
| FR-ROOM-004 | Room isolation is enforced | Automated test + acceptance scenario |
| FR-ROOM-005 | Late join behavior follows game rules | `[TODO]` |

## 6.2 Session

| ID | Requirement | Acceptance |
|---|---|---|
| FR-SESSION-001 | Guest identity is created | `[TODO]` |
| FR-SESSION-002 | Secure session token is used | `[TODO]` |
| FR-SESSION-003 | Session can reconnect within grace period | `[TODO]` |

## 6.3 Game

`[TODO — AI MUST derive from official game topic]`

## 6.4 Realtime Interaction

`[TODO]`

Must cover both:

- Continuous realtime updates
- Discrete events

---

# 7. Non-Functional Requirements

## 7.1 Performance

Framework-level hard latency SLA is intentionally **not fixed**.

The project must measure and report actual performance.

Required metrics:

### Network

- RTT
- Message latency
- Messages/sec
- Bytes/sec
- Packet-loss recovery

### Server

- CPU
- Memory
- Active connections
- Tick processing time

### Correctness

- Desync
- Duplicate message
- Missing message
- Reconnect success
- Conflict resolution

## 7.2 Scalability

Load testing is based on:

> Game Capacity × Number of Rooms

The exact values are game/hardware dependent.

## 7.3 Availability

`[TODO — game-dependent / deployment-dependent]`

## 7.4 Maintainability

Requirements must be traceable and testable.

---

# 8. Multiplayer / Network Requirements

## 8.1 Network Architecture

```text
                         GAME CLIENT
                              |
                       HTTP / WebSocket
                              |
                              v
                         GAME SERVER
                              |
        +---------------------+----------------------+
        |                     |                      |
   Room Manager          Sync Engine          Game Engine
        |                     |                      |
   Session Manager      Snapshot/Delta         Validation
        |                     |                      |
   Connection Manager   Resync                  Rules
```

## 8.2 HTTP

HTTP is used for:

- Create room
- Join room / metadata
- Health check
- Non-realtime metadata operations

## 8.3 WebSocket

WebSocket is used for:

- Realtime state
- Input
- Events
- Presence
- Synchronization
- Room communication

---

# 9. Protocol Specification

## 9.1 Unified Message Envelope

All messages use the same conceptual envelope:

```json
{
  "messageId": "...",
  "type": "...",
  "timestamp": "...",
  "roomId": "...",
  "playerId": "...",
  "sequence": 123,
  "payload": {}
}
```

## 9.2 Required Fields

| Field | Required | Purpose |
|---|---|---|
| messageId | Yes | Message identity |
| type | Yes | Message type |
| timestamp | Yes | Message timing |
| roomId | Yes where applicable | Room isolation |
| playerId | Yes where applicable | Actor identity |
| sequence | Yes | Ordering / gap detection |
| payload | Yes | Message data |

## 9.3 Message Ordering

Ordering depends on message type.

- Critical state/event messages preserve ordering.
- Input messages may be coalesced/reordered when explicitly allowed.

AI must define exact ordering semantics for every message type.

## 9.4 Message Catalogue

> **AI MUST COMPLETE THIS TABLE AFTER GAME TOPIC IS KNOWN.**

| Type | Direction | Reliable | Ordered | Payload | Validation | Effect |
|---|---|---|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

---

# 10. State and Data Model

## 10.1 State Categories

### Persistent Shared State

Examples:

- Player state
- World state
- Score
- HP
- Objects

### Ephemeral / Presence

Examples:

- Connection status
- Presence
- Temporary session data

### Events

Examples:

- Attack
- Hit
- Join
- Leave
- Item pickup
- Game events

Events are transient by default.

Events needed for replay/debug/audit may be persisted.

---

# 11. Player State

## 11.1 Common Player State

```text
PlayerState
├── playerId
├── sessionId
├── position
├── connectionState
├── gameplayState
└── gameSpecificFields
```

## 11.2 Game-specific Fields

`[TODO — AI MUST COMPLETE]`

---

# 12. World Object Model

Base model:

```text
WorldObject
├── objectId
├── type
├── position
├── state
└── metadata
```

Game-specific extension:

`[TODO]`

---

# 13. State Ownership Matrix

> **MANDATORY. Every state must appear here.**

| State | Owner | Client Write | Server Write | Validation | Sync Method | Persistence |
|---|---|---:|---:|---|---|---|
| Input | Client request | Yes | N/A | Server | Event | No |
| Movement | Hybrid | Prediction | Yes | Server | Delta | No |
| HP | Server | No | Yes | Server | Delta/Event | No |
| Score | Server | No | Yes | Server | Event/Delta | Match result |
| Inventory | Server | No | Yes | Server | Delta | Game-dependent |
| Presence | Server | No | Yes | Server | Event | No |
| Game Result | Server | No | Yes | Server | Event | Yes |

AI MUST update this table to cover **100% of game-specific state**.

---

# 14. Synchronization

## 14.1 Synchronization Strategy

Hybrid synchronization:

1. Full snapshot on join.
2. Delta/event stream during gameplay.
3. Periodic or triggered snapshot.
4. Replay missing messages when possible.
5. Full snapshot fallback when replay is unavailable.

## 14.2 Join Flow

```text
JOIN
 ↓
AUTH / SESSION VALIDATION
 ↓
ROOM VALIDATION
 ↓
FULL SNAPSHOT
 ↓
CLIENT STATE INITIALIZATION
 ↓
DELTA / EVENT STREAM
```

## 14.3 Sequence Gap

```text
Incoming message
      ↓
Sequence check
 ┌────┴────┐
 OK       GAP
 │          │
 ▼          ▼
Continue   Resync
            │
       Replay missing
            │
       fallback Snapshot
```

## 14.4 Deterministic Delta

Requirement:

> Same snapshot + same ordered delta sequence must result in the same state.

---

# 15. Desynchronization Detection

Required mechanism:

- State hash/checksum
- Sequence tracking

Required behavior:

```text
Detect
 ↓
Log
 ↓
Resync
 ↓
Verify recovered state
```

Acceptance:

> Desync is not considered handled until the recovered state is verified.

---

# 16. Authority and Prediction

Authority model:

> **Hybrid Authority**

Critical state:

> Server authoritative.

Client prediction:

> Movement only.

AI must document the authority of every game-specific state.

---

# 17. Concurrency

## 17.1 Requirements

The server must safely handle:

- Concurrent players
- Concurrent actions
- Concurrent state updates
- Conflicting requests

## 17.2 Conflict Resolution

Conflict resolution must be deterministic.

Default rule:

> **First request received by the server wins.**

## 17.3 Concurrency Matrix

| Scenario | Expected Result | Test |
|---|---|---|
| Two players modify same object | `[TODO]` | Automated |
| Two attacks arrive concurrently | `[TODO]` | Automated |
| Player leaves during update | `[TODO]` | Automated |
| Reconnect during active tick | `[TODO]` | Automated |

AI MUST add game-specific concurrency scenarios.

---

# 18. Room / Game State Machine

Baseline:

```text
WAITING
   |
   v
PLAYING
   |
   +----> PAUSED
   |          |
   |          v
   +------ PLAYING
              |
              v
            ENDED
              |
              v
           WAITING
           (Rematch)
```

AI MUST specify:

- State
- Allowed transitions
- Trigger
- Preconditions
- Side effects
- Invalid transitions
- Who is authoritative

| Current | Event | Condition | Next | Side Effect |
|---|---|---|---|---|
| WAITING | Start | `[TODO]` | PLAYING | `[TODO]` |
| PLAYING | Pause | `[TODO]` | PAUSED | `[TODO]` |
| PAUSED | Resume | `[TODO]` | PLAYING | `[TODO]` |
| PLAYING | End | `[TODO]` | ENDED | `[TODO]` |
| ENDED | Rematch | `[TODO]` | WAITING | `[TODO]` |

---

# 19. Reconnection and Failure Handling

## 19.1 Disconnect

```text
DISCONNECTED
     |
     v
GRACE PERIOD
   /     \
  /       \
Reconnect  Timeout
  |          |
  v          v
Restore    New Player /
State      Remove
```

Grace period must be configurable.

## 19.2 Reconnect

If reconnect occurs within grace period:

> Restore previous state.

After grace period:

> Treat as a new player.

## 19.3 Server Restart

Live match resume is not required.

Match history must be preserved.

---

# 20. Security

## 20.1 Trust Boundary

```text
UNTRUSTED CLIENT
       |
       v
SERVER VALIDATOR
       |
       +-- Schema
       +-- Room
       +-- Permission
       +-- Sequence
       +-- Rate Limit
       +-- Game Rules
       |
       v
GAME ENGINE
       |
       v
AUTHORITATIVE STATE
```

## 20.2 Requirements

- Server validates every game-critical action.
- Client validation may be used for UX.
- Client validation is never a substitute for server validation.
- Rate limiting is mandatory.
- Session token must be cryptographically secure.
- Standard cryptographic library must be used.
- Do not implement cryptographic algorithms manually.
- Room ID is not authorization.
- Room join requires room token/join code.
- Strict room isolation is mandatory.

## 20.3 Invalid Messages

| Severity | Behavior |
|---|---|
| Minor / invalid | Log ERROR / reject |
| Repeated / malicious / severe | Disconnect |

---

# 21. Performance and Benchmarking

## 21.1 Tick Rate

Server tick rate must be configurable.

## 21.2 Load Test

Load test must cover:

> Game Capacity × Number of Rooms

Exact values are game/hardware dependent.

## 21.3 Required Metrics

See Section 7.

## 21.4 Snapshot vs Delta Benchmark

Mandatory comparison:

```text
FULL SNAPSHOT
      VS
DELTA / EVENT
```

Output must contain:

- Tables
- Charts
- Analysis

## 21.5 Overload Handling

Project requires:

- Monitoring
- Measurement
- Reporting

Auto-scaling is not required.

---

# 22. Network Degradation Testing

Time-boxed scope:

### Required

- Latency
- Packet loss
- Disconnect

### Not required

- Jitter
- Bandwidth throttling
- Complex multi-failure combinations

AI must not expand this scope without an explicit team decision.

---

# 23. Testing Strategy

## 23.1 Test Pyramid

```text
             E2E
              ▲
        Integration
              ▲
             Unit
              ▲
       Load / Network
```

Required test categories:

- Unit
- Integration
- E2E
- Load
- Network simulation

## 23.2 Protocol Tests

Every protocol message must have dedicated tests.

## 23.3 Concurrency Tests

Concurrency scenarios must have automated tests.

## 23.4 Network Simulation

Automated simulation must cover:

- Latency
- Packet loss
- Disconnect

---

# 24. Acceptance Criteria

## 24.1 Functional Acceptance

A feature is accepted only when:

> Implementation + Automated Test + Acceptance Scenario

is complete.

## 24.2 Network Acceptance

Every network flow must have an acceptance scenario.

Minimum flow coverage should include:

- Create room
- Join room
- Session
- Handshake
- Snapshot
- Realtime update
- Event
- Sequence gap
- Resync
- Disconnect
- Reconnect
- Leave
- Game end
- Rematch

AI must add game-specific flows.

## 24.3 Performance Acceptance

Performance acceptance requires:

> Actual measurement + baseline/reference

and may include game-specific criteria.

## 24.4 Load Test Acceptance

Load testing is complete only when all are present:

- Server stability result
- Connection/load coverage
- Metrics
- Results
- Charts
- Analysis

## 24.5 Network Failure Acceptance

Must demonstrate:

- Connection restored
- Player state restored
- Other players see correct state

## 24.6 Desync Acceptance

Must demonstrate:

- Detection
- Logging
- Resync
- Verification of recovered state

---

# 25. Requirement Traceability

Every requirement MUST have an ID.

Traceability:

```text
Requirement
     ↓
Implementation
     ↓
Automated Test
     ↓
Acceptance Scenario
```

## Traceability Matrix

| Requirement ID | Description | Implementation | Test | Acceptance | Status |
|---|---|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

No requirement may be marked "Done" without evidence.

---

# 26. Definition of Done

## 26.1 Network Module DoD

All of the following must satisfy their acceptance criteria:

- Protocol
- Sync
- Room
- Concurrency
- Reconnect
- Validation
- Testing
- Performance

## 26.2 Project DoD

Project is complete only when all are satisfied:

- [ ] Game playable
- [ ] Multiplayer playable
- [ ] Network requirements pass
- [ ] Tests pass
- [ ] Benchmark/report complete

Equivalent rule:

> **Project DoD = A + B + C + D + E**

---

# 27. Deployment

## 27.1 Environment

`[TODO]`

## 27.2 Run Instructions

`[TODO — AI must derive from actual implementation]`

## 27.3 Configuration

`[TODO]`

## 27.4 Deployment Architecture

`[TODO]`

## 27.5 Rollback

`[TODO]`

---

# 28. Observability

Minimum recommended evidence:

- Active connections
- Room count
- Messages/sec
- Bytes/sec
- Tick processing time
- CPU
- Memory
- Error count
- Reconnect count
- Resync count
- Desync count

AI may add metrics required by the actual implementation.

---

# 29. Technology Constraints

## 29.1 Mandatory Architectural Constraints

- HTTP + WebSocket
- Client-server architecture
- Team-built network layer
- Team-built protocol
- Team-built synchronization
- Team-built room/session handling
- Team-built concurrency handling
- Team-built reconnect/resync handling
- Team-built load/network testing

## 29.2 Technology Choices

`[TODO — AI may propose, but must distinguish "required by teacher" from "team decision".]`

## 29.3 PlayHTML

PlayHTML is:

> **Reference / inspiration only.**

It is not a required dependency.

The final architecture must be based on the teacher's requirements and this SRS.

---

# 30. Team Responsibilities

## Person A — Game / Client / UX

Owns:

- Game UI
- Game world
- Player representation
- Mechanics
- Input
- Animation
- Client rendering

Constraint:

> Must consume the defined Network API / Protocol and must not invent an incompatible protocol.

## Person B — Network / Server

Owns:

- HTTP
- WebSocket
- Protocol
- Serialization
- Room
- Session
- Shared state
- Synchronization
- Concurrency
- Reconnect
- Resync
- Server validation
- Rate limiting

## Person C — Integration / Performance / QA

Owns:

- Integration
- Automated tests
- Concurrency testing
- Failure testing
- Network degradation simulation
- Load testing
- Metrics
- Benchmark
- Charts
- Analysis
- README / report / demo support

All members must understand the shared architecture and contracts.

---

# 31. Development Workflow

> Detailed Vibe Coding rules belong in `TEAM_WORKFLOW.md`.

Baseline workflow:

```text
Teacher Topic
     ↓
Complete SRS
     ↓
Architecture Review
     ↓
State Ownership Matrix
     ↓
Protocol Specification
     ↓
Acceptance Criteria
     ↓
Protocol Freeze
     ↓
Task Breakdown
     ↓
Implementation
     ↓
Automated Tests
     ↓
Integration
     ↓
Benchmark
     ↓
Final Acceptance
```

### HARD GATE

> **No AI coding before Protocol Freeze.**

---

# 32. Repository Structure

Recommended baseline:

```text
project/
├── docs/
│   ├── SRS.md
│   ├── ARCHITECTURE.md
│   ├── NETWORK_SPEC.md
│   ├── TEST_PLAN.md
│   └── TEAM_TASKS.md
├── client/
├── server/
├── shared/
│   ├── protocol/
│   └── types/
├── tests/
├── benchmarks/
└── README.md
```

AI may adapt the structure to the selected technology stack, but must preserve the conceptual separation.

---

# 33. Task Breakdown

> AI MUST generate this section after SRS completion.

| Task ID | Requirement IDs | Owner | Dependencies | Deliverable | Test | Status |
|---|---|---|---|---|---|---|
| TASK-001 | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

Tasks must be implementation-sized.

Avoid tasks such as:

> "Build the whole network layer."

Prefer:

> "Implement WebSocket connection handshake and session registration."

---

# 34. Open Issues

Only unresolved issues may appear here.

| ID | Issue | Impact | Owner | Decision Needed By | Status |
|---|---|---|---|---|---|
| ISSUE-001 | `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` | Open |

AI must not hide uncertainty inside implementation.

---

# 35. Requirement Change Log

| Version | Date | Change | Reason | Approved By |
|---|---|---|---|---|
| 0.1 | `[TODO]` | Initial baseline | Initial discovery | Team |

Any change to a locked requirement must be recorded here.

---

# 36. AI Implementation-Readiness Audit

> **MANDATORY BEFORE CODING**

AI Agent must evaluate the completed SRS using the following checklist.

## 36.1 Completeness

- [ ] Game concept is fully defined.
- [ ] Game rules are defined.
- [ ] Actors are defined.
- [ ] Functional requirements have IDs.
- [ ] Non-functional requirements are defined.
- [ ] Network flows are defined.
- [ ] Protocol messages are defined.
- [ ] State model is defined.
- [ ] State Ownership Matrix is complete.
- [ ] Room State Machine is complete.
- [ ] Reconnection behavior is defined.
- [ ] Failure behavior is defined.
- [ ] Security requirements are defined.
- [ ] Performance requirements are measurable.
- [ ] Testing requirements are defined.
- [ ] Acceptance criteria are defined.
- [ ] Requirement traceability exists.
- [ ] Task breakdown exists.

## 36.2 Consistency

AI must verify:

- [ ] Game rules do not conflict with protocol.
- [ ] Protocol does not conflict with state ownership.
- [ ] State ownership does not conflict with authority model.
- [ ] Sync model matches message ordering.
- [ ] Reconnect model matches room/session lifecycle.
- [ ] Security rules match room/session model.
- [ ] Tests cover requirements.
- [ ] Acceptance criteria are objectively verifiable.
- [ ] Tasks cover requirements.

## 36.3 Ambiguity

For every `[TODO]`, `[TBD]`, `[GAME-DEPENDENT]`:

- [ ] Either resolved
- [ ] Or explicitly proven to be legitimately game-dependent
- [ ] No implementation-critical ambiguity remains

## 36.4 Readiness Score

AI must report:

```text
Implementation Readiness: XX%

Blocking Issues:
- ...

Non-blocking Issues:
- ...

Game-dependent Items:
- ...

Decision Required:
- ...
```

### Required threshold

> **Target: ≥ 95% implementation readiness.**

If below 95%:

> **DO NOT START IMPLEMENTATION.**

Complete the SRS first.

---

# 37. Final AI Instruction

When the official teacher topic is supplied, the AI Agent must execute this sequence:

```text
1. READ SRS.md
        ↓
2. READ TEACHER'S ASSIGNMENT
        ↓
3. EXTRACT GAME REQUIREMENTS
        ↓
4. MAP THEM TO THIS BASELINE
        ↓
5. IDENTIFY CONFLICTS / GAPS
        ↓
6. COMPLETE ALL GAME-DEPENDENT SECTIONS
        ↓
7. COMPLETE STATE MODEL
        ↓
8. COMPLETE OWNERSHIP MATRIX
        ↓
9. COMPLETE PROTOCOL
        ↓
10. COMPLETE ROOM STATE MACHINE
        ↓
11. COMPLETE ACCEPTANCE CRITERIA
        ↓
12. COMPLETE TRACEABILITY
        ↓
13. GENERATE TASK BREAKDOWN
        ↓
14. RUN IMPLEMENTATION-READINESS AUDIT
        ↓
15. REVISE UNTIL ≥ 95%
        ↓
16. ONLY THEN START CODING
```

## Absolute rule

> **The AI Agent is not allowed to declare the project implementation-ready while leaving an implementation-critical requirement as an assumption.**

> **If the teacher's assignment is ambiguous, the AI must identify the ambiguity explicitly rather than silently inventing a requirement.**

> **This SRS must be updated to reflect the final agreed requirements before implementation begins.**

---

# Appendix A — Baseline Decision Register

| ID | Decision |
|---|---|
| Q1 | PlayHTML = inspiration/reference only |
| Q2 | Priority: Network > Performance > Realtime Sync > Game > UX |
| Q3 | Multiplayer mandatory |
| Q4 | Multiplayer type depends on teacher topic |
| Q5 | Shared realtime state mandatory |
| Q6 | Create/Join Room + Quick Play |
| Q7 | Persistent + Ephemeral/Presence + Events |
| Q8 | Team builds network layer/protocol/sync/etc. |
| Q9 | Continuous realtime + discrete events |
| Q10 | Hybrid Authority |
| Q11 | Capacity game-dependent |
| Q12 | Waiting → Playing → Pause → Playing → Ended → Rematch |
| Q13 | Late join = player or spectator depending on game |
| Q14 | Disconnect → grace period → reconnect/remove |
| Q15 | Snapshot + Delta/Event + Resync |
| Q16 | Deterministic conflict resolution; default first request received wins |
| Q17 | Network degradation = latency + packet loss + disconnect |
| Q18 | Flexible combined win/lose/score/time/objective conditions |
| Q19 | Real-time Action loop |
| Q20 | HTTP + WebSocket |
| Q21 | Unified message envelope |
| Q22 | Message ordering depends on message type |
| Q23 | Sequence mandatory |
| Q24 | Replay missing messages + snapshot fallback |
| Q25 | Prediction only for movement |
| Q26 | Event-driven network + fixed game tick |
| Q27 | Strict room isolation |
| Q28 | Guest identity + session token |
| Q29 | Common Player State + game-specific fields |
| Q30 | Ownership Matrix mandatory |
| Q31 | Base WorldObject + game extension |
| Q32 | Full snapshot = canonical initial state |
| Q33 | Deterministic delta application |
| Q34 | Events transient by default |
| Q35 | Live state not persisted after all players leave; results/history persist |
| Q36 | Explicit Game/Room State Machine |
| Q37 | No hard framework latency target |
| Q38 | Configurable server tick |
| Q39 | Load = game capacity × number of rooms |
| Q40 | Measure network + server + correctness metrics |
| Q41 | Overload = monitoring/reporting, no autoscaling |
| Q42 | Full Snapshot vs Delta/Event benchmark mandatory |
| Q43 | Benchmark = tables + charts + analysis |
| Q44 | Server validates every game-critical action |
| Q45 | Invalid messages handled by severity |
| Q46 | Rate limiting mandatory |
| Q47 | Cryptographically secure session token using standard library |
| Q48 | Room ID is not authorization |
| Q49 | Client + server validation |
| Q50 | Reconnect within grace restores state; after grace = new player |
| Q51 | Server restart need not resume live match |
| Q52 | Grace period configurable |
| Q53 | Unit + Integration + E2E + Load/Network |
| Q54 | Dedicated protocol message tests |
| Q55 | Automated concurrency tests |
| Q56 | State hash/checksum + sequence; detect/log/resync/verify |
| Q57 | Automated latency/packet-loss/disconnect simulation |
| Q58 | Functional acceptance = code + automated test + acceptance scenario |
| Q59 | Acceptance scenario for every network flow |
| Q60 | Performance = actual measurement + baseline/reference + game-specific criteria |
| Q61 | Load completion = stability + coverage + metrics + results + charts + analysis |
| Q62 | Failure acceptance = restore connection + player state + correct shared state |
| Q63 | Desync acceptance = detect + log + resync + verify |
| Q64 | Network Module DoD = all network areas pass acceptance |
| Q65 | Project DoD = game + multiplayer + network + tests + benchmark/report |
| Q66 | Full requirement traceability |
| Q67 | Vibe Coding rules belong in TEAM_WORKFLOW.md |

---

# Appendix B — Status Legend

| Marker | Meaning |
|---|---|
| `[TODO]` | Must be completed |
| `[TBD]` | Decision required |
| `[GAME-DEPENDENT]` | Depends on official game topic |
| `[LOCKED]` | Baseline decision must not change silently |
| `[OPTIONAL]` | May be added if time/resources allow |

---

# Appendix C — Document Completion Rule

This document is not considered complete merely because all `[TODO]` markers are removed.

The final SRS must satisfy:

```text
Complete
   +
Consistent
   +
Traceable
   +
Testable
   +
Accepted
   +
≥95% Implementation Readiness
```

Only then may the team proceed to implementation.
