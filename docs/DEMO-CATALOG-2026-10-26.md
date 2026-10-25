# Phạm vi demo 740 địa điểm — 26/10/2026

Cập nhật sau khi lập manifest: đã lưu14chứng cứ Google Maps website, bổ sung20giới thiệu có nguồn và8quan sát giờ/giá chưa duyệt, xuất bản2mục đủ điều kiện. Chưa hoàn tất740. Chi tiết tại [FREE-DEMO-CURATION-2026-10-26](FREE-DEMO-CURATION-2026-10-26.md); các bảng bên dưới là snapshot lúc chọn ứng viên, không phải trạng thái nguồn hiện tại.

Owner chốt ưu tiên20mục/tỉnh; Hà Nội, Đà Nẵng và TP.HCM40mục/nơi:31×20+3×40=740. Mỗi20 gồm10điểm tham quan,7quán ăn,3cà phê. Đà Nẵng chia2cụm20mục là trung tâm Đà Nẵng và Hội An. Mục tiêu nguồn/ảnh/giờ/giá có kiểm tra và Google Maps tiếp tục áp dụng. Đây là danh sách ứng viên thực lấy từ catalog hiện có, chưa phải740mục đã hoàn thiện hoặc xuất bản.

## Google Cloud: chưa kích hoạt dịch vụ

