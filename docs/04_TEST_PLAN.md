# 04 — TEST PLAN

**Document:** `04_TEST_PLAN.md`  
**Status:** `TEST PLAN READY / FROZEN`  
**Implementation Readiness:** `≥95%`  
**Protocol Status:** `03_NETWORK_SPEC.md — PROTOCOL FROZEN`  
**Scope:** Client + Server + Protocol + Game State + Reliability + Security + Performance + Load + Benchmark  
**Project Type:** Realtime Multiplayer Network Programming Game

---

# 1. Purpose

Test Plan này định nghĩa chiến lược, phạm vi, kiến trúc, phương pháp, môi trường, tiêu chí, evidence và completion gate cho toàn bộ hoạt động kiểm thử của hệ thống.

Mục tiêu không chỉ là xác nhận game có chạy được mà phải chứng minh:

- Functional Requirements được triển khai đúng.
- Client và Server giao tiếp đúng Protocol.
- Server duy trì canonical game state.
- Các client được đồng bộ chính xác.
- Concurrency được xử lý deterministic.
- Disconnect / Reconnect / Resync hoạt động đúng.
- Room isolation được đảm bảo.
- Protocol có contract test.
- Hệ thống chịu được network degradation.
- Hệ thống được đánh giá dưới load và stress.
- Performance được đo bằng số liệu thực tế.
- Snapshot và Delta/Event được benchmark.
- Các requirement quan trọng có test và acceptance evidence.
- Toàn bộ kết quả có traceability từ Requirement đến Acceptance.

Test Plan là tài liệu kiểm thử chính thức của project.

---

# 2. Testing Principles

## 2.1 Requirement-driven Testing

Mọi test quan trọng phải truy xuất được về requirement.

Traceability chính thức:

```text
Requirement
    ↓
Implementation
    ↓
Test Case
    ↓
Execution
    ↓
Evidence
    ↓
Acceptance
```

Không coi việc "test chạy PASS" là đủ nếu không xác định được requirement mà test đó chứng minh.

---

## 2.2 Server Authority

Server là nguồn canonical state đối với các state quan trọng.

Client không được trực tiếp gửi state delta để yêu cầu server ghi đè canonical state.

Luồng chuẩn:

```text
Client Command / Input
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
Client(s)
```

Test phải xác minh boundary này.

---

## 2.3 Deterministic Testing

Các test có thể deterministic phải được thiết kế để có thể:

- chạy độc lập;
- chạy lại;
- sử dụng fixture xác định;
- sử dụng seed xác định khi cần;
- không phụ thuộc thứ tự chạy của test khác.

Các concurrency test phải có khả năng lặp lại scenario để phát hiện race hoặc nondeterministic behavior.

---

## 2.4 Evidence-driven Testing

Một test hoàn chỉnh không chỉ có `PASS`.

Kết quả phải có evidence phù hợp với loại test:

- Test output;
- Logs;
- HTTP request/response;
- WebSocket message trace;
- Sequence;
- State snapshot;
- State hash;
- Performance metrics;
- Resource metrics;
- Screenshot/video nếu thực sự cần.

---

## 2.5 Critical Requirements First

Core và Critical Requirements được ưu tiên cao hơn Optional Features.

Optional feature không được phép làm thay đổi hoặc làm giảm độ tin cậy của Core Scope.

---

# 3. Test Scope

## 3.1 In Scope

Test Plan bao phủ:

1. Client
2. Server
3. HTTP Control Plane
4. WebSocket Realtime Plane
5. Protocol
6. Serialization
7. Game State
8. Synchronization
9. Snapshot
10. Delta/Event
11. Sequence
12. Replay
13. Resync
14. Room
15. Session
16. Player
17. Reconnection
18. Heartbeat
19. Concurrency
20. Ordering
21. Conflict Resolution
22. Room Isolation
23. Validation
24. Error Handling
25. Rate Limiting
26. Security / Abuse
27. Network Degradation
28. Persistence Soft Dependency
29. Load
30. Stress
31. Benchmark
32. Performance Evidence
33. Requirement Traceability
34. Acceptance
35. Test Completion

---

# 4. Test Pyramid

Project sử dụng các test level sau:

```text
                 E2E
          Concurrency / Network
              Integration
              Contract
                 Unit
```

Ngoài pyramid functional testing còn có:

```text
Load
Benchmark
Stress
Network Degradation
```

## 4.1 Mandatory Test Levels

Project completion phải có:

- Unit
- Integration
- E2E
- Concurrency
- Network Degradation
- Load
- Benchmark

Contract Testing là thành phần bắt buộc đối với Protocol và được thực hiện xuyên suốt Client/Server.

---

# 5. Test Classification

Mỗi Test Case được phân loại theo tối thiểu:

### Test Level

- UNIT
- INTEGRATION
- CONTRACT
- E2E
- CONCURRENCY
- NETWORK
- LOAD
- BENCHMARK

### Feature / Requirement

Ví dụ:

- Session
- Room
- Player
- Gameplay
- State Sync
- Snapshot
- Resync
- Reconnect
- Security
- Performance

