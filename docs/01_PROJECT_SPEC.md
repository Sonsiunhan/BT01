# 01_PROJECT_SPEC.md

> **Document status:** PROJECT SPECIFICATION  
> **Purpose:** Define the project identity, objectives, scope, feature boundaries, user journey, success criteria, completion model, demo safety, and readiness gates at project level.  
> **Detailed technical requirements:** `SRS.md`  
> **Important:** This document is a project-level contract. It must not silently invent game-specific requirements before the teacher provides the official assignment.

---

# 0. AI AGENT GUIDING — MANDATORY

## 0.1 Purpose

This document is intended to be read and maintained by both humans and AI coding agents.

When an AI agent receives the official teacher assignment, it MUST use this document as the project-level source of truth before designing or implementing the project.

The AI must:

1. Read `01_PROJECT_SPEC.md`.
2. Read the official teacher assignment.
3. Identify all constraints imposed by the assignment.
4. Complete every `[GAME-DEPENDENT]`, `[TODO]`, and `[TBD]` item that can be resolved from the assignment.
5. Update affected project sections when the assignment changes an existing assumption.
6. Record meaningful changes in `Change Log`.
7. Never silently overwrite a previously LOCKED requirement.
8. If a new requirement conflicts with a LOCKED requirement, stop at the conflict and request a team decision.
9. Maintain the distinction between:
   - Core Scope
   - Optional Scope
   - Game-Dependent Scope
   - Explicit Out of Scope
10. Run the Project Readiness Audit before the project moves to SRS/Architecture implementation work.
11. Do not begin implementation while critical project ambiguity remains.
12. Preserve traceability from project objective → feature → requirement → implementation → test → acceptance.

## 0.2 AI Scope-Control Rule

The AI may add game-specific features when they are objectively necessary to make the assigned game playable and compliant with the teacher's requirements.

However:

- Necessary implementation detail is not automatically new scope.
- New user-facing capability must be classified.
- Optional features must never compromise Core Scope.
- Scope expansion must be recorded.
- The AI must not use "the game needs it" as a justification for uncontrolled feature creep.

## 0.3 Project Spec vs Other Documents

| Document | Responsibility |
|---|---|
| `01_PROJECT_SPEC.md` | What the project is, why it exists, scope, major capabilities, completion and demo definition |
| `SRS.md` | Detailed functional/non-functional/network requirements and acceptance |
| `ARCHITECTURE.md` | System architecture, components, deployment and technical organization |
| `NETWORK_SPEC.md` | Detailed network protocol and synchronization contract, if created |
| `TEST_PLAN.md` | Detailed test strategy, scenarios, benchmark and load testing |
| `TEAM_WORKFLOW.md` | Team workflow, Vibe Coding rules and collaboration process |
| `DEMO_PLAN.md` | Detailed demonstration procedure, if created |

No document should silently contradict a LOCKED project decision.

---

# 1. PROJECT IDENTITY

## 1.1 Project Type

This project is a **Network Programming academic project implemented as a playable realtime multiplayer game/system**.

The game is the application environment used to demonstrate Network Programming capabilities.

The project is not primarily evaluated as a game-production project.

## 1.2 Core Identity

The project must demonstrate:

> The ability to design and implement a realtime client-server network system through a playable multiplayer game.

The system must visibly demonstrate:

- client-server communication;
- realtime synchronization;
- concurrent interaction;
- protocol design;
- reliability and recovery;
- performance measurement;
- automated testing;
- load/benchmark analysis.

## 1.3 Game Concept

**Status:** `[GAME-DEPENDENT]`

The official game concept, rules, mechanics and game-specific constraints must be filled after the teacher provides the assignment.

AI MUST NOT invent the final game concept before the official assignment is available.

---

# 2. PROJECT PURPOSE

## 2.1 Academic Purpose

The project exists to demonstrate practical understanding and implementation of Network Programming through a concrete multiplayer application.

The project should make network concepts observable through actual player interaction rather than through an isolated networking demo.

