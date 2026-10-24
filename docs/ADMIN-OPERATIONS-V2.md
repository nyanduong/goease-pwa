# Admin Operations V2

Triển khai theo yêu cầu owner ngày 24/10/2026. Sáu ảnh là tham chiếu thiết kế; các con số, địa điểm, connector và thời tiết trong ảnh không phải dữ liệu thật. Không thêm Google Maps/Foody/Booking/Traveloka/Tripadvisor giả.

## Vận hành

Chạy `npm run dev`, mở `http://localhost:5180/admin`, đăng nhập account có role admin. Cấp role bằng quy trình operator trong ADMIN-CATALOG.md; không tự nâng quyền qua đăng ký/profile. API cần MongoDB replica set hiện có. Không đổi stack, database hay quyền sở hữu chuyến.

1. **Tổng quan:** chọn khu vực; xem số địa điểm, bản nháp, đã xuất bản, khoảng trống dữ liệu, bản đồ và kết quả nguồn. KPI mở danh sách/bộ lọc tương ứng.
2. **Tự động cập nhật:** chọn khu vực trên topbar. Chạy thử mở công cụ preview; chọn nhóm và 30/50 kết quả. Xem bằng chứng, nghi trùng, chọn mục để nhập bản nháp. Chạy ngay tạo persisted job phía backend. Lịch ngày/tuần lưu MongoDB, dùng Asia/Ho_Chi_Minh; backend phải chạy, không cần mở browser.
3. **Việc cần làm:** tìm theo tên/địa chỉ, lọc loại việc; nội dung đang xuất bản được xếp trước. Mở so sánh nguồn, biên tập, áp dụng, giữ, từ chối có lý do, yêu cầu chỉnh sửa, hẹn xem lại hoặc xác nhận hai địa điểm riêng. Bỏ qua việc và từ chối đều yêu cầu lý do, giữ nguyên nội dung và trạng thái hiển thị. Archive là thao tác riêng trong danh mục.
4. **Địa điểm:** table, search, bộ lọc khu vực/nhóm/trạng thái/nguồn/giá/giờ/vị trí, sắp xếp và phân trang server 20 mục. Bản đồ hiển thị kết quả trang hiện tại; ghim mở editor. Batch chỉ tác động ID/revision đã chọn, có preview điều kiện trước xác nhận.
5. **Editor:** tên, loại, mô tả, địa chỉ, thời lượng ước tính, giờ, giá và điều kiện, nguồn, tọa độ, ảnh có quyền và ghi chú riêng. Tự lưu là tùy chọn cho **bản nháp đã có ID và hợp lệ**, sau 2 giây; không tự xuất bản hoặc tự lưu nội dung đang published. Tên mới được kiểm tra với danh mục cùng khu vực trước khi lưu; cảnh báo chỉ so khớp tên, không khẳng định mọi tên gần giống là trùng. Xem trước trước khi xuất bản. Thiếu giá đủ điều kiện thì vẫn chỉ lưu nháp theo CAT-14.
6. **Lịch sử & phê duyệt:** nhật ký và hàng đợi review là hai phần riêng. Nhật ký có tên người thao tác, thời điểm và ghi chú quyết định. Phiên bản trong editor cho khôi phục nội dung cũ thành **bản nháp mới**, không tự xuất bản lại. Archive có thể mở để lưu nháp rồi xuất bản theo kiểm tra hiện tại.
7. **Nguồn dữ liệu:** chỉ báo connector thật, số record, lần thử, lần thành công và lỗi cuối. Khóa đã cấu hình không đồng nghĩa kết nối thành công. Giữ attribution Geoapify/OSM và giấy phép. Nguồn theo từng trường so sánh nội dung hiện tại với quan sát nguồn gần nhất, không tự đánh dấu verified.
8. **Cài đặt:** khu vực mặc định, ngày nhắc kiểm tra, hiển thị cảnh báo tổng quan, auto-apply giờ của bản nháp chưa biên tập, phạm vi nhập theo khu vực. Lưu có revision, reload/restart đọc lại backend.

