# CAT-22 — Giờ mở cửa và giá từ nguồn

Triển khai 25/10/2026 theo yêu cầu owner: tự lấy vào draft, admin kiểm tra rồi xuất bản; giá tham khảo hiển thị “Từ …đ” kèm đơn vị/điều kiện.

## Luồng đã triển khai

1. Địa điểm nhập mới được xếp `visitSearch.pending`; startup bổ sung hàng đợi cho draft Geoapify cũ chưa có trường này. Worker chạy trong API, không tự xuất bản.
2. Đọc đúng OSM node/way/relation theo ID gốc và đối chiếu tên. Lấy `opening_hours`, `charge` VND rõ nghĩa hoặc `fee=no` không kèm điều kiện. Không suy `fee=yes` thành số tiền, không suy thiếu phí thành miễn phí.
3. Nếu còn thiếu, đọc website do chính bản ghi OSM liên kết. Ưu tiên JSON-LD của đúng tên địa điểm, `openingHours`/`openingHoursSpecification` và `offers` có VND, số tiền và mô tả áp dụng. Bản mở rộng bên dưới nhận thêm đoạn văn có nhãn rõ ràng; không crawl toàn website/menu ảnh hay suy đoán bằng AI. Nguồn không có dữ liệu phù hợp có thể trả empty; lỗi truy cập báo lỗi/retry.
4. Đề xuất có nguồn và thời điểm nhận nằm trong draft. Admin mở **Giá & giờ mở cửa**, đọc/sửa, đánh dấu kiểm tra riêng từng mục hoặc bỏ gợi ý, rồi **Lưu đề xuất** và xem trước xuất bản. Sửa giá/điều kiện/giờ trong panel bỏ dấu kiểm tra. Nạp lại gợi ý thay các lựa chọn trong form theo thao tác admin; worker không thay nội dung đã lưu.
5. Xuất bản đơn lẻ và theo lô đều chặn nếu snapshot giữ giờ/giá chưa kiểm tra. Không có thông tin vẫn áp dụng quy tắc khám phá CAT-17 hiện hành, không mặc định 24/7/0đ. Giá tham khảo đã kiểm tra hiển thị `Từ …đ/người`, `/món`, `/nhóm` hoặc không hậu tố khi nguồn chưa rõ đơn vị; luôn giữ điều kiện. Giá 0 được ghi Miễn phí với điều kiện đi kèm.

## Hợp đồng, dictionary và lưu trữ

- `places.visitSearch`: embedded bounded observation, state pending/searching/ready/empty/failed; result, context (name/sourceUrl/destinationName), message, attempts, nextAttemptAt, leaseToken/leaseUntil, checkedAt. Một kết quả hiện hành, không mảng lịch sử. Lease 120 giây, một lượt/worker, poll 5 giây, tối đa 3 lần lỗi liên tiếp, retry sau 60 giây; admin yêu cầu tìm lại có cooldown 60 giây. Kết quả ghi có revision/token fence. Không tăng editorial revision cho observation.
- `places.visitInfo`: optional snapshot `{hours, price}` (mặc định null); hours gồm text≤400/sourceUrl/observedAt/reviewed; price gồm amount nguyên VND 0..1e9/currency=VND/unit person|item|group|unspecified/conditions≤500/sourceUrl/observedAt/reviewed. Mỗi mục nullable. `reviewed` là xác nhận admin; `observedAt` không phải ngày xác minh giá.
- AdminPlaceInput/Dto có visitInfo; public PlaceDto chỉ chiếu các mục reviewed. Snapshot đi cùng proposal/version/audit, có field lock/provenance `visitInfo`. Observation không vào version; publish/restore không tua lại observation. Không thêm collection/index, không drop/migrate dữ liệu công khai.
- GET `/admin/places/:id/visit-info`; POST `/admin/places/:id/visit-info/search` body rỗng strict. Quyền admin và middleware phiên/Origin hiện hành.
- `referencePrice` dùng ngân sách giữ nguyên. Worker và nút duyệt **không** chuyển giá từ thành giá dự toán. Không coi giá vé trẻ em hoặc giá một món là giá chuẩn của cả người. Giờ được admin xác nhận mới được chép vào openingHoursNote qua thao tác trên form; planner vẫn áp dụng gate hiện có.

