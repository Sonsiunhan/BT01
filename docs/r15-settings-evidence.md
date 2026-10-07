# R15 — Settings / Diagnostics / Local data evidence

## Status

**DONE for the local R15 implementation scope.** R19/R20 vẫn sở hữu visual QA trên thiết bị thật, screenshot baseline, axe/CWV và independent BA/QA release verdict; các cổng đó không được suy luận từ report này.

## Plan → Harness → Dev → Test → Review → Clean

- **Harness (RED):** trước khi sửa, `SettingsPage.test.tsx` fail 2/2 vì chưa có hai tab/đầu ra R15; `localData.test.ts` fail vì service `localData` chưa tồn tại. Tổng harness ban đầu: 3 test fail.
- **Dev:** thêm `apps/web/src/services/local/localData.ts` với export scope `LOCAL_DEVICE_ONLY`, danh mục dữ liệu chính xác, active-session guard và clear chỉ local; bổ sung các phép xóa Guest/history/import trong `localGameStorage.ts`; thêm Settings tabs `Chẩn đoán`/`Dữ liệu`, trạng thái Offline kit, details kỹ thuật thu gọn, tải/xóa cache và export/clear có xác nhận.
- **Test:** focused R15 `SettingsPage.test.tsx` + `localData.test.ts`: **2 files / 5 tests PASS**. Full web regression: **37 files / 115 tests PASS**. Web typecheck **PASS**, ESLint `--max-warnings 0` **PASS**, production build **PASS** (chỉ còn cảnh báo chú thích Zod/Rollup có sẵn).
- **Review:** kiểm tra tách dữ liệu tài khoản/cloud khỏi export và clear; clear bị chặn khi local state đang `PLAYING`/Bot Offline đang chạy; diagnostics không xuất hiện ở Home và technical details đóng mặc định; copy tiếng Việt, responsive actions, `Button` pending và Reduced Motion/quality copy giữ nguyên. Không thêm API cloud, không migration.
- **Clean:** `git diff --check` không phát hiện whitespace error; không xóa dữ liệu người dùng, worktree hay code ngoài phạm vi.

## Acceptance mapping

- **SET-01 PASS:** Theme/system, quality `auto/high/medium/low`, Reduced Motion, ambient/audio preferences tiếp tục lưu local; Settings hiển thị preview/giải thích ưu tiên Reduced Motion và auto downgrade.
- **SET-02 PASS:** Account/privacy/block tabs giữ account-only; Diagnostics hiển thị Offline kit version/cache/readiness, nút tải/xóa cache và technical details thu gọn. Không đưa API/database/runtime detail vào Home hay public snapshots.
- **SET-03 PASS:** Local export chỉ gồm Guest identity, local saves/history, Bot Offline session và Offline cache status với `scope: LOCAL_DEVICE_ONLY`; clear có xác nhận, không gọi account/cloud API, giữ nguyên theme/audio/quality và từ chối khi có active local session.

## Boundaries

- Physical Android/iOS, screenshot baseline, axe/CWV và independent BA/QA final review: **NOT RUN; R19/R20**.
- Root build/integration database: **NOT RUN** vì workspace không có datasource disposable đã xác nhận; không migration, push, deploy, paid service hoặc shared/production DB mutation.
- Offline kit remains the existing pinned public-cache service (`r11-pyodide-0.27.3`); R15 only exposes its lifecycle/status and never executes Python in the application process/native unrestricted subprocess.