## Khu vực và nguồn

Geoapify đọc `GEOAPIFY_API_KEY` chỉ trên server; restart API khi thay cấu hình. Không có biến VITE chứa secret. Thiếu khóa/lỗi nguồn hiển thị hướng xử lý, không báo thành công. Một provider được dùng cho dữ liệu OSM có stable identity; chưa có adapter nguồn thứ hai để tuyên bố kiểm chứng đối chiếu đa provider.

Hội An giữ cấu hình cũ: 15.88, 108.328, bán kính 5.000 m. Trong Cài đặt → Phạm vi nhập theo khu vực, chọn destination có sẵn, nhập tọa độ đã kiểm tra và bán kính 500–10.000 m; thêm ở trạng thái tắt, bật và lưu để kích hoạt. Không tự seed thêm địa điểm/khu vực. Khu vực chưa cấu hình bị chặn trước khi gọi nguồn. Đây là phạm vi hình tròn, chưa hỗ trợ polygon/ranh giới hành chính hay suy ra phường xã từ tọa độ.

Lịch và lượt chạy phân theo scope; scope `hoi-an` giữ tương thích dữ liệu cũ, khu vực mới dùng destination ID. Quota toàn hệ thống vẫn chung, không nhân hạn mức theo số khu vực. Import mới thành draft; không tự đổi destination của external identity đã có. Scheduled run có persisted lease/fencing, giới hạn thử lại và backoff hiện có. Preview có hạn 15 phút trong bộ nhớ; restart cần preview lại. Commit thủ công vẫn là giao dịch hữu hạn tối đa 50 mục; chưa chuyển commit preview thành job riêng.

## Quy tắc và định nghĩa

- Publication giữ `draft / published / archived`. Review/quality là thông tin độc lập, không biến mọi cảnh báo thành trạng thái địa điểm.
- Completeness = số tiêu chí đạt / 6, làm tròn phần trăm: tên không chứa ghi chú rà soát, mô tả, địa chỉ, thời lượng, nguồn, giá đủ điều kiện. Không là độ tin cậy, xác suất chính xác, hay xác nhận cơ sở ngoài thực tế.
- KPI cần kiểm tra = số địa điểm chưa archive có ít nhất một issue. Checklist bổ sung giờ, tọa độ, thông tin ảnh và tuổi nội dung. Ngày cập nhật nguồn, ngày biên tập và ngày kiểm tra giá không được gọi là cùng một ngày xác minh.
- Các việc draft/source/duplicate/price/quality được giữ ổn định theo signature. Published có khoảng trống tạo quality task; source/duplicate được xử lý trước task thông thường. Nguồn không đổi không tự mở lại quyết định đã xử lý. Yêu cầu chỉnh sửa giữ review mở; hoãn có ngày hẹn.
- Auto-apply mặc định tắt. Khi bật, chỉ thay đổi duy nhất giờ mở cửa, record còn draft, giờ biên tập vẫn bằng nguồn trước, không nghi trùng/review nguồn đang mở. Tên/vị trí/loại hình/đóng cửa không được tự áp dụng. Mỗi thay đổi an toàn vẫn có revision/version/audit.
- Giá unknown là null; miễn phí chỉ dùng 0 khi có căn cứ. Thời lượng vẫn là ước tính biên tập. Planner tiếp tục kiểm tra published, giá/nhóm khách và giờ đọc được; dữ liệu thiếu không tự biến thành lịch thành công. Chuyến đã lưu giữ snapshot.
- Ảnh tối đa 8 URL HTTPS, có tác giả, link bằng chứng và loại quyền sử dụng. Người nhập xác nhận đã kiểm tra quyền; đây không phải cơ chế tự kiểm chứng bản quyền. Ảnh đầu là ảnh đại diện; khách thấy ghi công/link nguồn. Chưa có upload/storage ảnh, quét nội dung ảnh, hoặc kiểm tra URL ảnh định kỳ ở server.
- Bản đồ dùng Leaflet/OSM, marker từ dữ liệu lưu, có thiếu vị trí/loading/error/retry. Chọn bản đồ là vị trí do admin cung cấp, không tự chứng minh đúng địa chỉ/lối vào.

