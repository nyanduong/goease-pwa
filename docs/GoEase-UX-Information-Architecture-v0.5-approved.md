# GoEase — UX Information Architecture (IA) v0.5

**Ngày:** 22/11/2026  
**Trạng thái:** IA APPROVED — theo xác nhận từ người tiếp nhận dự án ngày 22/11/2026; wireframes và visual design vẫn chờ duyệt  
**Figma:** https://www.figma.com/design/xH1bTlxhgzyaCMT4AH6dvV  
**Nguồn:** GoEase Commercial V1 PRD v0.4; Business Capability Map v0.3; Repository Audit; quyết định đổi “Dấu chân” → **“Dấu ấn”** trong trao đổi sau PRD.

## 0. Quyết định định hướng

- **CONFIRMED:** GoEase bắt đầu tại **Cần Thơ**, ưu tiên **người địa phương tìm địa điểm, hoạt động và trải nghiệm cuối tuần**.
- **CONFIRMED:** Vẫn phục vụ khách du lịch từ xa bằng catalog và trip planner, nhưng không để AI Planner chi phối homepage.
- **CONFIRMED:** Thiết kế lại **toàn bộ frontend UX/UI**, nhưng không mặc định thay backend, database và nghiệp vụ đã chứng minh được.
- **CONFIRMED:** Tên hiển thị tab gamification là **“Dấu ấn”**.
- **PROPOSED:** Traveler có 4 tab chính: **Khám phá · Đi chơi · Dấu ấn · Tôi**.
- **PROPOSED:** Partner Portal và Admin Operations tách không gian làm việc, dùng chung thương hiệu và token thiết kế nhưng khác cấu trúc điều hướng.
- **APPROVED SCOPE:** Commercial V1 PRD v0.4 và UX Architecture v0.5 theo xác nhận khách hàng. **PENDING IMPLEMENTATION DETAILS:** điều khoản thương mại và quy trình vận hành đối tác cần quyết định cụ thể theo Q01–Q12.

## 1. Bốn nguyên tắc UX

1. **Value before login:** khám phá và mở chi tiết công khai không cần tài khoản; chỉ yêu cầu đăng nhập khi cần lưu/đồng bộ/nhận quyền lợi.
2. **Experience before game:** người không thích chơi nhiệm vụ vẫn dùng được khám phá, tìm kèo và planner.
3. **Trust by design:** hiển thị rõ giá chưa biết, giờ chưa xác minh, hoạt động đã hết hạn, trạng thái sử dụng voucher; không có trạng thái giả.
4. **Mobile-first for traveler and merchant; desktop-first for admin:** vẫn phải responsive, hỗ trợ keyboard/screen reader/reduced motion.

## 2. Product Surface A — Traveler PWA (mobile-first)

### 2.1 Navigation chính

```
Khám phá
├─ T01 Trang chủ / Gợi ý cuối tuần
├─ T02 Kết quả khám phá / Tìm kiếm / Bộ lọc
├─ T03 Chế độ bản đồ
├─ T04 Chi tiết địa điểm
├─ T05 Chi tiết trải nghiệm
├─ T06 Chi tiết sự kiện
└─ T07 Ưu đãi công khai & điều kiện

Đi chơi
├─ T08 Kèo / Chuyến đi của tôi
├─ T09 Tạo hoặc sửa kèo (1–5 lựa chọn)
├─ T10 Xem kèo / Chia sẻ read-only
├─ T11 Thiết lập chuyến đi nhiều ngày
├─ T12 Không gian chỉnh sửa lịch trình
└─ T13 Trình đọc lịch trình đã tải khi offline

Dấu ấn
├─ T14 Dấu ấn của bạn (tổng quan cá nhân)
├─ T15 Danh sách thử thách
├─ T16 Chi tiết thử thách / Tham gia / Tiến độ
├─ T17 Bộ sưu tập dấu đã nhận
├─ T18 Quà của tôi / Voucher list
└─ T19 Chi tiết voucher / Mã sử dụng / Điều kiện / Trạng thái

Tôi
├─ T20 Hồ sơ / Sở thích / Riêng tư / Cài đặt
├─ T21 Đăng nhập / Đăng ký / Khôi phục
└─ T22 Trợ giúp / Phản ánh địa điểm / Hỗ trợ
```

**Quy tắc điều hướng:**
- Bottom navigation: 4 mục, không thêm “Ưu đãi” thành tab riêng trong v0.5. Ưu đãi nằm theo ngữ cảnh trong Discovery/detail và “Quà của tôi” thuộc Dấu ấn.
- Khám phá → Chi tiết → Lưu kèo hoặc xem ưu đãi. Context `place`, `experience`, `event` phải được phân biệt.
- Đi chơi: **kèo** là lựa chọn linh hoạt ngắn; **chuyến đi** là hành trình theo ngày. Không phơi bày editor phức tạp của trip cho tất cả người dùng.
- Link chia sẻ public read-only, không làm lộ dữ liệu riêng. Khách mở link không phải đăng nhập chỉ để xem.
- Khi chuyển Guest → Login phải bảo toàn nháp đang có; không làm mất kèo khi chuyển trang.
- Không dựa vào GPS liên tục để tạo Dấu ấn; chỉ xin vị trí khi người dùng chủ động yêu cầu.

