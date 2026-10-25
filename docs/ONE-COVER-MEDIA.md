# CAT-20 — Một ảnh bìa lưu riêng, bốn ảnh nguồn

Owner chốt ngày 25/10/2026: mỗi địa điểm có tối đa 5 ảnh thật, chỉ lưu 1 ảnh bìa lossless trên Cloudinary; các ảnh còn lại dùng link nguồn. Khi không có ảnh thật phù hợp, admin dùng 1 ảnh minh họa AI đã tải lên Cloudinary. Giữ nhãn AI và nguồn/quyền sử dụng. Chưa có bộ tạo ảnh AI hàng loạt hoặc thao tác mua gói lưu trữ.

## Hành vi

- Tìm Wikimedia tối đa 5 ứng viên hợp lệ. Tải và lưu ảnh bìa đầu tiên thành công; dừng upload ngay sau đó. Ứng viên bổ sung giữ URL nguồn HTTPS được allowlist. Nếu một ảnh không lưu được thử ứng viên tiếp theo; tất cả thất bại thì báo lỗi, không dùng link nguồn làm bìa thay cho bản sao lưu.
- `images.storage` optional enum `cloudinary|source`; `originalUrl` optional HTTPS <=2048 giữ URL binary nguồn, khác `sourceUrl` là trang ghi công/quyền. Hai trường đi qua Mongoose, proposal/version và public DTO. Metadata cũ thiếu trường giữ tương thích, không suy ra bằng chứng đã tải ảnh hoặc xóa ảnh cũ.
- Worker `imageSearch.storageVersion=3`. Quan sát v2 đã hoàn tất được giữ; không xếp lại toàn bộ chỉ vì đổi chính sách lưu trữ. Quan sát legacy dưới v2 theo cơ chế nâng cấp cũ được xếp lại vào v3. DefaultCover giữ ổn định; retry không đổi thành link nguồn.
- Chọn một ảnh nguồn làm bìa trong editor: lúc lưu, server tải/lưu lossless ngoài transaction; xong mới ghi đề xuất và giữ selection/reviewed. Idempotency vẫn so payload gốc, trả receipt cũ mà không upload lại. Nếu lỗi, không ghi đề xuất hoặc xuất bản. Ảnh ngoài Wikimedia không được server tải tùy ý: admin tải lên Cloudinary trước rồi nhập URL. Ảnh AI cũng dùng URL Cloudinary.
- Các ảnh đã đánh dấu cloudinary/originalUrl ở vị trí bổ sung được chiếu về URL gốc. Ảnh trùng theo URL gốc được loại; không xóa asset Cloudinary cũ và không cam kết chỉ còn đúng 1 asset vật lý trong tài khoản sau nhiều lần đổi bìa/retry.
- Xuất bản (kể cả lô) chặn bìa mới có storage=source; mở editor và lưu bìa trước. Dữ liệu legacy thiếu storage giữ gate cũ, chưa migration xác minh tất cả bìa cũ. Không tự sửa bản công khai hoặc mục khóa.
- Customer ẩn từng ảnh gallery không tải được; bìa Cloudinary vẫn hiện nếu asset còn truy cập được. Không biến ảnh hỏng thành ảnh AI tự động.

## Vận hành tiếp theo

Kiểm tra một nhóm nhỏ trước khi mở rộng toàn quốc: đúng địa điểm, bìa mở được, đủ nguồn/quyền, nội dung/giờ/giá được kiểm tra riêng. Không coi bộ 26.566 địa điểm đã hoàn chỉnh vì có ảnh. Xuất file dữ liệu cuối sau khi customer test; URL + metadata không phải bản sao binary độc lập với Cloudinary. Chưa clear database, chưa xuất bản hàng loạt.

Sau khi owner giải phóng ổ C, kiểm thử MongoDB (metadata, idempotency, lỗi provider), regression nhập tỉnh/xuất bản lô (13 kiểm tra) và hai browser tests đã đạt. Browser xác nhận AI ở desktop/mobile và gallery mất link vẫn giữ bìa. Kết quả chi tiết trong DATA-PREPARATION-2026-10-25.md; không coi kiểm thử provider giả lập là upload Cloudinary thật hoặc dữ liệu toàn quốc đã hoàn chỉnh.
