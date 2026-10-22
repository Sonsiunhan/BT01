# N02 — Independent requirements review

**Reviewer:** dedicated Codex requirements-review agent (/root/n02_requirements_review)  
**Owner:** Nguyễn Tiến Nam  
**Date:** 22/10/2026  
**Scope:** N02 only — API validate/preview và tính khả thi ban đầu

## Gate result

N02 requirements gate: **PASS**. The reviewer covered **12/12 atomic acceptance criteria (100%)** and found no unresolved P0/P1 requirement gap. This is specification coverage only; it is not implementation, runtime, load, browser or database proof.

The review used ecc:intent-driven-development, docs/team-handoff/module-bot-programming/WORKING-AGREEMENT.md, the N00 revision2 decisions, the N01 implementation/result, F23–F35, BR-11 and T041–T050.

## Atomic checklist

| ID | Requirement | Result |
|---|---|---|
| N02-AC01 | POST validate/preview nhận F23–F35 và gọi engine thật | COVERED |
| N02-AC02 | Typed DTO có draft/config revision và profile context | COVERED |
| N02-AC03 | Validate board/layout/counts/movement/goal/win | COVERED |
| N02-AC04 | Preview dựng immutable RuleState từ N01 RuleProfile | COVERED |
| N02-AC05 | Golden legalMoves cho board chữ nhật, RAY/LEAP, side/type/capture | COVERED |
| N02-AC06 | Lỗi path/code/messageKey cho version/capability/cap | COVERED |
| N02-AC07 | Widget contract có normalized profile, warnings, capabilities và preview result | COVERED |
| N02-AC08 | Auth và tournament scope do server kiểm tra | COVERED |
| N02-AC09 | Stale context, deterministic retry, no reservation/quota side effect | COVERED |
| N02-AC10 | Bounded input và preview board 15×15 có đo riêng; không claim capacity | COVERED |
| N02-AC11 | Legacy không đổi; version/capability ngoài scope báo rõ | COVERED |
| N02-AC12 | Route/unit/golden/error/auth/no-mutation/typecheck evidence | COVERED về yêu cầu; implementation được kiểm sau đó |

## Implementation blockers resolved in plan

- Contract L01 cũ chỉ chứa timing/result policy, nên N02 dùng contract additive TournamentEngineRuleProfileSchema và preview request/response.
- Scope reader đọc Tournament owner, revision và active contract binding; preview không ghi DB.
- Engine có strict preview seam, move list cho cả hai bên và static-goal reachability; không sao chép movement logic trong route.
- CYCLE/SEEDED được parse để trả UNSUPPORTED_CAPABILITY, không diễn giải ngầm trong N02.
