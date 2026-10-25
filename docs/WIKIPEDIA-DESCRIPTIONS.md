# Giới thiệu địa điểm có nguồn — CAT-21

26/10/2026: DESCRIPTION_TRANSLATION_ENABLED mặc địnhfalse; local đang tắt theo yêu cầu chỉ dùng nguồn miễn phí. Khi tắt không reserve quota hoặc gọi provider, kể cả có credentials. Muốn bật dịch AI ngoài phải chủ động cấu hìnhtrue và tự chịu điều kiện/chi phí provider. Đợt biên tập thủ công cũng dùng Wikivoyage CC-BY-SA-4.0 khi tên/alias+tọa độ khớp; metadata/attribution giữ đúng Wikivoyage và revision. Chưa thêm Wikivoyage vào worker tự tìm. Xem FREE-DEMO-CURATION-2026-10-26.md.

Đã triển khai local ngày 25/10/2026. Nguồn hiện tại là Wikipedia tiếng Việt/Anh, định danh bổ sung qua Wikipedia/Wikidata tags của Geoapify/OSM. Chưa triển khai thu thập website du lịch chính thức hoặc mọi nguồn Internet.

## Luồng admin

1. Bật tỉnh và lấy địa điểm như hiện tại. Địa điểm mới là draft, ô giới thiệu ban đầu trống.
2. Worker tìm giới thiệu; mở editor thấy trạng thái dưới ô giới thiệu. Kết quả phù hợp tự điền vào ô còn trống. Có thể sửa bình thường, không bị kết quả về muộn ghi đè.
3. Không có kết quả: trạng thái nói rõ, có nút **Tìm lại giới thiệu**. Không phải địa điểm nào cũng có bài Wikipedia riêng. Chưa có nội dung thì lưu nháp được, xuất bản bị chặn.
4. Tab **Nguồn & lịch sử** có URL phiên bản bài, giấy phép, bản gốc và nhãn dịch. Lưu đề xuất rồi xem trước/xuất bản riêng hoặc theo lô. Phía khách giữ attribution.

## Định danh và giới hạn

Ưu tiên liên kết trực tiếp từ sourceSnapshot.wikipedia/wikidata; thiếu tags thì đọc tags từ đúng OSM node/way/relation. Tìm tên+tỉnh chỉ chấp nhận một bài khớp tên và có tọa độ trong 1.500 m; bỏ trang định hướng hoặc nhiều kết quả phù hợp. Liên kết trực tiếp có tọa độ cũng phải gần; khi bài liên kết không có tọa độ, tin định danh nguồn. Đây là kiểm tra giảm nhầm lẫn, admin vẫn đọc lại nội dung.

Lấy intro plain text, tối đa ba câu/1.000 ký tự; không suy ra giá/giờ mở cửa. Ưu tiên vi, en chỉ là dự phòng; adapter dịch chỉ gửi đoạn nguồn, kiểm tra JSON, độ dài, HTML, số liệu. Kiểm tra tự động không chứng minh bản dịch hoàn toàn chính xác. Không có khóa/hết quota/lỗi dịch giữ bản gốc với needs_translation, không điền tiếng Anh vào ô tiếng Việt.

Các URL provider cố định, không redirect; tối đa tám request tìm kiếm, timeout 12 giây/request, response tối đa 1 MB. Dịch timeout 20 giây. API khóa ở server; quota dùng usage_buckets scope=global theo UTC và AI_DAILY_GLOBAL_LIMIT cùng planner. Không có collection mới.

## Hợp đồng và persistence

- `GET /api/v1/admin/places/:id/description`: admin-only, trả state, result|null, message, checkedAt. Result gồm text, originalText, title, sourceUrl, language, translated, revisionId, license=CC-BY-SA-4.0, match=linked/name_coordinates.
- `POST /api/v1/admin/places/:id/description/search`: admin-only, chỉ draft, cooldown 60 giây, không tạo lượt mới khi lease đang chạy; trả trạng thái hiện tại nếu chưa đủ điều kiện.
- `places.descriptionSearch`: state pending/searching/ready/empty/failed/needs_translation, result nullable, context, message, attempts, nextAttemptAt, leaseToken/leaseUntil, checkedAt. Worker poll 5 giây, lease 120 giây, tối đa ba lần khi provider lỗi; retry sau 60 giây. Claim nguyên tử, token/revision fence; worker không tăng editorial revision.
- Context chụp tên, tỉnh, tọa độ, sourceUrl và wiki tags. Kết quả khác context không tự điền. Worker giữ nguyên quan sát cũ khi gặp nội dung đã biên tập/khóa.
- `places.descriptionSource`: metadata/result được chụp khi lưu/xuất bản, độc lập quan sát nền; DTO public chỉ trả title/sourceUrl/license/translated. `place_content_versions` giữ descriptionSource, không chụp trạng thái hàng đợi descriptionSearch.
- `places.sourceSnapshot.wikipedia` (optional string <=300), `wikidata` (optional Q + positive integer) giữ hints định danh. Import không đặt chúng thành trường gốc của Place.
- description có thể rỗng khi draft. Capability và schema xuất bản chặn rỗng/placeholder import cũ. Projection chỉ điền draft trống, chưa khóa, đúng context; public không bị thay đổi bởi worker.
- Startup enqueue các imported draft cũ chưa có descriptionSearch. Không xóa dữ liệu hay đổi MongoDB service. Chưa bổ sung index chuyên biệt hàng đợi description; đánh giá index nếu catalog lớn hơn. Registry là tài liệu, không executable schema.

## Kiểm chứng

Unit tests kiểm tra định danh, khoảng cách, mơ hồ, fallback Wikidata, dịch thiếu, lỗi nguồn/payload giới hạn và bảo vệ nội dung. Integration riêng MongoDB test kiểm tra import → enrich → xuất bản, quyền admin, khóa và revision thay đổi trong lúc fetch. Đã thử đọc Wikipedia thật cho Chùa Cầu; không cam kết bao phủ mọi địa điểm. Dịch AI thật chưa kiểm chứng trong đợt này.

Tham khảo: [TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts), [OSM wikipedia tag](https://wiki.openstreetmap.org/wiki/Key:wikipedia).

Kiểm chứng đợt triển khai: 82/82 server unit tests; 13/13 kiểm tra trong province-import integration (MongoDB test riêng); build thành công; typecheck client/server/contracts/media và tools thành công. Playwright fixture chạy component React thật xác nhận polling → tự điền, không đè nội dung admin đang gõ, trạng thái rỗng và nút tìm lại. Browser fixture dùng API mock; không thay thế kiểm chứng toàn bộ luồng với provider thật. Provider Wikipedia thật trả giới thiệu Chùa Cầu; worker local quan sát được 10 bản nháp ready trong lúc hàng đợi còn chạy. Dịch AI live chưa thử. Build còn cảnh báo bundle >500 kB.
