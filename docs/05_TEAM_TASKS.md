# 05 --- TEAM TASKS & EXECUTION PLAN

**Document:** `05_TEAM_TASKS.md`\
**Status:** `TEAM TASKS FROZEN — ASSIGNMENT INTEGRATED (BÀI 2 - OTTV2 MULTIPLAYER)`\
**Scope:** Team ownership (3 Sinh viên phụ trách Bài 2), execution workflow, handoff, review,
integration, testing evidence, release/demo readiness\
**Project:** INT3304 --- Network Programming\
**Source of Truth:** `01_PROJECT_SPEC.md` → `02_ARCHITECTURE.md` →
`03_NETWORK_SPEC.md` → `04_TEST_PLAN.md` → `SRS.md` + consolidated Team Operating
Plan

> **Important:** This document defines how the team executes the
> project. It does not replace the Project Spec, Architecture, Network
> Spec, Test Plan, SRS, or Teacher Assignment.

------------------------------------------------------------------------

# 1. PURPOSE

`05_TEAM_TASKS.md` defines:

-   who owns each project area;
-   who reviews shared or cross-domain work;
-   how work is decomposed and handed off;
-   how dependencies are managed;
-   how Git/PR/merge is controlled;
-   how AI coding agents are permitted to work;
-   how shared contracts are protected;
-   how tasks become `DONE`;
-   how integration, testing, benchmark and demo readiness are gated;
-   how scope is reduced safely when time is insufficient.

The document is an execution/governance layer over the existing project
contracts.

It MUST NOT invent game-specific requirements before the official
Teacher Assignment is known.

------------------------------------------------------------------------

# 2. SOURCE OF TRUTH & AUTHORITY

The project document hierarchy is:

``` text
Teacher Assignment
        ↓
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
README / Demo / Handover
```

For different questions:

  Question                                   Source of Truth
  ------------------------------------------ ----------------------
  What the project is / scope / completion   `01_PROJECT_SPEC.md`
  Detailed requirements                      `SRS.md`
  Components / boundaries / architecture     `02_ARCHITECTURE.md`
  Client ↔ Server protocol                   `03_NETWORK_SPEC.md`
  Testing / evidence / benchmark             `04_TEST_PLAN.md`
  Who does what / workflow / handoff         `05_TEAM_TASKS.md`
  Official game-specific requirements        Teacher Assignment

If documents conflict:

``` text
STOP affected work
      ↓
Identify source requirement
      ↓
Analyze impact
      ↓
Create Decision Request
      ↓
Team decision
      ↓
Update affected document(s)
      ↓
Update Change Log / Decision Log
      ↓
Resume work
```

No document may silently override a locked requirement.

------------------------------------------------------------------------

# 3. CURRENT PROJECT STATE

Official Teacher Assignment Integrated:

``` text
PROJECT_SPEC
  = ASSIGNMENT INTEGRATED (BÀI 2 — OTTV2 MULTIPLAYER)

GAME-SPECIFIC REQUIREMENTS
  = RESOLVED (OTTv2 9x9 Grid, King-like 8-direction move, RPS combat, same-type blocking, victory by extinction or a1/i9)

DEMO_SAFE_THRESHOLD
  = 90%

CATEGORY WEIGHTS
  = LOCKED (Core Protocol: 30%, Game Rules: 25%, Reliability: 25%, QA/Benchmark: 20%)

CONCRETE GAME TASKS
  = FULLY MAPPED TO 3-STUDENT TEAM

PROJECT_READINESS
  = 100% READY FOR IMPLEMENTATION
```

Therefore:

-   Bài 2 scope is confirmed: Realtime multiplayer board game OTTv2 using playfull.html / playhtml.fun architecture;
-   Team structure is locked: 3 students responsible for Bài 2 (Person A: Client/UX, Person B: Server/Logic, Person C: QA/Benchmark);
-   Game mechanics are locked: 9x9 board (a1..i9), 8-direction King-movement, Rock-Paper-Scissors combat, same-type blocking, win conditions: complete extinction of one piece type or reaching goal square a1/i9;
-   Deployment requirement: Public deployment link included in Git repository.

------------------------------------------------------------------------

# 4. TEAM ROLES

Stable role IDs are used until real team-member names are intentionally
mapped.

## 4.1 Person A --- Client / Game / Presentation

**Primary areas:**

-   Client;
-   UI;
-   Game Presentation;
-   Player Representation;
-   Input;
-   Game World;
-   Game Mechanics;
-   Animation / Rendering;
-   Client-side Gameplay Integration;
-   Game-specific Client.

**Constraints:**

