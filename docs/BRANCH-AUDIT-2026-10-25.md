# Audit hai branch mới nhất — 25/10/2026

Ghi nhận lịch sử tại commit `832d138`. Công việc sửa E2E theo yêu cầu tiếp theo và kết quả đầy đủ xem [E2E-VERIFICATION-2026-10-25](E2E-VERIFICATION-2026-10-25.md).

Theo yêu cầu owner: xác định code mới, audit và merge vào `main` nếu đạt kiểm tra.

## Nền và phạm vi

Đã fetch origin trước audit. `main`/`origin/main` tại `1e88520`, working tree ban đầu sạch. Hai branch remote mới nhất theo thời gian commit:

| Branch                         | Đầu nhánh | Phần mới so với main                                                                                        |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------- |
| `codex/email-registration-otp` | `67be682` | 1 commit; OTP đăng ký tùy chọn, SMTP adapter, contracts, form và kiểm thử                                   |
| `codex/demo-ui-polish`         | `50f009d` | 2 commit (`9922724`, `50f009d`); theme, trang chủ, điều hướng responsive, bước tạo chuyến, fixture UI riêng |

Cả hai đều chứa toàn bộ `1e88520`, không có commit của main bị thiếu. Các nhánh admin V2/V3 local cũ đã nằm trong lịch sử main. Gộp thử hai nhánh không có conflict; không thay stack/dependencies/lockfile.

## Kết quả audit và chỉnh sửa tích hợp

- OTP kiểm tra binding, hạn dùng và số lần thử ở server; SMTP ngoài transaction; consume, account, identity, session và audit cùng transaction. Không thấy đường HTTP bỏ qua OTP khi flag bật. Lỗi SMTP không trả thành công hoặc tạo account. Kiểm tra cạnh tranh, replay và rollback đã chạy với MongoDB test thật.
- `.env.example` của branch bật OTP trong khi SMTP mẫu trống, khiến checkout mới làm theo README không thể đăng ký. Đổi mẫu về `false`, đồng bộ với default parser; hướng dẫn bật `true` sau khi cấu hình SMTP. Không chỉnh `.env` đang sử dụng hoặc tự bật/tắt OTP của owner.
- Test browser cũ còn kỳ vọng tiêu đề Trang chủ và tên menu trước lần sửa UI. Cập nhật kỳ vọng theo giao diện mới, giữ kiểm tra điều hướng, account, avatar và persistence. E2E chung đặt flag OTP `false` tường minh để độc lập với cấu hình SMTP local; OTP có integration và browser tests riêng.
- Các bài E2E ngân sách trên main cũng chưa theo kịp UI hiện hành: tổng nhóm trước đây được kỳ vọng ở ô nay hiển thị mỗi người. Đồng bộ nhãn/nút, kiểm tra cả số tiền mỗi người và tổng nhóm, giữ đối chiếu `budgetSummary` đã lưu; không đổi tính tiền của sản phẩm.
- Header tạo chuyến bị tràn ngang ở 320px: selector cũ cụ thể hơn theme khiến nhãn “Cùng Goe” vẫn dùng chữ 18px/nowrap trong cột 55px. Tăng độ cụ thể đúng phần tử, giữ chữ 12px và cho xuống dòng. Test responsive chờ thao tác căn Goe sau resize trước khi đo.
- Kiểm tra giảm chuyển động của Goe và chỉ báo điều hướng: CSS chung dùng thời lượng tối đa `0.01ms` khi người dùng bật reduced motion. Giữ CSS hiện có và thêm assertion theo ngưỡng này.
- Đặt AUTH-10 đúng phần xác thực trong BR; sửa tài liệu OTP để dùng hướng dẫn MongoDB `localhost:27017`/`rs0` và binary 8.2 của repository. DB baseline và registry giữ mô tả runtime OTP/hash/index phù hợp.

## Kiểm tra đã quan sát

Node 24.15.0, npm 11.12.1, MongoDB binary 8.2, Edge headless trên Windows.

