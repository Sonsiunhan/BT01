# V0 harness report

Scope: reference provenance, deterministic capture, route/state inventory and read-only before-layout snapshots. No player code, database mutation, deployment or production call is performed.

## Harness progression

1. Initial run failed closed at the Home route interaction because the selector matched the hidden HTML variants. The harness was corrected to scope all clicks to the visible `Robot Lab` app.
2. The next run failed closed at a board font assertion because the board source declares Be Vietnam Pro and does not declare Space Grotesk. The assertion was made source-aware; this prevents false failures without weakening the required Be Vietnam Pro check.
3. The final run passed: `node scripts/robot-lab-v0-harness.mjs` captured 24 reference entries, 28 application before routes and 18 inventory records.
4. The independent deterministic verifier passed: `node scripts/robot-lab-v0-verify.mjs`.

## Guardrails verified

- Original HTML sources are read-only inputs and SHA-256 pinned.
- Reference contexts deny network; fonts are pinned bytes injected from `fonts/`.
- Application snapshots use local HTTP GET navigation only; no queue, room, upload or database mutation is triggered by the harness.
- Captured role states preserve the approved fixed-side rule: the observer/player reference keeps the Red side at the bottom; referee and spectator controls are not presented as player controls.
- V0 evidence is not a visual-fidelity or functional PASS for V1–V10.
