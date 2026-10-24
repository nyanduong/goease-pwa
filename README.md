# GoEase

Mất kết nối khi mở ứng dụng: tự kiểm tra lại phiên và các lượt tải lỗi (điểm đến, danh sách/chi tiết chuyến, hồ sơ), chờ 2/4/8/16/30 giây; thử ngay khi có mạng hoặc quay lại tab. Dừng khi đã tải thành công, không tải lại toàn trang hay tự gửi lại thao tác lưu/đổi mật khẩu/upload/AI.

Trung tâm cá nhân `/account`: thẻ hồ sơ và bảo mật riêng, chọn ảnh từ thiết bị qua nút camera, kéo/căn/phóng trước khi lưu. Server kiểm và chuẩn hóa ảnh lên Cloudinary; cần credentials server trong `.env.example`. Xem [hồ sơ và upload avatar](docs/ACCOUNT-PROFILE.md).

Thanh điều hướng mobile: Khám phá → Chuyến đi → Trang chủ → Đã lưu → Tài khoản. Goe là nút hình linh thú không nền, mở khung chat nổi ngay trên trang đang xem, không đổi URL. Có thể kéo bằng chuột hoặc cảm ứng; thả tay sẽ bám mép gần nhất và nhớ vị trí trên thiết bị. Kéo không mở chat; Goe nghiêng theo hướng kéo và nhún nhẹ. Khung chat neo gần Goe, tự chọn bên cạnh hoặc phía trên/dưới theo khoảng trống, cập nhật khi kéo và giới hạn trong vùng nhìn thấy kể cả khi đổi kích thước/bàn phím. Khung chat mở với hiệu ứng hiện dần/phóng nhẹ và đóng với hiệu ứng thu nhỏ/mờ dần, tôn trọng tùy chọn giảm chuyển động. Bấm ngoài khung tự thu gọn, vẫn cho thao tác trên trang; tương tác trong chat hoặc kéo Goe không tự đóng khung. Có thể thu gọn/mở lại mà giữ hội thoại trong trang; Escape đóng khung và trả focus về Goe. Trong chuyến đã lưu, chat nhận ngữ cảnh chuyến hiện tại. Bong bóng không hiển thị trên màn đăng nhập, chào mừng, quản trị hoặc khi đang mở chat Goe.

**Admin Operations V2:** `/admin` mở Tổng quan với KPI từ MongoDB, Việc cần làm, Địa điểm, Tự động cập nhật, Lịch sử & phê duyệt, Nguồn dữ liệu và Cài đặt. Có bảng/bản đồ, editor, gallery có nguồn, review, xuất bản theo lô và phục hồi phiên bản. Geoapify/OSM dùng key phía server; lịch mặc định tắt và worker chạy cùng API. Xem [hướng dẫn vận hành V2](docs/ADMIN-OPERATIONS-V2.md) và [bằng chứng kiểm tra, giới hạn](docs/ADMIN-V2-VERIFICATION.md).

GoEase được viết mới hoàn toàn: React + Vite + TypeScript + Tailwind, Express + TypeScript, MongoDB + Mongoose. Phát triển bằng MongoDB local; Atlas là bước sau khi bản local hoàn thành. Mobile tương lai sử dụng cùng REST API và contracts thuần TypeScript.

**Planner Việt Nam:** Goe dùng catalog published của điểm đến được chọn trên toàn Việt Nam, một điểm đến/chuyến trong 1–7 ngày; dữ liệu phải đủ giá/giờ/bữa ăn, thiếu thì báo rõ trước khi dùng lượt AI. Có bộ lọc 3 miền/8 vùng và quản lý điểm đến trong Cài đặt admin, gồm Miền Tây thuộc miền Nam. Chưa reset hoặc nhập dữ liệu toàn quốc. Xem [hướng dẫn chuẩn bị nhập theo vùng](docs/VIETNAM-PLANNER.md).

Ảnh giao diện và tài liệu được lưu trên Cloudinary trong `goease/app` và `goease/docs`, không còn binary ảnh trong checkout. Package `@goease/media` chứa URL công khai; key/secret chỉ nằm trong `server/.env` cho công cụ upload. Xem [quản lý ảnh và kiểm tra CDN](docs/CLOUDINARY-MEDIA.md); chạy `npm run media:verify` để đối chiếu lại toàn bộ bản gốc.