### 2.2 Các quyết định trải nghiệm đặc thù

- **Homepage:** “Cuối tuần này, đi đâu vui?” + khu vực tự chọn + tìm kiếm + bộ lọc nhanh theo nhu cầu. Nội dung mới/đang diễn ra/đáng quan tâm phải có dữ liệu thật.
- **Địa điểm:** phân biệt `Place`, `Experience`, `EventOccurrence`. Không hiển thị “còn chỗ” hoặc ETA không có nguồn xác minh.
- **Dấu ấn:** thiên về bộ sưu tập trải nghiệm cá nhân, tránh ép game; thành tựu phi tiền tệ và voucher có giá trị là hai thực thể khác nhau.
- **Voucher:** trước khi nhận mã phải thấy điều kiện/hiệu lực, sau khi nhận thấy `issued`, `redeemed`, `expired`, `void`. Nếu có timeout mạng, hiển thị trạng thái chưa xác nhận.
- **Planner:** giữ là một công cụ hữu ích trong “Đi chơi”, không chiếm hero chính của Home.

## 3. Product Surface B — Partner Portal (responsive, task-first)

```
P01 Hôm nay / Việc cần làm
├─ P02 Xác minh QR hoặc nhập mã thủ công
│  └─ P03 Kết quả: thành công / đã dùng / sai điểm bán / hết hạn / chưa xác nhận
├─ P04 Lịch sử xác minh / ngoại lệ
├─ P05 Ưu đãi & chiến dịch / gửi đề xuất / xem trạng thái
├─ P06 Hiệu quả & bảng kê
├─ P07 Đội ngũ / nhân viên / điểm bán / phân quyền
└─ P08 Hỗ trợ / tranh chấp / hướng dẫn
```

**Ưu tiên cao nhất:** luồng quét mã trên điện thoại với nút bấm lớn, trạng thái kết quả rõ, không tự đánh dấu thành công khi mạng mất kết nối. Staff chỉ xem được dữ liệu thuộc địa điểm được cấp quyền. Manager không tự ý duyệt điều khoản offer đang chạy.

## 4. Product Surface C — Admin Operations (desktop-first)

```
A01 Tổng quan / Việc cần làm (action queue)
├─ A02 Danh mục: Địa điểm · Trải nghiệm · Sự kiện
├─ A03 Nguồn & Xác minh: import · dedup · review · publish
├─ A04 Đối tác: hồ sơ · kiểm duyệt · nhân viên
├─ A05 Thỏa thuận & khu vực đối tác
├─ A06 Ưu đãi / Voucher / Campaign / Quota
├─ A07 Thử thách / Dấu ấn / Điều kiện cấp
├─ A08 Hỗ trợ / Fraud / Disputes / Reversal
├─ A09 Sự kiện tính phí / Báo cáo / Bảng kê / Điều chỉnh
└─ A10 Hệ thống: RBAC · workers/jobs · health · backup evidence
```

**Mô hình trang admin:** Danh sách việc cần xử lý → xem bằng chứng → quyết định có lý do → xem trước → duyệt/xuất bản → giám sát kết quả. Các khu vực tài chính, hỗ trợ và nội dung phải có RBAC tương ứng, không dùng một role `admin` toàn quyền duy nhất làm giả định triển khai.

## 5. Các user flow bắt buộc dựng trong Figma

| ID | Flow | Vai trò | Hành động thành công | Acceptance links |
|---|---|---|---|---|
| UX-F01 | Mở Home → lọc → xem trải nghiệm → lưu thành kèo → share | Guest/Traveler | Link mở read-only, nháp không mất | DISC-01–05, OUT-01–04, AT-01/04/05 |
| UX-F02 | Đăng nhập khi muốn lưu/claim → trở lại đúng nơi | Guest/Traveler | Không mất ý định, không redirect vô nghĩa | IDN-01–03, OUT-03 |
| UX-F03 | Xem thử thách → tham gia → dùng mã tại đối tác → nhận Dấu ấn | Traveler/Staff | Chỉ ghi nhận khi proof tin cậy, không double grant | MIS-01–05, OFF-03–06, AT-09/12 |
| UX-F04 | Đối tác đề xuất offer → admin duyệt → traveler nhận → staff redeem | Partner/Admin/Traveler | Trạng thái minh bạch, claim/redeem tách biệt | OFF-01–08, PAR-03, ADM-03 |
| UX-F05 | Redemption lỗi/mất mạng → kiểm tra/retry → support | Staff/Admin | Không tuyên bố thành công giả, có case/audit | OFF-06/07, ADM-04, AT-10/14 |
| UX-F06 | Admin kiểm chứng catalog → publish → xuất hiện discovery | Admin/Guest | Chỉ xuất bản dữ liệu đủ bằng chứng | ADM-02, DISC-03/04 |
| UX-F07 | Tạo chuyến dài ngày → sửa → lưu → share → offline read | Traveler/Tourist | Chạy được tại Cần Thơ với cảnh báo giới hạn | OUT-05/06, AT-04/05 |

