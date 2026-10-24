# Hồ sơ cá nhân và đổi mật khẩu

## Customer

Bấm Tài khoản hoặc avatar → /account. Bố cục Trung tâm cá nhân: tiêu đề căn giữa, thẻ hồ sơ với avatar/nút camera, tên, email cố định, ngày tham gia/cập nhật; thẻ bảo mật riêng với hiện/ẩn từng mật khẩu. Màu kem–xanh GoEase và font sans thống nhất. Chọn ảnh từ thiết bị, kéo/căn ngang/dọc, phóng 1–3 lần, xem khung tròn rồi Dùng ảnh này → Lưu hồ sơ. Dùng ảnh mặc định đặt avatar null. Ảnh lỗi dùng fallback hiện có; email chỉ đọc, không thay đổi xác minh.

Mật khẩu hiện tại bắt buộc; mật khẩu mới12–128 ký tự, khác mật khẩu cũ và UI yêu cầu nhập lại trùng khớp. Sau thành công xóa các ô mật khẩu. Chỉ identity password đang liên kết được đổi; Google-only nhận hướng dẫn quản lý tại Google, không tự tạo password identity. Đổi thành công giữ phiên hiện tại, thu hồi mọi phiên khác. Quên/reset mật khẩu qua SMTP đã bổ sung trong [PASSWORD-RECOVERY](PASSWORD-RECOVERY.md); owner chưa cung cấp credentials để kiểm chứng mail thật. Liên kết identity và đổi email chưa triển khai.

## API

- GET /api/v1/me/profile trả AccountDto `{user, revision, canChangePassword}`.
- PATCH /api/v1/me/profile nhận strict `{displayName, avatarUrl, expectedRevision}`. Tên trim1–100, avatar null hoặc HTTPS tối đa2048 không URL credentials; revision không âm. Actor từ session, không nhận ID/roles/email/securityVersion. Revision cũ409 giữ input; yêu cầu lặp mà dữ liệu đã khớp trả hiện tại, không tạo audit trùng. Avatar được chuẩn hóa URL phía server, không fetch/proxy ảnh.
- POST /api/v1/me/password nhận strict `{currentPassword,newPassword}` và UUID Idempotency-Key. Sai mật khẩu cũ400 PASSWORD_INCORRECT (không làm mất phiên), Google-only400, phiên hết hạn401, hạn mức429. Trả `{changed:true}` sau commit. Reuse Argon2id/config, session/Origin checks và auth limiter hiện có. Hạn mức in-memory theo network/account, chưa distributed.

Password mutation trong transaction: xác minh active user/session/linked identity và hash cũ; update passwordHash/passwordChangedAt; tăng users.securityVersion; giữ securityVersionAtIssue của phiên hiện tại theo version mới; revoke phiên khác với reason=password_changed; audit password.changed. Lỗi audit rollback toàn bộ. Cookie hiện tại không thay token/expiry. Login tái kiểm tra hash đã verify trong transaction và ghi lastUsedAt của identity để serialize với đổi mật khẩu, ngăn credential cũ tạo phiên hợp lệ qua race.

Phiên hiện tại lưu passwordChangeKey của lần đổi gần nhất; cùng key chỉ replay thành công nếu newPassword khớp hash hiện hành. Không lưu request/password/hash request trong receipt. Key bị thay khi đổi lần kế tiếp, hết cùng session; đây không phải lịch sử idempotency vĩnh viễn. UI giữ key/body trong bộ nhớ để retry khi mất phản hồi và khóa input; không persist mật khẩu vào localStorage/sessionStorage/URL. Reload mất key: thử đăng nhập bằng mật khẩu mới trước khi đổi lại.

## Data và audit

Không thêm collection/index; bổ sung sharp 0.35.5 để xác minh và chuẩn hóa ảnh phía server. users dùng displayName/avatarUrl/revision hiện có; auth_identities dùng passwordHash/passwordChangedAt/lastUsedAt; auth_sessions thêm passwordChangeKey nullable và enum revocationReason=password_changed. Audit thêm profile.updated/password.changed, actor/entity/revision tối thiểu, không tên, URL ảnh, mật khẩu hoặc hash. Không log body hay secret.