## 2.2 Engineering Purpose

The project should demonstrate an end-to-end realtime system containing:

- client-server communication;
- room/session management;
- shared state;
- realtime events;
- synchronization;
- concurrency handling;
- disconnect/reconnect;
- validation and security controls;
- testing;
- performance/load measurement.

## 2.3 Product Purpose

The project must remain playable enough to demonstrate a complete game loop:

`Join → Play → Interact → Win/Lose → End → Rematch`

Gameplay does not need the depth of a commercial game.

Network and engineering quality have higher priority than advanced gameplay or UX.

---

# 3. ACADEMIC PROBLEM / CONTEXT

A multiplayer game provides a practical environment in which multiple clients interact with shared state over a network.

The project therefore exposes problems that are central to Network Programming:

- multiple clients communicating with one server;
- concurrent actions;
- shared state ownership;
- ordering of messages;
- synchronization;
- transient network failures;
- reconnection;
- state recovery;
- invalid or conflicting requests;
- latency and packet loss;
- server capacity and load;
- correctness under concurrency.

The project should demonstrate not only that the game works, but also that the team understands why the network system works and how its correctness and performance were verified.

---

# 4. PROJECT VISION

## 4.1 Vision Statement

After the teacher's assignment is known, AI must finalize a game-specific North Star statement.

The general project direction is:

> Build a playable multiplayer game that demonstrates the design, implementation, synchronization, reliability and performance of a realtime client-server network system.

The final North Star must be adapted to the actual teacher assignment without changing the locked project principles.

## 4.2 Priority Order

The project priority is:

1. Demonstrate Network Programming knowledge.
2. Demonstrate performance/scalability measurement.
3. Demonstrate realtime synchronization/distributed state.
4. Deliver a complete playable multiplayer game loop.
5. Provide strong gameplay/UX only when it does not compromise the higher priorities.

---

# 5. PROJECT OBJECTIVES

## 5.1 Primary Objectives

- Build a playable multiplayer application.
- Implement a realtime client-server architecture.
- Design a clear network communication contract.
- Synchronize shared game state across clients.
- Handle concurrent player actions correctly.
- Handle disconnect/reconnect and state recovery.
- Validate game-critical actions on the server.
- Measure network/server behavior with real metrics.
- Perform automated testing and network degradation testing.
- Perform load testing and benchmarking.
- Produce evidence through tables, charts and analysis.
- Deliver documentation sufficient for demonstration and handover.

## 5.2 Network Objectives

The system must demonstrate, at project-summary level:

- HTTP + WebSocket communication;
- message envelope and sequence handling;
- snapshot + delta/event synchronization;
- hybrid authority;
- server validation of critical actions;
- deterministic conflict resolution;
- room isolation;
- reconnect and resync;
- latency/packet-loss/disconnect testing.

Detailed rules belong in `SRS.md`.

## 5.3 Engineering Objectives

The project must demonstrate:

- automated tests;
- concurrency testing;
- network degradation simulation;
- load testing;
- benchmark comparison;
- measurable metrics;
- documentation;
- reproducible demonstration.

---

# 6. PROJECT SCOPE

## 6.1 Core Scope

The following are Core Scope unless the teacher assignment explicitly makes a capability irrelevant:

### Multiplayer Foundation

- Guest identity;
- generated Player ID;
- Create Room;
- Join Room;
- Leave Room;
- Quick Play;
- Room status;
- Player list;
- Ready state;
- game-dependent room configuration.

### Realtime Game

- shared game state;
- realtime events;
- player presence;
- movement synchronization when the game contains movement;
- complete playable game loop.

### Synchronization

- full snapshot;
- delta/event updates;
- sequence tracking;
- periodic/triggered resynchronization.

### Reliability

- disconnect detection;
- configurable grace period;
- reconnect;
- state restoration;
- resync;
- invalid message handling;
- rate limiting.

### Testing / Validation

- Unit Test;
- Integration Test;
- E2E Test;
- Concurrency Test;
- Network Degradation Test;
- Load Test;
- Benchmark.

