# GoEase — tài khoản và chuyến đi đầu tiên

Ngày nghiệm thu local: **22/10/2026**, cập nhật email/password sau F1-B. Đây là bằng chứng cho task sản phẩm hiện tại; không sửa kết quả lịch sử F0/F1-B. Chạy trên main, React/Vite/TypeScript/Tailwind + Express/Mongoose + MongoDB local. Không triển khai Atlas.

## Màn hình và cách tự nghiệm thu

| Màn             | URL local                            | Hành vi đã nối thật                                                          |
| --------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| Trang chủ       | http://localhost:5180/               | CTA tạo chuyến, tài khoản, navigation thật                                   |
| Đăng ký         | http://localhost:5180/register       | User, password identity, audit và session trong MongoDB; email chưa xác minh |
| Đăng nhập       | http://localhost:5180/login          | Cookie HttpOnly, khôi phục phiên, logout thu hồi phiên                       |
| Chuyến của tôi  | http://localhost:5180/trips          | Đọc chuyến theo owner từ session; empty/loading/error/retry                  |
| Tạo chuyến      | http://localhost:5180/trips/new      | Nhập thông tin và lịch thủ công theo ngày, tạo qua API                       |
| Mở/chỉnh chuyến | `/trips/:id` sau khi tạo             | Đọc lại server, sửa hoạt động/giờ/notes/chi phí, lưu theo revision           |
| Kỹ thuật        | http://localhost:5180/dev/foundation | Development riêng; không còn là trang chủ sản phẩm                           |

1. Chạy MongoDB rs0/dev như README; chạy `npm run db:seed` một lần để có ba điểm đến do GoEase biên soạn. Không ghi đè `.env` đang có.
2. Mở `/register` → đăng ký email thử và mật khẩu riêng ≥12 ký tự → tự đăng nhập và vào `/trips`. Reload, logout rồi login lại. Email mới giữ `emailVerifiedAt=null`; không phát challenge hoặc gọi mailbox. Không dùng tài khoản thực cho thử local.
3. Tạo chuyến, chọn điểm đến và khoảng ngày, nhập số người/ngân sách nhóm/sở thích. Thêm hoạt động vào hai ngày, nhập giờ, ghi chú, một khoản chi phí và một khoản bỏ trống. Xem tổng đã biết, bình quân và dự phòng tạm tính có nhãn khoản chưa biết.
4. Bấm **Tạo chuyến đi**, chờ **Đã lưu**; reload, mở từng ngày kiểm tra dữ liệu. Sửa/xóa/thêm hoạt động, bấm **Lưu thay đổi**. Đăng xuất rồi đăng nhập lại, mở từ danh sách; dữ liệu vẫn từ MongoDB.
5. Khi lưu mất kết nối hoặc revision conflict, có **Lưu thất bại**, giữ input. Không reload bản đang sửa nếu còn cần giữ nháp. Mở bản server ở tab khác để đối chiếu; chưa có UI merge. Nháp trước lần lưu đầu chỉ ở bộ nhớ trang và mất khi reload; không dùng localStorage.
6. Đăng nhập tài khoản B trong browser context riêng, mở URL chuyến A: không hiện form/dữ liệu riêng. API GET/PATCH đều trả 404. Không có chuyển ownership hay tự nhập bản của A vào B.

## Bằng chứng quan sát

