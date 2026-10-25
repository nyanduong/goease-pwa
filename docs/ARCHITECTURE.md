# GoEase — kiến trúc v0.2

CAT-19: sau toggle UI gọi POST /admin/v3/province-imports riêng. Server tái kiểm admin/tỉnh bật, dùng phạm vi đã cấu hình hoặc provinceGeocoder (Geoapify fixed origin, quota, bounded response) trước transaction tạo campaign/run/audit. Snapshot thêm areaLabel/areaSource; một lần thu thập không sửa settings/lịch. Worker nhập draft và bulk publication hiện có được tái sử dụng. Xem PROVINCE-IMPORT.md.

CAT-18: startup bootstrap danh mục tỉnh/thành có phiên bản sau initialize model/index/audit và trước ready/worker. GET chỉ đọc. Bootstrap giữ ID/trạng thái, danh mục không lấy trực tiếp từ mạng lúc chạy. tourismAreas là mảng tên hữu hạn; POI/trip dùng destinationId hiện có. Admin PATCH chỉ enabled/expectedRevision; customer đọc tỉnh đang bật. Xem PROVINCE-CATALOG.md.

## Catalog operations runtime — 23/10/2026

CAT-11–13: module explore thêm catalog-operations +3model có consumer thật. Express index khởi worker sau initialize; poll5s nhận lịch/lượt MongoDB, heartbeat20s/lease120s. Provider chạy ngoài transaction; catalog/review/result/audit cùng transaction ghi vào run có token còn hạn. Transaction write conflict ngăn stale worker; không dựa riêng vào kiểm token trước fetch. Một active run Hội An và source unique index chống tác dụng trùng. Quota chia sẻ với preview thủ công trong singleton schedule. Không Redis/queue package mới. Shutdown chờ worker trong deadline hiện có; khi force-kill, worker mới nhận lại lease hết hạn. Không cần trang admin mở hoặc phiên cấu hình còn sống. Tách snapshot nguồn khỏi nội dung biên tập; không có đường worker xuất bản hay sửa trip. Xem ADMIN-CATALOG.md và DB runtime ở cuối DB-BASELINE.md. Mô tả adapter không scheduler ở mục lịch sử phía dưới đã được mở rộng bằng runtime này.

**Trạng thái:** Stack đã chốt; nền tảng F0 đã được triển khai ngày 22/10/2026. Xem README và docs/F0-VERIFICATION.md để biết cách chạy và bằng chứng kiểm tra. Baseline thiết kế v0.2 đã được chủ dự án chấp thuận; policy đánh dấu đề xuất/cần duyệt vẫn còn mở. F1-B context/log/audit probe đã triển khai và kiểm chứng local; Tài khoản local và manual trip đã triển khai theo ưu tiên sản phẩm sau F1-B; xem [nghiệm thu](PRODUCT-VERIFICATION.md). Các phần CORE khác chưa triển khai. Xem [F1-B verification](F1-B-VERIFICATION.md). Nguồn nghiệp vụ là [BR](BR.md), field/index là [DB-BASELINE](DB-BASELINE.md), truy vết là [DATA-TRACEABILITY](DATA-TRACEABILITY.md), review/gates là [F1-HANDOFF](F1-HANDOFF.md).

## 1. Ranh giới hệ thống

Runtime Việt Nam 24/10/2026: taxonomy 3 miền/8 vùng ở contracts/geography, destinations.tourismRegion nullable cho legacy và miền tính từ taxonomy. destination-catalog dùng lại model Destination/IdempotencyKey và business audit; admin mới có CRUD destination, không tạo service/collection địa lý riêng. Planner/provider prompt dùng destination từ server, catalog published cùng ID và không có whitelist Hội An. Consumer web lọc miền/vùng, nhập theo destination và nhận lỗi coverage trước quota. Source import vẫn theo vùng tròn cấu hình riêng, chưa có polygon/nhập cả miền. Xem [phạm vi và kiểm chứng](VIETNAM-PLANNER.md).

Một web React gọi một Express API. Express thực thi nghiệp vụ, xác thực/phân quyền, truy cập MongoDB và kết nối nhà cung cấp bên ngoài. Mobile tương lai gọi cùng API.

Ảnh tĩnh từ 24/10/2026 dùng Cloudinary: `packages/media` là package thuần TypeScript chứa URL công khai, được web và API sử dụng; không phụ thuộc React/Mongoose hoặc cấu hình riêng tư. Công cụ upload nằm trong server/scripts, chỉ đọc secret phía server và giới hạn đích `goease/`. Bản gốc/checksum trong manifest; binary ảnh không còn trong checkout. DTO catalog dịch đúng các đường dẫn local cũ sang CDN để dữ liệu/lịch sử đã lưu tiếp tục đọc được. Xem [Cloudinary media](CLOUDINARY-MEDIA.md).

