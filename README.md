# GoEase

GoEase được viết mới hoàn toàn: React + Vite + TypeScript + Tailwind, Express + TypeScript, MongoDB + Mongoose. Phát triển bằng MongoDB local; Atlas là bước sau khi bản local hoàn thành. Mobile tương lai sử dụng cùng REST API và contracts thuần TypeScript.

Đã có trang chủ sản phẩm, đăng ký/đăng nhập email-mật khẩu không phụ thuộc xác minh email, đăng xuất bằng phiên cookie và lịch trình thủ công lưu MongoDB theo tài khoản. Account dùng được ngay; email chưa xác minh vẫn được ghi nhận riêng. Google OIDC đã có nhánh tích hợp nhưng chưa kiểm thử live vì thiếu cấu hình. AI, booking/payment, CMS, native mobile và offline cache chưa triển khai. Màn kỹ thuật chỉ ở `/dev/foundation` trong development. Xem [nghiệm thu sản phẩm](docs/PRODUCT-VERIFICATION.md).

Luồng Hội An:7gợi ý trong catalog có nguồn, thêm địa điểm vào chuyến/ngày, chỉnh lịch và ngân sách server tính theo nhóm hoặc mỗi người. Chạy `npm run db:seed` sau khi cập nhật để bổ sung catalog/metadata còn thiếu (không ghi đè bản đã chỉnh). Giá chưa xác minh giữ Chưa rõ. `/budget` là bản minh họa UI; chi phí thật mở từ tab Chi phí trong chuyến đã tạo. Goe vẫn là hội thoại minh họa.

Bản đồ lịch trình Hội An: mở chuyến → tab **Bản đồ** → chọn ngày/điểm dừng. Có vị trí khu vực tham khảo cho5địa điểm, nút mở chỉ đường và trạng thái thiếu tọa độ/lỗi mạng. `npm run db:seed` bổ sung vị trí còn thiếu, không ghi đè catalog đã chỉnh. Xem [nguồn tọa độ và giới hạn](docs/TRIP-MAP.md).

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
npm run db:seed
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

