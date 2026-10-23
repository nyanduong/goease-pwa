# Rà 11 lượt dừng thiếu giá — 24/10/2026

## Lịch được đối chiếu

Đọc trực tiếp tab customer `/trips/new`: Hội An, 3 ngày, 3 người, chưa chốt ngày, chưa lưu. Không thay bằng một lịch test khác. 15 lượt dừng, 11 lượt thiếu giá, tương ứng 9 địa điểm riêng (Cánh Buồm Trắng lặp cả 3 tối).

| Ngày | Điểm chưa có giá                  | Kết quả rà                                                                                                          |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | Dạo bên sông Hoài                 | Không thay bằng giá đi thuyền/hoa đăng. Chưa có nguồn đủ rõ xác nhận giá cho đúng hoạt động catalog; giữ null.      |
| 1    | Nhà cổ Đức An                     | Thuộc hệ thống di tích theo danh sách vé cũ; chưa nhập phí riêng do lịch có sẵn vé gói và chưa xác định phần trùng. |
| 1    | Cánh Buồm Trắng — Lê Lợi          | Website đúng địa chỉ 02/24 Lê Lợi, menu dạng ảnh không trích được giá một bữa/suất rõ ràng; giữ null.               |
| 2    | Nhà cổ Quân Thắng                 | Như Đức An; không lấy giá blog làm mức đã xác minh.                                                                 |
| 2    | Bảo tàng Gốm sứ Mậu dịch          | Thuộc hệ thống vé tham quan; chưa xác định điều kiện tính bổ sung ngoài vé gói.                                     |
| 2    | Bảo tàng Thổ sản                  | Xác nhận đúng 57 Trần Phú, không có giá riêng trong bài giới thiệu cơ quan quản lý.                                 |
| 2    | Cánh Buồm Trắng — Lê Lợi          | Cùng địa điểm ngày 1, một lượt ăn khác; giữ null.                                                                   |
| 3    | Bảo tàng Văn hóa Sa Huỳnh         | Thuộc hệ thống vé tham quan; không nhầm với Bảo tàng Văn hóa Sa Huỳnh–Chămpa trong dòng phí riêng của nghị quyết.   |
| 3    | Hội quán Quảng Triệu (Quảng Đông) | Có trong danh sách di tích vé cũ; chưa cộng phí riêng chồng lên vé gói.                                             |
| 3    | Tượng đài Kazik                   | Xác nhận công viên/địa điểm từ bài VOV, không thấy xác nhận phí hiện hành; không tự đặt 0.                          |
| 3    | Cánh Buồm Trắng — Lê Lợi          | Cùng địa điểm ngày 1, một lượt ăn khác; giữ null.                                                                   |

## Nguồn và giới hạn

- [Danh sách vé/di tích của đơn vị quản lý](https://hoianworldheritage.org.vn/vi/news/Dieu-can-biet/Ve-tham-quan-Hoi-An-641.hwh): nhận diện Đức An, Quân Thắng, Gốm sứ, Sa Huỳnh, Quảng Đông; bài cũ, không dùng để khẳng định giá hiện hành.
- [Thông báo đơn vị quản lý tháng 1/2026](https://hoianheritage.danang.gov.vn/en/news/news-events/announcement-of-the-visiting-in-hoi-an-ancient-town-125.html): vẫn niêm yết gói 80k/120k; bản tiếng Anh ghi chọn một bảo tàng, khác cách diễn đạt của bài 2023 đã dùng ở lượt import trước.
- [Bản tra cứu Nghị quyết 98/2026](https://congluatviet.vn/van-ban/sua-doi-bo-sung-mot-so-dieu-nghi-quyet-so-02-2026-nq-hdnd-ngay-11-02-2026-98-2026-nq-hdnd) và [Nhân Dân ngày 7/8/2026](https://nhandan.vn/da-nang-dieu-chinh-phi-tham-quan-cac-cong-trinh-van-hoa-va-di-san-post980432.html): mức 20k/người/công trình từ 10/8/2026. Cổng thành phố trả 403 khi mở. Các nguồn đã đọc chưa giải thích việc bán gói song song hoặc cách khấu trừ vé gói. Không suy ra mỗi điểm miễn phí hoặc cộng cả gói lẫn phí từng điểm.
- [Bảo tàng Thổ sản — đơn vị quản lý](https://hoianheritage.danang.gov.vn/vi/trao-doi-chuyen-nganh/chuyen-de-nghien-cuu-trao-doi/thong-tin-ve-bao-tang-tho-san-hoi-an-1270.html).
- [Menu chính thức Cánh Buồm Trắng](https://canhbuomtrang.com/white-sail-hoi-an-seafood-menu/): trang ảnh menu; ảnh trả timeout qua công cụ đọc. Không dùng giá placeholder của trang tiếng Việt hoặc mức chi tiêu đánh giá cộng đồng làm giá suất.
- [VOV — tượng Kazik ở công viên Trần Phú](https://english.vov.vn/en/society/vietnam-pays-tribute-to-polish-architect-kazik-345815.vov): thông tin vị trí, không phải nguồn giá.

**Kết quả dữ liệu: chưa thêm giá mới cho 11 lượt này**, giữ nguyên null theo yêu cầu owner. Cần đối chiếu cách bán vé thực tế trước khi dùng phí công trình hoặc xác nhận lại gói 120k. Số 120k đã có trong snapshot lịch giữ nguyên, không coi việc phép tính đúng là kiểm chứng giá gói hiện hành. Không chỉnh giờ mở cửa, không clear DB, không xuất bản giá phỏng đoán.

## UI đã thay và kiểm chứng

- Đặt chi phí đã biết mỗi người lên trước, kèm tổng nhóm.
- Mục Các khoản chưa tính nêu rõ chỗ ở/di chuyển chưa thêm và các khoản ngoài lịch; mở được danh sách từng lượt dừng theo ngày. Không bắt khách nhập giá để tiếp tục.
- Trên đúng lịch đang mở: 120k + 3 × 550k = 1.770.000đ/người; nhóm 3 người = 5.310.000đ. Đây là phép tính trên snapshot hiện có, chưa phải tổng chuyến hoặc xác nhận giá hiện hành.
- Typecheck client, ESLint file thay đổi và 3 bài budget unit test đều pass. Quan sát UI thật thấy đủ 11 dòng, các điểm trùng vẫn phân biệt ngày. Không gọi lại model hoặc lưu thay lịch khách.
- Không đổi API, schema, quy tắc cộng tiền hay snapshot. Chưa có xử lý vé gói để khấu trừ phí các điểm liên quan; chưa pass dữ liệu chi phí đầy đủ.