Đã có trang chủ sản phẩm, đăng ký/đăng nhập email-mật khẩu không phụ thuộc xác minh email, đăng xuất bằng phiên cookie và lịch trình lưu MongoDB theo tài khoản. Account dùng được ngay; email chưa xác minh vẫn được ghi nhận riêng. Google OIDC đã có nhánh tích hợp nhưng chưa kiểm thử live vì thiếu cấu hình. Có AI xếp/chỉnh lịch theo catalog của điểm đến, bản lịch tải xuống chỉ đọc offline và quản trị danh mục/giá tham khảo; booking/payment, CMS nội dung rộng hơn và native mobile chưa triển khai. Màn kỹ thuật chỉ ở `/dev/foundation` trong development. Xem [nghiệm thu sản phẩm](docs/PRODUCT-VERIFICATION.md).

Luồng Hội An: 7 gợi ý trong catalog có nguồn, thêm địa điểm vào chuyến/ngày, chỉnh lịch và ngân sách server tính theo nhóm hoặc mỗi người. Chạy `npm run db:seed` sau khi cập nhật để bổ sung catalog/metadata còn thiếu (không ghi đè bản đã chỉnh). Giá chưa xác minh giữ Chưa rõ. `/budget` là bản minh họa UI; chi phí thật mở từ tab Chi phí trong chuyến đã tạo. [Goe](docs/AI-PLANNER.md) dùng Gemini qua server khi được cấu hình, cho xem đề xuất trước khi áp dụng.

Luồng mobile giữ lựa chọn bắt đầu chuyến qua đăng nhập/đăng ký, phân biệt Goe xếp lịch với tự chọn điểm dừng và cảnh báo rõ khi dự toán chưa đủ. Trong lịch đã lưu, mở **Chuẩn bị trước khi đi** để bổ sung chỗ ở/di chuyển, kiểm tra giá/vị trí và tải [bản đọc offline](docs/OFFLINE-ITINERARY.md). Lịch đã lưu không phải xác nhận đặt dịch vụ.

**Tạo chuyến trên mobile:** chọn điểm đến → số ngày và số người (mặc định hiển thị 2 ngày/2 người) → **Lên lịch giúp mình** → xem và đổi/bỏ từng điểm → **Giữ lịch này**, chọn ngày khởi hành rồi lưu. Sở thích/ngân sách là tùy chọn; ngày cụ thể được hỏi sau khi có lịch. Goe tự xếp 1–7 ngày tại điểm đến Việt Nam có đủ catalog. Điểm đến thiếu dữ liệu giữ thông tin và cho tự chọn điểm dừng. Chưa có lưu chuyến không ngày hoặc đặt dịch vụ tự động.

Bản đồ lịch trình Hội An: mở chuyến → tab **Bản đồ** → chọn ngày/điểm dừng. Có vị trí khu vực tham khảo cho5địa điểm, nút mở chỉ đường và trạng thái thiếu tọa độ/lỗi mạng. `npm run db:seed` bổ sung vị trí còn thiếu, không ghi đè catalog đã chỉnh. Xem [nguồn tọa độ và giới hạn](docs/TRIP-MAP.md).

## Yêu cầu môi trường

| Công cụ           | Phiên bản                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Node.js           | 24 LTS; đã kiểm tra **24.15.0**, `.node-version` pin bản này; engines nhận 24.15+ trong dòng 24 |
| npm               | **11.12.1**, pin bằng `packageManager`                                                          |
| MongoDB Community | Đã kiểm tra **8.2**; service local `localhost:27017` là primary của `rs0`                       |
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

GoEase dùng MongoDB service local đang chạy ở `localhost:27017`, database riêng tên `goease`. Service này phải là replica set `rs0` có primary ghi được; không khởi tạo hay cấu hình lại instance dùng chung với các database khác. Kiểm tra service trong PowerShell bằng `Get-Service MongoDB`. Nếu service chưa chạy, khởi động theo cấu hình MongoDB đã cài trên máy; không chạy thêm một `mongod` vào cùng thư mục dữ liệu.

Tại root repo:

```powershell
# Lệnh này chỉ kiểm tra rs0/primary trên service dùng chung, không cấu hình lại MongoDB.
npm run db:init
npm run db:check
npm run db:seed
npm run dev
```

