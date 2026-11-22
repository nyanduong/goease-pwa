# GoEase

Repository của GoEase PWA. Định hướng sản phẩm hiện tại là **Local-first Cần Thơ**.
Xem phiên bản và tình trạng sẵn có của các nguồn nghiệp vụ, UX và visual trong [chỉ mục tài liệu](docs/README.md). Quy tắc làm việc của agent nằm trong [AGENTS.md](AGENTS.md).

## Chạy local

- Dùng Node.js theo [`.node-version`](.node-version), npm `11.12.1` và một `package-lock.json` cho toàn bộ workspace.
- Local development dùng MongoDB đã có tại `localhost:27017`, replica set `rs0`, database riêng `goease`. Dùng cấu hình service hiện hữu và giữ nguyên các database khác.
- Dùng các tệp môi trường mẫu để cấu hình web và API. Chỉ sao chép nếu tệp đích chưa có. Biến `VITE_*` là công khai. Lưu credentials ở môi trường API hoặc hệ thống triển khai.

Chạy các lệnh sau trong PowerShell từ thư mục gốc.

```powershell
npm ci
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (-not (Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
npm run dev
```

Mở [web local](http://localhost:5180), [API health](http://localhost:3000/api/v1/health) hoặc [MongoDB health](http://localhost:3000/api/v1/health/db). Vite proxy `/api` tới API trên `localhost:3000`. Các biến cấu hình nằm trong [server/.env.example](server/.env.example) và [client/.env.example](client/.env.example).

`npm run db:init` kiểm tra primary của replica set hiện hữu. `npm run db:check` ghi, đọc và xóa một marker kiểm tra trong database loopback `goease_f0_test`. Chạy các lệnh thao tác dữ liệu như seed khi công việc yêu cầu rõ ràng.

## Kiểm tra và build

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

[CI](.github/workflows/ci.yml) chạy các kiểm tra này sau `npm ci`. Integration và browser E2E có harness MongoDB riêng. Khi cần chạy, đặt `MONGOD_BINARY` tới binary đã cài và kiểm tra các cổng của harness, 27021 cho integration và 27020 cho E2E. Browser E2E dùng Microsoft Edge trên Windows, web/API mặc định ở 5180/3000. Có thể đặt `E2E_WEB_PORT` và `E2E_API_PORT` nếu cổng đã có tiến trình.

Build tạo `dist/` cho client, server và hai package dùng chung. Có thể khởi động bản build API bằng `npm run start --workspace @goease/server`. Khi cần triển khai, tham khảo [Nginx](deploy/goease.nginx.conf), [systemd](deploy/goease-api.service) và [mẫu môi trường deployment](deploy/.env.example).

## Tổ chức mã và dữ liệu

| Vị trí                                     | Nội dung                                               |
| ------------------------------------------ | ------------------------------------------------------ |
| [client/](client/)                         | React, Vite và Tailwind                                |
| [server/](server/)                         | API Express và MongoDB qua Mongoose                    |
| [packages/contracts/](packages/contracts/) | DTO và schema kiểm tra ở ranh giới API                 |
| [packages/media/](packages/media/)         | URL public và manifest checksum của tài sản Cloudinary |
| [tests/](tests/)                           | Browser E2E                                            |
| [docs/](docs/)                             | Chỉ mục nguồn đã duyệt và decision log                 |
| [Figma/brand/](Figma/brand/)               | Brand Design System và assets bàn giao                 |

`npm run media:verify` đối chiếu các URL CDN và checksum trong manifest. `npm run media:upload` cần ảnh nguồn được Git theo dõi ở vị trí mà script hỗ trợ. Script QA atlas mascot ghi báo cáo JSON cục bộ tới `.local/mascot-assets-qa.json`.
