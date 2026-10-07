# R12 — Friends / Invitations evidence

## Scope

R12 owns the Friends page, social cards/actions, incoming/sent/search states, Manual/Bot room invitations, account-only Referee invitations, expiry handling and stale presence disclosure. Guest remains an unauthenticated principal: it can share a room code/link from room entry, while durable Friends/Referee actions remain account-only. No database migration, push, deploy or paid service was used.

## Harness before → after

- The pre-change Friends surface only posted { roomId, targetUserId }; it had no Manual/Bot selector, no role-specific Referee invitation path and no Referee inbox.
- The pre-change presence SSE response hard-coded Access-Control-Allow-Origin: http://localhost:3000, which made configured Render origins stale/incorrect.
- After the change, the focused Friends harness is 5/5 PASS. It covers distinct incoming/sent states, keyboard menu focus/Escape/click-outside, pending one-use player invite, expiry removal, explicit Bot mode selection and account Referee invite acceptance.
- Focused server harness is 23/23 PASS across RoomManager/room route/SocialService/presence tests. It covers Referee target filtering, inviter metadata, expiry/decline, role ACL, player/Guest conflicts, route inbox serialization and Manual/Bot mode mismatch rejection.

## Implementation

- FriendsPageR12.tsx is the canonical page behind FriendsPage.tsx. It shows dominant display names/avatar marks, readable presence, four tabs, accessible more/block menu, small Robot Lab empty-state, and a visible stale-presence banner with a retry action.
- The invite composer has explicit Người chơi / Trọng tài role selection. Player invites choose Chơi trực tiếp / Đấu chương trình; the server pins and verifies the room's authoritative playMode before issuing a one-use invite.
- Referee invites use the existing server-authoritative room role API. GET /rooms/referee/invites exposes only pending invites addressed to the authenticated account; accept/decline remain server ACL operations and accepting navigates to the room.
- Room invite cards identify Manual/Bot mode and expiry. Expired or invalid accepts are removed from the inbox rather than remaining as stale actionable cards.
- Presence SSE now echoes only a configured CORS origin and varies by Origin; no localhost origin is hard-coded. Client presence is advisory and explicitly marked stale without disabling safe social actions.
- RefereeInvite carries inviter display metadata; no private Bot source, memory, log or diagnostic is exposed.

## Automated gates

- Web focused R12: corepack pnpm --filter @ottv2/web exec vitest run src/pages/FriendsPage.test.tsx --reporter=dot — 5/5 PASS.
- Web regression: corepack pnpm --filter @ottv2/web test — 33 files / 106 tests PASS.
- Server focused R12: RoomManager, room route, referee route, SocialService and configured CORS presence route — 23/23 PASS.
- Server regression: corepack pnpm --filter @ottv2/server test — 24 files passed, 1 file skipped, 122 passed, 3 explicitly skipped runtime-env tests.
- Contracts/web/server typechecks — PASS.
- Web lint — PASS (service-worker globals are explicitly scoped).
- Web production build — PASS; existing Zod/Rollup annotation warnings only.
- No Prisma migration or shared/production database mutation was performed.

## Review and boundaries

Static review covered actor permissions, blocked users, Guest/account boundaries, expiry/error copy, keyboard focus restore, stale realtime handling, mobile stacking styles and mode/role semantics. An independent reviewer and physical-device/browser visual matrix were not available in this turn and are NOT RUN; they remain R19/R20 gates. Guest durable-friend persistence is intentionally not introduced. Bot validity, Ready and Referee Start remain authoritative server gates in R4/R7/R8/R10.

Status: DONE for the R12 implementation scope. Safe next Wave: R13 (History / Replay / Audit download).
## R12 test-count addendum

The focused server suite includes the configured CORS presence-route regression and records **23/23 PASS**. The broader web/server regression results and explicit runtime-environment skips remain as listed above.
