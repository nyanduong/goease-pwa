# Nguồn sự thật của GoEase

| Phạm vi                                | Nguồn                                                                                                      | Tình trạng trong checkout                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nghiệp vụ và phạm vi sản phẩm          | Commercial V1 PRD v0.4.1                                                                                   | Đã duyệt theo chủ dự án. Chưa tìm thấy bản chính thức trong workspace.                                                                                        |
| Điều hướng và user flow                | UX Information Architecture v0.5                                                                           | Đã duyệt theo chủ dự án. Chưa tìm thấy bản chính thức trong workspace.                                                                                        |
| Visual design, màu, typography và logo | [Brand & Design Foundation v1.0](../Figma/brand/DESIGN.md)                                                 | Có trong repository. Dùng E2 — River Night Weekend và bộ logo G dẫn đường đã được chủ dự án xác nhận. [Bằng chứng bàn giao](../Figma/brand/HANDOFF-REPORT.md) |
| Hành vi kỹ thuật hiện tại              | [Mã API](../server/src/), [mã web](../client/src/), [contracts](../packages/contracts/), tests và cấu hình | Dùng để xác minh những gì hiện chạy. Phạm vi sản phẩm do tài liệu đã duyệt và quyết định của chủ dự án xác lập.                                               |

[Decision log](DECISIONS.md) ghi các quyết định đã xác nhận và nguồn xác nhận. Với phần cần nội dung PRD hoặc UX Architecture đang thiếu, dùng bản chính thức do chủ dự án cung cấp trước khi quyết định.

## Tài liệu thiết kế và đề xuất

Các concept khảo sát, prototype, màn minh họa và đề xuất chưa được duyệt dùng để thảo luận. Các vòng Stitch trong `Figma/stitch-exploration-round-2/` và `Figma/stitch-e2-brand-refinement/` lưu quá trình khám phá. Brand Foundation ghi nhận quyết định visual và các vai trò đã kiểm tra trên T01. Các điểm đánh dấu `UNKNOWN` trong handoff vẫn cần xác nhận. Hướng dẫn trong `client/qa/` phục vụ kiểm tra kỹ thuật với fixture.

## Phê duyệt thay đổi

1. Đối chiếu đề xuất với đúng nguồn có thẩm quyền. Xác định quy tắc, luồng hoặc thành phần visual bị ảnh hưởng.
2. Ghi nội dung và phạm vi. Xin xác nhận của chủ dự án trước khi triển khai thay đổi nghiệp vụ, UX hoặc nhận diện.
3. Ghi quyết định đã duyệt vào [DECISIONS.md](DECISIONS.md), kèm phiên bản, mục liên quan và nguồn phê duyệt. Cập nhật tài liệu nguồn, kiểm tra code, contracts, dữ liệu và test liên quan trong phạm vi được duyệt.
4. Khi có bản PRD hoặc UX Architecture chính thức, kiểm tra phiên bản và trạng thái phê duyệt trước khi thêm vào `docs/`. Giữ nguyên nội dung bản đã duyệt và cập nhật bảng nguồn ở trên.

## Tài liệu đã hết hiệu lực

BR v0.2, baseline schema, registry thiết kế, các báo cáo nghiệm thu cũ, kế hoạch UI legacy và concept pack trước E2 đã được gỡ khỏi checkout. Bản chụp trước lần dọn ở commit `af95353` trong Git có thể dùng để phục hồi theo yêu cầu cụ thể của chủ dự án.
