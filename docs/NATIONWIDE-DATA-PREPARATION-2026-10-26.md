# Rà và bổ sung dữ liệu toàn quốc — 26/10/2026

Owner chọn giữ mục tiêu rà từng mục trong toàn bộ 26.566 địa điểm, chấp nhận nhiều mục chưa thể đủ điều kiện xuất bản. Chuẩn mục tiêu: ảnh, mô tả, vị trí, giờ và giá có nguồn, đủ cho cả khám phá và Goe. Không thu hẹp âm thầm thành bộ mẫu; không tự bật tỉnh, xuất bản hoặc clear database. Số địa điểm hiện có không phải giới hạn dung lượng của sản phẩm.

## Kiểm tra toàn bộ dữ liệu

Đã duyệt qua 26566 bản ghi của 34 tỉnh, hợp nhất proposal snapshot hiện hành với observations theo service trước khi kiểm tra; không dùng raw places.images làm số ảnh biên tập. Tạo danh sách thiếu trường theo từng place ID trong file ignored nationwide-missing-fields.ndjson. Đây là kiểm tra trường/nguồn hiện có, không phải đã đọc website hoặc xác minh thực địa riêng từng cơ sở.

Nguồn OSM tải ngày 25/10, mốc dữ liệu 24/10: 26.469 POI mới; 3503 có opening_hours, 93 có fee/charge (fee=yes không đồng nghĩa có giá), 1265 có website, 115 có liên kết Wikipedia, 144 có Wikidata. Không có description/image trong tập trích xuất này. Không suy giá0 hoặc mở24/7 khi thiếu tag.

## Nhập bổ sung thật

- Đã đọc và lưu 3530 observations từ nguồn OSM đã tải: 3500 có giờ và 41 có thông tin phí; có giao nhau. Ghi message chỉ rõ snapshot24/10, reviewed=false. Chỉ mục pending chưa thử/chưa có kết quả, lease không hoạt động, source URL/revision đúng mới được điền. Giữ kết quả/khóa/giờ giá đã được duyệt, không thay revision editorial hoặc publication. Đã đọc lại kiểm tra 3530 bản ghi. Đây chưa phải 3530 mục sẵn sàng cho Goe.
- Lưu 3 giới thiệu Wikipedia có bản gốc/revision/license/sourceUrl: Tháp Po Sah Inư, Cát Cát và Đèo Hải Vân; stageInSession + business audit trong transaction dưới admin hiện có, không xuất bản. Các lượt khác chưa ghi nếu nguồn trống, cần dịch hoặc lỗi.
- 5 địa điểm đã đối chiếu giá/giờ và nhập qua catalog.write. Giá bao gồm phạm vi vào cửa thông thường; không suy giá món thành chi phí bữa ăn. Ngày đối chiếu26/10, ngày kiểm tra lại02/11/2026; hết hạn không tiếp tục xem là giá đủ dùng.

| Địa điểm                                   | Giá VND/người | Có tọa độ | Giờ đủ định dạng Goe | Giá đủ điều kiện | Qua kiểm tra field xuất bản | Ảnh tải được |
| ------------------------------------------ | ------------: | --------- | -------------------- | ---------------- | --------------------------- | ------------ |
| Bảo tàng Nghệ thuật Điêu khắc Chăm Đà Nẵng |         60000 | Có        | Có                   | Có               | Có                          | Có           |
| Nhà tù Hoả Lò                              |         50000 | Có        | Có                   | Có               | Có                          | Có           |
| Bảo tàng Chứng tích Chiến tranh            |         60000 | Có        | Có                   | Có               | Có                          | Có           |
| Bảo tàng Dân tộc học Việt Nam              |         40000 | Có        | Có                   | Có               | Có                          | Có           |
| Di San Vô Giá                              |             0 | Có        | Có                   | Có               | Có                          | Có           |