-   MUST use the defined Network API / Protocol;
-   MUST NOT independently invent or redefine shared network contracts;
-   implements OTTv2 9x9 client interface, piece rendering, King-movement controls, and playfull.html DOM synchronization.

------------------------------------------------------------------------

## 4.2 Person B --- Network / Server

**Primary areas:**

-   HTTP;
-   WebSocket;
-   Protocol;
-   Serialization;
-   Session;
-   Room;
-   Server;
-   Canonical State;
-   Synchronization;
-   Validation;
-   Concurrency / Ordering;
-   Reconnect / Resync;
-   Rate Limiting;
-   Network-facing server behavior.

**Constraints:**

-   Server is authoritative for canonical game state;
-   MUST follow frozen `03_NETWORK_SPEC.md`;
-   MUST NOT unilaterally redefine shared protocol;
-   implements authoritative OTTv2 game engine (9x9 board, 8-direction movement, RPS combat, same-type blocking, victory condition verification).

------------------------------------------------------------------------

## 4.3 Person C --- Integration / QA / Performance

**Primary areas:**

-   Integration;
-   Automated Tests;
-   Contract Testing;
-   Concurrency / Failure Testing;
-   Network Degradation;
-   Load Testing;
-   Benchmark;
-   Metrics;
-   Charts;
-   Analysis;
-   QA;
-   README / Report / Demo Support;
-   Evidence and traceability coordination.

**Constraints:**

-   testing does not replace domain ownership;
-   a test PASS is not sufficient without requirement traceability and
    appropriate evidence;
-   protocol correctness requires Client + Server coverage.

------------------------------------------------------------------------

# 5. GOVERNANCE RULES

## 5.1 Ownership Model

Every work package uses:

``` text
Primary Owner
+
Required Reviewer
```

For cross-domain work, additional reviewers may be required.

The owner is responsible for execution and preparation of evidence.

The reviewer is responsible for checking correctness against the
relevant contract.

No person may approve their own PR.

------------------------------------------------------------------------

## 5.2 Shared Contract Rule

The following are protected/shared artifacts:

-   `SRS.md`;
-   `01_PROJECT_SPEC.md`;
-   `02_ARCHITECTURE.md`;
-   `03_NETWORK_SPEC.md`;
-   shared protocol schemas;
-   shared typed models/interfaces;
-   shared state/serialization contracts;
-   cross-domain acceptance contracts.

A team member or AI agent MUST NOT make a breaking shared-contract
change unilaterally.

------------------------------------------------------------------------

## 5.3 Conflict Rule

When an implementation conflict is discovered:

``` text
STOP
  ↓
Identify affected requirement/contract
  ↓
Identify affected components
  ↓
Assess testing/performance/dependency impact
  ↓
Decision Request
  ↓
Team approval
  ↓
Update contract/document
  ↓
Update Change Log / Decision Log
  ↓
Resume implementation
```

The easiest implementation is not automatically the correct
implementation.

------------------------------------------------------------------------

# 6. RACI / RESPONSIBILITY MATRIX

`R` = Responsible for execution\
`A` = Accountable / primary decision owner for the work package\
`C` = Consulted\
`I` = Informed

  -----------------------------------------------------------------------
  Work Package      Person A          Person B          Person C
  ----------------- ----------------- ----------------- -----------------
  Project scope /   C                 C                 C
  game requirements                                     

  Client / UI       A/R               C                 C

  Player            A/R               C                 C
  representation                                        

  Input             A/R               C                 C

  Game-specific     A/R               C                 C
  client                                                

  HTTP              C                 A/R               C

  WebSocket         C                 A/R               C

  Protocol          C                 A/R               R/C
  implementation                                        

  Protocol schema / R/C               A/R               R/C
  typed models                                          

  Session / Room    C                 A/R               C

  Canonical state   C                 A/R               C

  Synchronization   C                 A/R               R/C

  Validation        C                 A/R               R/C

  Concurrency /     C                 A/R               R/C
  ordering                                              

  Reconnect /       C                 A/R               R/C
  resync                                                

  Integration       C                 C                 A/R

  Contract tests    C                 R                 A/R

  Unit tests        R in client       R in              A/R for test
                    domain            server/network    coordination
                                      domain            

  Integration tests C                 C                 A/R

  E2E tests         C                 C                 A/R

  Network           C                 R                 A/R
  degradation                                           

  Load / stress     C                 R                 A/R

  Benchmark         C                 R                 A/R

  Metrics / charts  C                 C                 A/R
  / analysis                                            

  Documentation /   R/C               R/C               A/R
  report                                                

  Demo support      R                 R                 A/R

  Shared-contract   C                 C                 C
  change                                                

  Release / Demo    R                 R                 A/R
  Gate                                                  
  -----------------------------------------------------------------------

