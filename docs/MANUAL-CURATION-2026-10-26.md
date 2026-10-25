# Bổ sung dữ liệu toàn quốc — 26/10/2026

Mục tiêu owner: rà và bổ sung toàn bộ 26.566 địa điểm để xuất bản với ảnh, mô tả, tọa độ và giờ/giá có nguồn; không thay bằng bộ mẫu hoặc tự suy dữ liệu còn thiếu. Đây là checkpoint thực tế, chưa hoàn tất mục tiêu.

## Trạng thái đọc lại

Thời điểm UTC: 2026-10-25T19:00:52.374Z. 34/34 tỉnh thành đã bật; job 6ade45ecbadd222572486434 đang running, đăng ký đủ 26566 mục. Toàn DB có 11 published, không phải số được tác vụ này xuất bản. Các số operational: {"skipped":8,"ready":2,"queued":26397,"review":9,"waiting":150}. ready là trạng thái job, không thay thế kiểm tra bản đề xuất hiện hành. Lượt làm việc này không gọi publish hàng loạt.

## Bổ sung thủ công có nguồn

Đã bổ sung 5 địa điểm mới: Dinh Độc Lập, Công viên Thủ Lệ, Thung Nham, Bảo tàng Đà Nẵng và Mỹ Sơn. Bảng gồm cả 5 mục đã hoàn thiện trước đó để kiểm tra liên tục.

| Địa điểm | Trạng thái hiện tại | Giá nguồn VND | Bìa HTTP 200 | Qua validation field xuất bản | Goe lịch/ngân sách |
| --- | --- | ---: | --- | --- | --- |
| Bảo tàng Nghệ thuật Điêu khắc Chăm Đà Nẵng | published | 60000 | Có | Có | Có |
| Nhà tù Hoả Lò | published | 50000 | Có | Có | Có |
| Bảo tàng Chứng tích Chiến tranh | published | 60000 | Có | Có | Có |
| Bảo tàng Dân tộc học Việt Nam | published | 40000 | Có | Có | Có |
| Di San Vô Giá | published | 0 | Có | Có | Có |
| Dinh Độc Lập | draft | 40000 | Có | Có | Có |
| Công viên Thủ Lệ | draft | 50000 | Có | Có | Có |
| Thung Nham Bird Park | draft | 250000 | Có | Có | Chưa |
| Bảo tàng Đà Nẵng | published | 50000 | Có | Có | Có |
| Thánh địa Mỹ Sơn | draft | 100000 | Có | Có | Chưa |

Đọc lại audit/version và URL nguồn cho cả 10 mục; giờ được đối chiếu, ngày kiểm tra26/10, reviewAfter02/11/2026. Field validation không xác nhận ảnh đúng địa điểm hoặc đủ mọi loại nhóm/ngày lễ. Thung Nham và Mỹ Sơn vẫn restricted cho ngân sách vì điều kiện nhóm/quốc tịch; không coi giá cơ bản là giá áp dụng mọi khách.

**Cần kiểm tra ảnh Bảo tàng Đà Nẵng:** Bản đề xuất đang chọn ảnh cơ sở cũ năm2018; bản công khai vẫn giữ ảnh AI. Cần đối chiếu trước khi xuất bản đề xuất. Public revision=4, proposal revision=5. Giữ nguyên chỉnh sửa đã xuất hiện từ phiên khác; không ghi đè.

## Nguồn và điều kiện


