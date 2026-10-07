# R20 / V10 — Kế hoạch bàn giao chốt nghiệm thu và phát hành

Ngày: 2026-10-06, Asia/Bangkok. Trạng thái tài liệu: kế hoạch thực thi, KHÔNG phải bằng chứng R20/V10 DONE.

## 1. Nhiệm vụ và nguồn quyết định

Mục tiêu là khép bốn đầu việc: backup production có mã kiểm chứng; migration production đúng phạm vi được duyệt; release Render đúng commit và hoạt động; đối chiếu giao diện với Robot Lab đã được người dùng chọn. Giữ hạ tầng Render Free, không thêm dịch vụ trả phí hoặc trial.

Lượt lập tài liệu này chỉ đọc code/evidence và viết file này. Không sửa ứng dụng, migration, tracker; không commit/push/deploy hoặc truy cập dữ liệu production để thay đổi. Agent thực thi bắt đầu khi nhận prompt thực thi tiếp theo.

Chiến lược sử dụng các phát hiện trực tiếp do agent Astra `/root/astra_final_strategy` gửi và kiểm tra source của root. Astra xác minh build/migration và evidence DB/reference; lượt tổng hợp cuối của Astra bị ngắt bởi usage limit. Vì vậy đây không phải artifact độc lập PASS của Astra. Root hoàn thiện bản bàn giao này từ source đã đọc; QA độc lập còn phải nghiệm thu kết quả thực thi.

Đọc trước khi làm:

- `AGENTS.md`.
- `docs/implementation_plan_ott_v0.2_robot_lab.md`, đặc biệt page tasks, runtime gates và R20.
- `docs/implementation_plan_robot_lab_visual_rebuild.md`, đặc biệt VIS-QA-01/02, VIS-FUNC-05 và tiêu chí visual/motion.
- `docs/r20-final-acceptance-evidence.md`, `docs/robot_lab_wave_status.json`, `docs/robot-lab-visual-rebuild-status.json`.
- `docs/robot-lab-visual-reference/v10-independent-review.md`, gồm các continuation; không lấy finding lịch sử làm trạng thái hiện tại nếu đã có bằng chứng sửa.

Quyền đã có trong lịch sử: người dùng yêu cầu push origin/main và deploy; ba migration R4/R9/R13 được chấp thuận có điều kiện sau kiểm tra SQL và backup. Ba migration Guest xuất hiện sau đó cần gói review cụ thể để xác nhận phạm vi nếu chưa tìm thấy phê duyệt đích danh. Không hỏi lại quyền push đã có. Không coi thiếu credential/backup là thiếu quyền coding. Không coi kế hoạch này tự phê duyệt mutation production.

## 2. Kết quả rà source và điều cần đính chính

| Phát hiện | Source/evidence đã đọc | Hệ quả thực thi |
|---|---|---|
| HEAD khi rà là `8c6fed2201295ecb310999691cf2c85cb80ef47a`; nhiều thay đổi chưa commit | Git và các tracker | Đây chưa phải SHA ứng viên phát hành. Phải đóng băng manifest ứng viên mới, không gán evidence cũ cho HEAD này |
| Migration nằm trong Render build, trước server build | `render.yaml` | Push có thể gây DB mutation trước khi server compile/probe xong. Đọc cấu hình Dashboard thật vì người dùng dùng Web Service, không Blueprint |
| Root `pnpm build` hiện không chứa db:deploy; server build là tsc + artifact pin tests + provider probe | root và `apps/server/package.json` | Đính chính nhận định cũ rằng root build mặc định migrate DB. Render build mới là đường có migration; vẫn đọc lại command trước chạy |
| Hai migration index Guest có mỗi file một `CREATE INDEX CONCURRENTLY`, không BEGIN | Hai SQL `20261005000100`, `20261005000200` | Không tự thay bằng index thường vì giả định Prisma luôn bọc transaction. Rehearsal đúng Prisma/PG mới là bằng chứng |
| DB cô lập đã có migration PASS, server160/160 zero skips, Guest browser PASS | `v10-isolated-db.json`, Astra rà timestamp `2026-10-05T12:46:20.991Z` | Có cơ sở khả thi; thiếu binding hash SQL/tool versions và upgrade từ schema cũ có dữ liệu |
| `/health` luôn HTTP200; body có thể degraded | `modules/health/health.route.ts`, `health.service.ts` | HTTP200 không đủ. Health release phải kiểm component và chức năng online thực tế |
| Smoke chỉ kiểm `typeof healthBody.status === 'string'`, route chỉ yêu cầu HTML200 | `scripts/w12-production-smoke.mjs` | Có thể PASS khi degraded hoặc chỉ SPA fallback. Cần assertion semantic và route Bot mới |
| CWV hiện là fixture Guest, CLS bắt đầu sau main/fonts, window250ms; null LCP/INP không fail | `scripts/robot-lab-cwv-gate.mjs` | 102/102 là diagnostic phạm vi hẹp. Không dùng để tuyên bố full-load CWV/INP production đạt |
| V0 verifier kiểm manifest hash và file tồn tại; không tự đọc lại original HTML để hash trong verifier | `scripts/robot-lab-v0-verify.mjs` | Cần kiểm bytes nguồn thực khi chốt reference, không tin metadata một mình |
| Release JS envelope đã tăng240→270KB; initial153.3KB, total257.5KB được báo PASS | `scripts/b14-release-gate.mjs`, final evidence | Reviewer phải xem lý do/route split. Không đổi threshold tiếp để biến FAIL thành PASS |
| Review toàn hệ thống và tracker còn nhiều snapshot lịch sử khác nhau | R20/V10 reports | Cần bảng supersedes theo finding/evidence; giữ lịch sử, không xóa finding để báo sạch |

