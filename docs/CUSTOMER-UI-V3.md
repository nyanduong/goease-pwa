# Customer UI V3 — 04/11/2026

Nhánh `V3-ui-customer`, dựa trên main `3b2c6fd` sau khi PR AI #3 đạt CI và được merge.

- `/account` chỉ hiển thị thông tin tóm tắt và các mục điều hướng.
- `/account/profile`: sửa tên, chọn/căn ảnh, xem trước và lưu qua API hiện có. Ẩn điều hướng dưới và Goe khi chỉnh sửa để không che biểu mẫu. Nhắc bỏ thay đổi khi dùng nút quay lại.
- `/account/password`: trang độc lập, giữ kiểm tra và API/idempotency cũ. Không thay mật khẩu người dùng trong kiểm thử giao diện.
- `/account/preferences`: tùy chọn linh vật riêng.
- Login/register có lối quay về trang chủ, không yêu cầu đăng nhập để quay lại.
- Ngày khởi hành dùng lịch dạng sheet, giữ số ngày khi đổi ngày bắt đầu.
- Header hành trình có nền đặc khi cuộn. Timeline tách ảnh 62px, nội dung co giãn và menu thao tác; tiêu đề dài xuống dòng thay vì tràn hoặc đè ảnh.

## Kiểm tra thực tế

375×667: mở hồ sơ từ tài khoản, quay lại, mở đổi mật khẩu, login/register và lối quay về app, lịch chọn ngày 05/11/2026, timeline chuyến demo. Đo DOM: ảnh và chữ nằm hai cột tách biệt, không tràn ngang. Chọn ảnh test trên tài khoản demo, căn chỉnh, lưu, tải lại vẫn thấy ảnh Cloudinary; sau đó đã khôi phục ảnh mặc định. Không đổi mật khẩu thật. Không gọi lại AI khi kiểm tra UI.

Ảnh kiểm tra tại `docs/ui-customer-v3/evidence/`.

## Rà soát đồng bộ 19 phản hồi UI

- Back: chevron không nền/viền; tim và chuông bỏ khung trang trí, trạng thái lưu tô hồng và nhấn co nhẹ, có reduced-motion.
- Header customer cuộn theo nội dung, không trong suốt nằm đè; bỏ nhãn trang Khám phá/Đã lưu/Tài khoản trùng điều hướng.
- Timeline bỏ đường nối/chấm trang trí; giờ, ảnh, nội dung và menu có cột riêng. Phần gợi ý lịch dùng tiêu đề ngắn, thông tin ngày/khách và icon hướng dẫn.
- AppInfo tái sử dụng nút ! nhỏ và dialog cho hướng dẫn ảnh, lịch trình, chi phí, địa điểm, bản đồ và ghi nguồn ảnh. Giữ trạng thái lỗi/đang xử lý và số tiền chưa rõ để tránh hiểu nhầm.
- Thẻ tài khoản là nút chỉnh sửa có icon bút, hỗ trợ bàn phím. Trang bản quyền `/account/credits` liệt kê Geoapify/OSM/ODbL và nguồn ảnh địa điểm công khai theo từng trang 20 mục. Attribution tích hợp trong bản đồ vẫn giữ.
- Saved: ảnh 88px bên trái, chữ tự co ở cột phải, nút lưu riêng; không dùng overlay chữ của khám phá.
- Home: ô tìm kiếm đưa ra khỏi banner. Chat: header gọn với nút phiên mới/cog/!, chọn chuyến tối đa 160px rồi cuộn, log riêng và composer không tràn. Phiên mới xóa hội thoại/đề xuất đang xem, không tự gọi AI hoặc tự áp dụng lịch.

### Bằng chứng kiểm tra

Routed render tại 375×667: welcome, login, register, forgot-password, reset-password (không có token nên chỉ kiểm trạng thái thiếu token), home, explore, saved, trips, trash, notifications, account, profile, password, preferences, credits, budget, goe, tạo chuyến và calendar. Với chuyến demo đã mở timeline/map/cost/summary. Kiểm thẻ saved có dữ liệu, popup !, chọn chuyến trong chat rồi phiên mới (không gửi AI), ảnh-chữ tách cột, không tràn ngang. Header profile có computed position static. Password không nhập hay đổi credential. Shared-trip đã rà nguồn/component/CSS dùng chung; chưa kiểm một link chia sẻ hợp lệ vì không có token công khai sẵn.