### Evidence

- metrics;
- benchmark tables;
- charts;
- comparison;
- analysis.

## 6.2 Optional Scope

Optional scope may contain:

- quality-of-life gameplay features;
- additional UX polish;
- non-critical game mechanics;
- additional visualization;
- additional benchmark scenarios;
- other enhancements proposed after Core Scope is stable.

Rules:

1. Optional Scope must never block Core Scope.
2. Optional Scope may be proposed by AI.
3. Optional Scope must be explicitly classified.
4. Optional Scope should be cut before any Core feature is weakened because of time pressure.

## 6.3 Game-Dependent Scope

The following are intentionally unresolved until the official assignment is received:

- game genre;
- game rules;
- player count;
- exact win/lose conditions;
- game-specific mechanics;
- game-specific world objects;
- movement requirements;
- player abilities;
- scoring model;
- room configuration parameters;
- game-specific UI;
- spectator/late-join behavior;
- exact critical requirements;
- exact demo scenario.

Every unresolved item must use `[GAME-DEPENDENT]` or `[TBD]`.

## 6.4 Explicit Out of Scope

AI should proactively identify scope-creep risks after reading the teacher assignment.

Potential out-of-scope areas include:

- production-grade enterprise deployment;
- enterprise authentication;
- autoscaling;
- complex matchmaking;
- advanced anti-cheat;
- mobile applications;
- unnecessary persistent live-game storage;
- unrelated monitoring platforms;
- features not required by the assignment and not necessary for the Core gameplay/network demonstration.

The final Out-of-Scope list must be adapted to the teacher assignment.

---

# 7. CORE FEATURES

## 7.1 Room and Match

The system supports, subject to game-specific rules:

```text
Create Room
    ↓
Waiting
    ↓
Join / Quick Play
    ↓
Player List
    ↓
Ready
    ↓
Playing
```

Room configuration may be game-dependent.

## 7.2 Player Identity

Baseline:

- guest name;
- generated Player ID;
- secure session token at the network layer.

Detailed security/session rules are defined in `SRS.md`.

## 7.3 Realtime Interaction

The project must support:

- shared state synchronization;
- discrete realtime events;
- presence changes;
- game-critical actions;
- movement synchronization when applicable.

## 7.4 Room Lifecycle

Baseline lifecycle:

```text
WAITING
   ↓
PLAYING
   ↓
PAUSED
   ↓
PLAYING
   ↓
ENDED
   ↓
WAITING (Rematch)
```

The exact lifecycle may be extended for game-specific requirements but must not silently contradict `SRS.md`.

---

# 8. MULTIPLAYER EXPERIENCE

## 8.1 Happy Path

The player experience should follow:

```text
Open Game
   ↓
Enter Guest Name
   ↓
Create / Join / Quick Play
   ↓
Waiting Room
   ↓
Ready
   ↓
Play
   ↓
Realtime Interaction
   ↓
Win / Lose / Objective Complete
   ↓
Result
   ↓
Rematch
```

## 8.2 Failure Path

Disconnect/reconnect is treated primarily as a system flow:

```text
Active Match
   ↓
Disconnect
   ↓
Grace Period
   ├── Reconnect → Restore State → Resync → Continue
   │
   └── Grace Expired → Remove / New Player Flow
```

## 8.3 Multiplayer Correctness

The same room must observe a consistent shared game state according to the authority and synchronization model defined in `SRS.md`.

Room isolation is mandatory.

---

# 9. USER JOURNEY

## 9.1 Standard Journey

```text
1. Launch
2. Enter identity
3. Create / Join / Quick Play
4. Enter waiting room
5. Observe players
6. Ready
7. Receive initial snapshot
8. Play
9. Exchange realtime state/events
10. Finish match
11. Observe result
12. Rematch
```

## 9.2 Recovery Journey

```text
Play
 ↓
Connection Lost
 ↓
Server Detects Disconnect
 ↓
Grace Period
 ↓
Reconnect
 ↓
Session / Player State Restored
 ↓
Missing Messages Replayed When Possible
 ↓
Full Snapshot Fallback When Necessary
 ↓
Recovered State Verified
 ↓
Continue
```