## 3. Đường đi tổng thể và quyền sở hữu

`F0 đóng băng phạm vi → [F1 DB rehearsal/backup || F2 visual/CWV || F3 release verification] → F4 QA độc lập/ứng viên → F5 migration + push/deploy → F6 xác minh production/đóng hồ sơ`.

Không yêu cầu SHA deploy trước lần push đầu. Hai cổng khác nhau: **READY_FOR_RELEASE** trước phát hành; **DONE** sau kiểm chứng production. Nếu V10 local đủ, ghi LOCAL_ACCEPTED riêng; không dùng trạng thái đó thay R20 DONE.

| Agent | File ownership duy nhất | Không được tự làm |
|---|---|---|
| Integrator | candidate manifest, shared contracts/router/imports nếu cần, tracker cuối, commit/release | Không ghi PASS thay reviewer; không stage `.worktrees`/secret/backup |
| DB | SQL review/runbook, script backup/restore/rehearsal mới nếu cần, DB evidence; migration chỉ sửa khi có lỗi đã tái hiện và integrator giao quyền | Không chạy production trước backup/phê duyệt; không `migrate reset`, `db push`, drop dữ liệu |
| Visual/Performance | visual/CWV harness, ảnh/diff/evidence; page/scoped CSS được giao rõ | Không sửa token/shared board/router đồng thời với worker khác; không đổi reference thành ảnh app để giảm diff |
| Release | health/smoke/build provenance tests và deploy runbook; thay shared contract qua integrator | Không triển khai trong lúc DB/visual còn sửa ứng viên; không nâng gói Render |
| QA độc lập | review artifact read-only đối với code | Không tự sửa rồi tự ký kết quả đó; không thay quyết định thiết kế của người dùng |

Tối đa ba worker cùng integrator. F1/F2/F3 độc lập về file có thể song song. F4/F5/F6 tuần tự. Không cần mở lại mọi Wave R1–R19; chỉ sửa lỗi ảnh hưởng acceptance với regression tương ứng.

## 4. F0 — Đóng băng phạm vi và evidence

1. Đọc Git status/diff/worktrees bằng lệnh read-only. Phân loại modified/untracked: source cần phát hành, evidence, dữ liệu riêng, user work, build output. Không dùng `git add .`.
2. Lập `docs/release/r20-v10/candidate.json` (file agent sẽ tạo): baseSha, source tree/diff digest, Node/pnpm/Prisma/PG versions, SQL SHA256, lockfile SHA256, reference SHA256, browser version, test/evidence paths. Khi có commit ứng viên, thêm candidateSha đầy đủ40 ký tự.
3. Đọc runtime artifacts mới nhất; map IND-01–04 và Guest/Offline continuations vào từng acceptance item. Nếu evidence không cùng code/hashes hoặc chưa được reviewer kiểm, ghi REVIEW_REQUIRED, không tự mở runtime gate.
4. Đọc Render service ID/URL/branch/build/start/healthCheck/auto-deploy và PG major bằng connector/CLI/Dashboard đang được cấp quyền. Không in secret. Không mặc định YAML bằng cấu hình đang chạy.
5. Mỗi worker khai exact ownership và không cập nhật tracker tổng trong khi đang chạy.