## API mới và mở rộng

Tất cả dưới `/api/v1/admin`, qua session/admin/origin/no-store hiện có. Mutations quan trọng vẫn kiểm tra role bên trong transaction. Contracts thuần TypeScript/Zod trong `packages/contracts`.

| API                                          | Consumer / hành vi                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET `/catalog/overview?destinationId=`       | Dashboard/source quality, giới hạn 5.000 record để tổng hợp, projection bản đồ tối đa 500 |
| GET/PUT `/catalog/settings`                  | Cấu hình toàn hệ thống, `expectedRevision`; lưu cùng audit                                |
| GET `/places/:id/versions`                   | 30 bản gần nhất; không public snapshot endpoint                                           |
| POST `/places/:id/restore`                   | revision nguồn + expectedRevision hiện tại + Idempotency-Key, tạo draft qua catalog write |
| GET `/places`                                | Thêm destinationId/category/source/quality/sort, total, phân trang 20                     |
| POST/PATCH `/places`                         | Thêm mapLocation, internalNote, images; DTO thêm ảnh đại diện/credit                      |
| GET `/catalog/reviews`                       | Thêm destinationId/kind/q; published ảnh hưởng trực tiếp ưu tiên trước                    |
| POST `/catalog/reviews/:id/decision`         | Thêm note/reject/revise/publish, quyết định/version/audit trong transaction               |
| GET `/catalog/operations?destinationId=`     | Lịch và 30 run gần nhất của khu vực                                                       |
| PUT `/catalog/schedule`, POST `/catalog/run` | destinationId tùy chọn, tương thích mặc định Hội An                                       |
| POST `/place-import/preview`                 | destinationId tùy chọn, phạm vi từ cấu hình server                                        |

Không thêm dependency. API customer chỉ thêm gallery metadata công khai, không internalNote hoặc lịch sử quản trị.

## Database và phục hồi

`catalog_settings`: singleton global có revision, defaultDestinationId, freshnessDays, showQualityAlerts, autoApplyDraftHours, regions tối đa 20. `catalog_versions`: snapshot place riêng, unique placeId/revision; giữ baseline trước mutation đầu tiên sau nâng cấp và các revision mới có audit. `catalog_decisions`: quyết định append với actor/reason/time/operationId/revision, tách audit metadata. Các phiên bản trước khi có cơ chế này không thể tái dựng từ audit cũ.

Startup tạo collection/index mới bằng initialize hiện có. Không drop/syncIndexes/backfill destructive, không đổi MongoDB service 27017 hoặc database khác. Không có purge/retention tự động mới. Restore không hoàn tác snapshot nguồn đã thu thập, trip history, run hoặc quyết định; chỉ phục hồi writable editorial fields và tạo revision mới ở trạng thái draft.

## Giới hạn còn lại

Chưa có connector ngoài Geoapify/OSM, import file, polygon địa giới, ảnh upload, xác minh độc lập nguồn cho từng trường, dashboard thống kê xu hướng theo ngày, hoàn tác hàng loạt, bulk review decisions, địa chỉ tự geocode hoặc chuẩn hóa giờ từ văn bản tùy ý. Lịch sử sự kiện vẫn toàn hệ thống; topbar khu vực áp dụng dashboard, danh mục, review và lịch chạy. Không triển khai các nút giả cho những phần này. Chưa có kiểm thử Google OAuth/booking/payment hoặc production deployment trong task này.

Bằng chứng lệnh, thử nguồn thật và ảnh nghiệm thu: [ADMIN-V2-VERIFICATION.md](ADMIN-V2-VERIFICATION.md).
