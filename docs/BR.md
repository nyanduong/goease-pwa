# GoEase — BR v0.1

**Ngày:** 22/10/2026  
**Trạng thái:** Bản đề xuất để chốt phạm vi. Chỉ mục 1 là các quyết định chủ dự án đã xác nhận; các mục sau là nội dung làm việc, chưa phải bộ yêu cầu được duyệt toàn bộ.

## 1. Quyết định đã xác nhận

- Viết mới hoàn toàn trong repository goease-pwa.
- React + Vite + TypeScript + Tailwind cho web; Express + TypeScript cho API.
- MongoDB + Mongoose; phát triển local, chuyển Atlas sau khi hoàn thành bản local.
- Xây theo hướng web PWA; có khả năng tiếp tục phát triển cho EXE201 và bổ sung mobile.
- Mục tiêu bàn giao gần nhất là ngày 23/10/2026; giờ cụ thể và hình thức bàn giao còn mở.

## 2. Mục tiêu sản phẩm — đề xuất

Giúp người dùng biến thông tin chuyến đi và sở thích thành một lịch trình có thể hiểu, chỉnh sửa, lưu và sử dụng khi đi du lịch.

Giả thuyết người dùng đầu tiên: người đi du lịch tự túc tại Việt Nam, cá nhân hoặc nhóm nhỏ. Phân khúc chính thức, địa bàn khởi đầu và nội dung kinh doanh cần được chủ dự án xác nhận; không tự đặt giới hạn số tỉnh/thành, số ngày hoặc số lần tạo lịch.

Các tài liệu ChillGo do chủ dự án cung cấp được dùng làm tham khảo cho trải nghiệm và mô hình sản phẩm. Chúng không tự động xác định toàn bộ phạm vi bản bàn giao hoặc chứng minh một tính năng đã được triển khai.

## 3. Luồng cốt lõi — đề xuất cho bản đầu

1. Người dùng khám phá điểm đến hoặc bắt đầu tạo chuyến đi.
2. Nhập điểm đến, ngày đi/ngày về, số người, ngân sách và sở thích theo các trường được chốt.
3. Hệ thống lấy dữ liệu địa điểm từ nguồn được lựa chọn và tạo lịch trình theo thông tin đầu vào.
4. Người dùng xem từng ngày, địa điểm, ghi chú và chi phí ước tính.
5. Người dùng sửa thứ tự, thay/thêm/xóa hoạt động và cập nhật ghi chú.
6. Lưu chuyến đi; đóng hoặc tải lại ứng dụng; mở lại đúng bản đã lưu.
7. Dữ liệu áp dụng đúng chính sách sở hữu đã chốt cho khách/người đăng nhập; việc chia sẻ cần có quy tắc riêng.

**Trước khi triển khai lưu trip bền vững, phải giải quyết Q-02 về định danh và ownership.** Trong lúc quyết định này còn mở, task nền tảng chỉ kiểm chứng persistence bằng database kiểm tra riêng; không tự tạo hành vi lưu trip công khai hoặc không có chủ sở hữu.

Bước 3 có thể cần AI và nhà cung cấp dữ liệu bên ngoài. Nhà cung cấp, quyền sử dụng dữ liệu, các trường có nguồn kiểm chứng và hành vi khi không tìm được kết quả cần được xác định trước khi nghiệm thu tích hợp.

## 4. Quy tắc nghiệp vụ — đề xuất

