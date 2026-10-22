# GoEase — kiến trúc nền v0.1

**Trạng thái:** Stack đã chốt; nền tảng F0 đã được triển khai ngày 22/10/2026. Xem README và docs/F0-VERIFICATION.md để biết cách chạy và bằng chứng kiểm tra. Các đề xuất nghiệp vụ ngoài F0 vẫn chưa mặc nhiên được duyệt.

## 1. Ranh giới hệ thống

Một web React gọi một Express API. Express thực thi nghiệp vụ, xác thực/phân quyền, truy cập MongoDB và kết nối nhà cung cấp bên ngoài. Mobile tương lai gọi cùng API.

Backend ban đầu là một ứng dụng có các module theo nghiệp vụ. Chỉ thêm dịch vụ triển khai độc lập khi có nhu cầu vận hành cụ thể.

| Phần             | Trách nhiệm                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Web PWA          | Màn hình, nhập liệu, hiển thị, trạng thái tương tác và gọi API                   |
| Express API      | Kiểm tra dữ liệu, quyền, nghiệp vụ, orchestration nhà cung cấp và persistence    |
| MongoDB/Mongoose | Schema, index, dữ liệu lưu trữ và các thao tác atomic/transaction phù hợp        |
| Contracts        | Kiểu request/response và validation dùng chung, độc lập với nền tảng             |
| Nhà cung cấp     | Dữ liệu địa điểm, AI hoặc thanh toán theo phạm vi được chốt                      |
| Mobile tương lai | UI/navigation/lưu trữ thiết bị riêng; dùng chung API và phần logic thuần phù hợp |

## 2. Cấu trúc đề xuất

Giữ các tên đơn giản đã trao đổi. Dùng npm workspace với một package-lock.json ở root theo yêu cầu mới nhất của chủ dự án. Chạy development bằng npm run dev, web/API sử dụng localhost.

| Đường dẫn dự kiến   | Nội dung                                                        |
| ------------------- | --------------------------------------------------------------- |
| client/             | React + Vite + TypeScript + Tailwind                            |
| server/             | Express + TypeScript + Mongoose                                 |
| packages/contracts/ | Request/response types và runtime schema thực sự cần dùng chung |
| docs/               | BR và kiến trúc                                                 |
| AGENTS.md           | Quy ước làm việc cho coding agent                               |

Chưa tạo thư mục mobile hoặc package UI đa nền tảng. Trong server, thêm module như trips, planner, auth khi triển khai tính năng tương ứng; mỗi module có route/controller, service và model khi cần. Không tạo hàng loạt thư mục rỗng cho tính năng chưa được xác định.

## 3. API và domain

- Đề xuất prefix /api/v1; request/response có kiểu dữ liệu và lỗi nhất quán.
- Chuẩn hóa ID dạng chuỗi; thời điểm hệ thống dùng ISO 8601; ngày du lịch cần mô hình ngày và múi giờ rõ để tránh lệch ngày.
- Validation lúc chạy là bắt buộc ở ranh giới API. TypeScript không thay thế việc kiểm tra dữ liệu nhận từ mạng.
- Services thực hiện quy tắc nghiệp vụ; controllers xử lý HTTP. Mongoose model ở server và được ánh xạ sang DTO trước khi trả về client.
- Danh sách có phân trang theo nhu cầu; tạo index theo truy vấn thật. Không đoán năng lực chịu tải chỉ từ lựa chọn framework.
- Thiết kế cách đọc/cập nhật trip có ownership và version khi tính năng đó bắt đầu. API không lấy client-supplied ownerId làm bằng chứng quyền truy cập.
- Tài liệu API có thể bắt đầu bằng mô tả request/response cạnh tính năng; bổ sung OpenAPI theo endpoint thật, tránh bộ spec lớn nhưng không khớp implementation.

## 4. MongoDB local trước, Atlas sau

Kết nối được cấu hình bằng MONGODB_URI tại server. Có hướng dẫn khởi tạo, kiểm tra kết nối và dừng dịch vụ rõ ràng.

Khuyến nghị cấu hình local replica set khi chuẩn bị kiểm thử transaction nhiều document. Replica set một thành viên dùng cho phát triển không cung cấp dự phòng như một triển khai production. Cấu hình URI có tên replica set không tự khởi tạo replica set.

Chọn Docker Compose nếu máy phát triển có Docker hoạt động; có thể dùng cài đặt MongoDB local trực tiếp. Phải kiểm tra hệ điều hành/môi trường trước khi viết lệnh setup. Nếu cần truy cập database từ điện thoại, điện thoại chỉ gọi API; không mở MongoDB trực tiếp cho frontend.

Trip có thể nhúng days/activities khi chúng thường được đọc và cập nhật cùng nhau, với giới hạn kích thước phù hợp. Dữ liệu tăng không giới hạn hoặc có vòng đời độc lập cần tách theo access pattern.

Khi chuyển Atlas:

1. Hoàn thành và xác minh bản local.
2. Tạo database user, cấu hình truy cập và secret tại nơi triển khai.
3. Chọn dừng ghi trong cửa sổ chuyển dữ liệu cho bản nhỏ; backup và import dữ liệu nếu cần giữ.
4. Đổi URI, kiểm tra dữ liệu/index và chạy lại luồng bàn giao.
5. Lưu hướng dẫn khôi phục; không coi đổi URI là đã chuyển dữ liệu.

