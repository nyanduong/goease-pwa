# Tăng tốc và nhập ảnh thật — 26/10/2026

Owner yêu cầu xử lý ảnh song song hoặc hỗ trợ import ảnh. Luồng mới chạy tối đa 3 địa điểm đồng thời trên máy local (cấu hình server nhận1–4), ưu tiên tỉnh48. Commons Action API vẫn tuần tự theo process, giữ maxlag và cooldown; tải ảnh/re-encode/upload có thể chạy chồng. Enqueue admin đặt observation priority100; đã xếp ưu tiên Cầu Sông Hàn, bảo tàng điêu khắc Chăm, Núi Bà Nà, Chùa Cầu, Sun World Bà Nà Hills và Cầu Rồng. Worker tiếp tục khi API chạy; không có automation chạy sau khi tắt API.

## Vấn đề chất lượng phát hiện trong lượt chạy thật

Fallback bán kính500m đã tìm ảnh sân bay/sự kiện cho ThanhHuong Coffee, CaPhe Thu Dung và ảnh trang trí Tết cho CafeThoang Sai Gon. Những ảnh này không được coi là ảnh đúng quán. Đã siết kiểm tên trên cả named/nearby và rút gợi ý không khớp khỏi observation automatic của draft chưa chọn ảnh/không khóa. Không sửa ảnh editorial, public snapshot hoặc xóa Cloudinary asset. Số ready giảm sau khi loại gợi ý không đúng là kết quả kiểm chất lượng, không phải mất file ảnh hợp lệ.

Tên tỉnh mới có thể làm query tên+tỉnh bỏ sót ảnh Commons vẫn ghi địa danh cũ. Đã thêm tìm tên riêng trước fallback tọa độ; mọi kết quả vẫn phải qua kiểm tên. Điều này không xác minh hoàn toàn đối tượng, có thể bỏ sót ảnh đúng có tên tiếng Anh; cần nguồn khác hoặc nhập thủ công cho các mục còn thiếu.

## Hai ảnh nhập thủ công có kiểm tra

Đã xem ảnh gốc, đọc trang nguồn/giấy phép, lấy metadata qua Commons imageinfo và ghi bằng `catalog.write` của admin hiện có, intent save. Lưu bản gốc sang WebP lossless qua `catalogCoverStorage`; không resize, không tự xuất bản.

| Địa điểm | Place ID                 | Revision đề xuất | Nguồn ảnh / tác giả / quyền                                                                                             |
| -------- | ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Chùa Cầu | 6ade1f3be4cdfbb2a2f4eecf | 2                | [Chua Cau.jpg](https://commons.wikimedia.org/wiki/File:Chua_Cau.jpg), Gene Bromberg, CC-BY-SA-2.0                       |
| Cầu Rồng | 6ade1f45e4cdfbb2a2f4fecd | 2                | [Cầu Rồng.jpg](https://commons.wikimedia.org/wiki/File:C%E1%BA%A7u_R%E1%BB%93ng.jpg), Bùi Thụy Đào Nguyên, CC-BY-SA-3.0 |

Cả hai Cloudinary URL trả HEAD200 sau lưu, metadata reviewed/selection admin/kind photo/storage cloudinary/originalUrl/sourceUrl/credit/license được giữ. Ảnh là ảnh tư liệu cũ theo ngày trên trang nguồn, không khẳng định hiện trạng mới nhất hoặc xác minh giờ/giá. Đề xuất ảnh ở catalog_versions; raw places.images có thể vẫn rỗng cho đến khi xuất bản, nên không dùng count raw images làm bằng chứng đề xuất bị mất. Nội dung vẫn là draft, chưa hoàn thiện toàn bộ hai địa điểm.

Các script/metadata/bản ảnh nguồn và báo cáo chi tiết ở `.local/manual-tourism-import-20261025/`, ignored, không đưa credentials hoặc dump vào Git. Không clear database, không publish hàng loạt, không sinh AI hoặc mua/nâng gói Cloudinary.

## Kiểm chứng

- Typecheck/lint/build đạt; build còn cảnh báo chunk client lớn hơn500kB.
- 105 kiểm thử đơn vị đạt, gồm lọc sai tên, tuần tự Commons API và cooldown khi429.
- 14 kiểm tra integration (pool + regression nhập tỉnh) đạt: bounded overlap3, atomic claim không trùng, ưu tiên tỉnh/admin request, stop drain, bỏ observation sai tên và giữ khóa, default cover/retry/publication.
- Hai browser regression ảnh đạt: AI desktop/mobile/editor và link gallery hỏng vẫn giữ bìa.
- Luồng live lưu hai ảnh trên Cloudinary thành công, HEAD200; không suy rộng thành tất cả địa điểm đã có ảnh.