| Mã | Quy tắc | Tiêu chí kiểm tra |
| --- | --- | --- |
| BR-01 | Đầu vào chuyến đi phải hợp lệ theo ngày, số người, ngân sách và điểm đến | Dữ liệu sai bị từ chối ở server với lỗi dễ hiểu; không chỉ kiểm tra trên giao diện |
| BR-02 | Việc tạo lịch phải sử dụng thông tin người dùng đã nhập | Request thực tế gửi đến planner chứa đúng ràng buộc; đầu ra được kiểm tra cấu trúc và tính nhất quán nghiệp vụ |
| BR-03 | Chi phí/gợi ý không có xác nhận đặt dịch vụ được thể hiện là ước tính | Không trình bày giá ước tính hoặc gợi ý AI thành giá đã xác nhận hay chỗ đã đặt |
| BR-04 | Bản đã lưu phải khôi phục được từ database | Sau reload/restart server, đọc lại qua API được nội dung đã lưu; không chỉ tồn tại trong state trình duyệt |
| BR-05 | Quyền đọc/sửa/xóa dữ liệu riêng do server thực thi | Tài khoản B không thể đọc/sửa/xóa trip riêng của A bằng cách đổi ID |
| BR-06 | Sửa itinerary không sửa lịch sử đơn hàng/thanh toán | Khi có commerce, order giữ snapshot giá và điều khoản tại thời điểm đặt |
| BR-07 | Lỗi nhà cung cấp không được báo thành công | Giữ đầu vào để thử lại; phân biệt dữ liệu mẫu, dữ liệu được tuyển chọn và kết quả gọi dịch vụ thật |
| BR-08 | Một thao tác lưu không được âm thầm ghi đè thay đổi mới hơn | Khi có nguy cơ cập nhật đồng thời, kiểm tra version và báo xung đột phù hợp |
| BR-09 | Quyền admin được kiểm tra tại API nếu có chức năng quản trị | Ẩn nút trên UI không được coi là kiểm soát quyền |
| BR-10 | Phạm vi offline được mô tả cụ thể | Bản đầu đề xuất có màn hình offline rõ ràng; tạo lịch AI/tìm dữ liệu online không được hứa hoạt động khi mất mạng |

Các giới hạn ngày/ngân sách/quota, cơ chế chia sẻ, hành vi lưu nháp và đăng nhập chưa được cố định bởi bảng này.

## 5. Nhóm chức năng và thứ tự đề xuất

| Nhóm | Mục đích | Quyết định phạm vi |
| --- | --- | --- |
| Khám phá + thông tin chuyến đi | Điểm bắt đầu dễ sử dụng | Đề xuất ưu tiên bản đầu |
| Lịch trình theo ngày + sửa/lưu/mở lại | Giá trị cốt lõi có thể kiểm chứng | Đề xuất ưu tiên bản đầu |
| Đăng nhập + chuyến đi của tôi | Sở hữu dữ liệu và dùng lại trên nhiều thiết bị | Cần chốt phương thức đăng nhập và quyền khách |
| Tích hợp AI/nguồn địa điểm | Cá nhân hóa dựa trên dữ liệu | Cần chốt nhà cung cấp và yêu cầu gọi thật cho ngày bàn giao |
| Quản trị nội dung | Quản lý nội dung do GoEase sở hữu | Xác định theo nguồn nội dung; chưa mặc định cần một CMS đầy đủ |
| Hướng dẫn viên/trải nghiệm | Kết nối dịch vụ địa phương | Cần phân biệt xem thông tin, gửi yêu cầu, booking và thanh toán |
| Khách sạn/vé máy bay | Phục vụ hành trình và mô hình doanh thu | Cần phân biệt link đối tác với đặt dịch vụ trực tiếp |
| Gói trả phí/thanh toán/hoa hồng | Hướng thương mại hóa | Chưa chốt hàng hóa/dịch vụ được bán và phạm vi xử lý tiền |
| Mobile native | Trải nghiệm riêng trên Android/iOS | Hướng phát triển sau; chưa thuộc task nền tảng ban đầu |

Đặt một mục ở giai đoạn sau là đề xuất phân kỳ, không loại bỏ mục đó khỏi sản phẩm.

## 6. Thực thể dự kiến