Profile update và audit cùng transaction; failed response có thể retry cùng input hoặc reload để đối chiếu. Google chỉ lấy ảnh claim đã xác minh khi tạo account mới; không backfill avatar sau các lần login để tôn trọng lựa chọn xóa ảnh. Google live chưa được kiểm chứng trong task này. Profile/password schemas là Zod + Mongoose; registry không executable validator. Phân quyền vẫn dựa session, không dùng canChangePassword của client làm quyền.

## Upload avatar — 24/10/2026 (AUTH-09 / CAT-06)

- Chọn JPG/PNG/WebP tối đa 5 MB/16 triệu pixel trong trình duyệt. Canvas tạo JPEG 512×512 chỉ khi xác nhận khung cắt; thao tác này chưa lưu server. Hủy giữ ảnh cũ. Bản cắt giữ trong bộ nhớ đến khi lưu, không vào localStorage hoặc URL.
- POST /api/v1/me/avatar nhận bytes trực tiếp, Content-Type image/jpeg, image/png hoặc image/webp, tối đa 2 MB; không nhận request nén/SVG/GIF, tên file, ownerId, đường dẫn hay cloud destination do client chọn. Kiểm session và Origin/client header trước đọc body/giải mã; limiter riêng 10 lần/15 phút theo account và network, in-memory như auth limiter hiện có.
- sharp kiểm chữ ký định dạng, giải mã, giới hạn 16 triệu pixel, từ chối ảnh động và đầu vào lỗi; xoay theo EXIF, cắt vuông/resize 512, xuất WebP bỏ metadata. Chỉ bản chuẩn hóa được gửi tới Cloudinary; không ghi original vào filesystem/MongoDB/log.
- Cloudinary dùng credentials server hiện có, thư mục goease/avatars, UUID do server tạo, overwrite=false, chữ ký SHA-1, timeout 30 giây, response tối đa 32 KB. Kiểm publicId, kích thước, định dạng và đúng CDN/cloud/path trước trả AvatarUploadDto {avatarUrl}. Thiếu cấu hình503; provider lỗi502 thông báo cố định, không lộ response/key, không báo thành công.
- Upload không sửa profile. PATCH /me/profile vẫn commit avatarUrl/name/revision + profile.updated cùng transaction. Client giữ URL của upload đã thành công trong bộ nhớ để retry PATCH/conflict mà không upload lại. Mất phản hồi upload có thể để lại asset chưa tham chiếu; không có idempotency receipt cho upload.
- GET profile thêm createdAt/updatedAt ISO từ users, chỉ cho chính account; UI hiển thị giờ Việt Nam. Không dùng ngày giả hoặc cho sửa timestamp. AccountDto và database storage không chứa ảnh nhị phân.
- Avatar là ảnh công khai qua URL CDN; UI thông báo trước lưu. Thay/reset avatar không xóa ảnh cũ hoặc asset chưa dùng trên Cloudinary. Chưa có media_assets runtime, job dọn ảnh, purge hay retention tự động; không suy ra consent/retention policy khác. Giữ tương thích avatar HTTPS cũ/Google và PATCH contract.

Tài liệu kỹ thuật: [sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [resize](https://sharp.pixelplumbing.com/api-resize/), [Cloudinary upload API](https://cloudinary.com/documentation/image_upload_api_reference).

## Kiểm chứng lần mở rộng

- Typecheck, lint, build, 53 unit/HTTP tests: PASS. Build giữ cảnh báo chunk lớn có sẵn.
- Account + avatar integration: 7 kiểm tra PASS trên replica set test riêng (27021), gồm ownership, profile/password rollback, upload auth/Origin, định dạng/dung lượng, provider failure, rate limit và persist avatar qua revision. Provider trong integration được giả lập; không sửa MongoDB service 27017.
- Browser API giả lập: PASS chọn file sai/hợp lệ, crop/zoom/drag, lỗi upload, conflict/reuse URL, lưu/reload/reset, readonly email/dates, hiện/ẩn password và bố cục 320/460/1280px. Test lặp lại: `npx playwright test --config tests/account.playwright.config.ts`; đặt E2E_WEB_PORT khác 5180 nếu dev đang chạy (xem README). Config chỉ chạy Vite, không cần API/MongoDB.
- Upload thật một ảnh màu tổng hợp không có dữ liệu cá nhân qua adapter server lên Cloudinary: PASS; GET CDN xác nhận WebP512×512. Không đổi ảnh account ứng dụng. Chưa kiểm thử trên iPhone/Android thật hoặc chạy lại toàn bộ E2E/product suite. Chưa xác minh cleanup asset vì chưa triển khai.