For shared-contract changes, no single person is a unilateral authority.
The relevant domain owners and reviewers must participate in the
decision.

------------------------------------------------------------------------

# 7. WORK PACKAGE MAP

## WP-00 --- Assignment & Readiness

**Owner:** Team / AI coordination\
**Review:** All members

Tasks:

1.  Receive official Teacher Assignment.
2.  Analyze constraints.
3.  Update `01_PROJECT_SPEC.md`.
4.  Resolve OTTv2 game mechanics and playfull.html requirements.
5.  Define Critical Requirements.
6.  Calculate category weights.
7.  Calculate and lock `DEMO_SAFE_THRESHOLD`.
8.  Run Project Readiness Gate.
9.  Complete/update SRS.
10. Confirm architecture and protocol readiness before implementation.

**Status:** `COMPLETE — TEACHER ASSIGNMENT INTEGRATED`

**Evidence:**

-   assignment mapping;
-   updated Project Spec;
-   Critical Requirements;
-   locked weights;
-   locked Demo-Safe Threshold;
-   readiness checklist.

------------------------------------------------------------------------

## WP-01 --- Client / Presentation

**Owner:** Person A\
**Required Review:** Person B for network-facing interfaces; Person C
for integration/test evidence

Tasks:

-   Client application structure;
-   UI;
-   player representation;
-   input;
-   game presentation;
-   network adapter integration;
-   client state application;
-   client-side validation of inbound protocol messages;
-   OTTv2 client behavior: 9x9 board rendering, piece selection, 8-direction King-movement highlight, RPS interaction feedback, playfull.html attribute synchronization.

**Dependencies:**

``` text
Architecture
+
Frozen Protocol
+
Game Requirements
```

**Evidence:**

-   client implementation;
-   client unit/integration tests as applicable;
-   integration evidence;
-   demo evidence.

------------------------------------------------------------------------

## WP-02 --- Server / Network Core

**Owner:** Person B\
**Required Review:** Person A for client-facing contracts; Person C for
testability/evidence

Tasks:

-   HTTP control plane;
-   WebSocket realtime plane;
-   protocol parsing;
-   serialization/deserialization;
-   message validation;
-   session lifecycle;
-   room lifecycle;
-   server-side authorization;
-   canonical state ownership;
-   synchronization;
-   concurrency/order handling;
-   reconnect/resync;
-   rate limiting;
-   error handling.

**Dependencies:**

``` text
Frozen Protocol
+
Architecture
+
SRS
```

**Evidence:**

-   implementation;
-   contract tests;
-   server tests;
-   integration tests;
-   recovery evidence;
-   performance evidence where applicable.

------------------------------------------------------------------------

## WP-03 --- Protocol & Shared Contracts

**Primary Owner:** Person B\
**Required Reviewers:** Person A + Person C

The protocol itself is defined by `03_NETWORK_SPEC.md`.

Core protocol is currently frozen.

Required implementation areas include, as applicable to the frozen
specification:

-   schema;
-   typed models;
-   serialization;
-   message catalog;
-   state ownership;
-   snapshot;
-   delta;
-   event model;
-   sequence;
-   ordering;
-   duplicate handling;
-   resync;
-   replay;
-   snapshot fallback;
-   reconnect;
-   heartbeat;
-   validation;
-   security boundaries;
-   room isolation;
-   error handling.

Protocol tests must cover both Client and Server.

**Game-specific additions:**

``` text
[GAME-DEPENDENT_COMMAND]
[GAME-DEPENDENT_EVENT]
[GAME-DEPENDENT_STATE]
[GAME-DEPENDENT_OBJECT]
```

No game-specific protocol invention before the assignment.

------------------------------------------------------------------------

## WP-04 --- Integration

**Owner:** Person C\
**Required Review:** Person A + Person B

Tasks:

-   integrate Client + Server;
-   verify protocol compatibility;
-   verify shared state flow;
-   verify room/session flow;
-   verify synchronization;
-   verify failure/recovery paths;
-   identify integration regressions;
-   maintain integration evidence.

**Dependency:**

``` text
Client baseline
+
Server baseline
+
Frozen shared contracts
```

------------------------------------------------------------------------

## WP-05 --- Automated Testing

**Owner:** Person C\
**Required Review:** Domain owner(s)

Test levels:

``` text
Unit
  ↓
Contract
  ↓
Integration
  ↓
E2E
  ↓
Concurrency / Network Degradation
  ↓
Load / Benchmark
```

Testing MUST remain requirement-driven and evidence-driven.

