# V9 — Settings/Auth/Fallback + exact gesture correction

Date: 2026-10-05. Local execution only. No push, deploy, shared DB mutation or player Python execution.

## Plan and reference analysis

The human requires the exact white gloves in `codex-clipboard-40ea7375-a6da-47f5-bc40-d4d18f83973d.png`; the rest of the board is unchanged. The original source is `ott-robot-lab-board-v02.html` in the approved visualization directory, preserved untouched. Inspection found the actual symbols ✊ / ✋ / ✌️, not the substitute vectors that had been shipped. Fist has folded fingers, palm has raised separate fingers and a thumb to the right, peace has two raised fingers. Original white treatment: grayscale + brightness 1.75, blue-gray edge `#566c7e`; board cuff is `#f8fbff`, edge `#637d91`, inset `#d7e3ed`. Legend has no cuff.

The extractor reads only the inspected CSS declarations, rejects executable/external markup, and never executes original HTML scripts. It freezes the original local Windows/Chromium rendering into six transparent 4x-DPI PNGs: three board/cuff variants and three legend variants. `apps/web/src/assets/pieces/provenance.json` pins the reference-source SHA-256, image dimensions and individual image SHA-256 values. These are captured reference artwork, **not newly drawn original SVGs**. Application rendering is now deterministic and has no emoji font or recoloring dependency. Re-extraction needs the original reference and matching local emoji renderer; the portable asset-integrity test does not.

`PieceGlyph` remains the single consumer entry point for GameBoard/manual/AI/Bot/replay and final-position thumbnails. Puck colors, setup, A1/I9, orientation, game rules and server state are untouched. Obsolete replacement paths and dead commented glyph code were removed after consumer inspection. Historical V1/V4/V5 reports remain historical; their vector-art claims are superseded by this correction.

V9 owns VIS-SET-01, VIS-AUTH-01 and VIS-FALL-01: approved Robot Lab forms/panels and their error, permission, pending, responsive and motion states. Services/contracts retain their APIs. The small public service-worker dependency fix below is necessary for the plan's cold-reload acceptance.

## Harness → Dev

- Artwork regression initially failed because the board still used SVG replacements. It now asserts all 18 tokens + 3 legend icons use frozen demo artwork; asset integrity verifies six distinct RGBA PNGs and SHA-256 pins. Re-capture `--check` matches frozen bytes.
- V9 initial focused run had four expected failures: missing shared Auth composition, missing preview/tabpanel, missing deletion confirmation, and hidden Guest errors. Added keyboard roving tabs, preview, explicit local/cache deletion dialogs, local active guard, account retry and Guest storage pending/error/retry states. Visiting Settings no longer overwrites browser theme with server theme.
- Settings cache-deletion regression initially failed; confirmation and active-session check now prevent deletion. Existing `clearLocalData` still enforces its service-level guard.
- Browser axe found insufficient contrast on Light active tabs and Dark danger buttons. Scoped colors were corrected. Visual inspection caught inherited percentage sizing enlarging legend PNGs; restored the 20px legend size.
- Cold-reload harness initially failed: TTF fonts were outside the service-worker public-asset matcher; first-load fonts can also precede control and bypass later fetch through browser font caching. Added TTF/OTF matcher + precache for the nine shipped local fonts. A subsequent cold navigation failed because asynchronous cache writes could outlive the fetch event. Cache writes are now awaited within respondWith; cache failure still does not break an online response. No cache/user data is deleted.

## Acceptance evidence

| Task | Evidence | Scope |
| --- | --- | --- |
| Exact gesture correction | `robot-lab-gesture-assets.test.mjs`, `robot-lab-freeze-gestures.mjs --check`, GameBoard/foundation/thumbnail tests; `gesture-correction-game-dark.png` / `-light.png` | Original artwork loaded for all 18 pieces; no live filters; three distinct silhouettes; canonical invariants retained |
| VIS-SET-01 | Settings unit regressions, `v9-browser-report.json`, `v9-interaction-report.json` | Seven tabs across Guest/account paths; keyboard focus, theme retention, preview, account failure/retry, export boundary, deletion confirmations and active guards, collapsed technical diagnostics |
| VIS-AUTH-01 | Auth + Guest unit tests; browser matrix and recovery interaction | Shared wordmark/robot/form, validation, pending submit, password visibility, recovery acknowledgment, safe return preserved, Guest without login wall; existing history import remains opt-in on History |
| VIS-FALL-01 | AppErrorBoundary/NotFound tests + browser matrix | Branded 404/loading/error panels, safe error code/no private stack, existing retry/lobby behavior, unified modal/toast treatment; recovery toast measured not to cover its CTA |
| Theme/viewport/a11y | `v9-browser-report.json`: eight routes × Dark/Light × 1440×900, 1366×768, 375×812, 768×1024 | No horizontal overflow; zero serious/critical axe violations in changed page regions. Responsive viewport checks are **not physical Android/iOS tests** |
| Motion | `v9-interaction-report.json`, Reduced Motion assertion in browser gate | Idle transform/animation none; 160ms hover to translateY(-4px); Reduced Motion stays static |
| Local offline assets | `v9-offline-assets.json`, production preview at 127.0.0.1:4173 | Six PNGs + nine fonts cached; fresh offline page renders all 18 icons with PNG/font responses served by service worker. Does not prove Python runtime availability |
| Regression | `v9-vitest.json`, web typecheck/lint/build | 40 test files / 136 tests PASS; typecheck/lint/build PASS. Existing Zod annotation warnings and main-chunk ~500KB warning remain release/performance work, not suppressed |

Browser HTTP data is intercepted, explicitly isolated fixtures, not live-account/production acceptance. Local game and service-worker asset caching execute real client code, without running player Python.

## Review → Clean Rubbish Code

Internal source, browser-image, accessibility and interaction review completed. Reviewed private data boundaries, Guest permissions, retry button type, active-session deletion errors, stored theme precedence, focus restoration, Dark/Light, narrow viewports and motion. Independent review is **NOT_RUN**; no separate reviewer pass is claimed.

One shared AuthLayout, AuthBrand and FallbackArt avoid duplicated page art. No new dependency was installed. Root scripts register the reusable harnesses. Removed only obsolete glyph implementation/comment blocks; kept reference HTML, prior evidence, user changes, cache/storage compatibility and `.worktrees/`.

V9 is DONE for its frontend scope. V10 cross-page functional/integration QA and the existing R20 release/independent-review/performance gates remain open. Confirmed Guest Bot/ordinary Guest queue backend gaps in the tracker are **not** fixed by visual V9 work. No automatic next-Wave prompt, push or deployment.
