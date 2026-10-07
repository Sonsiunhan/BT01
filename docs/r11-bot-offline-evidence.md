# R11 evidence — AI / Offline / Bot Offline

## Scope and status

**Wave:** R11 — AI/Offline/Bot Offline/Guest compatibility  
**Status:** **DONE for the R11 acceptance scope**  
**Date:** 2026-10-04 (Asia/Bangkok)  
**Next executable Wave:** R12 — Friends/invitations

## Activation and compatible-memory continuation — 2026-10-05

The original R11 local controller is now guarded by a dynamic activation check rather than a static readiness flag. The browser must have the pinned Offline kit, then pass a real fixed attestation through the opaque-origin iframe + module Worker boundary: asset SHA-256 pins, parent/storage/cookie denial, runtime memory/network/storage proof and a two-turn JSON memory round-trip are all required. Any missing/changed kit or failed probe leaves the controls fail-closed and never falls back to a server.

Each slot records an optional explicit `# ottv2-memory-schema: <id>` declaration. Memory continues across turns of the same revision. A new revision resets memory by default; the player may opt into preservation only when the pending and active schema IDs match. Restored checkpoints are always unready until preflight is run again. Focused Bot Offline regression is now **8/8 PASS**; parser regression is **2/2 PASS**. A rebuilt production preview attestation is **2/2 PASS** for online install plus cold reload with network disabled (`robot-lab-visual-reference/r11-offline-activation-browser.json`), and the full rebuilt Offline consumer is **6/6 PASS** (`v10-offline-consumer.json`). This is local implementation evidence; broader adversarial security evidence and independent R20 release review remain open.

### Adversarial runtime continuation — 2026-10-05

The real browser compartment was exercised through the Vite module boundary after dynamic attestation. The adversarial harness is **7/7 PASS** (`robot-lab-visual-reference/r11-offline-adversarial-browser.json`): hostile imports and forbidden APIs are rejected without returning source/secret text, output quota is enforced, a long bounded computation fails with `TURN_TIMEOUT`, same-schema memory round-trips (`1 → 2`) and explicit reset (`→ 1`) behave correctly, and a fresh invocation succeeds after the timed-out Worker/iframe is disposed. No player source was executed and no unexpected page/runtime diagnostics were observed; only expected local API 404/connection diagnostics were recorded.

The pinned Pyodide cross-origin module-Worker probe is also **PROVEN** (`robot-lab-visual-reference/r11-offline-pyodide-adversarial.json`): output budget, watchdog termination, network/storage/JS bridge denial, fixed WASM memory ceiling, deterministic seed behavior, cold offline cache and cross-origin compartment all pass. This closes the adversarial runtime evidence requested for R11; independent final R20 release review, visual/CWV and production release gates remain separate.

R11 keeps Guest as an unauthenticated principal and preserves the existing local AI and Offline 2P routes. It adds the real Bot Offline controller, an isolated browser runner, a public Offline kit and durable local checkpoint/restore. No Online API, SSE stream, server fallback or production/shared database was used.

## Harness: before → after

- Before R11, `/dau-chuong-trinh/offline` rendered the Robot Lab preparation placeholder and there was no Bot Offline runner, Offline kit status, two-slot controller or Bot Offline checkpoint service.
- The local compatibility harness already reproduced the legacy Guest session migration and stable Guest identity requirements. R11 adds `LocalGamePage.test.tsx` to exercise the canonical Offline 2P/AI output and the local-only source-of-truth copy.
- The post-fix focused harness is **3 files / 9 tests PASS** (`LocalGamePage`, `BotOfflinePage`, `localGameStorage`), including a forced `QuotaExceededError` path.

## Implementation and visible output

