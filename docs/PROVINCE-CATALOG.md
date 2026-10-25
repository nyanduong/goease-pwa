# Danh mục tỉnh/thành — CAT-18

Owner chốt ngày 25/10/2026: điểm đến là tỉnh/thành, Hội An và Sa Pa là khu vực bên trong. Admin chỉ bật/tắt; không nhập thủ công tên/slug/mã.

## Sử dụng

1. Chạy `npm run dev`. API đồng bộ danh mục trước ready và worker. Có thể chạy lại `npm run db:seed` trên goease local 27017/rs0; lệnh này không còn thêm POI mẫu.
2. Admin → Cài đặt → Danh mục tỉnh/thành Việt Nam: có 34 dòng, mục mới đang tắt. Tìm `Hà Nội`, `hoi an` hoặc `Sa Pa`; tìm tên khu vực trả tỉnh chứa khu vực đó.
3. Bật một tỉnh. Reload vẫn bật. Customer chỉ thấy tỉnh đã bật; nếu chưa có POI đủ dữ liệu, Goe báo thiếu dữ liệu trước khi gọi provider.
4. Tắt có xác nhận: ẩn tỉnh và POI bên trong khỏi customer. Bản đã lưu, đề xuất, giá, ảnh và lịch thu thập giữ nguyên. Bật lại hiện POI vẫn published; không tự publish draft.
5. Phạm vi lấy nguồn vẫn ở cấu hình riêng. Bật hiển thị không gọi Geoapify, không tạo POI hoặc xác minh giá/giờ.

## Nguồn và phiên bản

- 34 mã/tên: [Quyết định 19/2025/QĐ-TTg](https://chinhphu.vn/?classid=1&docid=214409&orggroupid=3&pageid=27160), [Phụ lục I PDF](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/19ttg.signed.pdf), hiệu lực 01/07/2025. Phiên bản bundle `vn-19-2025-07-01-v1`; dữ liệu ở server/src/features/trips/province-data.ts. Không tự fetch hay thay danh mục theo mạng lúc khởi động.
- [Hội An thuộc Đà Nẵng](https://hoian.danang.gov.vn/gioi-thieu-chung.html); [du lịch Sa Pa trong Lào Cai](https://www.doingoailaocai.vn/vi/bai-viet/25109). tourismAreas hiện chỉ gồm hai ví dụ owner nêu, không phải danh mục khu vực du lịch/xã/phường toàn quốc. Không có lựa chọn lập lịch riêng theo area trong slice này.
- 3 miền/8 vùng là nhãn biên tập, không thuộc bảng mã hành chính. Tỉnh hợp nhất có thể trải nhiều vùng trước đây; Phú Thọ xếp Đồng bằng Bắc Bộ, Gia Lai/Đắk Lắk/Lâm Đồng xếp Tây Nguyên, Quảng Ngãi xếp Duyên hải Nam Trung Bộ trong bundle này. Không dùng nhãn để suy ra ranh giới hay bán kính thu thập.

## API và lưu trữ

GET /api/v1/admin/destinations: admin-only, cả tỉnh bật/tắt; public GET /destinations chỉ published và không legacy. Search bỏ dấu áp dụng tên/mã/tên khu vực trong bundle. DTO thêm provinceCode/catalogVersion/catalogSourceUrl/catalogEffectiveFrom/tourismAreas; không chứa provider key.

PATCH /api/v1/admin/destinations/:id nhận đúng `{enabled:boolean,expectedRevision:number}` và Idempotency-Key. Không nhận owner/role/name/code/slug/status tùy ý. POST tạo thủ công trả 405 DESTINATION_CATALOG_MANAGED. Toggle tăng revision và catalogWriteFence, ghi actor admin/audit/receipt trong transaction; replay cùng key/payload không lặp mutation, khác payload 409, stale revision 409. Public place list/detail, new trip và planner kiểm parent khả dụng. Off dùng draft, không archive POI; quy trình bulk archive vẫn riêng.

Bootstrap có 34 mục, transaction với audit system. Mới tắt; mục cũ khớp chính xác slug+tên tỉnh/thành được giữ ID, summary, trạng thái và gắn metadata. Mã unique partial string giữ cả tombstone, không hồi sinh tombstone. Slug trùng nhưng khác nghĩa làm bootstrap thất bại an toàn, không overwrite. Mục không khớp được đánh dấu legacy, giữ document và mọi tham chiếu nhưng không cho chọn mới hoặc ingest. Không tự reparent POI/trip/scope lịch sử: cần migration có mapping nếu database khác còn dữ liệu khu vực cũ. Không drop/syncIndexes hoặc xóa database.

Danh mục được nạp bởi production entrypoint và lệnh operator. Test harness dùng initialize cơ sở hạ tầng rồi fixtures có nhãn; các bài province/nationwide/browser bật bootstrap thật. seedDestinations cũ chỉ còn dùng trong test riêng, không được script db:seed production gọi.

## Kiểm chứng

Đã kiểm chứng trên local ngày 25/10/2026:

- `npm run typecheck`, `npm run lint`, `npm run build`: đạt. Build còn cảnh báo kích thước chunk chính trên 500 kB.
- `npm test`: 64/64 đạt.
- Integration province-catalog + product + nationwide: 19/19 đạt; admin-v2 + place-import: 18/18 đạt. Các suite catalog, catalog-operations, catalog-publication, explore và hoian cũng đạt trong lượt kiểm tra liên quan.
- `npm run test:catalog-browser -- --reporter=line`: 4/4 đạt; kiểm tra bật/tắt, reload, tìm khu vực, customer không có dữ liệu và bố cục các chiều rộng 320/390/1366.
- `npm run test:e2e -- --reporter=line`: 33 đạt, 1 ca live Gemini bỏ qua theo cấu hình opt-in sẵn có.
- Integration kiểm tra khởi tạo đồng thời không trùng mã, giữ ID/trạng thái cũ, không hồi sinh tombstone, lỗi audit rollback, revision/idempotency và bật/tắt không sửa POI/snapshot chuyến đã lưu.
- Database goease local sau bootstrap: 34 tỉnh đều tắt, 1 bản ghi legacy được giữ lại, 0 POI, 0 chuyến, 2 tài khoản. Health database trả 200; danh mục public trả danh sách rỗng đúng trạng thái.

Unit/browser với fixture không chứng minh provider thật hay dữ liệu POI toàn quốc. Không gọi provider để nhập địa điểm trong task này. Chưa triển khai production hoặc Atlas.
