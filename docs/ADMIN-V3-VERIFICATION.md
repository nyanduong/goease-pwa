# GoEase Admin V3 — bàn giao nghiệm thu

Triển khai24/10/2026, chốt25/10/2026. Windows x64, Node24.15.0, npm11.12.1, MongoDB8.2. Nhánh `nyan/admin-operations-v3`, base `cb31730`. Checkout review: `C:\Users\LENOVO\.codex\worktrees\admin-operations-v3\goease-pwa`. Chưa merge main/deploy. Thay đổi chưa commit của owner ở checkout gốc được giữ riêng.

## Sản phẩm và trạng thái

Admin có sidebar tối/nhận diện GoEase, bảng và bộ lọc gọn, đợt đa điểm đến, kết quả từng task, pause/resume/retry, ngoại lệ theo nguyên nhân, editor với khóa/provenance, so sánh trung tính, preview/lô bền vững, bản đồ tập lọc, quy tắc có phiên bản/mô phỏng và lịch sử/phục hồi. Những số liệu trong ảnh là fixture có nhãn, không phải kết quả thu thập Việt Nam.

Save và chuẩn bị restore tạo đề xuất, giữ public. Publish mới áp dụng. Khám phá được phép thiếu giá; Goe/dự toán giữ gate giá/giờ và snapshot chuyến. Rule ít rủi ro chỉ tạo đề xuất giờ draft; không tự xuất bản dữ liệu thật. Worker MongoDB hiện có được tái sử dụng, không thêm Redis hoặc engine thứ hai.

| Hạng mục                                                             | Trạng thái                  | Bằng chứng                                                                   |
| -------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Scope rõ ràng, admin draft/archive, GET không tạo cấu hình           | Đã triển khai/kiểm thử      | admin-v3.integration, admin-v2.integration; geography browser                |
| Save/restore/public isolation, locks, revision và giá public         | Đã triển khai/kiểm thử      | catalog-publication.integration, catalog.integration; browser policy/restore |
| Migration plan/apply/rerun/rollback giữ ID/source/public hash        | Đã kiểm thử trong DB riêng  | catalog-publication.integration; chưa chạy trên goease                       |
| Campaign snapshot/pause/resume/retry/fence                           | Đã triển khai/kiểm thử      | admin-v3.integration, catalog-operations.integration; Chrome fixture         |
| Policy version/mô phỏng/auto-apply giờ draft                         | Đã triển khai/kiểm thử      | admin-v3.test/integration; browser simulation không mutation                 |
| Frozen bulk, stale preview, quyền, partial/resume, archive phụ thuộc | Đã triển khai/kiểm thử      | admin-v3.integration; browser bulk/khôi phục lô sau reload                   |
| Count/map/queue và preview vượt5000                                  | Đã kiểm thử13200            | Số đo bên dưới, DB loopback riêng                                            |
| UI desktop, zoom200%, narrow320/390                                  | Đã chạy browser và xem ảnh  | catalog-operations.spec, ảnh content/actions; Chrome1440/1366                |
| Thu thập Geoapify thật phiên này                                     | Bị chặn bởi usage preflight | Không xác nhận được quota còn lại/quyền tài khoản;0 lời gọi thật             |
| Toàn bộ E2E khách cũ                                                 | Chưa đạt toàn bộ            | Lỗi câu chữ chi phí/CDN và harness503, chi tiết bên dưới                     |

## Lệnh và kết quả thực tế

Các lệnh chạy tại checkout review, không chạy vào database goease. Integration dùng `MONGOD_BINARY=C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe`.

