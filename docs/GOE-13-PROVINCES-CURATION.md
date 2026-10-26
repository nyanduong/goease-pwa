# Bổ sung dữ liệu cho Goe — 13 tỉnh/thành

Cập nhật 26/10/2026. Đây là tiến độ dữ liệu local, không phải xác nhận triển khai production hoặc hoàn tất toàn bộ bản nháp.

## Phạm vi chủ sản phẩm đã chốt

Giữ bật: Hà Nội, Lào Cai, Quảng Ninh, Hải Phòng, Ninh Bình, Huế, Đà Nẵng, Gia Lai, Khánh Hòa, Lâm Đồng, Hồ Chí Minh, An Giang, Cần Thơ. 21 tỉnh/thành khác đã tắt hiển thị; giữ nguyên dữ liệu và chuyến đã lưu.

Chỉ hoàn thiện địa điểm có sẵn. Không tạo địa điểm mới, không mua API hoặc nâng cấp gói. Ưu tiên Cần Thơ, rồi các tỉnh/thành còn lại. Nguồn giá/giờ không rõ hoặc mâu thuẫn tiếp tục để chưa xác minh. Phí vào cửa khác với dịch vụ bổ sung; giá một món chỉ được dự toán thành một phần/người với điều kiện nêu rõ.

Ảnh trên Maps không mặc nhiên được phép tải về làm tài sản ứng dụng. Dùng ảnh có quyền tái sử dụng phù hợp, hoặc ảnh AI được ghi rõ `ai_illustration`, `owned` và lời chú thích; không giới thiệu ảnh AI là ảnh chụp cơ sở. Lượt này tạo bốn minh họa: miệt vườn, bảo tàng, công viên ven sông, cầu đi bộ. Bản gốc và mô tả prompt nằm trong `.local/cantho-free-curation/*-asset.json`, ảnh `*-ai-v1.png`; đã lưu Cloudinary và đối chiếu checksum bản gốc.

## Cần Thơ

12 địa điểm đã xuất bản; trong đó 6 địa điểm đạt bộ lọc hiện hành cho nhóm 2 người:

| Địa điểm | Giá dùng dự toán | Giờ/cửa sổ lập lịch | Nguồn và giới hạn |
| --- | ---: | --- | --- |
| Làng du lịch Mỹ Khánh | 149.000đ/người lớn | Hằng ngày 07:30–17:00 | [Bảng giá chính chủ](https://mykhanh.com/dich-vu-va-bao-gia). Bài để ngày 2022; đây là mức đang hiển thị, chưa xác nhận trực tiếp. Không gồm trò chơi thu phí riêng. |
| Bảo tàng thành phố Cần Thơ | 0đ vé tham quan | Chỉ khung sáng 08:00–11:00; đóng thứ Hai, thứ Sáu | [Cổng du lịch xác nhận lịch](https://canthotourism.vn/vi/baotangcantho); [nguồn hướng dẫn công bố miễn phí](https://tourismcantho.vn/bao-tang-can-tho/), đối chiếu thêm Tuấn Kiệt Moto. Cổng du lịch chưa có giá; không gọi đây là báo giá chính chủ. |
| Công viên Ninh Kiều | 0đ đi bộ tham quan | Mở cả ngày, biểu diễn trong định dạng máy bằng 00:00–23:59 | [Cổng du lịch](https://canthotourism.vn/vi/benninhkieu), [nguồn miễn phí](https://bloganchoi.com/dia-diem-du-lich-can-tho/), Maps. Không gồm tàu, giữ xe, ăn uống. |
| Cầu đi bộ Ninh Kiều | 0đ đi bộ tham quan | Mở cả ngày, biểu diễn bằng 00:00–23:59 | [Nguồn hướng dẫn](https://bloganchoi.com/dia-diem-du-lich-can-tho/) và Maps. Khác mục công viên; hai điểm ở cùng khu vực. |
| Pizza Hut — Nguyễn Thái Học | 99.000đ/người | Hằng ngày 10:00–22:00 | [Menu hệ thống](https://pizzahut.vn/): một phần Mì Ý Nấm Xốt Kem/người. Maps xác minh chi nhánh 66 Nguyễn Thái Học và giờ. Chưa xác nhận trực tiếp giá chi nhánh; không gồm gọi thêm/phụ thu. |
| Ngon Vegan — KDC Nam Long | 79.000đ/người | Hằng ngày 06:00–20:00 | [Menu chính chủ](https://www.ngonvegan.com/menu): một phần Pad Thái/người. [Giờ CN2](https://www.ngonvegan.com/lien-he) ghi đến21h; Maps ghi20h nên dùng cửa sổ kết thúc sớm hơn. Menu chung hệ thống, chưa xác nhận trực tiếp CN2. |

Ngày đối chiếu 26/10/2026; các giá đủ điều kiện có ngày kiểm tra lại 02/11/2026. Không tự kéo dài hiệu lực sau ngày này. Thời lượng là ước tính biên tập, không phải cam kết của cơ sở. Phạm vi được kiểm tra là nhóm2 người, không bảo đảm mọi số ngày/nhóm/điều kiện lễ Tết.

Các mục Sao Hôm, Nam Bộ, Lighthouse, Spices, Highlands và Khám Lớn tiếp tục có giới hạn dữ liệu, chưa được gán giá bữa ăn/giá vé suy đoán để mở Goe. Giá Khám Lớn có nguồn mâu thuẫn; Nhà cổ Bình Thủy chưa publish vì giá chưa thống nhất và bìa cũ sai công trình.

## Kiểm tra đã quan sát

- Bộ xếp lịch thực tế `arrangeCompleteDays` và `validatePlan` chạy với DTO đọc từ catalog đã publish: lịch1ngày 26/10,1ngày27/10 và2ngày27–28/10/2026 đều qua cho nhóm2 người. Bao gồm bữa trưa/tối; không lặp điểm tham quan giữa hai ngày; bảo tàng không bị xếp vào thứ Hai.
- Chưa gọi model AI/provider trong lượt xác minh này. Không coi việc xếp lịch nội bộ thành một lần tạo AI thành công.
- Publish qua catalog service với revision, bản phiên bản và audit log. Sau khi sửa địa chỉ, xác nhận lại tọa độ OSM vào proposal trước khi publish; không chép tọa độ Google.
- Bìa Cloudinary trả200; bốn bản gốc AI đối chiếu checksum thành công.
- Tổng số địa điểm vẫn26.567, chuyến2, `ai_runs`1. Không tạo địa điểm/chuyến mới trong curation.
- Nhật ký chi tiết chỉ ở local: `.local/cantho-free-curation/publication-journal.ndjson`, `identity-checks.json`, `planning-checks.json`, `13-provinces-readiness.json`.

## Phần còn lại

Chưa hoàn tất toàn bộ13 tỉnh/thành hoặc870 bản nháp Cần Thơ. Đà Nẵng có11 mục qua bộ lọc hiện tại (5tham quan,4quán ăn,2cà phê) từ đợt trước. Hà Nội có4tham quan đủ dữ liệu nhưng chưa có quán ăn đủ điều kiện; đang bổ sung quán có menu công khai. Hồ Chí Minh có2tham quan, chưa có quán ăn đủ điều kiện. Những tỉnh/thành khác vẫn cần curation trước khi kết luận Goe dùng được. Bảng đếm local là thời điểm kiểm tra, không phải schema hoặc tiêu chuẩn xuất bản mới.