| Lệnh                       | Kết quả                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`             | PASS, zero warnings                                                     |
| `npm run typecheck`        | PASS client/server/contracts/tools                                      |
| `npm run format:check`     | PASS (giữ nguyên gallery/notes của reference pack nhập)                 |
| `npm test`                 | PASS 8, regression F0/F1-B context/safe logging                         |
| `npm run test:integration` | PASS 17, replica set fixture thật trên 27021                            |
| `npm run test:e2e`         | PASS 4, gồm 3 regression foundation và hành trình sản phẩm              |
| `npm run db:check`         | PASS write/read/delete marker trong goease_f0_test trên local 27019/rs0 |
| `npm run db:seed`          | PASS danh mục trên local goease, additive và giữ record có sẵn          |
| `npm run build`            | PASS trong test:e2e, server TypeScript và client production bundle      |

E2E chạy với `MONGOD_BINARY` trỏ MongoDB 8.2.6 đã cài, `E2E_API_PORT=3001`, `E2E_WEB_PORT=5181`; không chiếm hoặc dừng dev 3000/5180 và MongoDB ứng dụng 27019. Test tự tạo replica set `goease_e2e`/dbpath mới trên 27020, xác minh getCmdLineOpts trước initiate; chỉ dừng child của test. Integration dùng harness F1-B riêng, chạy tuần tự và giữ fixture `.local`; không drop DB ứng dụng.

Hành trình browser đã chạy lại với chính sách hiện tại trên Edge: đăng ký tự đăng nhập khi `emailVerifiedAt=null`; hiện/ẩn password; tạo lịch hai ngày; lưu → reload → logout/relogin → mở đúng dữ liệu; lỗi mạng giữ input; context B không đọc/sửa chuyến A. E2E pass 4/4 trên API và MongoDB test riêng. Responsive screenshots/overflow check ở 390/768/1440px là bằng chứng từ các lượt kiểm tra trước.

Integration replica-set pass 18/18: hash PHC Argon2id; email mới usable nhưng `emailVerifiedAt=null` và không có verify challenge; duplicate email cùng lúc không tạo trùng; sai mật khẩu bị từ chối; pending account legacy chỉ activate sau đúng mật khẩu; suspended/deleted bị chặn; ownership, idempotency, audit rollback, logout/relogin sau connection mới, idle expiry/securityVersion và log an toàn. Mailbox UI/API và verify endpoint đã bị gỡ; password auth không bị khóa theo NODE_ENV. Email chưa xác minh không thay đổi rule linking/ownership.

Tooling E2E còn cảnh báo FORCE_COLOR/NO_COLOR và Vite test config import ports.ts theo CommonJS; không làm fail checks, không che hoặc đổi cấu hình dev chỉ để tắt cảnh báo.

## Ảnh thực tế và khác biệt có chủ đích

- [Trang chủ desktop](screenshots/product/home-desktop.png), [mobile](screenshots/product/home-mobile.png).
- [Đăng nhập desktop](screenshots/product/login-desktop.png), [mobile](screenshots/product/login-mobile.png).
- [Lịch trình desktop](screenshots/product/trip-desktop.png), [tablet](screenshots/product/trip-tablet.png), [mobile](screenshots/product/trip-mobile.png).

Áp dụng palette của concept tại `docs/design/GoEase-Concept-Pack/GoEase-Concept-Pack/`, serif Lora hỗ trợ tiếng Việt (Google Fonts, SIL OFL, license kèm trong client/public/fonts), sans hệ thống cho form. Dùng nguyên ảnh Goe gốc từ reference, chỉ hiển thị bằng CSS; không tạo mascot mới. Font được host local từ nguồn Google Fonts chính thức, không gọi dịch vụ font bên ngoài lúc dùng app.

Home dùng banner xanh và Goe; auth hai cột trên desktop; form nhóm thông tin và timeline ngày; desktop rộng có navigation trái và panel chi phí phải. Không copy khung thiết bị/gallery. Thiếu ảnh địa điểm có quyền phù hợp nên dùng bề mặt màu và tên điểm đến, không cắt ảnh Hội An demo để gắn nhãn điểm đến thật. Không dựng map giả, tab chức năng rỗng, fake avatar, hội thoại AI, đặt chỗ/thanh toán/offline-ready. Reference pack được giữ nguyên làm nguồn định hướng; PROMPTS không thành BR.

## Hợp đồng/API và dữ liệu

Prefix `/api/v1`, envelope ok/data hoặc ok/error; JSON runtime strict validation và request ID. GET `/auth/options`, `/auth/me`, `/destinations`; POST `/auth/register`, `/auth/login`, `/auth/logout`; GET `/auth/google`, `/auth/google/callback`; GET `/trips`, `/trips/:id`; POST `/trips` body `{trip}`; PATCH `/trips/:id` body `{trip,expectedRevision}`. Register/login trả session qua HttpOnly cookie. Verify-email và development mailbox không được expose. Mutation trip yêu cầu UUID `Idempotency-Key`; thay đổi dữ liệu chỉ từ Origin cấu hình + `X-GoEase-Client:web`. Web gửi credentials, giữ cookie ngoài JavaScript. Responses private không cache; logs chỉ route templates, không path ID/query/body.

Chỉ tám collections domain cần dùng + audit_logs: users, auth_identities, auth_sessions, auth_challenges, destinations, trips, trip_revisions, idempotency_keys. Snapshot revision và audit APPEND tách khỏi trip; không có TTL cho audit/history. Trip+revision+mandatory audit+idempotency key cùng transaction. Không dựng framework cho các collection tương lai.

Các mặc định kỹ thuật: session tuyệt đối 7 ngày/idle 1 ngày (configurable), email challenge 1 giờ, OAuth 10 phút, key retry TTL 24 giờ; limiter 10 lần/15 phút theo network/account và chỉ ở tiến trình hiện tại. Đây không phải policy retention/legal đã chốt. API body trip 256 KiB; max 31 ngày, 50 hoạt động/ngày, 300/chuyến, 1.000 người; VND integer, một điểm đến/giờ Việt Nam, giờ kết thúc cùng ngày sau giờ bắt đầu. Totals do server tính; không nhận owner/actor/source/timestamp từ client. Danh sách giới hạn 50, chưa phân trang.

## Phần chưa khả dụng hoặc chưa kiểm chứng

- **Google live:** chưa có `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PKCE_KEY` và redirect URI đăng ký tương ứng. UI hiện disabled đúng; API trả unavailable. Nhánh code dùng PKCE/state/nonce, binding cookie, AES-GCM verifier, Google JWKS/issuer/audience/azp/expiry verification, không lưu access/refresh token, không merge theo email. Chưa chứng minh đăng nhập với Google thật.
- **Email verification thật:** chưa có provider/flow. Tài khoản email/password vẫn usable với email chưa xác minh; không dùng email đó để merge/link hoặc cấp quyền đặc biệt. Production yêu cầu HTTPS/Secure cookie; live deployment chưa được kiểm chứng.
- Chưa có link/unlink identity, password recovery, quản lý thiết bị, logout-all UI; chưa có restore/merge lịch sử, xóa chuyến, sharing/map, discovery/AI, commerce hoặc offline cache. Không bị loại khỏi hướng sản phẩm tương lai.
- Chưa chạy kiểm thử provider live, Atlas, deployment, tải/concurrency nhiều instance hoặc audit retention/purge job. In-memory limiter cần thay thế trước khi scale nhiều API instance.

## Tinh chỉnh màn chào mừng mobile — 2026-10-22

Đã tách `/welcome` khỏi container/padding dùng chung của ứng dụng; thay các rule welcome trùng lặp bằng một bố cục hero và phần hành động. Nền Hạ Long mới được tạo bằng ImageGen theo reference của chủ sản phẩm; logo GoEase và mascot PNG trong suốt được giữ riêng. Tiêu đề nằm trên ảnh, Goe nằm ở góc phải trên mép phần hành động; lời hứa, nút và chú thích căn giữa. Không dựng thanh trạng thái điện thoại giả.

Đã quan sát trực tiếp trên Chrome ở 318×706 và 390×844: ảnh tải đủ, kích thước document bằng viewport, dòng chú thích cuối nằm trong màn hình. Đã click “Bắt đầu hành trình” đến `/`, sau đó click “Tạo chuyến đi” với khách và thấy `/login`. Typecheck, lint, format và build đạt. Ảnh browser local lưu ở `test-results/welcome-refined-318.png` và `test-results/welcome-refined-390.png` (không commit artifacts). Đây là kiểm tra UI local, chưa triển khai lên môi trường public.

## Trang chủ mobile theo reference — 2026-10-22

Trang chủ có lời chào, tìm kiếm, banner kính xanh với Goe, bộ lọc Tất cả/Thiên nhiên/Văn hóa, thẻ gợi ý Hội An và Sa Pa, cùng danh sách chuyến đi thật hoặc trạng thái khách/rỗng/lỗi. Ảnh minh họa AI lưu local tại `client/public/images/destination-hoian.png` và `destination-sapa.png`; URL được khai báo trong `client/src/components/home-discovery.tsx` để đổi sang Cloudinary sau. Thẻ gợi ý là nội dung khám phá, không phải chuyến đi của người dùng. Nếu địa điểm chưa có trong catalog API, thẻ mở form tạo chuyến để người dùng chọn địa điểm hợp lệ.

Thanh mobile có năm mục theo thứ tự Khám phá, Chuyến đi, **Trang chủ**, Goe, Đã lưu. Trang chủ ở giữa và có aria-current đúng. `/explore` hiển thị bộ lọc gợi ý; `/saved` hiển thị dấu trang lưu local theo user ID và nói rõ lưu trên trình duyệt, chưa đồng bộ server; `/goe` nêu rõ trợ lý gợi ý hành trình chưa triển khai, có CTA tạo lịch thủ công. Khách tương tác ở Trang chủ hoặc chọn mục khác trên thanh dưới được chuyển tới login. Không giả avatar người thật hoặc chuyến đi có sẵn.

Kiểm chứng: typecheck, lint, format, build đạt; đã quan sát Chrome ở 390×844 và 325×713, ảnh tải thành công, thứ tự và trạng thái thanh điều hướng đúng. Kích hoạt thẻ Hội An bằng bàn phím khi chưa đăng nhập đã tới `/login`. Ảnh browser local ở `test-results/home-redesign-390.png` và `home-redesign-325.png`. Chưa kiểm chứng bookmark qua nhiều lần đăng nhập hoặc triển khai Cloudinary/public.

## Sau đăng nhập và avatar — 2026-10-22

AUTH-09: email/password register/login và callback Google thành công về `/`; không tự chuyển tới `/trips` hoặc `/trips/new` từ query `next` hay nháp đang có. Header đọc `UserDto.avatarUrl`; tài khoản cũ thiếu field vẫn dùng được. `users.avatarUrl` nullable, kiểm tra HTTPS/độ dài/credentials ở server. Callback chỉ lấy picture từ token Google đã xác minh và giữ avatar đã có; Google live chưa kiểm chứng vì chưa cấu hình provider. Chưa có chức năng upload/chỉnh ảnh.

Avatar người du lịch được tạo bằng ImageGen, lưu `client/public/images/default-traveler-avatar.png`. Thiếu URL hoặc lỗi tải chuyển về ảnh này; ảnh không gửi referrer. Ảnh mặc định cũng dùng cho nút đăng nhập của khách.

Kiểm chứng: 9 unit/HTTP tests đạt; 3 browser tests với auth response mô phỏng đạt cho không có avatar, có avatar và avatar tải lỗi; cả ba kiểm tra login có `next=/trips/new` vẫn về Trang chủ và reload giữ Trang chủ. Đây là kiểm tra routing/ảnh ở UI, không phải login Google live. Các kiểm tra typecheck/lint/build và format được chạy cho thay đổi này.

## Khám phá và chi tiết địa điểm — 2026-10-22

Thay thế `/explore` gợi ý cũ bằng catalog MongoDB: tìm kiếm tiếng Việt không dấu, lọc Ẩm thực/Văn hóa/Thiên nhiên, danh sách/bản đồ, thẻ featured và chi tiết `/places/:id`. Giữ 5 mục điều hướng với Trang chủ ở giữa. `/saved` thêm bookmark địa điểm đồng bộ tài khoản; dấu trang điểm đến local cũ vẫn giữ riêng. Ghi chú/lưu và thêm vào trip cần session. Thêm trip dùng API trip hiện có với expectedRevision và idempotency key giữ nguyên khi retry lỗi mạng; tạo mới mở nháp cần Lưu.

API mới (cùng envelope/error/Origin/readiness hiện có):

- `GET /api/v1/places?q=&category=&offset=0&limit=20`: limit1–30, offset0–10000, q max100; trả items/hasMore; published/chưa xóa, query regex đã escape. UI hiện tải trang đầu catalog nhỏ.
- `GET /api/v1/places/:id`: public detail hoặc404.
- `GET /api/v1/me/places`: tối đa100 quan hệ đã lưu mới nhất, hydrate published/chưa xóa.
- `GET /api/v1/me/places/:id`: private state `{placeId,saved,note,revision}`; state chưa tồn tại revision0.
- `PATCH /api/v1/me/places/:id`: strict `{expectedRevision,saved?,note?}`, cần ít nhất một thay đổi, note max2000; owner từ session, conflict409, không tin client userId.

`npm run db:seed` đã chạy trên local GoEase, thêm Hội An và ba place ID cố định; seed không ghi đè dữ liệu đã có. Ba ảnh ImageGen nằm ở `client/public/images/explore-hoian.png`, `explore-rice.png`, `explore-traque.png`; đổi imageUrl trong catalog khi upload Cloudinary sau. Ảnh có nhãn AI. Nội dung/giờ gợi ý do GoEase biên tập, không gọi AI live và không cam kết giá/giờ mở cửa. Nguồn tham khảo: [UNESCO Hội An](https://whc.unesco.org/en/list/948/), [Vietnam Travel ẩm thực Hội An](https://vietnam.travel/things-to-do/explore-food-hoi-an), [Hội An Heritage Trà Quế](https://hoianworldheritage.org.vn/en/news/Traditional-occupational-Village/tra-que-vegetable-village-tourist-attraction-583.hwh). Không sao chép ảnh từ các nguồn này.

Đã kiểm tra: `server/test/explore.integration.ts` trên replica set riêng đạt: HTTP đăng ký, tìm/lọc/query không hợp lệ, owner isolation, concurrent create409, note persisted, unsave giữ note, archived404, private note không lọt public/log. Ba browser tests `tests/explore.spec.ts` với API mô phỏng đạt: responsive320/390/768 không tràn ngang, filter/map links/guest login, note reload/conflict giữ nội dung, thêm trip retry cùng payload/key và Escape đóng dialog. Đã xem Chrome thật dùng API local ở390×844 cho cả danh sách và detail, ảnh tải thành công. Bản đồ chỉ hiển thị khu vực OSM với link tìm trên Google Maps, chưa có pin tọa độ riêng/định tuyến; khả năng tải tile mạng ngoài chưa được xác nhận. Chưa deploy hoặc upload Cloudinary.

Kiểm tra cuối task: typecheck/lint/build/format và git diff --check đạt; 9 unit/HTTP tests, 1 integration MongoDB Khám phá và 6 browser tests mô phỏng (3 Khám phá + 3 login/avatar) đạt. Screenshot local: .local/explore-preview/explore-mobile-390.png và detail-mobile-390.png. Các kết quả này không phải full-suite E2E hoặc kiểm chứng provider live.

## Tạo chuyến đi và lịch trình mobile — 2026-10-22

Thay form dài bằng 3 bước: thông tin/sở thích → xếp điểm dừng theo ngày → xem lại và lưu. Các hàng điểm đến/ngày/số người/ngân sách mở dialog native có focus và Escape; áp dụng sau validation. Thay ngày hoặc điểm đến làm mất hoạt động cần xác nhận. Trang `/trips` có thẻ ảnh, thông tin thật từ tài khoản và trạng thái loading/empty/error/retry. Chi tiết có cover, chọn ngày bằng phím mũi tên, Lịch trình/Bản đồ/Chi phí, thêm/sửa/xóa và đổi thứ tự điểm dừng giữ UUID, cảnh báo giờ trùng và ghi chú chuyến đi. Thanh điều hướng vẫn 5 mục với Trang chủ ở giữa; màn tạo mới ẩn thanh dưới.

Tái sử dụng GET/POST/PATCH trips và GET places hiện có, không đổi contracts/schema hoặc quyền lưu. generationMode/source vẫn manual. Nút Gợi ý lịch trình mở danh mục GoEase cùng destination, ưu tiên hiển thị category đã chọn; người dùng tự thêm vào ngày, không gán giờ/giá hoặc tự tạo lịch AI. Catalog chưa có điểm đến tương ứng có thông báo và cho thêm thủ công. Map mở tìm điểm dừng trên Google Maps, chưa có route/ETA tự động. Chi phí là subtotal đã nhập, tách số điểm dừng chưa rõ; không coi null là miễn phí. Ảnh tái sử dụng AI local, là minh họa; không ghi ảnh/dữ liệu giả vào trip.

Bản nháp vẫn ở bộ nhớ client đến khi server commit. POST/PATCH giữ idempotency key khi retry cùng payload và expectedRevision cho trip đã lưu. Lỗi mạng/conflict giữ input. Không thêm AI provider, Cloudinary, analytics, migration hoặc thay cấu hình MongoDB.

Kiểm chứng task này: typecheck/lint/build/format và git diff --check đạt. Browser E2E dùng Express/MongoDB replica set riêng trên27020 đã tạo tài khoản, nhập wizard3 bước, tạo/sửa/reorder điểm dừng, tính chi phí thiếu, lưu lỗi mạng rồi retry, reload/relogin, stale revision409 giữ nháp và chặn tài khoản khác đọc/sửa. Không tràn ngang ở320/390/768/1440px. Đã xem ảnh chụp thật390px của create/itinerary/list trong `.local/journey-preview/` với dữ liệu kiểm thử; đã mở màn tạo mới bằng Chrome local. Chưa kiểm chứng điện thoại vật lý, AI live hoặc bản đồ tuyến đường tự động.

## Ngân sách và Goe — UI MVP, 2026-10-22

Tab Chi phí của chuyến đi dùng màn ngân sách mới: ảnh phong cảnh, tổng nhóm/người, thanh tỷ lệ, phần còn lại hoặc vượt ngân sách và biểu đồ phân nhóm. Tính từ estimatedCost đã nhập; khoản null được đếm riêng và ghi rõ tổng chưa đầy đủ. Điều chỉnh ngân sách dùng dialog hiện có; người dùng bấm Lưu thay đổi để lưu qua API trip. Không có dự toán giá bằng AI. `/budget` là bản xem trước độc lập với số liệu mẫu8.2triệu/4người/10triệu, có nhãn minh họa; chỉnh tại đây chỉ tác động bộ nhớ của bản xem trước.

`/goe` thay màn placeholder bằng UI hội thoại: ngữ cảnh chuyến đi/ngày, tin nhắn, gợi ý thay đổi, xem trước, giữ lịch cũ, hai câu hỏi nhanh và ô gửi. Nút Hỏi Goe trong lịch trình truyền trip ID và ngày; đọc bằng API có sẵn, có loading/error/retry. Các câu trả lời và thay đổi là kịch bản minh họa, hiển thị rõ chưa kết nối AI. Xác nhận chỉ đổi trạng thái bản minh họa; không ghi tin nhắn hoặc sửa itinerary trên server. Người dùng có thay đổi chưa lưu được nhắc trước khi rời lịch trình bằng nút Hỏi Goe. Thanh điều hướng vẫn có5mục, Trang chủ ở giữa.

Tái sử dụng ảnh AI local đã tạo và Goe PNG trong suốt. Không thay API/contracts/schema, không thêm provider, quota hoặc cấu hình MongoDB. Các tính năng AI hội thoại, áp dụng đề xuất thật và dự toán tự động còn chờ triển khai sau UI MVP.

Kiểm chứng UI: hai browser tests mới cho ngân sách thiếu/vượt, tỷ lệ, responsive320/390/768/1440px, gửi chat, giữ lịch, preview/Escape và xác nhận minh họa không gửi write API. Sáu browser tests Khám phá/login/avatar vẫn đạt. Đã xem ảnh chụp Edge390×844 tại `.local/mvp-preview/budget-390.png` và `goe-390.png`. E2E Express/MongoDB riêng trên27020 đạt: subtotal200.000/10triệu=2%,4khoản chưa rõ, Goe nhận đúng chuyến/ngày, xác nhận minh họa không tăng revision trip; luồng lưu/retry/reload/conflict/ownership trước đó vẫn đạt. Typecheck, lint, build, format các file thay đổi và git diff --check đạt. Format toàn repo còn cảnh báo có sẵn tại `packages/contracts/src/index.ts` (không sửa file đó trong task). Chưa kiểm chứng điện thoại vật lý, AI live hoặc deploy public.

## Luồng Hội An với dữ liệu thật — 22/10/2026

Trang chủ tạo chuyến mới từ điểm đến, không mang các điểm dừng của chuyến đã mở trước đó sang chuyến mới. Chỉnh lịch có cảnh báo trước khi rời bằng điều hướng ứng dụng khi chưa lưu. Wizard và Khám phá cùng tạo activity có placeId; chi tiết địa điểm cho chọn chuyến/ngày rồi thêm, có nút Mở chuyến đi tới đúng ngày. Dữ liệu vẫn lưu qua POST/PATCH trip có revision/idempotency; ảnh UI là minh họa AI, không phải ảnh kiểm chứng địa điểm.

Catalog local tăng từ3 lên7: Phố cổ, cơm gà, Trà Quế, An Bàng, Cẩm Thanh, cao lầu và dạo sông Hoài. Các món ăn là gợi ý, không giả thành nhà hàng cụ thể. Metadata planning có thời lượng biên tập, truy vấn bản đồ, chú thích chi phí và tùy chọn giá. Giá vé phố cổ80.000/120.000đ tham khảo [công bố của Hội An ngày16/03/2026](https://www.hoianworldheritage.org.vn/vi/news/Du-lich-Hoi-An/cap-nhat-ve-tham-quan-khu-pho-co-hoi-an-hanh-trinh-cham-ve-nguyen-ban-giua-long-di-san-3033.hwh), đối chiếu22/10/2026; nội dung địa điểm đối chiếu [Vietnam Tourism](https://vietnam.travel/node/99) và [An Bàng](https://vietnam.travel/node/965). Không gọi dữ liệu giá live. Người dùng phải chọn mức giá tham khảo trong dialog chỉnh điểm dừng; thiếu giá giữ null/Chưa rõ. Không tự điền giá lưu trú/ăn uống/di chuyển hoặc coi các khoản chưa thêm là miễn phí.

API bổ sung:

- `GET /places?destinationId=<ObjectId>`: lọc catalog đúng điểm đến, validate ID và dùng index có sẵn.
- `POST /trips/budget-preview` với `{trip: TripInput}`: yêu cầu session/Origin như trip write; validate input, tính và trả `{budget: BudgetSummary}`, không ghi dữ liệu. Client không gửi owner hay tổng tiền. Giao diện ẩn kết quả cũ khi input đổi, báo lỗi/retry khi API thất bại.
- GET/POST/PATCH trip trả thêm `budgetSummary` từ cùng hàm server. `summaryTotals` lưu trong DB vẫn giữ cấu trúc cũ nhưng hỗ trợ chi phí mỗi người. Server nhân mỗi người×travelers một lần, kiểm tra safe integer; tổng nhóm không nhân. Chia bình quân làm tròn tới đồng; ngân sách null khác0, không chia cho0.

Activity thêm placeId optional cho tương thích bản cũ. Server chặn địa điểm mới không tồn tại/archived/khác destination; giữ liên kết đã lưu khi catalog bị ẩn sau này để không làm mất lịch. Snapshot revision chứa cùng placeId và cost basis. Không thay owner boundaries, không tạo collection mới. `npm run db:seed` đã chạy trên27019/rs0: insert ID mới, chỉ bổ sung planning khi absent, giữ chỉnh sửa/status/giá đã có. Chưa deploy, chưa có tọa độ/định tuyến hoặc AI planner/chat thật.

Kiểm chứng:12 unit/HTTP tests,20 integration checks (kể cả subtests) và toàn bộ13 browser tests đạt. Unit gồm chi phí hỗn hợp nhóm/người, null/0, đổi số người, phân nhóm, bình quân và tràn số; integration HTTP/MongoDB riêng kiểm tra seed lặp không ghi đè, filter, link ID/destination/archive, server preview không ghi trip, ownership, revision và idempotency. Browser dùng API/MongoDB thật đã tạo Hội An3ngày, chọn vé80.000/người, thêm điểm ở cả3ngày, đổi4→5người thấy320.000→400.000, lưu/reload/relogin giữ chi phí, thêm cơm gà từ Khám phá vào ngày2 và mở đúng ngày; lỗi preview không báo thành công và retry phục hồi. Ảnh thực390px đã xem ở `.local/hoian-preview/budget-live-390.png`. Typecheck/lint/format toàn repo và git diff --check đạt; build đạt. API local5180 đã trả đủ7gợi ý với planning. Bộ E2E đã bỏ import helper client trộn CJS/ESM gây lỗi khi chạy toàn suite; payload test xây riêng từ contract. Không kiểm chứng provider AI/Google live hoặc điện thoại vật lý.

## Gemini planner — 2026-10-23

Implemented customer proposal/preview/apply to draft, server catalog/time validation, safe Gemini adapter, provenance/revision save checks and atomic quota/run storage. See [AI-PLANNER.md](AI-PLANNER.md) for exact scope and limits. Key configured for requested Google account/free-tier project; models endpoint returned200 and exposed the configured model. This task has not run automated tests or live generation/save acceptance; prior passing results above predate these changes. Goe chat remains a demonstration.

Build, typecheck, lint, formatting of changed implementation files and git diff --check passed. Running local API reported database connected. The real generation/provider-response and end-to-end save path still need acceptance testing; a successful models request is only credential/model availability evidence.

## Gemini live acceptance — 2026-10-23

The prior unverified-generation note is superseded by the live acceptance in [AI-PLANNER.md](AI-PLANNER.md#live-acceptance--2026-10-23). Real Gemini→preview→apply→save201→reload passed with preserved AI provenance and unknown costs. Same-key recovery, manual edit, stale revision409, forged source400, other-owner404/409 and simulated quota429 preservation also passed.14 unit/HTTP checks,20 integration checks,13 default browser checks and1 explicitly enabled live browser test passed. Tests used isolated MongoDB27020/27021; application27019 records were untouched. Build/typecheck/lint passed. One intermediate browser timeout occurred alongside a watched-contract rebuild; serial rerun passed. Do not rebuild watched packages during browser acceptance.

## Goe customer adjustment — 2026-10-23

Goe demo replaced with real Gemini selected-day proposals and explicit server apply. Scope/contracts/retention are in AI-PLANNER.md. Live test generated a3day trip, requested slower day1, inspected before/after, confirmed other days unchanged, simulated a lost apply response after commit, retried successfully without a second revision, rejected stale reapply409 and reloaded the exact saved schedule. Browser screenshots reviewed at `.local/ai-preview/goe-real-proposal.png` and `goe-saved-reloaded.png`.

Verification after implementation:14 unit/HTTP tests,20 integration checks,13 default browser tests passed; the separate LIVE_GEMINI opt-in browser test passed with real provider calls for both initial generation and Goe adjustment. Build/typecheck/lint passed. Default tests do not consume Gemini quota. No app DB reset, key committed, paid billing activation or public deployment. Conversation history is ephemeral; live weather/prices and general-purpose chat remain unavailable.

## Saved places → trip — 2026-10-23

Saved cards now open the existing place trip picker directly, retain a return path to Saved, select an owned trip/day in the same destination, and open the saved result at that day. Existing GET/PATCH trip APIs are reused with revision and idempotency; manual place snapshots retain the private note and unknown costs. Duplicate places in the selected day require confirmation. Removing a bookmark leaves the saved trip unchanged. The unrelated destination discovery block was removed from Saved.

GET /me/places adds unavailable relationships (own ID/state only, no hidden catalog content). PATCH /me/places/:id permits unsave-only for an owned unavailable relationship with expectedRevision. No collection/index migration or new endpoint. Existing list limit remains100 relationships; pagination is not implemented.

Observed verification:14 unit/HTTP tests and20 MongoDB integration checks passed;15 default browser tests passed,1 live Gemini opt-in test skipped. The real browser journey saves a note/bookmark, opens Saved at320/390/768px, adds to day2, checks persisted note and budget, dismisses a duplicate, removes the bookmark, and verifies unchanged trip revision/stops after reload. Mocked cases cover guest gating without private reads, unavailable removal and failed-add retry with identical payload/key. Integration covers archived-target privacy, owner isolation, stale409 and successful unsave. Reviewed `.local/hoian-preview/saved-live-390.png`. Initial browser runs exposed two test synchronization/selector issues, corrected before the passing rerun. Test databases isolated on27020/27021; app Mongo27019 untouched. No live Gemini call or public deployment in this task.

## Hoi An itinerary map — 2026-10-23

Implemented lazy-loaded Leaflet map in the existing trip workspace using GET /places/:id and the current day's activity order. Five catalog area coordinates have provenance; generic dishes retain unknown positions/search links. Selection opens source/directions and the existing activity editor. Consecutive known stops have a dashed order line, not a routed path or ETA. Unknown/archived stops never receive invented markers. See TRIP-MAP.md for contracts, sources and tile usage.

Final verification:15 unit/HTTP tests,20 MongoDB integration checks and16 browser tests passed;1 live Gemini opt-in test skipped. Build/typecheck/lint passed. Checks include map range/URL validation and non-destructive coordinate backfill. Live API/browser journey passed map day selection, Google Maps coordinate links,320/390/768px overflow, catalog failure/retry and tile failure fallback. Separate fixture browser test passed two numbered markers, connecting line, marker selection/editor, empty day and archived target removal. First test collection hit an imported browser module in a Node fixture; fixture was corrected and rerun. Reviewed actual OSM tile screenshot `.local/hoian-preview/trip-map-live-390.png`. Local `npm run db:seed` passed on the existing27019/rs0 catalog without database reset. No Gemini call, GPS collection, offline tiles or routing service implemented.

## Actual trip expenses — 2026-10-23

Implemented customer Chi phí → Thực chi with owner-only persisted create/edit/soft-delete, group VND totals, per-person average, remaining/over-budget and comparison against the saved known estimate. Reuses auth, budget computation, idempotency keys and business audit; adds expense routes/collection because existing endpoints only handled estimates. Details and limits: [TRIP-EXPENSES.md](TRIP-EXPENSES.md).

Observed verification:16 unit/HTTP tests,26 real MongoDB integration checks,17 browser tests passed;1 live Gemini opt-in test skipped. Typecheck, lint and whole-repo format check passed. Browser journey covers lost POST response after commit and identical-key recovery, edit, over-budget, second category, reload persistence, concurrent edit409 retaining input, cancel/confirm delete, empty state and failed-list retry. Integration covers unauthorized/cross-owner access, invalid money/date/input, pagination with full totals, concurrent writes, atomic audit failure rollback, null/zero budget and unchanged itinerary data. Reviewed actual390px screenshot at `.local/expense-preview/actual-live-390.png`;320/390/768px have no horizontal overflow.

Initial browser run could not locate the select by its label; added an explicit accessible name and reran the complete suite successfully. Worker restart after that timeout also failed its test Mongo reconnect; the final full run passed including the dependency failure/recovery test. Typecheck initially caught a test helper UUID inference mismatch; explicit string parameter types fixed it. Tests use isolated Mongo27020/27021; application Mongo27019 was not reset. No live AI/provider call, payment processing, receipt upload, account purge job or public deployment in this task.

## Customer trip management — 2026-10-23

Implemented time-based list filters/pagination, safe ordinal rescheduling, a direct save button in trip information, owner-only duplicate/soft-delete and a summary tab reusing expense/budget data. Existing GET/PATCH remain the source for editing; added only duplicate and delete operations with shared revision/audit/idempotency. See [TRIP-MANAGEMENT.md](TRIP-MANAGEMENT.md).

Observed final verification:18 unit/HTTP tests,33 real MongoDB integration checks and18 browser tests passed;1 opt-in live Gemini test skipped. Build, typecheck, lint, formatting and git diff --check passed. Date tests include overlap/leap-day/extension, occupied-tail shortening rejection, retained activity/day IDs and unchanged expense dates/totals. Integration checks owner isolation, stale revisions, concurrent clone dedupe, audit failure rollback for clone/delete, pagination/phase queries, cloning AI/unavailable-place snapshots into editable manual copies and soft-delete privacy. Browser uses real API/MongoDB to reschedule3days, retain itinerary/expenses, inspect summary, recover lost clone and delete responses with identical keys, cancel deletion, filter lists and reload. No overflow at320/390/768px. Reviewed `.local/management-preview/summary-390.png` and `list-390.png`.

Initial checks caught an incorrect minimum revision assumption (trips start at0), a test fixture that changed dates without shifting embedded day dates, and the missing save action inside trip information. Corrected and reran the full suites successfully. An initial browser timeout also caused the subsequent worker's Mongo reconnect failure; the passing final run includes dependency stop/recovery. Test Mongo27020/27021 only; app Mongo27019 untouched. No live Gemini call, public deployment, account purge, trash/restore UI or physical-phone verification in this task.

## Customer profile and password — 2026-10-23

Added /account from the Home avatar, persisted name/HTTPS avatar/null editing with revision conflict preservation, and current-password-verified changes with other-session revocation. Reuses existing auth models, Argon2id, session/Origin checks, limiter and audit. Google-only accounts cannot create a password through this endpoint. Google login no longer refills a deliberately cleared avatar. API/retry/retention details: [ACCOUNT-PROFILE.md](ACCOUNT-PROFILE.md).

Observed final verification:20 unit/HTTP checks,39 real MongoDB integration checks,19 browser tests passed;1 opt-in live Gemini test skipped. Build, typecheck, lint, whole-repo formatting and git diff --check passed. Checks cover strict/forged inputs, unsafe avatar URLs, owner isolation, stale profile revision, identical-state recovery, wrong old password, concurrent password retries, current session survival, other-session revocation, old/new login, login-versus-password-change race, Google-only behavior and atomic audit rollback. Logs/audit scanned for test names, avatar URL and passwords. Browser uses two real sessions, loses responses after profile/password commits, retries, reloads, verifies avatar fallback and retains conflict input. Reviewed `.local/account-preview/profile-390.png`; no horizontal overflow at320/390/768px.

The first full browser run hit the auth limiter because the suite shares one loopback IP. Playwright-only AUTH_MAX_ATTEMPTS is now100 (within existing configuration bounds); application default/configuration unchanged. A separate limiter unit check verifies429. An attempted200 test override was rejected by startup validation before correcting to100. The subsequent full suite passed. Tests use Mongo27020/27021; app27019 untouched. No live Google/Gemini calls, email reset, file upload/Cloudinary integration, public deployment or physical-device acceptance in this task.

## 2026-10-23 — Read-only itinerary sharing (TRIP-11/TRIP-12)

Implemented owner share creation/list/revocation and anonymous live itinerary/map view using existing trip/catalog APIs. Explicit public allowlist removes trip/activity notes, estimates/budget/actual expenses, owner/account and AI provenance. Expiry1/7/30days and10active-link cap; retries do not renew expiry; trip deletion atomically revokes links and restoring data cannot reactivate them. See [TRIP-SHARING](TRIP-SHARING.md).

Observed final checks on Windows / Node24 / local isolated MongoDB:

- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`: PASS.
- `npm test`:20 unit/HTTP PASS.
- `npm run test:integration`:44 PASS. New tests cover real persisted private notes/expense exclusion, exact allowlist, owner/guest guards, malformed requests, concurrent retry, expiry/revoke/delete/restore, active cap, current saved content, audit rollback and token/log scanning. An intermediate test-fixture expected-count mistake after adding cap coverage was corrected before this full PASS run.
- `npx playwright test` with API3011/web5191/Mongo27020:20 PASS,1liveGemini opt-in skipped. New real browser test creates a link with commit-then-network-abort/retry, opens a separate unauthenticated context, checks map/read-only UI/private-note exclusion, mobile320/390/768widths and revoke→404. Initial full browser run had one existing avatar/login test failure; unchanged full rerun PASS after build/check activity finished.
- Screenshot `.local/share-preview/shared-390.png` inspected;320/390/768screenshots retained locally, not committed. No horizontal overflow observed.

