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
