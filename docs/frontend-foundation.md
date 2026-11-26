# Traveler Foundation · M0 / Task 01

GoEase ưu tiên người địa phương tìm trải nghiệm cuối tuần tại Cần Thơ. AI Planner hỗ trợ lập lịch. Dấu ấn và quyền lợi hỗ trợ giữ chân người dùng. B2B2C là định hướng kinh doanh. [PRD v0.4.1](GoEase-Commercial-V1-PRD-v0.4.1-approved.md) · [UX IA v0.5](GoEase-UX-Information-Architecture-v0.5-approved.md) · [Decision log](DECISIONS.md)

## Kiến trúc

Đề xuất một ứng dụng web theo domain và một Express API theo mô hình modular monolith. Web gọi `/api/v1` cùng origin. [Contracts](../packages/contracts/) định nghĩa DTO và kiểm tra dữ liệu qua ranh giới API. Express sở hữu nghiệp vụ, phân quyền và tích hợp provider. MongoDB qua Mongoose lưu dữ liệu dùng bởi các module server. [Media](../packages/media/) cung cấp manifest tài sản công khai cho bên cần dùng.

Trong M0, [client-v2](../client-v2/) là workspace chuyển đổi riêng để nghiệm thu Traveler shell. [Client hiện hữu](../client/) vẫn chạy bằng `npm run dev`. Bản nghiệm thu dùng route liveness của Express qua Vite proxy. Backend nghiệp vụ, database và provider chưa tham gia luồng kiểm tra này.

### Domain map Commercial V1

| Domain và yêu cầu               | Mã nguồn hiện có                                                                                          | Công việc đề xuất sau M0                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khám phá và danh mục · DISC     | API địa điểm, danh mục vùng, provenance và xuất bản trong `features/explore`.                             | Kiểm chứng dữ liệu pilot Cần Thơ và API public. Xây Discovery trong Traveler mới theo từng lát cắt, gồm phân biệt địa điểm, trải nghiệm và sự kiện. |
| Đi chơi · OUT                   | `features/trips`, chia sẻ chuyến đi, `features/ai` và trình đọc offline ở web hiện hữu.                   | Kiểm thử lưu/sửa/chia sẻ và offline trước khi tái sử dụng. Xây luồng kèo ngắn. Đặt AI Planner như công cụ tùy chọn.                                 |
| Tài khoản · IDN                 | `features/auth` có login, session, email/OTP, hồ sơ và Google.                                            | Xác minh phiên, quyền sở hữu và provider đã cấu hình. Tích hợp vào điểm cần đăng nhập và kiểm chứng luồng giữ nháp.                                 |
| Dấu ấn và quyền lợi · MIS, OFF  | Shell có mục Dấu ấn. Chưa tìm thấy luồng cấp dấu, phát hoặc đổi voucher tương ứng trong backend hiện tại. | Xây quy tắc, bằng chứng, cấp dấu và trạng thái voucher sau khi chốt cách xác minh, quyền đối tác và hạn mức.                                        |
| Đối tác · PAR                   | Kiểm tra quyền hiện hữu phục vụ tài khoản và admin.                                                       | Xây onboarding, quyền theo điểm bán và luồng xác minh khi mô hình vận hành được phê duyệt.                                                          |
| Vận hành · ADM                  | Có admin danh mục, review, jobs và audit trong backend hiện hữu.                                          | Đánh giá phần dùng lại, lấp khoảng trống hỗ trợ, phân quyền và nghiệp vụ thương mại đã được chốt.                                                   |
| Đối soát và đo lường · COM, NFR | Có log request, audit và liveness.                                                                        | Xây bằng chứng thương mại, bảng kê theo điều khoản đã phê duyệt và đo lường theo consent. Theo dõi readiness và khả năng khôi phục.                 |

Đối chiếu tình trạng hiện có với mã nguồn. M0 chỉ xác minh runtime liveness. Phạm vi Commercial V1 còn các mục DEC-09 và Q01–Q12 trong [Decision log](DECISIONS.md). Các phần phụ thuộc quyết định còn mở cần xác nhận trước khi triển khai.

## Cấu trúc Traveler Foundation

```text
client-v2/
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

```powershell
npm ci
npm run dev:foundation
```

- Web tại [localhost:5181](http://localhost:5181/). Bốn route là `/`, `/di-choi`, `/dau-an` và `/toi`.
- Trình duyệt gọi [health qua Vite](http://localhost:5181/api/v1/health). Express phản hồi tại [localhost:3001](http://localhost:3001/api/v1/health). Tiến trình này dùng `createApp` và health router hiện hữu, bỏ qua khởi tạo product và trả 503 cho `/api/v1/health/db`.
- Nếu đã có backend local chạy trên 3000, đặt `GOEASE_API_TARGET=http://localhost:3000` trong `client-v2/.env`, rồi chạy `npm run build --workspace @goease/contracts` và `npm run dev --workspace @goease/client-v2`.
- Chạy `npm run test:foundation` khi 5181 và 3001 còn trống. Playwright tự khởi động tiến trình kiểm tra, dùng Edge và lưu ảnh trong `test-results/frontend-foundation/`. Kiểm tra tĩnh qua `npm run typecheck`, `npm run lint` và `npm run build` ở root.

Sau khi chủ dự án nghiệm thu M0, đề xuất kiểm chứng dữ liệu, nguồn và API public cho pilot Cần Thơ theo Q02, rồi xác nhận màn hình áp dụng trước khi bắt đầu lát cắt Discovery (DISC-01/02, T01/T02).
