# Đăng ký bằng OTP email — AUTH-10

Ngày 25/10/2026. Phạm vi: đăng ký email/password trong PWA. Triển khai ban đầu tại nhánh `codex/email-registration-otp`; lần audit tích hợp với `codex/demo-ui-polish` được ghi tại [BRANCH-AUDIT-2026-10-25](BRANCH-AUDIT-2026-10-25.md).

## Luồng và hợp đồng

1. POST `/api/v1/auth/register` với `{email,password,displayName}`. Email được chuẩn hóa bằng contract hiện có. Khi bật OTP: HTTP 202, `{ok:true,data:{verificationRequired:true,challenge,expiresAt,retryAfterSeconds:60}}`. Chưa tạo user/identity/session/cookie. `challenge` là bí mật ràng buộc trình duyệt, không phải mã OTP.
2. Gửi email văn bản tiếng Việt với mã ngẫu nhiên 6 số; SMTP phải chấp nhận thư trước khi API trả 202. Không có endpoint đọc mã, mã giả hoặc mã cố định cho development.
3. POST `/api/v1/auth/registration/verify` với `{challenge,code}`. Đúng mã: HTTP 201, `{ok:true,data:{user}}` có emailVerified=true và cookie phiên HttpOnly. Consume challenge, user/identity/emailVerifiedAt/session/audit cùng transaction; lỗi bất kỳ hoàn tác toàn bộ.
4. Sai/hết hạn/đã dùng/ràng buộc sai: 400. Tối đa 5 lần thử lưu MongoDB, không reset khi restart API. Mã hết hạn sau 10 phút; TTL chỉ dọn dữ liệu, query kiểm tra hạn thật.
5. Gửi lại bằng POST register với cùng thông tin form, sau 60 giây; API thay challenge/mã và reset 5 lần thử. Yêu cầu sớm hoặc đồng thời: 429, không gửi thêm thư. Frontend giữ thông tin trong RAM để gửi lại; tải lại trang phải nhập lại đăng ký và chờ cooldown nếu cần.
6. Trùng account có sẵn: 409, hướng người dùng đăng nhập/đặt lại mật khẩu; không tự merge hay chiếm account. Thiếu SMTP: 503; SMTP từ chối/lỗi: 503 và thu hồi challenge. SMTP chấp nhận không đảm bảo thư đã vào inbox; kiểm tra cả spam và hạn mức nhà cung cấp.

GET `/api/v1/auth/options` thêm `registrationOtpRequired`. Khi flag false, register giữ hợp đồng cũ 201 và emailVerified=false; verify trả 409. Client hỗ trợ cả 2 phản hồi. Google và đăng nhập account cũ không đổi. Muốn đăng ký mới bắt buộc OTP phải bật flag ở **server**; client không tự chọn bỏ qua OTP.

## Cấu hình gửi thư thật

Flag và `server/.env.example` mặc định false để đăng ký local dùng được khi chưa có SMTP. Chỉ bật true sau khi cấu hình SMTP. Trong `server/.env` đang bị Git ignore, điền thông tin do nhà cung cấp SMTP cấp:

```dotenv
REGISTRATION_OTP_REQUIRED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
MAIL_FROM=no-reply@example.com
```

Các giá trị trên là ví dụ, không hoạt động cho gửi thật. Tài khoản gửi và địa chỉ MAIL_FROM cần được nhà cung cấp cho phép. Port465 dùng TLS; port khác yêu cầu STARTTLS. Không gửi mật khẩu SMTP vào chat hoặc commit `.env`. Cùng SMTP được dùng cho khôi phục mật khẩu, RESET_TOKEN_TTL_SECONDS không đổi hạn OTP đăng ký (10 phút cố định). Gemini/Geoapify/Cloudinary không phải dịch vụ gửi email và không cần cho OTP.

MongoDB phải hỗ trợ transaction (replica set). Cấu hình ứng dụng của repository dùng service `localhost:27017` primary của `rs0`, database riêng `goease`; không tự sửa hoặc dừng service dùng chung. Bộ kiểm thử dùng mongod riêng cổng27021, database/thư mục có ID ngẫu nhiên, không sửa database ứng dụng.