Backend ban đầu là một ứng dụng có các module theo nghiệp vụ. Chỉ thêm dịch vụ triển khai độc lập khi có nhu cầu vận hành cụ thể.

| Phần             | Trách nhiệm                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Web PWA          | Màn hình, nhập liệu, hiển thị, trạng thái tương tác và gọi API                   |
| Express API      | Kiểm tra dữ liệu, quyền, nghiệp vụ, orchestration nhà cung cấp và persistence    |
| MongoDB/Mongoose | Schema, index, dữ liệu lưu trữ và các thao tác atomic/transaction phù hợp        |
| Contracts        | Kiểu request/response và validation dùng chung, độc lập với nền tảng             |
| Nhà cung cấp     | Dữ liệu địa điểm, AI hoặc thanh toán theo phạm vi được chốt                      |
| Mobile tương lai | UI/navigation/lưu trữ thiết bị riêng; dùng chung API và phần logic thuần phù hợp |

## 2. Cấu trúc đề xuất

Giữ các tên đơn giản đã trao đổi. Dùng npm workspace với một package-lock.json ở root theo yêu cầu mới nhất của chủ dự án. Chạy development bằng npm run dev, web/API sử dụng localhost.

| Đường dẫn dự kiến   | Nội dung                                                        |
| ------------------- | --------------------------------------------------------------- |
| client/             | React + Vite + TypeScript + Tailwind                            |
| server/             | Express + TypeScript + Mongoose                                 |
| packages/contracts/ | Request/response types và runtime schema thực sự cần dùng chung |
| docs/               | BR và kiến trúc                                                 |
| AGENTS.md           | Quy ước làm việc cho coding agent                               |

Chưa tạo thư mục mobile hoặc package UI đa nền tảng. Trong server, thêm module như trips, planner, auth khi triển khai tính năng tương ứng; mỗi module có route/controller, service và model khi cần. Không tạo hàng loạt thư mục rỗng cho tính năng chưa được xác định.

## 3. API và domain

- F0 đã có prefix /api/v1, health/database health và envelope ok/data hoặc ok/error; request/response có kiểu dữ liệu và validation. Auth/trip endpoints đã có trong task sản phẩm sau F1-B; xem phạm vi thực thi và hạn chế trong PRODUCT-VERIFICATION.md.
- Chuẩn hóa ID dạng chuỗi; thời điểm hệ thống dùng ISO 8601; ngày du lịch cần mô hình ngày và múi giờ rõ để tránh lệch ngày.
- Validation lúc chạy là bắt buộc ở ranh giới API. TypeScript không thay thế việc kiểm tra dữ liệu nhận từ mạng.
- Services thực hiện quy tắc nghiệp vụ; controllers xử lý HTTP. Mongoose model ở server và được ánh xạ sang DTO trước khi trả về client.
- Danh sách có phân trang theo nhu cầu; tạo index theo truy vấn thật. Không đoán năng lực chịu tải chỉ từ lựa chọn framework.
- Thiết kế cách đọc/cập nhật trip có ownership và version khi tính năng đó bắt đầu. API không lấy client-supplied ownerId làm bằng chứng quyền truy cập.
- Tài liệu API có thể bắt đầu bằng mô tả request/response cạnh tính năng; bổ sung OpenAPI theo endpoint thật, tránh bộ spec lớn nhưng không khớp implementation.

## 4. MongoDB local trước, Atlas sau

Kết nối được cấu hình bằng MONGODB_URI tại server. Có hướng dẫn khởi tạo, kiểm tra kết nối và dừng dịch vụ rõ ràng.

F0 ban đầu dùng single-node rs0 trên loopback 127.0.0.1:27019. Theo yêu cầu chủ dự án ngày 23/10/2026, runtime local dùng MongoDB service `localhost:27017` đã có sẵn primary `rs0`, với database riêng `goease`; dữ liệu GoEase từ instance cũ được sao chép sang. Không reconfigure hoặc dừng service dùng chung. Kiểm thử transaction nhiều document của F1 có bằng chứng riêng, chưa được nghiệm thu ở F0. Replica set một thành viên dùng cho phát triển không cung cấp dự phòng như một triển khai production. Cấu hình URI có tên replica set không tự khởi tạo replica set.

F0 dùng MongoDB cài sẵn, không cần Docker Compose. Theo README để chạy localhost, không mở IP LAN hay reconfigure replica set đang hoạt động. Nếu cần truy cập database từ điện thoại, điện thoại chỉ gọi API; không mở MongoDB trực tiếp cho frontend.