DONE F0: có manifest ứng viên, danh sách file phát hành, quyền truy cập còn thiếu cụ thể, ownership không giao nhau.

## 5. F1 — SQL, backup có kiểm chứng và migration rehearsal

### 5.1 Danh sách SQL cần đối chiếu production

| Migration | Thay đổi | Điều kiện kiểm |
|---|---|---|
| `20261003000000_r4_match_lifecycle` | MatchMove/Checkpoint/Event + FK/index | Schema trước/sau, replay/lifecycle; compatibility server cũ |
| `20261004000000_r9_bot_library` | BotLibrary/BotRevision account ownership, private source | Bảo toàn account rows, FK/unique; không lộ source trong evidence |
| `20261004093000_r13_history_replay` | Match.playMode mặc định MANUAL, index, botAdjudication | Dữ liệu lịch sử/backfill default; kiểm thực tế bản cũ có bot match hay không |
| `20261005000000_guest_bot_online` | GuestSession; ownerUserId nullable; ownerGuestId FK; XOR owner CHECK NOT VALID | Account rows còn hợp lệ, đúng một owner, query cũ tương thích, DELETE CASCADE chỉ là semantics cần review |
| `20261005000100_guest_bot_name_index` | UNIQUE CONCURRENTLY ownerGuestId/name | Không duplicate Guest names trong cùng owner; index valid/ready; Prisma engine đúng phiên bản |
| `20261005000200_guest_bot_updated_index` | INDEX CONCURRENTLY ownerGuestId/updatedAt | index valid/ready và đúng columns/order |

Không giả định cả sáu còn pending: query `_prisma_migrations` read-only ở đúng database để lấy tên/checksum/finished_at/rolled_back_at. Phát hiện checksum drift/failed migration thì dừng deployment path, viết recovery cụ thể; không mark applied để che lỗi.

### 5.2 Review trước khi hỏi phần approval còn thiếu

- Ghi SHA256 từng SQL, số rows/table size ước lượng, lock tác động, thời gian từ rehearsal, compatibility và phục hồi.
- Ba migration Guest: đưa đúng tên/hash/thay đổi cho người dùng xác nhận nếu lịch sử chưa có approval cụ thể. Không yêu cầu xác nhận lại ba migration cũ nếu SQL không đổi và điều kiện backup đã đạt.
- Không đưa `VALIDATE CONSTRAINT` vào production âm thầm: NOT VALID là thiết kế hiện tại. Kiểm các row cũ vi phạm bằng SELECT; nếu cần validation riêng, ghi thành thao tác được review/phê duyệt.
- Concurrent index fail có thể để invalid index. Kiểm `pg_index.indisvalid/indisready`; remediation phải được mô tả và duyệt theo target, không retry mù hoặc đổi SQL đã áp dụng.

### 5.3 Backup trên Free, không phụ thuộc paid backup

1. Xác minh target bằng service/database identity và `current_database()`, server version. Kết nối external direct PostgreSQL, tránh pooler cho backup. Credential ở cấu hình local kín hoặc PG service/passfile; không dán URL/password vào chat, CLI log hoặc Git.
2. Chọn thư mục riêng ngoài repo, ACL hạn chế. Dùng pg_dump custom format `-Fc` qua kết nối đã xác minh. PG client phải tương thích server. Sao lưu database ứng dụng, bao gồm `_prisma_migrations`; ghi rõ phạm vi roles/extensions do managed PG không cung cấp superuser đầy đủ.
3. Ghi backup ID duy nhất, UTC timestamp, database identity đã che dữ liệu nhạy cảm, tool versions, bytes, SHA256 của file. SHA256 chứng minh bytes nguyên vẹn, KHÔNG tự chứng minh có thể phục hồi.
4. `pg_restore --list` thành công rồi restore vào cluster localhost mới, tên `ottv2_r20_restore_<timestamp>`, không đụng `ottv2_dev`. Dùng `--no-owner --no-acl --exit-on-error` khi thích hợp với quyền local; lưu rõ những khác biệt ownership/ACL.
5. Kiểm schema, migration ledger, counts/invariants của restored snapshot; nếu muốn so counts với live DB phải dùng snapshot nhất quán hoặc khung không ghi, không so hai thời điểm đang có người chơi rồi kết luận mất dữ liệu.
6. Backup chứa account/private bot source: không chạy ứng dụng test dùng email/webhook production, không upload artifact công khai. Chỉ commit manifest đã redact; dump và dữ liệu restore giữ kín.
7. Nếu rehearsal kéo dài, lấy backup mới ngay trước migration. Backup trước migration không bao phủ dữ liệu ghi sau đó; rollback production không được hứa zero-loss khi chưa có chiến lược xử lý writes.

