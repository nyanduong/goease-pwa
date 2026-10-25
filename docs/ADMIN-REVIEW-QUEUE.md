# Cần kiểm tra — hàng chờ admin

Đã triển khai local ngày 25/10/2026 theo mockup owner chọn. Đổi nhãn Ngoại lệ thành Cần kiểm tra; giữ route/hash #work và các quyền/quyết định hiện có.

## Giao diện

Danh sách bên trái, inspector bên phải; chọn sẵn việc đầu tiên trên trang. Tab Tất cả/Bản nháp/Có thể trùng/Nguồn thay đổi/Giá cần kiểm tra/Thông tin công khai dùng số đếm toàn phạm vi tìm kiếm từ server, không lấy số hàng trên trang. Tìm kiếm, bộ lọc loại và sắp xếp đổi về trang đầu; mỗi trang 20 việc. Ưu tiên trước đưa việc liên quan địa điểm published lên trước, Mới cập nhật xếp theo updatedAt. Banner chỉ hiện khi publishedCount > 0; không tạo KPI giả hoặc gộp trạng thái đợt thu thập vào việc duyệt.

Inspector có ảnh lớn, ảnh đầy đủ không khung khi bấm, checklist ảnh/tên/địa chỉ/giới thiệu, trạng thái giá/giờ chưa xác minh, nguồn, ghi chú và nút vào editor. Không hiện nút xuất bản nếu capability discovery chưa đạt; server tiếp tục kiểm tra mọi blocker, quyền và revision. Đối chiếu nguồn mở mặc định cho loại source, thông tin chi tiết khác thu gọn. Các quyết định nâng cao giữ trong Các cách xử lý khác: yêu cầu chỉnh sửa, từ chối nguồn, xác nhận hai địa điểm riêng, giữ thông tin, bỏ qua có xác nhận/lý do. Để sau vẫn có thời hạn 1/7/30 ngày, idempotency key và revision như trước.

Mobile chuyển thành một cột; danh sách có vùng cuộn, chọn việc chuyển đến inspector. Bàn phím thao tác bằng button native/focus visible. Giữ loading, lỗi/thử lại, không có kết quả, xóa bộ lọc và phân trang. Poll nền không xóa nội dung ghi chú nếu review revision chưa đổi.

## API và dữ liệu

`GET /api/v1/admin/catalog/reviews` thêm `sort=priority|newest` (mặc định priority), giữ offset/destinationId/kind/q. Response thêm `counts` (draft/duplicate/source/price/quality) và `publishedCount`. Các count tính từ cùng tập review open, cùng khu vực, q, bỏ việc bị source/duplicate chặn theo quy tắc cũ; counts/publishedCount không bị kind hoặc offset cắt. total/hasMore vẫn thuộc bộ lọc kind hiện tại. Không thay schema collection hoặc policy quyền.

Reason cho draft/quality dùng cùng proposal + nguồn mặc định như DTO place: ảnh bìa/giới thiệu tự động đã có không bị báo thiếu vì đọc bản lưu cũ. Review/decision endpoint vẫn derive admin từ session, guard expectedRevision/expectedPlaceRevision và idempotency; UI không tự apply hoặc publish.

## Ảnh chất lượng gốc

Theo owner, nguồn tải Wikimedia dùng imageinfo.url nguyên bản thay thumburl 960 px; không yêu cầu iiurlwidth. Server giữ nguyên kích thước, sửa orientation, bỏ metadata file, encode WebP lossless, lưu Cloudinary. Không upscale hoặc tạo chi tiết AI. Giới hạn tải 8 MiB/15 giây và raster 36 triệu pixel vẫn áp dụng; file vượt giới hạn hoặc upload lỗi không được báo thành công. Chất lượng nguồn gốc vẫn là giới hạn thực tế.

`imageSearch.storageVersion=2` đánh dấu pipeline ảnh nguyên kích thước. Startup xếp lại quan sát version cũ khi không có lease sống; giữ ảnh cũ trong lúc chờ. Nếu tìm lại được đúng sourceUrl của defaultCover, nâng URL sang bản Cloudinary mới của cùng ảnh, giữ identity/selection/rights. Không chọn ảnh khác chỉ vì thứ tự tìm đổi. Draft không khóa images cũng dùng URL chất lượng mới của cùng sourceUrl cho ảnh đã chọn; save/publish đưa URL vào editorial snapshot. Public hiện tại và snapshot chuyến cũ giữ nguyên; không thay revision chỉ vì worker chuẩn bị ảnh. Nếu không có kết quả mới, ảnh cũ vẫn dùng được; không tuyên bố đã nâng cấp toàn bộ catalog.

## Kiểm chứng đã quan sát

- Build thành công, typecheck server/client/contracts/media/tools và lint đạt; build còn cảnh báo bundle >500 kB.
- 82 server unit tests pass, gồm tải original thay thumbnail, giữ nguyên 1600×900 và so sánh pixel decoded WebP với nguồn; projection nâng URL cùng ảnh và giữ public/field locks/selection.
- Gọi service trên dữ liệu Hà Nội: 40 review, tổng count khớp total, filter draft giữ count toàn tập, hai trang không lặp, q không khớp trả rỗng, reason không báo thiếu ảnh đã có.
- Playwright component smoke với DTO thật và ảnh Cloudinary thật: chọn việc, ảnh lớn, ghi chú/Để sau gửi revision đúng (decision API mock, không xử lý việc live), tìm kiếm, trống/xóa lọc, phân trang, sort; không tràn ngang ở 1600/1366/768/390/320. Đã xem screenshot desktop/mobile. Chưa chạy lại toàn bộ browser suite dùng MongoDB test trong đợt này; selector suite cũ đã cập nhật theo nhãn mới.
- Worker native pipeline đã lưu được ảnh Bảo tàng Hồ Chí Minh 1536×1413 WebP trên Cloudinary; hàng đợi cũ còn pending/failed/empty, không phải mọi ảnh đã nâng cấp. Các assertion province-import integration sửa version 2 chưa chạy lại trong đợt này.
