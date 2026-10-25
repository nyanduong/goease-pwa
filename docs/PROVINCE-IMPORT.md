# Thu thập địa điểm sau khi bật tỉnh — CAT-19

## Demo admin

1. Mở Admin → Cài đặt → tìm tỉnh → Bật. Khung “Lấy địa điểm tham quan” mở và tự tạo đợt lấy nháp.
2. Nếu tỉnh đã bật, bấm “Lấy địa điểm”. Trong cùng phiên browser, hệ thống khôi phục request cũ để không nhập lại do reload. “Xem tiến trình” mở danh sách đợt thu thập lọc theo tỉnh, chỉ đọc và không tự tạo lượt lấy mới.
3. Chờ tiến trình kết thúc. Xem số nháp mới, không đổi, cần kiểm tra và bỏ qua. “Hoàn tất” có thể có 0 nháp mới; không suy ra đã lấy hết tỉnh.
4. Bấm “Kiểm tra bản nháp và xuất bản theo lô”. Danh sách chỉ tỉnh được chọn, trạng thái nháp; bộ lọc loại/nguồn cũ được xóa.
5. Kiểm tra tên, địa chỉ, vị trí, nguồn và ngoại lệ; chọn các mục đạt → Xem trước xuất bản → Áp dụng các mục đủ điều kiện. Giá chưa rõ vẫn có thể khám phá nhưng chưa chắc đủ cho Goe/dự toán.
6. Muốn lấy Hội An hoặc Sa Pa, mở lại khung lấy nguồn, chọn “Vùng lấy tiếp”, rồi “Lấy thêm vào nháp”. Đợt đang chạy/tạm dừng phải hoàn tất hoặc xử lý trong Đợt thu thập trước khi tạo đợt khác cùng tỉnh.

Nguồn lỗi: tỉnh vẫn bật, chưa có nghĩa đã nhập địa điểm. Nhấn Thử lại lấy địa điểm cho cùng request; lỗi worker thì mở Đợt thu thập để retry phần lỗi. Browser có thể đóng sau khi đợt được lưu; API worker tiếp tục. Nếu đóng giữa toggle và tạo đợt, dùng nút lấy địa điểm để tiếp tục. Bật/tắt qua API toggle trực tiếp không tự tạo đợt.

## Phạm vi và hợp đồng

`POST /api/v1/admin/v3/province-imports`, session admin + Origin/CSRF hiện có + `Idempotency-Key` UUID. Body strict `{destinationId, areaName?}`; tên vùng chỉ từ bundle server. Response `CampaignDetail` hiện có. Mới dùng nhóm `sights`, tối đa 50 kết quả, không có autoPublish từ client.

Geocoding chỉ gọi fixed origin Geoapify, country VN, loại locality, tối đa 5 kết quả; kiểm schema/name/country và loại bỏ tỉnh không khớp nếu nguồn có state. Tên khu vực con được tìm kèm tỉnh cha, chuẩn hóa tiền tố hành chính (ví dụ Phường Sa Pa); ưu tiên city. Nhiều biểu diễn cùng tên có tâm cách nhau tối đa 1 km dùng kết quả đầu của nguồn; các tâm xa nhau bị từ chối là mơ hồ. Timeout 20 giây, body 64 kB, không lưu URL có key/raw payload. Lookup có quota và bản ghi usage `group=geocode` riêng; không coi số request là credits. [Tài liệu Geoapify](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/).

Phạm vi đã cấu hình và bật được ưu tiên cho lượt mặc định. Nếu chưa có, tra tên tỉnh làm tâm vùng tròn 10 km. Chọn tên khu vực tường minh thì tra lại khu vực đó. Vòng tròn không phải polygon hành chính; POI nhập là đề xuất cần đối chiếu địa chỉ và tỉnh trước khi xuất bản. Không tuyên bố đã thu thập cả tỉnh hoặc tự chia ô/paginate toàn quốc. Hiện chỉ Geoapify/OSM; chưa thêm nhà cung cấp khác.

Không sửa `catalog_settings` hoặc schedules. `catalog_runs.scopeSnapshot` thêm `areaLabel?` (tối đa 100), `areaSource?` (geoapify/configured); legacy vẫn đọc được. Campaign hash của luồng này có namespace `provinceImport` để không replay nhầm với campaign thường. Run/campaign/audit cùng transaction; fetch ngoài transaction. Snapshot, nháp, duplicate review và xuất bản theo lô tiếp tục dùng cơ chế hiện có; không có collection mới.

## Kiểm chứng

Đã chạy local ngày 25/10/2026:

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt; build còn cảnh báo chunk chính trên 500 kB.
- `npm test`: 67/67 đạt, gồm từ chối tên mơ hồ/sai quốc gia/sai tỉnh, quá dung lượng, lỗi nguồn và nhận diện nhãn phường/tên trùng.
- Integration `province-import.integration.ts`, `catalog-operations.integration.ts`, `catalog-publication.integration.ts`: 24/24 đạt. Có quyền customer, tỉnh tắt, lookup lỗi, replay, concurrent request, tắt tỉnh trong lúc lookup, nháp trước publish, dedupe, giữ nội dung public, lỗi provider, worker fencing/quota và audit rollback.
- `npm run test:catalog-browser -- --reporter=line`: 5/5 đạt. Bật tỉnh → nhận nháp → reload → khôi phục đợt → danh sách đúng tỉnh → preview → xuất bản thành công; sau publish danh sách draft rỗng. Kiểm tra không tràn ngang ở chiều rộng 390 và xem ảnh chụp UI.
- Smoke geocoding thật qua CLI cho Hà Nội, Đà Nẵng, Hội An/Đà Nẵng và Sa Pa/Lào Cai trả tọa độ hợp lệ. Đây là lookup vùng, chưa phải nhập POI thật end-to-end hoặc bằng chứng dữ liệu đầy đủ. CLI smoke không ghi catalog hoặc usage của API.

Ca concurrent lookup phát hiện và đã sửa lỗi retry quota với embedded document Mongoose: cập nhật các mảng quota bằng update trong cùng transaction, giữ nguyên giới hạn và điều kiện cạnh tranh. Các integration/browser dùng provider fixture có nhãn và MongoDB test riêng; không bật tỉnh hay nhập fixture vào goease thật. Chưa triển khai Atlas/production.

## CAT-20 update

Sau khi nhập POI, worker tự tìm ảnh Wikimedia vào ứng viên nháp. Admin chọn ảnh thật và Lưu đề xuất trước khi xuất bản. Thiếu ảnh đã duyệt là blocker, không dùng AI fallback. Các kết quả kiểm thử phía trên là mốc CAT-19 trước gate ảnh; xem WIKIMEDIA-PHOTOS.md cho luồng mới.
