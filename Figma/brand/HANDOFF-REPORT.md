# GoEase · Báo cáo Brand Freeze v1.0

**Ngày bàn giao** 22/11/2026

## Kết quả xác minh

- **PASS · E2.** Trên canvas Stitch, frame **E2 — Brand Refinement** rộng **390 × 1.377 CSS px**. Tiêu đề trong HTML xuất là `T01 GoEase Home (E2 — Brand Refinement)`. PNG toàn màn cuộn có **487 × 1.722 px**, gồm đủ khối Dấu ấn và thanh nav. [Project Stitch](https://stitch.google.com/u/1/projects/18209224056946538963)
- **PASS · Logo.** Chủ dự án xác nhận bản **E2 — Logo G dẫn đường** mới nhất trong lượt bàn giao. Bảng sống và ZIP xuất hiển thị dải G trắng gấp xanh, ghim san hô và chóp vát trên tile navy ở master. Header trên E2 vẫn là ký hiệu của bản mẫu. Xác nhận bản lockup khi áp biểu tượng chính thức vào header ở công việc sau.
- **PASS · Phạm vi.** Bản bàn giao dựa trên hai frame được chọn. Toàn bộ thay đổi trong repository thuộc `Figma/brand/`. Commercial V1 PRD và UX Architecture là nguồn sản phẩm đã duyệt theo xác nhận của chủ dự án. Bàn giao ghi nhận tên tab **Dấu ấn** và các quan sát trên T01, chưa xác minh thêm nghiệp vụ hoặc màn hình sản phẩm.
- **UNKNOWN · DESIGN.md có sẵn trong Stitch.** Menu `DESIGN.md` của E2 mở bảng nhập/tạo và các preset. ZIP chứa `code.html` và `screen.png`. Tệp `DESIGN.md` bàn giao được soạn từ E2 xuất trực tiếp theo cấu trúc định dạng mở. [Đặc tả DESIGN.md của Google Labs](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)

## Tài liệu và assets

| Tệp | Nội dung |
| --- | --- |
| [DESIGN.md](DESIGN.md) | Hướng thẩm mỹ, màu, chữ, layout và nguyên tắc triển khai |
| [tokens.json](tokens.json) | Token ngữ nghĩa sRGB, giá trị và alias theo DTCG 2025.10 cho React và Figma Plugin |
| [BRAND-GUIDELINES.md](BRAND-GUIDELINES.md) | Bảng màu, hướng dẫn chữ, hình ảnh và sử dụng logo |
| [components-spec.md](components-spec.md) | Định lượng các component quan trọng của T01 |
| [ZIP E2](assets/exports/e2-brand-refinement.zip) · [PNG E2](assets/screenshots/e2-brand-refinement.png) | Xuất từ frame E2, giữ nguyên ZIP và PNG trong ZIP |
| [ZIP bảng logo](assets/exports/e2-logo-g-dan-duong.zip) · [PNG bảng logo](assets/screenshots/e2-logo-g-dan-duong.png) | Xuất từ bảng logo mới nhất. PNG gốc **1.600 × 1.280 px** |
| [SVG master](assets/logo/goease-g-master.svg) · [SVG 192](assets/logo/goease-g-192.svg) · [SVG 32](assets/logo/goease-g-32.svg) · [SVG 16](assets/logo/goease-g-16.svg) | Vector thật trích nguyên mã từ các mẫu nội tuyến trong HTML bảng logo |
| [Favicon 16](assets/logo/favicon-16.png) · [Favicon 32](assets/logo/favicon-32.png) | PNG RGBA ở kích thước thật từ hai mẫu micro tương ứng |
| [PNG/PWA 192](assets/logo/pwa-192.png) · [PNG/PWA 512](assets/logo/pwa-512.png) | PNG RGBA, trong suốt ở góc ngoài tile |
| [Maskable 512](assets/logo/pwa-maskable-512.png) | PNG với nền navy phủ kín hình vuông và giữ nguyên ký hiệu |
| [Nền sáng](assets/logo/goease-g-on-light.png) · [Nền tối](assets/logo/goease-g-on-dark.png) | Hai bản PNG 512 px đặt cùng master lên nền sáng và navy |
| [Bảng QA logo](assets/screenshots/logo-size-and-mask-qa.png) | Soi favicon 1:1, mẫu phóng và mô phỏng ba kiểu mask |

## Bảng màu và typography thực tế

- **Thương hiệu** cobalt `#334EAC`, navy `#19264D`, coral `#FF8A5B`. **Nền và chữ** off-white `#F7F8FC`, trắng `#FFFFFF`, ink `#202A46`, slate `#43516C`. Cobalt nhạt `#E9EDFA`, track `#ECEFF6`, viền nhẹ `#E1E5F0`, viền điều khiển `#7785A6`, nền ấm `#FFE8DF`, nét ấm `#8F352B`. Nền media hero `#131E3D` và media nổi bật `#EBF0FA`. [Bảng vai trò](BRAND-GUIDELINES.md)
- **Chữ** `system-ui` cho nội dung, Arial mặc định cho button/input trong Edge/Windows. Hero 24/30 px, 800. Wordmark 20 px, 800. Tiêu đề khu 18 px, 800. Tiêu đề thẻ nổi bật 17/20,4 px, 800. Nhãn UI 12–13 px, 600–700. Chữ phụ 12 px, 500. Các giá trị line-height `normal` giữ nguyên ở vai trò tương ứng. [Thông số typography](DESIGN.md#typography)

## QA

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| 1. Màu tài liệu khớp E2 | **PASS** | Đối chiếu CSS, style nội tuyến và PNG xuất. Placeholder lấy giá trị cuối sau cascade là `#43516C` ở opacity 1. |
| 2. Tương phản chữ/nền WCAG 2.2 AA | **PASS** cho các cặp chữ đã đo | Cặp thấp nhất trong bảng chữ là 6,35:1. Xem thêm lỗi chỉ báo focus và viền điều khiển bên dưới. |
| 3. Dấu tiếng Việt | **PASS** trên Windows/Edge · **UNKNOWN** trên nền tảng khác | Kiểm tra 146 chữ có dấu ở dạng NFC và chữ đ/Đ. Các độ đậm 500/700/800 của system-ui và 500/600/700 của Arial đều render đủ bằng font thực tế, quan sát bằng Chromium DevTools Protocol. |
| 4. Logo ở 16 px và 32 px | **PASS** trên các PNG xuất | Xem ở kích thước gốc trên nền sáng và tối. Cả hai đọc được hình G. Ở 16 px, ghim thu thành chấm theo mẫu nguồn và chi tiết nếp gấp ít rõ. Ranh giới tile trên nền navy có độ tách thị giác thấp. |
| 5. Cắt icon PWA | **PASS** trên tệp và mô phỏng · **UNKNOWN** trên thiết bị cài PWA | Maskable 512 kín alpha. Pixel xa tâm nhất của ký hiệu là 173,29 px, trong vùng tròn an toàn bán kính 204,8 px. Pixel trong hình G giữ nguyên từ master. Đã xem ba mask mô phỏng tròn, bo góc và vuông cong. |
| 6. Nguồn gốc và quyền sử dụng | **PASS** về truy vết · **UNKNOWN** về quyền phát hành | Logo và minh họa lấy từ xuất Stitch của project. Hai minh họa là vector tự chứa. Chưa có hồ sơ quyền sử dụng mẫu tham chiếu của logo và chưa có ảnh chụp sản xuất đã duyệt. |
| 7. Component specs khớp E2 | **PASS** với T01 tĩnh | So HTML, CSS và PNG. Render xuất gốc cục bộ tại 320, 375, 390, 768 CSS px, cùng chiều cao viewport 844 px. Không tràn ngang toàn trang, nhãn switch dài nhất nằm trong nút, cuộn tới cuối còn khoảng 24 px giữa thẻ Dấu ấn và nav. Hành vi runtime có trạng thái **UNKNOWN**. |
| 8. Màu ngoài token | **PASS** cho bộ tài liệu bàn giao · **UNKNOWN** cho runtime | Đối chiếu 15 mã hex và 8 màu có alpha trong CSS và style nội tuyến với JSON. Phân giải được toàn bộ alias. HTML gốc ghi giá trị CSS trực tiếp. Màu nội bộ của SVG thuộc artwork. |

Kiểm tra gói bàn giao xác nhận hai ZIP đọc được, PNG gốc trùng byte với bản trong ZIP, bốn SVG trùng mã nội tuyến và các PNG logo đúng kích thước. CLI `@google/design.md@0.4.0` kiểm tra `DESIGN.md` với 0 lỗi và 0 cảnh báo.

### Tương phản chữ và icon

Tỷ lệ dùng luminance sRGB. Ngưỡng AA là 4,5:1 cho chữ thường và 3:1 cho chữ lớn. Với các cặp cụ thể, một cặp có 3:1 chỉ đủ cho biểu tượng hoặc ranh giới điều khiển khi tiêu chí 1.4.11 áp dụng. [W3C · 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [W3C · 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

| Vị trí | Màu trước / nền | Tỷ lệ | Trạng thái |
| --- | --- | ---: | --- |
| Chữ chính, thẻ, nút địa điểm | `#202A46` / `#FFFFFF`, `#F7F8FC` | 14,18:1 / 13,36:1 | **PASS** |
| Chữ phụ, placeholder, switch chưa chọn | `#43516C` / `#FFFFFF`, `#ECEFF6` | 7,98:1 / 6,93:1 | **PASS** |
| Tiêu đề hero | `#FFFFFF` / `#19264D` | 14,73:1 | **PASS** |
| Chữ và icon trên lựa chọn | `#FFFFFF` / `#334EAC` | 7,43:1 | **PASS** |
| Link, nav đang chọn, bộ đếm Dấu ấn | `#334EAC` / `#F7F8FC`, `#FFFFFF`, `#E9EDFA` | 7,00:1 / 7,43:1 / 6,35:1 | **PASS** |
| Nhãn minh họa trong hero | `#E9EDFA` / `rgba(14,22,43,0.85)` | ≥ 9,85:1, kiểm trên trường hợp nền trắng | **PASS** |
| Icon tông ấm | `#8F352B` / `#FFE8DF` | 6,59:1 | **PASS** |
| Viền tìm kiếm và địa điểm | `#7785A6` / `#FFFFFF`, `#F7F8FC` | 3,69:1 / 3,48:1 | **PASS** ở ngưỡng phi văn bản |
| Viền chip chưa chọn | `#E1E5F0` / `#F7F8FC` | 1,19:1 | **FAIL** nếu viền được dùng để nhận biết điều khiển |
| Coral sáng làm chữ trên trắng | `#FF8A5B` / `#FFFFFF` | 2,32:1 | **FAIL** cho chữ. E2 dùng coral ở phần minh họa. |

- **FAIL · Focus tìm kiếm.** Trong Edge, ô nhận keyboard focus nhưng `outline: none` và dùng cùng bóng khi focus. Cần chỉ báo focus rõ trước triển khai. [W3C · 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- **FAIL · Trạng thái truy cập của mẫu HTML.** Lựa chọn switch, chip, nav chỉ có class CSS `active`. Bản tĩnh thiếu thuộc tính biểu diễn trạng thái đã chọn cho công nghệ hỗ trợ. Ô tìm kiếm là `readonly`.
- **UNKNOWN · Kích thước đích và thiết bị.** Link “Xem thêm” có phần tử cao 17 px, dưới mốc 24 px, và cần xét khoảng cách với các đích thật theo SC 2.5.8. Nhóm nút chọn địa điểm/switch cao 40 px, chip/tìm kiếm 44 px, nav tối thiểu 56 px. Chưa kiểm thử phóng to chữ, trình đọc màn hình, cử chỉ cảm ứng và safe area trên thiết bị thật. [W3C · 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## Cần xác nhận trước khi import Figma

1. Chốt lockup header với SVG G dẫn đường, kích thước và khoảng trống. Xác nhận chấp nhận giản lược ở favicon 16 px và cách hiển thị tile trên nền navy.
2. Chốt font thực tế cho text styles trong Figma, đặc biệt weight 800 và font control. Đối chiếu các nhãn tiếng Việt với ảnh nguồn.
3. Chốt cách sửa chỉ báo focus, dấu hiệu nhận biết chip chưa chọn và ngữ nghĩa trạng thái chọn. Giữ màu mới ngoài phần freeze cho tới khi có quyết định.
4. Chốt việc dùng hai minh họa tạm trong file thiết kế hoặc cung cấp ảnh sản xuất cùng quyền sử dụng. Xác nhận hồ sơ quyền phát hành logo từ mẫu tham chiếu.
5. Kiểm tra ánh xạ alias, px, sRGB/alpha và typography từ JSON khi chuẩn bị import. Chốt phạm vi responsive ngoài T01 mobile và chạy thử maskable trên thiết bị nếu assets được dùng để phát hành. [W3C · Vùng an toàn maskable](https://www.w3.org/TR/appmanifest/#icon-masks) · [DTCG · Định dạng token](https://www.designtokens.org/tr/2025.10/format/)
