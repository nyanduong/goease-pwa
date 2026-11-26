# Traveler Foundation · M0

GoEase ưu tiên người địa phương tìm trải nghiệm cuối tuần tại Cần Thơ. AI Planner hỗ trợ lập lịch. Dấu ấn và quyền lợi hỗ trợ giữ chân người dùng. B2B2C là định hướng kinh doanh. [PRD v0.4.1](GoEase-Commercial-V1-PRD-v0.4.1-approved.md) · [UX IA v0.5](GoEase-UX-Information-Architecture-v0.5-approved.md) · [Decision log](DECISIONS.md)

## Kiến trúc

Một ứng dụng web theo domain gọi `/api/v1` cùng origin qua Vite proxy. [Contracts](../packages/contracts/) chia sẻ hai schema health và lỗi API. [Express](../server/) phục vụ health, cấp request ID và ghi log có cấu trúc. MongoDB qua Mongoose là định hướng cho phần dữ liệu ở giai đoạn sau.

Task 02 đưa giao diện đã nghiệm thu của Task 01 vào [client/](../client/) và thiết lập API tối giản. Cả hai chạy bằng `npm run dev`.

### Domain map Commercial V1

| Domain và yêu cầu               | Mã nguồn trước cleanup tại checkpoint `1f33cfc`                                             | Công việc đề xuất sau M0                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khám phá và danh mục · DISC     | API địa điểm, danh mục vùng, provenance và xuất bản trong `features/explore`.               | Kiểm chứng dữ liệu pilot Cần Thơ và API public. Xây Discovery trong Traveler mới theo từng lát cắt, gồm phân biệt địa điểm, trải nghiệm và sự kiện. |
| Đi chơi · OUT                   | `features/trips`, chia sẻ chuyến đi, `features/ai` và trình đọc offline ở frontend cũ.      | Kiểm thử lưu/sửa/chia sẻ và offline trước khi tái sử dụng. Xây luồng kèo ngắn. Đặt AI Planner như công cụ tùy chọn.                                 |
| Tài khoản · IDN                 | `features/auth` có login, session, email/OTP, hồ sơ và Google.                              | Xác minh phiên, quyền sở hữu và provider đã cấu hình. Tích hợp vào điểm cần đăng nhập và kiểm chứng luồng giữ nháp.                                 |
| Dấu ấn và quyền lợi · MIS, OFF  | Shell có mục Dấu ấn. Các luồng cấp dấu, phát và đổi voucher còn là công việc Commercial V1. | Xây quy tắc, bằng chứng, cấp dấu và trạng thái voucher sau khi chốt cách xác minh, quyền đối tác và hạn mức.                                        |
| Đối tác · PAR                   | Kiểm tra quyền hiện hữu phục vụ tài khoản và admin.                                         | Xây onboarding, quyền theo điểm bán và luồng xác minh khi mô hình vận hành được phê duyệt.                                                          |
| Vận hành · ADM                  | Backend cũ có admin danh mục, review, jobs và audit.                                        | Đánh giá phần dùng lại, lấp khoảng trống hỗ trợ, phân quyền và nghiệp vụ thương mại đã được chốt.                                                   |
| Đối soát và đo lường · COM, NFR | Có log request, audit và liveness.                                                          | Xây bằng chứng thương mại, bảng kê theo điều khoản đã phê duyệt và đo lường theo consent. Theo dõi readiness và khả năng khôi phục.                 |

Các đường dẫn implementation cũ trong bảng dùng để tra cứu tại checkpoint. Baseline hiện tại xác minh liveness và trạng thái database chưa cấu hình. Phạm vi Commercial V1 còn các mục DEC-09 và Q01–Q12 trong [Decision log](DECISIONS.md). Các phần phụ thuộc quyết định còn mở cần xác nhận trước khi triển khai.

## Cấu trúc Traveler Foundation

```text
client/
├── public/brand/             # SVG G và minh họa lấy từ gói E2
├── src/
│   ├── app/                   # Đăng ký route và boundary lỗi render
│   ├── config/                # Đường dẫn API, timeout và điều hướng
│   ├── layouts/               # Traveler shell, focus, safe area
│   ├── pages/                 # Ghép màn nghiệm thu, route đích và 404
│   ├── features/system-health/ # Trạng thái kiểm tra health và thử lại
│   ├── shared/api/            # HTTP, kiểm tra contract và lỗi API
│   ├── shared/ui/             # Khung thẻ dùng chung
│   ├── styles/                # Token E2 và CSS của foundation
│   └── main.tsx               # Điểm khởi động React
├── tests/                     # Playwright cho shell và tích hợp health
└── vite.config.ts             # Dev server loopback và Vite proxy
```

Trang ghép UI từ feature và layout. Feature gọi API qua shared client và dùng contract có sẵn. React Router xử lý URL, lịch sử trình duyệt và trang lỗi. Token E2 ánh xạ từ [Brand Foundation](../Figma/brand/DESIGN.md) và [tokens.json](../Figma/brand/tokens.json). Header dùng SVG G quang học 32 px cạnh chữ GoEase. Minh họa từ ZIP E2 giữ nhãn **Minh họa tạm**. Tại 768 px trở lên, bốn mục chuyển lên header và hero chia hai cột để nghiệm thu desktop.

## Chạy và kiểm tra

Chạy `npm ci` rồi `npm run dev` từ root. Web ở [localhost:5181](http://localhost:5181/). Bốn route là `/`, `/di-choi`, `/dau-an` và `/toi`.

| Lời gọi                 | Kết quả foundation                                          |
| ----------------------- | ----------------------------------------------------------- |
| `GET /api/v1/health`    | HTTP 200, `ok: true`, `status: up` và `service: goease-api` |
| `GET /api/v1/health/db` | HTTP 503, `ok: false`, `DATABASE_NOT_CONFIGURED`            |
| Route không có          | HTTP 404, `ok: false`, `NOT_FOUND`                          |

Express cấp `X-Request-Id` cho mỗi phản hồi. Trình duyệt dùng liveness để hiển thị trạng thái kết nối API. Liveness và trạng thái database có thể xem trực tiếp trên cổng `3000` hoặc qua proxy trên cổng `5181`.

`npm test` kiểm tra hợp đồng HTTP, lỗi và cấu hình local. `npm run test:e2e` chạy Playwright trên Edge và lưu ảnh trong `test-results/frontend-foundation/`.
