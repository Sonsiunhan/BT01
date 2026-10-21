# N00 — Wireframe và đề xuất Rule/Resolution DTO

21/10/2026, revision1. **DRAFT cho review yêu cầu, chưa là contracts G1 hoặc UI đã build.**

Đọc cùng N00-ACCEPTANCE-BRIEF.md và canonical mục7.3/10/15/16. Quyết định pending được hiển thị là đề xuất, không default đã có hiệu lực. Long là writer contracts/schema/server composition; Sơn là writer router/layout/styles. Đây là yêu cầu export để họ chốt, không trực tiếp ghi các file đó.

Delta human mới4A/nhóm5/6: đọc N00-INCIDENT-EXTENSION-REQUIREMENTS.md. Bổ sung panel incident/extension bên dưới còn pending policy; không coi khung P04/P05/P16 đã bao phủ dashboard vận hành đầy đủ.

**Revision2 sau8nhóm:** [N00-DECISIONS-2026-10-21.md](N00-DECISIONS-2026-10-21.md) lànguồnpolicyưu tiên. Panelcase cần action `Ra quyết định` cho referee assigned (khôngTAapprove), history+`Hủy quyết định/Rollback` choTA. Mỗi action córeason/expectedRevision/idempotency vàcanonicalresultreplay. Window sauFINALIZED vàexact-tieauthority cònpending,không hiện nút giả đãhỗtrợ. Giảiđếnstart_at khôngchờthísinh;refereegatevẫnápdụngnếubật;UIphânbiệt RUNNINGchưađủngườighéptrận vàblockedstartupdotrờiref/config/runtime.

**Delta revision3 đã duyệt:** MANUAL exact-tie giữ TA-only. Referee quyết trực tiếp case được giao; TA `Hủy/Rollback` chỉ trước FINALIZED, có lý do và confirmation nêu tác động kết quả/điểm/Elo; sau FINALIZED read-only và server deny mutation. Disqualification chỉ chặn future admission/eligible ranking, không tự void past matches. History có event gốc + event bù, không xóa dấu vết. Cạnh tranh rollback/decision dùng revision, conflict tải lại authoritative state. UI hiển thị recomputing/projection generation, không fake điểm hoàn tất. Pause cap10phút/lần30phút/trận, hết cap neutral-abort nếu chưa resume, không auto-resume hoặc clear blocker khác. Các nhãn pending tương ứng ở đoạn cũ phía dưới là lịch sử đã được delta này thay thế.

`ReverseRefereeDecisionCommand`: decisionId, expectedDecisionRevision, expectedTournamentRevision, reason, idempotencyKey; server xác minh TA owner, trướcFINALIZED, decision đúng giải/case và trạng thái rollback. Server ghi compensating event và canonical replay atomically hoặc durable recompute job; response phân biệt ACCEPTED_RECOMPUTING/APPLIED/CONFLICT/FINALIZED_LOCKED, giữ source-free audit. Không có lệnh client restore database/board hoặc setScore tùy ý.

Gia hạncap2hđãduyệt, SA phảiduyệttrướcend_at; pendingkhôngđổilịch. Đếnend_atkhôngnewmatch,startedmatchesdrainclockriêng,không15phúthold. Bảngđiểm dùngweightedpreset/Eloinit1000, khôngcompressioneditor;private/unlistedchoenrolled/staff,publiclogged-in. Retention90từFINALIZED/cancel vàaudit365days. Khôngdùng các nhãn pending/candidate cũ phía dưới đểhỏilạipolicyđãchốt.

## P04 — Cấu hình và phát hành luật

```text
← Chi tiết giải       Luật giải        [Phiên bản đang xem ▼]
Quyền / trạng thái / phiên bản hiệu lực / có bản mới chờ duyệt

[Bàn và quân] [Di chuyển] [Ô đích] [Kết quả] [Xem trước]
┌ Cấu hình                         ┬ Preview bàn canonical BLUE dưới ┐
│ Hàng/cột; số R/P/S mỗi bên        │ Chọn ô bằng bàn phím hoặc chuột  │
│ Đặt quân / kiểm số lượng          │ Nhãn tọa độ + quân/goal          │
│ Dùng movement chung hai bên      │ Bảng mô tả tương đương bằng text │
│ Type+side: RAY / LEAP / hợp mẫu   │ Legal moves / lỗi tại field      │
│ Min/max/jump hoặc offset grid    │ Không tự chạy Python             │
└──────────────────────────────────┴──────────────────────────────────┘
[Kiểm tra] [Xem trước]         Lỗi cấu trúc / khả thi / chưa kiểm runtime
[So sánh phiên bản]   Lý do thay đổi   Thời điểm hiệu lực
[Lưu bản nháp] [Phát hành / Yêu cầu duyệt ngoài phạm vi]
```