### Scenario Type

- Happy Path
- Boundary
- Invalid Input
- Failure
- Recovery
- Concurrent
- Degraded Network
- Security / Abuse
- Performance
- Stress

---

# 6. Test Repository Structure

Test code được tổ chức:

```text
tests/
├── unit/
├── integration/
├── contract/
├── e2e/
├── concurrency/
├── network/
├── load/
├── benchmark/
├── fixtures/
└── helpers/
```

Application tests nằm trong cùng repository.

Load/Benchmark có thể là module/tool riêng nhưng dùng chung infrastructure khi phù hợp.

---

# 7. Test Infrastructure

## 7.1 Unified Test Runner

Test system phải hỗ trợ:

```text
Unit
Integration
Contract
E2E
Concurrency
Network
Load
Benchmark
All
```

Đồng thời cho phép chạy:

- test file;
- test class;
- test case;
- test group.

---

## 7.2 Fixture Factory

Phải có cơ chế tạo deterministic fixture cho:

- Room
- Player
- Session
- Game State
- Message
- Test Data

Fixture phải hỗ trợ reset để test độc lập.

---

## 7.3 Network Message Factory

Phải có factory tạo:

- Valid messages;
- Invalid messages;
- Boundary messages;
- Malformed messages;
- Duplicate messages;
- Out-of-order messages;
- Gap messages;
- Versioned messages.

Message Factory phải bám theo Protocol Schema.

---

## 7.4 Automated Test Client

Automated Test Client phải có khả năng:

- Create Room;
- Join Room;
- Leave Room;
- Maintain HTTP session;
- Establish WebSocket;
- Send protocol messages;
- Receive messages;
- Maintain observable client state;
- Verify synchronization;
- Simulate multiple players;
- Reconnect;
- Request resync;
- Observe sequence;
- Observe state hash.

Test Client sử dụng real HTTP/WebSocket path trong Integration/E2E/Concurrency tests.

---

# 8. Load Generator

Load Test sử dụng hai thành phần:

### Automated Test Client

Dùng cho:

- Functional E2E;
- Concurrency;
- Reconnect;
- Synchronization;
- Protocol behavior.

### Dedicated Load Generator

Dùng cho:

- Large number of connections;
- Large number of rooms;
- Throughput;
- Resource utilization;
- Sustained load;
- Peak load;
- Stress.

---

# 9. Test Environment

## 9.1 Local

Local Native Run là môi trường baseline.

## 9.2 Docker Compose

Docker Compose được hỗ trợ làm môi trường reproducible.

Docker không phải hard dependency nếu môi trường của giảng viên không hỗ trợ Docker.

## 9.3 Test Database

Integration test sử dụng Dedicated Test DB.

Test DB phải hỗ trợ:

- deterministic setup;
- deterministic cleanup;
- reset giữa các test/suite khi cần.

---

# 10. Persistence Failure Testing

Persistence là **soft dependency**.

Test phải chứng minh:

```text
Database Available
        ↓
Normal Gameplay

Database Unavailable
        ↓
Live Gameplay continues
        ↓
Persistence failure handled/logged
        ↓
Recovery
```

Phải test:

- DB unavailable khi startup;
- DB unavailable trong live gameplay;
- DB unavailable khi match kết thúc;
- DB recovery;
- persistence failure logging.

Live gameplay không được bị phụ thuộc cứng vào Database.

---

# 11. Test Configuration

Các cấu hình test tập trung tại một test configuration layer.

Bao gồm tối thiểu:

- Server URL;
- HTTP URL;
- WebSocket URL;
- Timeout;
- Random/Test Seed;
- Player Count;
- Room Count;
- Network Latency;
- Packet Loss;
- Disconnect Parameters;
- Load Parameters.

Không hard-code secret.

Secrets phải được truyền qua environment/secret management phù hợp.

---

# 12. CI / Test Pipeline

Baseline pipeline:

```text
Lint
  ↓
Unit
  ↓
Contract
  ↓
Integration
  ↓
E2E
  ↓
Concurrency
  ↓
Network
  ↓
Load
  ↓
Benchmark
```

CI mặc định ưu tiên:

- Unit;
- Contract;
- Integration.

E2E / Network / Load / Benchmark có thể chạy ở staged/manual pipeline tùy tài nguyên.

Một failure ở test prerequisite quan trọng có thể block stage sau.

Các suite độc lập có thể tiếp tục chạy để thu thập thêm evidence.

---

# 13. Unit Testing

Unit Test tập trung vào logic có thể kiểm thử độc lập.

Bao gồm:

- Game logic;
- Validation;
- State transformation;
- Delta application;
- Serialization;
- Deserialization;
- Sequence handling;
- Error mapping;
- Conflict resolution;
- Utility functions;
- State hash;
- Deterministic canonical serialization.

Unit Test có thể mock transport khi cần.

---

# 14. Integration Testing

Integration Test kiểm tra interaction giữa các module.

Bao gồm:

