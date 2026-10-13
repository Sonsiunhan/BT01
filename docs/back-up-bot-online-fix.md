# Bot Online emergency candidate — 2026-10-13

Branch: `back-up`, based on `main` at `dbda8a9`. Existing checkout and unfinished changes preserved.

ECC applied: `terminal-ops` for exact repository/runtime evidence; `error-handling` for the infrastructure failure boundary. No application-code agents used.

## Observed failure

The user-supplied Render server's public `/diagnostics/r3/provider` returned HTTP 503, `NOT_PROVEN`, stage `verify-application-consumer`, measured at `2026-10-09T17:26:44.556Z`. This establishes a failed application runtime handoff, not a faulty sample or its exact underlying exception.

The supervisor intentionally omits HOME. The candidate disables Wasmtime's host cache discovery, chooses Winch, and gives cold host compilation a separately bounded 16.5-second watchdog (15 seconds plus the existing 1.5-second margin). The WASI epoch remains 2 seconds and author compute remains 250ms preflight / 500ms turn. Source/hash/ownership/output gates remain active.

With uncached compilation and the previous 3.5-second host watchdog, real tests reproduced four infrastructure failures, including sample preflight and Online commit. After separating the host watchdog, 29/29 focused tests passed, 0 skipped, using pinned Wasmtime 49.0.2 and CPython-WASI 3.14.7 on Windows. Real sample preflight: 9158ms for two sides plus invalid-move check; isolated turn: 3922ms including startup; Online commit case: 2589ms. Raw results: `back-up-runtime-tests.json`.

The test configuration resolves packages from this checkout's source, avoiding accidental reuse of another branch's generated package outputs. An initial run against those unrelated outputs failed and is not accepted evidence.

Two artifact-pin tests, provider-script syntax, server TypeScript typecheck and `git diff --check` passed. Typecheck initially lacked checkout dependencies; it passed after linking the existing local server dependencies without installing or changing packages. Linux reproduction was blocked by the existing WSL mount state. Render runtime success, full build and browser acceptance are NOT RUN. No DB was mutated, no push/deploy performed. The public site's root exception still needs confirmation from a fresh Render consumer run; local success does not certify the deployed host.