No live Gemini, external deployment, public-domain access, clipboard permission automation, email provider or map-tile availability claim. Application MongoDB27019 and existing user data left untouched. Share URLs generated on localhost are only usable on the same machine until public hosting is configured. Revocation blocks subsequent API reads; it cannot erase previously viewed/copied content. No realtime revocation push, collaborator editing or cleanup job.

## 2026-10-23 — Password recovery via SMTP adapter

AUTH-03/04/07/08 implemented: forgot/reset screens, SMTP TLS adapter, server-generated hashed15-minute single-use token, transactional password/securityVersion/session/token revocation and password.reset audit. Existing auth/session/challenge/limiter reused. Owner explicitly deferred SMTP credentials; **no real email was sent or received during acceptance**. Missing SMTP returns503 rather than delivery success. Safe placeholders in server/.env.example; local ignored server/.env has blank SMTP keys ready to fill. See [PASSWORD-RECOVERY](PASSWORD-RECOVERY.md).

Observed final checks:

- `npm run typecheck`, `npm run build`, `npm run lint`, `npm run format:check`, `git diff --check`: PASS. Nodemailer10.2.1 and types8.0.2 pinned in single npm lockfile. Install reported0vulnerabilities; this is not a full security audit.
- `npm test`:22 unit/HTTP PASS. Strict reset contracts, abuse limiter, mocked SMTP transport TLS options/fixed recipient/content/error sanitization.
- `npm run test:integration`:51 PASS on isolated Mongo27021. Injected mail sender covers eligible/unknown/Google-only/suspended responses, cooldown, issuance races, single consume under concurrent reset, expiry/pending/revoked/wrong purpose/security-version binding, all-session revocation, login old/new, provider failure, audit rollback and secret scanning of logs/audit. This is DB/API evidence with an injected mail sender, not real SMTP or inbox evidence.
- `npx playwright test` on API3011/web5191/Mongo27020:21 PASS,1liveGemini opt-in skipped. Browser tests missing SMTP503 and email preservation, explicit delivered-token DB fixture, confirmation validation, success and cleared fields, lost HTTP response after commit/retry refusal, old-session401, old-password failure and new-password login. First run caught duplicate status live regions; removed duplicate wrapper and full rerun PASS.
- Responsive320/390/768widths checked without horizontal overflow; screenshot `.local/recovery-preview/reset-390.png` inspected, local artifacts ignored.