- API ↔ Session;
- Session ↔ Room;
- Room ↔ Game;
- Protocol ↔ Validation;
- Game ↔ Sync;
- Persistence;
- HTTP ↔ WebSocket lifecycle;
- Reconnect;
- Resync.

Ưu tiên real dependencies.

Mock chỉ các dependency không cần thiết hoặc không kiểm soát được.

---

# 15. Contract Testing

Mọi message trong Message Catalog phải có ít nhất một Contract/Protocol Test phù hợp.

Contract Test kiểm tra:

```text
Schema
   ↕
Typed Model
   ↕
Serialized JSON
   ↕
Runtime Validation
```

Bao gồm cả:

- HTTP;
- WebSocket.

Mỗi message cần kiểm tra phù hợp:

- required fields;
- optional fields;
- data type;
- serialization;
- deserialization;
- semantic validation;
- valid payload;
- invalid payload;
- boundary payload.

---

# 16. Protocol Test Model

Protocol Test phải bao phủ:

- Schema;
- Typed Model;
- Serialization;
- Semantic Validation;
- Runtime Behavior.

Boundary tests bao gồm khi phù hợp:

- payload size;
- numeric limits;
- string limits;
- sequence;
- timestamps;
- collection size;
- player limits;
- room limits.

---

# 17. Message Identity Tests

## messageId

Test:

- presence;
- format;
- uniqueness;
- collision safety;
- duplicate detection;
- duplicate behavior.

## correlationId

Không bắt buộc cho mọi message.

Test bắt buộc khi message có request-response relationship cần correlate.

---

# 18. Sequence Testing

Sequence được scope theo Room.

Test:

- increasing sequence;
- sequence gap;
- duplicate sequence;
- out-of-order sequence;
- reconnect;
- replay;
- resync.

Sequence là logical synchronization unit, không phải generic packet counter.

Một logical transition có thể chứa:

```text
STATE_DELTA
+
GAME_EVENT
```

và dùng chung một sequence.

---

# 19. Ordering Testing

Ordering được test theo semantics của từng message:

- `STRICT`
- `LATEST_STATE`
- `NONE`
- `BASELINE`

Không áp dụng một ordering rule chung cho mọi message.

---

# 20. MOVE_INPUT Testing

`MOVE_INPUT`:

- latest-state;
- coalescible;
- unreliable;
- server authoritative;
- client prediction chỉ áp dụng cho movement.

Test phải xác minh:

- input cũ có thể bị coalesce;
- server quyết định canonical movement;
- client không thể tự ghi canonical state;
- eventual synchronization đúng.

---

# 21. State Delta Testing

`STATE_DELTA` sử dụng replacement/set semantics.

Ví dụ:

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

Test:

- deterministic application;
- valid path;
- invalid path;
- type mismatch;
- sequence consistency;
- duplicate;
- out-of-order;
- gap;
- unauthorized mutation attempt.

Client không được trực tiếp mutate canonical server state bằng delta.

---

# 22. Game Event Testing

`GAME_EVENT` phải kiểm tra:

- Event type;
- payload;
- sequence;
- logical transition;
- transient behavior.

Event transient mặc định.

Chỉ các event được định nghĩa rõ cho:

- replay;
- audit;
- debug;

mới được persistence.

---

# 23. Snapshot Testing

Snapshot phải chứa:

```json
{
  "state": {},
  "stateSchemaVersion": 1,
  "stateHash": "..."
}
```

và Envelope sequence.

Test:

- canonical state;
- state schema version;
- state hash;
- baseline sequence;
- join synchronization;
- reconnect synchronization;
- snapshot application;
- snapshot equivalence với server state.

---

# 24. State Hash Testing

Hash mặc định:

```text
SHA-256
```

nhưng implementation phải abstraction algorithm.

Test:

1. Same canonical state → same hash.
2. State mutation → hash changes.
3. Client hash mismatch → detected.
4. Mismatch → recovery.
5. Recovery → hash verified.

Canonical serialization:

- deterministic JSON;
- object keys sorted;
- array ordering theo semantics của schema/field.

---

# 25. Replay & Resync Testing

## Resync Trigger

Test:

- sequence gap;
- hash mismatch;
- reconnect;
- explicit resync request.

## Recovery Strategy

```text
RESYNC_REQUEST
      ↓
Replay if continuity can be verified
      ↓
If unavailable
      ↓
Full Snapshot
```

Replay unit là logical synchronization bundle.

Replay buffer có giới hạn theo Room.

---

# 26. Resync Acceptance

Resync chỉ PASS khi:

1. sequence liên tục;
2. state hợp lệ;
3. state hash được verify;
4. recovered state khớp canonical state.

Nếu replay không đủ điều kiện continuity → Snapshot fallback.

---

# 27. E2E Testing

E2E phải đi qua real system path:

```text
Client
  ↓
HTTP
  ↓
Server
  ↓
WebSocket
  ↓
Game
  ↓
Sync
  ↓
Other Client
```

Các flow chính:

- Create Room;
- Join Room;
- Leave Room;
- Gameplay;
- State Sync;
- Disconnect;
- Reconnect;
- Resync;
- Match End;
- Rematch.