- Mỗi side/type có profile tường minh; “dùng chung” là tiện ích builder, không thay dữ liệu chuẩn. LEAP không có toggle jump mâu thuẫn. Không nhập JSON/script.
- Layout kiểm overlap/out-of-bounds/counts; bàn chữ nhật và rank10..15 có text/table thay thế. Không thay setup/mode canonical cũ.
- Goal hiển thị riêng BLUE/RED: STATIC/CYCLE/SEEDED; thứ tự cycle và initial index rõ; chỉ hiện khi bật GOAL_REACHED. Interval tính accepted rounds, không theo pause/wall time.
- Result builder hiển thị thứ tự tiêu chí, weights, event policies, draw toggle, actual first/second policy. MANUAL mới hiện timeout/fallback; không có loop MANUAL fallback.
- Preview hiển thị structural validity, initial terminal/legal moves/reachability, normalized profile/version; không gắn nhãn đã cân bằng hoặc runtime READY.
- Publish xác nhận diff, reason, effective_at, tác động old/new matches và Bot receipts; match cũ bất biến, ngoài envelope đi duyệt. Lần đầu không ép reason thay đổi giả.
- Loading dùng aria-busy; empty versions có đường quay lại; forbidden không render editor hoặc dữ liệu riêng. Network/error giữ draft và cho retry. Version conflict hiện bản server và lựa chọn tải lại/đối chiếu, không overwrite tự động. Unsupported pattern báo đúng field.
- Mobile xếp cấu hình rồi preview; tabs/controls dùng keyboard, focus và lỗi có liên kết tới field; light/dark và reduced motion. Preview selection không chỉ dùng màu.
- Async validation/job/result dùng aria-live polite; sau submit lỗi focus tới error summary/field đầu, sau conflict focus tới thông báo có thao tác tải lại. Logout/đổi actor/tournament xóa cache scoped và bỏ mọi response context cũ; không render dữ liệu actor trước trong loading.

### Component export đề xuất cho Sơn

`RuleEditor({ value, onChange, errors, capabilities, readOnly, previewRequest })`

Một `RuleProfileDraft` làm nguồn dữ liệu; component không copy engine, không tự gọi publish, không tự cấp quyền/state. `previewRequest` async trả normalized profile, field errors và preview, response gắn draft revision để bỏ response cũ. Reset form hoặc đổi mode xử lí hidden values bằng canonical normalization, không giữ flag ngầm có hiệu lực.

## P05 — Xem trận và phân xử

```text
← Chi tiết giải         Yêu cầu phân xử [Đang chờ | Đã xử lí]
[Tìm trận] [Lọc]        Danh sách bền vững / phân trang server
Trận | Luật | Hai bên | Kết thúc gameplay | Hạn xử lí | Trạng thái

Chi tiết request: ID / revision / server time / deadline
┌ Bàn đã đóng băng (canonical BLUE dưới) ┬ Chỉ số BLUE / RED ┐
│ Chỉ xem; không quân điều khiển          │ Tiêu chí đều bằng  │
└────────────────────────────────────────┴────────────────────┘
Người đi trước / sau thực tế; fallback và thời hạn
Chọn bên thắng [BLUE ○] [RED ○]     Lý do [................]
[Xác nhận quyết định]               [Quay lại danh sách]
```