No application Mongo27019 changes; no live email/Gemini/Google/provider deployment or public-host test. Delivery uses bounded process memory outside transactions, not durable outbox; crash can lose a pending send and requires a new request after cooldown. Account-existence responses are generic with timing floor, not a constant-time guarantee under DB load. Rate limits remain per process. Real provider validation is the remaining step after the owner configures SMTP.

## 2026-10-23 — Trip trash and restore

TRIP-09/10/11/12/13 implemented: Chuyến đi → Thùng rác, owner-scoped metadata pagination and revision-checked POST restore. Reuses trip management transactions and deletion fields; same trip/day/activity IDs and all itinerary content, estimates/budget/notes preserved. Expense documents unchanged. Existing share links remain revoked; restore revokes any legacy unrevoked link rather than restoring access. No permanent delete, automatic retention job or historical revision rollback.

Observed checks:

- npm run typecheck, npm test (22 PASS), npm run build, npm run lint, npm run format:check, git diff --check: PASS.
- npm run test:integration:52 PASS, isolated Mongo27021. Added trash auth/owner isolation, query validation/pagination, stale revision, concurrent same-key restore, audit-failure rollback (including receipt/revision), exact persisted expense/content preservation, old-link denial after restore, repeat delete/restore and stale receipt protection.
- npx playwright test:21 PASS,1 opt-in live Gemini skipped, API3011/web5191/Mongo27020. Extended management journey deletes trip with existing actual expenses, opens Trash, restores after committed response is dropped, retries same key, reloads and compares full days/expense DTOs, then restores second trip and checks empty state.
- Responsive320/390/768px no horizontal overflow. Inspected local screenshots .local/management-preview/trash-390.png and list-390.png; ignored artifacts not committed.

