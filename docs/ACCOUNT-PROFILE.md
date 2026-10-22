# Hồ sơ cá nhân và đổi mật khẩu

## Customer

Bấm avatar góc phải Trang chủ → /account. Sửa tên hiển thị, đặt URL ảnh HTTPS hoặc chọn avatar mặc định rồi Lưu hồ sơ. Ảnh lỗi dùng fallback hiện có. Chưa tải file lên Cloudinary hoặc lưu media; email hiển thị chỉ đọc, không thay đổi trạng thái xác minh. Hồ sơ tải lại/cập nhật đồng bộ với avatar và tên của ứng dụng.

Mật khẩu hiện tại bắt buộc; mật khẩu mới12–128 ký tự, khác mật khẩu cũ và UI yêu cầu nhập lại trùng khớp. Sau thành công xóa các ô mật khẩu. Chỉ identity password đang liên kết được đổi; Google-only nhận hướng dẫn quản lý tại Google, không tự tạo password identity. Đổi thành công giữ phiên hiện tại, thu hồi mọi phiên khác. Quên/reset mật khẩu qua SMTP đã bổ sung trong [PASSWORD-RECOVERY](PASSWORD-RECOVERY.md); owner chưa cung cấp credentials để kiểm chứng mail thật. Liên kết identity, đổi email và upload ảnh chưa triển khai.

## API

- GET /api/v1/me/profile trả AccountDto `{user, revision, canChangePassword}`.
- PATCH /api/v1/me/profile nhận strict `{displayName, avatarUrl, expectedRevision}`. Tên trim1–100, avatar null hoặc HTTPS tối đa2048 không URL credentials; revision không âm. Actor từ session, không nhận ID/roles/email/securityVersion. Revision cũ409 giữ input; yêu cầu lặp mà dữ liệu đã khớp trả hiện tại, không tạo audit trùng. Avatar được chuẩn hóa URL phía server, không fetch/proxy ảnh.
- POST /api/v1/me/password nhận strict `{currentPassword,newPassword}` và UUID Idempotency-Key. Sai mật khẩu cũ400 PASSWORD_INCORRECT (không làm mất phiên), Google-only400, phiên hết hạn401, hạn mức429. Trả `{changed:true}` sau commit. Reuse Argon2id/config, session/Origin checks và auth limiter hiện có. Hạn mức in-memory theo network/account, chưa distributed.

Password mutation trong transaction: xác minh active user/session/linked identity và hash cũ; update passwordHash/passwordChangedAt; tăng users.securityVersion; giữ securityVersionAtIssue của phiên hiện tại theo version mới; revoke phiên khác với reason=password_changed; audit password.changed. Lỗi audit rollback toàn bộ. Cookie hiện tại không thay token/expiry. Login tái kiểm tra hash đã verify trong transaction và ghi lastUsedAt của identity để serialize với đổi mật khẩu, ngăn credential cũ tạo phiên hợp lệ qua race.

Phiên hiện tại lưu passwordChangeKey của lần đổi gần nhất; cùng key chỉ replay thành công nếu newPassword khớp hash hiện hành. Không lưu request/password/hash request trong receipt. Key bị thay khi đổi lần kế tiếp, hết cùng session; đây không phải lịch sử idempotency vĩnh viễn. UI giữ key/body trong bộ nhớ để retry khi mất phản hồi và khóa input; không persist mật khẩu vào localStorage/sessionStorage/URL. Reload mất key: thử đăng nhập bằng mật khẩu mới trước khi đổi lại.

## Data và audit

Không thêm collection/index/dependency. users dùng displayName/avatarUrl/revision hiện có; auth_identities dùng passwordHash/passwordChangedAt/lastUsedAt; auth_sessions thêm passwordChangeKey nullable và enum revocationReason=password_changed. Audit thêm profile.updated/password.changed, actor/entity/revision tối thiểu, không tên, URL ảnh, mật khẩu hoặc hash. Không log body hay secret.

Profile update và audit cùng transaction; failed response có thể retry cùng input hoặc reload để đối chiếu. Google chỉ lấy ảnh claim đã xác minh khi tạo account mới; không backfill avatar sau các lần login để tôn trọng lựa chọn xóa ảnh. Google live chưa được kiểm chứng trong task này. Profile/password schemas là Zod + Mongoose; registry không executable validator. Phân quyền vẫn dựa session, không dùng canChangePassword của client làm quyền.