---

# 10. NETWORK JOURNEY

High-level network flow:

```text
HTTP
 │
 ├── Create Room
 ├── Join Room
 ├── Room Metadata
 └── Health Check
 │
 ▼
WebSocket
 │
 ├── Session Established
 ├── Full Snapshot
 ├── Realtime Events
 ├── Delta Updates
 ├── Presence
 └── Sequence Tracking
 │
 ├── Normal Flow
 │
 └── Disconnect
       ↓
   Reconnect
       ↓
   Replay Missing Messages
       ↓
   Full Snapshot Fallback
       ↓
   State Verification
```

Detailed protocol rules are defined in `SRS.md` and, if created, `NETWORK_SPEC.md`.

---

# 11. HIGH-LEVEL SYSTEM CAPABILITIES

The project should contain the following conceptual capabilities:

```text
Client
  ↓
HTTP / WebSocket
  ↓
Protocol Layer
  ↓
Session / Room
  ↓
Game State
  ↓
Synchronization
  ↓
Concurrency / Validation
  ↓
Persistence of Match History where required
```

Supporting capabilities:

- identity/session;
- room isolation;
- message sequencing;
- snapshot/delta/event handling;
- reconnect/resync;
- rate limiting;
- metrics;
- testing infrastructure.

This section intentionally does not replace the architecture document.

---

# 12. SUCCESS CRITERIA

The project is successful when it demonstrates three dimensions simultaneously.

## 12.1 Functional Success

- The game is playable.
- The core game loop works.
- Multiplayer interaction works.
- The match can finish.
- Rematch works where applicable.

## 12.2 Network Success

- Client-server communication works.
- Realtime state synchronization works.
- Concurrent actions are handled correctly.
- Critical actions are validated server-side.
- Disconnect/reconnect behavior works.
- Resynchronization works.
- Room isolation works.

## 12.3 Engineering Success

- Automated tests exist.
- Network scenarios are tested.
- Concurrency scenarios are tested.
- Network degradation is simulated.
- Load testing is performed.
- Benchmark data is collected.
- Metrics, charts and analysis are produced.
- Documentation and demo material are complete.

Network and engineering success have higher priority than advanced gameplay/UX.

---

# 13. PROJECT COMPLETION MODEL

## 13.1 Completion Dimensions

Completion must be measured using weighted categories.

The AI must define and lock the weights after analyzing the official teacher assignment.

Minimum tracked dimensions:

1. Feature Completion %
2. Network Completion %
3. Test Completion %
4. Overall Completion %

Additional categories may be introduced if the assignment requires them, but the calculation must remain transparent.

## 13.2 Weighted Completion Rule

Overall Completion must not be calculated as a naive count of all files, tasks or lines of code.

The calculation must reflect the importance of project outcomes.

Example structure:

```text
Overall %
=
Σ(Category Completion × Category Weight)
```

The final category weights must be recorded in this document after assignment analysis.

## 13.3 Critical Requirements

A separate `CRITICAL_REQUIREMENTS` list must exist.

Baseline critical requirements include:

- multiplayer works;
- client-server communication works;
- shared state synchronization works;
- one complete match can be played;
- critical actions are server-validated;
- no critical crash prevents the demo;
- the primary demo scenario can execute.

Game-specific critical requirements must be added after the teacher assignment is known.

## 13.4 Demo-Safe Threshold

A fixed `DEMO_SAFE_THRESHOLD` percentage is mandatory.

The AI must calculate and lock this threshold **before implementation begins**, after:

1. reading the teacher assignment;
2. defining Core Scope;
3. defining category weights;
4. identifying Critical Requirements;
5. analyzing the minimum functionality required for a meaningful demonstration.

The threshold must be a concrete percentage.

It must not be chosen arbitrarily.

Once locked, it becomes a project decision and must not be silently changed.