No application Mongo27019 changes, external provider call, production deployment or physical-device test. First typecheck caught nullable Mongoose date inference and an intermediate test-edit syntax error; both corrected before final PASS runs. No SMTP/Gemini live acceptance claimed.

## 2026-10-23 — Read-only offline itinerary

Implemented DATA-10/TRIP-01/09/12 using existing authenticated GET auth/me and GET trip APIs. Explicit download/refresh/removal in trip settings, Bản offline list entry, standalone mobile reader with savedAt and stale/offline notice. Service worker caches only3public reader files. Owner/epoch-scoped localStorage contains bounded saved itinerary/notes/estimates, no actual expenses, auth tokens or public shares. Logout clears private storage immediately across tabs, invalidates pending downloads, clears app state and prevents private views/new login while server logout is pending. Offline marker retries existing logout on reconnect. Back-forward restored SPA pages reload rather than show old in-memory state. Details/limits in OFFLINE-ITINERARY.md.

Observed final checks:

- npm run typecheck, npm run build, npm run lint, npm run format:check, git diff --check: PASS. Production dist contains sw.js/offline.html/offline.js/offline.css. No dependency, API schema or MongoDB changes.
- npm test:22 PASS. npm run test:integration:52 PASS, isolated Mongo27021; existing ownership/auth/trip/expense/sharing/recovery checks remain green.
- npx playwright test:22 PASS,1liveGemini opt-in skipped; API3011/web5191/Mongo27020. New real-browser test installs actual service worker, downloads current saved trip, preserves prior snapshot on503 refresh, updates title, checks exact cache allowlist, removes a remotely deleted trip on online revalidation, uses context.setOffline(true) then reload/new-tab navigation and reads notes/time/estimates without write controls, verifies HTML notes render only as text, checks320/390/768px, logs out offline across two tabs and reloads to empty, reconnects and observes server session null, registers another account with no inherited data, removes one download without deleting server trip, and verifies ordinary online logout clears downloads.
- Screenshot .local/offline-preview/itinerary-390.png inspected; local test artifacts ignored. First full browser run caught hard-navigation logout racing immediate login navigation; replaced with SPA state/navigation reset, added private-view gating while logout pending, then full final rerun PASS. No claim that the earlier failed run passed.

