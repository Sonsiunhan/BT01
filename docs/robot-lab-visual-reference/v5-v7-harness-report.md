# Robot Lab visual rebuild · V5 + V7 evidence

Date: 2026-10-05

## Scope

V5 now presents the Bot Workbench, Bot Online preparation and Bot Offline observation surfaces with the Robot Lab operational visual language. V7 applies the same composition to History and Replay without changing authority, replay rules or private-data boundaries. The board glyph change is part of the shared V4 board consumer: every R/P/S piece is rendered by the deterministic custom white-glove SVG set (fist / open palm / peace), with no operating-system emoji or recolouring filter.

## Harness → Dev evidence

- Gesture harness red: `GameBoard.test.tsx` failed 1 assertion / 9 passed because the three gestures had no stable identity.
- Gesture harness green: `GameBoard.test.tsx` 10/10; every initial board has exactly six `fist`, six `palm` and six `peace` glyphs, and the vectors carry `data-piece-style="white-glove"`.
- V5/V7 focused green: Workbench, Bot Online, Bot Offline, History and Replay suites plus GameBoard: 20/20 tests passed.
- Full web regression: `docs/robot-lab-visual-reference/v5-v7-vitest.json`, 40 suites / 129 tests passed, 0 failed, 0 skipped.

## Acceptance evidence

- `VIS-LIB-01`: Workbench keeps three stable regions (library/revision, upload/sample/docs, private test/result log), source actions are owner-only and read-only, and the layout collapses at tablet/mobile widths.
- `VIS-BOTON-01` / `VIS-BOTON-02`: preparation steps, preflight status and custom-room options are visible; the page does not invent match state or reveal private source/log data.
- `VIS-BOTOFF-01`: two independent Blue/Red slots, offline-kit progress/error, board, Run/Pause/Step/Speed, checkpoint and restore states are visible; the existing isolated browser runner remains the authority.
- `VIS-HIST-01`: compact filters, source/result/mode cards, final-board thumbnail, read-only canonical-Blue replay, timeline controls and legacy final-only fallback are styled and covered.
- Browser gate: `scripts/robot-lab-v5-v7-browser-gate.mjs` passed Dark/Light at 1440×900 and 1366×768, plus 375×812 overflow smoke for Workbench and History. API responses were intercepted deterministic fixtures; this proves composition/overflow only, not a production service runtime.
- Shared board visual refresh: `scripts/robot-lab-v4-v8-browser-gate.mjs` passed again after the peace-hand vector change; refreshed `v4-game-dark-1440.png` and `v4-game-light-1440.png` show the light-blue/light-red pucks with distinct white-glove fist, palm and peace silhouettes.
- Web lint PASS (`--max-warnings 0`), typecheck PASS, production build PASS. Existing third-party Zod/Rollup annotation warnings are non-blocking and unchanged.

## Review and limits

Internal source, accessibility hooks, theme, motion and reduced-motion review: PASS. Independent reviewer was unavailable, so independent review remains `NOT_RUN`. Android Chrome and iOS Safari are intentionally out of scope per the latest instruction. V9 owns Settings/Auth/Fallback and V10 owns cross-page QA/cleanup; those waves remain open. No push, deploy or database mutation was performed.