- Popup chỉ là thông báo, danh sách không phụ thuộc popup. Bàn/clock/compute bị server khóa trước tạo request; không tạo player slot cho TA.
- Chỉ TA owner giải quyết exact tie. SA/Referee/ngoài scope không có action; server vẫn deny forged request.
- Countdown dùng server time/deadline; refresh không kéo dài. Khi mất mạng: báo chưa xác nhận, khóa submit tới khi re-fetch; không tự tuyên bố thắng.
- Cần winner+lý do, expectedRevision và idempotencyKey. Server now>=deadline dùng fallback; timeout/manual/cancel tranh chấp qua canonical service của Long.
- Conflict/đã settle/hết hạn: tải kết quả thật, hiển thị actor/policy/reason đã lọc; không local success hoặc gửi quyết định mới ngầm.
- CANCEL/ENDED semantics đang pending, phải chốt trước G0. Không finalize/export chính thức khi pending; không trừ điểm vì hạ tầng.

## P16 — Trạng thái sẵn sàng Bot

```text
← Chi tiết giải       Sẵn sàng Bot       Luật hiệu lực: version/hash
[Lọc trạng thái] [Phân trang]       [Kiểm tra lại các Bot được phép]
Bot / Chủ được phép thấy | SECURITY | COMPATIBILITY | Luật/SDK/runtime
Trạng thái: chờ / đang kiểm / đạt / không tương thích / lỗi hạ tầng / stale
Lý do an toàn, thời điểm kiểm, phiên bản    [Kiểm tra lại]
```

- Readiness theo owner/source digest/rules/config/schema/SDK/runtime/policy và provenance; không chỉ hash client. Human-only hiển thị không áp dụng thay vì buộc nộp Bot.
- Busy/unavailable hiện retry và blocker thực; không author fault/loss. Recheck tạo job có dedupe, không spam quota; UI lấy tiến độ server.
- Không tải source, memory, private logs, raw diagnostics/path/env/token. Endpoint này không tự cấp quyền đọc source cho TA/SA/Referee.
- Luật đổi làm receipt cũ stale cho new match; điểm và old match giữ nguyên. Retry/select khác theo quyền, không có checkbox tự đánh PASSED.

Ma trận quyền đề xuất P16 (server cưỡng chế; hành vi mới này còn cần Nam xác nhận cùng gói identity/privacy):

| Actor | List/detail metadata đã lọc | Recheck | Source/private logs |
|---|---|---|---|
| TA owner có grant giải hiệu lực | Bot/enrollment trong giải mình | Có trong giải, qua quota/capacity/provenance server | Không từ trang/endpoint này |
| Bot owner có enrollment hợp lệ | Bot của mình trong scope | Có cho source của mình và luật được phép | Dùng owner-only library riêng, không expose qua readiness |
| SA | Theo policy hệ thống/ACL | Không mặc nhiên có; không thao tác thay TA | Không |
| Referee | Chỉ dữ liệu readiness tối thiểu nếu grant cho phép | Không | Không |
| Observer/thí sinh khác/Guest | Không private readiness detail | Không | Không |

Grant hết hạn/revoke kiểm lại ở list/mutation/job execution; ownership client/payload không cấp quyền. Response không chứa đường tải source dù actor có endpoint library riêng.

## Payload đề xuất để Long duyệt tại G1

Đây là lược đồ ngữ nghĩa, không phải TypeScript đã compile. IDs/revisions lấy từ server; không nhận actor/role/result authority từ client. Tên endpoint dưới đây là proposal, chưa đăng ký.

### RuleProfileDraft / RuleSnapshot

`RuleProfileDraft` cho phép thiếu các trường chưa nhập, dùng riêng cho lưu nháp/editor; không được đưa thẳng vào match/runtime. `ValidatedRuleProfile` chỉ có sau server validation đầy đủ theo giai đoạn. `RuleSnapshot` là validated profile cộng metadata bất biến do server tạo. Không coi DTO nháp là hợp lệ chỉ vì cùng tên field với snapshot.

