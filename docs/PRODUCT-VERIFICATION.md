# GoEase — tài khoản và chuyến đi đầu tiên

Ngày nghiệm thu local: **22/10/2026**, sau F1-B `d8c8949`. Đây là bằng chứng cho task sản phẩm hiện tại; không sửa kết quả lịch sử F0/F1-B. Chạy trên main, React/Vite/TypeScript/Tailwind + Express/Mongoose + MongoDB local. Không triển khai Atlas.

## Màn hình và cách tự nghiệm thu

| Màn             | URL local                            | Hành vi đã nối thật                                                |
| --------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Trang chủ       | http://localhost:5180/               | CTA tạo chuyến, tài khoản, navigation thật                         |
| Đăng ký         | http://localhost:5180/register       | User pending, mật khẩu Argon2id, challenge và audit trong MongoDB  |
| Xác minh local  | http://localhost:5180/dev/mailbox    | Chọn đúng email → mở thư → bấm xác minh; không gửi email thật      |
| Đăng nhập       | http://localhost:5180/login          | Cookie HttpOnly, khôi phục phiên, logout thu hồi phiên             |
| Chuyến của tôi  | http://localhost:5180/trips          | Đọc chuyến theo owner từ session; empty/loading/error/retry        |
| Tạo chuyến      | http://localhost:5180/trips/new      | Nhập thông tin và lịch thủ công theo ngày, tạo qua API             |
| Mở/chỉnh chuyến | `/trips/:id` sau khi tạo             | Đọc lại server, sửa hoạt động/giờ/notes/chi phí, lưu theo revision |
| Kỹ thuật        | http://localhost:5180/dev/foundation | Development riêng; không còn là trang chủ sản phẩm                 |

1. Chạy MongoDB rs0/dev như README; chạy `npm run db:seed` một lần để có ba điểm đến do GoEase biên soạn. Không ghi đè `.env` đang có.
2. Mở trang chủ → đăng ký bằng email thử, mật khẩu riêng ≥12 ký tự → hộp thư phát triển → xác minh → đăng nhập. Chưa xác minh thì login bị từ chối. Không dùng tài khoản thực cho thử local.
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

Hành trình browser đã xác minh: đăng ký/xác minh/login thật; hiện/ẩn password; tạo lịch hai ngày; thêm/sửa/xóa hoạt động; lưu → reload → logout/relogin → mở đúng dữ liệu; lỗi mạng khi tạo và revision conflict khi sửa giữ input. Context B có phiên riêng không mở hoặc PATCH được chuyến A. Kiểm tra overflow trên lịch trình ở **390, 768, 1440px**; home/login cũng đã kiểm tra ba kích thước này. Screenshots là ảnh render thực, dùng tài khoản và dữ liệu test, không phải mockup reference.

Integration xác minh thêm: hash PHC Argon2id; token xác minh không tái sử dụng; idempotency retry chỉ tạo một trip/revision/audit; forged owner/role và input sai bị từ chối; concurrent save một thành công/một conflict; lỗi insert audit thật rollback trip/revision/key; một connection API mới đọc lại được trip; logout/idle expiry/securityVersion từ chối phiên; log/audit không có email/password/notes sentinel. Production guard đã kiểm tra mailbox HTTP 404, password login 503 và không chấp nhận phiên password verified bằng development mailbox.

Tooling E2E còn cảnh báo FORCE_COLOR/NO_COLOR và Vite test config import ports.ts theo CommonJS; không làm fail checks, không che hoặc đổi cấu hình dev chỉ để tắt cảnh báo.

## Ảnh thực tế và khác biệt có chủ đích

- [Trang chủ desktop](screenshots/product/home-desktop.png), [mobile](screenshots/product/home-mobile.png).
- [Đăng nhập desktop](screenshots/product/login-desktop.png), [mobile](screenshots/product/login-mobile.png).
- [Lịch trình desktop](screenshots/product/trip-desktop.png), [tablet](screenshots/product/trip-tablet.png), [mobile](screenshots/product/trip-mobile.png).