Sau cấu hình: khởi động lại API, đăng ký bằng hộp thư bạn kiểm soát, xác nhận mã, kiểm tra đăng nhập lại. Thử mã sai/gửi lại/hết hạn; kiểm tra lỗi SMTP không báo thành công. Chưa chạy bước giao thư live trong lần triển khai này do SMTP còn trống. Tắt flag chỉ là quay lại chế độ đăng ký không yêu cầu OTP, không xóa account đã tạo và không được coi là fallback tự động khi SMTP lỗi.

## Dữ liệu và giới hạn

`auth_challenges` chứa email, tên tạm, password Argon2id, SHA-256 của challenge và SHA-256(challenge + ':' + OTP). Raw challenge chỉ ở bộ nhớ client/response, raw OTP chỉ ở adapter/mail; không nằm trong DB/log/audit/URL/localStorage. Chỉ có 6 số nhưng DB không giữ raw browser binding để dò mã độc lập khi chỉ lộ DB. Các field nhạy cảm select:false; tên/passwordHash/OTPHash được bỏ sau xác nhận thành công. Mật khẩu plaintext tồn tại trong request và bộ nhớ form để gửi lại, không lưu bền.

Unique partial index `{purpose:1,targetEmailNormalized:1}` cho verify_email + registrationFlow=true tuần tự hóa cấp mã theo email, có thể tạo bởi product.initialize. Không có dữ liệu verify_email đăng ký trong baseline trước đó; nếu tự nhập dữ liệu trùng, khởi tạo index phải fail để quản trị xử lý, không tự xóa/ghi đè.

Cooldown và số lần sai lưu DB. Hạn mức network/account bổ sung dùng authLimiter trong bộ nhớ của từng process (mặc định 10 yêu cầu/15 phút, verify30/15 phút), không phải hạn mức phân tán; tối đa20 tác vụ gửi/hash đồng thời mỗi process. Chưa có hàng đợi email bền vững hoặc retry khi API mất điện. Nếu mất response sau SMTP, người dùng phải yêu cầu mã mới khi hết cooldown. Không có CAPTCHA, chứng nhận giao thư hoặc tuyên bố sẵn sàng vận hành công khai từ các test local.

## Kiểm thử

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run build
$env:MONGOD_BINARY='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
node --import tsx --test --test-concurrency=1 server/test/email-registration.integration.ts server/test/password-recovery.integration.ts server/test/account.integration.ts server/test/product.integration.ts
$env:E2E_WEB_PORT='5186'
npx playwright test --config tests/registration.playwright.config.ts
```

Thay MONGOD_BINARY bằng binary thật trên máy. Integration dùng HTTP/MongoDB thật, **SMTP được inject để kiểm tra**, không gửi thư/không dùng provider credentials. Kiểm tra chưa có account trước verify, cookie/login, hash, mã sai/hết hạn/replay/binding, resend, tranh chấp, cấu hình thiếu, SMTP lỗi, audit rollback, không lộ bí mật. Browser dùng API mock để kiểm tra form320/390px, lỗi/retry/gửi lại; không chứng minh giao thư thật.

Kết quả local 25/10/2026: npm test **64 pass**; OTP unit + integration **15 pass** (có4unit trùng trong64, không cộng hai số); account/password-recovery/product integration **22 pass**; Edge browser **3 pass**. Typecheck, lint, format và build pass. Đã mở ảnh chụp320px để kiểm tra bố cục. Build vẫn cảnh báo bundle chính lớn hơn500kB; Vite test config cảnh báo cách tải module, không làm các gate thất bại. Chưa chạy toàn bộ integration/E2E của catalog/AI; chưa gửi SMTP thật, chưa nghiệm thu trên điện thoại. Dịch vụ MongoDB dùng chung27017 và repo Expo bản chính không bị sửa.

Tham khảo adapter: [Nodemailer SMTP](https://nodemailer.com/smtp), [Node crypto](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).