Ví dụ lệnh cho agent sau khi điền target riêng tư, KHÔNG chạy nguyên mẫu chưa cấu hình:

```powershell
# PG service/passfile được cấu hình ngoài repo; không chứa password trên command line.
pg_dump --dbname="service=ottv2_release_prod" --format=custom --file="$backupPath"
Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
pg_restore --list "$backupPath"
pg_restore --dbname="service=ottv2_release_restore_local" --no-owner --no-acl --exit-on-error "$backupPath"
```

### 5.4 Rehearsal upgrade có dữ liệu

Tái sử dụng cơ chế isolated cluster trong `scripts/robot-lab-v10-isolated-db.mjs`; không lấy default `.env`. Existing script tạo DB rỗng là regression hữu ích, nhưng rehearsal release cần thêm clone schema cũ có dữ liệu từ backup kín hoặc fixture lịch sử đại diện.

- Pin đúng lockfile/Prisma engine của ứng viên và PG major production. Không nâng Prisma trong đợt này.
- Chạy đúng `prisma migrate deploy` trên target rehearsal, không tự thêm transaction wrapper. Ghi logs, SQL hashes, thời gian, exit code.
- Kiểm dữ liệu account/Guest ownership, unique/FK/CHECK, hai index concurrent và `_prisma_migrations` checksums. Chạy lần hai chứng minh no pending/idempotent deployment.
- Test old-server compatibility sau expansion, new-server read/write bằng dữ liệu test có chủ đích. Không giả định rollback về server cũ hỗ trợ Guest rows nullable.

DONE F1: SQL review PASS; backup có hash+restore PASS; rehearsal upgrade PASS; approvals map tên/hash; không có failed migration/index invalid. Evidence: `migration-review.md`, `backup-verification.json`, `migration-rehearsal.json` trong `docs/release/r20-v10/`, chỉ metadata sạch.

## 6. F2 — Approved reference diff và performance đáng tin cậy

### 6.1 Khóa đúng reference đã duyệt

Đọc bytes ba HTML tại `C:/Users/Admin/.codex/visualizations/2026/09/26/01a0dc09-a9e7-7943-a3ec-1b2dcbe866e2/`, đối chiếu manifest và verifier:

- `ott-robotic-directions.html`: chọn Robot Lab, không chọn hướng khác vì carousel state tạm thời.
- `ott-robot-lab-board-v02.html`: chọn Găng trắng; Đấm/Bao/Kéo đúng mẫu cuối người dùng chọn.
- `ott-robot-lab-referee.html`: chuẩn bị phòng, role referee/player, pause và góc nhìn.

Nguồn hash chuẩn nằm trong `scripts/robot-lab-v0-verify.mjs`. Không sửa source HTML để ép khớp app. Nguồn không còn truy cập được thì dùng bản reference có provenance đã lưu, ghi rõ chuỗi hash; không tạo mẫu mới rồi tự gọi approved.

Thiết kế Robot Lab đã được duyệt. QA độc lập được đối chiếu với lựa chọn ấy; không yêu cầu người dùng duyệt lại toàn bộ. Chỉ hỏi khi có delta mới ảnh hưởng thiết kế/chức năng chưa nằm trong quyết định cũ.

### 6.2 Ma trận coverage bắt buộc

| Nhóm | Trạng thái phải có |
|---|---|
| Shell/Home/Online rooms | Dark mặc định mới, Light/System lưu cũ; Guest/account; hai tab direct/Bot và CTA theo tab; rooms empty/data/error |
| Queue/Waiting | searching/cancel/race matched; Ref/Spec bốn tổ hợp; host Ref hai slot trống; invitation/ready/countdown/disconnect |
| Game manual/AI/Offline | A1/I9 có quân; Blue/Red fixed bottom đúng mode; selection/legal/capture; pause/reconnect/result |
| Ref/Spectator | canonical Blue; pause timer/Resume chỉ Ref; no private data; expired/forbidden/full room |
| Bot Workbench | empty/library/revisions/upload invalid/test pass/fail; Guest/account; handoff revision |
| Bot Online/Offline | active/pending/error; paused/restore; missing cache/activation; compatible-memory reset/preserve; quotas/result |
| Friends/Profile/History | loading/empty/error/data, long Vietnamese names; self/public; account/local replay, invitations |
| Settings/Auth/Fallback | appearance/cache/privacy/destructive confirm; login/register/recovery/Guest; 403/404/session expired/outage |

