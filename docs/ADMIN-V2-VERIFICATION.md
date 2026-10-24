# Admin Operations V2 — bằng chứng kiểm tra 24/10/2026

Branch `nyan/admin-operations-v2`, không merge main. Windows, Node24/npm11, Edge headless, MongoDB8.2. Fixtures có nhãn và chỉ tồn tại trong replica set test riêng trên27021; không đổi service27017 hoặc dữ liệu goease. Không tạo production account/ảnh/địa điểm demo.

## Các kiểm tra đã quan sát

| Kiểm tra                                             | Kết quả / phạm vi                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                       | PASS, không warning ESLint                                                                                                      |
| `npm run typecheck`                                  | PASS client/server/contracts/tools                                                                                              |
| `npm run build`                                      | PASS; Vite cảnh báo main chunk >500kB, chưa tối ưu chia bundle                                                                  |
| `npm test`                                           | 44/44 PASS: contracts, chất lượng, giá, provider failures, planner, budget                                                      |
| `npm run test:integration`                           | 91/91 PASS (67.7s), bao gồm regressions customer/auth/trips                                                                     |
| `npx tsx --test server/test/admin-v2.integration.ts` | 10/10 PASS (5s), gồm restore audit, quyền ảnh, địa chỉ/tọa độ, ignore/revise, approve+publish và drill-down không tính archived |
| `npm run test:catalog-browser`                       | 2/2 PASS sau thay đổi cuối, 35.6s; real session/API/MongoDB, provider fixture                                                   |
| `npm run db:check`                                   | PASS write/read/delete marker của lệnh trong goease_f0_test                                                                     |
| `git diff --check`                                   | PASS                                                                                                                            |

Integration bao gồm guest/customer/admin và thu hồi quyền, invalid input, concurrency/revision/idempotency, transaction rollback khi audit lỗi, public isolation, publish/unpublish qua catalog và giá planner, giữ snapshot chuyến, duplicate matching, source conflict, reject/ignore, approval, restore, settings/region, schedule/restart/fencing/process recovery và429/timeout/backoff. Cấu hình auto-apply chỉ giờ draft được thử, tên thay đổi phải review. Chưa có nguồn API thứ hai để kiểm chứng cross-provider live.

Lần mở rộng test đã phát hiện fixture approval vô tình dùng cùng tọa độ với fixture nhập nguồn; dedupe đã chặn auto-apply đúng thiết kế. Đã bỏ tọa độ không liên quan khỏi fixture approval để hai tình huống độc lập; không nới lỏng kiểm tra trùng hoặc điều kiện auto-apply.

## Nguồn thật

- `npm run geoapify:sample --workspace @goease/server`:50 kết quả, loại5,45 unique; không ghi database. Cả45 chưa xác minh vị trí/giá/ảnh,22 thiếu số nhà và32 thiếu giờ. Sample allowlist trong `.local/geoapify-hoian-sample.json`, không commit dữ liệu/khóa.
- `.local/admin-live-import.mts` gọi HTTP API thật với Geoapify thật và replica set27021 do test sở hữu:30 nhận,29 chuẩn hóa,2 chọn nhập thành draft; replay cùng key không đổi; nhập lại bằng key mới tạo0, nhận diện2 đã có. Cả2 giữ giá null và license ODbL-1.0. Log `.local/admin-live-import.log` chỉ có số liệu. Test database được harness đóng/dọn; không import vào database ứng dụng. Một lượt gọi nguồn30 mục, không thử mọi nhóm/khu vực trên nguồn thật.
- Không thử live Google OAuth, booking/payment, production deployment hoặc Atlas trong task này.

## Ảnh giao diện thực tế

Ảnh chụp từ Playwright, số liệu là fixture test thật trong MongoDB, không phải số production. Màu ivory/deep teal/sage, sidebar/topbar, cards, table và editor dựa ảnh tham chiếu. Bỏ thời tiết/banner và connector không có dữ liệu thật; bố cục co lại ở1366 và zoom125%. Bản đồ OSM đã tải được trong ảnh editor; lúc mạng lỗi có retry, vị trí vẫn giữ.

| Tham chiếu           | Ảnh triển khai                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Tổng quan         | [Dashboard](../test-results/catalog-evidence/00-dashboard-1366.png)                                                                                                                                 |
| 02 Quản lý địa điểm  | [Bảng danh mục](../test-results/catalog-evidence/normal-1440-places.png), [bản đồ](../test-results/catalog-evidence/v2-map.png)                                                                     |
| 03 Chỉnh sửa         | [Editor](../test-results/catalog-evidence/v2-editor.png), [zoom125%](../test-results/catalog-evidence/06-editor-125.png)                                                                            |
| 04 Tự động cập nhật  | [Lịch chạy](../test-results/catalog-evidence/04-schedule-1440.png), [lỗi/thử lại](../test-results/catalog-evidence/05-source-retry.png)                                                             |
| 05 Lịch sử/phê duyệt | [So sánh](../test-results/catalog-evidence/02-compare-1366.png), [nhật ký](../test-results/catalog-evidence/normal-1440-history.png), [queue](../test-results/catalog-evidence/v2-review-queue.png) |
| 06 Nguồn/chất lượng  | [Nguồn](../test-results/catalog-evidence/v2-sources.png)                                                                                                                                            |
| Cài đặt bổ sung      | [Cài đặt](../test-results/catalog-evidence/v2-settings.png)                                                                                                                                         |

Ảnh/log trong ignored test-results/.local, được tạo lại bằng tests; không chứa tài khoản/key thật. Assertions kiểm tra không tràn ngang ở1366/1440 và125% cho danh mục, việc, lịch, lịch sử; editor cũng được kiểm tra. Không phải pixel-perfect screenshot diff với sáu ảnh tham chiếu.

## Chạy lại

```powershell
$env:MONGOD_BINARY='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:integration
$env:E2E_API_PORT='3001'
$env:E2E_WEB_PORT='5181'
npm run test:catalog-browser
```

Chạy integration và browser tuần tự vì cùng harness port27021. Port3001/5181 dùng riêng để tránh dev server đang mở. Khởi chạy ứng dụng thường: `npm run dev`, mở http://localhost:5180/admin và dùng tài khoản có role admin. `GEOAPIFY_API_KEY` chỉ ở server/.env; session/MongoDB/CLIENT_ORIGIN giữ cấu hình hiện có. Không thêm credential mới bắt buộc. Backend phải chạy để lịch thực thi.

## Giới hạn nghiệm thu

Đã có các màn hình và luồng P0/P1 chính; chưa tuyên bố hoàn tất mọi dòng yêu cầu. Chưa hỗ trợ bulk review decisions, polygon địa giới, upload/file import, connector thứ hai, kiểm chứng quyền/URL ảnh tự động, field-level verified attribution, analytics xu hướng. Preview commit tối đa50 còn đồng bộ trong transaction hữu hạn, còn scheduled/manual run chạy nền. Map danh mục chỉ trang hiện tại; dashboard cap5000 record/map500. Lịch sử sự kiện toàn hệ thống, không lọc theo khu vực. Chi tiết và quy trình đầy đủ tại [ADMIN-OPERATIONS-V2.md](ADMIN-OPERATIONS-V2.md).
