# GoEase · Decision log

## Quyết định đã xác nhận

| Quyết định                                                                                                                                                                        | Nguồn xác nhận                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Commercial V1 PRD v0.4.1 là nguồn nghiệp vụ. UX IA v0.5 là nguồn điều hướng và user flow. v0.4.1 đồng bộ tên hiển thị của gamification.                                           | Chủ dự án cung cấp hai bản đã duyệt. [PRD §0][prd], [IA §0][ia]. Xem mục mâu thuẫn bên dưới về trạng thái từng phần. |
| **DEC-01, DEC-02.** Cần Thơ là thị trường đầu tiên, ưu tiên người địa phương tìm trải nghiệm cuối tuần. Khách từ xa dùng chung nền tảng. Mở rộng vùng theo chất lượng nguồn cung. | [PRD §0.1][prd], [IA §0][ia]                                                                                         |
| **DEC-03.** Phạm vi UX/UI cho phép thay toàn bộ giao diện. Việc thay backend hoặc database cần quyết định riêng.                                                                  | [PRD §0.1][prd], [IA §0][ia]                                                                                         |
| **DEC-04.** Mục tiêu là khả năng tạo doanh thu và lợi nhuận thực tế. Cơ chế thu phí vẫn thuộc các quyết định mở.                                                                  | [PRD §0.1][prd]                                                                                                      |
| **DEC-06, Q09 (tên).** Tên hiển thị là **Dấu ấn**. V1 không có ví điểm quy đổi tiền.                                                                                              | [PRD §0.1 và §13][prd], [IA §0][ia]                                                                                  |
| **Q09 (visual).** Concept đã chọn là **E2 — River Night Weekend**. Logo là **G dẫn đường**, bản tinh chỉnh mới nhất.                                                              | Chủ dự án xác nhận trong Brand Freeze. [Báo cáo bàn giao](../Figma/brand/HANDOFF-REPORT.md)                          |
| Chiến lược ra mắt yêu cầu hoàn thành các luồng Commercial V1 đã chọn và closed beta/UAT trước public marketing diện rộng.                                                         | [PRD §0][prd]                                                                                                        |

## Trạng thái cần chủ dự án đối chiếu

| Mục                                           | Bằng chứng                                                                                                                                                                                                   | Cần xác nhận                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phạm vi Commercial V1, **DEC-09**             | [PRD][prd] ghi `APPROVED SCOPE` và có approval record, nhưng §0.1 vẫn ghi `PENDING` đối với phê duyệt toàn bộ danh mục chức năng.                                                                            | Xác nhận phạm vi chính xác áp dụng cho DEC-09 và đồng bộ trạng thái ở phiên bản kế tiếp.                                                                                       |
| Điều hướng Traveler và cấu trúc Partner/Admin | [IA][ia] được duyệt cấp tài liệu. IA §0 ghi bốn tab và việc tách Portal/Admin là `PROPOSED`. IA §2.1 ghi điều hướng bốn mục như quy tắc. PRD §4.1 vẫn ghi `PROPOSED`.                                        | Chốt trạng thái của các mục này. Tên **Dấu ấn** đã duyệt độc lập. Ảnh E2 ghi nhận bố cục visual của T01.                                                                       |
| Ghi chú phê duyệt và phạm vi visual của IA    | Đầu [IA][ia] ghi `IA APPROVED`, trong khi cuối tệp vẫn ghi `Owner review required`. Đầu IA cũng ghi wireframe và visual đang chờ. PRD Q09 còn nhắc hướng “Contemporary Mekong Weekend” và việc chọn concept. | Đồng bộ ghi chú phê duyệt trong lần cập nhật chính thức. Brand Freeze đã xác nhận E2 và logo G. Trạng thái wireframe và visual của các màn còn lại vẫn cần chủ dự án xác nhận. |

## Câu hỏi nghiệp vụ còn mở

[PRD §13][prd] giữ nguyên các câu hỏi sau. Ghi câu trả lời và nguồn phê duyệt vào log khi có quyết định.

| ID      | Nội dung đang mở                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| Q01–Q02 | Loại đối tác pilot, khu vực Cần Thơ, nguồn dữ liệu và người xác minh địa điểm.                                |
| Q03–Q04 | Sự kiện hoặc mô hình thu phí, tài trợ voucher, tổn thất gian lận và hạn mức.                                  |
| Q05–Q06 | Cơ chế xác minh tại đối tác và phạm vi chi nhánh và staff.                                                    |
| Q07–Q08 | Có xác nhận đặt suất trước hay chỉ dùng voucher, cùng chủ thể xử lý dispute/reversal, SLA hỗ trợ và đối soát. |
| Q10–Q12 | Pháp lý và thuế, người có quyền chốt scope/nghiệm thu và ngưỡng chất lượng, hiệu năng và ngân sách vận hành.  |

[PRD §0.1][prd] vẫn ghi **DEC-05 và DEC-07** là `PROPOSED`, **DEC-08** là `PENDING`. Các nhãn đó giữ nguyên cho đến khi có quyết định riêng.

[prd]: GoEase-Commercial-V1-PRD-v0.4.1-approved.md
[ia]: GoEase-UX-Information-Architecture-v0.5-approved.md