---

# 28. Room Isolation Testing

Room Isolation là Critical Test Area.

Phải kiểm tra:

1. Không leak state giữa Room A và Room B.
2. Không leak event giữa Room A và Room B.
3. Player Room A không thể gửi command tác động Room B.
4. Authorization được kiểm tra ở HTTP.
5. Authorization được kiểm tra ở WebSocket.
6. Authorization được kiểm tra ở game command.
7. Nhiều Room chạy đồng thời vẫn giữ isolation.

Scenario phải bao gồm concurrent multi-room activity.

---

# 29. Authorization Testing

Join Room yêu cầu:

```text
Room ID
+
Join Code / Room Token
+
Valid Session
```

Test:

- wrong Room ID;
- wrong Join Code;
- wrong Room Token;
- valid session nhưng không thuộc room;
- spoofed roomId;
- spoofed playerId;
- unauthorized game command;
- unauthorized resync/replay.

Room ID không được coi là authorization credential.

---

# 30. Reconnect Testing

## Normal Reconnect

Trong grace period:

```text
Disconnect
   ↓
Session retained
   ↓
Identity retained
   ↓
State retained
   ↓
Room membership retained
   ↓
Reconnect
   ↓
Restore
```

Test:

- identity restored;
- state restored;
- room membership restored;
- synchronization restored.

## After Grace Period

Reconnect sau grace period được coi là player mới theo policy.

---

# 31. Reconnect Race Testing

Phải test reconnect trong lúc:

- state transition đang xảy ra;
- gameplay đang tiếp tục;
- room đang thay đổi;
- resync đang diễn ra.

Mục tiêu là không tạo inconsistent state.

---

# 32. Heartbeat Testing

Test:

- PING/PONG;
- heartbeat timeout;
- disconnect detection;
- false positive prevention;
- timeout behavior trong gameplay;
- client/server heartbeat behavior.

Transport disconnect được Gateway phát hiện.

Session Manager xử lý lifecycle.

---

# 33. Concurrency Testing

Concurrency phải bao gồm:

### Level 1

2 clients trong cùng Room.

### Level 2

N clients trong cùng Room.

### Level 3

Multiple Rooms concurrently.

Test conflict resolution:

```text
First valid request received by Server wins.
```

Phải xác minh:

- deterministic result;
- canonical final state;
- all clients converge;
- repeated execution không tạo nondeterministic result.

---

# 34. Concurrency Race Scenarios

Mandatory scenarios:

- simultaneous commands;
- simultaneous state transitions;
- reconnect during state transition;
- resync during active gameplay;
- duplicate non-idempotent commands;
- multiple rooms under concurrent load.

Các scenario cần được chạy lặp lại khi cần để phát hiện race.

---

# 35. Duplicate Testing

Duplicate behavior phụ thuộc idempotency của message.

Đặc biệt với non-idempotent command:

- không tạo unintended extra mutation;
- nếu previous outcome được cache thì trả lại outcome phù hợp;
- nếu không cache thì xử lý theo deterministic safe behavior.

---

# 36. Rate Limiting Testing

Rate limiting gồm hai tầng:

### Connection / Message Level

Test:

- excessive connection;
- excessive message rate;
- throttling;
- error;
- recovery.

### Game Action Level

Test:

- excessive game commands;
- temporary throttle;
- ERROR;
- repeated abuse;
- severe/malicious behavior → disconnect.

Phải test hệ thống có thể recover sau throttle.

---

# 37. Security & Abuse Testing

Security Test Suite độc lập phải bao gồm:

- session validation;
- expired session;
- invalid session;
- spoofed playerId;
- spoofed roomId;
- unauthorized room access;
- unauthorized command;
- unauthorized replay/resync;
- malformed message;
- repeated invalid messages;
- severe/malicious input;
- rate-limit abuse;
- error information leakage;
- room isolation.

Server không được crash vì malformed input.

---

# 38. Error Testing

Unified Semantic Error Catalog được sử dụng cho HTTP và WebSocket.

Error response có thể gồm:

```json
{
  "code": "ROOM_NOT_FOUND",
  "message": "Room not found",
  "retryable": false,
  "details": {}
}
```

Test:

- error code;
- message;
- retryable;
- details;
- transport mapping;
- no internal information leakage.

---

# 39. Invalid / Malformed / Unknown Messages

### Invalid

→ `ERROR`

### Recoverable

→ `ERROR`

### Fatal / Severe / Repeated / Malicious

→ `ERROR` + disconnect khi cần.

### Unknown Optional Message

→ Ignore + Log.

### Unknown Critical Message

→ Protocol Error + terminate affected session/connection nếu unsafe.

---

# 40. Protocol Version Testing

Protocol Version và State Schema Version là hai khái niệm độc lập.

Test:

- supported version;
- unsupported version;
- version mismatch;
- state schema mismatch;
- version negotiation/handling nếu được định nghĩa.

Backward compatibility chỉ được test trong phạm vi compatibility policy được định nghĩa.

