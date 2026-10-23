# Nghiệm thu vận hành danh mục Hội An — 23–24/10/2026

Phạm vi đã triển khai local: cấu hình → worker lấy nguồn → bản nháp/đối chiếu → quyết định → duyệt lô → public catalog → đồng bộ tiếp giữ nội dung biên tập. Giữ React/Vite/TypeScript/Tailwind, Express/TypeScript, MongoDB/Mongoose và một lockfile. Không thêm dependency, provider mới, booking/payment, partner hay user-management. Giữ các thay đổi có sẵn trong working tree; không commit/push/deploy.

## Kiểm tra đã quan sát

| Kiểm tra                                             | Kết quả                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`, `npm run lint`, `npm run build` | PASS; build có cảnh báo chunk client > 500 kB, không lỗi build                                                              |
| `npm test`                                           | PASS 34 unit checks, gồm normalization, provider failures, Retry-After và cấu hình sai khóa                                 |
| Nhóm integration/adapter bên dưới                    | PASS 42 checks (gồm 5 Geoapify fixture checks); MongoDB test riêng                                                          |
| `npm run db:check`                                   | PASS ghi/đọc/xóa marker trong `goease_f0_test`; không đổi MongoDB service/application data                                  |
| Browser luồng vận hành mới                           | PASS API/authorization/MongoDB thật, provider fixture; không route-mock thành công                                          |
| Browser editor giá → khách và nhập thủ công          | PASS 2 kịch bản hồi quy; editor giá dùng API/MongoDB thật, nhập thủ công dùng API fixtures được ghi rõ trong test           |
| Registry/BR/dictionary + scan secret                 | PASS 43 collection names duy nhất; CAT-11–13 có đích; khóa Geoapify cấu hình không có trong Git-visible files/client bundle |

Lệnh nhóm integration:

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm exec -- tsx --test --test-concurrency=1 server/test/catalog-operations.integration.ts server/test/catalog.integration.ts server/test/place-import.integration.ts server/test/geoapify.test.ts server/test/audit.integration.ts
```

Bao phủ: customer/guest bị chặn; payload giả; draft/archived không public/planner; giá null khác 0; giá hết hạn không dự toán mới; snapshot chuyến cũ giữ nguyên; receipt/audit/import không lặp; source update không ghi đè sửa tay; giữ thông tin không mở lại khi nguồn không đổi; áp dụng chỉ trường nguồn đổi; nghi trùng chặn đăng; hẹn lại/đến hạn; batch một phần với revision conflict và replay kết quả cũ; pause; quota dùng chung; worker mất fence; 429/timeout/retry hữu hạn; lỗi truy vấn provider thứ hai không nhập nửa lượt; audit DB failure rollback place/review/result.

Kiểm tra nhiều tiến trình: chạy worker trong các child process độc lập, worker thứ hai không nhận lượt đang khóa; kill worker đang lấy nguồn, xác nhận lịch và lượt còn trong MongoDB, đưa lease của **riêng fixture** về quá hạn để khỏi chờ 120 giây rồi khởi process mới. Process mới hoàn tất đúng lượt với một place/audit. Đây là restart tiến trình thật; thời gian chờ lease được tăng tốc trong database test, không giả đã đợi 120 giây thực.

## Browser và ảnh

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:E2E_API_PORT = '3002'
$env:E2E_WEB_PORT = '5182'
npm run test:catalog-browser
```

Harness khởi MongoDB riêng 27021 qua guard F1, API thật có injected provider fixture, Vite/Edge. Account/địa điểm mang nhãn dữ liệu thử, không ghi vào goease. Bốn màn được kiểm tra tại 1366×768 và 1440×900; mức 125% được mô phỏng bằng viewport CSS chia 1.25 và device pixel ratio 1.25, có ảnh hưởng media queries. Không tuyên bố đã điều khiển menu zoom của Edge hoặc thử trên màn hình vật lý.

Kịch bản: đăng nhập → nhận biết việc → mở bảng so sánh và áp dụng → chọn 4 mục → xem 1 mục đủ điều kiện/3 mục chặn → đăng 1 mục → public API chỉ trả mục đã đăng → cấu hình lịch tuần 08:30 → reload vẫn giữ → Chạy ngay gặp 429 fixture → thấy lịch tự thử lại → tạm dừng → kiểm tra 4 màn/overflow ở 2 kích thước và 2 mức phóng → mở editor → hẹn lại nghi trùng. Luồng giữ thông tin, conflicts, process recovery và retry receipt có kiểm chứng integration riêng.

Ảnh tạo ở `test-results/catalog-evidence/` (Git ignored, có thể tái tạo bằng lệnh trên):

- `01-work-1366.png`: nhóm công việc và hành động chính.
- `02-compare-1366.png`: nội dung biên tập so với nguồn, phần giữ/đề nghị áp dụng.
- `03-batch-preview.png`: phạm vi xuất bản, mục đủ điều kiện và lý do chặn.
- `04-schedule-1440.png`: lịch giờ Việt Nam và kỳ tiếp theo đã lưu.
- `05-source-retry.png`: nguồn 429 fixture và giờ tự thử lại.
- `normal-*`, `zoom-*`: bốn màn tại hai kích thước; `06-editor-125.png`: form chỉnh sửa.

Đã xem ảnh và sửa lỗi nút 100% làm ép tên xuống từng ký tự, thêm assertion chiều rộng/chiều cao hàng. Có nhãn/biểu tượng trạng thái bằng chữ, focus bàn phím, nguồn/giấy phép và loading/retry; không chỉ dùng màu để diễn đạt khác biệt.

## Vận hành và giới hạn

Mở `/admin` → Tự động cập nhật → kiểm tra trạng thái cấu hình nguồn → chọn nhóm/lịch → Lưu và bật. Chạy backend với `npm run dev` hoặc API start; đóng trang admin không dừng worker. Tắt máy/API thì lịch không chạy, restart sẽ nhận kỳ quá hạn một lần và khôi phục lượt hết lease. Không catch-up mọi kỳ bỏ lỡ. Pause ngăn lượt tự động mới; lượt đã nhận vẫn hoàn tất/thử lại. Chạy ngay là thao tác riêng có quyền admin.

Lịch mặc định tắt. Key chỉ ở `server/.env`, restart API sau thay đổi. Có cấu hình không bảo đảm provider chấp nhận khóa; 401/403 và thiếu khóa có thông báo cần người thiết lập. Bản này **chưa gọi Geoapify live cho worker mới**, chưa kiểm thử live lỗi nhà cung cấp, giá/giờ ngoài thực địa, Atlas hoặc production. Bằng chứng live import trước đó trong GEOAPIFY-IMPORT.md là lịch sử riêng.

Giới hạn: Hội An bán kính 5 km, tối đa 50 kết quả/lượt, 3 truy vấn mixed, 3 lần thử, 20 lượt/giờ chung, 10/actor/giờ, 2 slot; đối chiếu tối đa 5.000 địa điểm. Dữ liệu ít/không có ảnh/giá/giờ không được phát minh. Legacy source chưa có snapshot tạo đối chiếu lần đầu. Không tự xuất bản, merge địa điểm, phân trang provider, lưu raw response, gỡ dữ liệu do vắng một lượt, rewrite trips hay tự purge. UI lịch sử giữ 30 lượt gần nhất, audit có phân trang; chưa có bộ lọc/tìm toàn bộ lượt cũ. Xem ADMIN-CATALOG.md và DB-BASELINE.md cho contracts/schema cụ thể.