Desktop1440×900 và1366×768, Dark/Light; responsive375×812 và768×1024 emulation cho layout. Android/iOS vật lý WAIVED_BY_USER, không báo PASS. Lấy task IDs từ inventory và hai implementation plan: mọi task có case hoặc lý do N/A được reviewer chấp nhận. Demo ID không được rơi vào404 rồi tính là đã test gameplay.

### 6.3 Cách so hình và chuyển động

1. Pin browser/fonts/DPR/viewport/data/time. Capture reference + ứng viên cùng kích thước. Với trang không có HTML gốc riêng, dùng mapping vào token/component đã duyệt và bố cục mở rộng chức năng từ plan; không đòi một ảnh mẫu không tồn tại.
2. Sinh side-by-side, overlay và diff theo region. Mask chỉ dynamic text/time có danh sách; không mask logo/robot/quân cờ/CTA/HUD/layout. Không dùng tỷ lệ pixel toàn trang để bỏ qua một lỗi quan trọng.
3. Mỗi delta: taskId, reference region/hash, actual image/hash, nguyên nhân, EXPECTED_FUNCTIONAL_DELTA hoặc DEFECT, reviewer và kết luận. Cải biên cần thiết cho Bot/role được phép theo quyết định cũ; phong cách vẫn Robot Lab.
4. Motion dùng trace/video hoặc đo transform/timing: hover nâng, press hạ, entry190ms theo quyết định; idle ổn định; reduced-motion tĩnh. Axe serious/critical=0; keyboard/focus/contrast/failure controls đạt.
5. Sửa DEFECT trong file page/scoped styles được giao; shared token/board do integrator sở hữu. Không xây lại hệ thống hoặc thêm dependency thiết kế không cần thiết.

DONE visual: tất cả task/role/state có mapping; zero P0/P1/P2 design defect mở; QA độc lập ký từng delta quan trọng. `visual-signoff.md` kèm manifest/diff; không gọi ảnh baseline đơn lẻ là approved comparison.

### 6.4 Sửa phương pháp CWV trước kết luận

- Dùng production build preview và dataset/state xác định; đo từ navigation/init script, có cold/warm cache tách biệt. Full-load CLS bao gồm boot/fonts; không loại transition cố ý để làm số đẹp.
- Dùng thuật toán chuẩn `web-vitals` hoặc công cụ tương đương đã kiểm phương pháp; CLS session windows, LCP lifecycle, INP tương tác thật (form/navigation/modal/board). Click góc trống và observer250ms không đủ.
- Metric null/unsupported/no meaningful interaction => NOT_MEASURED, không PASS. Không gắn synthetic INP thành field INP.
- Profile thiết bị/network/CPU, số lần và thống kê được chốt trước đo. Đề xuất5 lượt mỗi critical journey/profile, báo median/p75/max; ngưỡng lab LCP≤2.5s, CLS≤0.1, interaction≤200ms. Ghi sample size nhỏ, không suy rộng thành real-user population.
- So cả Guest/account và populated game/Bot/history; phân biệt test fixture visual với real-service performance trên DB test. Cold-start Render đo riêng, không bỏ kết quả xấu; production warm/cold sampling sau deploy ở F6.
- Không bắt buộc chờ28 ngày CrUX để phát hành sản phẩm mới. Báo release lab evidence đúng phạm vi; field CWV chưa có thì UNAVAILABLE, không giả PASS.
- Review JS budget240→270KB với breakdown route/lazy chunks. Giữ initial170KB envelope hiện có; không tăng tiếp để né regression. Chỉ tối ưu khi có hotspot đo được.

## 7. F3 — Provenance release và health đúng nghĩa