Baseline là current supported version.

---

# 41. Network Degradation Testing

Network Test Harness phải inject failure ở network/test layer, không can thiệp Game Engine.

Baseline gồm:

1. Latency
2. Packet Loss
3. Disconnect

---

# 42. Latency Testing

Test:

- normal latency;
- increased latency;
- sustained latency;
- latency during gameplay;
- latency during reconnect;
- latency under load.

Metrics:

- HTTP latency;
- WebSocket latency;
- RTT;
- message processing latency nếu đo được.

---

# 43. Packet Loss Testing

Test:

- packet/message loss;
- sequence gap;
- recovery;
- replay;
- snapshot fallback;
- recovered state;
- recovery latency.

Phải chứng minh packet loss không dẫn đến permanent desync nếu recovery policy cho phép.

---

# 44. Disconnect Testing

Test:

- client disconnect;
- server-side disconnect detection;
- reconnect;
- reconnect within grace;
- reconnect after grace;
- other players observing correct presence/state;
- disconnect in another Room;
- concurrent disconnects.

---

# 45. Desynchronization Testing

Desync scenario:

```text
State Divergence
      ↓
Detection
      ↓
Logging
      ↓
Resync
      ↓
State Verification
```

Test phải chứng minh:

- desync được detect;
- evidence được ghi;
- recovery được trigger;
- canonical state được khôi phục;
- hash được verify.

---

# 46. Persistence Testing

Persistence test bao gồm:

- startup failure;
- runtime failure;
- match-result persistence failure;
- DB recovery;
- match history preservation.

Server restart có thể terminate live match.

Không yêu cầu resume live match sau server restart.

Match history phải được xử lý theo persistence policy.

---

# 47. Performance Test Scope

Performance testing phải đo cả:

### Network

- HTTP latency;
- WebSocket latency;
- RTT;
- message processing latency;
- messages/sec;
- bytes/sec;
- network throughput.

### Server

- CPU;
- memory;
- active connections;
- tick processing time;
- errors;
- recovery;
- desync.

### Client

CPU/memory được đo khi phù hợp với scenario.

---

# 48. Tick Performance

Phải thu thập:

- average;
- p95;
- p99;
- maximum

cho tick processing time.

---

# 49. Load Models

Load Test phải bao gồm tối thiểu:

### Model A — One Room / Many Players

```text
1 Room
+
Many Players
```

### Model B — Many Rooms / Few Players

```text
Many Rooms
+
Few Players per Room
```

### Model C — Mixed Workload

Kết hợp nhiều Room và nhiều loại activity.

---

# 50. Workload Profiles

Realtime workload có thể gồm:

- idle/presence;
- movement;
- game actions;
- state updates;
- reconnect;
- mixed gameplay.

Workload phải configurable.

---

# 51. Load Execution

Load Test hỗ trợ:

- configurable ramp-up;
- sustained load;
- peak load;
- stress above baseline.

Không đặt hard capacity number trước khi có:

- Game Topic;
- môi trường benchmark;
- hardware/software configuration;
- baseline measurement.

Capacity cuối cùng phải được báo cáo bằng:

```text
Players
+
Rooms
+
Workload
+
Environment
```

---

# 52. Stress Testing

Stress Test được thực hiện trong môi trường an toàn.

Mục tiêu:

- hiểu degradation;
- xác định failure mode;
- xác định recovery behavior;
- xác định resource bottleneck.

Không yêu cầu production autoscaling.

---

# 53. Performance Threshold

Không tự đặt hard performance threshold trước khi có Game Topic và benchmark environment.

Sau khi các thông tin này được xác định, team phải đặt acceptance criteria đo được.

Performance failure được phân loại:

- Critical;
- Target;
- Informational.

Theo acceptance policy cuối cùng.

---

# 54. Performance Evidence

Mỗi performance run phải lưu:

- test configuration;
- environment;
- raw metrics;
- processed metrics;
- charts;
- analysis;
- comparison với acceptance criteria;
- conclusion.

Load configuration phải được lưu cùng result.

---

# 55. Snapshot vs Delta/Event Benchmark

Benchmark bắt buộc phải so sánh:

```text
Full Snapshot
vs
Delta/Event
```

Trong cùng:

- state;
- workload;
- environment;
- measurement methodology.

Metrics:

- message count;
- bandwidth;
- CPU;
- latency;
- processing overhead.

Benchmark phải có nhiều iterations khi phù hợp.

Kết quả phải báo cáo:

- average;
- percentile;
- variance khi phù hợp.

---

# 56. Multi-Room Performance

Load/Benchmark phải kiểm tra:

- nhiều Room;
- room isolation;
- resource utilization;
- performance degradation giữa các Room.

---

# 57. Network Degradation Under Load

Phải kiểm tra kết hợp:

- load + latency;
- load + packet loss;
- load + disconnect.

Phải ghi nhận:

- player count;
- room count;
- workload;
- network condition;
- metrics;
- failure mode;
- recovery behavior;
- evidence.

---

# 58. Test Case Standard

Mỗi Test Case phải có Unique Test ID.

