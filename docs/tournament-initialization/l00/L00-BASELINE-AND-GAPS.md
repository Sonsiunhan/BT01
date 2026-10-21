# L00 — Baseline và gap register

Ngày 21/10/2026, Asia/Bangkok. Revision 1. **Executed as design handoff; no application or database mutation.**

## Evidence snapshot

| Nguồn | Revision/commit | Kết luận dùng cho L00 |
|---|---|---|
| `AGENTS.md` | checkout policy hiện hành | Server authority, scoped permissions, safe disposable DB, no shared/production mutation. |
| `docs/tournament-initialization/N00-DECISIONS-2026-10-21.md` | revision 2, hash recorded in N00 result | Human policy for referee/TA authority, rollback, extension, start/end, quota, ranking and retention. |
| `docs/tournament-initialization/support/N00-INDEPENDENT-REVIEW-2026-10-21.md` | FINAL, 93/93 | G0 requirements-only PASS; not implementation or runtime proof. |
| `docs/tournament-initialization/s00/*` | S00 commit `e33ba05` on this branch | Shell, route, state and DTO proposal; no app route/API compiled. |
| `prisma/schema.prisma` | baseline on `main` ancestry | User/session/match/Bot persistence exists; foundation tournament entities do not. |
| `apps/server/src/app.ts` | baseline on `main` ancestry | Fastify composition exists; tournament foundation modules are not registered. |
| `apps/web/src/app/routes.ts` | baseline on `main` ancestry | Public/game routes exist; Admin tournament routes are not registered. |
| `packages/contracts/src/{errors,envelope,bounds}.ts` | baseline on `main` ancestry | Existing error, envelope and pagination primitives are reusable; no tournament DTOs yet. |

The working tree at `D:/BT01` contains unrelated user changes. L00 was executed in the isolated worktree `D:/BT01/.worktrees/nam-backup-team`; no dirty files from the primary checkout were copied or reset.

## What exists versus what L00 delivers

| Area | Current source fact | L00 handoff | Gap after L00 |
|---|---|---|---|
| Identity/session | `User`, `Session`, AuthService exist | Use trusted principal port; do not add role claims in UI | D00 must define scoped grants, binding and tenant lookup. |
| Unit | No `Unit` model/module found | Unit relation and method boundary proposed | L01 must choose Prisma schema/migration shape and disposable fixtures. |
| Contract/quota | No tournament contract model/module found | Contract fields, quota semantics and transaction intent proposed | L01 must freeze schema, counters and idempotency storage. |
| Tournament lifecycle | Match/room lifecycle exists; tournament lifecycle absent | Draft/approval/change/extension boundaries proposed | L01 must define canonical lifecycle writer and composition port. |
| Approval | No P08 API found | Initial and change approval workflows specified | L01 must freeze endpoint DTOs and CAS/ledger implementation. |
| Extension | Policy exists in N00 decisions | P08 extension request panel/API semantics included | L01 must bind capacity/lease provider or mark provider unavailable. |
| Audit | Match/audit-related contracts exist in other modules; foundation writer absent | Safe audit event shape and writer ownership proposed | L01 must choose append-only persistence and ACL query. |
| Admin shell | S00 route/state/form proposals committed | P06/P07/P08 screen handoff aligned to S00 primitives | S01/S02 must register route and real loading/error states after G1. |
| Rule/Bot integration | `@ottv2/game-rules` and Bot contracts exist | L00 carries opaque config/rule snapshot references only | Nam/D00 must provide compatible revisions; L00 does not invent signatures. |

## Non-goals preserved

L00 does not create or alter Prisma schema/migrations, TypeScript contracts, Fastify routes, React routes, account roles, seed data, shared/production data, billing, scheduler implementation, result ledger, runtime, browser UI, or deployment. P06/P07/P08 wireframes and proposal contracts are design artifacts; they are not G1 freeze or page DONE evidence.

## Dependency status

| Dependency | Status | Handling |
|---|---|---|
| N00 requirements/G0 | PASS — requirements only | Use final revision/hash; do not treat as runtime proof. |
| S00 console foundation | PASS — design artifact | Consume state/capability/token vocabulary; do not edit S00 files. |
| D00 identity/roster/staff | NOT PRESENT IN THIS HANDOFF | Keep principal/grant/enrollment fields abstract; L01 blocks concrete foreign keys until D00 export. |
| G1 contracts/schema freeze | NOT RUN | L00 emits proposal only; L01 is the single-writer freeze. |
| Disposable DB | NOT RUN | No DB mutation in L00. |
| Independent L00 review | NOT RUN | Internal trace is recorded; separate reviewer must inspect this revision before claiming independent PASS. |

## Open technical questions for L01

These are implementation choices, not new product decisions: (1) exact database provider/transaction API for quota and CAS, (2) trusted principal/grant port signature from D00, (3) whether a capacity provider exists for extension approval, (4) canonical audit event envelope version, and (5) final cursor/limit constants. Until frozen, the proposal uses bounded values and explicit `DEPENDENCY_PENDING` markers rather than silently choosing a provider or schema.