| Trường | Ngữ nghĩa |
|---|---|
| schemaVersion, engineProfileVersion | Version parser/capability; runtime chỉ nhận version hỗ trợ |
| board.rows, board.cols | Integer5..15, bounds theo contract |
| pieceCounts[side][type], layout[] | R/P/S, BLUE/RED; ID/cell/side/type, unique cells và counts khớp |
| movementProfiles[side][type][] | Discriminated RAY hoặc LEAP, union; hướng absolute/relative còn cần chốt transform |
| RAY | directions[], minDistance, maxDistance hữu hạn, canJump; không ăn quân trung gian |
| LEAP | offsets[] finite/nonzero/unique, intermediate ignored; không canJump toggle |
| winConditions[] | EXTINCTION/GOAL_REACHED, nonempty OR; capture matrix cố định |
| goalProfiles[side] | STATIC{cell}, CYCLE{cells,roundInterval}, SEEDED{candidates,roundInterval,policyVersion} |
| resolution | drawEnabled, eventPolicies, criteriaOrder, materialWeights, finalTiePolicy, manual{timeoutSeconds,fallback} |
| assignment/clock/runtime refs | Tham chiếu versioned profile được duyệt; không tự thay caps từ UI |
| RuleSnapshot metadata | ruleset/config/schema/engine versions, digest, reason/effectiveAt, creator server; immutable |

Coordinate wire format phải chốt tại G1: đề xuất cell `{fileIndex,rankIndex}` zero-based trong payload mới, UI hiển thị A1..O15; adapter giữ string tọa độ old profile. Không tự thay canonical Coordinate type lúc N00; reviewer kiểm rủi ro compatibility.

### Validate / preview / publish

| Payload | Trường bắt buộc và kết quả |
|---|---|
| ValidatePreviewRequest | tournamentId, expectedConfigRevision, draftRevision, profile; server đọc actor/envelope |
| ValidatePreviewResponse | draftRevision, normalizedProfile nếu hợp lệ, errors[{path,code,messageKey}], warnings, capabilitiesVersion; cấu trúc/nonterminal/legal/reachability riêng; runtime NOT_CHECKED không thành PASS |
| PublishRuleRequest | expectedConfigRevision, exact draft/profile ref+digest, reason, effectiveAt, idempotencyKey; server revalidate payload/hash/revision/quyền/envelope và effectiveAt ở transaction publish, không tin preview đã chạy |
| PublishRuleResponse | immutable version + effectiveAt hoặc changeRequest ref, receipt recheck impact; không sửa old snapshots |

Preview board/scoring nhận snapshot cụ thể, trả legal set/goal state/comparator metrics và tiêu chí quyết định; không nhận arbitrary winner hoặc private runtime data. Request/response mang tournamentId, configRevision, draftRevision, profileDigest và capabilitiesVersion; UI chỉ nhận response khớp toàn bộ context đang mở. Mọi board/snapshot ref phải được server kiểm ACL và digest/pinned version, không cho client dùng ID của tenant khác để preview. Lỗi server/network giữ draft và trạng thái chưa kiểm; không biến lần preview trước thành PASSED cho draft mới.

### ResolutionSnapshot / Adjudication

| Payload | Trường |
|---|---|
| ResolutionSnapshot | matchId, tournamentId, snapshotDigest, pinned rule/config versions, gameplayFinishedAt, finishSequence, board snapshot ref có ACL, committedPlies, roundCount, firstMoverSide, assignments, metrics[side], event, comparison, finalTiePolicy |
| AdjudicationRequestView | requestId, tournamentId, matchId, revision, status, serverNow, createdAt, deadlineAt, fallback, frozenSnapshot, permittedActions; filtered actor display |
| DecideAdjudicationCommand | requestId, expectedRevision, winnerSide, reason, idempotencyKey; không actorId/role trong trusted fields |
| DecisionResponse | Discriminated outcome: SETTLED{verdictRef,winnerSide,reason,source:MANUAL/TIMEOUT}; CLOSED_NEUTRAL{cause:CANCELLED/INFRASTRUCTURE,reason,winnerSide:null,verdictRef:null,pointsApplied:false}; PENDING không chứa winner. Score projection có trạng thái pending/settled riêng; nhánh neutral không giả winner hoặc điểm |

Mutation route module Nam gọi transaction service Long; không ghi match/result/score riêng. Không cho sửa frozen board/criteria/deadline từ decision payload.

### Bot readiness

`BotReadinessView`: botId, ownerDisplay theo ACL, immutableSourceRef/digest theo policy, targetRuleVersion, targetConfigVersion, targetEffectiveAt, targetContext(EFFECTIVE/FUTURE/PINNED_MATCH), rule/config/schema/SDK/runtime/policy versions, securityStatus, compatibilityStatus, jobStatus, blockerCode, safeMessage, checkedAt, permittedActions. Trạng thái luôn tương đối với target: không làm receipt old match stale; không chặn luật đang hiệu lực chỉ vì có bản tương lai. FUTURE chỉ hiện nếu có consumer precheck được hỗ trợ, không biến precheck theo lịch nâng cao thành MUST mới.

