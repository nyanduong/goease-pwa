# Kiểm tra UI độc lập

Trang này chỉ dùng trong development tại cổng **5185**, không được import từ
`src/main.tsx` hoặc build entry production. Không cần backend, MongoDB hay API key.
Fetch API được thay bằng fixture trong tab này; mọi mutation/provider trả lỗi,
không giả thông báo lưu, đăng nhập hay AI thành công. Có banner dữ liệu kiểm thử.

Từ root (sau `npm ci` và build packages media/contracts):

```powershell
npm run dev --workspace @goease/client -- --port 5185
```

Mở `/qa/index.html?screen=/` để xem Trang chủ. Có thể thay `screen` bằng
`/trips`, `/trips/new`, `/trips/ffffffffffffffffffffff02`, `/account`, `/explore`,
`/places/100000000000000000000001`, `/saved`, `/budget`, `/goe`, `/trips/trash`.
Thêm `&guest=1` để xem trạng thái khách, đăng nhập hoặc đăng ký.
Mở `?screen=/admin&admin=1` để xem vỏ quản trị và trạng thái danh mục trống;
đây là fixture giao diện, không cấp quyền trên backend.
Khi tải lại hoặc đổi màn bằng URL, bắt đầu lại từ `/qa/index.html?screen=...`.

Kiểm tra 320/390/768/1440 px, chữ lớn, nhãn dài, dialog và reduced motion.
Đây là bằng chứng UI với fixture, không thay kiểm thử backend/provider/native.

## Bàn giao giao diện 25/10/2026

Nền kiểm tra: `main` tại `1e88520` (bao gồm avatar, tự khôi phục kết nối,
Goe nổi và quản trị V3). Phần thay đổi riêng của nhánh UI chỉ nằm trong `client/`;
không đổi server, contracts, lockfile hoặc repo app chính.

- Theme kem `#FFF8EF`, chữ `#123E4B`, teal `#00858C`/`#006F78`, cam `#F58220`;
  giữ logo, slogan và ảnh hiện có. Không nhập source React Native từ repo cũ.
- Trang chủ: lời chào/phong cảnh → chuyến đi → lối tắt → tìm/lọc điểm đến.
  Thứ tự DOM giống thứ tự hiển thị để dùng bàn phím và screen reader.
- Form, bước tạo chuyến, ngày/lịch trình, chi phí, tài khoản, khám phá/đã lưu,
  Goe, chia sẻ và bản offline dùng chung kiểu chữ, surface và nút.
- Giữ menu mới Khám phá / Chuyến đi / Trang chủ / Đã lưu / Tài khoản,
  thêm đoạn nền chuyển động; tôn trọng reduced motion. Không đổi định vị/kéo Goe.
- Hộp sửa hoạt động cuộn dọc, không cuộn ngang ở 320px. Nút hiện mật khẩu
  giữ vị trí khi nhấn. Nút camera giữ vùng chạm tối thiểu44px.

Đã quan sát bằng trình duyệt với fixture: 14 màn tại320/390/768/1440px
(56 lượt), tám phân trang quản trị tại390/1440px (16 lượt), không tràn ngang.
Có kiểm tra thêm tên dài, mở/đóng hộp sửa bằng Escape, hiện/ẩn mật khẩu,
tab chi phí và cửa sổ Goe nổi. Quản trị dùng dữ liệu trống/lỗi có nhãn,
không chứng minh bảng đông dữ liệu hoặc quy trình xuất bản thật.

`format:check`, ESLint, TypeScript frontend/fixture và build frontend được chạy
trước push; kết quả CI trên GitHub cần xem riêng theo commit cuối.
Build còn cảnh báo chunk JavaScript lớn; không đổi dependency hay logic để
xử lý ngoài phạm vi UI. Ảnh/JSON quan sát lưu ở `.local/ui-brand-qa/`, không commit.

Chưa nghiệm thu đăng nhập, upload, AI, lưu MongoDB hoặc quyền thật trong lần này.
Lệnh khởi động API preview bị cơ chế duyệt tự động chặn; chỉ tiếp tục bằng
fixture frontend riêng, không sửa cấu hình hoặc tìm cách khởi động API khác.
Chưa thử trên điện thoại vật lý/bàn phím hệ thống.