`npm run db:init` chỉ khởi tạo `rs0` khi instance trên 27019 trả `NotYetInitialized`; không sửa cấu hình replica set có sẵn. URI chứa `replicaSet=rs0` không tự khởi tạo replica set. Single-node replica set này phục vụ development, chưa có dự phòng; transaction nghiệp vụ chưa được triển khai hay nghiệm thu trong F0; task sản phẩm sau F1-B đã bổ sung kiểm thử riêng cho auth/trip/audit.

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
npm run test:integration
npm run test:e2e
```

Integration cần `MONGOD_BINARY` và cổng **27021** trống. `npm run test:integration` tự tạo mongod replica set một node có tên/ngữ cảnh riêng, dbpath mới `.local/f1b-mongo-*` và database `goease_f1b_test_<runId>`. Harness xác minh dbpath/set name của process do nó tạo trước khi init; chờ primary rồi kiểm chứng transaction và index thật. Guard từ chối production, URI remote/credential/database ứng dụng và target không đúng run ID. Không dùng `.env` để chọn URI test; không drop database, syncIndexes hoặc reconfigure rs0 ứng dụng. Test chỉ dừng process do nó tạo, giữ dbpath test để kiểm tra. Thiếu binary/database readiness là lỗi lệnh, không skip rồi báo PASS.

E2E mặc định cần cổng **3000**, **5180**, **27020** trống. Không dừng tiến trình của người dùng để lấy cổng. Nếu web/API development đang chạy, dùng cổng localhost riêng cho harness:

```powershell
$env:E2E_API_PORT = '3001'
$env:E2E_WEB_PORT = '5181'
npm run test:e2e
# Xóa hai override khi muốn quay lại cổng E2E mặc định:
Remove-Item Env:E2E_API_PORT, Env:E2E_WEB_PORT
```

Các override chỉ áp dụng Playwright và `tests/vite.config.mts`; không đổi cổng development hoặc config client. Port phải là số 1024–65535, khác nhau và khác cổng MongoDB. `reuseExistingServer:false` từ chối web/API test port đã bị chiếm. Test dùng Edge headless, API build thật và Vite dev server/proxy, khởi chạy MongoDB riêng trên 27020 với dbpath mới trong `.local`. Test thực sự dừng process MongoDB do chính nó tạo rồi khởi động lại, kiểm tra 503 và phục hồi trên cùng API. Không dừng MongoDB của người dùng trên 27017/27019. Dữ liệu E2E giữ trong `.local` để kiểm tra khi cần. Screenshot ở `test-results/`; không commit artifacts này. E2E standalone không thay bằng chứng transaction từ integration replica set.

`npm test` kiểm tra HTTP thật với dependency ping được điều khiển, request context/concurrency, stdout/stderr JSON có scanner bí mật, startup/database error và guard database test; đây không phải bằng chứng kết nối MongoDB. Bằng chứng MongoDB thật đến từ `db:check`, integration và E2E. Test lỗi mạng dùng browser fault injection và được đặt tên rõ.

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

Health giữ routes gọi dependency ping. F1-B thêm `server/src/observability/` và `server/src/features/audit/` cho append/read probe có giới hạn; app không khởi tạo model hoặc ghi audit khi startup. Thêm các lớp đó khi triển khai nghiệp vụ thật. Không có import source trực tiếp giữa web và API.

## Tài liệu và bước tiếp theo

Baseline thiết kế v0.2 đã được chủ dự án chấp thuận; F0 là phần đã triển khai, auth/trip và các module mới chưa triển khai. Policy ghi đề xuất/cần duyệt vẫn còn mở. Thứ tự đọc:

1. [Quy ước repository](AGENTS.md) và README này.
2. [BR hiện hành](docs/BR.md), [kiến trúc](docs/ARCHITECTURE.md), [bằng chứng F0](docs/F0-VERIFICATION.md).
3. [DB baseline](docs/DB-BASELINE.md), [truy vết/vòng đời](docs/DATA-TRACEABILITY.md), [registry đọc máy](docs/collection-registry.json).
4. [Review và bàn giao F1](docs/F1-HANDOFF.md) cùng task hiện tại.

[Bản nhập BR lưu trữ](docs/archive/BR-v0.2-draft.md) chỉ để đối chiếu; nguồn nghiệp vụ duy nhất là BR.md. Sửa nghiệp vụ phải cập nhật mã BR, schema/dictionary/contracts và tests liên quan; ghi rõ phần chưa triển khai. Registry không phải schema executable.

**F1-B đã triển khai và kiểm chứng local**; xem [bằng chứng F1-B](docs/F1-B-VERIFICATION.md). Email/password và chuyến riêng hiện đã chạy local; email chưa được xác minh không được dùng để liên kết/merge account hay mở quyền đặc biệt. Google cần cấu hình OAuth để kiểm thử live; recovery/linking chưa có UI/API. Đây chưa phải xác nhận production readiness.

Nguồn kỹ thuật: [Node.js LTS](https://github.com/nodejs/Release), [Vite](https://vite.dev/guide/), [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite), [Mongoose connections](https://mongoosejs.com/docs/connections.html), [MongoDB replica set](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/).

## RequestId và technical logs (F1-B)

Mỗi request qua Express có context AsyncLocalStorage riêng, chỉ chứa requestId/correlationId, không actor/user/role. `X-Request-Id` hợp lệ là UUIDv4 dài đúng 36 ký tự, được chuẩn hóa chữ thường; thiếu/sai/quá dài/duplicate thì server tạo UUIDv4 mới và không log giá trị cũ. `X-Correlation-Id` dùng cùng định dạng, sai thì bỏ qua; chỉ liên kết flow, không cấp quyền. `X-Request-Id` được trả qua header và expose qua CORS, kể cả JSON validation lỗi/404; health/error body giữ nguyên.

```powershell
$r = Invoke-WebRequest http://localhost:3000/api/v1/health
$r.Headers['X-Request-Id']
# Tìm cùng requestId ở dòng JSON event http.completed của API.
```

Logger JSON ghi stdout theo allowlist: timestamp, level, event, service, environment, appVersion, requestId?, correlationId?, method?, route?, statusCode?, durationMs?. Event/route/method đều là enum trong `server/src/observability/logger.ts`; route hiện chỉ health/db health hoặc `unmatched`, không URL/query. Status 100–599, duration 0–3.600.000 ms; không nhận arbitrary metadata/req/res/Error. Field không có trong allowlist bị bỏ, field hợp lệ sai kiểu/giới hạn dẫn tới logger.invalid_input với nội dung cố định. Startup/database/error dùng cùng logger và mã cố định; không có IP/device/analytics. Sink lỗi bị chặn, không log đệ quy; lỗi audit vẫn propagate.

OperationId khác requestId: caller backend cấp một UUIDv4 cho thao tác, giữ nguyên qua mọi lần retry/transaction callback. F1-B chưa có business endpoint/idempotency store nên không nhận operationId/actor từ HTTP. Audit service chỉ chấp nhận system.audit_probe trong DB test riêng; không có HTTP audit endpoint hay startup probe.

## Tài khoản và chuyến đi local

- `/`: trang chủ; `/register`, `/login`: tài khoản; `/trips`: chuyến riêng; `/trips/new`: tạo lịch thủ công; `/trips/:id`: mở/chỉnh sửa.
- Đăng ký bằng email thử và mật khẩu riêng tối thiểu 12 ký tự; tài khoản tự đăng nhập và vào Trang chủ `/`. Reload đọc phiên từ API; logout rồi login lại bằng cùng thông tin. Tài khoản mới giữ `emailVerifiedAt=null`; không cần mailbox. Không dùng dữ liệu/mật khẩu thật cho thử nghiệm local.
- `npm run db:seed` thêm bốn điểm đến do GoEase biên soạn (Đà Nẵng, Đà Lạt, Hà Nội, Hội An) và ba gợi ý Khám phá tại Hội An, không ghi đè record đã có. Script chỉ nhận development và database `goease` tại loopback27019/rs0. Ảnh AI lưu local, không có giá/rating/ảnh provider trong seed.
- `/explore`: tìm/lọc địa điểm từ API, xem danh sách hoặc bản đồ khu vực; `/places/:id`: chi tiết, ghi chú và thêm vào trip. Lưu địa điểm/ghi chú đồng bộ MongoDB theo tài khoản; bản nháp chuyến đi mới phải nhấn Lưu. API/giới hạn và bằng chứng kiểm tra ở [PRODUCT-VERIFICATION.md](docs/PRODUCT-VERIFICATION.md).
- Nháp trước login chỉ giữ trong bộ nhớ trang; đăng nhập rồi bấm tạo/lưu mới ghi MongoDB. Reload trước khi lưu làm mất nháp này. Khi API lỗi hoặc conflict, giữ input hiện tại; không reload nếu cần giữ bản đang sửa.
- Trip hiện hỗ trợ một điểm đến, VND tổng nhóm, giờ Việt Nam trong cùng ngày. Giới hạn kỹ thuật trong contracts: 31 ngày, 50 hoạt động/ngày, 300/chuyến, 1.000 người; không phải quota thương mại. Chỉnh constants/validation cùng nhau nếu cần thay đổi.
- Danh sách hiển thị tối đa 50 chuyến cập nhật gần nhất. Chưa có phân trang, xóa chuyến, chia sẻ, bản đồ tuyến hành trình, recovery hay quản lý thiết bị.

Google cần `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PKCE_KEY` (32 byte ngẫu nhiên dạng base64) và redirect URI được đăng ký trong Google Console. Callback local mặc định `http://localhost:3000/api/v1/auth/google/callback`. Chỉ đặt secret ở server; không commit `.env`. Production yêu cầu HTTPS origin/callback. Google không tự liên kết với tài khoản trùng email. Chưa có UI link/unlink trong task này. Password login không phụ thuộc NODE_ENV hoặc email provider; production vẫn cần HTTPS để dùng Secure cookie.