Mở [web local](http://localhost:5180). API ở [health](http://localhost:3000/api/v1/health) và [database health](http://localhost:3000/api/v1/health/db). Dùng `localhost` nhất quán với `CLIENT_ORIGIN`. Cổng 5180 được chọn vì 5173 đã có tiến trình khác trong môi trường kiểm tra; `strictPort` tránh âm thầm đổi cổng. Nút **Kiểm tra lại** lấy trạng thái mới; trang không tự polling.

`npm run dev` build media và contracts trước rồi chạy web/API song song. Nếu sửa package dùng chung, build lại package và khởi động lại dev. Vite proxy `/api` tới API trên `localhost:3000`. Web, API và MongoDB chỉ dùng localhost/loopback, không mở ra IP LAN. Khi đổi `server/.env`, khởi động lại dev để API đọc URI mới. Khi triển khai web/API khác origin, cấu hình `VITE_API_BASE_URL` là origin API và `CLIENT_ORIGIN` là origin web; đổi proxy nếu đổi cổng API local. Không dùng Vite dev server làm production server.

## MongoDB và phục hồi kết nối

`server/.env.example` có:

```dotenv
MONGODB_URI=mongodb://localhost:27017/goease?replicaSet=rs0
MONGODB_TEST_URI=mongodb://localhost:27017/goease_f0_test?replicaSet=rs0
```

`npm run db:init` hiện chỉ xác nhận `localhost:27017` đã là primary của `rs0`; không chạy `replSetInitiate` hay sửa cấu hình MongoDB dùng chung. URI chứa `replicaSet=rs0` không tự khởi tạo replica set. Bản local một thành viên không có dự phòng. Bằng chứng kiểm thử transaction của sản phẩm nằm trong các bài integration riêng, không phải lệnh init.

Trên máy phát triển hiện tại, dữ liệu `goease` từ instance cũ ở `27019` đã được sao chép sang `27017` và đối chiếu nội dung/index. Thư mục cũ `.local/mongodb` được giữ lại để phục hồi nếu cần; các lần chạy sau chỉ kết nối `27017`. Trên máy khác hoặc checkout mới, việc sao chép dữ liệu không tự diễn ra.

`npm run db:check` dùng Mongoose ghi → đọc → xóa document có marker ngẫu nhiên, chỉ trong `goease_f0_test` trên loopback. Script từ chối tên database ứng dụng, host bên ngoài, credentials, URI SRV, query khác `replicaSet` và `NODE_ENV=production`; không drop database hay xóa dữ liệu khác.

Không dừng MongoDB service dùng chung ở `27017` để thử lỗi kết nối vì các ứng dụng khác cũng dùng service này. E2E dùng instance riêng để kiểm tra tình huống mất kết nối/phục hồi. Backend thử lại sau 3 giây khi kết nối ban đầu lỗi; sau khi đã kết nối, driver Mongoose tự phục hồi khi database trở lại. API không xóa dữ liệu lúc khởi động.

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

Các override chỉ áp dụng Playwright và `tests/vite.config.mts`; không đổi cổng development hoặc config client. Port phải là số 1024–65535, khác nhau và khác cổng MongoDB. `reuseExistingServer:false` từ chối web/API test port đã bị chiếm. Test dùng Edge headless, API build thật và Vite dev server/proxy, khởi chạy MongoDB riêng trên 27020 với dbpath mới trong `.local`. Test thực sự dừng process MongoDB do chính nó tạo rồi khởi động lại, kiểm tra 503 và phục hồi trên cùng API. Không dừng MongoDB service của người dùng trên 27017. Dữ liệu E2E giữ trong `.local` để kiểm tra khi cần. Screenshot ở `test-results/`; không commit artifacts này. E2E standalone không thay bằng chứng transaction từ integration replica set.

`npm test` kiểm tra HTTP thật với dependency ping được điều khiển, request context/concurrency, stdout/stderr JSON có scanner bí mật, startup/database error và guard database test; đây không phải bằng chứng kết nối MongoDB. Bằng chứng MongoDB thật đến từ `db:check`, integration và E2E. Test lỗi mạng dùng browser fault injection và được đặt tên rõ.

`npm run build` tạo `client/dist`, `server/dist`, `packages/contracts/dist`, `packages/media/dist`. Sau build có thể chạy API bằng `npm run start --workspace @goease/server`; `npm run preview --workspace @goease/client` chỉ xem bundle (không có dev proxy, cần cấu hình public API URL hoặc reverse proxy để gọi API).

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
packages/media/            URL Cloudinary công khai, mapping legacy và manifest checksum
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
- `npm run db:seed` thêm bốn điểm đến do GoEase biên soạn (Đà Nẵng, Đà Lạt, Hà Nội, Hội An) và ba gợi ý Khám phá tại Hội An, không ghi đè record đã có. Script chỉ nhận development và database `goease` tại loopback 27017/rs0. Ảnh AI lưu local, không có giá/rating/ảnh provider trong seed.
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

Bấm avatar Trang chủ để mở Hồ sơ & bảo mật: sửa tên, URL ảnh HTTPS/xóa ảnh và đổi mật khẩu với password hiện tại. Các phiên khác được thu hồi; phiên hiện tại giữ nguyên. Google-only không có form đổi mật khẩu GoEase. Chưa hỗ trợ upload ảnh. Quên mật khẩu qua SMTP xem phần dưới. Xem [hợp đồng và giới hạn](docs/ACCOUNT-PROFILE.md).

Chia sẻ lịch trình: mở chuyến đã lưu → Thông tin chuyến đi → Chia sẻ lịch trình. Link chỉ xem, hạn 1/7/30 ngày và thu hồi; ẩn ghi chú và mọi chi phí. Xem [TRIP-SHARING](docs/TRIP-SHARING.md) cho API, quyền và giới hạn localhost.

## Quên mật khẩu qua SMTP

Đăng nhập → Quên mật khẩu → email → link15phút dùng một lần → mật khẩu mới → đăng nhập lại. Reset thu hồi tất cả phiên cũ. Điền SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM trong server/.env và khởi động lại API; ví dụ an toàn trong server/.env.example. Owner sẽ cung cấp credentials sau; hiện chưa kiểm chứng thư thật, thiếu cấu hình trả503 rõ ràng. Xem [PASSWORD-RECOVERY](docs/PASSWORD-RECOVERY.md) cho setup, API và giới hạn gửi nền.

Thùng rác: **Chuyến đi → Thùng rác → Khôi phục chuyến đi**. Giữ nguyên lịch và thực chi, link chia sẻ cũ vẫn bị thu hồi. Xem [quản lý chuyến đi](docs/TRIP-MANAGEMENT.md).

Offline: mở chuyến → **Thông tin chuyến đi → Lưu để xem offline**; mở **Bản offline** từ danh sách chuyến. Chỉ xem lịch/ghi chú/dự toán; đăng xuất xóa bản trên trình duyệt. Xem [phạm vi và triển khai offline](docs/OFFLINE-ITINERARY.md).

## Admin danh mục và dự toán tự động — 2026-10-23

Admin đăng nhập → **Quản trị** → thêm/sửa địa điểm hoặc quán ăn → lưu nháp → xem trước → xuất bản. Giá tham khảo có nguồn, ngày đối chiếu, hạn kiểm tra lại, điều kiện và số người áp dụng; AI và thao tác thêm/đổi điểm tự dùng giá đó. Server tính dự toán; chuyến cũ giữ snapshot, khách chủ động cập nhật giá hoặc nhập dự kiến riêng. Các mục chưa có giá phù hợp vẫn ghi chưa rõ.

Cấp quyền local cho tài khoản đã đăng ký: `npm run admin:access --workspace @goease/server -- grant admin@example.test`, sau đó đăng nhập lại. Không có tài khoản/mật khẩu admin mặc định. Xem [hướng dẫn admin, API và giới hạn](docs/ADMIN-CATALOG.md). Giá trong kiểm thử là dữ liệu minh họa, không phải xác minh giá cơ sở thực tế.

## Nhập địa điểm Geoapify

Admin đã có tìm/xem trước/nhập bản nháp từ Geoapify cho Hội An. Thử live 50 kết quả giữ 45 bản hợp lệ; đã tạo 41 draft sau khi bỏ 4 mục nghi trùng. Thêm GEOAPIFY_API_KEY vào server/.env (không VITE_*), restart API, mở Quản trị → Nhập địa điểm từ Geoapify. Cần biên tập trước xuất bản; giờ/giá/vị trí chưa xác minh tại cơ sở. Chi tiết [luồng, thử dữ liệu và giới hạn](docs/GEOAPIFY-IMPORT.md). Lặp thử chỉ đọc bằng `npm run geoapify:sample --workspace @goease/server`.

### FULLDICHVU API cho Goe

Đặt `AI_PROVIDER=fulldichvu`, điền `FULLDICHVU_API_KEY` trong `server/.env`, giữ `FULLDICHVU_MODEL=fulldichvu/haiku-4.5` rồi khởi động lại API. Không dùng key này cho `GEMINI_API_KEY` hoặc biến `VITE_*`. Đổi `AI_PROVIDER=gemini` để quay lại Google trực tiếp. Xem [cấu hình và phạm vi kiểm chứng](docs/AI-PLANNER.md#fulldichvu-provider--2026-10-24); Haiku đã vượt qua thử API thật cho lịch Hội An 2 và 3 ngày (khoảng 8–10 giây), giá thiếu vẫn giữ chưa rõ. Model Gemini 2.0 của bên trung gian trước đó bị cắt phản hồi nên không còn là lựa chọn mặc định.
