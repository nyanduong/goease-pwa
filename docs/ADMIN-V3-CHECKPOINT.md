# Admin V3 implementation checkpoint

Branch: `nyan/admin-operations-v3`, base `cb31730`. Original main's uncommitted account changes are preserved in its checkout and excluded here.

## Authorized sequence

1. Scope/read-only preflight, coherent Vietnamese admin shell.
2. Public/proposal isolation, capabilities, provenance and manual locks; guarded migration.
3. Frozen campaign/rule snapshots on the existing worker; persistent bounded bulk and server map/aggregates.
4. Integrate audit/API/UI, run regression and isolated scale/behavior tests.
5. Provider smoke only if usage/rights/budget can be established; otherwise record blocker.
6. Actual browser review at requested sizes, fix issues, consolidate handoff and commit verified task changes.

## Current checkpoint — final verification and handoff

- Giai đoạn1: scope/read-only settings và UI nền đã tích hợp; admin quản lý draft/archive độc lập public.
- Giai đoạn2: Geoapify adapter/normalization/replay được kiểm bằng fixture. Live smoke bị chặn vì chưa xác nhận quota tài khoản;0 lời gọi Geoapify thật trong task. Không auto-publish/lịch thật.
- Giai đoạn3: proposals/public/restore, capabilities, shared hours/price gates, field locks/provenance và guarded manifest migration đã kiểm chứng. Không chạy migration trên goease.
- Giai đoạn4: campaign, immutable policies, frozen server-wide bulk, partial/resume, shared archive fence, aggregate/map/queue13200 đã tích hợp. Full integration111/111; latest focused22/22 pass. Lượt bổ sung toàn13200 bulk đã PASS8/8:13200 succeeded/0errors, gọi lại không lặp,330086ms tổng,306462ms phần sau100 mục đầu.
- Giai đoạn5: dry-run không mutation, auto-stage giờ draft có điều kiện, lease/crash/retry/concurrency/role/stale-preview đã qua tests. Independent review đã sửa source-metadata rewind, snapshot versionKey transaction reset, preview scope expansion, archive write-skew/stale-parent recovery và shared scheduling-hour gate.
- Giai đoạn6: cấu hình Bắc→Nam/tám vùng dùng chung cấu trúc. Catalog browser4/4 + related auth/import4/4 pass; targeted restore diff1/1 pass. Đã xem ảnh desktop/200%editor/narrow bulk, source/restore/simulation/frozen context. CUA dừng tại URL guard ở confirm; không resume; các luồng còn lại kiểm bằng Playwright fixture riêng.
- E2E khách cũ chưa xanh toàn bộ: câu chữ chi phí cũ, CDN load assertion và restart harness503;10 bài không chạy sau lỗi. Chi tiết/các lỗi đã sửa riêng tại ADMIN-V3-VERIFICATION.md. Không đổi customer product/ảnh hoặc bỏ assertions để che lỗi.
- Review runtime đã có API3002/Vite5182 (HMR off), owned fixture DB `goease_admin_v3_review_20261024`; file access ignored `.local/admin-v3-review-access.json`. Existing service27017 và database goease/ứng dụng5180 untouched.
- Decisions: active Place public + version proposal, no implicit destination, versioned opt-in low-risk rules, auto-publish disabled, no framework/provider mới. Body-parser transitive advisory fixed; audit0 vulnerabilities.
- Final unit58/58, typecheck/build/lint đều pass; latest browser4/4 và related4/4, targeted restore diff1/1. Format toàn repo đã pass. Zoom/DPR assertion1/1 và map tile-failure1/1 pass; client/tools/build rerun pass. Backend/UI đã commit, bản ghi chụp kết quả xuất bản đã pass1/1. Tài liệu/ảnh bàn giao đã chốt; ZIP mang manifest commit và kiểm tra file tại bước đóng gói. Không merge main/deploy.

## Commit và trạng thái mở review

- Backend/contracts/migration/tests: `6204ca8`.
- UI/workspace/fixture/browser regression: `f786d3b`.
- Bổ sung ảnh kết quả xuất bản: `6db0ed9` (browser1/1 pass,34900ms).
- Tài liệu ở commit HEAD bàn giao; xem git log trên nhánh `nyan/admin-operations-v3`.
- Gói bàn giao: `C:\Users\LENOVO\Downloads\GoEase-Admin-V3-Handoff-2026-10-25.zip`, Markdown + ảnh fixture thật + manifest, không credentials/dump/env.
- Phần chưa chốt được giữ rõ: quota/provider thật và các lỗi E2E khách/harness cũ; không tự merge khi còn các giới hạn này.
- API review được khởi động lại bằng Node hidden với code mới nhất; health/database connected và Vite5182 HTTP200 quan sát25/10/2026 00:01+07. Không bảo đảm process tồn tại sau restart.
- Không merge/push/deploy. Không chạy provider thật hoặc ghi/migrate goease.
