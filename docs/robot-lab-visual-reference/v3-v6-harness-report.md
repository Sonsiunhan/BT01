# Robot Lab V3 + V6 visual implementation evidence

## Scope

V3 covers Queue, Waiting Room and Create Room presentation. V6 covers Friends, invitations and the account/Guest boundary. Existing server-authoritative queue cancellation, room role gates, invitation expiry and permission checks remain unchanged; this wave owns composition, visual hierarchy, state copy and scoped Robot Lab styling.

## Harness → implementation → verification

- Red harness before implementation: `QueuePage.test.tsx`, `WaitingRoom.test.tsx` and `FriendsPage.test.tsx` each failed its new Robot Lab visual contract assertion (3 expected failures; the existing behavior tests remained green).
- Implemented queue shell with a small deterministic `RobotLabHost`, useful rating/range/elapsed metrics, explicit `Huỷ tìm trận` and `Về sảnh` actions, and styled error/cancelled/found states.
- Implemented Waiting Room two-column layout: player slots on the left; Referee/Spectator role strip, assignment/start gate and actions on the right. Mobile collapses to one column. Create Room fieldsets received the same hierarchy.
- Implemented Friends four-tab shell with identity-first cards, presence/stale disclosure, invitation role/mode/expiry states, keyboard-safe actions and a small Robot Lab empty-state.
- Added scoped styles in `apps/web/src/styles/visual-rebuild/queue.css` and `friends.css`; both are registered from `main.tsx` and include reduced-motion rules.

## Passing evidence

- Focused web tests: 3 files / 21 tests PASS (`QueuePage`, `WaitingRoom`, `FriendsPage`).
- Focused server dependency tests: 5 files / 28 tests PASS (`RoomManager`, room/referee routes and SocialService/social route); no database mutation.
- Full web Vitest regression: 40 files / 128 tests PASS.
- Web lint: PASS, zero warnings.
- Web typecheck: PASS.
- Web production build: PASS, 272 modules. Existing third-party Zod/Rollup annotation warnings only.
- Browser gate: `scripts/robot-lab-v3-v6-browser-gate.mjs` PASS for Dark/Light at 1440×900 and 1366×768, plus 375×812 overflow smoke. It checks queue host/cancel/elapsed, all four Friends tabs, identity rendering and horizontal overflow.
- Browser screenshots: `v3-queue-{dark,light}-{1440,1366}.png` and `v6-friends-{dark,light}-{1440,1366}.png`.

The browser gate intercepts matchmaking/social API responses with explicit visual fixtures so it can verify composition deterministically. It is not a claim that production API/runtime behavior passed; authoritative behavior is covered by the focused component tests and existing R4/R7/R8/R12 evidence. Waiting Room acceptance is exercised by the focused role-gate tests; a direct browser room capture remains a later real-service/integration gate.

## Review and boundaries

Internal review checked Vietnamese copy, dark/light token usage, 190ms interaction motion, reduced motion, keyboard-visible actions, mobile stacking, explicit cancellation and Referee/Spectator role separation. Guest durable social actions remain account-only; Guest room code/link sharing stays at room entry as specified by R12. No database mutation, deployment, push or paid service was used. Independent review was unavailable and remains `NOT_RUN`.

Status: DONE for V3 and V6 visual scope. Next sequential wave: V4.