Traceability:

``` text
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

------------------------------------------------------------------------

## WP-06 --- Network Degradation / Reliability

**Owner:** Person C\
**Required Review:** Person B

Required baseline scenarios include:

-   latency;
-   packet loss;
-   disconnect;
-   reconnect;
-   sequence gap;
-   resync;
-   replay;
-   snapshot fallback;
-   duplicate handling;
-   recovery verification.

Evidence should include appropriate:

-   logs;
-   message traces;
-   sequence values;
-   state snapshots;
-   state hashes;
-   recovery results.

------------------------------------------------------------------------

## WP-07 --- Load / Stress / Benchmark

**Owner:** Person C\
**Technical Reviewer:** Person B\
**Client Reviewer:** Person A when client workload is involved

Required baseline:

-   load test;
-   sustained load;
-   peak load;
-   stress test;
-   multi-room workload;
-   latency metrics;
-   throughput metrics;
-   CPU/memory metrics;
-   tick metrics;
-   network degradation metrics;
-   Snapshot vs Delta/Event benchmark.

Minimum load models:

``` text
Model A: One Room / Many Players
Model B: Many Rooms / Few Players
Model C: Mixed Workload
```

No hard capacity number is invented before Game Topic, benchmark
environment and baseline measurement are known.

Each performance run records:

-   configuration;
-   environment;
-   raw metrics;
-   processed metrics;
-   charts;
-   analysis;
-   comparison against acceptance criteria;
-   conclusion.

------------------------------------------------------------------------

## WP-08 --- Documentation / Demo / Handover

**Owner:** Person C\
**Required Review:** Person A + Person B

Deliverables include:

-   README support;
-   test report support;
-   benchmark report support;
-   known issues;
-   limitations;
-   evidence index;
-   demo support;
-   final handover checklist.

The executable Demo Scenario for OTTv2 (9x9 Board Game): Match initialization, piece moves in 8 directions, RPS piece captures, blocking demonstrations, victory via goal-square infiltration (a1/i9) or piece extinction, and reconnect grace period verification.

Baseline demo structure may include:

``` text
Launch server
→ launch multiple clients
→ Create / Join Room
→ show room/player state
→ Start match
→ realtime interaction
→ shared-state synchronization
→ game-critical action
→ complete match
→ result/rematch
→ reliability scenario
→ automated test evidence
→ benchmark/load evidence
```

------------------------------------------------------------------------

# 8. DEPENDENCY & EXECUTION ORDER

The default execution order is:

``` text
Teacher Assignment
        ↓
Analyze Constraints
        ↓
Update Project Spec
        ↓
Resolve OTTv2 Game & playfull.html Requirements
        ↓
Critical Requirements
        ↓
Category Weights
        ↓
DEMO_SAFE_THRESHOLD
        ↓
Project Readiness Gate
        ↓
SRS
        ↓
Protocol / Architecture Confirmation
        ↓
Protocol Freeze
        ↓
A: Client          B: Server/Network          C: Test Infrastructure
        │                 │                         │
        └─────────────────┼─────────────────────────┘
                          ↓
                      Integration
                          ↓
                  Functional / Network Tests
                          ↓
                  Reliability / Concurrency
                          ↓
                    Load / Benchmark
                          ↓
                 Evidence / Traceability
                          ↓
                 Demo / Release Candidate
```

Dependencies are recorded at contract/milestone level rather than
guessed class/function level.

------------------------------------------------------------------------

# 9. HANDOFF CONTRACT

A handoff is complete only when it contains:

``` text
1. OUTPUT
2. CONTRACT / INTERFACE
3. VERIFICATION METHOD
4. KNOWN ISSUES
5. NEXT OWNER
```

Example:

``` text
B → A

OUTPUT:
  Network adapter / protocol implementation

CONTRACT:
  03_NETWORK_SPEC.md

VERIFY:
  Contract + integration tests

KNOWN ISSUES:
  None. Shared contracts verified and frozen.

NEXT OWNER:
  A — client integration