## 13.5 Demo-Safe Gate

Demo-Safe status requires both:

```text
Overall Completion >= DEMO_SAFE_THRESHOLD
AND
all Demo-Critical Requirements = PASS
```

Therefore:

```text
Overall % alone does NOT determine demo readiness.
```

A project with a high percentage but missing a critical multiplayer/network requirement is not Demo-Safe.

## 13.6 Emergency Completion Strategy

If time, infrastructure, or technical failures make 100% completion impossible:

Priority is:

```text
1. Protect Critical Requirements
2. Protect Demo-Safe Threshold
3. Complete Core Scope
4. Complete required Network Scope
5. Complete required Testing / Benchmark
6. Cut Optional Scope
7. Document remaining issues
```

The project must explicitly report:

- Completed;
- Partially Completed;
- Not Completed;
- Known Issues;
- Risk to Demo;
- Recommended Next Steps.

---

# 14. DEMO SCENARIO

A concrete demo scenario is mandatory.

The final scenario must be created after the teacher assignment is known.

Baseline structure:

```text
1. Launch server
2. Launch multiple clients
3. Create / Join Room
4. Show room/player state
5. Start match
6. Demonstrate realtime interaction
7. Demonstrate shared-state synchronization
8. Demonstrate a game-critical action
9. Complete the match
10. Show result / rematch
11. Demonstrate at least one reliability scenario
12. Show automated test evidence
13. Show benchmark/load-test evidence
```

The exact demo must be adapted to the actual game.

A detailed executable procedure may be maintained in `DEMO_PLAN.md`.

---

# 15. PROJECT READINESS GATE

The project may move from Project Spec into detailed SRS/Architecture work only when the following gate passes:

```text
[ ] Teacher requirements understood
[ ] Teacher constraints mapped
[ ] Project purpose locked
[ ] Project objectives locked
[ ] Core Scope identified
[ ] Optional Scope identified
[ ] Game-Dependent Scope identified
[ ] Out-of-Scope identified
[ ] User Journey defined
[ ] Network Journey defined
[ ] Critical Requirements identified
[ ] Completion model defined
[ ] Category weights calculated
[ ] DEMO_SAFE_THRESHOLD calculated and locked
[ ] Demo scenario defined at high level
[ ] No unresolved critical ambiguity
[ ] No unresolved critical requirement conflict
```

## Gate Rule

`PROJECT_READINESS = PASS` only when all mandatory items above are resolved.

The AI must not silently fill unresolved critical information with guesses.

---

# 16. TRACEABILITY

Every important project objective must eventually map through:

```text
Project Objective
      ↓
Feature
      ↓
SRS Requirement
      ↓
Implementation
      ↓
Test
      ↓
Acceptance
```

The detailed traceability matrix belongs in `SRS.md`, but `01_PROJECT_SPEC.md` must preserve the project-level mapping.

---

# 17. TEAM / DELIVERY BOUNDARY

## Person A — Game / Client / UX

Responsible for:

- UI;
- game world;
- player representation;
- input;
- game mechanics;
- animation/rendering;
- client-side gameplay integration.

Must use the defined Network API/Protocol and must not independently invent network contracts.

## Person B — Network / Server

Responsible for:

- HTTP;
- WebSocket;
- protocol;
- serialization;
- room/session;
- shared state;
- synchronization;
- concurrency;
- reconnect/resync;
- server validation;
- rate limiting.

## Person C — Integration / Performance / QA

Responsible for:

- integration;
- automated tests;
- concurrency/failure testing;
- network degradation;
- load testing;
- metrics;
- benchmark;
- charts;
- analysis;
- README/report/demo support.

All team members must understand the shared architecture and contracts.

Detailed Vibe Coding workflow is maintained separately in `TEAM_WORKFLOW.md`.

---

# 18. DEPENDENCY ON TEACHER ASSIGNMENT

The official teacher assignment is the authoritative source for game-specific requirements.

When the assignment is received, AI must process it in this order:

