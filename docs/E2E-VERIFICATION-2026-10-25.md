# Khôi phục bộ E2E đầy đủ — 25/10/2026

Theo yêu cầu owner sau [audit hai branch](BRANCH-AUDIT-2026-10-25.md): sửa các bài E2E còn lỗi, chạy lại suite đầy đủ rồi commit/push main.

## Nguyên nhân và phạm vi sửa

Catalog seed minh họa cố ý để giá/giờ chưa rõ, một số món ăn chưa đại diện cho nhà hàng cụ thể. Các bài cũ dùng dữ liệu này nhưng kỳ vọng xác nhận ngày/lưu lịch thành công, không còn phù hợp với gate CAT-14 / AI-01/02 hiện hành. Không nới gate hoặc đổi dữ liệu ứng dụng để làm test xanh.

`schedulingCatalog` là fixture theo từng test, chỉ dùng MongoDB riêng 27020 do `foundation.spec.ts` khởi tạo và kiểm tra quyền sở hữu process/dbpath. Fixture ghi giá/giờ/địa chỉ minh họa với nguồn `example.invalid`; giữ bản gốc và phục hồi trong teardown, kể cả khi test thất bại. Không thay `db:seed` hoặc dữ liệu service 27017.

Ca Hội An kiểm tra thiếu dữ liệu → lỗi thật và danh sách chuyến vẫn rỗng; sau khi bổ sung catalog fixture hợp lệ, retry dùng rescheduler/API thật → lưu/reload/chỉnh số người, ngân sách, ghi chú và bản đồ. Giá mới có căn cứ được đưa vào snapshot; test đối chiếu cả mỗi người, tổng nhóm và `budgetSummary` đã lưu. Không mock thành công reschedule hoặc save.

Ca người dùng mới giữ kiểm tra giá chưa rõ và provider failure; phần lưu sau đó dùng nhà hàng fixture có đủ điều kiện. Các nhãn chi phí dự kiến, nút ghi chi tiêu tùy chọn và thao tác quản trị V3 được đồng bộ với UI hiện hành. Giá/giờ/điểm đến trong bài admin được nhập tường minh qua UI, không dựa vào Hội An mặc định.

## Tái lập

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:E2E_API_PORT = '3001'
$env:E2E_WEB_PORT = '5181'
npm run test:e2e
npm run test:catalog-browser
```

Chạy tuần tự để không tranh cổng. Không dùng `--grep`, `--grep-invert`, `--last-failed`, retry hoặc skip mới cho lần nghiệm thu cuối. Browser dùng Edge headless; backend build thật, MongoDB test riêng. Fixture có nhãn không chứng minh giá hoặc giờ của cơ sở thực tế.

## Kết quả

Windows, Node 24.15.0, npm 11.12.1, MongoDB binary 8.2 và Edge headless. Hai lệnh nghiệm thu đã chạy tuần tự từ checkout trên main:

| Lệnh                                              | Kết quả đã quan sát                                             |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `npm run test:e2e -- --reporter=line`             | Exit 0; build thành công, 33 pass / 1 skipped; browser 1,4 phút |
| `npm run test:catalog-browser -- --reporter=line` | Exit 0; 4/4 pass; browser 44,9 giây                             |
| `npm test`                                        | 64/64 pass                                                      |
| `npm run typecheck`                               | PASS, gồm tools/tests                                           |
| `npm run lint`                                    | PASS                                                            |

Không dùng bộ lọc hoặc retry trong hai lệnh nghiệm thu. Test skipped duy nhất là ca live Gemini có opt-in sẵn từ trước, không phải ca mới bị bỏ qua. Các luồng Hội An, chi tiêu, quản lý chuyến, hồ sơ/mật khẩu, chia sẻ, recovery, offline, newcomer, quick planner, admin publication và OTP đều đã chạy.

Thao tác archive admin chờ đúng HTTP PATCH, kiểm tra publicationStatus=archived, nút ngừng hiển thị biến mất và public detail trả404; không chỉ so banner có thể còn từ thao tác trước. Trip vẫn giữ snapshot giá đã lưu. Fixtures catalog được hoàn nguyên sau test để không làm sai điều kiện của ca tiếp theo.

Log/ảnh chỉ nằm trong `.local` và `test-results`, không commit. Sau hai suite, cổng test 27020/27021/3001/5181 đã được giải phóng; service MongoDB 27017 vẫn là process ban đầu. Không đổi runtime sản phẩm, contracts, schema/index, provider secrets hoặc lockfile.

Build vẫn có cảnh báo chunk chính >500kB; Vite cảnh báo cách tải config test. Hai cảnh báo không làm lệnh thất bại. CI GitHub chỉ bao gồm install/format/lint/typecheck/unit/build; kết quả E2E nêu trên là lần chạy local, không suy ra từ CI.

## Giới hạn

Test live Gemini có opt-in `LIVE_GEMINI=1` từ trước; mặc định không gọi provider có phí. Các thử lỗi provider/SMTP và upload avatar dùng fixture hoặc browser fault injection có nhãn, không chứng minh giao thư/upload/provider thật. Chưa kiểm tra trên điện thoại vật lý hoặc triển khai production.