Format có thể được chuẩn hóa khi implementation bắt đầu, nhưng ID phải unique trong toàn bộ Test Plan.

Test Case tối thiểu gồm:

- Test ID
- Requirement
- Preconditions
- Steps
- Expected Result
- Test Type
- Environment
- Evidence
- Status
- Execution Metadata
- Failure Details
- Acceptance Criteria

---

# 59. Test ID & Traceability

Mỗi Test ID phải liên kết tới Requirement trong Traceability Matrix.

Không cho phép test quan trọng tồn tại mà không xác định được requirement hoặc mục đích kiểm thử.

---

# 60. Test Status

Các status chính thức:

- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT RUN`
- `OUT OF SCOPE`

---

# 61. Evidence Policy

Evidence được liên kết ở:

- Test Case level;
- Requirement level khi cần.

Screenshot/video chỉ bắt buộc khi thực sự phù hợp, ví dụ:

- UX;
- visual behavior;
- demo;
- scenario khó chứng minh bằng logs/metrics.

Không yêu cầu screenshot/video cho mọi automated test.

---

# 62. Network Evidence

Network Test Evidence có thể gồm:

- application logs;
- protocol message trace;
- sequence;
- state snapshot;
- state hash;
- RTT;
- latency;
- packet loss;
- recovery metrics;
- reconnect metrics.

---

# 63. Failure Evidence

Khi test FAIL, evidence phải đủ để tái hiện hoặc phân tích.

Tối thiểu khi phù hợp:

- error;
- reproduction steps;
- environment;
- severity;
- expected;
- actual;
- logs;
- network trace;
- state/evidence;
- suspected area nếu đã biết.

---

# 64. Defect Severity

Severity:

| Level | Meaning |
|---|---|
| Blocker | Ngăn cản test/project tiếp tục hoặc làm hệ thống không thể sử dụng ở mức nghiêm trọng |
| Critical | Ảnh hưởng nghiêm trọng đến Core/Critical behavior |
| Major | Ảnh hưởng đáng kể nhưng còn khả năng tiếp tục sử dụng/test |
| Minor | Ảnh hưởng nhỏ |
| Trivial | Ảnh hưởng rất nhỏ |

Severity và Priority phải được phân biệt.

---

# 65. Test Coverage

Coverage gồm bốn chiều:

## Code Coverage

Mục tiêu:

```text
≥80%
```

cho code có thể reasonably unit-test.

Code Coverage không phải tiêu chí duy nhất để xác định project completion.

## Requirement Coverage

Requirement quan trọng phải có test tương ứng.

## Critical Scenario Coverage

Critical Test Set phải được thực hiện đầy đủ.

## Acceptance Coverage

Requirement phải đạt acceptance criteria tương ứng.

---

# 66. Critical Test Set

Critical Test Set là tập các test bắt buộc để chứng minh Core/Critical behavior.

Critical Test Set phải PASS trước Demo-Safe Gate.

Ngoại lệ chỉ được phép khi:

- có documented waiver;
- có known risk;
- team xác nhận/approve.

---

# 67. Core Requirement Coverage

Để Test Complete:

```text
100% Core/Critical Requirements
```

phải có test/acceptance coverage theo policy.

Optional Requirements có thể còn thiếu mà không làm Test Plan fail, nếu được ghi nhận đúng phạm vi.

---

# 68. Critical Scenario Coverage

Critical Scenario Coverage:

```text
100%
```

Phải bao phủ các scenario quan trọng đã xác định trong SRS/Project Spec/Network Spec/Test Plan.

---

# 69. Acceptance Evidence

Acceptance Evidence bắt buộc đối với Core Requirements.

Một requirement chỉ được coi là accepted khi có evidence tương ứng.

---

# 70. Test Completion

Test Completion dựa trên tổng hợp:

- Requirement Coverage;
- Critical Test Set;
- Test Execution;
- Acceptance;
- Evidence;
- Traceability;
- Known Failures;
- Test Debt.

Không sử dụng một metric duy nhất để quyết định Test Completion.

---

# 71. Test Completion Gate

Có một gate riêng:

```text
TEST COMPLETION
```

trước:

```text
PROJECT COMPLETION
```

Project chỉ được xem xét hoàn thành sau khi Test Completion đạt điều kiện tương ứng.

---

# 72. Test Complete Criteria

Test được coi là Complete khi:

1. Core/Critical tests PASS;
2. Requirement coverage đạt yêu cầu;
3. Critical Scenario Coverage đạt yêu cầu;
4. Acceptance Evidence đầy đủ;
5. Traceability hoàn chỉnh;
6. Known failures được xử lý hoặc accepted;
7. Test Debt được ghi nhận đúng;
8. Evidence cần thiết tồn tại.

---

# 73. Critical Test Failure

Nếu Critical Test FAIL:

```text
TEST COMPLETE = NO
```

Trừ trường hợp có:

- documented waiver;
- known risk;
- team confirmation.

Việc có waiver không xóa failure; failure và risk vẫn phải được ghi nhận.

---

# 74. Known Limitations

Known limitations được phép tồn tại nếu:

- không vi phạm Critical Requirements;
- đã được document;
- đã được team chấp nhận.

Không dùng Known Limitation để che giấu Critical Failure.

---

# 75. Test Debt

Mỗi Test Debt phải ghi:

- Owner;
- Reason;
- Impact;
- Status.

Test Debt chỉ được phép đối với:

- Optional;
- Non-critical.

Test Debt ảnh hưởng Critical Requirement phải được xử lý hoặc có waiver phù hợp.

---

# 76. Test Report

Final Test Report phải gồm:

1. Test Summary
2. Test Environment
3. Test Execution
4. Test Results
5. Failures
6. Coverage
7. Requirement Coverage
8. Critical Scenario Coverage
9. Performance
10. Load
11. Network Degradation
12. Security
13. Evidence
14. Traceability
15. Known Limitations
16. Test Debt
17. Acceptance Status
18. Final Test Completion Status

---

# 77. Raw Test Results

Raw automated test results phải được retain.

Summary không được là nguồn dữ liệu duy nhất.

Final report được generate/tổng hợp từ raw result khi có thể.

---

# 78. Test Traceability Matrix

Final Test Report phải có Test Traceability Matrix.

Canonical chain:

```text
Requirement
    ↓