`RecheckCommand`: botId, expectedRuleVersion, idempotencyKey; server xác minh owner/scope, policy/capacity và phiên bản thực. Không nhận source, receiptStatus hoặc PASSED do client gửi. Queue/infra errors là retryable neutral.

Server tạo `targetContextRef` bất biến gồm tournamentId, config/rules/schema/SDK/runtime/policy versions, sourceRevisionId+digest, ownerId và provenance; job chỉ đọc đúng context này. Client không tự ký receipt/context. Source mới/luật mới/quyền thu hồi giữa enqueue và execute buộc revalidate; completion lưu cho đúng target đã pin, không overwrite receipt của version/source khác. Job cũ có thể giữ record lịch sử theo ACL nhưng không tự nâng READY của target đang hiệu lực.

### Lỗi dùng chung

- UNAUTHENTICATED / FORBIDDEN / NOT_FOUND theo disclosure policy thống nhất với Đức/Long.
- VALIDATION_ERROR với field path/code; UNSUPPORTED_CAPABILITY; OUTSIDE_APPROVED_ENVELOPE.
- VERSION_CONFLICT / ALREADY_SETTLED / DEADLINE_EXPIRED / TOURNAMENT_CANCELLED: re-fetch authoritative snapshot, không retry mutation mù.
- RUNTIME_UNAVAILABLE / QUEUE_BUSY: retry guidance, không source/stack/env và không xử thua.
- API permission luôn do server kiểm; permittedActions chỉ hỗ trợ UI. Cursor/page/limit bounded; timestamps instant có zone hiển thị, deadline server authority.
- Mọi mutation idempotencyKey được scope theo principal+tournament+operation và canonical request digest. Cùng key+cùng payload trả cùng kết quả; cùng key+payload khác trả IDEMPOTENCY_CONFLICT, không thực thi lần hai; concurrent retries qua unique/CAS bền vững. Quyền vẫn recheck khi trả dữ liệu replay.
- G1 phải có capabilities/limits registry versioned cho request bytes/depth/layout cells/goal lists/patterns/offsets/reason lengths/page size/job concurrency/queue length; finite bounds reject trước parse/eval nặng. Không biến các số runtime candidate thành cap đã enforce. G1 thiếu registry thì consumer liên quan BLOCKED; runtime cần thêm RSS/supervisor measurement, không gọi linear memory64MiB là tổng RAM.

## Bằng chứng cần có sau N00

Harness engine golden/canonical regression; contracts boundary; isolated runtime new-rule samples và hard compute; disposable DB concurrency; browser keyboard/theme/mobile/error; full engine accepted moves→exact tie→WAITING→manual/timeout→one result/points once. Hiện tất cả **NOT RUN**; wireframe/DTO draft không thay các proof đó.

## Bổ sung từ human — dashboard sự cố ngay trong quản lí giải

```text
Quản lí giải / Chi tiết giải                  [Yêu cầu gia hạn]
[Tổng quan] [Trận đấu • 3 sự cố] [Luật] [Nhân sự] ...
Trận | Tình trạng | Cảnh báo/đề nghị pause | Ref đang xử lí
... chọn trận ...
┌ Panel chi tiết trận trong trang quản lí giải ───────────────────┐
│ Bàn + timeline đã lọc | Case severity/trạng thái/lý do/evidence │
│ Ref khả dụng: người / grant / online as-of / tải hiện tại      │
│ [Chọn và giao xử lí]  Chờ nhận / đang xử lí / quá hạn          │
│ [Dừng trận] [Tiếp tục] [Ghi kết luận/đề xuất] theo capability   │
└────────────────────────────────────────────────────────────────┘
```

Normal match tự chạy; không dành player slot hoặc yêu cầu1ref/trận. Case có durable queue và badge, không chỉ toast. Không có available ref thì hiển thị chờ+escalation TA, không gán ngẫu nhiên. Assignment scope, heartbeat age và pending accept hiển thị riêng; stale candidate/revoked grant báo conflict, tải lại không mất form lý do. Policy player request có tự dừng và quyền verdict còn chờ Nam chốt; nút chưa có capability không xuất hiện như đã thực thi. Private evidence/source/logs không vào public match/SSE/referee payload.