| Kiểm tra                                          | Kết quả                                           |
| ------------------------------------------------- | ------------------------------------------------- |
| `npm test`                                        | PASS, 64 tests                                    |
| `npm run lint`                                    | PASS                                              |
| `npm run format:check`                            | PASS                                              |
| `npm run typecheck`                               | PASS                                              |
| `npx tsc -p client/qa/tsconfig.json`              | PASS                                              |
| `npm run build`                                   | PASS; còn cảnh báo bundle chính lớn hơn 500 kB    |
| OTP/account/password recovery/product integration | PASS, 33 tests; HTTP và MongoDB thật, SMTP inject |
| Catalog/geography browser                         | PASS, 4 tests; API/MongoDB thật, provider fixture |
| Browser regression liên quan hai nhánh            | PASS, 23 tests; phạm vi/lệnh lọc bên dưới         |

Đã quan sát CI thành công của cả [branch OTP](https://github.com/nyanduong/goease-pwa/actions/runs/40122523709) và [branch UI](https://github.com/nyanduong/goease-pwa/actions/runs/40119722219) tại đúng đầu nhánh nêu trên. Đây là CI trước merge.

Lệnh integration đã chạy:

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
node --import tsx --test --test-concurrency=1 server/test/email-registration.integration.ts server/test/password-recovery.integration.ts server/test/account.integration.ts server/test/product.integration.ts
```

Kiểm tra fixture tạo chuyến tại 320/390/768px sau chỉnh CSS: chiều rộng document bằng viewport; đã mở ảnh 320px để xem bố cục.

## Giới hạn của bộ E2E tổng tại commit 832d138

Đã chạy bộ mặc định và thấy các assertion giao diện/ngân sách cũ nêu trên; sau đồng bộ, bài hành trình thủ công đã chạy qua. Bài `Hoi An catalog journey and server budget stay connected across save and reload` vẫn không qua bước lưu: API trả `DATE_SCHEDULE_UNAVAILABLE` vì fixture catalog thiếu giá/giờ theo gate `eligibleForPlanner` khi xác nhận ngày. Không báo bộ E2E tổng PASS.

Đã đối chiếu `server/src/features/ai/reschedule.ts`, `itinerary-policy.ts`, `planner.ts` và `client/src/components/budget-screen.tsx` với `main@1e88520`: không có thay đổi. Luồng `changeDates`/xác nhận lưu trong TripWorkspace cũng giữ nguyên, nhánh UI chỉ thêm danh sách bước. Không nới gate nghiệp vụ hoặc thêm mock thành công để che lỗi này. Vướng mắc fixture/luồng lưu catalog cần xử lý riêng; các bài sau lỗi trong cùng worker không được coi là đã kiểm chứng.

Bộ hồi quy liên quan hai nhánh được chạy riêng bằng `--grep-invert` bên dưới; không sửa cấu hình để skip test trong repository:

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:E2E_API_PORT = '3001'
$env:E2E_WEB_PORT = '5181'
npx playwright test --grep-invert 'Hoi An catalog journey|real expenses|trip management reschedules|customer profile and password|live Gemini proposal|share link creation|password recovery UI|offline itinerary survives|mobile newcomer|quick mobile plan|admin publishes' --reporter=line
```

Các bài quản trị/phân vùng chạy riêng qua `tests/catalog.playwright.config.ts`, dùng cổng API/web 3002/5182 và MongoDB test 27021.

## Giới hạn

Không gửi SMTP thật, gọi live Google/Gemini/Geoapify hoặc thử upload Cloudinary trong lần audit này; trình duyệt có tải ảnh CDN công khai. Browser OTP dùng API mock; integration OTP dùng adapter SMTP inject, không chứng minh email vào inbox. Chưa thử trên điện thoại vật lý, chưa chạy toàn bộ integration backend hoặc triển khai production. Các kết quả provider/CI lịch sử trong tài liệu branch không thay bằng chứng của lần audit này.

Kiểm thử dùng MongoDB riêng trên 27020/27021 và thư mục test mới dưới `.local`; không sửa hoặc dừng service MongoDB dùng chung 27017, không seed/migrate database ứng dụng. Các file log/ảnh trong `.local` và `test-results` không commit.