1. Release agent bổ sung provenance tối thiểu: server build SHA và frontend build SHA từ cùng commit. Dùng build-time `RENDER_GIT_COMMIT` khi Render cung cấp; fallback local từ Git cho build local, production thiếu SHA không tự dùng version chung.
2. Chọn endpoint metadata riêng hoặc mở rộng contract health có test; integrator là writer của contracts. Public output chỉ SHA/version/build metadata cần thiết, không env dump, DB URL hoặc private diagnostics. Không ghi commit hash của chính file manifest chứa hash đó vào commit gây vòng lặp.
3. Sửa `w12-production-smoke.mjs`: validate body schema, application/database thực sự đạt; readiness realtime theo dependency dùng thật. `REALTIME_ADAPTER=disabled` phải được audit với SSE/queue/rooms hiện tại. Nếu adapter là legacy không dùng, ghi rõ liveness/readiness/capability distinction và test; không đổi tất cả degraded thành ok để qua gate.
4. Route HTML200 chỉ là reachability. Thêm route Bot và browser assertions đúng page/state; asset404/chunk mismatch/service-worker stale phải fail. Strict identity check server/frontend/Render deploy SHA trùng ứng viên.
5. Build/probe trước migration trong release flow. Vì người dùng dùng Web Service thủ công, actual Dashboard command là nguồn quyết định; thay YAML một mình chưa đủ.
6. Ưu tiên deploy manual có kiểm soát cho candidate: integrator/operator tạm tắt auto-deploy theo quyền release hiện có, ghi cấu hình trước/sau; build xong mới migration. Không cần paid pre-deploy job. Nếu giữ migration trong build, reorder compile/probe trước nó và chỉ bật release sau backup/approval; một migration runner, không chạy song song CLI và auto-build.
7. Cập nhật regression: degraded body phải fail readiness thích hợp, SHA thiếu/sai phải fail, frontend cũ/backend mới phải fail, Render loading HTML không phải health JSON, stale SW không được che bản cũ.

DONE F3: source/test chứng minh provenance và smoke fail đúng trường hợp; runbook phản ánh Dashboard thật; chưa cần có production SHA mới tại bước này.

## 8. F4 — Review độc lập, cleanup và đóng ứng viên

