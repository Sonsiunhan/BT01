# P5 — Simplified Bot Online entry (ECC)

**Status:** `DONE_SCOPED_LOCAL`

## Scope

P5 closes the product-flow mismatch in the default Bot Online entry. The primary journey is now explicit: choose/upload code → run preflight → enable `Tìm trận Online`. The default page no longer promotes a second `Phòng custom` action. Custom rooms remain available through the canonical Room Browser/create-room flow; the existing `?custom=1` route is retained for compatibility with already shared links.

## Harness → Dev → Test

- RED regressions: the default Bot Online page still rendered `Tạo phòng riêng`, and the Homepage Bot card still described the mode as `Đấu bot qua phòng custom`.
- GREEN changes: removed the promoted custom-room link from the default Bot Online header and changed the Homepage card copy to `Tìm đối thủ Bot sau khi kiểm tra code`.
- Existing preflight gate remains authoritative in the UI: `Tìm trận Online` stays disabled until the selected revision returns `PASSED`; failed preflight keeps matchmaking disabled.

## Evidence

- P5 focused regressions (Bot Online, Homepage, Room Browser custom-route discoverability): **3/3 PASS**.
- Related web regression (Bot Online, Homepage, Queue, matchmaking API, Room Browser): **39/39 PASS**.
- Web typecheck: **PASS**.
- Web lint (`--max-warnings 0`): **PASS**.
- Web production build: **PASS**; only existing Zod annotation and chunk-size warnings.
- `git diff --check`: **PASS**; only existing Windows line-ending warnings.

## Review boundary

- Custom-room creation is not deleted; it remains reachable from Room Browser and the compatibility route, while the default Bot Online path has one clear matchmaking CTA.
- Room Browser regression proves a Bot custom-room create action still navigates to `/dau-chuong-trinh/online?room=<roomId>`; the capability remains discoverable without adding a competing CTA to Bot Online.
- Server/runtime authority, source privacy, preflight validation and queue cancellation remain unchanged and are covered by P2–P4 evidence.
- No Python player execution in the application process or unrestricted native subprocess.
- No database mutation, commit, push or deployment was performed.

Independent code review: **PASS scoped-local**. The reviewer confirmed the simplified default journey, preflight gating, custom-room compatibility, privacy/accessibility boundaries and no new security defect. The only requested evidence gap (custom-room discoverability) was closed by the Room Browser regression above.

This is local implementation evidence, not production/release sign-off; Render deployment and commit/push remain outside P5.