Nguồn: [MongoDB data modeling](https://www.mongodb.com/docs/manual/data-modeling/best-practices/), [transactions](https://www.mongodb.com/docs/manual/core/transactions/), [local replica-set conversion](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/), [migration to Atlas](https://www.mongodb.com/docs/atlas/import/mongorestore/).

## 5. Chuẩn bị cho mobile

Có thể dùng lại API, dữ liệu tài khoản, contracts, các hàm TypeScript thuần và API client được viết độc lập với trình duyệt. React Native/Expo là hướng có thể đánh giá khi bắt đầu ứng dụng mobile.

Màn hình React DOM + Tailwind không tự chuyển thành UI native. Navigation, storage, OAuth redirect, quyền thiết bị và hành vi offline cần thiết kế theo nền tảng. Không để packages/contracts phụ thuộc window, localStorage, React hoặc Mongoose.

Chọn cơ chế session theo BR đăng nhập và mô hình triển khai. Không ép dùng JWT chỉ vì có kế hoạch mobile. Web cần xử lý cookie/CSRF phù hợp nếu dùng session cookie; native cần cơ chế xác thực và lưu thông tin phiên phù hợp khi được triển khai.

Nguồn: [React Native components](https://reactnative.dev/docs/intro-react-native-components), [Expo workspaces](https://docs.expo.dev/guides/monorepos/).

## 6. Dữ liệu bên ngoài, tiền và PWA

- Đặt API key và thao tác gọi nhà cung cấp cần secret tại server. Các biến VITE_* là dữ liệu có thể xuất hiện trong bundle web; chỉ dùng cho cấu hình công khai.
- Tách adapter của nhà cung cấp khỏi nghiệp vụ planner. Bắt đầu với một adapter cần thiết; validation kiểm tra đầu ra trước khi lưu.
- Dữ liệu địa điểm được lưu phải có nguồn rõ ràng và tuân theo quyền lưu trữ/sử dụng của nhà cung cấp.
- Khi triển khai commerce, tách order/payment/quyền sử dụng khỏi itinerary. Lưu giá tại thời điểm mua; xác minh webhook và xử lý lặp an toàn theo nhà cung cấp đã chọn.
- Số tiền có đơn vị tiền tệ và biểu diễn chính xác. Với VND nguyên, kiểm tra số nguyên trong miền an toàn; nếu cần số thập phân, chọn biểu diễn và quy tắc làm tròn rõ ràng.
- PWA bản đầu đề xuất có manifest/icons, giao diện trên điện thoại và offline fallback. Việc cache itinerary riêng tư, đồng bộ khi offline hoặc push là yêu cầu riêng cần thiết kế và kiểm thử. Không cache mặc định response auth/payment hoặc dữ liệu cá nhân vào cache dùng chung.

Nguồn: [Vite environment variables](https://vite.dev/guide/env-and-mode), [Express production security](https://expressjs.com/en/advanced/best-practice-security/), [MongoDB monetary data](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/), [PWA offline operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## 7. Task F0 — bootstrap có thể kiểm tra được

**Mục tiêu:** Một checkout sạch có thể cài đặt, chạy web + API, kết nối MongoDB local và build theo hướng dẫn tái lập được.

**Phạm vi:**

1. Kiểm tra runtime/môi trường; chọn bộ phiên bản tương thích, ghi Node version và package manager.
2. Dựng npm workspace cho client, server và contracts tối thiểu; bật TypeScript strict.
3. Dựng React/Vite/Tailwind với một màn hình nền có responsive cơ bản.
4. Dựng Express với validation cấu hình môi trường, error handling và endpoint /api/v1/health.
5. Thiết lập kết nối Mongoose local; health/readiness phải phân biệt được API đang chạy và database có truy cập được hay không. Không trả chi tiết nội bộ nhạy cảm.
6. Thêm hướng dẫn khởi tạo MongoDB và script kiểm chứng write/read/delete chỉ trong database kiểm tra riêng. Script phải từ chối chạy trên database production hoặc database ứng dụng thật.
7. Thêm .env.example, .gitignore phù hợp, scripts dev/build/typecheck/lint và CI chạy các kiểm tra tĩnh/build có thể tái lập bằng lockfile.
8. Cập nhật README với các lệnh đã chạy thật, môi trường và kết quả.

**Nghiệm thu F0:**

- Cài đặt từ lockfile trên checkout sạch được.
- Web gọi API thật và hiển thị kết quả; không hard-code tình trạng database.
- Dừng MongoDB thì trạng thái lỗi phản ánh đúng; chạy lại thì kết nối được theo cách đã mô tả.
- Script smoke kiểm chứng ghi/đọc/xóa thành công trong database kiểm tra riêng.
- Build, typecheck, lint đạt; CI được cấu hình, và phải nói rõ nếu chưa quan sát được kết quả chạy trên GitHub.
- Không đưa credential hoặc dữ liệu MongoDB vào git.
- Màn hình kỹ thuật của F0 không mặc nhiên trở thành trang chủ sản phẩm.

Không cần đợi Q-02/Q-04 trong BR để hoàn thành nền tảng này. Việc triển khai auth, planner, booking và payment phụ thuộc các quyết định nghiệp vụ tương ứng.

## 8. Task tiếp theo sau F0

Giải quyết Q-02 về định danh và quyền sở hữu trước khi triển khai lưu trip. Sau đó chọn một luồng sản phẩm nhỏ có giá trị: tạo thông tin trip → lưu qua API → mở lại theo chính sách đã chốt. Trong lúc Q-02 còn mở, persistence chỉ được kiểm chứng bằng database kiểm tra riêng của F0; không mặc định cho phép lưu trip công khai hoặc không có chủ sở hữu.

Chốt schema cùng luồng này, rồi mở rộng sang khám phá, AI và chỉnh sửa theo BR. Mỗi task hoàn tất một hành vi với điều kiện nghiệm thu, tránh tích lũy nhiều màn hình chưa nối dữ liệu.
