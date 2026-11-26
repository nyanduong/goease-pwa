# GoEase

**Nền tảng khám phá, trải nghiệm và nhận quyền lợi khi du lịch miền Tây.** GoEase bắt đầu từ Cần Thơ và ưu tiên người địa phương. [Nguồn đã duyệt](docs/README.md) · [Quy tắc repository](AGENTS.md)

## Quy trình nhánh

- Duy trì ba nhánh trong đợt rebuild. Phát triển phiên bản mới trên `nyan`, giữ `develop` làm baseline và giữ `main` đến giai đoạn release.
- Sau khi chủ dự án nghiệm thu từng task, kiểm tra diff, chạy kiểm tra local phù hợp, commit đúng phạm vi, push lên `origin/nyan` và cập nhật tiến độ.
- Chỉ mở PR từ `nyan` vào `develop` sau khi chủ dự án nghiệm thu toàn bộ phiên bản mới. Quy trình từng task không có feature branch, PR hoặc merge vào `develop`. Không push lên `main`, force-push hoặc viết lại lịch sử Git.

## Chạy local

Dùng Node.js theo [`.node-version`](.node-version), npm `11.12.1` và một `package-lock.json` ở root. Chạy từ thư mục gốc.

```powershell
npm ci
npm run dev
```

Để chạy riêng từng tiến trình từ root, dùng lệnh tương ứng.

```powershell
npm run dev:web  # Frontend tại localhost:5181
npm run dev:api  # Express tại localhost:3000
```

Web cần API đang chạy ở cổng cấu hình để kiểm tra health.

Mở [GoEase](http://localhost:5181/), [API health](http://localhost:3000/api/v1/health) hoặc [health qua Vite](http://localhost:5181/api/v1/health). Vite chuyển tiếp `/api/` tới Express. Cổng mặc định của web và API lần lượt là `5181` và `3000`. Khi cần đổi cổng, đặt `GOEASE_WEB_PORT` hoặc `GOEASE_API_PORT` trong shell trước khi chạy. [Mẫu web](client/.env.example) · [Mẫu API](server/.env.example)

Foundation dùng cấu hình từ môi trường tiến trình. API liveness trả HTTP 200 khi Express phản hồi. [Trạng thái database](http://localhost:3000/api/v1/health/db) trả HTTP 503 với mã `DATABASE_NOT_CONFIGURED` cho đến khi có lớp kết nối MongoDB.

## Kiểm tra và build

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm test` chạy các kiểm tra Express trên cổng loopback tạm thời. Playwright dùng Microsoft Edge và tự khởi động cả hai workspace ở cổng web `5191` và API `3011`. Build xuất `dist/` cho contracts, API và frontend. Chạy API đã build bằng `npm run start --workspace @goease/server`.

## Tổ chức mã

| Thư mục                                    | Nội dung                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| [client/](client/)                         | React, Vite, TypeScript, Tailwind và Playwright cho Traveler Foundation       |
| [server/](server/)                         | Express, cấu hình môi trường, health, xử lý lỗi, logging và graceful shutdown |
| [packages/contracts/](packages/contracts/) | DTO và schema runtime cho health và lỗi API                                   |
| [docs/](docs/)                             | Nguồn đã duyệt, decision log và ghi chú kỹ thuật                              |
| [Figma/](Figma/)                           | Brand Foundation E2, logo và thiết kế tham chiếu                              |

Checkpoint `1f33cfcc01d12c87883b5df3d87df79737b919c3` lưu cây mã ngay trước cleanup, gồm cả giao diện Foundation đã nghiệm thu và mã legacy để truy xuất qua Git. [Ghi chú Traveler Foundation](docs/frontend-foundation.md)