| Lệnh                                                                                                                                                                         | Kết quả quan sát                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                                                                                                                                                                       | Thành công; đã cập nhật riêng body-parser transitive để xử lý advisory; không audit-fix toàn cây                                                            |
| npm test                                                                                                                                                                     | 58/58 pass ở lượt cuối;0 skipped; log .local/admin-v3-unit-final.log                                                                                        |
| npm run typecheck                                                                                                                                                            | Pass toàn workspaces và TypeScript tools                                                                                                                    |
| npm run lint                                                                                                                                                                 | Pass,0 warnings ở lượt cuối; .local/admin-v3-lint-final.log                                                                                                 |
| npm run build                                                                                                                                                                | Pass server/client; cảnh báo bundle chính khoảng795kB, chưa code-split thêm                                                                                 |
| npm run test:integration                                                                                                                                                     | 111/111 pass,108458ms; không skipped. Log .local/admin-v3-integration-final.log                                                                             |
| npm exec -- tsx --test --test-concurrency=1 server/test/admin-v3.integration.ts server/test/catalog-publication.integration.ts server/test/catalog-operations.integration.ts | 22/22 pass,37600ms, gồm các sửa audit/source/archive cuối; log .local/admin-v3-focused-final.log                                                            |
| E2E_API_PORT=3003 E2E_WEB_PORT=5183 npm run test:catalog-browser                                                                                                             | 4/4 pass,45500ms;3 bài admin và1 phân vùng/customer empty; log .local/admin-v3-browser-complete.log                                                         |
| Cùng config catalog, --grep 'V3 policy simulation'                                                                                                                           | 1/1 pass sau sửa diff phục hồi so với đề xuất đang lưu;11100ms. Public giữ nguyên, khóa giữ nguyên, mô phỏng không mutation, context lô còn đúng sau reload |
| E2E_API_PORT=3004 E2E_WEB_PORT=5184 npm exec -- playwright test tests/auth-avatar.spec.ts tests/place-import.spec.ts --output=test-results/admin-related-e2e                 | 4/4 pass,10000ms; fixture CDN deterministic, source import/error/lost-response/retry/editor theo intent mới                                                 |
| npm audit --omit=dev --json                                                                                                                                                  | 0 vulnerabilities sau cập nhật body-parser; không chứa key/log provider                                                                                     |

Bổ sung sau xem ảnh: bản đồ catalog giữ lỗi tile OpenStreetMap (Leaflet vẫn phát load khi tile lỗi), có trạng thái tải/timeout/retry riêng và giữ marker/count khi mất nền. Test fault-injection bản đồ1/1 pass,13400ms; zoom/DPR assertion1/1 pass,33300ms. Client typecheck/tools TS/build đã chạy lại sau sửa này.

Các kết quả integration/auth/expense/trip/sharing/reschedule/nationwide đã bao gồm kiểm quyền, owner, validation, audit rollback, giá unknown/free, planner đủ/thiếu dữ liệu, quota, snapshots và không hồi sinh dữ liệu đã ẩn. Worker có kiểm hai process, mất lease, crash/restart, source rỗng, timeout/429 fixture; không cố gây429 thật.

Lượt bổ sung `npm exec -- tsx --test server/test/admin-v3.integration.ts`: **8/8 pass**,330086ms, thực thi hoàn tất toàn bộ13200 item bằng transaction theo trang50; log `.local/admin-v3-full-bulk.log`. Timeout riêng900giây dành cho phép đo thực thi thật13200 item, không bỏ/nới assertion dữ liệu.

### E2E khách cũ chưa xanh

Lệnh đầy đủ `npm exec -- playwright test --output=test-results/general-e2e` (ports3004/5184): lượt cuối toàn bộ đã quan sát13 pass,4 fail,10 không chạy tiếp sau lỗi; log `.local/admin-v3-general-e2e-final.log`. Không xóa/skip/nới assertion để đổi kết quả đó.

