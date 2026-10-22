# Quên mật khẩu qua email

## Customer flow

Đăng nhập → **Quên mật khẩu?** → nhập email → mở link trong thư → nhập/xác nhận mật khẩu mới → **Về đăng nhập**. Không tự đăng nhập sau reset. Mật khẩu mới 12–128 ký tự; Argon2id dùng cùng tham số với đăng ký/đổi mật khẩu hiện có.

Link mặc định hết hạn sau 15 phút và chỉ dùng một lần. Xem trang không consume token; POST mật khẩu mới mới consume. Reset thành công tăng securityVersion, thu hồi mọi session của tài khoản (kể cả phiên hiện tại), vô hiệu hóa các link reset còn lại. EmailVerifiedAt không tự thay đổi; không liên kết Google hay tạo password identity cho Google-only.

## Cấu hình gửi email thật

Owner đã hoãn cung cấp credentials. Adapter SMTP đã triển khai, nhưng **chưa kiểm chứng gửi/nhận thư thật**. Thiếu cấu hình trả503 cho mọi email, không giả báo gửi thành công. Điền vào `server/.env` (đã bỏ qua Git), theo mẫu `server/.env.example`:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=sender@example.com
SMTP_PASS=replace-with-provider-app-password
MAIL_FROM=sender@example.com
RESET_TOKEN_TTL_SECONDS=900
```

Port465 dùng TLS trực tiếp; các port khác bắt buộc STARTTLS. Kiểm tra certificate và TLS tối thiểu1.2 luôn bật, không có chế độ bỏ qua chứng chỉ. `MAIL_FROM` là email được provider cho phép gửi. Gmail dùng `smtp.gmail.com:465` và mật khẩu ứng dụng phù hợp tài khoản; không dùng mật khẩu đăng nhập thường. Khởi động lại API sau khi sửa env. CLIENT_ORIGIN quyết định origin của link, không lấy Host/returnTo từ request; production bắt buộc HTTPS. Localhost chỉ dùng trên cùng máy, chưa phải link public cho điện thoại khác.

Sau cấu hình: dùng tài khoản test riêng, yêu cầu reset từ UI, kiểm tra Inbox/Spam, dùng link đổi mật khẩu, xác nhận mật khẩu cũ/phiên cũ bị từ chối và link không dùng lại được. Không gửi mật khẩu ứng dụng hoặc token vào chat, commit, log hay screenshot công khai.

## API và dữ liệu

- `POST /auth/forgot-password` strict `{email}` →202 `{accepted:true,message}` giống nhau cho email đủ điều kiện, không tồn tại, Google-only, suspended/deleted hoặc bị cooldown. Đây là xác nhận nhận yêu cầu, không xác nhận email được giao. Không echo email/token. Thiếu SMTP503; rate-limit429.
- `POST /auth/reset-password` strict `{token,newPassword}` →200 `{changed:true}`, clear session cookie. Invalid/expired/consumed/revoked/wrong-purpose/identity/security version →400 chung. Không nhận userId, email, redirect hay phiên do client chỉ định.
- Token random32bytes base64url tạo trên server, SHA-256 lưu trong `auth_challenges` purpose=`reset_password`; raw token chỉ ở bộ nhớ tác vụ gửi thư và URL fragment `/reset-password#token`. Không API mailbox, localStorage, outbox chứa token rõ hoặc token trong request URL.
- Context reset yêu cầu identityId, securityVersionAtIssue, deliveryState=`pending|sent|failed`. Chỉ `sent` được consume. SMTP chấp nhận không đồng nghĩa đã đến Inbox. Provider lỗi/timeout làm challenge failed+revoked; nếu ghi cleanup lỗi, pending vẫn không dùng được. Log chỉ mã `email.reset_accepted/failed/cleanup_failed`, không raw error/email/URL/secret.
- Request mới sau cooldown thu hồi reset link trước trong transaction. Cooldown60giây theo user trong DB; network/account limiter riêng cho request/reset tái dùng AUTH_MAX_ATTEMPTS/AUTH_WINDOW_SECONDS. User.recoverySequence là counter nội bộ khóa race, không tăng revision hồ sơ. Kết quả response có timing floor400ms, không đợi SMTP; đây không phải bảo đảm thời gian hằng số khi DB tải cao.
- Reset transaction gồm consume token + đổi password + tăng securityVersion + revoke sessions/other challenges + audit password.reset. Audit lỗi rollback tất cả. Login credential race dùng kiểm tra password hash hiện có. Đổi mật khẩu trong hồ sơ tăng securityVersion nên link reset cũ cũng hết hiệu lực.
- Gửi SMTP ngoài transaction, giới hạn tác vụ đang chờ, drain khi shutdown bình thường. Không durable retry/outbox: process crash có thể làm mất tác vụ gửi; token pending không dùng được và người dùng yêu cầu lại sau cooldown. Không lưu raw secret để khôi phục gửi sau crash.

## Kiểm thử và giới hạn

Integration dùng bộ gửi thư được inject trong test để kiểm tra accept/failure; không cấu hình transport giả trong production. Browser test dùng challenge đã gửi được seed trực tiếp vào MongoDB test, ghi rõ tên fixture; không đại diện gửi email thật. Playwright vô hiệu hóa SMTP từ `.env` để không gửi thư ngoài ý muốn. Nếu response reset bị mất sau commit, retry trả link đã dùng; UI hướng dẫn thử đăng nhập bằng mật khẩu mới hoặc xin link khác. Không có replay thành công cho token đã consume.

Không có recovery Google, identity linking, đổi email, tự xác minh email, gửi thông báo sau reset, distributed rate limit hay durable email worker trong slice này. Xem PRODUCT-VERIFICATION cho kết quả lệnh quan sát.

Nguồn kỹ thuật: [Nodemailer SMTP/TLS](https://nodemailer.com/smtp), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Cách triển khai và giới hạn cụ thể được mô tả ở trên.
