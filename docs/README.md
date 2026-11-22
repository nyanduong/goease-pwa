# Nguồn sự thật của GoEase

| Phạm vi                                            | Nguồn                                                                                                      | Tình trạng trong checkout                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nghiệp vụ, phạm vi sản phẩm và tiêu chí nghiệm thu | [Commercial V1 PRD v0.4.1](GoEase-Commercial-V1-PRD-v0.4.1-approved.md)                                    | Bản đã duyệt, lưu nguyên văn. Xem decision log cho các mục còn mở hoặc ghi trạng thái mâu thuẫn.                                                              |
| Điều hướng và user flow                            | [UX Information Architecture v0.5](GoEase-UX-Information-Architecture-v0.5-approved.md)                    | Bản IA đã duyệt, lưu nguyên văn. Một số mục điều hướng, wireframe và quy trình vẫn cần xác nhận.                                                              |
| Visual design, màu, typography và logo             | [Brand & Design Foundation v1.0](../Figma/brand/DESIGN.md)                                                 | Có trong repository. Dùng E2 — River Night Weekend và bộ logo G dẫn đường đã được chủ dự án xác nhận. [Bằng chứng bàn giao](../Figma/brand/HANDOFF-REPORT.md) |
| Hành vi kỹ thuật hiện tại                          | [Mã API](../server/src/), [mã web](../client/src/), [contracts](../packages/contracts/), tests và cấu hình | Dùng để xác minh những gì hiện chạy. Phạm vi sản phẩm do tài liệu đã duyệt và quyết định của chủ dự án xác lập.                                               |

[Decision log](DECISIONS.md) dẫn các quyết định đã xác nhận về tài liệu nguồn và ghi riêng trạng thái mâu thuẫn. Chờ quyết định của chủ dự án trước khi triển khai phần phụ thuộc vào mục còn mở.

## Tài liệu thiết kế và đề xuất

Các concept khảo sát, prototype, màn minh họa và đề xuất chưa được duyệt dùng để thảo luận. Các vòng Stitch trong `Figma/stitch-exploration-round-2/` và `Figma/stitch-e2-brand-refinement/` lưu quá trình khám phá. Brand Foundation ghi nhận quyết định visual và các vai trò đã kiểm tra trên T01. Các điểm đánh dấu `UNKNOWN` trong handoff vẫn cần xác nhận. Hướng dẫn trong `client/qa/` phục vụ kiểm tra kỹ thuật với fixture.

## Phê duyệt thay đổi

1. Đối chiếu đề xuất với đúng nguồn có thẩm quyền. Xác định quy tắc, luồng hoặc thành phần visual bị ảnh hưởng.
2. Ghi nội dung và phạm vi. Xin xác nhận của chủ dự án trước khi triển khai thay đổi nghiệp vụ, UX hoặc nhận diện.
3. Ghi quyết định đã duyệt vào [DECISIONS.md](DECISIONS.md), kèm phiên bản, mục liên quan và nguồn phê duyệt. Cập nhật tài liệu nguồn, kiểm tra code, contracts, dữ liệu và test liên quan trong phạm vi được duyệt.
4. Khi thay phiên bản PRD hoặc UX Architecture, kiểm tra trạng thái phê duyệt rồi cập nhật liên kết ở đây và trong `AGENTS.md`. Giữ nguyên văn bản do chủ dự án cung cấp.

## Tài liệu đã hết hiệu lực

BR v0.2, baseline schema, registry thiết kế, các báo cáo nghiệm thu cũ, kế hoạch UI legacy và concept pack trước E2 đã được gỡ khỏi checkout. Bản chụp trước lần dọn ở commit `af95353` trong Git có thể dùng để phục hồi theo yêu cầu cụ thể của chủ dự án.

## Tài nguyên và vận hành

- Media hiện có được tra qua [manifest Cloudinary](../packages/media/assets-manifest.json). `media:verify` đọc manifest và đối chiếu CDN. Các ảnh bằng chứng cũ bị gỡ chưa có bản ghi trong manifest.
- `media:upload` quét ảnh trong Git index dưới `client/public/images/` hoặc `docs/`. Checkout sau cleanup không có đầu vào phù hợp và script báo `No tracked image sources`. Khi cần upload, dùng worktree riêng và đưa đúng các ảnh nguồn đã được duyệt vào index. Đối với ảnh lịch sử được yêu cầu riêng, lấy đúng bản gốc từ Git và giữ đường dẫn nếu cần đối chiếu checksum của manifest.
- Seed danh mục tỉnh đọc [dữ liệu trong mã nguồn](../server/src/features/trips/province-catalog.ts). Fixture của tests nằm trong code test và harness. QA mascot ghi báo cáo riêng vào `.local/mascot-assets-qa.json`. Tệp tạo bởi quy trình migration lấy đường dẫn tường minh từ người vận hành và được sinh từ database đích.