Nguồn chính thức dùng cho 5 mục: [Bảo tàng Chăm](https://danangfantasticity.com/en/bao-tang-lich-su-va-van-hoa/bao-tang-dieu-khac-cham-da-nang), [Hỏa Lò](https://hoalo.vn/Articles/4/26034/thong-tin-ve-gia-ve-tham-quan-ban-ngay.html), [Chứng tích Chiến tranh](https://ticket.baotangchungtichchientranh.vn/terms-and-conditions.html), [Dân tộc học](https://www.vme.org.vn/), [Di sản Vô giá](https://www.rehahnphotographer.com/precious-heritage-museum/). Bảo tàng Chứng tích Chiến tranh công bố60.000đ từ01/10/2026, không dùng mức40.000đ cũ. Thời lượng là ước tính biên tập GoEase; Di sản Vô giá có khuyến nghị45–60phút từ đơn vị vận hành. Ảnh có giấy phép Commons; không sao chép ảnh có bản quyền từ website du lịch.

## Theo tỉnh ở thời điểm 2026-10-25T17:53:50.329Z

Các cột là khả năng của bản nháp hiện tại; không phải tất cả đã công khai. Cột đủ5 trường vẫn chưa chứng minh có đủ nhà hàng/bữa ăn để xếp lịch trọn ngày, mọi số ngày hoặc mọi ngày lễ.

| Mã  | Tỉnh        | Tổng mục | Có bìa | Có giới thiệu | Giờ đã đối chiếu | Giá đủ dùng | Đủ5 trường |
| --- | ----------- | -------: | -----: | ------------: | ---------------: | ----------: | ---------: |
| 01  | Hà Nội      |     3944 |     35 |            14 |                2 |           2 |          2 |
| 04  | Cao Bằng    |      152 |      0 |             0 |                0 |           0 |          0 |
| 08  | Tuyên Quang |      445 |      0 |             0 |                0 |           0 |          0 |
| 11  | Điện Biên   |      105 |      0 |             0 |                0 |           0 |          0 |
| 12  | Lai Châu    |      107 |      0 |             0 |                0 |           0 |          0 |
| 14  | Sơn La      |       93 |      0 |             0 |                0 |           0 |          0 |
| 15  | Lào Cai     |      447 |      0 |             1 |                0 |           0 |          0 |
| 19  | Thái Nguyên |      105 |      0 |             0 |                0 |           0 |          0 |
| 20  | Lạng Sơn    |      108 |      0 |             0 |                0 |           0 |          0 |
| 22  | Quảng Ninh  |      204 |      0 |             0 |                0 |           0 |          0 |
| 24  | Bắc Ninh    |      630 |      0 |             0 |                0 |           0 |          0 |
| 25  | Phú Thọ     |      237 |      0 |             0 |                0 |           0 |          0 |
| 31  | Hải Phòng   |      688 |      0 |             0 |                0 |           0 |          0 |
| 33  | Hưng Yên    |      207 |      0 |             0 |                0 |           0 |          0 |
| 37  | Ninh Bình   |      571 |      0 |             0 |                0 |           0 |          0 |
| 38  | Thanh Hóa   |      114 |      0 |             0 |                0 |           0 |          0 |
| 40  | Nghệ An     |      150 |      0 |             0 |                0 |           0 |          0 |
| 42  | Hà Tĩnh     |      180 |      0 |             0 |                0 |           0 |          0 |
| 44  | Quảng Trị   |      419 |      0 |             1 |                0 |           0 |          0 |
| 46  | Huế         |      889 |      0 |             1 |                0 |           0 |          0 |
| 48  | Đà Nẵng     |     3137 |     22 |             7 |                2 |           2 |          2 |
| 51  | Quảng Ngãi  |      365 |      0 |             0 |                0 |           0 |          0 |
| 52  | Gia Lai     |      613 |      0 |             0 |                0 |           0 |          0 |
| 56  | Khánh Hòa   |     1207 |      0 |             0 |                0 |           0 |          0 |
| 66  | Đắk Lắk     |      512 |      0 |             1 |                0 |           0 |          0 |
| 68  | Lâm Đồng    |     1853 |      1 |             3 |                0 |           0 |          0 |
| 75  | Đồng Nai    |      433 |      0 |             0 |                0 |           0 |          0 |
| 79  | Hồ Chí Minh |     5849 |      1 |             2 |                1 |           1 |          1 |
| 80  | Tây Ninh    |      292 |      0 |             0 |                0 |           0 |          0 |
| 82  | Đồng Tháp   |      283 |      0 |             0 |                0 |           0 |          0 |
| 86  | Vĩnh Long   |      320 |      0 |             0 |                0 |           0 |          0 |
| 91  | An Giang    |      960 |      0 |             1 |                0 |           0 |          0 |
| 92  | Cần Thơ     |      870 |     13 |             2 |                0 |           0 |          0 |
| 96  | Cà Mau      |       77 |      2 |             0 |                0 |           0 |          0 |

## Chưa hoàn tất và lỗi nguồn

Chưa hoàn thiện toàn bộ26.566 địa điểm; không thể coi tag/website trống là bằng chứng miễn phí hoặc không đóng cửa. Wikipedia/Wikidata trả429 ở các lượt tra liên kết, nên dừng lượt đó; không đổi lỗi thành empty/đã xác minh. Nguồn ảnh cũng trả429/Retry-After600s ở một ảnh, cần chờ đúng thời gian, giữ raster gốc/lossless. Đã bổ sung cooldown CDN theo Retry-After cho worker, pause nhận việc mới và không tiêu hao retry budget vì rate limit; không cố lần lượt5ảnh sau khi nguồn đã giới hạn tốc độ. Giới hạn theo process, restart không tạo quota mới hay bảo đảm hết giới hạn.

Kết quả kiểm chứng mã: typecheck/lint/build đạt (còn cảnh báo chunk client>500kB),106unit tests đạt, integration pool/cooldown đạt. Kiểm chứng dữ liệu riêng: đọc lại observations, phiên bản/audit của mô tả, metadata giờ/giá và HTTP ảnh theo từng dòng trên. Không dùng unit tests làm bằng chứng dữ liệu thực đã đầy đủ.

## File cục bộ

Tất cả trong .local/manual-tourism-import-20261025 (ignored): nationwide-readiness-report.json, nationwide-missing-fields.ndjson, snapshot-observation-results.json, linked-description-plan.ndjson, linked-description-results.ndjson, curated-complete-plan.json, curated-complete-results.json, ảnh gốc đã tải và script. Không có secret/user session trong bộ báo cáo. Chưa tạo gói deploy cuối hoặc khẳng định hoàn tất rà web từng mục.

## Website liên kết — kiểm tra xong toàn bộ tập có sẵn

Đã chạy qua 1265 website gắn với POI trong OSM, gộp kết quả mới nhất theo osmId sau lượt thử HTTPS cho URL HTTP. Kết quả: 42 có ứng viên giờ/phí, 488 không trích được giờ/phí khớp tên, 406 truy cập lỗi, 298 liên kết ngoài phạm vi hỗ trợ (ví dụ mạng xã hội), 31 URL không hợp lệ. Đây là lượt đọc tự động có kiểm tra tên, không phải người đã xác nhận từng trang hoặc đủ điều kiện sử dụng dữ liệu.

Đã bổ sung 16 observations website vào DB và đọc lại kiểm tra đều còn draft/reviewed=false; các mục khác giữ observation cũ, trường đã có hoặc khóa biên tập. Không dùng giá một món làm giá bữa ăn. Đã đối chiếu đủ version và audit cho 3 mô tả Wikipedia, cùng version/audit/source và HTTP200 cho cả5bìa thủ công. File bằng chứng thêm: linked-website-review.ndjson, national-supplements-verification.json, website-observation-results.json (lượt nhập cuối), curated-complete-verification.json.

Phạm vi còn lại vẫn là từng mục trong26.566 địa điểm: chưa có nguồn trong OSM không đồng nghĩa đã tìm hết web; cần tiếp tục tìm nguồn bên ngoài cho từng mục thiếu. Các website lỗi/chưa có thông tin không được đánh dấu đã xác minh. Worker ảnh tiếp tục cùng API khi API đang chạy, tôn trọng cooldown được lưu; không có tác vụ nghiên cứu thủ công tự chạy sau khi kết thúc phiên.

## Xuất bản theo yêu cầu owner — 26/10/2026

Đã rà 26.565 bản nháp hiện có bằng proposal và source defaults của catalog service. Có 11 mục qua schema và kiểm tra eligibility; sau rà nội dung, giữ Khám Lớn Cần Thơ ở nháp vì mô tả đang giới thiệu thành phố, chưa đúng địa điểm. Các mục thiếu dữ liệu hoặc giờ/giá chưa reviewed tiếp tục giữ nháp; không tự xác nhận observations hoặc bỏ blocker.

Đã xuất bản 10 mục qua operations.batch (preview rồi thực thi từng revision với idempotency key): Tòa nhà trung tâm Bưu điện Hà Nội, Tháp Bút, Bảo tàng Đà Nẵng, Bảo tàng Nghệ thuật Điêu khắc Chăm Đà Nẵng, Cát Cát, Thác Datanla, Di sản Vô giá, Bảo tàng Chứng tích Chiến tranh, Bảo tàng Dân tộc học Việt Nam và Nhà tù Hỏa Lò. Bảo tàng Đà Nẵng dùng bìa minh họa AI có nhãn theo CAT-20; không gọi ảnh này là ảnh chụp thực tế. Xuất bản phục vụ Khám phá không đồng nghĩa mọi mục đủ dữ liệu để Goe xếp lịch.

Đã quan sát: 10 bìa trả HEAD200 trước xuất bản; đọc lại cả10 bản published qua public service, có public version và audit catalog.publication_changed đúng revision. Phạm vi là MongoDB local goease trên rs0/27017, không phải triển khai production. Bằng chứng và script nằm trong .local/manual-tourism-import-20261025 (ignored): publish-ready-plan.json, publish-ready-results.json, publish-ready.mts, check-publish-covers.mts. Không thay application code hoặc chạy lại application tests cho thao tác dữ liệu này.