- [Dinh Độc Lập](https://dinhdoclap.gov.vn/gio-tham-quan/): vé chỉ vào Dinh40.000đ khác vé tổng hợp80.000đ, giờ07:00–18:00; không gộp Nhà trưng bày/xe điện vào giá cơ bản.
- [Vườn thú Hà Nội](https://vuonthuhanoi.com/): vé trên1,3m50.000đ; khung trưng bày động vật08:00–16:00 khác giờ công viên theo mùa.
- [Thung Nham](https://thungnham.com/dich-vu/ve-tham-quan-thung-nham/):250.000đ từ1,3m, có thuyền vườn chim và Hang Bụt, giờ mùa hè07:00–18:00/mùa đông07:30–17:30. Có điều kiện tối thiểu3vé/thuyền lúc vắng cho khách lẻ dưới2người; giữ audience=restricted, chưa dùng làm ngân sách chung cho mọi nhóm.
- [Bảo tàng Đà Nẵng cơ sở1](https://baotangdanang.vn/thong-bao-gia-ve-tham-quan-bao-tang-da-nang-ap-dung-tu-ngay-03-7-2025): đã đọc ảnh bảng phí chính thức50.000đ, giờ08:00–17:00, địa chỉ31Trần Phú. Giữ rõ đối tượng miễn/giảm và ngày miễn. Ảnh Commons Bảo tàng Đà Nẵng.jpeg chụp04/03/2018 thuộc cơ sở cũ; chưa dùng cho cơ sở mới.
- [Cổng vé Mỹ Sơn](https://mysonticketonline.vn/information):100.000đ khách Việt Nam,150.000đ khách nước ngoài; bán vé06:00–17:30, tham quan06:00–18:00. Audience=restricted để không suy giá Việt Nam cho mọi khách khi Goe chưa có ngữ cảnh quốc tịch. Hostname www lỗi certificate name mismatch; dùng đúng hostname không-www có TLS hợp lệ, không bỏ qua kiểm tra chứng chỉ.


## Đối chiếu hàng loạt bổ sung

Đã tải snapshot [Wikidata SPARQL](https://query.wikidata.org/sparql), dữ liệu cấu trúc [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing): 34.798 dòng / 27.601 entity, không phải số địa điểm du lịch mới. SHA-256: 141dcc9b8c5b8e4ee1fd981a090219f699589b2648224dfbd24533922356dfd3.

Đã đối chiếu cả 26.566 mục: tên/alias chuẩn hóa khớp chính xác, khoảng cách tối đa250m, một entity duy nhất. 248 kết quả, 125 có P18 ảnh, 21 có website; 1 trường hợp mơ hồ bị giữ ngoài import. Một entity có thể khớp nhiều bản ghi OSM; chưa kết luận trùng để xóa/gộp.

Kiểm metadata 127 tên file Commons: 43 ứng viên qua kiểm tên/giấy phép; thực nhập hàng đợi 37 mục, các mục đã có bìa/public/khóa được giữ. Đọc lại lúc 2026-10-25T19:00:52.741Z: {"pending":35,"ready":2}. Chỉ 2 đã lưu bìa Cloudinary và HEAD200, các mục pending chưa có ảnh lưu thành công. Tất cả 37 giữ revision biên tập và draft, ảnh automatic reviewed=false. Đây không phải 37 địa điểm đủ xuất bản. 21 website đã kiểm, không có quan sát giờ/giá mới được lưu; không tính website tồn tại thành dữ liệu đã xác minh.

## Ảnh và thay đổi công cụ

4 ảnh thật mới đã xem nội dung, giữ giấy phép/credit Commons và bản gốc lossless. Wikimedia429/Retry-After được tuân thủ; không dùng link nguồn giả là bản lưu. Bảo tàng Đà Nẵng public dùng một AI illustration có nhãn, không mô tả là ảnh thực tế. PNG gốc2.374.674bytes upload Cloudinary và GET SHA-256 khớp, không resize/lossy. [Bản ảnh AI đã lưu](../.local/manual-tourism-import-20261025/danang-museum-ai-cover.png). Metadata URL/hash: danang-ai-cover-asset.json. Công cụ built-in imagegen, không CLI. Prompt cuối:

> Use case: stylized-concept. Asset type: one landscape cover illustration for a Vietnamese travel app, GoEase, for the current Da Nang Museum. Create an obviously illustrated, tasteful editorial museum still life: a terracotta pottery vessel, a small abstract carved stone heritage fragment, and a woven basket on display plinths, with subtle blue-green light suggesting coastal Da Nang. Warm ivory, terracotta and teal, refined soft painted texture, inviting cultural travel aesthetic, broad landscape composition that crops cleanly to a card. This is a conceptual AI illustration, not a photograph of the actual museum interior or its architecture; avoid depicting a specific building or inventing actual exhibits. No people, no text, no logos, no watermarks. Opaque background.

Sửa cleanup ảnh automatic legacy sai tên trên draft idle kể cả state=failed; không sửa selected/public/locked hoặc xóa asset. Metadata Commons đã chuẩn bị được reuse trong24giờ qua preferredCandidatesUntil/context khi tên, destination, source URL và tọa độ effective proposal khớp. Hết hạn/đổi tên/đổi vị trí thì tìm lại; vẫn kiểm tên/giấy phép/cooldown và lưu bản thật. Schema/dictionary/registry đã cập nhật; không thêm collection hoặc public input.

## Bằng chứng cục bộ

Kiểm chứng code cuối lượt: npm run typecheck, npm run lint, build server đều đạt; 110/110 unit tests và 2/2 integration (photo pool + catalog enrichment) đạt. Lần gọi integration đầu thiếu MONGOD_BINARY nên không khởi chạy; đã chạy lại với binary MongoDB8.2 và test-concurrency=1 trên replica set riêng port27021. Không dùng database ứng dụng làm test target. Không chạy lại browser UI vì không đổi giao diện.

Thư mục ignored .local/manual-tourism-import-20261025 chứa manual-all-verification.json, curated-extra-input.json/journal, national-enrichment-live-status.json, vietnam-wikidata.json, wikidata-match-summary.json, wikidata-place-hints.ndjson, wikidata-photo-metadata.ndjson, wikidata-photo-import-results.json, wikidata-hints-verification.json, wikidata-website-review.json và bản nguồn giá/ảnh. Audit/version nằm trong goease. Không clear/reset database. Job API tiếp tục chạy khi máy/API hoạt động; việc nghiên cứu thủ công không phải daemon tự tiếp tục sau khi kết thúc lượt.
