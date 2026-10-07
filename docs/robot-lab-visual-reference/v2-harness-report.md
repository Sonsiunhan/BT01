# Robot Lab visual rebuild — V2 evidence

## Scope

V2 owns the Home lobby composition, Online Rooms presentation surface and the
Home Friends preview styling. Existing room/social services and server contracts
remain authoritative; this wave does not change matchmaking, room permissions,
or database state.

## Harness

The initial HomePage harness was intentionally red before implementation:

- `HomePage.test.tsx` expected two accessible Home tabs, a deterministic
  full-body Robot Lab host and no legacy hero orb/tilt surface.
- Baseline failed because the legacy page had no `role="tab"` contract and
  still rendered the old three-region/orb hero.

## Green evidence

- Focused Vitest: `HomePage.test.tsx` + `RoomBrowser.test.tsx` — **4/4 PASS**.
- Full web Vitest: **40 files / 128 tests PASS**.
- Web typecheck: **PASS**.
- Web lint (`--max-warnings 0`): **PASS**.
- Web production build: **PASS** (third-party Zod/Rollup annotation warnings
  only; no project errors).
- Browser gate: `scripts/robot-lab-v2-browser-gate.mjs` — **PASS** for
  1440×900 and 1366×768 Dark/Light, 375×812 overflow smoke, Home direct/Bot
  tab switching and persistence, CTA route, full-body host, no legacy orb or
  pointer-tilt surface, 1.8:1 main/profile composition, and Online Rooms
  3→2 responsive grid contract. The local API returned an empty/error room
  state during capture, so the grid assertion also verifies the rendered CSS
  contract with an offscreen empty-state probe; it does not invent room data.

Artifacts:

- `v2-home-{dark,light}-{1440,1366}-direct.png`
- `v2-home-{dark,light}-{1440,1366}-bot.png`
- `v2-home-{dark,light}-{1440,1366}.png` (persistence reload capture)

## Review and remaining work

Internal review checked tab keyboard semantics, Guest/Ranked gating, no fake
Guest ELO, responsive overflow, reduced motion and preservation of room/social
states. Independent reviewer was not available, therefore independent review
is **NOT_RUN**. V3+ page compositions remain open.