Trip có thể nhúng days/activities khi chúng thường được đọc và cập nhật cùng nhau, với giới hạn kích thước phù hợp. Dữ liệu tăng không giới hạn hoặc có vòng đời độc lập cần tách theo access pattern.

Khi chuyển Atlas:

1. Hoàn thành và xác minh bản local.
2. Tạo database user, cấu hình truy cập và secret tại nơi triển khai.
3. Chọn dừng ghi trong cửa sổ chuyển dữ liệu cho bản nhỏ; backup và import dữ liệu nếu cần giữ.
4. Đổi URI, kiểm tra dữ liệu/index và chạy lại luồng bàn giao.
5. Lưu hướng dẫn khôi phục; không coi đổi URI là đã chuyển dữ liệu.

Nguồn: [MongoDB data modeling](https://www.mongodb.com/docs/manual/data-modeling/best-practices/), [transactions](https://www.mongodb.com/docs/manual/core/transactions/), [local replica-set conversion](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/), [migration to Atlas](https://www.mongodb.com/docs/atlas/import/mongorestore/).

## 5. Chuẩn bị cho mobile

Có thể dùng lại API, dữ liệu tài khoản, contracts, các hàm TypeScript thuần và API client được viết độc lập với trình duyệt. React Native/Expo là hướng có thể đánh giá khi bắt đầu ứng dụng mobile.

Màn hình React DOM + Tailwind không tự chuyển thành UI native. Navigation, storage, OAuth redirect, quyền thiết bị và hành vi offline cần thiết kế theo nền tảng. Không để packages/contracts phụ thuộc window, localStorage, React hoặc Mongoose.

Google và email/password đã được xác nhận. Identity tách user, Google dùng issuer/sub đã verify, không merge chỉ vì trùng email. Chọn cơ chế session và thông số theo BR đăng nhập/mô hình triển khai; baseline đề xuất opaque session HttpOnly, chưa phải implementation. Không ép dùng JWT chỉ vì có kế hoạch mobile. Web cần xử lý cookie/CSRF phù hợp nếu dùng session cookie; native cần cơ chế xác thực và lưu thông tin phiên phù hợp khi được triển khai.

Nguồn: [React Native components](https://reactnative.dev/docs/intro-react-native-components), [Expo workspaces](https://docs.expo.dev/guides/monorepos/).

## 6. Dữ liệu bên ngoài, tiền và PWA

- Đặt API key và thao tác gọi nhà cung cấp cần secret tại server. Các biến VITE_* là dữ liệu có thể xuất hiện trong bundle web; chỉ dùng cho cấu hình công khai.
- Tách adapter của nhà cung cấp khỏi nghiệp vụ planner. Bắt đầu với một adapter cần thiết; validation kiểm tra đầu ra trước khi lưu.
- Dữ liệu địa điểm được lưu phải có nguồn rõ ràng và tuân theo quyền lưu trữ/sử dụng của nhà cung cấp.
- Khi triển khai commerce, tách order/payment/quyền sử dụng khỏi itinerary. Lưu giá tại thời điểm mua; xác minh webhook và xử lý lặp an toàn theo nhà cung cấp đã chọn.
- Số tiền có đơn vị tiền tệ và biểu diễn chính xác. Với VND nguyên, kiểm tra số nguyên trong miền an toàn; nếu cần số thập phân, chọn biểu diễn và quy tắc làm tròn rõ ràng.
- PWA bản đầu đề xuất có manifest/icons, giao diện trên điện thoại và offline fallback. Việc cache itinerary riêng tư, đồng bộ khi offline hoặc push là yêu cầu riêng cần thiết kế và kiểm thử. Không cache mặc định response auth/payment hoặc dữ liệu cá nhân vào cache dùng chung.

Nguồn: [Vite environment variables](https://vite.dev/guide/env-and-mode), [Express production security](https://expressjs.com/en/advanced/best-practice-security/), [MongoDB monetary data](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/), [PWA offline operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## 7. Task F0 — bootstrap có thể kiểm tra được

**Mục tiêu:** Một checkout sạch có thể cài đặt, chạy web + API, kết nối MongoDB local và build theo hướng dẫn tái lập được.

**Phạm vi:**

1. Kiểm tra runtime/môi trường; chọn bộ phiên bản tương thích, ghi Node version và package manager.
2. Dựng npm workspace cho client, server và contracts tối thiểu; bật TypeScript strict.
3. Dựng React/Vite/Tailwind với một màn hình nền có responsive cơ bản.
4. Dựng Express với validation cấu hình môi trường, error handling và endpoint /api/v1/health.
5. Thiết lập kết nối Mongoose local; health/readiness phải phân biệt được API đang chạy và database có truy cập được hay không. Không trả chi tiết nội bộ nhạy cảm.
6. Thêm hướng dẫn khởi tạo MongoDB và script kiểm chứng write/read/delete chỉ trong database kiểm tra riêng. Script phải từ chối chạy trên database production hoặc database ứng dụng thật.
7. Thêm .env.example, .gitignore phù hợp, scripts dev/build/typecheck/lint và CI chạy các kiểm tra tĩnh/build có thể tái lập bằng lockfile.
8. Cập nhật README với các lệnh đã chạy thật, môi trường và kết quả.

**Nghiệm thu F0:**

- Cài đặt từ lockfile trên checkout sạch được.
- Web gọi API thật và hiển thị kết quả; không hard-code tình trạng database.
- Dừng MongoDB thì trạng thái lỗi phản ánh đúng; chạy lại thì kết nối được theo cách đã mô tả.
- Script smoke kiểm chứng ghi/đọc/xóa thành công trong database kiểm tra riêng.
- Build, typecheck, lint đạt; CI được cấu hình, và phải nói rõ nếu chưa quan sát được kết quả chạy trên GitHub.
- Không đưa credential hoặc dữ liệu MongoDB vào git.
- Màn hình kỹ thuật của F0 không mặc nhiên trở thành trang chủ sản phẩm.

Không cần đợi Q-02/Q-04 trong BR để hoàn thành nền tảng này. Việc triển khai auth, planner, booking và payment phụ thuộc các quyết định nghiệp vụ tương ứng.

## 8. F0 hiện có và F1/CORE dự kiến

F0 thực có một client health, Express health routes/error handler/config validation, Mongoose lifecycle/retry/ping, npm workspace/contracts Zod, dev/build/check scripts và CI. F1-B đã thêm request context/logger và audit service test-only; source hiện chưa có auth/session, trip CRUD, migration runner, provider hay PWA offline/service worker. F0 E2E khởi động mongod standalone test trên 27020; không chứng minh transaction trên rs0.

[F1-HANDOFF](F1-HANDOFF.md) chốt bước nhỏ: F1-B context/log/audit tối thiểu → F1-C identity/auth → CORE-1 owner trip persistence manual. Chỉ thêm module route/service/model khi có consumer. Audit trực tiếp trong transaction đủ cho slice đầu; outbox chỉ khi delivery thật cần retry, migration runner chỉ khi có migration cụ thể. Không tạo framework nội bộ hoặc toàn bộ 40 collections.

Trip embeds days/activities có giới hạn; revisions và audit riêng. Mutation/revision/audit/idempotency completion cần session transaction chung, actor từ server, expectedRevision chống lost update. schemaVersion khác revision. Tên/field/index chuẩn ở DB baseline; registry là mirror không executable. Lịch sử phục hồi không được bật lại quyền/share đã revoke. Retention/purge đề xuất phải xét cả dữ liệu dẫn xuất và backup trước khi bật job.

Commerce giữ order/payment/booking/entitlement độc lập itinerary. Các gate provider, state/required theo loại, tiền, hủy/hoàn và retention nằm trong BR/handoff; không chặn context/auth/trip độc lập. Chưa thu optional analytics chỉ vì đã có schema.

## 9. F1-B đã triển khai

`observability/context.ts` dùng AsyncLocalStorage cho tracing UUIDv4, không authentication. Middleware chạy trước CORS/JSON; response header nối với access log. `observability/logger.ts` dùng Zod sẵn có và stdout sink mỏng; enum/field allowlist, không serialize req/res/Error hay raw URL. Technical sink failure bị chặn, không thay thế audit bắt buộc.

`features/audit` chỉ model audit_logs và append/read service. Không được import/khởi tạo trong app startup; action system.audit_probe chỉ có trong database test trên loopback 27021. Actor/source/time gán từ code backend; trường caller không có actor/source/retention tùy ý. APPEND không updatedAt/deletedAt/versionKey, không update/delete API. Index tạo explicit, additive trong test, không autoIndex/syncIndexes.

Mongoose Connection.transaction dùng session caller xuyên suốt fixture/audit. Audit failure propagate; dedupe outside transaction xử lý đúng E11000 keyPattern rồi so nội dung. Race làm transaction abort được báo AuditTransactionRaceError, caller chỉ retry toàn callback sau abort với cùng operationId; không fallback ngoài session. Chi tiết canonical payload và giới hạn ở DB/traceability, bằng chứng thật ở F1-B-VERIFICATION. Chưa cấu hình DB privileges production hay retention/purge.

## Implemented Gemini adapter (2026-10-23)

`features/ai/gemini.ts` isolates the fixed-origin REST provider; `planner.ts` owns catalog constraints, output validation, run/idempotency/quota state. Shared contracts expose only planner request/proposal DTOs. No provider key/model implementation is imported by React. Generation does not write trips; explicit customer apply uses existing revision-checked save and server provenance checks. See [AI-PLANNER.md](AI-PLANNER.md) for scope and open production requirements.

### Goe adjustment consumer

GoeChat now consumes owned trip read plus goe-proposal/goe-apply endpoints. plannerService reuses Gemini/quota, merges one day while preserving other days and retained data, and resolves the stored validated proposal on apply. No separate chat service, external tool execution, weather lookup or chat persistence introduced.

## Password recovery SMTP slice (2026-10-23)

Auth feature reuses existing users/identities/sessions/challenges and audit. Nodemailer is a server-only adapter; pending delivery is bounded in memory outside retriable DB transactions, while DB stores only hashed token and delivery state. No provider key in client, no public mailbox, no durable outbox. See [PASSWORD-RECOVERY](PASSWORD-RECOVERY.md) for contract and explicitly deferred live-mail verification.

Trip trash dùng GET /trips/trash và POST /trips/:id/restore trong module trips hiện có. Restore tái sử dụng transaction quản lý trip/revision/audit/idempotency, không sao chép expense, không mở lại share. Không thêm dịch vụ hoặc collection.

Offline chỉ xem: service worker cache public standalone reader và fallback navigation, không cache API/SPA bundle. Private bounded snapshots trong localStorage theo owner/epoch, lấy GET trip hiện có; không mutation queue. Logout local immediate + server retry marker khi offline. Runtime và hosting: OFFLINE-ITINERARY.md.

## Geoapify import adapter — 2026-10-23

**Cập nhật hiện hành:** đoạn bên dưới ghi slice lịch sử. Admin V3 (24/10/2026) tái sử dụng worker MongoDB catalog-operations, thêm campaign/policy đóng băng và bulk item bền vững, không dựng engine thứ hai. `places` là bản công khai, `catalog_versions` giữ đề xuất. `catalog-query.ts` dùng chung predicate list/count/map/bulk; `catalog-overview.ts` aggregate toàn scope. Chi tiết tại [ADMIN-OPERATIONS-V3](ADMIN-OPERATIONS-V3.md).

Existing explore feature adds a fixed-origin server adapter and admin import service. UI sends group/limit then preview ID + selected source IDs; normalized data stays server-owned. Import transaction reuses places/audit_logs/idempotency_keys; no provider call inside retriable transaction. Preview and search caps are bounded per process; no scheduler/worker/new collection. OSM canonical source identity has an additive partial unique index. Customer paths continue to consume only published catalog. See [GEOAPIFY-IMPORT](GEOAPIFY-IMPORT.md) for trial, contracts, metadata, rate limits and explicit unverified scope.

## Tự phục hồi kết nối giao diện — 24/10/2026

`useAutomaticRetry` chỉ được nối vào các lượt đọc lỗi: phiên ban đầu, danh mục điểm đến, danh sách chuyến, mở chi tiết chuyến và tải hồ sơ. Chờ 2/4/8/16/30 giây (cap30), không request chồng nhau; offline/tab ẩn tạm dừng, online/focus/visibility trở lại thử ngay. Dừng/reset backoff sau thành công, cleanup timer/listener theo trạng thái/unmount. Không polling dữ liệu đã tải, không reload trang, không phát lại lưu/profile/password/upload/AI. Hoàn tất đăng xuất offline vẫn dùng hàng đợi đăng xuất đã được người dùng yêu cầu trước đó. Chi tiết chuyến chỉ retry lỗi mạng/5xx/408/429 khi còn phiên hợp lệ, không lặp 401/403/404 hoặc ghi đè bản nháp đang sửa. Các module khác giữ retry hiện có; chưa áp dụng tự động cho toàn bộ admin hoặc provider.

## CAT-20 Wikimedia photo observations

Place image worker starts/stops with API; fixed Commons adapter with timeout/body limits and allowlisted media hosts. Atomic lease + revision fence writes bounded places.imageSearch independently from editorial images. Shared publish schema gates approved cover across single/review/bulk paths. Candidates are admin-only; public DTO emits approved real photos with attribution or neutral placeholder. No collection or storage service added. See WIKIMEDIA-PHOTOS.md.