No application Mongo27019 writes, live external provider calls, public deployment, installable-PWA/manifest acceptance or physical-device test. Offline snapshots cannot learn about remote revocation/deletion until reconnect; browser storage may be evicted. Local logout is immediate, server session revocation requires connectivity. Reader source and runtime assets are identical between dev and built public files, but production hosting/HTTPS behavior has not been exercised on a public host.

## 2026-10-23 — Mobile newcomer usability repair and retest

Owner requested fixes after a nontechnical mobile walkthrough. Guest trip intent/destination now continues through email login/register; only the exact allowlisted new-trip route is honored. Labels distinguish Goe planning from manual place selection. Unsupported home destinations say they cannot yet be planned. Unknown estimates no longer appear as a zero-cost trip or reassuring remaining budget; entered costs exceeding the budget still warn even with missing prices. Food suggestions without a venue explicitly ask users to choose a restaurant. Saved trips expose preparation actions and offline download. Mobile reorder controls have larger touch targets. See AUTH-09 and the mobile usability section in BR.md.

Goe v2 prompts explicitly include existing pace caps, durations and replacement behavior when adding at the cap. Server validation remains strict and returns actionable pace/schedule errors. A failed terminal AI run no longer offers recovery of the same failed result; uncertain/network/pending outcomes retain recovery. Existing successful goe-v1 proposals remain applicable. No API input/response shape, Mongo schema/index, dependency or migration change.

