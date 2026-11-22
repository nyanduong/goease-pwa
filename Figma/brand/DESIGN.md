---
version: alpha
name: GoEase Brand & Design Foundation v1.0
description: River Night Weekend, đo từ E2 trên Google Stitch.
colors:
  primary: "#334EAC"
  on-primary: "#FFFFFF"
  canvas: "#F7F8FC"
  surface: "#FFFFFF"
  ink: "#202A46"
  ink-secondary: "#43516C"
  hero: "#19264D"
  hero-media: "#131E3D"
  featured-media: "#EBF0FA"
  selection-soft: "#E9EDFA"
  switch-track: "#ECEFF6"
  divider: "#E1E5F0"
  control-border: "#7785A6"
  decorative-coral: "#FF8A5B"
  warm-surface: "#FFE8DF"
  warm-ink: "#8F352B"
typography:
  hero:
    fontFamily: system-ui
    fontSize: 24px
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: -0.3px
  wordmark:
    fontFamily: system-ui
    fontSize: 20px
    fontWeight: 800
    letterSpacing: -0.4px
  section-heading:
    fontFamily: system-ui
    fontSize: 18px
    fontWeight: 800
    letterSpacing: -0.2px
  featured-title:
    fontFamily: system-ui
    fontSize: 17px
    fontWeight: 800
    lineHeight: 1.2
  category-label:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.2
  suggestion-title:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
  supporting-text:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 500
  control-label:
    fontFamily: Arial
    fontSize: 13px
    fontWeight: 700
  nav-active:
    fontFamily: Arial
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
  nav-inactive:
    fontFamily: Arial
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
rounded:
  media-label: 6px
  switch-tab: 9px
  icon-tile: 10px
  field: 12px
  card: 14px
  featured: 18px
  hero: 20px
  pill: 999px
spacing:
  switch-gap: 4px
  chip-gap: 6px
  grid-gap: 10px
  section-title-bottom: 12px
  page-inset: 16px
  main-gap: 20px
  main-bottom: 24px
---

# GoEase Brand & Design Foundation v1.0

## Overview

River Night Weekend dùng navy sâu cho hero, cobalt cho lựa chọn và các hành động, nền trắng lạnh cho vùng đọc. Nguồn visual là **T01 GoEase Home · E2 — Brand Refinement**, frame **390 × 1.377 CSS px** trên canvas Stitch. PNG gốc **487 × 1.722 px** và HTML cùng nằm trong ZIP Stitch. Chủ dự án xác nhận biểu tượng **E2 — Logo G dẫn đường**, bản tinh chỉnh mới nhất. Header trong ảnh E2 đang hiển thị ký hiệu G thử nghiệm của frame. Bộ logo đã duyệt được bàn giao riêng.

Commercial V1 PRD và UX Architecture đã duyệt là nguồn quyết định sản phẩm. Tên tab chính thức là **Dấu ấn**. Nguồn đối chiếu visual và đặc tả sử dụng có trong [PNG E2](assets/screenshots/e2-brand-refinement.png), [ZIP E2](assets/exports/e2-brand-refinement.zip) và [đặc tả component](components-spec.md).

## Colors

Dùng `color.surface.page` cho nền, `color.surface.card` cho các thẻ, `color.text.primary` cho tiêu đề và `color.text.secondary` cho nội dung phụ. Dùng chữ trắng trên `color.surface.hero` hoặc `color.surface.selected`. Link và tab chọn dùng cobalt. Coral sáng xuất hiện trong minh họa và logo. Tông ấm trong UI dùng `color.icon.warm` trên `color.surface.warmSubtle`. Border điều khiển tìm kiếm và chọn địa điểm dùng `color.border.control`. Viền thẻ và đường chia dùng `color.border.subtle`, với giới hạn tương phản ở chip chưa chọn được ghi trong báo cáo QA. [Token đầy đủ](tokens.json)

## Typography

Stack nội dung là `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Trên bản xuất trong Edge/Windows, button và input dùng Arial mặc định. Hero 24/30 px, 800. Tiêu đề khu 18 px, 800, line-height `normal`. Tiêu đề nổi bật 17/20,4 px, 800. Nhãn danh mục 13/15,6 px, 700. Chữ phụ 12 px, 500, line-height `normal`. Nhãn nav 12/12 px, 700 khi chọn và 600 ở các mục còn lại. Giữ dấu tiếng Việt và kiểm tra độ dài bằng nội dung thật trên nền tảng đích.

## Layout

Frame rộng tối đa 390 CSS px, cuộn dọc, lề nội dung 16 px, khoảng giữa các khối chính 20 px. Lưới danh mục 3 cột, gợi ý 2 cột, chip 4 cột. Gap đo được là 4 px ở switch, 6 px ở chip và 10 px ở hai lưới thẻ. Các kích thước phụ nằm trong `spacing.scale`. Header sticky ở trên và nav trắng đặc sticky ở dưới, có đệm safe area bằng CSS. Kiểm tra bản HTML tại 320, 375, 390 và 768 px. Ở 768 px, cột 390 px được đặt giữa màn hình. Bố cục tablet hoặc desktop riêng có trạng thái **UNKNOWN**.

## Components

Switch và chip đang chọn dùng cobalt, chữ trắng và bóng cobalt nhẹ. Thẻ nội dung có nền trắng, góc 14 px, viền nhẹ và bóng thấp. Thẻ nổi bật bo 18 px với minh họa ở trên, tiêu đề và nút tròn ở dưới. Hero bo 20 px, đặt tiêu đề trên vùng navy đặc dưới minh họa. Dùng SVG tuyến tính đầu tròn cho icon UI. Thanh nav có bốn mục theo thứ tự **Khám phá / Đi chơi / Dấu ấn / Tôi** và chọn **Khám phá** ở T01.

## Do’s and Don’ts

Dùng cặp màu đã đo trong bảng QA. Giữ nhãn “Minh họa tạm” ở cả hai hình vector của E2. Giữ chữ GoEase ngoài biểu tượng G. Dùng SVG master hoặc đúng SVG theo kích thước của bảng logo, giữ nguyên hình học và màu. Tránh dùng coral sáng làm chữ trên trắng và tránh dùng màu trong hình minh họa làm trạng thái UI. [Hướng dẫn thương hiệu](BRAND-GUIDELINES.md)

## Accessibility

Các cặp chữ/nền đã đo đạt WCAG 2.2 AA về tương phản. Ô tìm kiếm có focus bằng bàn phím nhưng bản xuất tắt outline và thiếu chỉ báo thay thế. Viền chip chưa chọn có tỷ lệ 1,19:1 so với nền trang. Trạng thái chọn chỉ được thể hiện bằng lớp CSS trong bản HTML. Xem kết quả theo từng tiêu chí và các mục cần chốt trước khi import. [Báo cáo bàn giao](HANDOFF-REPORT.md)

## Motion

CSS xuất ghi transition 200 ms ease cho switch. Hành vi đổi trạng thái, hỗ trợ reduced motion và quy tắc chuyển động cho phần còn lại có trạng thái **UNKNOWN**.