- **User:** định danh nội bộ ổn định; có thể liên kết phương thức đăng nhập được chọn.
- **Trip:** chủ sở hữu, đầu vào, danh sách ngày/hoạt động, version và thời điểm cập nhật.
- **Place reference/snapshot:** định danh nguồn và dữ liệu cần giữ trong trip; không làm mất bản đã lưu khi dữ liệu nguồn thay đổi. Chỉ lưu dữ liệu được phép theo điều khoản nguồn.
- **Order, Payment, Entitlement:** chỉ chi tiết hóa khi BR doanh thu được chốt. Phân biệt yêu cầu thanh toán với thanh toán đã được xác minh.
- **Service inquiry/Booking:** chỉ tạo khi đã xác định gửi yêu cầu hay xác nhận đặt dịch vụ, trạng thái và bên chịu trách nhiệm.

Đây là mô hình khái niệm. Chưa tạo collection hoặc endpoint cho các domain chưa xác định.

## 7. Nghiệm thu bản đầu — dự thảo

- Một người mới thực hiện được luồng được chốt trên giao diện điện thoại.
- Lưu rồi mở lại đọc từ MongoDB, giữ đúng nội dung.
- Các thao tác với dữ liệu riêng có kiểm tra ownership tại server.
- Đầu vào không hợp lệ và nhà cung cấp lỗi có thông báo và đường tiếp tục.
- Có một kịch bản demo được lặp lại; ghi rõ bước nào dùng dữ liệu mẫu và bước nào đã gọi dịch vụ thật.
- Build/typecheck/lint đạt; kiểm thử tập trung vào hành vi có rủi ro, không dùng số lượng test làm tiêu chí thay cho kết quả.
- Nếu bàn giao link công khai: kiểm tra trực tiếp bản triển khai, kết nối database, biến môi trường, HTTPS và quá trình mở ứng dụng trên điện thoại.
- Nếu bàn giao PWA: kiểm tra manifest, icon, chế độ mở, hành vi offline và cập nhật trên trình duyệt/thiết bị mục tiêu; không suy ra thành công chỉ từ cấu hình.

## 8. Những quyết định cần chốt tiếp

| Mã | Câu hỏi | Gợi ý để quyết định nhanh |
| --- | --- | --- |
| Q-01 | Ngày mai bàn giao lúc mấy giờ, demo local hay cần link công khai? | Ghi mốc giờ theo Việt Nam và dành một khoảng riêng cho kiểm tra bản bàn giao |
| Q-02 | Khách chưa đăng nhập được làm đến đâu; đăng nhập bằng gì? | Đề xuất xem khám phá công khai, đăng nhập để lưu vào tài khoản; quyền gọi AI và phương thức login cần chốt |
| Q-03 | Bản đầu phải tạo lịch bằng AI thật và lấy dữ liệu từ nguồn nào? | Chốt một nhà cung cấp cho mỗi nhu cầu và kịch bản khi thiếu dữ liệu; không mở thêm nhiều tích hợp cùng lúc |
| Q-04 | Có bắt buộc giao dịch tiền/booking thật trong ngày bàn giao không? | Nêu cụ thể bán gói planner, gửi yêu cầu dịch vụ, chuyển link đối tác hay booking/thu tiền trực tiếp |
| Q-05 | Luồng ở mục 3 đã đúng ưu tiên chưa; còn màn hình/nghiệp vụ nào bắt buộc? | Điều chỉnh luồng và tiêu chí nghiệm thu trước khi mở rộng chức năng |

## 9. Cách cập nhật BR

Khi chủ dự án chốt một điểm, chuyển nó sang trạng thái đã xác nhận và bổ sung tiêu chí kiểm tra. Lưu quyết định trong cùng tài liệu thay vì để yêu cầu chỉ tồn tại trong các prompt rời rạc. Không đánh dấu toàn bộ BR là được duyệt chỉ vì stack đã được duyệt.

## Tài liệu tham khảo sản phẩm

- https://canva.link/vq7dcojad4x9fby
- https://canva.link/0nf2jh8ukc9fi23
- https://canva.link/5kpkekj5ywd8b7n