Observed verification:

- Final `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`: PASS.
- Server unit tests: 23 PASS, including focused pace/time validation rejection. Mongo integration: 52 PASS on isolated Mongo27021.
- Full browser suite: 23 PASS, 1 opt-in live Gemini test skipped, API3001/web5181/Mongo27020. New mobile journey covers guest destination continuation through signup, unsupported destination, simulated terminal planner/Goe failure, retained input/manual fallback, missing costs, save/reload, preparation/offline discovery and 320/390px overflow checks. Existing real service-worker network-loss test passed. Initial runs caught outdated auth fixture shapes and UI assertions, plus a subsequent Mongo readiness failure; corrected fixtures/assertions and the full rerun passed.
- After final budget wording/layout and activity accessible-label changes, targeted browser rerun: 3 PASS (manual account/save/reload, mobile newcomer/error recovery, budget preview). No claim that the initial failed runs passed.
- Separate manual Chrome mobile walkthrough at 390×844, with visual review also at 320px, used a new synthetic local account. Started from guest home, selected Hội An, registered, resumed trip setup with Hội An retained, entered 3 days / 2 people / 6m VND / relaxed pace, generated a real Gemini plan, applied it and saved. Entered a 120k group meal estimate. The formerly failing request to add an evening walk while keeping rice meal succeeded: preview preserved the meal and moved the other stop to Phố cổ 17:30–20:30; applied and reloaded successfully. Days 2/3 remained unchanged. Added a clearly labeled test lodging estimate of 1.6m, saved, downloaded and read the offline snapshot. Both online and offline showed 1.72m known costs with 3 unknown activities, rather than claiming a complete trip total.
- Inspected local screenshots `.local/ux-mobile-retest/goe-before-after.jpg` and `.local/ux-mobile-retest/budget-mobile.jpg`. These ignored evidence files are not committed. The test trip remains in the synthetic local account for review.

Manual walkthrough used browser mobile viewport, not a physical phone or installed PWA. Network loss was exercised in automated browser tests, not in the manual Chrome session. No real booking/payment, live restaurant/hotel availability or price verification, live Google sign-in, SMTP delivery or public hosting acceptance. The small Hội An catalog can still repeat places across days; meal entries may be dishes rather than specific venues. The app helps create/edit/save a plan, but the user must still choose services and verify prices, opening hours and travel time. Local Mongo27019 was used only through ordinary app actions to create synthetic review data; existing user records and Mongo configuration were not changed.

## 2026-10-23 — Plan-first mobile creation

Replaced the three-step creation wizard with inline destination/duration/people choices, collapsed optional preferences, and one generation action. A successful server proposal opens directly as an unsaved editable timeline. Quick swap/removal/undo lets customers change individual stops; swaps exclude existing places anywhere in the trip and retain the current slot only when catalog duration fits. Keep opens a short departure/save sheet; dates shift together with stable IDs and preserved costs/notes/provenance. Existing saved-trip regeneration keeps its explicit confirmation. No API shape, server behavior, MongoDB schema/index or migration change. See BR.md “Mobile plan first” and DB-BASELINE.md “Plan-first creation contract”.

Observed checks:

