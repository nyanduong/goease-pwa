# GoEase

GoEase được viết mới hoàn toàn: React + Vite + TypeScript + Tailwind, Express + TypeScript, MongoDB + Mongoose. Phát triển bằng MongoDB local; Atlas là bước sau khi bản local hoàn thành. Mobile tương lai sử dụng cùng REST API và contracts thuần TypeScript.

F0 cung cấp màn hình kỹ thuật, health API và tooling. Chưa triển khai auth, AI, trip CRUD, booking, payment, CMS, native mobile hoặc service worker/offline cache. Màn hình foundation không phải trang chủ sản phẩm.

## Yêu cầu môi trường

| Công cụ           | Phiên bản                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Node.js           | 24 LTS; đã kiểm tra **24.15.0**, `.node-version` pin bản này; engines nhận 24.15+ trong dòng 24 |
| npm               | **11.12.1**, pin bằng `packageManager`                                                          |
| MongoDB Community | Đã kiểm tra **8.2**, executable `mongod`; không cần quyền admin để chạy instance riêng          |
| Trình duyệt E2E   | Microsoft Edge đã cài trên Windows; cần `MONGOD_BINARY`                                         |

Các dependency trực tiếp được pin trong manifests, dependency tree trong **một** `package-lock.json`. Dùng npm workspace cho cả development và CI; không tạo lockfile của package manager khác. ESLint 10, TypeScript 5.9, React 19, Vite 8 và Tailwind 4; xem manifest để có patch version chính xác. Không cần Docker; chưa cung cấp Docker Compose vì F0 đã được kiểm chứng bằng MongoDB cài sẵn.

## Chạy local trên Windows / PowerShell

Từ checkout mới:

```powershell
git clone https://github.com/nyanduong/goease-pwa.git
Set-Location goease-pwa
node --version
npm --version
npm ci
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Không ghi đè `.env` đã có khi cập nhật repository. `.env` API được đọc từ `server/`, vì workspace scripts chạy với working directory đó. Các biến `VITE_*` là công khai và có thể nằm trong browser bundle; tuyệt đối không đặt secret ở client.

Mở terminal PowerShell thứ nhất tại root repo, chạy **instance MongoDB riêng**. Cổng **27019** dành cho GoEase để tránh ảnh hưởng MongoDB đang có trên 27017. Thư mục `.local` bị loại khỏi Git:

```powershell
New-Item -ItemType Directory -Force .local/mongodb | Out-Null
$mongoBinary = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
# Thay đường dẫn trên theo phiên bản MongoDB đã cài trên máy.
& $mongoBinary --dbpath "$PWD\.local\mongodb" --bind_ip 127.0.0.1 --port 27019 --replSet rs0
```

Giữ terminal này chạy. Không dùng thư mục dữ liệu MongoDB có sẵn của ứng dụng khác. Nếu chưa có MongoDB, cần cài MongoDB Community theo hướng dẫn chính thức; task không tự cài phần mềm hệ thống.

Terminal thứ hai, tại root repo:

```powershell
# Chỉ chạy lệnh init trên instance GoEase dành riêng ở 127.0.0.1:27019.
npm run db:init
# Sau lần init đầu, chờ vài giây để replica set bầu primary.
npm run db:check
npm run dev
```

Mở [web local](http://localhost:5180). API ở [health](http://localhost:3000/api/v1/health) và [database health](http://localhost:3000/api/v1/health/db). Dùng `localhost` nhất quán với `CLIENT_ORIGIN`. Cổng 5180 được chọn vì 5173 đã có tiến trình khác trong môi trường kiểm tra; `strictPort` tránh âm thầm đổi cổng. Nút **Kiểm tra lại** lấy trạng thái mới; trang không tự polling.

`npm run dev` build contracts trước rồi chạy web/API song song. Nếu sửa contracts, build lại package và khởi động lại dev. Vite proxy `/api` tới API trên `localhost:3000`. Web và API chỉ bind localhost, không mở ra IP LAN. MongoDB nội bộ dùng loopback 127.0.0.1 để giữ tương thích replica set đã khởi tạo; đây không phải địa chỉ IP LAN của máy. Khi triển khai web/API khác origin, cấu hình `VITE_API_BASE_URL` là origin API và `CLIENT_ORIGIN` là origin web; đổi proxy nếu đổi cổng API local. Không dùng Vite dev server làm production server.

## MongoDB và phục hồi kết nối

`server/.env.example` có:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27019/goease?replicaSet=rs0
MONGODB_TEST_URI=mongodb://127.0.0.1:27019/goease_f0_test?replicaSet=rs0
```

`npm run db:init` chỉ khởi tạo `rs0` khi instance trên 27019 trả `NotYetInitialized`; không sửa cấu hình replica set có sẵn. URI chứa `replicaSet=rs0` không tự khởi tạo replica set. Single-node replica set này phục vụ development, chưa có dự phòng; transaction nghiệp vụ chưa được triển khai hay nghiệm thu trong F0.

`npm run db:check` dùng Mongoose ghi → đọc → xóa document có marker ngẫu nhiên, chỉ trong `goease_f0_test` trên loopback. Script từ chối tên database ứng dụng, host bên ngoài, credentials, URI SRV, query khác `replicaSet` và `NODE_ENV=production`; không drop database hay xóa dữ liệu khác.

Để thử mất kết nối thủ công: dừng terminal MongoDB bằng `Ctrl+C`, nhấn **Kiểm tra lại**. Backend vẫn trả health 200 nhưng DB trả 503. Chạy lại đúng lệnh `mongod` với cùng dbpath, chờ kết nối phục hồi rồi nhấn **Kiểm tra lại**. Backend thử lại sau 3 giây khi kết nối ban đầu lỗi; sau khi đã kết nối, driver Mongoose tự phục hồi khi database trở lại. API không xóa dữ liệu lúc khởi động.