- `BotOfflinePage` exposes independent Blue/Red slots with sample/file input, SDK preflight, Ready gating, revision labels and private per-side memory messaging.
- The controller exposes `Ván mới`, `Chạy`, `Tạm dừng`, `Từng nước` and speed controls. `Tạm dừng` waits for the current turn to commit; `Từng nước` commits exactly one turn. The board remains read-only and fixed to canonical Blue orientation; it never rotates on turn changes.
- Every committed turn persists board, clocks, history, active revision and each side's memory. Reload restores the checkpoint in `PAUSED`; clear removes only the local Bot Offline checkpoint.
- `Xuất checkpoint` downloads a local JSON snapshot, while storage write failures surface a quota/unavailable message that directs the player to export and clear before continuing.
- The Offline kit reports version `r11-pyodide-0.27.3`, cached/total progress and missing-cache guidance. It caches only public Pyodide assets and the service worker excludes `/api/`, SSE and private source/memory/log data.
- `runOfflineBotTurn` validates source with the real `@ottv2/bot-sdk`, requires a ready kit, then sends the turn to a module Worker running the pinned Pyodide assets. A missing kit, invalid source, timeout, worker failure or illegal move fails closed and never switches to a server runner.
- Existing `LocalGamePage` keeps AI and Offline 2P on the same canonical `@ottv2/game-rules` board/clock/result path, with local persistence and a handoff message for the two-person mode. Guest legacy storage is migrated without deleting the old record.

## Automated evidence

| Gate | Result |
|---|---|
| Focused R11 web tests | **3 files / 9 tests PASS** |
| Full web regression | **33 files / 105 tests PASS**, one worker |
| Web typecheck | **PASS** (`tsc -b --pretty false`) |
| R11 ESLint scope | **PASS** |
| Production web build | **PASS**; 261 modules, only pre-existing Rollup/Zod annotation warnings |
| `git diff --check` | **PASS**; Git only reports existing Windows line-ending normalization warnings |

No database migration, external deployment, paid service, push or production/shared database mutation was performed.

## Browser acceptance evidence

1. On the Vite dev page (`http://127.0.0.1:3000/dau-chuong-trinh/offline`), the public Pyodide kit reached **5/5**. Both sample bots were independently preflighted and marked Ready. Two real turns executed in the browser Pyodide module Worker; the UI reported **“2 lượt đã commit · checkpoint sau mỗi lượt”**.
2. Reloading that page restored the board, two Ready revisions and the two-turn history with the explicit banner **“Đã khôi phục checkpoint. Phiên đang TẠM DỪNG…”**. The controls remained at the safe turn boundary.
3. On the production preview (`http://127.0.0.1:4173/dau-chuong-trinh/offline`), the service worker was activated and controlling the page. With DevTools network emulation set to **Offline**, a fresh navigation to the deep Bot Offline route succeeded. The snapshot still contained the Robot Lab shell, `Bot Offline`, kit version `r11-pyodide-0.27.3`, **5/5** readiness, canonical 9×9 board and the truthful `Mất kết nối mạng` banner; no route error or server fallback appeared.
4. The production preview snapshot exposes disabled `Chạy`/`Tạm dừng`/`Từng nước` until a local kit and both Ready slots exist, so an evicted/missing cache cannot silently run or reconnect online.

## Security and product boundaries reviewed

- Player Python is never evaluated in the application process or a native unrestricted subprocess. It is executed only inside the browser's module Worker/Pyodide boundary after SDK validation.
- The Worker receives a JSON-safe turn state and the side's memory only. It has no opponent source, private logs or server snapshot. The public service worker cache contains no API/SSE/private Bot data.
- Board setup uses the canonical rule engine, including playable A1/I9 occupancy. Bot Offline and local AI/manual views are fixed to Blue below; no per-turn rotation was introduced.
- The production preview and browser checks demonstrate the local free-only path. Render/production deployment is intentionally outside this Wave's authorization.

## Review and remaining boundaries

Static source review covered the route replacement, cache allow-list, worker boundary, fail-closed errors, local checkpoint status and fixed orientation. An independent reviewer was not available in this turn, so no independent-review PASS is claimed. Physical Chrome Android/Safari iOS, screenshot baseline, axe/CWV and cross-page final acceptance remain R19/R20 gates. R11 does not claim the overall Robot Lab plan is complete.