- Customer trip test chờ câu cũ “4 điểm dừng chưa rõ chi phí”, UI hiện có “4 lượt dừng chưa rõ chi phí”. Budget-screen/customer layout này không đổi trong task. Ba selector ngân sách đã cập nhật đúng nhãn optional; assertion câu chữ phía sau vẫn được giữ để thể hiện lỗi riêng.
- Một lần khởi động lại MongoDB của harness cũ nhận503 ở health/db rồi các bài phụ thuộc không chạy. Chưa chốt nguyên nhân riêng; không báo10 bài đó đã pass. Integration độc lập trên27021 đã kiểm tra các hành vi auth/trip/expense/sharing/reschedule tương ứng.
- MVP preview đòi mọi ảnh CDN tải/giải mã trong5giây, có lần không đạt. Kiểm tra HTTP riêng default avatar trả200/JPEG115046bytes; không coi đó là bằng chứng mọi ảnh trên mọi browser đều tải thành công. Không đổi AccountAvatar hoặc asset production để che lỗi kiểm thử.
- Place-import cũ dùng fixture response thiếu overview/admin scopes và nhãn save cũ. Đã sửa fixture/selector giữ đầy đủ assertion lỗi, retry cùng key và không gửi source từ client; kiểm tra lại riêng4/4 pass như bảng trên. Ba bài avatar cũng pass khi mock CDN đúng phạm vi bài UI-only.

Vì vậy không tuyên bố “toàn bộ mọi gate đã đạt”. Những lỗi khách/harness còn lại cần một lượt bảo trì suite riêng hoặc đối chiếu với các chỉnh sửa account/customer chưa commit ở main trước khi merge.

## Bằng chứng quy mô

Fixture tạo trong replica set test có tên ngẫu nhiên, cổng27021, dbPath riêng `.local/f1b-mongo-*`; không seed13200 vào goease hoặc DB review UI. Số đo là một lượt trên máy local, không phải SLA production.

| Phép đo                                | Quan sát lượt đo gần nhất theo từng suite                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Overview toàn13200                     | 293ms, tổng chính xác13200                                                                                                |
| Map/count/filter13200                  | 70ms;8800 trong viewport,4400 thiếu tọa độ                                                                                |
| Preview freeze tất cả13200 ID/revision | 4436ms,13200 item riêng; response chỉ50                                                                                   |
| Queue sau100 archive                   | 13100 mục; offset6000/6020 trả20 mục khác nhau, không cắt5000                                                             |
| Reconcile ban đầu +2 query queue       | 11446ms; query trang kế3376ms; còn dư địa tối ưu                                                                          |
| Bulk resume                            | Hoàn tất13200/13200,0 blocked/failed, state completed; gọi lại vẫn13200.306462ms để xử lý13100 mục còn lại sau100 mục đầu |

Harness dừng đúng mongod nó tạo và giữ dbPath để kiểm tra. Dọn fixture: xác định đúng dbPath thuộc checkout này từ harness, xác nhận không còn process mongod dùng đường dẫn đó, rồi chỉ xóa thư mục test đó bằng LiteralPath; không wildcard/xóa `.local` toàn bộ, không drop database hoặc dừng service27017. DB review UI có marker riêng; giữ lại để owner nghiệm thu.

## Provider thật tách khỏi fixture