```

A chat message such as "done" is not sufficient handoff evidence.

------------------------------------------------------------------------

# 10. DEFINITION OF DONE

A Core work package is `DONE` only when all applicable conditions are
satisfied:

``` text
[ ] Scope is understood
[ ] Correct Source of Truth was used
[ ] Implementation is complete
[ ] Shared contracts are respected
[ ] Required tests exist
[ ] Required tests pass
[ ] Evidence is retained
[ ] Required Reviewer has reviewed
[ ] No unresolved blocking issue remains
[ ] Handoff information is complete
[ ] Traceability is updated where required
```

Possible states:

``` text
NOT STARTED
IN PROGRESS
BLOCKED
READY FOR REVIEW
CHANGES REQUESTED
DONE
ACCEPTED
```

`DONE` MUST NOT be used merely because code compiles or because an
individual test passes.

------------------------------------------------------------------------

# 11. GIT / BRANCH / PR / MERGE RULES

## 11.1 Branch Strategy

`main` is the stable branch.

Feature branches are used for work packages:

``` text
feature/client-*
feature/server-*
feature/protocol-*
feature/test-*
feature/benchmark-*
docs/*
```

Branch names should communicate the work area.

------------------------------------------------------------------------

## 11.2 Pull Requests

A PR is required for shared-contract, integration,
architecture-sensitive or other changes where review is needed.

Every PR should state:

-   purpose;
-   scope;
-   affected components;
-   related requirement/task;
-   tests executed;
-   evidence;
-   known issues;
-   reviewer needed.

------------------------------------------------------------------------

## 11.3 Merge Authority

The PR creator does not approve their own PR.

For protected/shared contracts:

``` text
Author
  ↓
Required Reviewer(s)
  ↓
Relevant Tests
  ↓
Merge
```

------------------------------------------------------------------------

## 11.4 Commit Rules

Commits should:

-   describe their purpose;
-   remain reviewable;
-   avoid unrelated changes;
-   be small enough to revert where practical.

A complicated commit-format policy is not required unless the team later
decides one is necessary.

------------------------------------------------------------------------

## 11.5 Merge Conflicts

If a conflict touches a shared contract:

``` text
DO NOT blindly choose ours/theirs
        ↓
Identify semantic difference
        ↓
Check source requirement
        ↓
Decision Request if necessary
        ↓
Resolve
        ↓
Re-run affected tests
        ↓
Review
        ↓
Merge
```

------------------------------------------------------------------------

# 12. AI AGENT AUTHORITY

## Level 0 --- Contract / Pre-code

AI may:

-   analyze requirements;
-   identify ambiguities;
-   propose architecture/task changes;
-   create skeletons;
-   design tests;
-   prepare implementation maps.

AI must not invent unresolved game requirements.

------------------------------------------------------------------------

## Level 1 --- Domain Implementation

AI may implement within the assigned domain.

Examples:

``` text
Person A AI
→ Client / UI / Game Presentation

Person B AI
→ Server / Network / Protocol Implementation

Person C AI
→ Tests / Integration / Benchmark / QA
```

AI must follow the frozen contracts.

------------------------------------------------------------------------

## Level 2 --- Cross-domain / Shared Contract

AI MUST NOT unilaterally:

-   change game rules;
-   change shared protocol semantics;
-   introduce breaking shared types;
-   redesign architecture;
-   alter locked requirements;
-   weaken required testing policy.

Instead:

``` text
AI detects need
    ↓
Decision Request
    ↓
Impact analysis
    ↓
Team decision
    ↓
Contract/document update
    ↓
Implementation
```

------------------------------------------------------------------------

# 13. AI CONTEXT SYNCHRONIZATION

Before an AI agent starts a task, it must read the relevant:

``` text
Source of Truth
+
Current Contract
+
Assigned Task
+
Known Dependencies
```

At minimum, shared/network tasks must use:

``` text
01_PROJECT_SPEC.md
02_ARCHITECTURE.md
03_NETWORK_SPEC.md
04_TEST_PLAN.md
```

After a shared-contract change:

``` text
Contract updated
      ↓
Affected agents re-read/update context
      ↓
Affected implementation/tests revalidated
      ↓
Continue
```

AI must not rely on stale assumptions.

------------------------------------------------------------------------

# 14. INTEGRATION CHECKPOINTS

## Checkpoint 0 --- Readiness

Required before implementation:

-   Teacher Assignment understood;
-   game-dependent requirements resolved where possible;
-   Critical Requirements defined;
-   weights calculated;
-   Demo-Safe Threshold locked;
-   Project Readiness Gate passed.

------------------------------------------------------------------------

## Checkpoint 1 --- Contract Ready

Required:

-   SRS relevant requirements;
-   Architecture boundaries;
-   Protocol contract;
-   shared types/interfaces;
-   test strategy.

------------------------------------------------------------------------

## Checkpoint 2 --- Core Implementation

Required:

-   Client baseline;
-   Server/network baseline;
-   core integration path;
-   relevant unit/contract tests.

------------------------------------------------------------------------

## Checkpoint 3 --- Realtime / Reliability

Required:

-   synchronization;
-   snapshot/delta/event;
-   sequence;
-   resync;
-   reconnect;
-   heartbeat;
-   error handling;
-   relevant concurrency tests.

------------------------------------------------------------------------

## Checkpoint 4 --- Performance

Required:

-   load test;
-   benchmark;
-   network degradation;
-   metrics;
-   charts;
-   analysis.

------------------------------------------------------------------------

## Checkpoint 5 --- Demo / Release Candidate

Required:

-   Core functionality;
-   network flow;
-   required tests;
-   benchmark/load evidence;
-   documentation;
-   known issues;
-   Demo-Safe Gate.

------------------------------------------------------------------------

# 15. TESTING & EVIDENCE RESPONSIBILITIES

## 15.1 General Rule

Every important requirement must eventually map:

``` text
Requirement
→ Implementation
→ Test
→ Execution
→ Evidence
→ Acceptance
```

Detailed traceability belongs in the SRS/Test artifacts; this file
tracks responsibility for maintaining it.

------------------------------------------------------------------------

## 15.2 Protocol Testing

Protocol tests are jointly owned by:

``` text
Client + Server
```

Person C coordinates/executes the testing framework and evidence where
applicable.

Minimum protocol test classes include:

-   schema validation;
-   typed model validation;
-   serialization;
-   contract;
-   unit;
-   integration;
-   E2E;
-   concurrency;
-   network degradation;
-   load;
-   benchmark.

------------------------------------------------------------------------

## 15.3 Evidence

Evidence may include:

-   automated test output;
-   logs;
-   HTTP request/response;
-   WebSocket traces;
-   sequence information;
-   state snapshots;
-   state hashes;
-   performance metrics;
-   resource metrics;
-   screenshots/video where genuinely useful.

Evidence must be sufficient to support acceptance.

------------------------------------------------------------------------

# 16. BENCHMARK / LOAD RESPONSIBILITIES

Person C coordinates execution and reporting.

Person B owns server/network interpretation.

Person A supports client-side workload interpretation where applicable.

The benchmark must compare:

``` text
Full Snapshot
vs
Delta/Event
```

under comparable:

-   state;
-   workload;
-   environment;
-   measurement methodology.

Relevant metrics include:

-   message count;
-   bandwidth;
-   CPU;
-   latency;
-   processing overhead.

The team must not invent a hard capacity number before the game topic,
environment and baseline are known.

------------------------------------------------------------------------

# 17. DEMO / RELEASE CANDIDATE GATE

A Demo/Release Candidate is eligible only after the team verifies the
applicable:

``` text
[ ] Core functionality
[ ] Client-server communication
[ ] Shared-state synchronization
[ ] Required game-critical behavior
[ ] Required reliability scenario
[ ] Required automated tests
[ ] Network evidence
[ ] Benchmark/load evidence
[ ] Documentation
[ ] Known issues
[ ] Critical Requirements PASS
[ ] Overall Completion >= locked DEMO_SAFE_THRESHOLD
```

The final gate is:

``` text
Overall Completion >= DEMO_SAFE_THRESHOLD
AND
all Demo-Critical Requirements = PASS
```

Before Teacher Assignment:

``` text
DEMO_SAFE_THRESHOLD = NOT YET DEFINED
```

No arbitrary percentage may be inserted.

------------------------------------------------------------------------

# 18. EMERGENCY SCOPE-CUT STRATEGY

If time, infrastructure or technical failure makes 100% completion
impossible:

``` text
1. Protect Critical Requirements
2. Protect Demo-Safe Threshold
3. Complete Core Scope
4. Complete required Network Scope
5. Complete required Testing / Benchmark
6. Cut Optional Scope
7. Document remaining issues
```

The team must explicitly report:

-   Completed;
-   Partially Completed;
-   Not Completed;
-   Known Issues;
-   Risk to Demo;
-   Recommended Next Steps.

Optional features MUST NOT be allowed to weaken Core Scope.

------------------------------------------------------------------------

# 19. PROGRESS & COMPLETION TRACKING

Track at minimum:

``` text
Feature Completion %
Network Completion %
Test Completion %
Overall Completion %
```

Overall completion must use the weighted model defined in
`01_PROJECT_SPEC.md`:

``` text
Overall %
=
Σ(Category Completion × Category Weight)
```

The actual category weights are:

``` text
[TBD — calculate after Teacher Assignment]
```

Do not use raw file count, line count or task count as the final
completion metric.

------------------------------------------------------------------------

# 20. GAME-DEPENDENT PLACEHOLDERS

The following remain unresolved until the Teacher Assignment:

``` text
[GAME-DEPENDENT_GAME_GENRE]
[GAME-DEPENDENT_GAME_RULES]
[GAME-DEPENDENT_PLAYER_COUNT]
[GAME-DEPENDENT_WIN_LOSE_CONDITIONS]
[GAME-DEPENDENT_MECHANICS]
[GAME-DEPENDENT_WORLD_OBJECTS]
[GAME-DEPENDENT_MOVEMENT]
[GAME-DEPENDENT_ABILITIES]
[GAME-DEPENDENT_SCORING]
[GAME-DEPENDENT_ROOM_CONFIGURATION]
[GAME-DEPENDENT_UI]
[GAME-DEPENDENT_SPECTATOR_BEHAVIOR]
[GAME-DEPENDENT_LATE_JOIN]
[GAME-DEPENDENT_COMMAND]
[GAME-DEPENDENT_EVENT]
[GAME-DEPENDENT_STATE]
[GAME-DEPENDENT_CRITICAL_REQUIREMENT]
[GAME-DEPENDENT_DEMO_SCENARIO]
[GAME-DEPENDENT_PERFORMANCE_WORKLOAD]
```

These placeholders MUST be replaced only when justified by the official
assignment and the resulting requirements analysis.

------------------------------------------------------------------------

# 21. SCOPE-CREEP CONTROL

Any proposed new user-facing capability must be classified as:

``` text
CORE
OPTIONAL
GAME-DEPENDENT
OUT OF SCOPE
```

Questions before accepting scope expansion:

1.  Is it required by the Teacher Assignment?
2.  Is it required for Core functionality?
3.  Is it required for network correctness?
4.  Is it required for testing/evidence?
5.  Does it affect Critical Requirements?
6.  Does it affect Demo-Safe status?
7.  What existing work/dependency does it introduce?

If not justified, it should not enter Core Scope.

------------------------------------------------------------------------

# 22. ARCHITECTURE BOUNDARY RULES

Team task allocation MUST respect architecture boundaries.

Allowed dependency examples:

``` text
Client
  → Network Adapter

Gateway
  → Protocol

Protocol
  → Validation

Validation
  → Game Application

Concurrency
  → Game Engine

Game Engine
  → State Store

State Store
  → Sync Engine

Game
  → Persistence Port

Repository
  → Database
```

Forbidden direct dependencies include:

``` text
Game Engine → WebSocket
Game Engine → HTTP
Game Engine → Concrete Database
Sync Engine → Direct gameplay mutation
Client → Authoritative server-state mutation
Room A → Room B state
```

A task assignment must not encourage violating these boundaries.

------------------------------------------------------------------------

# 23. CHANGE / DECISION REQUEST

A Decision Request is required when a change may affect:

-   locked requirements;
-   protocol semantics;
-   shared types;
-   architecture;
-   cross-domain interfaces;
-   game rules;
-   Critical Requirements;
-   testing policy;
-   Demo-Safe status.

Minimum Decision Request fields:

``` text
Decision ID:
Date:
Requester:
Affected Area:
Problem:
Current Contract:
Proposed Change:
Reason:
Affected Components:
Affected Requirements:
Testing Impact:
Performance Impact:
Dependency Impact:
Risk:
Decision:
Approvers:
Documents Updated:
```

Every meaningful accepted change must be reflected in the appropriate
Change Log / Decision Log.

------------------------------------------------------------------------

# 24. TEAM READINESS CHECKLIST

## Governance

-   [ ] Person A/B/C roles confirmed
-   [ ] Primary Owner / Required Reviewer model understood
-   [ ] Shared-contract protection understood
-   [ ] Conflict process understood
-   [ ] AI authority levels understood

## Planning

-   [ ] Work packages assigned
-   [ ] Dependencies understood
-   [ ] Handoff contract understood
-   [ ] Definition of Done understood
-   [ ] Game-dependent boundaries understood

## Engineering

-   [ ] Architecture boundaries understood
-   [ ] Protocol freeze understood
-   [ ] Client/server responsibilities understood
-   [ ] Canonical state ownership understood
-   [ ] Integration checkpoints understood

## Testing

-   [ ] Requirement traceability understood
-   [ ] Protocol test ownership understood
-   [ ] Network degradation scope understood
-   [ ] Concurrency scope understood
-   [ ] Load/benchmark responsibilities understood
-   [ ] Evidence requirements understood

## Delivery

-   [ ] Demo-Safe Gate understood
-   [ ] Emergency scope-cut strategy understood
-   [ ] Handover responsibilities understood

------------------------------------------------------------------------

# 25. FINAL HANDOVER CHECKLIST

Before final submission/demo:

``` text
[ ] Core Scope accepted
[ ] Critical Requirements accepted
[ ] Network Scope accepted
[ ] Protocol implementation accepted
[ ] Unit tests complete
[ ] Integration tests complete
[ ] E2E tests complete
[ ] Concurrency tests complete
[ ] Network degradation tests complete
[ ] Load test complete
[ ] Benchmark complete
[ ] Performance evidence collected
[ ] Requirement traceability complete
[ ] Known Issues documented
[ ] Test Report complete
[ ] README updated
[ ] Demo evidence prepared
[ ] Demo-Safe Gate passed
[ ] Handover complete
```

This checklist does not replace the detailed acceptance criteria in
SRS/Test Plan.

------------------------------------------------------------------------

# 26. FINAL CONSISTENCY AUDIT

Before this document is considered frozen, verify consistency against:

``` text
01_PROJECT_SPEC.md
02_ARCHITECTURE.md
03_NETWORK_SPEC.md
04_TEST_PLAN.md
```

## 26.1 Project Spec Consistency

``` text
[PASS] Core / Optional / Game-Dependent / Out-of-Scope distinction preserved
[PASS] Teacher Assignment remains authoritative for game-specific requirements
[PASS] Critical Requirements are protected
[PASS] Demo-Safe Threshold is not invented before assignment
[PASS] Weighted completion model is preserved
[PASS] Emergency scope-cut strategy is preserved
[PASS] Traceability is preserved
[PASS] Team boundaries match Project Spec
```

## 26.2 Architecture Consistency

``` text
[PASS] Person A = Client / Game
[PASS] Person B = Network / Server
[PASS] Person C = Integration / QA / Performance
[PASS] Shared contracts are protected
[PASS] Architecture changes require decision
[PASS] SRS/Architecture conflict requires STOP + resolution
[PASS] Architecture dependency boundaries are respected
[PASS] Game-dependent architecture remains unresolved where appropriate
```

## 26.3 Network Spec Consistency

``` text
[PASS] Core Protocol remains frozen
[PASS] No game-specific protocol was invented
[PASS] Protocol changes require post-freeze change process
[PASS] Protocol testing requires Client + Server
[PASS] Schema / typed model / serialization consistency is preserved
[PASS] Snapshot / Delta / Event / Resync / Replay / Reconnect responsibilities are preserved
[PASS] Validation and server authority are preserved
[PASS] Network Acceptance requires implementation + tests + recovery + performance evidence + traceability
```

## 26.4 Test Plan Consistency

``` text
[PASS] Requirement → Implementation → Test → Execution → Evidence → Acceptance preserved
[PASS] Unit / Contract / Integration / E2E retained
[PASS] Concurrency retained
[PASS] Network Degradation retained
[PASS] Load / Stress / Benchmark retained
[PASS] Performance evidence retained
[PASS] Critical Requirements prioritized
[PASS] Game-dependent tests remain placeholders
[PASS] Test Plan remains the testing authority
```

------------------------------------------------------------------------

# 27. FINAL STATUS

``` text
TEAM_TASKS_BASELINE = READY
GOVERNANCE = FROZEN
OWNERSHIP_MODEL = FROZEN
HANDOFF_MODEL = FROZEN
GIT_WORKFLOW = FROZEN
AI_AUTHORITY = FROZEN
INTEGRATION_MODEL = FROZEN
DEMO_GATE_MODEL = FROZEN

GAME_SPECIFIC_TASKS = PENDING TEACHER ASSIGNMENT
DEMO_SAFE_THRESHOLD = PENDING TEACHER ASSIGNMENT
CATEGORY_WEIGHTS = PENDING TEACHER ASSIGNMENT

FINAL_CONSISTENCY_AUDIT = PASS
DOCUMENT_STATUS = READY / FROZEN — PRE-ASSIGNMENT BASELINE
```

**Freeze meaning:** the team-task governance baseline is frozen. It does
**not** mean the project itself is complete.

After the Teacher Assignment is received, only justified
game-specific/task-level sections may be expanded. Locked governance
principles MUST NOT be silently overwritten.

------------------------------------------------------------------------

# 28. CHANGE LOG

  ----------------------------------------------------------------------------
  Version           Status            Change            Reason
  ----------------- ----------------- ----------------- ----------------------
  1.0               READY / FROZEN    Initial Team      Derived from
                                      Tasks baseline    `01_PROJECT_SPEC.md` →
                                                        `04_TEST_PLAN.md` and
                                                        approved team
                                                        decisions

  1.1               READY / FROZEN    Teacher           Official assignment
                                      Assignment        integrated for Bài 2
                                      Integration       (OTTv2 9x9 Multiplayer
                                                        with playfull.html, 3
                                                        students mapped)
  ----------------------------------------------------------------------------