Implementation
    ↓
Test Case
    ↓
Execution
    ↓
Evidence
    ↓
Acceptance
```

Matrix phải chỉ ra được trạng thái của từng requirement quan trọng.

---

# 79. Game-Dependent Testing

Các requirement phụ thuộc Game Topic phải đánh dấu:

```text
[GAME-DEPENDENT]
```

Ví dụ:

- game-specific rule;
- game-specific state;
- game-specific command;
- game-specific event;
- game-specific acceptance criteria;
- game-specific performance workload.

Không tự invent các requirement này trước khi có đề bài.

---

# 80. Game Topic Change

Khi Game Topic thay đổi:

- Core Test Framework được giữ nguyên.
- Game-dependent extension được cập nhật.
- Test Cases liên quan được cập nhật.
- Traceability được cập nhật.
- Change Log phải ghi nhận thay đổi.

Không được tự ý thay đổi Core Test Policy chỉ vì Game Topic thay đổi.

---

# 81. Change Management

Sau Test Plan Freeze:

```text
Change Proposal
      ↓
Impact Analysis
      ↓
Team Approval
      ↓
Update Test Plan
      ↓
Change Log
```

AI không được tự ý thay đổi requirement/test policy sau Freeze.

AI có thể cập nhật implementation-derived sections khi cần, nhưng requirement/test policy changes phải được ghi nhận và team confirmation.

---

# 82. Test Plan Change Log

Mọi thay đổi sau Freeze phải có:

- Change ID;
- Date;
- Changed Section;
- Reason;
- Impact;
- Related Requirement;
- Related Test;
- Approval;
- New Status.

---

# 83. AI Test Audit

Trước khi đóng Test Plan, AI phải tự audit:

- Test Scope;
- Test Architecture;
- Test Environment;
- Protocol Coverage;
- State/Synchronization Coverage;
- Reliability;
- Concurrency;
- Security;
- Performance;
- Load;
- Benchmark;
- Evidence;
- Traceability;
- Completion Criteria;
- Game-dependent boundaries;
- Consistency với SRS;
- Consistency với Project Spec;
- Consistency với Architecture;
- Consistency với frozen Network Spec.

---

# 84. AI Test Audit Gate

AI Test Audit phải đạt:

```text
≥95% Implementation Readiness
```

AI phải báo cáo kết quả audit.

Sau đó team/user phải xác nhận readiness.

Chỉ sau:

```text
AI Audit ≥95%
+
Team/User Confirmation
```

Test Plan mới được Freeze.

---

# 85. Test Plan Freeze

Current status:

```text
TEST PLAN READY / FROZEN
```

Freeze có nghĩa:

- Strategy frozen;
- Test scope frozen;
- Test criteria frozen;
- Test architecture frozen;
- Test completion policy frozen.

Freeze **không có nghĩa project đã hoàn thành**.

---

# 86. Demo Test Summary

README/Handover phải có bản tóm tắt ngắn:

- Critical Tests;
- Network Evidence;
- Performance Evidence;
- Known Issues.

Chi tiết đầy đủ nằm trong Test Report.

README là guide, không thay thế Test Report.

---

# 87. Final Test Completion Checklist

## Functional

- [ ] Core functional requirements tested
- [ ] Core requirements accepted
- [ ] Critical scenarios PASS
- [ ] Optional scope được phân loại đúng

## Network

- [ ] HTTP tested
- [ ] WebSocket tested
- [ ] Protocol contracts tested
- [ ] Sequence tested
- [ ] Ordering tested
- [ ] Snapshot tested
- [ ] Delta/Event tested
- [ ] Replay tested
- [ ] Resync tested
- [ ] Reconnect tested
- [ ] Heartbeat tested
- [ ] Room isolation tested

## Security

- [ ] Session validation
- [ ] Authorization
- [ ] Room isolation
- [ ] Spoofing tests
- [ ] Malformed input
- [ ] Rate limiting
- [ ] Abuse tests
- [ ] Error leakage tests

## Concurrency

- [ ] Two-client conflicts
- [ ] N-client conflicts
- [ ] Multi-room concurrency
- [ ] Deterministic conflict resolution
- [ ] Reconnect race
- [ ] Resync race
- [ ] Duplicate command race

## Performance

- [ ] Load test
- [ ] Sustained load
- [ ] Peak load
- [ ] Stress test
- [ ] Multi-room load
- [ ] Latency metrics
- [ ] Throughput metrics
- [ ] CPU/memory metrics
- [ ] Tick metrics
- [ ] Network degradation metrics
- [ ] Snapshot vs Delta/Event benchmark

## Coverage

- [ ] Code coverage target assessed
- [ ] Requirement coverage complete
- [ ] Critical Scenario Coverage = 100%
- [ ] Core/Critical Requirements covered
- [ ] Acceptance Coverage complete

## Evidence

- [ ] Raw automated results retained
- [ ] Test evidence linked
- [ ] Network evidence available
- [ ] Performance evidence available
- [ ] Failure evidence available
- [ ] Screenshots/videos added only where appropriate

## Traceability

- [ ] Requirement → Implementation
- [ ] Implementation → Test
- [ ] Test → Execution
- [ ] Execution → Evidence
- [ ] Evidence → Acceptance
- [ ] Final Test Traceability Matrix complete

## Documentation

- [ ] Test Report complete
- [ ] Environment documented
- [ ] Known Limitations documented
- [ ] Test Debt documented
- [ ] Change Log updated
- [ ] README links to Test Report

## Governance

- [ ] AI Test Audit completed
- [ ] AI readiness ≥95%
- [ ] Team/User confirmation
- [ ] Test Plan Freeze confirmed
- [ ] Post-freeze changes follow Change Management

## Final

- [ ] Critical Tests PASS or approved waiver
- [ ] Core/Critical Requirements accepted
- [ ] Critical Scenario Coverage complete
- [ ] Evidence complete
- [ ] Known failures handled/accepted
- [ ] Test Debt within allowed scope
- [ ] Test Completion Gate passed

---

# 88. Relationship with Other Documents

Official document dependency:

```text
SRS.md
   ↓
