# Tiến trình lấy dữ liệu — CAT-22

Admin → **Tiến trình lấy dữ liệu** (`#progress`). Theo dõi hàng đợi lấy giờ mở cửa/giá; chọn tỉnh trên thanh phạm vi, tìm tên, lọc trạng thái hoặc dữ liệu còn thiếu. Nút Kiểm tra mở editor hiện có. Trang tự tải mỗi 5 giây khi đang hiện, có tắt tự cập nhật/làm mới và lỗi/thử lại; không tự gọi lại nguồn hoặc xuất bản.

## Ý nghĩa số liệu

- Tổng phạm vi gồm địa điểm chưa xóa có nguồn Geoapify hoặc visitSearch. Không lấy mẫu 20/500 làm tổng. Tìm tên áp dụng cả KPI và bảng; bộ lọc trạng thái/độ phủ chỉ thu hẹp bảng.
- Có giờ/giá/cả hai/chưa có cả hai đếm result lưu trong visitSearch, **gồm kết quả trước khi đang tìm lại**. Không tương đương dữ liệu đã được admin duyệt hoặc đủ điều kiện tính ngân sách. Giá 0 vẫn được đếm là có giá. Hàng có context không khớp (tên/nguồn/tỉnh/tọa độ) được đánh dấu kết quả từ lượt trước.
- Đã xử lý = ready + empty + failed; tổng trong hàng đợi = tổng phạm vi trừ chưa xếp hàng và ngoài hàng đợi. Lượt tìm hoàn tất không bảo đảm đã có đủ giờ/giá. empty là chưa tìm được thông tin, failed là lỗi nguồn sau retry.
- Non-draft còn trạng thái pending/searching được ghi ngoài hàng đợi vì worker hiện chỉ nhận draft. Searching có lease hết hạn được cảnh báo chờ nhận lại, không tự kết luận worker đang hoạt động bình thường hoặc tự đổi trạng thái.
- Kết quả đang thay đổi có thể di chuyển giữa các trang; mỗi phản hồi chứa thời điểm và một aggregate facet cho summary, tổng khớp và tối đa 20 hàng.

## API đã triển khai

GET `/api/v1/admin/catalog/visit-progress`: admin session/role hiện hành, query strict destinationId?/q≤100/state/coverage/offset; tìm regex literal được escape, phân trang 20. Shared `VisitProgressDto`/`visitProgressQuerySchema` độc lập Mongoose/React. Đọc MongoDB aggregate, không gọi provider, ghi DB, sửa hàng đợi hoặc thêm collection/index. Dictionary lưu trữ CAT-22 và collection registry không đổi.

## Kiểm chứng

- Integration MongoDB riêng: quyền admin, scope/count vượt một trang, giá 0, result cũ, quá hạn, ngoài hàng đợi, chưa xếp hàng, soft delete, tìm literal, lọc, phân trang và xác nhận toàn bộ document không đổi sau GET service.
- Đọc service với dữ liệu local thật: tổng 72, Hà Nội 40; counts/filter so khớp. Không thay đổi dữ liệu ứng dụng khi kiểm tra.
- Browser fixture render component/DTO thật: navigation, polling, tắt polling, mở editor callback, trang tiếp, tìm kiếm/rỗng, lọc thiếu dữ liệu, lỗi/thử lại và desktop/mobile. Provider/API fixture trong browser; không gọi xuất bản hoặc thực thi lại hàng đợi.
