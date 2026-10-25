# Hộp thoại xác nhận trong ứng dụng

Ngày 25/10/2026: thay 22 lời gọi `confirm()` / `window.confirm()` bằng `confirmAction()` và `ConfirmationHost` dùng chung, đặt tại root ứng dụng. Modal dùng màu GoEase, tiêu đề và nhãn nút mô tả hành động cụ thể; thao tác xóa/thu hồi dùng màu cảnh báo riêng. Nội dung người dùng được render thành text React.

Phạm vi đã rà:

- Admin: rời editor/đổi trang danh mục khi chưa lưu, mở địa điểm trùng, ngừng hiển thị địa điểm, tắt tỉnh/thành, chuẩn bị phục hồi phiên bản, chấp thuận xuất bản.
- Chuyến đi: rời trang/bỏ bản nháp, tạo chuyến mới từ địa điểm, đổi khoảng ngày/khu vực làm mất điểm dừng, xóa điểm dừng.
- Khám phá: rời ghi chú chưa lưu, tải lại ghi chú, thêm lại địa điểm đã có trong ngày.
- Tài khoản, khoản chi, chia sẻ: tải lại hồ sơ đang sửa, đóng form chi chưa lưu/kết quả chưa rõ, xóa khoản chi, đóng thao tác chuyến chưa rõ kết quả, thu hồi link.

Caller phải `await` kết quả trước khi điều hướng, thay state hoặc gửi mutation. Escape, nút đóng và nút hủy đều trả false. Modal giữ focus bằng Tab/Shift+Tab, focus nút hủy lúc mở và trả focus về nút mở còn tồn tại lúc đóng. Dùng native HTML dialog ở top layer, kể cả khi mở trên một Sheet; Escape ở lớp xác nhận không đóng lớp bên dưới. Scroll body được khóa trong thời gian mở. Các yêu cầu đồng thời được xếp hàng, không ghi đè callback; back/hashchange hoặc mất phiên hủy yêu cầu đang chờ. Effect đổi trang catalog có AbortSignal để hủy xác nhận khi effect cũ hết hiệu lực.

Giữ 5 guard `beforeunload` bảo vệ nội dung chưa lưu khi đóng tab/reload/rời website. Đây là hộp thoại do trình duyệt sở hữu, không thể thay bằng modal bất đồng bộ hoặc tùy biến nội dung. Các thông báo lỗi nội tuyến `role="alert"`, loading và status vẫn phục vụ phản hồi tại form.

Không đổi API, contracts, quyền, quy tắc xác nhận, schema MongoDB hoặc registry. Test `tests/confirmation.spec.ts` kiểm hủy/đóng/Escape/Tab, giữ bản nháp, chấp nhận bỏ nháp, xác nhận lồng trên Sheet khoản chi, không DELETE trước xác nhận và desktop/mobile 390/320px. Test cài đặt được chuyển sang thao tác modal để tiếp tục kiểm bật/tắt tỉnh với database test riêng. Ảnh tại `test-results/confirmation-evidence/`, không commit. Kết quả thực chạy được ghi trong bàn giao.

Kiểm chứng local: typecheck, lint, build, format các file thay đổi và diff check đạt. Lượt browser cuối đạt 3/3 (2 luồng modal và cài đặt), dùng Edge/API/MongoDB test riêng. Đã xem ảnh desktop 1440px, mobile 320px và xác nhận xóa trên 390px; Escape giữ Sheet bên dưới, sau khi đóng không để body bị khóa cuộn. Rà lại `client/src` không còn lời gọi native alert/confirm/prompt. Chưa chạy toàn bộ E2E/integration; không sửa dữ liệu goease thật. Build giữ cảnh báo bundle lớn hơn 500KB hiện hữu.
