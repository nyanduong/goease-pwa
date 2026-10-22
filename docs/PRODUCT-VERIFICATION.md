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
