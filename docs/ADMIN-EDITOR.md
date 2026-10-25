# Trang kiểm tra và chỉnh sửa địa điểm

Giao diện ngày 25/10/2026 theo mockup được chủ sản phẩm duyệt. Luồng ảnh bìa mặc định tuân theo CAT-20 cập nhật bên dưới.

## Thao tác admin

1. Mở **Địa điểm → Chỉnh sửa**. Trang dùng toàn bộ chiều ngang, có tên địa điểm, trạng thái đề xuất và nút về danh sách.
2. **Tổng quan** hiển thị tối đa 6 ảnh gợi ý đã lưu Cloudinary và thông tin cơ bản. Số ảnh thực tế có thể ít hơn 6 hoặc chưa có; hệ thống hiển thị trạng thái tìm/lỗi/thử lại.
3. Ảnh đầu tiên tự làm bìa. Bấm ảnh khác để xem lớn rồi **Dùng làm ảnh bìa** nếu muốn thay. Đóng cửa sổ giữ bìa hiện tại; **Lưu đề xuất** giữ lựa chọn mới. Nguồn và giấy phép nằm trong mục **Thông tin ảnh** thu gọn.
4. **Ảnh địa điểm** hoặc **Xem tất cả** mở toàn bộ ứng viên và phần quản lý ảnh đã chọn. **Giá & giờ mở cửa** chứa thông tin thực tế; **Nguồn & lịch sử** chứa nguồn, khóa trường, bằng chứng, tự lưu bản nháp và phiên bản phục hồi.
5. Checklist bên phải đưa tới phần cần sửa. Giá/giờ chưa xác minh nằm ở phần bổ sung; không tự suy ra miễn phí hay mở cả ngày. Cảnh báo phần giới thiệu nhập tự động là nhắc kiểm tra, không bổ sung điều kiện cứng mới trên server.
6. **Kiểm tra vị trí** mở phần sửa tọa độ. **Ghi chú nội bộ** mở ô ghi chú riêng cho admin.
7. **Lưu đề xuất** lưu chỉnh sửa, giữ nguyên nội dung khách đang xem. **Xem trước xuất bản** mở bước xem trước; việc xuất bản vẫn là thao tác riêng và bị chặn nếu thiếu ảnh bìa hợp lệ hoặc vi phạm quy tắc hiện hành.

Đổi tab giữ dữ liệu chưa lưu. Khi dữ liệu không hợp lệ, trang tự mở tab chứa trường lỗi và chuyển focus tới trường đó. Tab hỗ trợ phím trái/phải/Home/End; cửa sổ ảnh có nền tối, thanh thao tác riêng và hỗ trợ Escape, nút đóng hoặc bấm vùng nền ngoài để đóng. Bấm vào ảnh hoặc kéo từ trong ra ngoài không tự đóng. Thanh lưu cố định và các phần xếp dọc trên màn hình nhỏ.

## Kiểm tra

Bộ browser `tests/catalog.playwright.config.ts` dùng API và MongoDB test riêng, provider ảnh fixture có nhãn. Bao phủ lưu/tự lưu, giữ bản công khai, phục hồi đề xuất, xuất bản theo lô, responsive 320/390 px và viewport tương đương zoom 200%, đổi tab giữ form, lỗi nguồn trong tab ẩn, bàn phím và đóng/chọn ảnh. Không coi ảnh fixture là ảnh thật hoặc kiểm thử provider live.

Đã kiểm chứng cho lượt refine: `npm run typecheck`, `npm run lint`, `npm run build`; 5/5 catalog browser tests với dữ liệu test riêng. Đã xem ảnh chụp desktop và màn hình 320 px. Build còn cảnh báo chunk client trên 500 kB từ trước; không có lỗi build. Không chạy lại toàn bộ integration stress suite cho thay đổi giao diện này.

## Bổ sung ảnh bìa mặc định — 25/10/2026

Owner cập nhật CAT-20: tự chọn ảnh đầu tiên cho draft chưa có ảnh và không khóa images; admin đổi ảnh bằng **Dùng làm ảnh bìa**, không cần bước duyệt riêng. Thông tin ảnh trong editor thu gọn; giữ metadata và ghi công public. Thay các hướng dẫn duyệt thủ công bắt buộc ở phần trước.

Schema đã triển khai: photo.selection optional enum automatic/admin; reviewed vẫn là boolean, không tự gán true cho ảnh tự chọn. imageSearch.defaultCover photo|null giữ ảnh đầu tiên ổn định qua retry. Backfill ứng viên Cloudinary cũ khi thiếu defaultCover, không đổi editorial revision/publication. DTO draft và bulk áp dụng defaultCover khi images rỗng, không khóa; save/publish lưu vào snapshot. Ảnh đã chọn và public không bị thay. GET images bổ sung defaultCover để form đang mở cập nhật khi worker hoàn tất. Gate chấp nhận selection automatic/admin hoặc reviewed=true, metadata hợp lệ và không phải AI. Không tự xuất bản.

Cập nhật tương tác ảnh: nút **Chọn làm bìa** trên thumbnail chọn ngay trong form; **Lưu đề xuất** giữ thay đổi. Bấm trực tiếp thumbnail chỉ mở ảnh lớn trên nền tối, không có khung/thông tin/nút chọn ảnh trong viewer. Bấm ngoài, × hoặc Escape để đóng và giữ bìa hiện tại. Thay các hướng dẫn chọn ảnh qua hộp thoại ở trên. Đã kiểm tra component thật trên trình duyệt desktop/mobile với API ảnh fixture, không khởi tạo DB test do giới hạn dung lượng ổ đĩa.