Nguồn dự kiến Geoapify/OSM, một vùng tròn nhỏ có cấu hình, tối đa2 lượt, không vượt50 kết quả/request hiện có và tổng100credits tính cả retry. Đã đọc [Places API](https://apidocs.geoapify.com/docs/places/places/), [pricing](https://www.geoapify.com/pricing-details/) và [terms/attribution](https://www.geoapify.com/terms-and-conditions/). Hai trang có cách diễn đạt tính credits khác nhau; phải dùng bound bảo thủ và quota tài khoản có căn cứ trước gọi.

Có khóa Geoapify trong cấu hình ignored phía server, nhưng chưa có số dư/quota và quyền tài khoản được kiểm chứng. Phiên này **0 lượt thu thập Geoapify thật**. Credits còn lại và số nhận/mới/cập nhật/không đổi từ provider thật: chưa có bằng chứng, không áp số fixture vào đây. Không mua gói/bật thanh toán/lịch/auto-publish thật. UI hiển thị provider credits/balance unknown và tách request ledger nội bộ. Khi có quota/quyền đã kiểm tra, tiếp tục smoke2lượt trong DB development riêng, giữ cap/retry/usage ledger rồi đối soát; không tự mở thêm connector.

## Mở review và đi một vòng

Tại lúc kiểm tra cuối, API review `http://localhost:3002/api/v1/health/db` (kiểm25/10/2026 00:01+07) trả connected và web `http://localhost:5182` trả200. Đây là dữ liệu synthetic trong `goease_admin_v3_review_20261024`, mọi POI/tài khoản có nhãn FIXTURE. Không thay dữ liệu tài khoản hoặc catalog ứng dụng gốc trên5180/3000. Process local tồn tại theo phiên máy, không bảo đảm sau restart.

Từ checkout review:

```powershell
npm ci
npm run build --workspace @goease/media
npm run build --workspace @goease/contracts
npm exec -- tsx tests/admin-v3-review-server.mts
```

Terminal thứ hai:

```powershell
npm run dev --workspace @goease/client -- --config ../tests/admin-v3-review.vite.config.mts
```

Script review không import.env/khóa thật; guard đúng DB/host/port/marker, từ chối dữ liệu không thuộc fixture. Mật khẩu được sinh vào `.local/admin-v3-review-access.json` (ignored), không đưa vào Git/ZIP/tài liệu. Vite review tắt HMR để không reload giữa quyết định; dùng reload thủ công khi cần.

1. Đăng nhập bằng tài khoản trong file access. Tổng quan → chọn Hội An; đổi Hà Nội để xem phạm vi khác. Admin vẫn thấy destination draft/archived.
2. Cài đặt → kiểm tra phân vùng, tâm/bán kính và bật nguồn cho từng destination. Không chọn scope thì chỉ xem, không ngầm lấy Hội An.
3. Nguồn dữ liệu → xem trạng thái và usage; đây là provider fixture. Fixture Hà Nội cố ý trả403 để review lỗi quyền/partial, không phải lỗi tài khoản Geoapify thật.
4. Quy tắc & lịch → tạo phiên bản, chọn scope rồi mô phỏng.0 mục phù hợp là kết quả hợp lệ, không giả có automation. Worker mới áp rule đóng băng của đợt mới.
5. Đợt thu thập → tạo đợt theo scope/source/policy, kiểm tra bước chốt, chạy/pause/resume/retry phần lỗi. Đợt2scope đã có minh họa thành công một phần.
6. Ngoại lệ → mở nguồn thay đổi, so sánh, giữ hoặc chuẩn bị thay đổi. Save đề xuất rồi kiểm tra public vẫn giữ nguyên. Không biến unknown thànhfree.
7. Địa điểm → chọn trang hoặc tất cả khớp filter, preview; nhìn số đủ điều kiện/bị chặn và scope thời điểm chốt. Áp dụng → xem kết quả từng mục; reload vẫn mở đúng lô cũ dù filter hiện tại đã khác.
8. Editor → lịch sử/so sánh phiên bản → chuẩn bị phục hồi. Xem diff so với đề xuất đang lưu, chú ý khóa; publish riêng mới đổi public. Archive destination phải tắt lịch/pause đợt và đi qua kế hoạch con→cha.

## Ảnh ứng dụng thật

JPEG01–08 từ Chrome CUA trên DB review24POI; PNG từ Edge headless trên harness API/Mongo thật với dữ liệu fixture riêng. Zoom200% được mô phỏng bằng CSS viewport chia2 và DPR2 (có assertion), không phải chụp thao tác zoom Chrome thủ công. Không dùng ảnh redesign làm ảnh bằng chứng. Đã trực tiếp xem các ảnh chính, mô phỏng, restore, frozen scope, editor200% và CTA320px.

| Bước                       | Ảnh / ghi chú                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan1440              | [01-overview](../test-results/admin-v3-evidence/01-overview-1440.jpg)                                                                                                                                                                    |
| Catalog1366                | [02-catalog](../test-results/admin-v3-evidence/02-catalog-1366.jpg)                                                                                                                                                                      |
| Campaign chốt phạm vi      | [05-preflight](../test-results/admin-v3-evidence/05-campaign-preflight.jpg)                                                                                                                                                              |
| Chạy một phần              | [04-partial](../test-results/admin-v3-evidence/04-campaign-partial.jpg), ảnh có cuộn/clipping ở rìa; dùng để xem state, không chứng minh responsive                                                                                      |
| Ngoại lệ / nguồn           | [07-queue](../test-results/admin-v3-evidence/07-source-exception-queue.jpg), [02-compare](../test-results/catalog-evidence/02-compare-1366.png)                                                                                          |
| Proposal/public trung tính | [08-diff](../test-results/admin-v3-evidence/08-proposal-neutral-diff.jpg)                                                                                                                                                                |
| Preview / retry            | [03-preview](../test-results/catalog-evidence/03-batch-preview.png), [05-retry](../test-results/catalog-evidence/05-source-retry.png)                                                                                                    |
| Kết quả xuất bản           | [publication-results](../test-results/catalog-evidence/03b-publication-results.png),2 áp dụng/2 bị chặn trong lượt fixture                                                                                                               |
| Cài đặt phạm vi            | [settings](../test-results/catalog-evidence/v3-settings.png)                                                                                                                                                                             |
| Map / rỗng / sources       | [map](../test-results/catalog-evidence/v3-map.png) (cố ý chặn tile, marker/count còn hoạt động và có retry), [empty](../test-results/catalog-evidence/v3-empty-overview.png), [sources](../test-results/catalog-evidence/v3-sources.png) |
| Quy tắc / mô phỏng         | [simulation](../test-results/catalog-evidence/v3-policy-read-only-simulation.png),0 thay đổi phù hợp trong lượt chụp; integration riêng đã test nhánh eligible                                                                           |
| Lịch sử / phục hồi         | [restore](../test-results/catalog-evidence/v3-history-restore-preview.png); browser xác nhận POST thành công và public không đổi                                                                                                         |
| Mở lại lô cũ               | [recovered](../test-results/catalog-evidence/v3-frozen-bulk-recovered.png), filter hiện tại rỗng nhưng lô giữ query/scope cũ                                                                                                             |
| Zoom200%, CTA editor       | [editor-content](../test-results/catalog-evidence/06-editor-200-content.png), [editor-actions](../test-results/catalog-evidence/06-editor-200-actions.png)                                                                               |
| 320px, CTA bulk            | [bulk-content](../test-results/catalog-evidence/bulk-preview-320-content.png), [bulk-actions](../test-results/catalog-evidence/bulk-preview-320-actions.png)                                                                             |
| 390px, editor              | [editor390](../test-results/catalog-evidence/editor-narrow-390-content.png), [actions390](../test-results/catalog-evidence/editor-narrow-390-actions.png)                                                                                |

Chrome CUA đã dừng tại hộp xác nhận restore do công cụ không xác định được URL an toàn; không điều khiển tiếp sau chốt đó. Restore, zoom/narrow và các sửa cuối đã được xác minh bằng gate Playwright local độc lập ở trên; không gán kết quả đó thành thao tác CUA thủ công.

## BR, schema và phần còn lại

Đã đồng bộ BR CAT-17/V3-BR-01…12, contracts catalog/admin-operations/admin-v3, DB-BASELINE, collection-registry, DATA-TRACEABILITY và ARCHITECTURE. Collection mới: catalog_campaigns, catalog_policies, catalog_bulk_jobs, catalog_bulk_items, catalog_source_usage. `places`/catalog_versions giữ publication metadata/đề xuất, destinations có shared write fence, audit thêm action và liên kết revision/run/batch/campaign. Chi tiết migration/rollback và API tại [hướng dẫn V3](ADMIN-OPERATIONS-V3.md).

Giới hạn: chưa live provider smoke; chưa có dữ liệu giá/giờ/quyền ảnh bảo đảm cho toàn Việt Nam; chỉ auto-apply giờ draft; chưa auto-publish, notification trip, connector mới hoặc retention/purge production. Query queue13200 còn vài giây, main JS còn lớn; số đo local không chứng minh tải đồng thời production. Cập nhật25/10/2026: theo yêu cầu mới của owner, các thay đổi account/customer đã được commit883ce38 và tích hợp với Admin V3 trên main; kiểm tra kết hợp ghi tại ADMIN-V3-CHECKPOINT.md. Commit/checkpoint cuối ghi ở ADMIN-V3-CHECKPOINT.md.