## 6. Nine-screen wireframe batch 01 (ưu tiên vẽ trước)

| Thứ tự | ID | Screen | Tại sao ưu tiên |
|---|---|---|---|
| 1 | T01 | Trang chủ Khám phá | Chốt định vị local-first và Home information hierarchy |
| 2 | T02 | Kết quả tìm kiếm / Bộ lọc | Chốt cách người dùng tìm hoạt động đáng đi |
| 3 | T05 | Chi tiết trải nghiệm | Chốt cách nội dung đáng tin → quyết định hành động |
| 4 | T09 | Tạo kèo / lựa chọn nhóm | Chốt conversion từ khám phá sang hành động |
| 5 | T14 | Dấu ấn tổng quan | Chốt retention loop, không biến thành app game |
| 6 | T16 | Chi tiết thử thách | Chốt eligibility, tiến độ, bằng chứng |
| 7 | T19 | Voucher của tôi / mã xác minh | Chốt trust và trạng thái giao dịch |
| 8 | P02–03 | Partner verify / kết quả | Chốt hoạt động thương mại thực tế |
| 9 | A01 | Admin action queue | Chốt vận hành và mức độ tự động hỗ trợ |

**Design review:** Không chuyển batch 01 thẳng sang coding. Duyệt sơ đồ, luồng và wireframe trước; sau đó mới chọn art direction và design system.

## 7. State inventory bắt buộc cho wireframe

Mọi screen chính cần nêu và kiểm tra các trạng thái: default, loading, empty, error/retry, offline/limited, guest/auth gate, permission denied, stale/outdated data, success confirmation, failed/unknown confirmation. Một số trạng thái chỉ áp dụng cho từng luồng.

Đặc biệt:
- Search không có kết quả: gợi ý thay filter, không tạo listing giả.
- Data place không được xác minh: hiển thị trạng thái rõ.
- Claim voucher cùng lúc: UI xử lý không trùng.
- Redeem timeout: hiển thị “Chưa xác nhận — kiểm tra lại”.
- Mission proof rejected/expired: giải thích lý do và đường hỗ trợ.
- Guest login giữa chừng: draft trước đó còn nguyên.
- PWA offline: chỉ dữ liệu đã download, không nhận mã/đổi mã offline.

## 8. Figma file structure dự kiến

```
GoEase — UX Architecture & Wireframes v0.5
├─ 00 · GoEase UX Architecture
│  ├─ Information Architecture Board  (đã tạo)
│  └─ Key User Flows Board            (đã tạo)
├─ 01 · Traveler Wireframes           (batch 01)
├─ 02 · Partner Wireframes
├─ 03 · Admin Wireframes
├─ 04 · Visual Directions              (ít nhất 2 concept)
├─ 05 · Design System Foundations
└─ 06 · High-Fidelity & Prototype
```

**Hiện trạng Figma khi lập bản v0.5:** Đã tạo file và hai bảng IA/Journeys có các lớp chỉnh sửa được. Các trang wireframe/design system/high-fi phía sau là kế hoạch, **chưa được tạo**.

## 9. Handoff vào Codex (chưa thực hiện)

- Mỗi screen có ID `Txx`, `Pxx`, `Axx`, PRD `FR`, API/data dependency và acceptance criteria.
- Dùng screenshot/Figma frame làm visual target; code React + Vite + TypeScript mới theo UI đã duyệt.
- Tái sử dụng backend contract, catalog/trip persistence/share/PWA sau verification; không rewrite BE theo cảm tính.
- Tổ chức triển khai vertical slices (UI → API → DB → tests), không build một loạt màn hình mock rồi tuyên bố đã xong.
- Tách scope đã duyệt, giả thuyết và hạng mục chờ đối tác xác nhận.

## 10. Review gates

1. **IA review:** người dùng tìm được chức năng, hành trình đủ ngắn, auth gate hợp lý.
2. **Flow review:** business rules đúng, vai trò/trạng thái thiếu được bổ sung.
3. **Wireframe review:** thông tin và thao tác rõ, mobile đủ dùng.
4. **Visual concept review:** khách hàng chọn direction dựa trên nhiều màn hình thực.
5. **Prototype UAT:** thử luồng end-to-end trước khi coding UI mới.
6. **Dev handoff:** Figma link/frame ID + component/state specs + acceptance test.

---

*Owner review required. Tài liệu này không tự động thay thế PRD v0.4; quyết định “Dấu ấn” là bản cập nhật từ trao đổi mới nhất và phải được đồng bộ vào PRD sau khi scope chính thức được duyệt.*
