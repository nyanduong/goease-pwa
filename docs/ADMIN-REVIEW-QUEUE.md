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

## Sửa lỗi tải hàng chờ — 11/11/2026

Trên catalog local có 26.597 việc, API trả HTTP 500 do `MongoNetworkTimeoutError`: truy vấn aggregate cũ mất khoảng 3 giây khi lọc Đà Nẵng và 10–12 giây khi xem tất cả, vượt `socketTimeoutMS=2000` của kết nối runtime. MongoDB vẫn kết nối và dữ liệu vẫn còn.

Truy vấn mới lọc địa điểm trước, join `catalog_reviews` một lần bằng index `placeId + kind`, rồi lấy cả việc mở và blocker từ cùng mảng tối đa năm loại việc. Bỏ lookup tương quan lặp theo từng review, chỉ giữ field cần cho count/sort trước phân trang. Giữ nguyên quyền admin, blocker nguồn/trùng (kể cả đang hẹn lại), phạm vi, tìm kiếm, count toàn tập, thứ tự và trang 20 việc; không đổi contracts, schema/index hoặc policy nghiệp vụ. Giữ nguyên timeout kết nối runtime.

Đã quan sát aggregate mới trên dữ liệu local toàn tập khoảng 0,7–0,9 giây. Lần đọc đầu sau khi API khởi động vẫn cần đối soát review hiện có; số đo aggregate không bao gồm bước này. Trình duyệt trong phiên admin thật đã tải được danh sách, 26.597 việc, số đếm từng loại và inspector.

Kiểm thử hồi quy `server/test/catalog-review-queue.integration.ts` dùng replica set riêng của harness và chính `createDatabase` runtime (socket timeout 2 giây), kiểm quyền customer/admin, source/duplicate open/snoozed/resolved, hẹn đến hạn, deleted/archived, scope, count qua bộ lọc, sort và phân trang trên 27.000 địa điểm fixture. Không gọi provider thật hoặc dùng database ứng dụng cho fixture.

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npx tsx --test server/test/catalog-review-queue.integration.ts
```

Kiểm chứng đợt sửa: hồi quy 27.000 fixture đạt; `catalog-operations.integration.ts` đạt 11/11 checks; server unit tests đạt 126/126; typecheck, lint, build, Prettier các file sửa và `git diff --check` đạt. Build còn cảnh báo chunk >500 kB hiện hữu. Chưa chạy toàn bộ integration/E2E suite hoặc xác minh bản host/VPS cho thay đổi này.
