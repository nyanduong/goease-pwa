# Quản lý địa điểm — giao diện danh mục

Triển khai ngày 25/10/2026 theo mẫu chủ sản phẩm duyệt.

- Bảng gọn gồm ảnh bìa đã chọn, tên/địa chỉ, loại, điều kiện xuất bản, trạng thái, cập nhật và chỉnh sửa.
- Tab trạng thái dùng overview trong phạm vi tỉnh. “Cần kiểm tra” mở hàng chờ, không phải trạng thái xuất bản riêng.
- Giữ tìm kiếm, lọc, sắp xếp, bản đồ và phân trang. Thanh chọn hỗ trợ xem trước theo lô, giới hạn chọn trực tiếp 50, chọn toàn bộ theo bộ lọc và snapshot/revision hiện có.
- Ảnh dùng bìa hợp lệ trong metadata danh mục, gồm ảnh thật hoặc ảnh minh họa AI đã chọn theo CAT-20. Ảnh AI có nhãn trong alt/title; không ẩn bìa chỉ vì ghi công có chữ AI/minh họa. Không tự dùng ảnh AI trang trí hoặc ảnh AI legacy thiếu metadata. Thiếu bìa hoặc tải lỗi vẫn hiển thị trạng thái tương ứng. Pipeline hiện có lấy bản Wikimedia gốc, chuyển WebP lossless không giảm kích thước trong giới hạn an toàn. Không khẳng định mọi ảnh cũ đã nâng cấp hoặc mọi địa điểm đủ năm ảnh.

## Hợp đồng và quy tắc

`AdminPlaceDto.publicationReadiness` là phản hồi tùy chọn được tính khi đọc, không lưu MongoDB, không nhận trong payload chỉnh sửa. Không thêm collection/index/schema lưu trữ; DB baseline và registry không đổi.

Nhãn dùng schema xuất bản cùng trạng thái tỉnh, lô lưu trữ đang chạy, đề xuất lỗi thời, kiểm tra nguồn/trùng và xác nhận đóng cửa. Đây là chỉ báo: endpoint xem trước/thực thi vẫn kiểm tra lại. Thiếu giá/giờ không tự thành miễn phí/mở cả ngày. Không đổi chính sách BR CAT-17/CAT-20.

## Kiểm tra

- Unit test mới cho thiếu dữ liệu, chặn theo ngữ cảnh và trường hợp không có giá/giờ nhưng đủ điều kiện khám phá.
- Đọc MongoDB local: 40 địa điểm Hà Nội, DTO readiness và URL Cloudinary.
- Playwright render component thật với DTO local và API fixture: chọn, tìm kiếm/rỗng, phân trang, không tràn ngang tại 1600/1366/768/390/320px. Không thực thi xuất bản/lưu trữ thật.
- Chưa chạy full integration MongoDB do dung lượng đĩa thấp. Browser test tích hợp đã cập nhật nhãn nút, chưa chạy lại toàn bộ.

26/10/2026: sửa danh sách admin ẩn nhầm bìa AI đã chọn. Typecheck/lint đạt; browser regression `AI cover metadata` đạt với API/MongoDB test riêng: metadata lưu/xuất bản, public có nhãn AI, bìa danh sách admin tải được ở 1440/390px và trạng thái lỗi tải. Không sửa dữ liệu địa điểm thực hoặc chạy lại toàn bộ integration suite.
