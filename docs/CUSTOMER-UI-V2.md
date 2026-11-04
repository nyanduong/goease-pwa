# Customer UI V2

Branch: `V2-ui-customer`, based on the current `V2-ui-admin` checkout. No merge or push performed.

## Design and scope

The supplied GoEase customer image and `GoEase_Customer_React_HTML.zip` are visual references. The React demo in the ZIP was inspected as text, not installed or executed. Its fake login, chat, ratings, map, trip totals and browser-only business state were not imported.

- White surfaces, compact Inter/system typography, teal primary actions, restrained orange highlights, pastel category icons and a five-item mobile navigation.
- Full-image welcome with original GoEase branding and preserved slogan; real login/register tabs, password visibility and existing email-verification flow.
- Home photo header, account entry, destination search, category shortcuts linked to actual explore filters, featured destination cards and recent trips.
- Explore cards, saved places, actual Leaflet map and place detail; catalog photos, credits and licenses remain visible. Provinces without a cover retain an honest neutral placeholder.
- Trip list, setup, destination sheet, itinerary, stop rows, real estimated/recorded cost controls and cost chart. Fixed the new-trip back step to return to setup before the existing unsaved-change confirmation.
- Goe conversation, proposal/composer presentation, account identity, profile/security forms, saved/trip shortcuts and confirmation dialogs.
- Shared trip root receives the same scoped theme. Successful shared-link access was not exercised because no new public link was created for UI review.

The welcome image is copied from the user-supplied archive to `client/src/assets/customer-v2/welcome.jpg`; no external upload or dependency installation. Styling lives in `customer-v2.css` and is restricted to `.customer-ui.customer-v2`. Admin files and all server/contracts/configuration files remain unchanged by this branch's work.

## Verification

- Client TypeScript/Vite production build and ESLint passed. Existing bundle-size warning remains; no performance-budget claim.
- Browser review at 375×667, plus home at 1280×800. Reviewed welcome, real login, register form without submission, home, explore category/search, catalog place detail, Leaflet map with loaded tiles, trip list, setup/destination picker, manual itinerary, costs, Goe trip selection without sending AI, account and expanded profile.
- The existing `user.demo@goease.test` account was used through the normal login form. Login/logout naturally affect sessions. No new account, OTP email, public share, AI request, trip save, expense save or profile save was submitted.
- One disposable manual draft used to inspect the itinerary/cost screens was discarded through the application's existing confirmation. The saved demo trip was viewed without editing.
- Confirmed the nested search input has no second border or focus outline. Map attribution is compact and retained. Photos and timeline text use separate grid columns; bottom controls and narrow-screen guides remain accessible.
- Notification, review, Apple/Facebook login and general-purpose AI capabilities shown in the reference are not implemented merely as decorative buttons. Existing backend behavior is retained.

Selected review screenshots are in `ui-customer-v2/evidence/`. These browser captures are not a physical Android/iOS acceptance test.

## Local API limitation observed during review

The existing local API intermittently exits with Node v24.15.0 / Undici `ERR_INVALID_STATE: ReadableStream is already closed`. The frontend then shows its existing reconnect/error states. The API was restarted for UI review; the server implementation, environment file and background-work settings were not changed. This is not a successful backend stability acceptance test and needs separate server investigation.

## Reference fidelity follow-up

- Customer-only icon adapter now uses the SVG paths from the supplied React reference (24px grid, rounded strokes, compact navigation). Admin icon imports are unchanged.
- Home now presents three image-backed destinations from the actual enabled catalog, with a clear main card and two smaller cards; no fabricated ratings. Category colors and header/shortcut overlap follow the reference. Sea/island shortcut searches the existing nature catalog for biển.
- Login wordmark uses orange Go / teal Ease. Explore photos fill their card frames, with real location/duration chips. Existing photo credit links are retained.
- Selecting a real map marker opens an inline preview drawer with actual photo, location, duration, directions and detail navigation.
- Added short fade/sheet/press transitions with reduced-motion support. Screenshot/reference styling does not add unsupported notifications, reviews or social login providers.

## Lớp bề mặt và phản hồi chạm (28/10/2026)

- `customer-materials.css` là lớp hoàn thiện riêng, chỉ tác động customer: nền trắng lạnh, bóng nhiều lớp cường độ thấp, viền sáng, màu teal chuyển sắc nhẹ, thanh dưới mờ có fallback nền đặc.
- Nút/ô nhập/thẻ/khung nổi dùng cùng nhịp bo góc và phản hồi chạm. Trường tìm kiếm chỉ có một viền ở vỏ ngoài; giảm chuyển động vẫn được tôn trọng. Có font entry 16px riêng cho WebKit iOS để tránh tự phóng khi focus.
- Khung customer tối đa 430px khi xem laptop; không thêm viền điện thoại hay status bar giả. Menu theo thứ tự mẫu: Khám phá, Chuyến đi, Goe AI, Thông báo, Cá nhân. Tab thông báo hiện chỉ là giao diện trạng thái trống, chưa có feed hay push backend.
- Tạo chuyến bổ sung tên, ngày bắt đầu, số ngày, bộ tăng/giảm và nhập trực tiếp số người, chọn phong cách hiển thị trực tiếp. Tùy chọn ít dùng thu gọn. Ngày được xác nhận theo thao tác thật, kiểm tra input hiện có vẫn giữ.
- Đã quan sát trên 375×667: trang chủ, chuyến, tạo chuyến, timeline, chi phí, hồ sơ, chat và popup Goe. Sau khi khởi động lại local server cần nạp lại trang để nhận bundle mới. Đã sửa lỗi popup dùng scrollHeight=0 lúc ẩn dẫn đến mở ngoài màn hình; có test hình học độc lập.
- Lượt cuối kiểm tra laptop gặp lỗi kết nối browser `browser.user is unavailable`. Không coi việc build đạt là đã nghiệm thu Safari/iPhone thật, hiệu suất hoặc kiểm tra lại toàn bộ desktop. Các ảnh cũ trong evidence thể hiện đúng thời điểm chụp, không phải tất cả đều là bản cuối.

Kết nối browser sau đó đã khôi phục được. Đã kiểm tra bổ sung renderer sprite (30/30 trạng thái), fallback ảnh, hành vi tự động và một lượt đề xuất AI thật trên chuyến Demo. Chi tiết/giới hạn trong [MASCOT-COMPANION](MASCOT-COMPANION.md); streaming và chat du lịch tự do vẫn cần backend. Lớp chat có một vùng cuộn và header/composer cố định trong viewport.
