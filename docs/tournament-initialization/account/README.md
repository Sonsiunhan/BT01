# Account Design Foundations (D00)

This directory contains the design artifacts for the **D00 – Account/Roster/Staff/Support/Onboarding** task of the OTTv2 project. It includes wireframes, actor matrix, contract/DTO definitions, synthetic fixture specifications, hand‑off notes for implementation, and a decision log.

The artifacts are organized as follows:
- `wireframes/` – Mermaid flow diagrams for pages P09‑P13, P17‑P18.
- `actor-matrix.md` – Detailed matrix of actors, permissions, and security requirements.
- `contracts/` – TypeScript DTO/interface definitions for onboarding, roster import, staff invitation, and support request.
- `fixtures/` – Synthetic fixture specifications used by downstream tasks (D01‑D10).
- `hand-off-long.md` – Summary of contracts to be implemented by Long.
- `decision-log.md` – Recorded SPEC GAPs and decisions requiring clarification.

All definitions respect the terminology and security rules from the BA+SA specification and avoid any real secrets or PII.