## Truy cập nguồn

HTTPS, không credentials/port lạ/IP literal; DNS IPv4 công khai được kiểm tra và ghim khi kết nối, mỗi redirect kiểm tra lại (tối đa 2), timeout 12 giây/request và tối đa 1 MB, không cookie/script execution. Giữ liên kết nguồn; không lưu HTML. Website liên kết không mặc nhiên là giá hiện hành/đã xác minh.

Tham chiếu triển khai: [OSM charge](https://wiki.openstreetmap.org/wiki/Key:charge), [OpeningHoursSpecification](https://schema.org/OpeningHoursSpecification), [Offer](https://schema.org/Offer).

## Kiểm chứng

Unit: giá rõ/không rõ/miễn phí/conditional, loại tiền và dấu phân cách không rõ, đúng địa điểm, JSON-LD, lỗi nguồn, SSRF URL/address, gate draft/published và tách giá dự toán. Integration MongoDB riêng: quyền admin, observation, revision fence, khóa, retry, duyệt/xuất bản và public isolation. UI fixture component thật: tự nhận gợi ý, duyệt, sửa bỏ dấu duyệt, bỏ gợi ý, giá customer và mobile.

Live read-only OSM ngày 25/10/2026: way/37933258 trả charge 40000 VND; way/37933256 trả giờ Mo off; Tu-Su 08:00-12:00,13:30-17:00. Đây là hai bản ghi riêng, không tự ghép hoặc coi là giá hiện hành đã duyệt. Chưa xác minh live website JSON-LD cho một cơ sở có đủ cả giờ/giá; nhánh này được kiểm thử fixture. Không bảo đảm mọi địa điểm sẽ có dữ liệu.

## Mở rộng nguồn (25/10/2026)

Đã triển khai thêm Wikidata P856 qua entity được OSM liên kết. Nếu OSM thiếu website và entity, tìm Wikidata theo tên nhưng chỉ nhận entity có tên/alias trùng và tọa độ cách POI dưới 1.500m. Không dùng kết quả đầu tiên chỉ vì giống tên. Website/giờ/giá vẫn là gợi ý cần kiểm tra.

Ngoài JSON-LD, đọc đoạn HTML có nhãn giờ mở cửa/giá vé cùng số tiền VND rõ ràng, giữ nguyên đoạn điều kiện. Có thể theo tối đa hai liên kết cùng origin có nhãn tham quan/giá vé/giờ/liên hệ khi trang đầu xác nhận tên địa điểm. Không lấy giá gửi xe/ủng hộ/học phí; đoạn có nhiều mức giá không được ép về một số. Không kết luận 24/7 hoặc miễn phí từ loại địa điểm ngoài trời.

Giới hạn một lượt: tối đa 6 lời gọi nguồn, deadline 70 giây; website tối đa 4 trang trong ngân sách. Bộ lấy nguồn cũ được xếp tìm lại qua visitSearch.providerVersion=3, không xóa result cũ, không thay visitInfo đã lưu/đã duyệt/public, không tự xuất bản. Context bổ sung tọa độ để loại kết quả sai vị trí; form đang sửa vị trí không tự nhận gợi ý cũ. API key mới không bắt buộc.

Kiểm chứng: fixture Wikidata-linked và tìm tên+tọa độ, trang con, HTML thường, điều kiện và trường hợp nguồn không khớp; kiểm tra live mẫu Bảo tàng Hồ Chí Minh tại tọa độ Cần Thơ chưa tìm thấy dữ liệu mới phù hợp. Không tuyên bố độ phủ tăng cho toàn bộ catalog khi hàng đợi chưa hoàn tất. Nguồn tham chiếu: https://www.wikidata.org/wiki/Property:P856.