Chạy phù hợp với code thực sự thay đổi; không lặp cả suite vô hạn khi không có thay đổi mới:

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm test:contract
corepack pnpm --filter @ottv2/web test
corepack pnpm --filter @ottv2/web build
corepack pnpm release:gate
corepack pnpm visual:v0:verify
corepack pnpm visual:gestures:test
corepack pnpm visual:gestures:verify
git diff --check
```

Server/integration/E2E: dùng cluster disposable tách biệt và đúng runtime prerequisites; `corepack pnpm visual:v10:database` là harness hiện có nhưng đọc script và env trước chạy. Không dùng default DATABASE_URL. Runtime skips không làm PASS cho acceptance runtime. Browser visual suites V1–V10 tái dùng package scripts; output mới gắn candidate digest. Adversarial đã có bằng chứng thì kiểm binding/consumer và chỉ rerun khi thay đổi ảnh hưởng.

QA độc lập đọc actual code/evidence, ký closure IND-01–04, Guest parity, Offline runtime, visual, performance, migration rehearsal và cleanup. Review tồn tại mà không kiểm code mới không tính là final PASS.

Cleanup lập consumer map cho CSS/assets/imports/routes/offline cache/dynamic URLs. Không xóa `.worktrees`, file người dùng, evidence lịch sử, reference HTML. Chỉ loại file chứng minh obsolete; evidence tạm vẫn cần giữ nếu thuộc audit. Không đưa backup/credentials/private source vào Git. Không đánh đồng số file untracked với rác.

Đóng source candidate commit C sau code/evidence local được review. Dùng stage allowlist và inspect staged diff. Ghi `READY_FOR_RELEASE` trong evidence, chưa đánh R20 DONE. Nếu code thay sau C, tạo C mới và rerun gate bị ảnh hưởng; không dùng evidence C cũ gán cho code mới.

## 9. F5 — Production migration và phát hành (agent thực thi sau)

Precondition: F1/F2/F3/F4 PASS; quyền truy cập sẵn; Guest migration approval theo exact SQL; backup mới đã xác minh và recovery runbook. Không được yêu cầu deploy đã thành công ở precondition này.

1. Đọc lại origin/main; nếu đã tiến khác base, tích hợp bảo toàn changes và rerun affected gates. Không force-push/reset để bỏ thay đổi.
2. Chốt current production deploy ID/SHA cũ, DB ledger cũ, rollback candidate. Kiểm old app có đọc Guest rows nullable an toàn; nếu không, rollback app cũ không phải lựa chọn hợp lệ. Chọn bản tương thích hoặc forward-fix đã kiểm.
3. Backup fresh; chốt khung migration và tránh match/write rủi ro bằng cơ chế bảo trì có sẵn nếu có. Nếu phải tạo cơ chế mới hoặc gián đoạn dịch vụ đáng kể, trình rõ phương án; không tự xóa trận.
4. Chạy chính xác pending approved migrations một lần qua Prisma pinned. Credentials từ môi trường an toàn; verify target ngay trước mutation. Ghi exit code/timestamp/names/checksums; không migrate dev/reset/db push.
5. Query post-state read-only: ledger finished, không failed; constraint/invariants/index valid/ready. `migrate status` đồng bộ; account data nguyên vẹn. Failure => dừng deploy mới, giữ logs và xác định partial state.
6. Push candidate C theo quyền đã được yêu cầu, normal fast-forward. Trigger manual exact commit nếu auto-deploy đang tắt. Nếu actual build tự migrate, no pending phải xác minh; không có runner cạnh tranh.
7. Theo dõi đến terminal deploy state. Không suy thành công từ upload/build hoặc GitHub push. Nếu provider probe/runtime fail, sửa nguyên nhân trong source với test; không bypass fail-closed.

Recovery: app rollback chỉ khi schema-compatible và dữ liệu mới được hỗ trợ; additive schema thường giữ lại. Không drop cột/table Guest hoặc restore dump đè production tự động. Restore vào target riêng/khôi phục production là thao tác có khả năng mất writes sau backup, cần quyết định recovery cụ thể và quyền tương ứng. `prisma migrate resolve` chỉ sau đối chiếu state từng SQL; không là lệnh làm xanh mặc định.

## 10. F6 — Exact SHA, health và đóng R20/V10

Thu bốn chứng cứ độc lập cùng release C:

- Git origin/main tại thời điểm release=C; ghi full SHA, không short hash.
- Render service ID + deploy ID + deployed commit=C + trạng thái live + thời điểm hoàn tất.
- Public server provenance SHA=C, frontend build metadata SHA=C; browser fresh và browser có SW cũ đều vào đúng bundle mới sau luồng update dự kiến.
- `/health` và critical capability smoke đạt policy đã review; real Online queue/room/SSE và runtime provider readiness đúng scope, không chỉ HTTP200.

Polling có deadline/backoff hữu hạn; đo cold-start riêng, phân biệt interstitial với app. Health ổn qua nhiều mẫu, asset route không404, không private diagnostic leakage. Production smoke có write dùng đúng tài khoản/test room chuyên biệt với phạm vi đã ủy quyền; không dùng dữ liệu người chơi hay chạy hostile source trên production. Nếu thiếu quyền tạo test data, làm read-only phần còn lại và báo case cần input cụ thể.

Chụp representative production visual và đo lab warm/cold đối chiếu candidate local; full fixture matrix không chạy phá dữ liệu production. Chỉ rerun toàn matrix nếu build/runtime/rendering khác đáng kể.

QA ký final release report; integrator đồng bộ R20/V10 trackers và report, giữ historical entries có supersededBy. Chỉ lúc mọi gate đạt mới thêm R20 completed và đặt DONE. Android/iOS vẫn WAIVED_BY_USER. Không tái tạo coordinator tự động.

Evidence sau deploy lưu riêng, liên kết release C. Nếu commit evidence-only sau đó là D, ghi C là code release đã kiểm; không tuyên bố D đã deploy nếu chưa xác minh. Nếu D auto-deploy, đối chiếu lại metadata/health D hoặc giữ manual deploy để tránh vòng commit-evidence vô hạn.

## 11. Hợp đồng evidence và điều kiện DONE

Mỗi artifact gồm: gateId, status, recordedAt UTC, candidateSha hoặc sourceDigest trước commit, command/tool versions, environment, actual result, artifact hashes, reviewer, limitations, supersedes. Không dùng timestamp tự đặt để mô tả test chưa chạy.

| Gate | Evidence bắt buộc | Không đủ để PASS |
|---|---|---|
| BACKUP | backupId/SHA256/bytes/target identity + restore PASS + data invariants | File tồn tại hoặc checksum đơn lẻ |
| MIGRATION | exact names/hashes approval + populated rehearsal + production ledger/index verification | SQL có vẻ additive, empty DB test đơn lẻ |
| VISUAL | task/state coverage + approved reference provenance + diff/delta ledger + independent signature | Baseline mới hoặc không overflow |
| PERFORMANCE | full lifecycle method + meaningful interactions + environment/samples + production lab đúng scope | 250ms fixture window, null metric hoặc chưa có CrUX |
| RELEASE | origin commit/Render deploy/server/frontend SHA thống nhất + semantic health/capability | Push/build success, HTTP200 hoặc version0.1 |
| REVIEW/CLEANUP | finding closures, consumer audit, no outstanding blocking defects, consistent trackers | Agent unavailable, self-certified review |

Không coi “4 blocker cũ” là danh sách cố định bất chấp source. Nếu phát hiện security/functionality regression thực tế, tạo issue scoped với failing evidence và sửa trước DONE. Không mở scope nâng cấp sản phẩm mới.

## 12. Prompt giao việc cho agent thực thi

### Agent DB — F1

> Đọc AGENTS.md và docs/r20_v10_final_release_handoff.md. Thực thi F1: sở hữu SQL review/backup-rehearsal scripts và docs/release/r20-v10/{migration-review.md,backup-verification.json,migration-rehearsal.json}. Rà six migrations, kiểm actual pending/checksum, rehearsal đúng engine/PG trên DB cô lập có dữ liệu. Chuẩn bị backup production read-only khi có quyền truy cập, restore vào local private target để kiểm. Không chạy production migration trước đúng backup và phê duyệt scope. Không sửa concurrent index theo giả định. Báo exact gate/evidence/blocker, không đổi tracker tổng.

### Agent Visual/Performance — F2

> Đọc AGENTS.md, hai implementation plan và docs/r20_v10_final_release_handoff.md. Thực thi F2: khóa Robot Lab/găng trắng từ original HTML; lập task/role/state matrix, đối chiếu region cùng viewport, tạo delta ledger và motion evidence. Sửa phương pháp CWV full lifecycle/meaningful interactions; null không PASS. Dùng production build và dataset xác định. Chỉ sửa page/scoped style/harness được giao; shared changes yêu cầu integrator. Không tự đổi reference/threshold để qua gate; không push/deploy.

### Agent Release — F3

> Đọc AGENTS.md và docs/r20_v10_final_release_handoff.md. Thực thi F3: build provenance server/frontend, strict semantic health/smoke với failing-first tests, rà actual Render Web Service build/auto-deploy, runbook compile/probe trước migration. Shared contracts do integrator duyệt/tích hợp. Không chạy production migration/push/deploy trong F3. Ghi test/evidence và prerequisites cho F5/F6.

### Agent QA độc lập — F4/F6

> Đọc AGENTS.md, final handoff và code/evidence actual candidate. Review read-only, map findings IND-01–04 và mọi task V10/R20, reference diff, method CWV, DB rehearsal, privacy và rollback compatibility. Ghi PASS/FAIL/BLOCKED theo evidence, exact SHA/digest. Không tự sửa code hoặc ký PASS nếu evidence thiếu. Sau release đối chiếu exact SHA/health/ledger và ký verdict cuối.

### Integrator — F0/F4/F5/F6

> Thực thi docs/r20_v10_final_release_handoff.md theo thứ tự phụ thuộc. Sở hữu shared files/candidate/status, giữ mọi user changes. Thu artifact của worker, chốt READY_FOR_RELEASE trước phát hành, xử lý approval còn thiếu bằng exact SQL package. Push/deploy theo quyền đã có chỉ khi gates trước phát hành đạt. Chốt DONE sau evidence production cùng SHA và QA độc lập; không tạo automation.

## 13. Khi thiếu truy cập và tài liệu tham chiếu

Nếu credential/Dashboard chưa truy cập được, worker vẫn hoàn thành SQL review, code/harness, local rehearsal, diff package và runbook. Chỉ yêu cầu người dùng thao tác tối thiểu: đăng nhập Render hoặc cấu hình kết nối production ngoài chat/repo; xác nhận đúng migration Guest sau khi đã có gói review. Không yêu cầu người dùng tự viết code hay tự mò backup commands. Hạn mức công cụ là hạn chế thực thi, không phải bằng chứng sản phẩm thất bại hoặc an toàn.

Tham chiếu chính thức phục vụ bước thực thi:

- Render backup Free và export pg_dump: https://render.com/docs/postgresql-backups — Free không có managed logical backup; kế hoạch dùng local pg_dump, không nâng gói.
- Prisma PostgreSQL transaction/concurrent-index discussion: https://github.com/prisma/orm/issues/22922 — có khác biệt single/multiple statements; đây là cảnh báo cần rehearsal phiên bản pinned, không phải thay thế bằng chứng của repo.

Kết quả bàn giao mong muốn: một release được kiểm đúng code, dữ liệu phục hồi được, UI đối chiếu đúng Robot Lab và báo cáo cuối không còn mâu thuẫn. Không có bước nào được thay bằng lời hứa “deploy chắc chắn thành công”.