Dừng web/API bằng `Ctrl+C`. API xử lý SIGINT/SIGTERM, ngừng nhận request và đóng connection; giới hạn shutdown 10 giây. Trên Windows, đóng cửa sổ hoặc force-kill process có thể bỏ qua signal handler.

## Các lệnh kiểm tra

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run db:check
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:e2e
```

E2E cần cổng **3000**, **5180**, **27020** trống; hãy dừng `npm run dev` trước. Test dùng Edge headless, API build thật và Vite dev server, khởi chạy MongoDB riêng trên 27020 với dbpath mới trong `.local`. Test thực sự dừng process MongoDB do chính nó tạo rồi khởi động lại, kiểm tra 503 và phục hồi trên cùng API. Không dừng MongoDB của người dùng trên 27017/27019. Dữ liệu E2E giữ trong `.local` để kiểm tra khi cần. Screenshot ở `test-results/`; không commit artifacts này.

`npm test` kiểm tra HTTP thật với dependency ping được điều khiển để kiểm tra hợp đồng lỗi, validation và guard database test; đây không phải bằng chứng kết nối MongoDB. Bằng chứng MongoDB thật đến từ `db:check` và E2E. Test lỗi mạng dùng browser fault injection và được đặt tên rõ.

`npm run build` tạo `client/dist`, `server/dist`, `packages/contracts/dist`. Sau build có thể chạy API bằng `npm run start --workspace @goease/server`; `npm run preview --workspace @goease/client` chỉ xem bundle (không có dev proxy, cần cấu hình public API URL hoặc reverse proxy để gọi API).

CI GitHub chạy npm ci, format, lint, typecheck, unit test và build. E2E/database là kiểm tra local có điều kiện riêng. Trạng thái CI chỉ được xác nhận sau khi quan sát run trên GitHub; xem [bằng chứng F0](docs/F0-VERIFICATION.md).

## API và tổ chức mã

| Request                 | HTTP              | Response                                                                                                            |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health`    | 200               | `{ "ok": true, "data": { "status": "up", "service": "goease-api" } }`                                               |
| `GET /api/v1/health/db` | 200 sau ping thật | `{ "ok": true, "data": { "status": "up", "database": "connected" } }`                                               |
| Database không sẵn sàng | 503               | `{ "ok": false, "error": { "code": "DATABASE_UNAVAILABLE", "message": "Database is unavailable. Please retry." } }` |

Lỗi khác có cùng envelope `ok: false, error: { code, message }`. Không trả URI/credential/stack trace. JSON request giới hạn 16 KB; payload sai trả 400/413, route không tồn tại trả 404. Health response không được cache. CORS cho một origin từ cấu hình, chưa bật credentials hoặc thiết kế auth.

```text
client/                    React, health client, Tailwind, Vite
server/
  src/config.ts            Validation cấu hình lúc khởi động
  src/index.ts             Bootstrap và shutdown
  src/app.ts               Middleware và xử lý lỗi tập trung
  src/database.ts          Mongoose lifecycle, retry, ping
  src/features/health/     Health routes
  scripts/                 Init replica set, smoke check và guard
  test/                    HTTP/configuration/guard tests
packages/contracts/        Zod schemas và DTO; không phụ thuộc DOM/server models
tests/                     Browser E2E và MongoDB lifecycle thật
docs/                      BR, kiến trúc, bằng chứng F0
.github/workflows/ci.yml    Kiểm tra tái lập từ lockfile
```

Health hiện chỉ cần routes gọi dependency ping; chưa có domain logic cần tách controller/service/model. Thêm các lớp đó khi triển khai nghiệp vụ thật. Không có import source trực tiếp giữa web và API.

## Tài liệu và bước tiếp theo

Baseline thiết kế v0.2 đã được chủ dự án chấp thuận; F0 là phần đã triển khai, auth/trip và các module mới chưa triển khai. Policy ghi đề xuất/cần duyệt vẫn còn mở. Thứ tự đọc:

1. [Quy ước repository](AGENTS.md) và README này.
2. [BR hiện hành](docs/BR.md), [kiến trúc](docs/ARCHITECTURE.md), [bằng chứng F0](docs/F0-VERIFICATION.md).
3. [DB baseline](docs/DB-BASELINE.md), [truy vết/vòng đời](docs/DATA-TRACEABILITY.md), [registry đọc máy](docs/collection-registry.json).
4. [Review và bàn giao F1](docs/F1-HANDOFF.md) cùng task hiện tại.

[Bản nhập BR lưu trữ](docs/archive/BR-v0.2-draft.md) chỉ để đối chiếu; nguồn nghiệp vụ duy nhất là BR.md. Sửa nghiệp vụ phải cập nhật mã BR, schema/dictionary/contracts và tests liên quan; ghi rõ phần chưa triển khai. Registry không phải schema executable.

Bước tiếp theo **F1-B READY trong phạm vi context/log an toàn/audit tối thiểu**; xem acceptance và gate trong handoff. Tiếp theo F1-C (Google + email/password đã chốt) rồi CORE-1 owner trip. Quyền guest, provider/email config, retention và caps còn cần quyết định theo tính năng; commerce chưa chốt không chặn công việc độc lập. F1-A dừng ở tài liệu.

Nguồn kỹ thuật: [Node.js LTS](https://github.com/nodejs/Release), [Vite](https://vite.dev/guide/), [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite), [Mongoose connections](https://mongoosejs.com/docs/connections.html), [MongoDB replica set](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/).
