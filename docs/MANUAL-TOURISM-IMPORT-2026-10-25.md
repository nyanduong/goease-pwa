# Nhập thủ công dữ liệu OSM Việt Nam — 25/10/2026

Theo yêu cầu owner: tìm/tải dữ liệu bên ngoài và nhập vào GoEase trước, chưa sửa công cụ nhập trong sản phẩm. Đích duy nhất là MongoDB local `localhost:27017/goease`, replica set `rs0`; không seed/reset hoặc đổi cấu hình service dùng chung.

## Nguồn và phạm vi

- [Geofabrik Việt Nam](https://download.geofabrik.de/asia/vietnam.html): `vietnam-latest.osm.pbf`, 331.554.438 bytes. MD5 tải về khớp `f63b408a616d882d44dab7d21245d51c`; SHA-256 và manifest được lưu cục bộ. Bản tải có mốc dữ liệu 24/10/2026.
- Ranh giới tỉnh được ghép từ dữ liệu OSM. Khánh Hòa không ghép thành polygon trong tệp quốc gia, nên lấy bổ sung đúng [OSM relation 1887959](https://www.openstreetmap.org/relation/1887959) qua API công khai, không dùng bbox để đoán tỉnh. Loại thuộc tính user/uid/changeset khỏi bản XML giữ lại.
- Ghi công **© OpenStreetMap contributors**, giấy phép **ODbL-1.0**, URL nguồn riêng cho từng node/way/relation. Dữ liệu cộng đồng chưa được coi là xác minh thực địa hoặc danh sách đầy đủ mọi cơ sở thực tế. Giữ nghĩa vụ ghi công/giấy phép khi công khai hoặc phân phối lại.

Chỉ chọn mục có tên và hình học hợp lệ, loại cơ sở ngừng hoạt động/riêng tư khi có tag rõ ràng. Nhóm hiện có trong GoEase: điểm tham quan/văn hóa/thiên nhiên, ăn uống và cà phê. Lưu trú để riêng vì model hiện chưa có loại khách sạn; không ép thành điểm tham quan.

## Kiểm tra trước ghi

Tệp nguồn cho 36.335 ứng viên. Sau phân tỉnh, chống trùng và validation hợp đồng hiện hành có 26.469 mục sẵn sàng nhập, phủ đủ 34 mã tỉnh/thành:

- 6.148 điểm tham quan/văn hóa/thiên nhiên.
- 12.099 cơ sở ăn uống.
- 8.222 quán cà phê.

9.866 mục giữ riêng: 9.086 lưu trú, 58 mã nguồn đã tồn tại, 392 nghi trùng tên/vị trí, 197 nằm ngoài/không xác định duy nhất được tỉnh, 133 cần kiểm tra tên. Không tự gộp các cặp nghi trùng. Kiểm tra point-in-polygon cho Hà Nội, Hội An, Sa Pa, Đà Lạt, Phú Quốc, Hồ Chí Minh, Cần Thơ, Nha Trang, Huế và Phan Rang đều khớp tỉnh dự kiến.

Snapshot trước nhập ghi nhận 34 destination cấp tỉnh, 97 địa điểm có sẵn, trong đó 1 đã xuất bản. Mỗi bản ghi nhập dùng `catalog.write` với admin đang hoạt động, runtime validation, transaction, version, audit và idempotency hiện có. Không đi thẳng vào collection để bỏ qua các bước này. Nhập thử 10 mục và đọc lại xác nhận đều là draft, 97 mục cũ không thay revision/nội dung/trạng thái.

## Nội dung nhập và giới hạn

Các mục mới chỉ là **bản nháp**: tên, phân loại, tỉnh, địa chỉ hoặc truy vấn vị trí, tọa độ tham khảo, URL OSM, ghi chú nguồn và giờ gốc nếu có. Không có ảnh nhập từ OSM; không tự xác nhận giá/giờ, không gán giá 0 cho mục thiếu giá. Thời lượng mặc định 60 phút được ghi rõ là cần kiểm tra. Giới thiệu để trống. `mapLocation.checkedAt` là ngày đối chiếu tọa độ với nguồn, không phải xác minh tại cơ sở.

Đây là thao tác nhập của người vận hành qua luồng manual hiện có. Không giả gắn `source.provider=geoapify` cho bản ghi OSM tải trực tiếp; sourceUrl và internalNote giữ nguồn thật. Không thêm connector/schema/index, không thay lịch thu thập hoặc bật hiển thị các tỉnh. Các worker ảnh hiện có có thể tiếp tục xử lý hàng đợi; dữ liệu nhập chưa tự sẵn sàng cho Goe hoặc cho khách xem.

## Tệp cục bộ

Toàn bộ nguồn, môi trường xử lý riêng, script thao tác một lần và kết quả nằm trong thư mục ignored `.local/manual-tourism-import-20261025/`:

- `source-manifest.json`, `source.md5`: URL, hash, giấy phép và mốc nguồn.
- `baseline.json`: đối chiếu trước ghi; chỉ metadata tỉnh, admin ID và địa điểm liên quan, không chứa token/password.
- `extraction-report.json`, `partition-report.json`, `boundary-checks.json`: số liệu và kiểm tra ranh giới.
- `ready.ndjson`, `validated-plan.ndjson`: ứng viên và payload đã validate.
- `needs-review.ndjson`: các mục để riêng, không tự xóa bỏ.
- `import-results.ndjson`, `verification.json`: mã địa điểm đã lưu và đối chiếu sau nhập.

Không commit dataset, môi trường Python, thông tin tài khoản hoặc database. Không triển khai UI/CLI nhập mới trong sản phẩm. Trạng thái và số thực lưu cuối cùng được đối chiếu trong `verification.json` rồi ghi tại bàn giao.

## Kết quả đọc lại sau nhập

Đã ghi và đọc lại **26,469 bản nháp mới**, không lỗi ghi; chưa xuất bản mục mới nào. Cả 97 mục có trước vẫn tồn tại và không thay các trường đối chiếu (revision/publicRevision/trạng thái/tên/tỉnh). Kiểm tra 26,469 version và 26,469 audit `catalog.proposal_saved`, không trùng URL nguồn trong tập mới, không có bản mới sai trạng thái/giá/provider. Đọc được danh sách nháp qua service quản trị cho cả 34 tỉnh.

| Mã tỉnh | Tỉnh/thành  | Nhập nháp mới |
| ------- | ----------- | ------------: |
| 01      | Hà Nội      |         3,904 |
| 04      | Cao Bằng    |           152 |
| 08      | Tuyên Quang |           445 |
| 11      | Điện Biên   |           105 |
| 12      | Lai Châu    |           107 |
| 14      | Sơn La      |            93 |
| 15      | Lào Cai     |           447 |
| 19      | Thái Nguyên |           105 |
| 20      | Lạng Sơn    |           108 |
| 22      | Quảng Ninh  |           204 |
| 24      | Bắc Ninh    |           630 |
| 25      | Phú Thọ     |           237 |
| 31      | Hải Phòng   |           688 |
| 33      | Hưng Yên    |           207 |
| 37      | Ninh Bình   |           571 |
| 38      | Thanh Hóa   |           114 |
| 40      | Nghệ An     |           150 |
| 42      | Hà Tĩnh     |           180 |
| 44      | Quảng Trị   |           419 |
| 46      | Huế         |           889 |
| 48      | Đà Nẵng     |         3,115 |
| 51      | Quảng Ngãi  |           365 |
| 52      | Gia Lai     |           613 |
| 56      | Khánh Hòa   |         1,207 |
| 66      | Đắk Lắk     |           512 |
| 68      | Lâm Đồng    |         1,853 |
| 75      | Đồng Nai    |           433 |
| 79      | Hồ Chí Minh |         5,849 |
| 80      | Tây Ninh    |           292 |
| 82      | Đồng Tháp   |           283 |
| 86      | Vĩnh Long   |           320 |
| 91      | An Giang    |           957 |
| 92      | Cần Thơ     |           840 |
| 96      | Cà Mau      |            75 |

Đây là dữ liệu nền OSM đã nhập thật, chưa phải bộ địa điểm được duyệt để Goe dùng. Chưa kiểm chứng thực địa hoặc độ đầy đủ ngoài thực tế. Không thay mã sản phẩm nên không chạy lại bộ test ứng dụng; kiểm chứng của thao tác này là checksum, validation toàn bộ payload, kiểm tra ranh giới, ghi/đọc database thật, version/audit và format/diff check tài liệu.
