# Bổ sung catalog Hội An — 24/10/2026

## Dữ liệu đã lưu qua UI admin

| Điểm | Dữ liệu / phạm vi |
| --- | --- |
| LaQue Restaurant & Coffee | Bổ sung inclusions/exclusions cho set Love Sick 550.000đ/người, giữ giờ 11:00–21:00. Nguồn: https://chuanlaque.com/product/set-menu-love-sick-550-pax/ và trang chủ. |
| Rau Ơi Eatery — nhà hàng chay | Thêm địa điểm thực, 110 Trần Nhân Tông, 08:00–20:00. Set 1 giá 250.000đ/người, **tối thiểu 2 khách**. 6 món trong ảnh menu: https://rauoieatery.com/wp-content/uploads/2024/11/set1.jpg, trang https://rauoieatery.com/product/set-menu-1/. Đã đọc ảnh trực tiếp trên browser. |
| Bảo tàng Precious Heritage — Réhahn | Thêm địa điểm thực tại 26 Phan Bội Châu, 08:00–20:00 hằng ngày; miễn phí cho mọi khách; thời lượng 60 phút trong khoảng 45–60 phút đơn vị khuyến nghị. Nguồn: https://www.rehahnphotographer.com/precious-heritage-museum/. |
| Bảo tàng Gốm sứ Mậu dịch | Phí tham quan từng công trình 20.000đ/người, mức phổ thông theo thông tin Nghị quyết 98/2026 từ 10/8/2026: https://nhandan.vn/da-nang-dieu-chinh-phi-tham-quan-cac-cong-trinh-van-hoa-va-di-san-post980432.html. Giữ giờ 07:30–21:30, đóng ngày 11 và 26 mỗi tháng, đọc lại https://hoianmuseum.com/vi/about/bao-tang-gom-su-mau-dich.html. |

Ngày đối chiếu 24/10/2026; ngày kiểm tra lại 23/11/2026 là lịch biên tập GoEase, không phải cam kết giữ giá của đơn vị. Giới hạn 10 khách là phạm vi dự toán, không phải công bố sức chứa. Giá nhà hàng là giá niêm yết set; nguồn chưa giải thích thuế/phí, đã ghi rõ giới hạn này, không gọi là giá thanh toán all-in. Phí bảo tàng chưa tự áp dụng miễn giảm theo tuổi/đối tượng.

## Vé gói và dữ liệu chưa hoàn tất

Đã ngừng hiển thị bản Phố cổ Hội An 120.000đ cũ qua thao tác theo lô admin (1/1 thành công), để không thêm chồng gói cũ với phí từng công trình trong lịch mới. Snapshot chuyến đã lưu không đổi. Khác lượt rà 11 điểm trước: lần này dùng phạm vi phí từng công trình cho lịch mới và loại bản gói cũ khỏi catalog công khai, không bổ sung phí chồng lên lịch cũ.

Chưa tạo gói thật: nguồn cũ có hạn ngạch theo nhóm điểm (một bảo tàng…), chưa đủ căn cứ xác nhận cách bán/khấu trừ sau quy định phí mới. Không dùng maxEntries=5 để giả lập điều kiện đó. Những điểm khác thiếu nguồn tiếp tục không đủ điều kiện Goe; Trà Quế chưa bổ sung giờ vì nguồn thứ cấp tìm được nhầm địa chỉ/giá hoặc nói về nhà vườn riêng.

## Sửa điều kiện số khách

Thêm minTravelers optional (thiếu hiểu là 1) vào contract, model và UI admin; hiển thị khoảng số khách ở customer. Kiểm tra min<=max; Goe/budget không áp dụng giá ngoài khoảng. Không biến giá set tối thiểu 2 khách thành giá đi một mình. Nguồn thật Rau Ơi đã lưu min=2 qua UI.

## Kiểm chứng

- 42 unit tests pass; 16 focused planner/budget tests pass sau bổ sung trường hợp minTravelers trong planner.
- Typecheck, lint và build pass; cảnh báo chunk client >500kB còn tồn tại.
- Integration lần đầu chưa chạy do thiếu MONGOD_BINARY; chạy lại với binary local và DB tách biệt của test harness: 10 tests pass (publication, authorization, persistence, snapshots, rollback, archive).
- UI admin đã thấy giá mới và trạng thái ngừng hiển thị gói cũ. Ảnh: `.local/catalog-enrichment-24-10.png` (ignored).
- UI customer đã tạo lịch tự động 1 ngày, 3 người, không nhập ngân sách: 09:00 Gốm sứ, 12:00 LaQue, 14:00 Precious Heritage, 18:00 Rau Ơi. Giờ và thời lượng trong phạm vi đã nhập. UI dự toán từ server hiển thị 820.000đ/người, 2.460.000đ/nhóm (ăn uống 2.400.000đ, trải nghiệm 60.000đ); không có gói phố cổ cũ.
- Lưu ngày 12/11/2026 thành `[TEST] Hội An — giá mỗi người 24-10`, ID `6adbb0a9469ab4954d65109e`; reload và mở tab mới vẫn giữ bốn điểm cùng đơn giá. Bộ 4 điểm đủ lịch 1 ngày cho 2–10 người khi bảo tàng mở, chưa đủ 2–3 ngày hoặc ngày bảo tàng đóng cửa.
- Ban đầu UI chặn do quota AI. Owner cho phép tăng tạm thêm 3 lượt; local user 10→13, global mặc định 20→23. Gọi tạo lịch lại thành công một lần, không reset usage. Đã khôi phục .env user 10/global mặc định 20 và kích hoạt restart dev server sau khi lưu xong.
- Tab cũ có lỗi công cụ điều khiển CDP Input; tab mới mở được màn hình chi phí bình thường, không kết luận là lỗi nút ứng dụng.
- Tab mới của chuyến đã lưu xác nhận lại 820.000đ/người, 2.460.000đ/nhóm. Mở phần chi tiết giá thấy inclusions/exclusions và Rau Ơi minTravelers=2 vẫn được bảo toàn. Ảnh UI: `.local/customer-prices-verified.png`. Kết luận pass phạm vi tạo AI → dự toán → lưu → mở lại cho 1 ngày/3 người; không coi đây là pass vé gói thật hoặc toàn bộ dữ liệu nhiều ngày.
- Phép tính kỳ vọng cho 1 ngày, 3 người: (550.000 + 250.000 + 20.000 + 0) × 3 = 2.460.000đ nhóm; 820.000đ/người. Đây là dự toán các mục trong lịch, không bao gồm chỗ ở/di chuyển/chi ngoài phạm vi set.