Session mặc định hết hạn tuyệt đối 7 ngày, idle 1 ngày; kiểm tra trên mỗi request, không chờ TTL. `SESSION_TTL_SECONDS`, `SESSION_IDLE_SECONDS`, `AUTH_MAX_ATTEMPTS`, `AUTH_WINDOW_SECONDS` có thể cấu hình server. Rate limit hiện theo tiến trình, không phục vụ triển khai nhiều API instance.

E2E sử dụng replica set riêng `goease_e2e` trên 27020, dbpath mới dưới `.local/e2e-mongo-*`; chỉ dừng child do test tạo. Nếu dev đang chạy trên 3000/5180, chạy E2E bằng cổng 3001/5181:

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:E2E_API_PORT = '3001'
$env:E2E_WEB_PORT = '5181'
npm run test:e2e
npm run test:integration
```

Integration dùng fixture replica set riêng trên 27021 và giữ dữ liệu test dưới `.local`; không drop database ứng dụng. Các suite chạy tuần tự để tránh tranh cổng. Xem tài liệu nghiệm thu để biết bằng chứng đã quan sát và nhánh provider chưa kiểm chứng.

## Gemini AI planner (local)

Customer itinerary proposals are connected to the server Gemini adapter. Set server-only GEMINI_API_KEY; see [setup, contract, quotas and verification limits](docs/AI-PLANNER.md). Goe supports selected-day itinerary adjustment with explicit confirmation.

Goe chat can now adjust a selected day of a saved Hội An trip: choose trip/day → send a request → review before/after → confirm save. Read [Goe scope and contracts](docs/AI-PLANNER.md#goe-adjustment-customer-flow--2026-10-23).

## Trip expenses — 2026-10-23

Chi tiêu thực tế: mở chuyến đi đã lưu → Chi phí → Thực chi để nhập/sửa/xóa khoản chi, xem tổng nhóm, bình quân, ngân sách còn lại và chênh lệch với dự toán đã biết. Dùng MongoDB/session hiện có, không cần provider key hay seed mới. API và giới hạn: [docs/TRIP-EXPENSES.md](docs/TRIP-EXPENSES.md).

## Quản lý chuyến đi

Trang Chuyến đi có bộ lọc Sắp đi / Đang đi / Đã kết thúc và phân trang. Mở chuyến → Thông tin chuyến đi để chỉnh tên/ngày/người/ngân sách, nhân bản hoặc xóa; tab Tổng kết so sánh dự toán và thực chi. Dời ngày giữ lịch và thực chi; rút ngắn ngày có hoạt động bị chặn. Xem [hợp đồng và giới hạn](docs/TRIP-MANAGEMENT.md).

## Customer account — 2026-10-23

Bấm avatar Trang chủ để mở Hồ sơ & bảo mật: sửa tên, URL ảnh HTTPS/xóa ảnh và đổi mật khẩu với password hiện tại. Các phiên khác được thu hồi; phiên hiện tại giữ nguyên. Google-only không có form đổi mật khẩu GoEase. Chưa hỗ trợ upload ảnh hoặc quên mật khẩu. Xem [hợp đồng và giới hạn](docs/ACCOUNT-PROFILE.md).