- Build, typecheck, lint, whole-repo formatting and git diff --check passed. Server unit suite: 23 PASS, including existing date-shift preservation checks. No separate integration-suite rerun was needed for this client-only change; real database persistence was exercised by the browser suite.
- Full browser suite: 24 PASS, 1 opt-in live Gemini test skipped. After the last recovery-input and cross-day duplicate fixes, targeted manual journey/newcomer/quick-plan rerun: 3 PASS. Tests use isolated Mongo27020 and API3001/web5181; application service27017 is not stopped or reconfigured.
- The new deterministic quick-plan test explicitly inserts a successful-provider fixture in the isolated test DB, simulates lost proposal response, recovers with the same key, checks changed inputs hide recovery, verifies no trip exists before Save, swaps a stop while retaining time/other activities, excludes cross-day duplicates, removes/undoes, requires explicit departure, saves/reloads with real API/MongoDB and compares IDs/provenance/other-day activities. This fixture is not a live-provider claim. Responsive320/390px checks include no horizontal overflow and the primary creation action in the viewport. Manual journey also checks unsupported8-day generation, group size/preferences and save-failure retry preservation.
- Initial targeted run exposed a missing exact accessible name for the pace selector; added it. A later added duration assertion matched both group and select; the test now targets the combobox role. Final reruns passed; the earlier failures are not described as passes.
- Separate manual Chrome mobile390px walkthrough used a new synthetic account and **real Gemini** on local web5180/API3000: guest chooses Hội An → registration resumes setup → default2days/2people → one “Lên lịch giúp mình” click → six generated stops across2days, directly editable with no apply/review wizard → swap/remove/undo → choose7Nov2026 → save → reload retains7–8Nov, times and edits. Manual testing caught a swap repeating a place already on day2; fixed the filter, then swapped to Cẩm Thanh, saved and reloaded successfully. No duplicate-place claim is made for all provider-generated long itineraries.
- Screenshots inspected: `.local/quick-trip-mobile/setup-390.jpg`, `plan-390.jpg`; final saved screenshot `saved-390.jpg`. Local proof files are ignored, not committed. Synthetic review trip remains in its test account.

Scope limits: browser mobile viewport, not physical-device or installed-PWA acceptance. Automatic planning remains Hội An1–7days with a small catalog; other destinations are explicitly manual. Specific restaurants/hotels, real prices, opening hours, weather and verified routing remain incomplete. Undated drafts exist only in memory and use temporary planner date anchors; persistent trips require an explicitly chosen departure. No external booking/payment, deployment, credentials change, Mongo service change or other database mutation. App27017 received only ordinary authenticated synthetic test-account/trip writes.

## 2026-10-23 — Admin catalog and automatic reference estimates

Implemented CAT-08/09 and related AUTH-08, AI-03, TRIP-07/08 and DATA-02/03 rules. Admin can search, create drafts, preview, publish, edit and archive places/restaurants with source, conditions, applicability and review dates for reference prices. Catalog changes, audit and idempotency receipts commit together. The server attaches catalog prices after validating AI output and validates all saved reference snapshots. Customers get automatic costs on adding/swapping a place; existing trips retain their saved prices until explicit refresh or personal override. See ADMIN-CATALOG.md for access, workflows and scope.

Observed checks:

- Build, typecheck, lint, whole-repository formatting, explicit BR formatting and `git diff --check`: PASS. Unit suite: 23 PASS. Full Mongo integration suite: 61 PASS on isolated Mongo27021. Full browser suite: 25 PASS, 1 opt-in live Gemini test skipped, on API3001/web5181/Mongo27020.
- After the final functional refinements (fixed destination for existing entries, clear stale coordinates after address changes, saved-form reconciliation, offline applicability wording and budget summary placement), focused catalog integration rerun: 9 PASS; focused admin/customer, quick-plan and offline browser rerun: 3 PASS. Build/typecheck/lint/format checks passed again. The subsequent admin validation wording change only localizes error guidance.
- Integration checks cover guest/customer denial and role escalation attempts; strict input/source/date validation; concurrent same-key writes and replay conflicts; revision conflicts; transaction rollback when audit fails; immutable destination and stale coordinate clearing; deterministic AI-output validation with catalog prices; per-person/group/free/missing/expired/oversized-group arithmetic; reference forgery; preserved snapshots, manual overrides and archive behavior. Deterministic provider output is not a live Gemini claim. An initial failure exposed Mongoose internal version keys during transaction rollback; strict catalog/nested schemas now disable them, and final reruns passed.
- Browser test registers both roles, provisions only the isolated test admin, creates a draft, drops an already committed create response, retries without duplicating, previews/publishes and reloads. Mobile customer adds the published restaurant and sees an automatic 100k estimate for two people. Admin changes 50k/person to 80k/person; the saved trip retains 100k until explicit refresh to 160k. Archive hides the public place while preserving the trip. Responsive320/390px checks find no horizontal overflow. Initial locator failures were corrected before passing runs.
- Separate manual Chrome390×844 walkthrough on local web5180/API3000 used two synthetic accounts registered through the UI. The local operator command granted the test admin. Admin created a clearly labeled fictitious restaurant, entered a test reference of 65k/person with source/conditions, saved a draft, previewed and published it. Customer used the home-to-registration-to-plan flow with real Gemini, swapped one meal for that restaurant, selected7–8Nov2026, saved and reloaded. The budget showed130k known cost for2people,5unknown activities and explicit accommodation/transport gaps. Live AI generated the itinerary; the priced restaurant was chosen through the customer's swap action, not selected by the live model. Earlier manual attempts were interrupted by development rebuilds; the final save/reload completed.
- The last manual archive confirmation encountered a browser-control timeout, so manual completion of that click is not claimed. Cleanup then used the authenticated catalog API: the synthetic restaurant is archived and its public read returns404. A fresh customer API read plus the server budget calculation confirms the saved trip still has65k/person,130k known total and5unknown activities. The temporary admin role was revoked with the local operator command. An initial cleanup read used the wrong response nesting; corrected to `data.trip` before the final successful verification. No real catalog entries were edited.
- Inspected proof screenshots: `.local/catalog-review/manual-admin-390.png` and `.local/catalog-review/manual-customer-390.png`. Automated captures: `.local/catalog-review/admin-390.png` and `.local/catalog-review/customer-390.png`. These local artifacts are ignored. The synthetic saved customer trip remains for review; the fictitious restaurant is no longer public.

Limits: prices in tests are explicitly fictitious; no real menu/source/availability validation or market-price research was performed. Existing seeded entries stay unpriced until admin supplies verified reference data. Reference estimates are not booking quotes or a complete travel budget. Mobile viewport testing does not establish physical-phone or installed-PWA acceptance. No production deployment, payment/booking, Google sign-in or SMTP acceptance is claimed. The existing Mongo27017/rs0 service and other databases were preserved; local app writes were confined to synthetic review accounts/catalog/trip data and audited role changes. No new collection, dependency or data migration was required.

## 2026-10-23 — Dedicated desktop administration

Owner clarified admin is an operator, not a traveler. Admin now renders a separate desktop sidebar/workspace, logs in directly to `/admin` ahead of customer return intents, and returns there after direct customer-route navigation or restored sessions. No customer navigation, onboarding or profile page appears in an authenticated admin workspace. Logout remains available. Customer mobile UI and server authorization contracts are unchanged; no schema/migration change.

Observed: typecheck and lint PASS; focused real-browser admin-to-customer journey PASS at admin1440px and customer320/390px, including login redirect, direct `/trips/new` redirect, reload, publish, price update, customer preserved/refresh estimates and archive. Screenshot `.local/catalog-review/admin-desktop.png` visually inspected. This rerun uses isolated test Mongo27020; no live role provisioning or production change. See ADMIN-CATALOG.md for updated operation.