```text
Teacher Assignment
        ↓
Analyze Constraints
        ↓
Update Project Spec
        ↓
Resolve [GAME-DEPENDENT]
        ↓
Define Critical Requirements
        ↓
Calculate Category Weights
        ↓
Calculate & LOCK DEMO_SAFE_THRESHOLD
        ↓
Project Readiness Audit
        ↓
Complete / Update SRS
        ↓
Freeze Network Protocol
        ↓
Architecture
        ↓
Implementation
```

## Change Rule

AI may update sections beyond `[GAME-DEPENDENT]` when the teacher assignment genuinely affects those sections.

Every meaningful change must be recorded in `Change Log`.

A LOCKED requirement must never be silently overwritten.

If a new assignment requirement conflicts with a locked principle, AI must surface the conflict for team decision.

---

# 19. CHANGE LOG

| Date | Change | Reason | Impact | Decision |
|---|---|---|---|---|
| TBD | Initial Project Spec created | Project planning | Baseline | LOCKED |
| TBD | Teacher assignment integrated | Official assignment received | Game-specific scope | TBD |

AI must append meaningful changes here.

---

# 20. AI PROJECT-SPEC READINESS AUDIT

Before declaring this document ready, AI must verify:

## Identity

- [ ] Project is clearly identified as a Network Programming project.
- [ ] Multiplayer game is clearly defined as the application proving networking capability.
- [ ] Network/engineering priority over advanced gameplay is explicit.

## Scope

- [ ] Core Scope is defined.
- [ ] Optional Scope is defined.
- [ ] Game-Dependent Scope is identified.
- [ ] Out-of-Scope risks are identified.

## Requirements

- [ ] Teacher assignment has been analyzed.
- [ ] Critical Requirements are identified.
- [ ] No critical requirement is based on an AI guess.
- [ ] Conflicts with locked requirements are surfaced.

## Completion

- [ ] Completion dimensions exist.
- [ ] Weights are calculated and documented.
- [ ] Demo-Safe Threshold is a concrete percentage.
- [ ] Demo-Safe Threshold is calculated before implementation.
- [ ] Critical Requirements are part of Demo-Safe Gate.
- [ ] Emergency scope-cutting strategy exists.

## Delivery

- [ ] User Journey is defined.
- [ ] Network Journey is defined.
- [ ] Demo Scenario exists.
- [ ] Traceability path exists.
- [ ] Team boundaries are defined.
- [ ] Change Log is maintained.

## Final Gate

The AI may declare:

```text
PROJECT_SPEC_STATUS = READY
```

only when:

```text
Teacher Requirements = UNDERSTOOD
AND
Critical Ambiguity = 0
AND
Core Scope = DEFINED
AND
Critical Requirements = DEFINED
AND
Completion Model = DEFINED
AND
DEMO_SAFE_THRESHOLD = LOCKED
AND
Project Readiness Gate = PASS
```

---

# 21. FINAL AI INSTRUCTION

When working on this project:

> **Do not code first. Understand the project first.**

The AI must:

1. Read this file.
2. Read the teacher assignment.
3. Map the assignment against this document.
4. Update only what is justified by the assignment.
5. Complete game-dependent requirements.
6. Calculate and lock the Demo-Safe Threshold.
7. Run the Project Readiness Audit.
8. Update `SRS.md`.
9. Freeze the network contract before implementation.
10. Then proceed to architecture and coding.

If information is unknown:

```text
UNKNOWN → [TBD]
GAME-SPECIFIC → [GAME-DEPENDENT]
CONFLICT → STOP + SURFACE
```

Never:

```text
UNKNOWN → GUESS
CONFLICT → SILENTLY OVERWRITE
OPTIONAL → TREAT AS CORE
GAME-DEPENDENT → INVENT
```

---

# 22. DECISION REGISTER

