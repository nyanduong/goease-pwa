# Lịch trình offline chỉ xem

## Sử dụng

Mở chuyến đã lưu → Thông tin chuyến đi → Lưu để xem offline. Nút Cập nhật bản offline lấy bản mới nhất đã commit trên server; không xuất nháp chưa lưu. Mở Bản offline từ danh sách chuyến hoặc Mở lịch trình offline trong phần thông tin. Khi đã tải thành công, mở lại hoặc reload URL ứng dụng lúc mất mạng sẽ vào màn đọc riêng.

Màn đọc có danh sách, từng ngày/điểm dừng/giờ/ghi chú, ngân sách và dự toán đã biết, cảnh báo khoản chưa rõ và thời điểm tải. Không nhập/sửa dữ liệu, không queue mutation hoặc gọi AI. Không tải thực chi, ảnh, bản đồ, share link, profile, token hoặc response xác thực. Có thể xóa từng bản tải xuống mà không xóa chuyến trên server. Giới hạn10chuyến và2triệu ký tự JSON mỗi trình duyệt; quota thực tế còn tùy browser. Khi cập nhật lỗi/thiếu quota, bản cũ không bị ghi đè.

## Dữ liệu và quyền

Tái sử dụng GET /api/v1/auth/me và GET /api/v1/trips/:id. Download kiểm tra owner hiện tại, lấy snapshot API và kiểm tra generation của local owner trước commit synchronous. Một tài khoản trên một browser origin; chuyển account xóa dữ liệu account trước. Trên máy dùng chung, người dùng browser có thể đọc bản đã tải khi chưa logout; đây không phải kho mã hóa/PIN và không phải quyền truy cập server.

localStorage contract v1:

- goease:offline:owner:v1: {id,epoch}; generation ngẫu nhiên đổi khi owner đổi/xóa, chặn download đang chờ hồi sinh dữ liệu sau logout.
- goease:offline:data:v1: {version:1,owner:{id,epoch},apiBase,items:[{savedAt,trip}]}; trip lấy fields TripInput được parse và ID/revision/destinationName/updatedAt/summaryTotals/budgetSummary hiện có. Không lưu expense hoặc dữ liệu xác thực. Một JSON bounded, setItem thay nguyên tử, không partial overwrite.
- goease:offline:logout:v1: {apiBase}; marker không chứa thông tin cá nhân, chỉ dùng hoàn tất logout API sau mất mạng; xóa khi server xác nhận. Không queue nghiệp vụ khác.

Đăng xuất xóa owner/snapshot ngay, các tab cập nhật qua storage event; app xóa state riêng. Server logout dùng endpoint có sẵn. Khi mất mạng, local đã xóa nhưng cookie HttpOnly chưa thể thu hồi trên server; marker buộc hoàn tất logout trước khi app kiểm phiên/cho login mới. Reader tự retry khi online. Clear browser site data cũng xóa snapshot. Browser có thể tự giải phóng storage, không hứa lưu vĩnh viễn.

Khi có mạng, reader kiểm auth rồi kiểm các trip đã tải: null/401/403 xóa bản riêng; trip404 bỏ bản đó. Xóa trip qua app cũng bỏ bản offline tương ứng. Không tự replace snapshot khi nội dung thay đổi: customer bấm Cập nhật. Mất mạng không thể biết ngay việc phiên bị thu hồi/chuyến bị xóa từ thiết bị khác; bản cũ chỉ bị vô hiệu khi kết nối và kiểm tra được. Các lần xóa/đổi owner ngăn response kiểm tra cũ ghi lại snapshot. Token share không bao giờ tải/cache.

## Service worker và triển khai

Service worker /sw.js chỉ cache3file công khai /offline.html, /offline.js, /offline.css trong goease-offline-shell-v1. Không cache SPA authenticated HTML, API hoặc asset bên ngoài. Navigation dùng network trước, lỗi transport mới fallback offline.html. API requests luôn đi network; mọi mutation cần mạng. Vite public copies các file này vào dist, cả dev và production dùng cùng reader. Không dependency/library/provider mới, không DB collection/schema/index/migration.

HTTPS hoặc localhost là bắt buộc cho service worker. Host production cần phục vụ /sw.js và3file thật ở web root trước SPA fallback, đúng MIME JavaScript; API như cấu hình hiện có. apiBase public được lưu để reader dùng cùng API khi web/API khác origin. CSP nếu có cần cho phép các file cùng origin và API origin. Cache version phải tăng khi đổi nội dung reader; install cache shell hoàn chỉnh trước activate, chỉ dọn cache goease-offline-shell-* của ứng dụng. Logout giữ public shell nhưng xóa dữ liệu chuyến. Chưa có manifest/install prompt/native mobile/offline map; không gọi tính năng này là nghiệm thu installable PWA.

## Kiểm tra

Browser test trong foundation.spec.mts dùng API/Mongo thật và service worker thật: lưu/cập nhật,503 giữ bản cũ, chuyển offline/reload/new tab, xem notes/giờ/dự toán, HTML note chỉ text, không input chỉnh sửa,320/390/768px, cache allowlist, remote delete revalidation, logout offline/xóa cross-tab, reconnect thu hồi server session và account khác không đọc dữ liệu cũ. Xem PRODUCT-VERIFICATION.md cho kết quả đã quan sát. Không có xác nhận điện thoại vật lý, hosting production hoặc browser eviction lâu dài.