01_PROJECT_SPEC.md
   ↓
02_ARCHITECTURE.md
   ↓
03_NETWORK_SPEC.md
   ↓
04_TEST_PLAN.md
   ↓
05_TEAM_TASKS.md
   ↓
README.md
```

`03_NETWORK_SPEC.md` is the source of truth for Protocol behavior.

`04_TEST_PLAN.md` defines how that behavior is verified.

---

# 89. Conflict Resolution

Nếu phát hiện conflict giữa Test Plan và các tài liệu trước:

```text
STOP
  ↓
Identify Conflict
  ↓
Record Impact
  ↓
Resolve with Team
  ↓
Update Documents
  ↓
Update Change Log
  ↓
Resume Testing
```

Không tự động override một frozen requirement.

---

# 90. Final Test Plan Status

```text
┌─────────────────────────────────────────────┐
│           TEST PLAN READY / FROZEN          │
├─────────────────────────────────────────────┤
│ Implementation Readiness : ≥95%             │
│ Protocol                  : FROZEN          │
│ Core Test Strategy        : FROZEN          │
│ Test Architecture         : FROZEN          │
│ Completion Criteria       : FROZEN          │
│ Evidence Policy           : FROZEN          │
│ Traceability              : FROZEN          │
│ Game-specific Extension   : OPEN            │
└─────────────────────────────────────────────┘
```

**Frozen principle:**

> **Test phải chứng minh được Requirement được triển khai đúng, chạy đúng, chịu được failure phù hợp, đạt acceptance criteria và có evidence có thể truy xuất.**

**Final completion model:**

```text
Requirement
     ↓
Implementation
     ↓
Test Case
     ↓
Execution
     ↓
Evidence
     ↓
Acceptance
     ↓
TEST COMPLETION
     ↓
PROJECT COMPLETION
```

---

# 91. Document Completion Rule

`04_TEST_PLAN.md` được coi là hoàn chỉnh khi:

- toàn bộ Core Test Strategy đã được Freeze;
- các Test Levels bắt buộc đã được định nghĩa;
- Protocol/State/Sync testing đã được bao phủ;
- Reliability/Concurrency/Security đã được bao phủ;
- Network Degradation đã được định nghĩa;
- Load/Benchmark đã được định nghĩa;
- Evidence và Reporting đã được định nghĩa;
- Requirement Traceability đã được định nghĩa;
- Test Completion Gate đã được định nghĩa;
- AI Audit ≥95%;
- Team/User đã xác nhận;
- Game-dependent areas được đánh dấu rõ ràng;
- không còn requirement/test policy conflict chưa được giải quyết.

**Status: `TEST PLAN READY / FROZEN`**