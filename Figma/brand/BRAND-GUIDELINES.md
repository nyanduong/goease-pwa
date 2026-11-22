# GoEase · Hướng dẫn thương hiệu v1.0

## Màu sắc

| Vai trò trong E2 | Giá trị | Cách dùng |
| --- | --- | --- |
| Cobalt | `#334EAC` | Lựa chọn, nút tròn, link, icon và nhãn nav đang chọn |
| Navy | `#19264D` | Nền đặc của tiêu đề hero |
| Coral | `#FF8A5B` | Điểm sáng và phản chiếu trong hình, chi tiết nhận diện trên logo |
| Nền trang | `#F7F8FC` | Khung nội dung E2 |
| Trắng | `#FFFFFF` | Header, thẻ, input, nav, chữ trên cobalt và navy |
| Chữ chính | `#202A46` | Tiêu đề, nội dung chính và wordmark |
| Chữ phụ | `#43516C` | Mô tả, placeholder, nhãn switch và nav chưa chọn |
| Cobalt nhạt | `#E9EDFA` | Nền ô icon, bộ đếm Dấu ấn, chữ nhãn minh họa trên nền tối |
| Nền switch | `#ECEFF6` | Nền thanh chuyển ngữ cảnh |
| Đường chia | `#E1E5F0` | Viền thẻ, viền chip, đường ngăn header và nav |
| Viền điều khiển | `#7785A6` | Viền tìm kiếm và chọn địa điểm, icon tìm kiếm |
| Nền ấm và nét ấm | `#FFE8DF` / `#8F352B` | Nền và nét icon của ô Cà phê, thẻ Cà phê ven sông |
| Nền hai vùng minh họa | `#131E3D` / `#EBF0FA` | Phần media của hero / thẻ nổi bật |

Nền ngoài khung `#F0F2F6` thuộc HTML xem trước. Giá trị alpha của nhãn minh họa và bóng nằm trong [tokens.json](tokens.json). Các sắc độ bên trong artwork được giữ trong SVG xuất gốc. UI chỉ dùng vai trò phù hợp đã có trong tokens. Các vai trò trạng thái nghiệp vụ và dark mode của ứng dụng có trạng thái **UNKNOWN**.

## Chữ và icon

- Dùng đúng stack hệ thống và thông số trong [DESIGN.md](DESIGN.md). Xác nhận font ánh xạ cụ thể khi đưa vào Figma, vì `system-ui` phụ thuộc hệ điều hành. Giữ Arial ở các control khi đối chiếu bản Edge/Windows.
- Giữ dấu tiếng Việt và chữ hoa/thường của từng vai trò. Giữ tiêu đề hero hai dòng và nhãn ngắn một dòng tại 390 px. Nhãn tab ghi **Dấu ấn**. Tiêu đề thẻ trong E2 ghi **DẤU ẤN**.
- Dùng icon outline SVG, đầu nét và góc nối bo tròn. Kích thước SVG chính là 14, 18, 20 hoặc 22 px, với nét thường khoảng 1,9–2,5 trên viewBox 24. Ở danh mục, nhãn chữ luôn đi cùng icon. Cobalt là nét chủ đạo trên nền nhạt, nét ấm dùng ở đúng các ô đã quan sát.

## Hình ảnh

- Hero dùng minh họa sông về đêm, mảng xanh sâu và một số điểm phản chiếu coral. Tiêu đề trắng nằm trong khối navy đặc dưới hình. Giữ vùng minh họa cao 125 px và nhãn “Minh họa tạm” ở góc trên trái.
- Thẻ Chợ nổi Cái Răng dùng minh họa ghe trên nền xanh nhạt, media cao 148 px và nhãn “Minh họa tạm” ở góc trên phải. Tên địa điểm và mô tả nằm dưới ảnh.
- Hai minh họa là SVG nội tuyến trong ZIP E2. Thông số ảnh chụp sản xuất, chủ thể, crop, nguồn và quyền sử dụng có trạng thái **UNKNOWN**. Giữ nhãn thật của minh họa và duyệt ảnh thay thế theo nguồn, giấy phép và vị trí cắt.

## Logo G dẫn đường

Logo duyệt là dải G trắng gấp xanh, chóp và ghim san hô trên tile navy. [SVG master](assets/logo/goease-g-master.svg) giữ nguyên mã SVG nội tuyến trên bảng logo. Tile là một phần của logo duyệt, dùng nền chuyển `#16233F` sang `#19264D`. Màu nếp gấp là `#6CA6DC` → `#A7DDF7` và `#5F9AD5` → `#B6E3FA`, với mặt mũi tên `#9AD2F4` và chi tiết san hô `#FF8A5B`.

- Dùng master ở cỡ lớn. Ở 32 và 16 px, dùng hai biến thể quang học từ chính Stitch. Bản 16 px thể hiện ghim bằng một chấm san hô. Chữ GoEase là wordmark/text độc lập cạnh icon.
- Dùng `pwa-512.png` khi cần PNG RGBA. Alpha trong suốt nằm ở bốn góc ngoài tile. Hai PNG trên nền sáng và tối dùng cùng master, không đổi màu hoặc thêm viền.
- Dùng `pwa-maskable-512.png` khi nền icon cần phủ tới mép và hình G cần nằm trong vùng an toàn. Bản này mở rộng nền navy tới mép vuông và giữ nguyên hình G. [Ảnh kiểm tra logo](assets/screenshots/logo-size-and-mask-qa.png)
- Tránh kéo giãn, xoay, tô lại, bỏ tile, gắn chữ vào icon hoặc thêm bóng. Khoảng trống tối thiểu quanh logo và thông số lockup áp dụng trong header có trạng thái **UNKNOWN**.

| Nên dùng | Nên tránh |
| --- | --- |
| Trắng trên cobalt hoặc navy cho nhãn đọc | Coral sáng làm chữ trên trắng |
| Chữ phụ slate và viền điều khiển đúng vai trò | Tái dùng màu viền cho chữ placeholder |
| Token ngữ nghĩa cho thành phần và trạng thái đã xác minh | Lấy màu trực tiếp từ nét gấp logo hoặc nền minh họa để đặt trạng thái mới |
| Ảnh E2 làm mẫu bố cục và artwork | Đưa ký hiệu thử nghiệm trong header ảnh E2 vào bộ nhận diện |