Ảnh mới: `docs/ui-customer-v3/evidence/refinement/`. Không phải nghiệm thu toàn bộ nghiệp vụ backend hoặc thiết bị iOS thật.

## Điều chỉnh theo phản hồi mới nhất

- Giữ tiêu đề Khám phá, Đã lưu, Tài khoản và hành trình; header cuộn trong luồng trang, không ghim đè nội dung. Đã đo header hồ sơ từ y=0 xuống y=-97 khi cuộn97px.
- Thẻ Đã lưu tách hàng ảnh/nội dung, hàng tag và nút thêm chuyến; không chồng nhau ở375×667.
- Home dùng logo GoEase, rút khoảng trắng trước banner. Tài khoản tóm tắt bỏ email; email chỉ xuất hiện trong trang chỉnh hồ sơ.
- Nút ! dùng vòng tròn nhỏ, căn giữa; hồ sơ và bảo mật neo góc phải. Bỏ dòng định dạng/dung lượng ảnh thường trực; bộ kiểm tra file vẫn báo khi chọn ảnh không hợp lệ.
- Tim không có nền hoặc khung tròn; tim đã lưu tô hồng, có hoạt ảnh nảy360ms và hỗ trợ giảm chuyển động.
- Khối tùy chọn nâng cao có nền/viền/chevron; chỉ đường dùng biểu tượng mũi tên cùng hàng điểm dừng. Hướng dẫn bản đồ chuyển vào popup !; lỗi tải nền vẫn hiển thị để người dùng biết.
- AUTH-OTP-01: đổi mật khẩu cần mã email6số,10phút, gửi lại sau60giây, tối đa5lần thử, gắn phiên/mật khẩu mới, dùng một lần và rollback cùng giao dịch. Dùng SMTP hiện có, không thêm biến môi trường. Cấu hình SMTP thiếu hoặc gửi lỗi trả lỗi, không bỏ qua OTP.

Kiểm chứng:14kiểm thử integration tài khoản/khôi phục mật khẩu đều đạt, bao gồm OTP hết hạn/sai/khóa/dùng lại, gửi mail thất bại, idempotency, thu hồi phiên và rollback audit. Mail trong kiểm thử dùng sender giả lập; chưa kiểm chứng email OTP đổi mật khẩu gửi tới hộp thư thật. Không đổi mật khẩu người dùng thật. Typecheck, lint, build và git diff --check đạt; build còn cảnh báo bundle lớn hiện hữu.

Ảnh kiểm tra mới tại `docs/ui-customer-v3/evidence/revision-2/`. Bản đồ có lúc không tải được tile OSM trong phiên kiểm tra; vị trí và liên kết chỉ đường vẫn có, không xác nhận dịch vụ bản đồ bên ngoài hoạt động ổn định.

## Đồng bộ mũi tên sổ xuống

Rà nguồn toàn bộ summary/select customer (bộ lọc khám phá/điểm đến, tạo và lưu chuyến, chi tiết địa điểm, ghi chú/chuẩn bị/offline, chi phí, ngữ cảnh chat và cài đặt Goe). Thay ký tự chữ và dấu +/−/› không đồng bộ bằng một SVG mask16px, căn giữa theo hàng, không co khi nhãn dài; mở/đóng xoay180độ. Các select một lựa chọn dùng cùng chevron16px ở cách mép phải12px và giữa chiều cao; giữ native select, bàn phím và focus. Menu dấu ba chấm được loại khỏi quy tắc này. Chuyển động tắt khi reduced-motion.

Kiểm tra trực tiếp375×667: Khu vực đóng/mở và select miền/vùng; tùy chọn tạo chuyến và bàn phím Enter; cài đặt Goe; ghi chú/chuẩn bị/offline hành trình; popup nguồn chi phí; ngữ cảnh chat; giới thiệu/giá giờ của địa điểm. Computed chevron16×16, align-self:center, xoay đúng khi mở; không tràn ngang ở các màn đã đo. Build client và git diff --check đạt. Chỉ CSS frontend/tài liệu/bằng chứng được sửa trong lượt này, không thay nghiệp vụ. Ảnh tại `docs/ui-customer-v3/evidence/disclosures/`.
