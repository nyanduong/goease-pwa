# GoEase — E2 Brand Refinement

**Ngày rà soát** 22/11/2026  
**Kết quả** PASS cho vòng tinh chỉnh thiết kế tĩnh. River Night Weekend là hướng thẩm mỹ đã chọn. E2, bảng màu, typography và ba logo vẫn đang ở giai đoạn review.

[Mở project GoEase trong Stitch](https://stitch.google.com/u/1/projects/18209224056946538963)

- [E2 mobile full-height](E2-mobile.png) · [Ảnh E và E2 cạnh nhau](E-so-voi-E2.png) · [Ảnh E gốc](E-goc.png)
- [Bảng ba logo G trên Stitch](E2-logos-G.png) · [24 mẫu PNG đúng kích thước](Logo-kiem-kich-thuoc.zip)
- [Bản xuất Stitch của E2](E2-Stitch.zip) · [Bản xuất Stitch của bảng logo](E2-logos-Stitch.zip)

## T01 Home v2

Artboard `E2 — Brand Refinement` trên Stitch rộng **390 px** và cao **1.377 px** ở chế độ xem toàn màn cuộn. Đã xem trên canvas và kiểm tra PNG xuất. Thứ tự vẫn là Header, Context Switch, Hero, Search, Filters, Categories, Featured Experience, Suggestions, Dấu ấn và thanh đáy Khám phá / Đi chơi / Dấu ấn / Tôi. Chữ “Cần Thơ”, bốn nhãn lọc và bốn nhãn điều hướng đều nằm gọn một dòng trong bản xuất. Phần Dấu ấn hiển thị trọn phía trên thanh đáy.

**Điểm mạnh.** E2 dồn navy vào hero, dùng cobalt cho trạng thái chọn và giữ off-white ở vùng đọc. Coral chủ yếu xuất hiện trong phản chiếu và minh họa. Các nhãn đậm vừa đủ, có dấu rõ và các khoảng hở giữa chip được phân bổ đều. Hai hình minh họa tự chứa đã thay khung ảnh lỗi và cùng ghi “Minh họa tạm”. Hai badge quảng bá ở bản E đã được bỏ khỏi E2.

**Đánh đổi.** E2 dài hơn E gốc 154 px. Phần nổi bật bắt đầu thấp hơn do hero, vùng lọc và danh mục có thêm khoảng thở. Hai hình phẳng giúp review bố cục ngay, nhưng chất lượng và điểm cắt của ảnh chụp địa điểm vẫn cần review khi có tệp ảnh sử dụng được.

**Ảnh tư liệu.** Hai nguồn đúng đề tài đã được kiểm tra giấy phép, nhưng máy nhận HTTP 429 khi tải tệp. Hai nguồn dưới đây là ứng viên, còn E2 hiện dùng vector minh họa, không trình bày như ảnh chụp.

- Bến Ninh Kiều về đêm, Christophe95, CC BY-SA 4.0. [Trang ảnh và giấy phép](https://commons.wikimedia.org/wiki/File:Ninh_Kieu_Quay_at_night.jpg)
- Chợ nổi Cái Răng, Vyacheslav Argenberg, CC BY 4.0. [Trang ảnh và giấy phép](https://commons.wikimedia.org/wiki/File:Can_Tho,_Vietnam,_Floating_Market,_Boats.jpg)

## Vai trò màu đề xuất và tương phản chữ

Các tỷ lệ dưới đây tính từ màu trong bản xuất cuối. WCAG 2.2 SC 1.4.3 mức AA yêu cầu tối thiểu 4,5:1 cho chữ thường và 3:1 cho chữ lớn. [W3C · Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

| Vai trò | Màu chữ và nền | Tỷ lệ |
| --- | --- | ---: |
| Chữ chính | `#202A46` trên trắng `#FFFFFF` hoặc off-white `#F7F8FC` | 14,18:1 / 13,36:1 |
| Chữ phụ và gợi ý tìm kiếm | `#43516C` trên `#FFFFFF` | 7,98:1 |
| Context chưa chọn | `#43516C` trên `#ECEFF6` | 6,93:1 |
| Tiêu đề hero | `#FFFFFF` trên navy `#19264D` | 14,73:1 |
| Nút và chip đang chọn | `#FFFFFF` trên cobalt `#334EAC` | 7,43:1 |
| Link và tab đang chọn | `#334EAC` trên `#F7F8FC` hoặc `#FFFFFF` | 7,00:1 / 7,43:1 |
| Chữ cobalt trên nền nhấn nhẹ | `#334EAC` trên `#E9EDFA` | 6,35:1 |
| Coral sáng | `#FF8A5B` trên trắng chỉ đạt 2,32:1 | Dùng cho minh họa hoặc trang trí |
| Chữ trên nền coral nếu cần | Navy `#19264D` trên `#FF8A5B` | 6,34:1 |

Chữ gợi ý tìm kiếm trước khi sửa dùng `#7785A6` trên trắng, đạt 3,69:1. CSS xuất cuối có quy tắc ghi đè sang `#43516C` với opacity 1. Giữ `#7785A6` cho viền hoặc icon phù hợp. Các tỷ lệ trên đánh giá các cặp chữ và nền, chưa bao quát chứng nhận WCAG, phóng to chữ, điều hướng bàn phím hoặc trình đọc màn hình.

**Typography đề xuất.** Dùng họ sans cục bộ có dấu Việt, ưu tiên `system-ui` và `Segoe UI` trên Windows. Dùng hero 24/30, đậm 800 như E2. Dùng tiêu đề khu 18/24 và tiêu đề thẻ 16–17/22. Phần mô tả dùng 13–14/18–20. Nhãn bộ lọc và tab dùng 12–13/16, giữ các cụm ngắn như “Cần Thơ”, “Gần đây” và “Dấu ấn” trên một dòng tại 390 px.

## Ba phương án G

| Phương án | Ưu điểm | Điểm cần review |
| --- | --- | --- |
| **G hình học** | Vòng mở và thanh ngang rõ ở 16 px, dễ đọc trên cả hai nền. | Dáng trung tính, ít gợi riêng về địa phương. |
| **G định vị** | Chóp nhẹ ở đáy gợi khám phá địa điểm, thân chữ vẫn đọc là G. | Chóp gần mép dưới của vector. Cần rà vùng an toàn nếu làm icon maskable. |
| **G dòng chảy** | Thanh cong nhẹ hợp chủ đề sông nước và vẫn giữ hình chữ G. | Nét cong khó phân biệt với G hình học ở 16 px. Mẫu sáng đã được đồng bộ cùng hình với các cỡ còn lại. |

Bảng dùng cobalt trên nền sáng và trắng trên nền navy. Đã dựng lại 24 PNG từ chính vector xuất của Stitch và xác nhận đủ 16×16, 32×32, 192×192 và 512×512. Mỗi hướng dùng cùng hình vector cho hai nền và bốn kích thước. Bảng Stitch hiển thị mẫu 512 px ở dạng thu nhỏ. Gói PNG có bản raster đúng kích thước. Chú thích phụ trên nền trắng của bảng đã đổi sang #43516C, đạt 7,98:1. Các logo độc lập chỉ chứa chữ G cách điệu. Chưa chọn logo cuối hoặc gắn một phương án từ bảng vào header.

## Phạm vi bàn giao

Bản E gốc và các concept A–G được giữ nguyên. Mã HTML xuất lại từ E trùng SHA-256 với bản lưu vòng trước. Stitch tạo một frame khi tái dựng E2, nên bản trước rà soát được giữ riêng với tên `E2 — Bản nháp trước rà soát`. Bản bàn giao mang tên `E2 — Brand Refinement`.

Chỉ làm việc với thiết kế T01 và bảng logo. Chưa kiểm thử hành vi của PWA đã triển khai. File Figma, mã ứng dụng và plugin giữ nguyên.
