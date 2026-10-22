# F0 — Bằng chứng kiểm tra local

Ngày kiểm tra: **22/10/2026**, Windows / PowerShell. Mã được triển khai trực tiếp trên `main`, viết mới, không nhập code repository GoEase cũ. BR không thay đổi. Architecture chỉ cập nhật trạng thái F0 và quyết định pnpm thay khuyến nghị npm trước đó (kèm chuẩn hóa định dạng Markdown).

## Môi trường và lựa chọn

- Node **24.15.0 LTS**, pnpm **10.34.6**; phiên bản dependency trực tiếp pin trong từng manifest, một lockfile ở root.
- MongoDB **8.2** cài sẵn. Instance ứng dụng khác trên 27017 và web khác trên 5173 được giữ nguyên.
- GoEase chạy MongoDB riêng trên **27019**, replica set **rs0**, dbpath `.local/mongodb`. API **3000**, web **5180**.
- E2E dùng **Microsoft Edge headless**, tự tạo MongoDB riêng trên **27020**, dbpath mới trong `.local/e2e-mongo-*`; không sửa database đang sử dụng của người dùng.
- Không cần Docker hoặc cài đặt phần mềm hệ thống. Chưa dùng Atlas, chưa có domain collection của sản phẩm.

## Kết quả quan sát

| Kiểm tra                            | Kết quả                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`    | PASS trên workspace và bản sao sạch từ Git index, chưa có node_modules/dist/.env          |
| `pnpm typecheck`                    | PASS; strict cho web, API, contracts, server tools/tests và E2E/config                    |
| `pnpm lint`                         | PASS, không warning                                                                       |
| `pnpm format:check`                 | PASS; BR và AGENTS giữ nguyên định dạng sẵn có                                            |
| `pnpm test`                         | PASS, 3 tests: HTTP/error contract, environment validation, guard database test           |
| `pnpm build`                        | PASS: contracts declarations/JS, API JS, frontend bundle                                  |
| `pnpm db:init`                      | PASS, khởi tạo rs0 trên instance riêng 27019                                              |
| `pnpm db:check`                     | PASS, Mongoose write/read/delete thật trong `goease_f0_test`; chỉ xóa marker của lần chạy |
| `pnpm test:e2e` với `MONGOD_BINARY` | PASS, 3 browser tests trên API/MongoDB thật                                               |
| `pnpm audit --prod`                 | Không phát hiện lỗ hổng đã biết tại thời điểm chạy                                        |

E2E quan sát request frontend qua Vite proxy tới health API thật, HTTP 200 và UI thành công ở **1280 px / 390 px**, không tràn ngang; screenshot được xem trực tiếp để kiểm tra bố cục mobile. Kiểm tra lỗi mạng dùng browser fault injection, sau đó bỏ injection và retry tới API thật.

Test MongoDB lifecycle thực sự dừng process test do chính nó khởi tạo: `/health/db` trả **503**, `/health` tiếp tục **200**, giao diện hiển thị database chưa sẵn sàng. Khởi chạy lại database trên cùng dbpath, API cũ kết nối lại và UI retry trở lại thành công. API còn được kiểm chứng khởi động trước khi database có mặt, rồi kết nối qua cơ chế retry ban đầu. Đây không phải mock thành công database.

Unit test kiểm tra invalid JSON (400), payload quá lớn (413), endpoint không tồn tại (404), envelope lỗi, CORS origin và che nội dung lỗi dependency. Unit test dùng ping điều khiển; không thay thế `db:check` hoặc E2E cho bằng chứng MongoDB.

## Giới hạn và phạm vi

- Cấu hình GitHub Actions đã có cho frozen install / format / lint / typecheck / unit test / build. Chưa xác nhận kết quả CI GitHub nếu chưa quan sát được run sau push.
- Test browser dùng Vite dev server và API build. Frontend production bundle đã build; chưa có deployment công khai hoặc kiểm thử trên điện thoại vật lý.
- Chưa nghiệm thu transaction nhiều document, độ sẵn sàng production, authentication, provider ngoài, PWA install/offline hoặc Atlas; các phần đó nằm ngoài F0.
- Shutdown SIGINT/SIGTERM có implementation với deadline. Không suy ra force-kill Windows thực thi graceful handler; browser test dừng process MongoDB test để kiểm tra lỗi dependency.
- Hướng dẫn PowerShell, cấu trúc thư mục và hợp đồng API nằm trong README. Sau F0 cần chốt Q-02 trước khi triển khai lưu trip và ownership.

Commit SHA và trạng thái push được báo trong bàn giao sau khi commit; không tự ghi SHA của chính commit này vào nội dung commit.
