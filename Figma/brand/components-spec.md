# GoEase · Đặc tả component E2

Dùng [ảnh E2](assets/screenshots/e2-brand-refinement.png) để so bố cục và `code.html` trong [ZIP gốc](assets/exports/e2-brand-refinement.zip) để tra kích thước, alpha và CSS cascade. Kích thước dưới đây là CSS px. `normal` giữ theo CSS nguồn. Các mục trong cột “Cần xác nhận” mô tả phần còn thiếu bằng chứng.

| Component | Đặc tả quan sát được | Cần xác nhận |
| --- | --- | --- |
| Header | Trắng, sticky top, đường chia 1 px, đệm 12 × 16. Ô ký hiệu trong mẫu 36 × 36, bo 10. Khoảng icon/chữ 10. Wordmark 20 px/800. Nút Cần Thơ cao 40, rộng tối thiểu 106, đệm ngang 12, viền `color.border.control`, chấm cobalt 7 px, nhãn 13/700. | Cách đặt G dẫn đường đã duyệt trong header và khoảng trống bảo vệ. Bản nguồn vẫn hiển thị G thử nghiệm. |
| Context switch | Nền ngoài trắng, đệm trên/ngang/dưới 10/16/14. Track `color.surface.switchTrack`, bo 12, đệm và gap 4. Hai ô đều, cao 40, bo 9, chữ 13/700. **Gần mình** cobalt/trắng, bóng `shadow.switchSelected`. **Khám phá điểm đến** slate trên track. | Hành vi và tên/trạng thái cho công nghệ hỗ trợ. |
| Hero | Nền `color.surface.hero`, bo 20, viền navy 1. SVG media cao 125. Nhãn tạm cách mép trên/trái 10, bo 6 và đệm 3 × 8. Dòng tiêu đề 24/30, 800, trắng. Đệm vùng tiêu đề trên/ngang/dưới 14/16/18. | Quy cách ảnh chụp đích và quyền sử dụng. |
| Tìm kiếm | Ô trắng toàn chiều ngang phần nội dung, cao 44, bo 12, viền 1 px, bóng `shadow.search`. Icon 18, cách mép trái 14, đệm chữ trái/phải 42/14. Chữ 13/500, placeholder `color.text.placeholder` với opacity 1. | Chỉ báo focus, tên truy cập và hành vi nhập liệu. HTML xuất để readonly. |
| Chip lọc | Lưới 4 cột, gap 6. Chip cao 44, bo 999, đệm ngang 4, chữ 12/700. **Cuối tuần** cobalt/trắng với bóng `shadow.chipSelected`. Các chip còn lại trắng, chữ ink, viền mảnh và bóng `shadow.chip`. | Ranh giới chip chưa chọn và markup trạng thái chọn. |
| Tiêu đề khu và link | Tiêu đề 18 px/800, tracking −0,2 px, lề dưới 12. “Xem thêm” 13 px/700, cobalt, mũi tên 14, gap 2. | Vùng kích hoạt link khi triển khai, chiều cao đo được 17 px. |
| Thẻ danh mục | 3 cột, gap 10. Thẻ trắng bo 14, viền 1 px, đệm 14 × 8, bóng `shadow.card`. Icon tile 40 × 40, bo 10, khoảng cách dưới 8. Nhãn 13/15,6 px, 700. Cà phê dùng tông ấm, các ô còn lại tông cobalt. | Tương tác, focus, nhãn/ngữ nghĩa cho thẻ khi có hành động. |
| Thẻ nổi bật | Trắng, bo 18, viền 1 px, bóng `shadow.featured`. Media 148, nhãn tạm cách mép trên/phải 10. Hàng thông tin đệm 14 × 16, gap 12. Tên 17/20,4 px, 800. Mô tả 12 px/500. Nút mũi tên tròn 40 × 40, trắng trên cobalt, bóng `shadow.featuredAction`. | Ảnh sản xuất và các trạng thái interaction. |
| Thẻ gợi ý | 2 cột, gap 10. Thẻ trắng bo 14, viền 1 px, đệm 14, bóng `shadow.card`. Icon 18 trong tile 36 × 36, bo 10, cách dưới 10. Tên 13/16,9 px, 700. Chữ phụ 12 px/500. | Hành vi và các trạng thái với copy ngoài mẫu T01. |
| Thẻ Dấu ấn | Trắng, bo 14, đệm 14 × 16, gap 12. Icon bookmark trắng trên khối cobalt 38 × 38, bo 10. Tiêu đề 13 px/800, chữ phụ 12 px/500. Bộ đếm pill `0 mục` dùng 12 px/700 trên nền cobalt nhạt. | `0 mục` là dữ liệu mẫu. Quy tắc đếm lấy từ tài liệu sản phẩm đã duyệt. |
| Thanh điều hướng | Nền trắng đặc, đường chia 1 px, sticky ở đáy, 4 cột đều. Đệm trên 8, ngang 6, dưới `calc(8px + env(safe-area-inset-bottom, 12px))`. Mỗi mục cao tối thiểu 56, icon 22, gap 4. Nhãn 12/12 px. **Khám phá** cobalt/700, các mục khác slate/600. | Safe area trên thiết bị thật, trạng thái truy cập và cách chọn mục trong runtime. |

## Token và cách dùng trong công cụ

- `tokens.json` dùng tên theo vai trò và tham chiếu DTCG. Ví dụ `color.text.placeholder` trỏ tới `color.palette.slate`. Các giá trị kích thước dùng px, còn line-height lưu theo hệ số nhân khi CSS định nghĩa rõ.
- Với React/Tailwind, phân giải alias trước khi ánh xạ role sang CSS custom properties. Dùng `hex` cho màu đặc và giữ `alpha` khi chuyển sang màu trong suốt. Độ đậm font giữ đúng giá trị khai báo. CSS gốc mặc định `normal` ở vai trò thiếu line-height hoặc letter spacing.
- Với Figma Plugin, ánh xạ `color.surface.page` thành tên biến ổn định như `color/surface/page`, giữ sRGB 0–1 và alpha. Dùng giá trị px làm biến số, còn typography và shadow được dựng từ token thành phần theo khả năng của công cụ. Giữ CSS font stack trong tài liệu và xác nhận font cụ thể trước khi tạo text styles.
- Với Antigravity và Codex, trỏ tới [DESIGN.md](DESIGN.md) và [tokens.json](tokens.json), dùng các giá trị đo và các quyết định `UNKNOWN` trong [HANDOFF-REPORT.md](HANDOFF-REPORT.md).

Elevation của E2 gồm bóng thấp quanh thẻ, bóng cobalt cho trạng thái chọn và nút, cùng bóng khung xem trước. Giá trị theo từng vai trò có trong `shadow`. UI state hover, pressed, disabled, focus hoàn chỉnh và bố cục desktop chuyên biệt có trạng thái **UNKNOWN**.
