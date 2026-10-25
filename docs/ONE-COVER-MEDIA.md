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

Ngày 26/10/2026: worker có pool mặc định 3 tác vụ, server config `PHOTO_WORKER_CONCURRENCY` nhận 1–4. Commons Action API vẫn tuần tự trong một API process, có maxlag=5 và cooldown 30–300 giây theo HTTP 429/503/Retry-After; maxlag/ratelimited JSON tạo cooldown 30 giây. Download/re-encode/upload có thể chạy chồng với tác vụ khác. Poll 1 giây, lease 5 phút, claim atomic theo token; stop chờ mọi tác vụ đang chạy. Giới hạn này theo process, không phải quota phân tán toàn hệ thống.

`PHOTO_PRIORITY_PROVINCE_CODE` optional mã tỉnh 2 số; chọn tác vụ đủ điều kiện của tỉnh đó trước, hết thì dùng hàng đợi chung. Admin yêu cầu tìm lại xếp `imageSearch.priority=100` (mặc định 0, bounded 0–100), ưu tiên trong tỉnh; vẫn giữ chống spam 60 giây và active lease. Máy local hiện cấu hình 3 và tỉnh 48 (Đà Nẵng), `.env` không được commit. Worker tiếp tục khi API chạy, không có dịch vụ chạy nền sau khi tắt API.

Phát hiện live: fallback gần tọa độ từng trả ảnh sự kiện/sân bay cho quán cà phê. Đã siết cả named/nearby: tiêu đề ảnh phải chứa tên địa điểm sau chuẩn hóa hoặc đủ ít nhất 2 từ định danh không chung chung. Gần tọa độ không tự chứng minh đúng đối tượng; bộ lọc tên cũng không phải xác minh bằng mắt. Có thể bỏ sót ảnh đúng với tên tiếng Anh/biệt danh; không gán ảnh không liên quan chỉ để đủ số lượng. Khi initialize, chỉ gỡ ứng viên không khớp tên khỏi observation automatic của draft chưa chọn ảnh và không khóa images, fence bằng revision/checkedAt; không thay selected/public/locked hoặc xóa asset. Nguồn khác/ảnh AI vẫn là bước bổ sung khi Commons không đủ.

Tìm tên+tỉnh không đủ kết quả sẽ thử riêng tên trước tọa độ, vì mô tả Commons có thể dùng địa danh/tỉnh cũ; vẫn lọc tên trên mọi kết quả. Hai ảnh Chùa Cầu/Cầu Rồng đã được nhập thật qua catalog.write; kiểm chứng và giới hạn tại [PHOTO-IMPORT-2026-10-26](PHOTO-IMPORT-2026-10-26.md).

Editor hiển thị trực tiếp ảnh bìa đã chọn trong tab Ảnh địa điểm kể cả khi không có ứng viên tự động. Nếu observation tìm thêm ảnh failed nhưng đã có cover, thông báo chỉ rõ lượt tìm ảnh bổ sung thất bại và bìa vẫn được giữ, không dùng lỗi lưu bìa cũ để mô tả ảnh editorial. Browser regression đã xác nhận trường hợp cover hợp lệ + candidates rỗng + state failed; client/tools typecheck và lint đạt. Kiểm tra lại live Chùa Cầu/Cầu Rồng có images=1 trong DTO admin và Cloudinary HEAD200 dù observation failed.

Lượt nhập toàn quốc phát hiện CDN ảnh gốc cũng trả429/503 và Retry-After (đã gặp600s), khác Commons Action API. Storage adapter nay dừng thử các ứng viên tiếp theo ngay khi có tín hiệu này, giữ cooldown theo header; worker tạm dừng nhận việc mới, lùi nextAttemptAt và hoàn lại lần thử cho lỗi giới hạn tốc độ. Khi initialize, khôi phục thời hạn chờ từ các observation pending có message cooldown, tránh restart làm mất thời gian chờ đã lưu. Kiểm thử đơn vị và integration xác nhận chỉ gọi tải1lần, không gọi lookup/download tiếp khi chờ, không tiêu hao retry budget và worker khởi động lại vẫn chờ. Không dùng tải thumbnail/resize để vượt giới hạn.

Theo yêu cầu rà toàn bộ26.566 mục, cấu hình local đã bỏ ưu tiên riêng tỉnh48 và dùng hàng đợi toàn quốc; concurrency vẫn3. Các yêu cầu tìm lại do admin xếp ưu tiên vẫn giữ. Kết quả nhập và giới hạn dữ liệu hiện tại: [NATIONWIDE-DATA-PREPARATION-2026-10-26](NATIONWIDE-DATA-PREPARATION-2026-10-26.md).

Kiểm tra một nhóm nhỏ trước khi mở rộng toàn quốc: đúng địa điểm, bìa mở được, đủ nguồn/quyền, nội dung/giờ/giá được kiểm tra riêng. Không coi bộ 26.566 địa điểm đã hoàn chỉnh vì có ảnh. Xuất file dữ liệu cuối sau khi customer test; URL + metadata không phải bản sao binary độc lập với Cloudinary. Chưa clear database, chưa xuất bản hàng loạt.

Sau khi owner giải phóng ổ C, kiểm thử MongoDB (metadata, idempotency, lỗi provider), regression nhập tỉnh/xuất bản lô (13 kiểm tra) và hai browser tests đã đạt. Browser xác nhận AI ở desktop/mobile và gallery mất link vẫn giữ bìa. Kết quả chi tiết trong DATA-PREPARATION-2026-10-25.md; không coi kiểm thử provider giả lập là upload Cloudinary thật hoặc dữ liệu toàn quốc đã hoàn chỉnh.
