# Chia sẻ lịch trình chỉ xem

## Sử dụng

Mở chuyến đã lưu → **Thông tin chuyến đi** → **Chia sẻ lịch trình**. Lưu thay đổi trước khi chia sẻ. Chọn 1, 7 hoặc 30 ngày → Tạo link → Sao chép hoặc Xem trước. Người có link xem lịch mới nhất, chọn ngày và bản đồ không cần tài khoản. Tên chuyến và hoạt động được công khai cho người có link; toàn bộ ghi chú, ngân sách/dự toán/thực chi và thông tin tài khoản bị loại tại API.

Danh sách hiển thị tối đa 10 link hoạt động cùng ngày tạo/hết hạn; thu hồi từng link. Token rõ chỉ nằm trong bộ nhớ sau khi tạo; đóng trang mất khả năng sao chép lại. Nếu mất link hãy thu hồi rồi tạo mới. Retry sau lỗi mạng giữ nguyên token và duration; không tạo trùng/gia hạn. Không lưu token ở localStorage.

## API

- `GET /trips/:id/shares`: owner-only, `{items: ShareLinkDto[]}` gồm id, createdAt, expiresAt, revokedAt; chỉ link còn hiệu lực.
- `POST /trips/:id/shares`: owner-only strict `{token:64hex,expiresInDays:1|7|30}`. UI dùng crypto.getRandomValues (32 bytes); server SHA-256; trả201 `{share}` không echo token. Cùng token+trip+owner+duration trả metadata gốc; khác request409; expired/revoked404.
- `DELETE /trips/:id/shares/:shareId`: owner-only, retry no-op200 `{revoked:true}`.
- `GET /shared-trip`, `Authorization: Bearer <token>`: không dùng cookie, trả `{trip: SharedTripDto}` bằng allowlist; invalid/expired/revoked/deleted404 chung. `Cache-Control:no-store`, `Referrer-Policy:no-referrer`, `X-Robots-Tag:noindex,nofollow`. Không có mutation public.

Link web dùng fragment `/share#token` để token không vào request URL/referrer. API logger chỉ route template. Owner mutations dùng Origin/X-GoEase-Client guard sẵn có. Collection/index được khởi tạo theo vòng đời product hiện có; không cần seed/migration. No TTL; API không dựa vào dọn dữ liệu để thu hồi quyền.

## Ranh giới

Lịch là bản đã lưu hiện tại, không phải snapshot. Bản đồ dùng lại catalog/API public hiện có; đường nối chỉ tham khảo. Chưa có editor/collaborator, gia hạn, lịch sử link hết hạn, realtime push hay purge. Revoke chặn request tiếp theo nhưng không thể xóa dữ liệu người nhận đã xem/lưu; trang kiểm lại khi focus/cập nhật/tải lại và khi tới hạn. Xóa chuyến revokes mọi link trong transaction; restore không mở lại. Link localhost chỉ dùng trên máy chạy app; chia sẻ cho thiết bị khác cần triển khai web/API public đúng cấu hình.

## Kiểm chứng

Xem `PRODUCT-VERIFICATION.md` cho kết quả chạy thực tế. Tests dùng MongoDB biệt lập, không thay rs0 ứng dụng; không gọi Gemini hoặc dịch vụ email.