Áp dụng palette của concept tại `docs/design/GoEase-Concept-Pack/GoEase-Concept-Pack/`, serif Lora hỗ trợ tiếng Việt (Google Fonts, SIL OFL, license kèm trong client/public/fonts), sans hệ thống cho form. Dùng nguyên ảnh Goe gốc từ reference, chỉ hiển thị bằng CSS; không tạo mascot mới. Font được host local từ nguồn Google Fonts chính thức, không gọi dịch vụ font bên ngoài lúc dùng app.

Home dùng banner xanh và Goe; auth hai cột trên desktop; form nhóm thông tin và timeline ngày; desktop rộng có navigation trái và panel chi phí phải. Không copy khung thiết bị/gallery. Thiếu ảnh địa điểm có quyền phù hợp nên dùng bề mặt màu và tên điểm đến, không cắt ảnh Hội An demo để gắn nhãn điểm đến thật. Không dựng map giả, tab chức năng rỗng, fake avatar, hội thoại AI, đặt chỗ/thanh toán/offline-ready. Reference pack được giữ nguyên làm nguồn định hướng; PROMPTS không thành BR.

## Hợp đồng/API và dữ liệu

Prefix `/api/v1`, envelope ok/data hoặc ok/error; JSON runtime strict validation và request ID. GET `/auth/options`, `/auth/me`, `/destinations`; POST `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/logout`; GET `/auth/google`, `/auth/google/callback`; GET `/trips`, `/trips/:id`; POST `/trips` body `{trip}`; PATCH `/trips/:id` body `{trip,expectedRevision}`. Mutation trip yêu cầu UUID `Idempotency-Key`; thay đổi dữ liệu chỉ từ Origin cấu hình + `X-GoEase-Client:web`. Web gửi credentials, giữ cookie ngoài JavaScript. Responses private không cache; logs chỉ route templates, không path ID/query/body.

Chỉ tám collections domain cần dùng + audit_logs: users, auth_identities, auth_sessions, auth_challenges, destinations, trips, trip_revisions, idempotency_keys. Snapshot revision và audit APPEND tách khỏi trip; không có TTL cho audit/history. Trip+revision+mandatory audit+idempotency key cùng transaction. Không dựng framework cho các collection tương lai.

Các mặc định kỹ thuật: session tuyệt đối 7 ngày/idle 1 ngày (configurable), email challenge 1 giờ, OAuth 10 phút, key retry TTL 24 giờ; limiter 10 lần/15 phút theo network/account và chỉ ở tiến trình hiện tại. Đây không phải policy retention/legal đã chốt. API body trip 256 KiB; max 31 ngày, 50 hoạt động/ngày, 300/chuyến, 1.000 người; VND integer, một điểm đến/giờ Việt Nam, giờ kết thúc cùng ngày sau giờ bắt đầu. Totals do server tính; không nhận owner/actor/source/timestamp từ client. Danh sách giới hạn 50, chưa phân trang.

## Phần chưa khả dụng hoặc chưa kiểm chứng

- **Google live:** chưa có `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PKCE_KEY` và redirect URI đăng ký tương ứng. UI hiện disabled đúng; API trả unavailable. Nhánh code dùng PKCE/state/nonce, binding cookie, AES-GCM verifier, Google JWKS/issuer/audience/azp/expiry verification, không lưu access/refresh token, không merge theo email. Chưa chứng minh đăng nhập với Google thật.
- **Email thật:** chưa có adapter/provider gửi thư, credentials và sender được xác nhận. Development mailbox không gửi ra ngoài; password register/login/verify không mở ngoài development. Không tuyên bố production-ready.
- Chưa có link/unlink identity, password recovery, quản lý thiết bị, logout-all UI; chưa có restore/merge lịch sử, xóa chuyến, sharing/map, discovery/AI, commerce hoặc offline cache. Không bị loại khỏi hướng sản phẩm tương lai.
- Chưa chạy kiểm thử provider live, Atlas, deployment, tải/concurrency nhiều instance hoặc audit retention/purge job. In-memory limiter cần thay thế trước khi scale nhiều API instance.
