# Nguồn sự thật của GoEase

| Phạm vi                                            | Nguồn                                                                                                      | Tình trạng trong checkout                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nghiệp vụ, phạm vi sản phẩm và tiêu chí nghiệm thu | [Commercial V1 PRD v0.4.1](GoEase-Commercial-V1-PRD-v0.4.1-approved.md)                                    | Bản đã duyệt, lưu nguyên văn. Xem decision log cho các mục còn mở hoặc ghi trạng thái mâu thuẫn.                                                              |
| Điều hướng và user flow                            | [UX Information Architecture v0.5](GoEase-UX-Information-Architecture-v0.5-approved.md)                    | Bản IA đã duyệt, lưu nguyên văn. Một số mục điều hướng, wireframe và quy trình vẫn cần xác nhận.                                                              |
| Visual design, màu, typography và logo             | [Brand & Design Foundation v1.0](../Figma/brand/DESIGN.md)                                                 | Có trong repository. Dùng E2 — River Night Weekend và bộ logo G dẫn đường đã được chủ dự án xác nhận. [Bằng chứng bàn giao](../Figma/brand/HANDOFF-REPORT.md) |
| Hành vi kỹ thuật hiện tại                          | [Mã API](../server/src/), [mã web](../client/src/), [contracts](../packages/contracts/), tests và cấu hình | Dùng để xác minh những gì hiện chạy. Phạm vi sản phẩm do tài liệu đã duyệt và quyết định của chủ dự án xác lập.                                               |

[Decision log](DECISIONS.md) dẫn các quyết định đã xác nhận về tài liệu nguồn và ghi riêng trạng thái mâu thuẫn. Chờ quyết định của chủ dự án trước khi triển khai phần phụ thuộc vào mục còn mở.

[Traveler Foundation M0](frontend-foundation.md) mô tả baseline đang chạy, domain map và quy trình kiểm tra local.

## Tài liệu thiết kế và đề xuất

Các concept khảo sát, prototype, màn minh họa và đề xuất chưa được duyệt dùng để thảo luận. Các vòng Stitch trong `Figma/stitch-exploration-round-2/` và `Figma/stitch-e2-brand-refinement/` lưu quá trình khám phá. Brand Foundation ghi nhận quyết định visual và các vai trò đã kiểm tra trên T01. Các điểm đánh dấu `UNKNOWN` trong handoff vẫn cần xác nhận.

## Phê duyệt thay đổi

1. Đối chiếu đề xuất với đúng nguồn có thẩm quyền. Xác định quy tắc, luồng hoặc thành phần visual bị ảnh hưởng.
2. Ghi nội dung và phạm vi. Xin xác nhận của chủ dự án trước khi triển khai thay đổi nghiệp vụ, UX hoặc nhận diện.
3. Ghi quyết định đã duyệt vào [DECISIONS.md](DECISIONS.md), kèm phiên bản, mục liên quan và nguồn phê duyệt. Cập nhật tài liệu nguồn, kiểm tra code, contracts, dữ liệu và test liên quan trong phạm vi được duyệt.
4. Khi thay phiên bản PRD hoặc UX Architecture, kiểm tra trạng thái phê duyệt rồi cập nhật liên kết ở đây và trong `AGENTS.md`. Giữ nguyên văn bản do chủ dự án cung cấp.

## Tài liệu đã hết hiệu lực

BR v0.2, baseline schema, registry thiết kế, các báo cáo nghiệm thu cũ, kế hoạch UI legacy và concept pack trước E2 đã được gỡ khỏi checkout. Bản chụp trước lần dọn ở commit `af95353` trong Git có thể dùng để phục hồi theo yêu cầu cụ thể của chủ dự án.

## Truy xuất mã trước Clean Rebuild

Checkpoint `1f33cfcc01d12c87883b5df3d87df79737b919c3` lưu source, tests, scripts và manifest media trước Task 02. Ví dụ, đọc manifest cũ bằng `git show 1f33cfc:packages/media/assets-manifest.json`. Xem [README gốc](../README.md#chạy-local) để chạy baseline hiện tại.
