# D-06.01 – Consolidated Security Matrix

## Risks → Controls → Owners → Tests → Evidence → Verdict

| Risk ID | Description | Control(s) | Owner | Test ID | Evidence | Verdict |
|---|---|---|---|---|---|---|
| R01 | Canary credentials may leak via public envelope | Filter `details` in `publicEnvelope`; audit logs for secret exposure | Long (candidate), Đức (review) | T01 (unit `security-core.unit.test.ts` – D-05.01) | Test passes when `details` omitted; logs show no secret | **BLOCKED** – awaiting Long LD‑06 fix |
| R02 | Unbounded metric label growth | Use route template for metric key; reject 404 paths | Long | T02 (unit `metrics.unit.test.ts`) | No new label created after 100 random 404 requests | **BLOCKED** – awaiting Long fix |
| R03 | Missing CSRF token validation | Enforce CSRF token & `x-ott-request` header in middleware | Đức (implementation) | T03 (integration `csrf.integration.test.ts`) | All negative cases reject with 403 | **PASS** |
| R04 | Improper secret handling in env vars | Secrets only via env, .env ignored by git | Nam | T04 (security‑review checklist) | No hard‑coded secrets, env vars present | **PASS** |
| R05 | Rate limiting absent on heavy endpoints | `express-rate-limit` applied to `/api/search` | Đức | T05 (e2e rate‑limit test) | 429 returned after limit exceeded | **PASS** |
| R06 | Lack of Row‑Level Security in Supabase | Enable RLS policies for `users` table | Long | T06 (integration RLS test) | Users can only access own rows | **BLOCKED** – pending LD‑06 implementation |

**Notes**
- Orphan risks: R02 and R06 have no completed controls/tests yet.
- P0/P1 findings present in R01 and R02 require remediation before D‑06.04.
- Matrix will be frozen once Long delivers LD‑06 (candidate) and all evidence is available.