| ID | Decision |
|---|---|
| Q1 | Project is both a Network Programming exercise and a realtime multiplayer system demonstrated through a game. |
| Q2 | Primary proof is the ability to design/implement Network Programming through a multiplayer game. |
| Q3 | Game is playable with a complete basic rule loop, without deep gameplay requirements. |
| Q4 | Core + Optional + Explicit Out of Scope. |
| Q5 | Project Spec summarizes network requirements; SRS contains details. |
| Q6 | Academic problem/context is explicitly described. |
| Q7 | Unknown game topic uses `[GAME-DEPENDENT]`. |
| Q8 | AI may update affected Project Spec sections after receiving the assignment; changes must be logged and locked principles cannot be silently changed. |
| Q9 | Network communication, synchronization, concurrency, reliability, performance, protocol, testing are all project objectives. |
| Q10 | Network Programming is the core; multiplayer game is the proving environment; realtime client-server architecture must be visible. |
| Q11 | Complete basic playable game loop. |
| Q12 | Realtime continuous state + discrete events, adapted to the game. |
| Q13 | Benchmark + load test + metrics + charts + analysis + comparison. |
| Q14 | Functional + Network + Engineering success, with Network/Engineering prioritized. |
| Q15 | North Star exists and is finalized after the teacher assignment. |
| Q16 | Create/Join/Leave + Quick Play + Room status/player list/ready + game-dependent configuration. |
| Q17 | Guest name + generated Player ID. |
| Q18 | Shared state + realtime events + presence; movement only if applicable. |
| Q19 | Snapshot + Delta/Event + periodic/triggered resync. |
| Q20 | All reliability controls are required. |
| Q21 | Network degradation covers latency + packet loss + disconnect. |
| Q22 | Unit + Integration + E2E + Concurrency + Network Degradation + Load + Benchmark. |
| Q23 | Collect metrics for benchmark/report; do not build a monitoring platform. |
| Q24 | AI may add necessary game features, but must classify and record them. |
| Q25 | Optional features may be proposed/added but must never affect Core Scope. |
| Q26 | AI should proactively identify scope-creep risks and Out of Scope. |
| Q27 | User journey combines happy path with disconnect/reconnect system flow. |
| Q28 | Network Journey is summarized here and detailed elsewhere. |
| Q29 | Demo should show all major functional/network/testing/performance/documentation evidence. |
| Q30 | Project Spec defines a concrete Demo Scenario. |
| Q31 | Full completion includes Core + Network + Tests + Benchmark/Load + Documentation + Demo + Handover. |
| Q32 | Completion uses weighted categories and tracks Feature/Network/Test/Overall percentages. |
| Q33 | Success criteria combine scope classification and Requirement → Implementation → Test → Acceptance traceability. |
| Q34 | Teacher Assignment → Analyze Constraints → Update Project Spec → Complete SRS → Protocol Freeze → Architecture → Implementation. |
| Q35 | Project Readiness Gate is mandatory before moving forward. |
| Q36 | A fixed Demo-Safe Threshold is required; AI must calculate and lock it rather than arbitrarily guessing it. |
| Q37 | Category weights are determined by AI after analyzing the teacher assignment and then locked. |
| Q38 | Critical Requirements exist as a baseline plus game-specific additions. |
| Q39 | If 100% becomes impossible, protect Critical Requirements and Demo-Safe Level, cut Optional Scope, and document remaining work/risks. |
| Q40 | Use the defined Project Spec structure. |
| Q41 | AI updates affected sections, completes game-dependent items, records changes, and surfaces conflicts instead of silently overwriting locked requirements. |
| Q42 | AI must calculate and lock a concrete Demo-Safe percentage threshold before implementation. |

---

# 23. DOCUMENT STATUS

Current status before official teacher assignment:

```text
PROJECT_SPEC = BASELINE READY
GAME_SPECIFIC_REQUIREMENTS = PENDING TEACHER ASSIGNMENT
DEMO_SAFE_THRESHOLD = MUST BE CALCULATED AFTER ASSIGNMENT ANALYSIS
PROJECT_READINESS = NOT YET READY FOR IMPLEMENTATION
```

After the teacher assignment is received, this document must be updated and the Project Readiness Gate must be rerun before implementation begins.