Đã đọc trực tiếp project GoEase-Development trong Chrome ngày26/10/2026: trang Billing báo không có tài khoản billing liên kết; Places API(New) hiển thị nút Enable. Chưa bấm Enable, chưa tạo API key, chưa liên kết billing/thêm thẻ/thanh toán hoặc gửi request Places trả phí. Owner cấm thanh toán bill; giữ nguyên yêu cầu này. [Thiết lập Places](https://developers.google.com/maps/documentation/places/web-service/get-api-key) yêu cầu project có billing. Chưa có kết quả đối chiếu Google cho danh sách này; không coi link tìm kiếm theo tên/tọa độ là đã xác nhận.

Yêu cầu Google Maps là điều kiện owner đã chốt. **Gate Google mới chưa được triển khai trong schema/API/UI hiện hành**; không dùng validation xuất bản hiện có để tuyên bố đã qua Google. Không tự thu hồi11mục public cũ. Cần tích hợp luồng xác nhận bằng Place ID hoặc chứng cứ trang Maps đúng cơ sở, cùng revision/context guard, trước khi gọi publish cho lô demo.

## Phân bổ ứng viên

| Tỉnh/thành | Ứng viên | Tham quan | Ăn | Cà phê | Có ứng viên bìa | Có giới thiệu | Cụm ưu tiên |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Hà Nội | 40 | 20 | 14 | 6 | 13 | 6 | Trung tâm Hà Nội |
| Cao Bằng | 20 | 10 | 7 | 3 | 0 | 0 | Thành phố Cao Bằng |
| Tuyên Quang | 20 | 10 | 7 | 3 | 0 | 0 | Hà Giang |
| Điện Biên | 20 | 10 | 7 | 3 | 0 | 0 | Điện Biên Phủ |
| Lai Châu | 20 | 10 | 7 | 3 | 1 | 0 | Lai Châu |
| Sơn La | 20 | 10 | 7 | 3 | 0 | 0 | Mộc Châu |
| Lào Cai | 20 | 10 | 7 | 3 | 2 | 1 | Sa Pa |
| Thái Nguyên | 20 | 10 | 7 | 3 | 0 | 0 | Thái Nguyên |
| Lạng Sơn | 20 | 10 | 7 | 3 | 0 | 0 | Lạng Sơn |
| Quảng Ninh | 20 | 10 | 7 | 3 | 1 | 0 | Hạ Long |
| Bắc Ninh | 20 | 10 | 7 | 3 | 1 | 0 | Bắc Ninh |
| Phú Thọ | 20 | 10 | 7 | 3 | 0 | 0 | Việt Trì |
| Hải Phòng | 20 | 10 | 7 | 3 | 0 | 0 | Trung tâm Hải Phòng |
| Hưng Yên | 20 | 10 | 7 | 3 | 0 | 0 | Phố Hiến |
| Ninh Bình | 20 | 10 | 7 | 3 | 1 | 1 | Ninh Bình – Tam Cốc |
| Thanh Hóa | 20 | 10 | 7 | 3 | 0 | 0 | Thanh Hóa |
| Nghệ An | 20 | 10 | 7 | 3 | 0 | 0 | Vinh |
| Hà Tĩnh | 20 | 10 | 7 | 3 | 0 | 0 | Hà Tĩnh |
| Quảng Trị | 20 | 10 | 7 | 3 | 2 | 0 | Đồng Hới |
| Huế | 20 | 10 | 7 | 3 | 2 | 0 | Trung tâm Huế |
| Đà Nẵng | 40 | 20 | 14 | 6 | 11 | 4 | Trung tâm Đà Nẵng; Hội An |
| Quảng Ngãi | 20 | 10 | 7 | 3 | 0 | 0 | Quảng Ngãi |
| Gia Lai | 20 | 10 | 7 | 3 | 3 | 0 | Quy Nhơn |
| Khánh Hòa | 20 | 10 | 7 | 3 | 5 | 0 | Nha Trang |
| Đắk Lắk | 20 | 10 | 7 | 3 | 0 | 0 | Buôn Ma Thuột |
| Lâm Đồng | 20 | 10 | 7 | 3 | 6 | 1 | Đà Lạt |
| Đồng Nai | 20 | 10 | 7 | 3 | 0 | 0 | Biên Hòa |
| Hồ Chí Minh | 40 | 20 | 14 | 6 | 11 | 2 | Trung tâm TP.HCM |
| Tây Ninh | 20 | 10 | 7 | 3 | 0 | 0 | Tây Ninh |
| Đồng Tháp | 20 | 10 | 7 | 3 | 0 | 0 | Cao Lãnh |
| Vĩnh Long | 20 | 10 | 7 | 3 | 0 | 0 | Vĩnh Long |
| An Giang | 20 | 10 | 7 | 3 | 0 | 0 | Châu Đốc |
| Cần Thơ | 20 | 10 | 7 | 3 | 3 | 0 | Ninh Kiều – Cần Thơ |
| Cà Mau | 20 | 10 | 7 | 3 | 0 | 0 | Thành phố Cà Mau |

Có ứng viên bìa chỉ tính metadata/observation hiện có, chưa chứng nhận ảnh đúng địa điểm, giấy phép hoặc URL còn hoạt động. Khoảng cách là đường thẳng tới điểm neo biên tập, không phải tuyến đường/giờ di chuyển. 20 mục quá ngưỡng gợi ý(35kmtham quan/15kmăn-cà phê), cần thay hoặc chia tuyến trước demo. Các cụm tỉnh sau sáp nhập không đại diện phủ toàn tỉnh.

Đã loại tên quá chung và sàng lọc cùng tên cách nhau dưới400m trong lựa chọn; chưa coi đây là kiểm tra trùng/hợp lệ hoàn chỉnh. Ưu tiên mục có nguồn/Wikidata/ảnh/giới thiệu, không tự bổ sung giá0,24h hoặc mô tả mẫu để đủ số. 740 ứng viên có 183 URL website gợi ý; tồn tại URL không có nghĩa website thuộc đúng cơ sở hoặc chứa thông tin đủ dùng.

## Manifest và tiến độ

- [Danh sách740ứng viên](../.local/manual-tourism-import-20261025/demo-740-candidates.ndjson): ID/revision,nhóm,tỉnh,cụm,tọa độ,nguồn,hints và Google trạng thái unverified.
- [Tổng hợp phạm vi](../.local/manual-tourism-import-20261025/demo-740-scope.json).
- Script prepare-demo-scope.mts tạo danh sách và write-demo-scope-report.mts đọc lại xác nhận34tỉnh,740IDduy nhất,40/20đúng hạn mức và chưa gán xác minhGoogle. Tất cả nằm dưới thư mục ignored .local/manual-tourism-import-20261025.

Lượt lập phạm vi chỉ đọc MongoDB và ghi manifest/report, không tạo thêm740địa điểm trùng, không sửa bản public, không gọi publish hoặc xóa26k. Worker toàn quốc chưa được đổi scope sang740; cần cấu hình/đợt demo riêng trước khi tuyên bố chỉ còn xử lý740mục. Chưa chạy thử lịch Goe1–2ngày cho mỗi tỉnh.