Correction human mới: player request không tựpause, phảiTA/referee xácnhận. Tại cấu hình giải có `Có trọng tài` và `Số trọng tài ONLINE+READY tối thiểu` doTA đặt khi bật. Panel bắt đầu hiển thị X/N và danh sách trạng thái; server recheck initial start. Sau khi đãRUNNING, X<N chỉhiểnthị cảnh báo staffing/hàngđợi incident, không làm dừng hoặc trì hoãn giải/trận mới. Không dùng availability/tải incident thaychoONLINE/READY hoặc yêu cầu1ref/trận. Xem supplementrevision3 cho AC.

`IncidentView`: incidentId, tournamentId, matchId, revision, kind, origin(PLAYER/TRUSTED_DETECTOR/STAFF), status, priority, createdAt, safeSummary, filteredEvidenceRefs, assignment{refereeId,leaseRevision,status,expiresAt}, permittedActions.

`AvailableRefereeView`: tournamentGrantRef, accepted/status, heartbeatAsOf, availability, activeIncidentLoad, capacityVersion; chỉ gợi ý, không reservation.

`AssignIncidentCommand`: incidentId, expectedIncidentRevision, candidateRefereeId, expectedCapacityRevision, capabilitySet được server allowlist, idempotencyKey. Server revalidate grant/acceptance/capacity/CAS, persist lease và audit; không client tự cấp global role hoặc winner override. Assignment phải có expiry/reassign/restart và thu hồi người cũ.

`IncidentActionCommand`: incidentId, expectedRevision, action, reason, idempotencyKey; server kiểm active assignee+capability. Resume chỉ gỡ blocker của incident đã xử lí, không clear disconnect/infra/referee blockers không liên quan. Exact-tie TA-only vẫn dùng P05 và transaction riêng. Void/disqualify/appeal outcome không lẫn vào endpoint chọn winner; policy mới phải được human chốt.

## Bổ sung từ human — TA xin gia hạn, SA đối chiếu lịch

```text
TA tại Chi tiết giải → [Yêu cầu gia hạn]
Giờ kết thúc hiện tại | Thời lượng xin thêm | Giờ kết thúc đề nghị
Hạn mức cộng dồn còn lại (candidate2giờ) | Lý do
[Gửi yêu cầu] → Chờ duyệt / đã duyệt một phần / từ chối

SA tại hộp duyệt → tab [Gia hạn]
Request + lý do + thời lượng       [Đối chiếu lịch]
Timeline: giải hiện tại → khoảng xin thêm / bảo trì / reservation
Contract end | tổng cap đã dùng | capacity status / data as-of
Thời lượng duyệt | Lý do quyết định     [Duyệt] [Từ chối]
```

Luồng ở trong quản lí giải/hộp duyệt, không gửi sang màn gameplay. Empty/loading/error/retry/permission/version conflict rõ; thiếu dữ liệu lịch/capacity hiện UNKNOWN. Preview không giữ suất; approve revalidate và reserve atomic. Pending không tự sửa end_at. Khung chờ tại end_at/late approve còn pending, không vẽ UI như đã có policy.

`ExtensionRequestView`: requestId, tournamentId, revision, baseScheduleRevision, originalEndAt/currentEndAt, requestedMinutes/requestedEndAt, reason, status, grantedMinutes, cumulativeApprovedMinutes, capRemainingMinutes, decision metadata, permittedActions.

`ScheduleComparison`: requestId+revision, scheduleRevision, proposedInterval, contractBounds, resourceScope, capacity/reservation/blackout rows, status(CLEAR/CONFLICT/UNKNOWN), asOf; CLEAR không thay commit guard.

`DecideExtensionCommand`: requestId, expectedRequestRevision, expectedScheduleRevision, grantedMinutes, reason, idempotencyKey; chỉ SA. Authority service Long kiểm cap/hợp đồng/state/resource reservations/overlap policy và expected revisions, end_at được server tính. Reject/withdraw không mutate thời hạn. Revoke/approve chéo không nhân giờ, client không tự tạo approval flag.
