# GoEase Design Builder · PoC 01

Development plugin cho Figma Design, dùng ID gốc `1706170232699767707`. `manifest.json` nạp `code.js` được biên dịch từ `code.ts` và giao diện `ui.html`.

## Chạy trong Figma Desktop

Bản build `code.js` có sẵn. Để build lại, dùng Node.js 24 và chạy các lệnh sau trong PowerShell từ root repo. Plugin dùng npm riêng trong thư mục template và giữ lockfile của workspace GoEase ở root.

```powershell
Set-Location -LiteralPath 'Figma/GoEase Design Builder'
npm install --no-package-lock --workspaces=false
npm run typecheck
npm run lint
npm run build
```

1. Mở [GoEase — UX Architecture & Wireframes v0.5](https://www.figma.com/design/xH1bTlxhgzyaCMT4AH6dvV) trong Figma Desktop bằng tài khoản có quyền sửa file.
2. Mở **Figma menu → Plugins → Development → GoEase Design Builder**. Nếu plugin chưa xuất hiện trên máy, chọn **Development → Import plugin from manifest…** rồi trỏ đến `Figma/GoEase Design Builder/manifest.json`.
3. Bấm **Generate T01 Home v2**. Plugin tìm hoặc tạo page `98 - GoEase Plugin Sandbox`, rồi chọn frame `POC - GoEase T01 Home v2`. Lần bấm tiếp theo sẽ chọn lại frame đang có trong sandbox. Việc đổi tên frame vẫn được nhận diện qua dấu nhận dạng do plugin lưu trên node.
4. Mở **Layers** và **Design** để xem hierarchy, kích thước và Auto Layout. Sửa chữ trực tiếp trên Text layer. Với bộ lọc, chọn instance rồi sửa thuộc tính **Nhãn** ở panel **Design**. Component gốc nằm cạnh màn hình trong section `POC - Components`.

[Hướng dẫn Development plugin của Figma](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/)

## Nghiệm thu ngày 22/11/2026

| Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- |
| Template, ID và entrypoints gốc | PASS | Chạy plugin đã đăng ký từ menu Development. Giữ nguyên ID, `main` và `ui`. |
| Typecheck, lint, build | PASS | `npm run typecheck`, `npm run lint` và `npm run build` đã chạy thành công. |
| UI và tiến độ | PASS | Đã thấy tiêu đề, nút Generate và trạng thái đang xử lý trong Figma Desktop. |
| Thông báo lỗi và thử lại | PASS | Lần đầu Figma báo lỗi cú pháp vector. Plugin hiện lỗi và dọn frame/component tạo dở. Sau khi sửa và build lại, Generate thành công trên cùng sandbox. |
| Tạo hoặc sử dụng lại sandbox | PASS | Lượt đầu tạo page `98 - GoEase Plugin Sandbox`. Lượt tiếp theo tạo frame trên page đó. |
| Tên và kích thước frame | PASS | Figma hiển thị `POC - GoEase T01 Home v2` với **W 390 / H 844**. |
| Bố cục mobile và các khu vực yêu cầu | PASS | Đã thấy header, vị trí Cần Thơ, hai lựa chọn ngữ cảnh, hero, search, bộ lọc, 6 danh mục, thẻ nổi bật, 2 gợi ý và 4 tab điều hướng. |
| Layer native, hierarchy và Auto Layout | PASS | Panel Design hiển thị Auto Layout trên frame chính. Layers hiển thị các nhóm con, Text, các shape vector và các instance Quick filter. |
| Text chỉnh sửa được | PASS | Đã vào chế độ chỉnh sửa chữ `GoEase` trực tiếp trên canvas và xác nhận instance bộ lọc có trường **Nhãn** chỉnh sửa được. |
| Chạy lại trên frame đã có | PASS | Lượt bấm lại báo frame đã tồn tại và chọn cùng node `20:104`. Sandbox có một frame T01. |
| Bảo toàn các thiết kế có sẵn | PASS | Đối chiếu tên layer, ID quan sát được và bố cục trên trang `01A · T01 Mobile UX Review` trước và sau. Mã giới hạn các thao tác ghi trong sandbox. |
| API và tài nguyên bên ngoài | PASS | Manifest giới hạn `allowedDomains` thành `["none"]`. Giao diện, vector và mã chạy đều nằm trong plugin. |
| Screenshot thật | PASS | [Ảnh chụp Figma Desktop](./T01-Home-v2-Figma.jpg) hiển thị frame, hierarchy và kích thước. |

[Mở frame đã nghiệm thu trong Figma](https://www.figma.com/design/xH1bTlxhgzyaCMT4AH6dvV?node-id=20-104)

## Giới hạn trước bản đầy đủ

- PoC dựng một wireframe tĩnh ở trạng thái **Gần mình** tại Cần Thơ. Nội dung trải nghiệm dùng để minh họa. Trạng thái **Khám phá điểm đến**, chuyển ngữ cảnh, chọn vị trí, tìm kiếm và điều hướng tương tác cần thiết kế prototype riêng.
- Bố cục được kiểm tra ở 390 × 844 với nội dung hiện tại. Bản đầy đủ cần kiểm tra copy dài, kích thước khác và ánh xạ sang design system GoEase.
- PoC giữ frame hiện có khi chạy lại. Nếu phát triển tính năng cập nhật từ mã, cần xác định thao tác xác nhận và cách giữ các chỉnh sửa thủ công.
