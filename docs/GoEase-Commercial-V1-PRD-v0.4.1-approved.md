# GoEase — Commercial V1 Product Requirements Document (PRD)

**Phiên bản:** v0.4.1 · 22/11/2026 (đồng bộ nhãn UX, không thay đổi phạm vi)  
**Trạng thái:** APPROVED SCOPE — theo xác nhận khách hàng được người tiếp nhận dự án chuyển ngày 22/11/2026; các open decisions / điều kiện vận hành còn được theo dõi riêng  
**Loại tài liệu:** Product Requirements Document + Business Rules + Acceptance Criteria  
**Phạm vi địa lý khởi đầu:** Cần Thơ, Việt Nam  
**Nhóm người dùng ưu tiên:** người địa phương tìm trải nghiệm, hoạt động và chỗ đi chơi cuối tuần  
**Nhóm thứ cấp:** khách du lịch từ xa đến Cần Thơ; mở rộng nguồn cung ra ĐBSCL về sau  
**Nguồn đầu vào:** `GoEase-Product-Business-Blueprint-v0.2.md`, `GoEase-Business-Capability-Map-v0.3.md`, `GoEase-Repository-Audit.md` (static audit tại `f14a8a1ab5a4`), quyết định trong cuộc trao đổi với chủ dự án/đơn vị tư vấn.

> **Cách đọc:** **CONFIRMED** = định hướng đã được người tiếp nhận dự án lựa chọn trong trao đổi; **PROPOSED** = đề xuất sản phẩm đang cần khách hàng phê duyệt; **TO VALIDATE** = cần kiểm chứng với người dùng/đối tác/thử nghiệm; **EXISTING—STATIC** = mã nguồn được audit tìm thấy nhưng CHƯA được xác nhận chạy đúng. Không suy diễn các yêu cầu đề xuất thành nghĩa vụ của khách hàng hay thành tính năng đã hoàn thành.

---

## 0. Tóm tắt điều hành và các quyết định

> **Approval record:** Khách hàng đã duyệt Commercial V1 PRD v0.4 và UX Architecture v0.5 theo thông báo từ người tiếp nhận dự án. Bản v0.4.1 chỉ đồng bộ tên hiển thị từ “Dấu chân” thành “Dấu ấn” đã được chủ dự án chọn; không thêm hoặc thay đổi chức năng. Các câu hỏi Q01–Q12 vẫn cần ghi nhận quyết định cụ thể trước khi triển khai các luồng phụ thuộc.


**Định vị làm việc:** **GoEase — Cuối tuần này, đi đâu vui?** Nền tảng khám phá và phân phối trải nghiệm địa phương, giúp cư dân Cần Thơ tìm hoạt động thực tế, rủ bạn, tham gia trải nghiệm, nhận dấu thành tựu/quyền lợi hợp lệ; đồng thời giúp đối tác quảng bá và đo lường kết quả. AI lên lịch là tiện ích hỗ trợ, không phải trung tâm kinh doanh.

**Định hướng kinh doanh (PROPOSED):** B2B2C; người dùng có thể khám phá miễn phí; đối tác trả phí theo chiến dịch tài trợ hoặc theo sự kiện thương mại **được xác minh theo hợp đồng**, không được mặc định mọi voucher claim đều phát sinh doanh thu.

**Chiến lược ra mắt (CONFIRMED):** hoàn thành mọi luồng thuộc **Commercial V1** và closed beta/UAT trước public marketing diện rộng. **Nghiên cứu người dùng và làm việc với đối tác vẫn phải diễn ra trong quá trình xây dựng**, không đợi đến sau khi code xong.

**Hướng kỹ thuật (PROPOSED):** thay mới toàn bộ kiến trúc trải nghiệm và giao diện (React + Vite + TypeScript), giữ/reuse backend Express + MongoDB Atlas, contracts, catalog, trip persistence, share và PWA foundation sau runtime validation; sử dụng modular monolith, không microservices mặc định.

**Tên mục game hóa (CONFIRMED trong trao đổi UX):** tab **“Dấu ấn”** thay cho “Hộ chiếu”; tên màn hình “Dấu ấn của bạn”; mục con **Thử thách**, **Dấu đã nhận**, **Quà của tôi**. Tên “Dấu ấn” được chốt cho Commercial V1; thay đổi sau này cần qua change control. “Dấu ấn” KHÔNG ám chỉ theo dõi vị trí liên tục.

### 0.1. Decision register

| ID | Trạng thái | Quyết định |
|---|---|---|
| DEC-01 | CONFIRMED | Cần Thơ là thị trường đầu tiên; local weekend explorers là nhóm ưu tiên. |
| DEC-02 | CONFIRMED | Khách từ xa vẫn dùng chung nền tảng; mở rộng vùng theo chất lượng nguồn cung. |
| DEC-03 | CONFIRMED | UI hiện tại được phép thay toàn bộ; không mặc định thay backend/database. |
| DEC-04 | CONFIRMED | Mục tiêu là doanh nghiệp có khả năng tạo doanh thu/lợi nhuận thực tế. |
| DEC-05 | PROPOSED | B2B2C, ưu tiên trải nghiệm có cách xác minh thật. |
| DEC-06 | CONFIRMED LABEL / APPROVED V1 BOUNDARY | Mục “Dấu ấn”, gamification không có ví điểm quy đổi tiền ở V1. |
| DEC-07 | PROPOSED | Cơ chế thương mại ban đầu: phí chiến dịch và phí chuyển đổi hợp lệ theo thỏa thuận. |
| DEC-08 | PENDING | Nhóm đối tác pilot, cơ chế tính phí, người chịu trách nhiệm vận hành và xác nhận pháp lý. |
| DEC-09 | PENDING | Toàn bộ danh mục chức năng này được chủ dự án phê duyệt làm Commercial V1. |

## 1. Vấn đề, người dùng và giá trị

### 1.1. Jobs to be done

| Người dùng | Vấn đề | Kết quả mong muốn |
|---|---|---|
| Local Weekend Explorer (P0) | Không biết cuối tuần này có gì hay, phù hợp túi tiền, thời gian và vị trí | Tìm lựa chọn tin cậy và quyết định trong vài bước |
| Người đứng ra rủ nhóm (P0) | Nhiều link rời rạc, khó thống nhất | Lưu 1–5 phương án thành “kèo”, chia sẻ không bắt bạn bè đăng nhập chỉ để xem |
| Gia đình địa phương (P1) | Khó xác định giá, độ phù hợp, tiện ích | Thông tin đáng tin, lọc theo yêu cầu và kỳ vọng rõ ràng |
| Khách du lịch từ xa (P2 trong acquisition) | Chưa biết đi đâu, sắp xếp lịch nhiều ngày khó | Tận dụng catalog, planner, chia sẻ và bản lưu offline |
| Merchant staff (P0) | Đổi voucher lúc đông khách dễ lỗi/gian lận | Xác minh nhanh, một lần duy nhất, biết rõ thành công/thất bại |
| Merchant manager (P0) | Không đo được kết quả quảng bá | Xem lượt xác minh và báo cáo có định nghĩa rõ ràng |
| Admin / Support / Finance (P0) | Dữ liệu, chiến dịch, đối tác và tranh chấp khó kiểm soát | Có hàng đợi xử lý, dấu vết và đối soát giải thích được |

### 1.2. Lời hứa sản phẩm

- **Du khách:** khám phá *hoạt động thật* hợp lúc, hợp người, hợp tiền; trải nghiệm có điều kiện minh bạch; có thể lưu dấu thành tựu nếu thích.
- **Đối tác:** cơ hội tiếp cận khách phù hợp và xem được bằng chứng tham gia/chuyển đổi; chỉ bị tính phí theo điều khoản đã ký.
- **GoEase:** doanh thu đo được, nguồn cung/địa điểm đáng tin, quy trình vận hành và kiểm soát chi phí thưởng.

### 1.3. North Star & chỉ số bảo vệ

**North Star candidate:** **Verified Local Experiences / 28 days** = số lượt trải nghiệm hợp lệ có bằng chứng theo tiêu chuẩn xác minh đã duyệt, không phải số trang xem, mã được cấp, yêu cầu AI hay GPS check-in. Trải nghiệm miễn phí được xác minh có thể tính vào North Star nhưng KHÔNG mặc định là sự kiện có thể xuất hóa đơn.

Chỉ số bảo vệ: tỷ lệ tranh chấp/đổi mã trùng, khiếu nại thông tin sai, tỷ lệ đối tác quay lại, contribution margin sau thưởng và chi phí biến đổi, CAC của nhóm có chuyển đổi, thời gian xử lý sự cố.

## 2. Ranh giới sản phẩm Commercial V1

### 2.1. IN SCOPE — phải chạy end-to-end

1. Discovery công khai (không ép đăng nhập), tìm và lọc theo địa điểm/thời gian/nhóm/chi phí; nội dung có độ tin cậy, trạng thái rõ.
2. Place / experience / event detail, phân biệt thông tin của địa điểm cố định với hoạt động có lịch, suất hoặc ngày diễn ra.
3. “Đi chơi”: shortlist / kèo ngắn, lưu/sửa/chia sẻ; giữ planner nhiều ngày đã có sau kiểm thử và sửa lỗi cần thiết.
4. Identity và phân quyền theo vai trò; đăng nhập khi cần bảo vệ dữ liệu/tạo voucher; không cưỡng ép ở luồng khám phá.
5. **Dấu ấn**: thử thách có quy tắc, tích dấu thành tựu phi tiền tệ, thông tin tiến độ, lịch sử, phần quà/voucher cá nhân.
6. Offer/voucher: quy tắc đủ điều kiện, nhận mã, hiển thị tình trạng, xác minh sử dụng một lần; có thu hồi/điều chỉnh có kiểm soát.
7. Partner onboarding phê duyệt, quản lý nhân viên, kiểm tra mã tại điểm bán, xem kết quả cơ bản.
8. Admin: catalog, review nguồn, kiểm duyệt đối tác/offer/mission, xử lý hỗ trợ/gian lận/đối soát.
9. Commercial evidence: phân biệt claim, redemption, sale; gán nguồn theo giới hạn thỏa thuận, xuất bảng kê đối tác; hóa đơn/thu tiền có thể ngoài hệ thống trong V1.
10. Analytics, giám sát vận hành, backup/restore, kiểm thử UX trên thiết bị/PWA.

### 2.2. LIMITED / MANUAL-ASSISTED V1

- Sponsored placements có nhãn rõ ràng và do admin duyệt; không có self-serve ads platform.
- Partner statement do admin kiểm tra, xuất file và ghi nhận đã thanh toán; không có thu tiền tự động.
- Thông báo nhắc nhở/khám phá mới chỉ qua kênh khả thi, có opt-in; không cần push đa nền tảng ngay.
- Nhân sự hỗ trợ khách/đối tác có thể xử lý thủ công từ Admin với log và quyền hạn.

### 2.3. OUT OF SCOPE V1

Thanh toán trực tuyến đa đối tác, inventory booking real-time và refund/payout tự động; ví điểm chuyển nhượng/quy đổi tiền; group co-edit và vote trực tiếp; mạng xã hội/UGC đầy đủ; subscription SaaS cao cấp; tự động hóa marketing ở quy mô quốc gia; kiến trúc microservices chỉ để “phòng tương lai”.

## 3. Phân quyền và business ownership

| Vai trò | Xem | Tạo/thay đổi | Không được làm |
|---|---|---|---|
| Guest | địa điểm/offer công khai, link kèo public | lọc, xem, tạo nháp tạm theo chính sách | nhận voucher hoặc xem dữ liệu riêng của người khác |
| Traveler | dữ liệu riêng, voucher, dấu ấn | lưu kèo, join mission, claim đủ điều kiện | tự đánh dấu đã trải nghiệm thành công có giá trị thưởng |
| Partner staff | voucher thuộc điểm bán được cấp quyền | validate/redeem theo quy tắc | sửa điều khoản, bảng kê, người dùng hoặc merchant khác |
| Partner manager | profile/campaign và báo cáo của đối tác mình | gửi đề xuất offer, quản lý nhân viên trong giới hạn | tự phê duyệt offer/sửa giao dịch đã đối soát |
| Content admin | catalog và nguồn | review/publish/update nơi được cấp quyền | tự ý sửa lịch sử đối soát |
| Commerce admin | offers, missions, exceptions | approve/pause/reject theo quy trình | vượt hạn mức hoặc sửa hợp đồng không có dấu vết |
| Support/Fraud | case, proof theo tối thiểu cần thiết | điều tra, đề xuất reversal, ghi lý do | thực hiện hành động tài chính ngoài quyền |
| Finance admin | agreement, chargeable events, statements | điều chỉnh được ủy quyền, xuất/khoá bảng kê | xóa lịch sử giao dịch; thay đổi bằng chứng nguồn |
| System operator | technical health và log có kiểm soát | backup, deploy, khôi phục | thay đổi nghiệp vụ trái quy trình |

**Owner ngoài phần mềm cần chỉ định:** Product Owner phía khách hàng; Merchant Ops/Sales; Catalog Editorial; Support/Fraud; Finance; Compliance/Legal; UX Lead; Engineering Lead. Chưa có nhân sự thì phải ghi rõ bên chịu trách nhiệm thay thế ở V1.

## 4. UX Information Architecture — redesign 100% giao diện

### 4.1. Traveler PWA: bốn tab (PROPOSED)

```text
Khám phá
├── Trang chủ: “Cuối tuần này, đi đâu vui?”
├── Tìm kiếm / Bộ lọc / Kết quả / Bản đồ
├── Chi tiết địa điểm / trải nghiệm / sự kiện
└── Ưu đãi và điều kiện chương trình

Đi chơi
├── Kèo của tôi (danh sách đã lưu, nháp)
├── Tạo kèo / sắp xếp 1–5 địa điểm / chia sẻ
├── Chuyến đi nhiều ngày của tôi
└── Lên lịch (AI tùy chọn) / ngân sách / offline reader

Dấu ấn (tên đã chốt thay “Hộ chiếu”)
├── Tổng quan dấu ấn và tiến độ
├── Thử thách / Chi tiết / Tham gia
├── Dấu đã nhận (thành tựu đã xác minh)
└── Quà của tôi (voucher: hiệu lực, đã dùng, hết hạn)

Tôi
├── Hồ sơ / tùy chọn riêng tư / cài đặt
├── Đăng nhập / đăng ký / khôi phục
├── Trợ giúp / phản ánh vấn đề
└── Thông báo / tùy chọn nhận thông tin
```

- Không yêu cầu tạo tài khoản để xem nội dung công khai hoặc mở link kèo đọc-only.
- Chỉ xin vị trí khi người dùng chọn “Gần tôi”; có lựa chọn khu vực thủ công.
- Không bắt người dùng qua game/reward trước khi tìm được nơi muốn đi.
- Màn “Dấu ấn” KHÔNG tự thu thập lịch sử vị trí; dấu được tạo từ xác minh có kiểm soát.
- Ưu đãi có thể nằm ngay trong chi tiết trải nghiệm và ở mục “Quà của tôi”; chưa cần tab ưu đãi riêng.

### 4.2. Partner Portal (responsive, UX vận hành)

```text
Hôm nay → Xác minh mã / QR → Kết quả rõ ràng
Ưu đãi & chiến dịch → danh sách, chi tiết, đề xuất thay đổi
Lịch sử sử dụng → tìm, lọc, ngoại lệ, gửi khiếu nại
Hiệu quả → số lượt hợp lệ, bằng chứng, bảng kê
Đội ngũ & hỗ trợ → tài khoản nhân viên, quyền, hướng dẫn
```

### 4.3. Admin Operations (desktop-first, responsive tối thiểu)

```text
Tổng quan / Việc cần làm
Danh mục → Địa điểm · Trải nghiệm · Sự kiện · Nguồn · Xác minh
Đối tác → Hồ sơ · Phê duyệt · Nhân viên · Thỏa thuận
Chương trình → Ưu đãi · Thử thách · Tài trợ · Hạn mức
Hỗ trợ → Đổi mã lỗi · Gian lận · Khiếu nại · Điều chỉnh
Tài chính → Sự kiện tính phí · Bảng kê · Điều chỉnh · Xuất dữ liệu
Hệ thống → Vai trò · Khu vực · Giám sát · Quy tắc
```

**UI design constraints:** mobile-first Traveler, dễ hiểu tiếng Việt; hình ảnh thật có quyền sử dụng; không tô điểm bằng tình trạng giả “còn chỗ”, giá hoặc rating không xác minh; skeleton/empty/error/offline/permission đều có màn rõ; chuyển động nhẹ, hỗ trợ reduced-motion; Partner ưu tiên quét mã nhanh và kết quả dễ nhận biết; Admin ưu tiên “việc cần làm” và khôi phục sự cố.

## 5. Các yêu cầu chức năng (FR) và nghiệm thu

**Quy ước:** P0 = phải có để đóng V1; P1 = có thể xử lý bản tối giản đã ký duyệt; P2 = ngoài scope hiện tại. Các AC là tiêu chí nghiệm thu đề xuất, cần test với dữ liệu có thật trong pilot.

### 5.1. Discovery, Catalog & Experience — DISC

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| DISC-01 | P0 | Guest xem feed khám phá Cần Thơ không đăng nhập | Khi mở PWA lần đầu, truy cập được nội dung public và filter; nếu chưa có dữ liệu thì có empty state trung thực |
| DISC-02 | P0 | Tìm kiếm/filter theo thời gian, danh mục, người đi cùng, chi phí, khu vực | Filter đúng dữ liệu thực; có pagination/infinite load, không dừng ngầm ở 20 kết quả |
| DISC-03 | P0 | Chi tiết place/experience/event rõ nguồn và điều kiện | Thể hiện loại hình, vị trí, giá/không rõ giá, lịch/không rõ giờ, trạng thái xác minh, điều kiện, contact/directions |
| DISC-04 | P0 | Phân biệt place thường trực với hoạt động có khung giờ | Sự kiện quá hạn không hiển thị như sắp diễn ra; offer chỉ hiện khi đủ điều kiện và chưa đóng |
| DISC-05 | P0 | Bản đồ và external directions | Marker đúng tọa độ đã xác minh; không tự nhận ETA theo đường bộ nếu chưa có dịch vụ routing |
| DISC-06 | P0 | Nội dung tài trợ minh bạch | Vị trí tài trợ có nhãn; filter cơ bản vẫn giữ sự phù hợp và không che giấu điều kiện |
| DISC-07 | P1 | Tiếp nhận phản ánh địa điểm sai/hết hạn | Người dùng gửi phản ánh, admin thấy trong queue, có trạng thái xử lý |

**Nghiệp vụ bắt buộc:** dữ liệu địa điểm phải có quyền sử dụng và nguồn; giá không rõ thì ghi “Chưa có thông tin”, không điền số giả; không gắn “Đã xác minh” nếu thiếu bằng chứng; sự kiện, suất và voucher có thời gian mở/đóng theo múi giờ `Asia/Ho_Chi_Minh`.

### 5.2. Đi chơi, Kèo & Trip Planner — OUT

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| OUT-01 | P0 | Lưu 1–5 lựa chọn vào kèo ngắn | Thêm/xóa/đổi thứ tự rõ ràng; không mất nội dung khi quay lại màn trước |
| OUT-02 | P0 | Đặt tên/chỉnh thời gian và chia sẻ kèo | Link public read-only chỉ lộ trường được phép; link mở được khi chưa login, có expiry/revoke nếu account-backed |
| OUT-03 | P0 | Khách có thể xem và tạo nháp trước đăng nhập | Không ép auth để khám phá; nếu cần account để đồng bộ, thông báo trước và giữ nháp qua bước login |
| OUT-04 | P0 | Danh sách kèo/chuyến đi đã lưu | Lưu, sửa, mở lại đúng account; xử lý đồng bộ/conflict và stale state rõ ràng |
| OUT-05 | P0 | Planner hiện hữu cho chuyến nhiều ngày | Luồng generate → edit → save → reopen → share chạy trên bộ dữ liệu Cần Thơ pilot; có cảnh báo giới hạn về ETA/ngân sách/giờ mở |
| OUT-06 | P1 | Offline saved-trip reader theo khả năng PWA hiện có | Khi đã tải bản snapshot và mất mạng, đọc được dữ liệu đã tải; không hứa offline maps hay đổi voucher offline |

**Phân biệt đối tượng:** “Kèo” = lựa chọn ngắn/linh hoạt cho người đi chơi; “Chuyến đi” = hành trình theo ngày nhiều điểm, có phiên bản và chi phí. Có thể tái sử dụng persistence dưới một abstraction sau đánh giá, nhưng UX không cần phơi bày sự phức tạp của editor cũ.

### 5.3. Identity & Customer Account — IDN

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| IDN-01 | P0 | Đăng ký, login, khôi phục tài khoản, logout | Kiểm thử email/OTP/password, session expiration; không lộ account existence trong error nhạy cảm |
| IDN-02 | P0 | Hiển thị Google sign-in khi provider được cấu hình hợp lệ | Không hiển thị nút không hoạt động; luồng end-to-end và rate-limit theo đúng principal, không khóa nhầm tất cả users |
| IDN-03 | P0 | Consent, quyền riêng tư và quyền xóa/dữ liệu theo chính sách | Không xin GPS/push bắt buộc; các lựa chọn được lưu/audit theo yêu cầu pháp lý đã duyệt |
| IDN-04 | P0 | Role-based isolation | Traveler không thể xem voucher của người khác; staff chỉ xem giao dịch của merchant/location đã được cấp quyền |
| IDN-05 | P1 | Sở thích tùy chọn | Có thể bỏ qua onboarding sở thích; thay đổi được sau này; không ngầm suy diễn dữ liệu nhạy cảm |

### 5.4. Offer, Voucher & Redemption — OFF (security/commerce critical)

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| OFF-01 | P0 | Merchant gửi đề xuất offer có điều khoản | Có merchant/location, window, giới hạn, lợi ích, điều kiện, ngân sách/ai tài trợ và version đề xuất |
| OFF-02 | P0 | Admin duyệt/publish/pause | Offer chưa approved không được claim; thay đổi quy tắc quan trọng cần review, versioned và audit |
| OFF-03 | P0 | Traveler claim voucher nếu đủ điều kiện | Enforce per-user/merchant/offer quota, expiry và limits theo transaction; request lặp không phát trùng |
| OFF-04 | P0 | “Quà của tôi” hiển thị mã và trạng thái | Issued/redeemed/expired/void rõ ràng, điều khoản dùng được; lỗi tải có retry, không tuyên bố thành công giả |
| OFF-05 | P0 | Staff quét/nhập mã để xác minh đúng một lần | Hai staff cùng redeem chỉ tối đa 1 người thành công; replay/expired/wrong location bị từ chối; log theo staff và nơi thực hiện |
| OFF-06 | P0 | Xử lý mất mạng/timeout khi redemption | Nếu chưa nhận kết quả server, UI hiển thị “Chưa xác nhận — kiểm tra lại”; staff có idempotent retry hoặc tra trạng thái, không được đánh dấu đã đổi tự động |
| OFF-07 | P0 | Reversal/adjustment được ủy quyền | Không âm thầm chuyển `redeemed` về `issued`; thao tác bù trừ có lý do, actor, timestamp, liên kết giao dịch gốc |
| OFF-08 | P1 | Quota/budget alerts & pause | Hạn mức hợp đồng/offer không vượt trong race condition; admin có thể pause, người dùng được giải thích |

**V1 không xử lý thanh toán online:** Claim và redeem không tương đương bán hàng thành công. Nếu hợp đồng yêu cầu **sale confirmation**, phải có bằng chứng và luồng xác minh riêng, không tự suy đoán doanh thu từ số QR đã quét.

### 5.5. Dấu ấn, Missions, Achievements — MIS

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| MIS-01 | P0 | Admin tạo nhiệm vụ có điều kiện cụ thể | Có eligibility, thời hạn, địa điểm/experience hợp lệ, số lần được nhận dấu và cơ chế xác minh |
| MIS-02 | P0 | Traveler xem/join mission và tiến độ | Rõ nhiệm vụ còn hiệu lực, đã tham gia, bước thiếu và thông báo khi không đủ điều kiện |
| MIS-03 | P0 | Ghi nhận bằng chứng hoàn thành từ kênh tin cậy | Mỗi bằng chứng đúng và còn hạn tạo tối đa một achievement theo rule; self-GPS/photo không đủ để tự cấp quà có giá trị |
| MIS-04 | P0 | Trang “Dấu ấn” có bộ sưu tập dấu đã nhận | Dấu đã xác minh hiển thị lâu dài theo chính sách; mission kết thúc không xóa lịch sử thành tựu đã cấp |
| MIS-05 | P0 | Liên kết voucher nếu có reward | Khi đạt điều kiện có thể cấp offer/voucher thông qua OFF domain, không dùng một bảng “points” tự do điều chỉnh |
| MIS-06 | P1 | Có trạng thái rejected/expired/support | Người dùng thấy vì sao không nhận dấu hoặc cách liên hệ hỗ trợ; admin có audit trail |

**Nguyên tắc thiết kế:** “Dấu ấn” là trang trải nghiệm cá nhân, không phải trò chơi bắt buộc. Dấu phi tiền tệ khác với voucher có giá trị; không trộn hai loại record. Không push streak gây áp lực hoặc thử thách nguy hiểm.

### 5.6. Partner Portal — PAR

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| PAR-01 | P0 | Onboard merchant đã được xác minh | Admin phê duyệt pháp nhân/chủ thể vận hành, location và người phụ trách; chưa verified không được phát offer live |
| PAR-02 | P0 | Manager quản lý staff theo venue | Mỗi staff chỉ truy cập merchant/location gán; disable có hiệu lực với session theo thiết kế xác thực |
| PAR-03 | P0 | Trang “Xác minh mã” tối ưu điện thoại | Scan hoặc nhập tay, xác nhận đúng venue/offer trước khi xử lý; kết quả thành công/thất bại không nhập nhằng |
| PAR-04 | P0 | Danh sách redemption và ngoại lệ | Theo staff, ngày, trạng thái, reason (có quyền); chỉ hiển thị PII tối thiểu |
| PAR-05 | P1 | Đề xuất/chỉnh offer theo quyền | Manager gửi yêu cầu đổi điều khoản; bản live không tự thay khi chưa được admin approve |
| PAR-06 | P1 | Hiệu quả cơ bản | Thấy claim, verified redemption, dispute, phí dự kiến bằng định nghĩa minh bạch; không hiển thị “doanh thu tăng thêm” nếu chưa chứng minh được |

### 5.7. Admin Operations & Data Quality — ADM

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| ADM-01 | P0 | Action queue ưu tiên lỗi/ngoại lệ | Các case cần duyệt/xử lý có trạng thái, người phụ trách, log và filter |
| ADM-02 | P0 | Catalog import, dedup, verify, publish/unpublish | Không public venue/event chưa đủ nguồn/chất lượng; stale/hết thời gian không quảng cáo còn hiệu lực |
| ADM-03 | P0 | Quản lý partner/offer/mission | RBAC admin riêng; mọi quyết định publish/pause/cancel có lý do và audit |
| ADM-04 | P0 | Fraud & dispute support | Tra cứu redemption, kiểm tra proof, quyết định reversal có quyền; lưu liên kết case và kết quả |
| ADM-05 | P0 | Giám sát tác vụ nhập/enrichment | Không nhận job khi worker không thực thi mà không cảnh báo; job treo thấy được và xử lý được |
| ADM-06 | P1 | Billing review & export | Lọc kỳ, campaign/merchant, hợp đồng, approved adjustments; xuất bảng kê tái lập được |
| ADM-07 | P1 | Vận hành đa khu vực | Chính sách, lọc dữ liệu, timezone và quyền khu vực không hardcode Cần Thơ |

### 5.8. Commercial Tracking & Finance — COM

| ID | Ưu tiên | Yêu cầu | Acceptance criteria tối thiểu |
|---|---|---|---|
| COM-01 | P0 | Lưu version điều khoản hợp tác | Có merchant, khoảng hiệu lực, chargeable event definition, rate, caps, exclusions, ai duyệt |
| COM-02 | P0 | Phân biệt event theo độ chắc chắn | `impression`, `click`, `claim`, `redemption_verified`, `sale_confirmed` là event riêng; claim không tự thành sale |
| COM-03 | P0 | Attribution có quy tắc | Chỉ gán phí cho event hợp đồng cho phép; chống duplication và double billing; lưu bằng chứng/version quy tắc |
| COM-04 | P0 | Không tính phí conversion chưa xác minh | Đối soát phát hiện duplicate/dispute/reversal; tính toán có thể lập lại từ immutable event + adjustments |
| COM-05 | P1 | Statement và ghi nhận thanh toán thủ công | Admin duyệt bảng kê, xuất có snapshot/version, ghi nhận invoice status và bằng chứng thanh toán ngoài hệ thống |
| COM-06 | P1 | Merchant nhìn đúng chỉ số | Report phân biệt dự kiến/đã chốt, kỳ ghi nhận, trạng thái tranh chấp |

**Quy tắc tài chính:** phần mềm ghi nhận bằng chứng giao dịch thương mại; không tuyên bố là sổ cái kế toán pháp định hay thay thế quy trình phát hành hóa đơn/thuế. Trước public commercial operations cần được chuyên gia pháp lý/kế toán xác minh.

## 6. Mô hình trạng thái và bất biến nghiệp vụ

| Entity | State machine đề xuất | Bất biến quan trọng |
|---|---|---|
| `experience` | draft → review → published → paused/archived | event có thời gian bắt đầu/kết thúc; không public nếu không đủ bằng chứng |
| `offer` | draft → submitted → approved → published → paused/ended | mỗi điều khoản phát hành gắn version; hết hạn/quota không claim được |
| `voucher` | issued → redeemed / expired / void | không thể redeem hai lần; redemption gắn actor, venue, proof; reversal là event bù trừ |
| `mission_participation` | eligible → joined → pending_verification → verified / rejected / expired | việc nhận dấu phải có bằng chứng đáng tin, mỗi lần đủ điều kiện nhận một lần |
| `achievement_stamp` | granted (và nếu cần revoked with explicit record) | không tự bị mất vì campaign kết thúc, giải trình mọi thay đổi |
| `partner` | invited → pending_review → verified → suspended/closed | chỉ đối tác verified mới có live commercial offer |
| `dispute_case` | opened → investigating → resolved/rejected | resolution có actor, lý do, evidence refs |
| `statement` | draft → reviewed → approved → issued → paid/adjusted | không sửa ngầm statement đã khóa; điều chỉnh kỳ sau/issue revision có audit |

**Concurrency & safety:** tất cả claim, redeem, grant achievement và charge event có idempotency key / unique business constraint; MongoDB transaction hoặc atomic conditional write; test hai request đồng thời và request retry khi timeout. Lưu record thay đổi có dấu thời gian và actor. No stale idempotent retry may re-grant reward.

## 7. Data model khái niệm (chưa chốt MongoDB collection/schema)

| Bounded domain | Concept cần có | Dữ liệu tối thiểu/quan hệ nghiệp vụ |
|---|---|---|
| Identity | User, Session, PartnerMembership, Consent | account ID, role, merchant/location scope, consent/version |
| Catalog | Place, Experience, EventOccurrence, SourceEvidence | geo, time window, eligibility, editor/source, freshness, status |
| Outings | Outing, OutingItem, Trip, Revision, ShareLink | owner, selected stops, notes, version, public field projection |
| Offers | Offer, OfferTermsVersion, VoucherIssue, RedemptionAttempt, Redemption | merchant/location, window, unique code hash, status, proof refs |
| Missions | MissionRule, Participation, VerificationProof, AchievementStamp | rules, campaign, qualification, trusted evidence, uniqueness |
| Partner | Merchant, MerchantLocation, StaffAssignment, AgreementRef | approved owner, contact, scopes, contract validity |
| Commercial | AttributionEvent, ChargeableEvent, Statement, Adjustment | immutable evidence, rule/rate version, dispute, billing period |
| Operations | ReviewTask, SupportCase, AuditRecord, Job | actor, state, reason, request ID, status, SLA owner |
| Analytics | EventEnvelope, AggregatedMetric | pseudonymous actor, region, timestamp, funnel stage, consent |

**Dữ liệu nào là authoritative?** `redemption` do Offers/Redemption quyết định; `achievement_stamp` do Missions quyết định; `chargeable_event` do Commercial quyết định; analytics chỉ tổng hợp, không tự làm nguồn sự thật cho giao dịch. Không lưu lịch sử GPS chi tiết chỉ để tạo cảm giác app cá nhân hóa.

**Multi-region readiness:** stable region/location IDs, thời gian lưu nhất quán (UTC, trình bày giờ địa phương), merchant/promotion scope theo vùng; không dùng tên tỉnh thành làm khóa chính; dữ liệu mã địa giới theo phiên bản khi cần.

## 8. Non-functional requirements (NFR), trust & compliance

| ID | Hạng mục | Yêu cầu / tiêu chí kiểm tra |
|---|---|---|
| NFR-01 | Security & RBAC | Đánh giá threat model của claims/redemptions/admin actions; test IDOR, session expiry, brute force, stale role, replay và CSRF/CORS phù hợp |
| NFR-02 | Privacy & data minimization | Không tiết lộ thông tin định danh trên public share; định nghĩa retention, consent, account deletion/erasure và quyền truy cập phù hợp quy định trước launch |
| NFR-03 | Data integrity | Redeem một lần, idempotent retry, transaction/atomic update, immutable financial evidence, authorized compensating action |
| NFR-04 | Reliability | Readiness endpoint phải phản ánh product initialization thực sự; giám sát worker/job trạng thái; backup + restore drill có bằng chứng |
| NFR-05 | Performance | Đặt mục tiêu đo p95 trên thiết bị/mạng đại diện; không công bố SLA số trước khi có benchmark và ngân sách vận hành duyệt |
| NFR-06 | Offline/PWA | Offline reader chỉ dùng snapshot đã tải; claim/redeem/partner verification yêu cầu xác nhận server; iOS/Android install & reconnect được test |
| NFR-07 | Accessibility | Keyboard, contrast, focus, screen reader, hỗ trợ tiếng Việt, reduced motion, touch target, loading/error recovery |
| NFR-08 | Auditability | Các quyết định publish, revoke, redeem, reversal, statement phải có actor, timestamp, reason, correlation ID; bảo vệ PII trong log |
| NFR-09 | Catalog/content rights | Theo dõi nguồn, điều khoản, quyền sử dụng media; không sao chép/cache lại dữ liệu provider trái điều khoản |
| NFR-10 | Legal/finance readiness | Soát mô hình khuyến mại/điểm thưởng/thương mại điện tử, hóa đơn, bảo vệ dữ liệu và điều khoản đối tác trước go-live |

**Không phải giấy phép tự động:** PRD này không chứng nhận pháp lý; Legal/Finance owner phải xác nhận nghĩa vụ hiện hành theo cách kinh doanh thực tế.

## 9. Analytics, sự kiện và kinh tế đơn vị

### 9.1. Event taxonomy (proposed)

`discovery_view`, `search_submit`, `filter_apply`, `experience_view`, `experience_save`, `outing_create`, `outing_share`, `offer_view`, `offer_claim`, `voucher_issue`, `redemption_attempt`, `redemption_verified`, `redemption_rejected`, `mission_join`, `mission_verified`, `achievement_granted`, `merchant_report_view`, `support_case_opened`, `statement_approved`, `merchant_renewed`.

Mỗi sự kiện cần timestamp, anonymous/account actor phù hợp consent, region, event/experience/partner IDs nếu có, source/campaign, và event version. **Không thu thập lịch sử vị trí chính xác nếu không cần.** Events đo hành vi phải tách khỏi giao dịch authoritative.

### 9.2. Các phễu chính

1. **Discovery:** user tìm → xem chi tiết → save/share/claim; đo định kỳ theo nhóm local vs visiting traveler.
2. **Verified experience:** claim → redeem thành công → mission/achievement được cấp hợp lệ → quay lại.
3. **Merchant commerce:** offer launched → chargeable verified events → disputes/adjustments → statement approved → partner renewal.

### 9.3. Unit economics — trường dữ liệu, không bịa số

- `gross_partner_revenue`: campaign fee/commission **theo hợp đồng và sự kiện đã chốt**.
- `reward_cost`: chi phí phần thưởng thực chịu theo từng campaign, phân biệt do merchant vs GoEase tài trợ.
- `variable_processing_cost`: chi phí provider/đối soát/hỗ trợ có thể phân bổ.
- `contribution`: doanh thu ròng đủ điều kiện trừ chi phí biến đổi có liên quan (định nghĩa kế toán được duyệt).
- `CAC`: chi phí thu hút chia cho số người mua/được xác minh phù hợp định nghĩa.
- `partner_retention`: tỷ lệ partner tiếp tục chạy paid campaign hoặc gia hạn.

**Chưa chốt:** commission rate, ngưỡng hoà vốn, reward cap, yêu cầu hoàn tiền và phân bổ chi phí campaign. Các giá trị phải lấy từ hợp đồng/thử nghiệm, không hardcode vào sản phẩm.

## 10. Acceptance test scenarios — bản tối thiểu để nghiệm thu V1

| Test ID | Luồng | Given / When / Then |
|---|---|---|
| AT-01 | Guest discovery | Given user chưa login và catalog đã publish, when mở trang Cần Thơ/filter, then có kết quả phù hợp và mở detail được |
| AT-02 | Empty/unknown catalog | Given dữ liệu khu vực chưa đủ, when tìm theo điều kiện, then empty hoặc “Chưa xác minh” trung thực, không placeholder giả |
| AT-03 | Experience stale | Given event đã hết hạn theo giờ địa phương, when xem feed, then không hiện như upcoming hoặc khả dụng |
| AT-04 | Kèo draft persistence | Given nháp có 3 điểm, when quay về/sửa/thay ngày, then không mất dữ liệu âm thầm |
| AT-05 | Shared link privacy | Given kèo đã share, when khách chưa login mở link, then chỉ đọc được public fields; không lộ owner credentials/PII |
| AT-06 | OAuth & sessions | Given Google provider enabled, when login từ UI, then thành công; nhiều người login không bị chung bucket khóa nhầm |
| AT-07 | Offer approval | Given offer chưa duyệt, when guest/account truy cập, then không claim được; khi approved và active mới thấy claim |
| AT-08 | Concurrent claim | Given 1 account/offer giới hạn, when hai request claim đồng thời, then hệ thống chỉ phát hành theo limit, không trùng |
| AT-09 | Concurrent redemption | Given 1 code valid, when hai staff redeem đồng thời, then đúng một lần thành công, lần còn lại trả trạng thái đã dùng |
| AT-10 | Offline/timeout redemption | Given staff mất mạng sau submit, when chưa có kết quả xác thực, then UI không báo thành công; retry/check status không duplicate |
| AT-11 | Wrong location | Given voucher có địa điểm hợp lệ A, when staff B quét, then reject với thông báo an toàn |
| AT-12 | Mission duplicate | Given proof đã grant 1 dấu, when replay, then không cấp dấu/quà lần nữa |
| AT-13 | Mission expired | Given mission hết thời hạn, when submit proof mới, then reject đúng rule; achievement trước đó không tự mất |
| AT-14 | Admin reversal | Given redemption cần bù trừ, when admin đủ quyền ghi reason, then có correction event linked, case log, finance status cập nhật hợp lệ |
| AT-15 | Merchant isolation | Given staff merchant A, when truy cập URL/API merchant B, then bị từ chối, không lộ thống kê/voucher |
| AT-16 | Chargeable-event integrity | Given claim không redeem, when statement tổng hợp, then không tự tính phí redemption; chỉ event đủ contract rule mới vào bảng kê |
| AT-17 | Readiness | Given product initialization fail nhưng DB vẫn lên, when probe readiness, then cảnh báo không ready dù liveness có thể up |
| AT-18 | Worker disabled | Given enrichment worker tắt, when admin lên lịch job, then hệ thống chặn hoặc thể hiện blocked rõ, không báo job đang chạy thành công |
| AT-19 | PWA cached trip | Given user đã tải trip, when offline, then đọc được snapshot; không thể giả mạo đổi voucher offline |
| AT-20 | Guest/local vs distant visitor | Given hai intent khác nhau, when vào app, then local khám phá nhanh còn khách từ xa vẫn truy cập itinerary/planner mà không cần chuyển app |

**Bổ sung test:** unit for rules, MongoDB replica-set integration for transactions, Playwright E2E theo các luồng, mobile device acceptance (đặc biệt iOS Home Screen). CI phải thực sự chạy suite phù hợp; static audit chỉ ra hiện tại CI chưa bao gồm toàn bộ integration/browser suite.

## 11. Gap Analysis với repository GoEase (evidence từ audit, không phải runtime verification)

| Mảng V1 | Tình trạng trong audit | Action khuyến nghị | Issue/Finding liên quan |
|---|---|---|---|
| Auth | Session/OIDC có; thiếu UI Google; rate limit bucket chung | Repair & runtime test trước rollout | F04, F05 |
| Traveler trip & share | Có save/revision/share, nhưng UI quản lý draft có lỗi | Reuse persistence; new UX; repair draft loss | F02 |
| Explore | Có catalog UI/API; chỉ lấy 20 kết quả đầu | Reuse data; sửa pagination, guest paths | F01, F10, F11 |
| Planner | Có provider isolation, validation, nhưng ETA/giờ/chi phí giới hạn | Retain optional; validate Cần Thơ pilot; thêm cảnh báo thực tế | F06, F09 |
| Catalog admin | Có provenance/version/review/job ops | Preserve, simplify admin UX; kiểm soát publication/worker | F07, F08, F13 |
| PWA/offline | Có explicit download read-only | Reuse, device UAT & clear UX scope | Audit §6 |
| Reliability/CI | Health có thể false green; CI thiếu suites | Readiness fix, expand CI, restore test | F03, F12, F15 |
| Partner & commercial | Thiết kế có khái niệm, runtime chưa có | New domain & UI | Audit §3, §8 |
| Offers/redemption | Chưa có transactional workflow | New secure domain, staff portal, tests | Audit §3, §8 |
| Missions/Dấu ấn | Chưa có runtime | New gamification domain (non-cash first) | Audit §3, §8 |
| Notifications | UI hiện tại là fixed empty view | Replace with working V1-lite or remove until supported | Audit §3 |

**Quan trọng:** Audit đọc source ở commit `f14a8a1ab5a4` và working tree đã có thay đổi; chưa chạy scripts/tests/db. Những quyết định KEEP/REFACTOR/REBUILD chỉ là giả thuyết cho đến khi runtime test chứng minh.

## 12. Milestones và phụ thuộc nghiệp vụ

| Wave | Deliverable có thể demo | Điều kiện phải có |
|---|---|---|
| W0 — Baseline & approval | Runtime verification, risk list, PRD scope ký duyệt, UX IA/wireframe | Owner approve pilot & assigned operational owners |
| W1 — New UX Foundation & Discovery | Traveler shell + design system + catalog/experience detail real APIs | Có dữ liệu quyền dùng hợp lệ, verified cho nhóm Cần Thơ đầu tiên |
| W2 — Đi chơi | Kèo create/edit/share + existing planner đi từ UX mới | Lifecycle/source tests pass, không mất draft, user tasks pass |
| W3 — Merchant & Offer | Partner invite/roles + live offer + redeem once | Merchant pilot chấp thuận terms/validation SOP |
| W4 — Dấu ấn & Support | Mission rules, verified stamps, quà, support/reversal | Proof method và reward economics được duyệt |
| W5 — Commercial & Admin | Attribution, statement/export, admin queue/report | Ký hợp đồng thực tế/chargeable event definition |
| W6 — Closed Beta & Release | Security/device/UAT, backup restore, launch checklist | Owner & Merchant Ops sign-off, compliance verified |

**Không mặc định làm FE mock tất cả trước rồi mới làm backend.** Mỗi wave kết thúc bằng một vertical slice: UI → API → persistence → tests → logs → operational SOP. Cho phép xây design system và UX prototype rộng trước khi implement, nhưng production implementation phải chia theo luồng nghiệp vụ.

## 13. Những quyết định khách hàng phải chốt trước khi khóa PRD v1.0

| ID | Câu hỏi / quyết định | Người quyết định đề xuất | Ảnh hưởng |
|---|---|---|---|
| Q01 | Đối tác pilot loại gì: workshop, trải nghiệm có vé, hoạt động sinh thái, hay mix? | Client + Merchant Ops | Experience model, voucher, merchant UX |
| Q02 | Cần Thơ pilot khoanh khu vực nào; nguồn dữ liệu và người xác minh địa điểm? | Client + Catalog Ops | Catalog readiness, feed, routing |
| Q03 | Thu phí theo redeemed voucher, verified attendance, confirmed sale, hoặc chiến dịch tài trợ? | Client + Finance + Merchant Ops | Attribution, contract, statement, data model |
| Q04 | Ai tài trợ voucher và ai chịu lỗ khi thưởng gian lận? Hạn mức từng chiến dịch? | Client + Finance | Voucher economics, anti-fraud |
| Q05 | Staff xác minh bằng QR, code nhập tay, hay kết nối POS? | Merchant Ops + pilot merchant | Offline/error flow, UX/UI scanner |
| Q06 | Một merchant có nhiều chi nhánh/staff hay không? | Merchant Ops | Partner role and location scope |
| Q07 | Có xác nhận đặt suất trước ở V1 hay chỉ claim và sử dụng voucher khi đến? | Client + partners | Scope booking; điều kiện tham gia |
| Q08 | Ai xử lý dispute/reversal, SLA hỗ trợ và đối soát hóa đơn? | Client + Operations + Finance | Admin & manual workflow |
| Q09 | Tên tab **Dấu ấn** đã chốt; art direction “Contemporary Mekong Weekend” còn cần chọn concept cụ thể | Client + UX | Brand và design system |
| Q10 | Dữ liệu cá nhân, quảng cáo tài trợ, khuyến mại và quy trình thương mại có được pháp lý/thuế duyệt chưa? | Client + Legal/Accounting | Release gate |
| Q11 | Ai là Product Owner có quyền quyết định scope và nghiệm thu? | Client | Change control |
| Q12 | Mức chất lượng/hiệu năng/budget vận hành nào cần ký duyệt? | Client + Engineering | NFR/SLO targets |

## 14. Definition of Ready, Definition of Done, release gates

### 14.1. Definition of Ready cho từng feature

- Có business objective, role, nguyên tắc nghiệp vụ, dữ liệu/nguồn dữ liệu.
- Có UX flow và các trường hợp success/loading/empty/error/permission/offline.
- Có mô tả event đo lường, rủi ro, acceptance criteria và test data.
- Có chủ sở hữu quyết định, dependencies và phạm vi cụ thể.

### 14.2. Definition of Done cho Commercial V1 feature

- UI responsive hoạt động; no placeholder giả hoặc nút bấm không tác dụng.
- API/contracts validation + persistence + authorization được kiểm thử.
- Race/idempotency và error cases được xử lý nếu có business transaction.
- Log/audit/analytics đủ để vận hành và đo giá trị; không tiết lộ secrets/PII.
- Partner/admin có quy trình xử lý ngoại lệ, có SOP và owner chịu trách nhiệm.
- Trải qua unit/integration/E2E phù hợp, UAT với người dùng/đối tác; không có blocker P0/P1 chưa xử lý theo tiêu chí phát hành được duyệt.

### 14.3. Public launch gate (G0–G5)

- **G0:** Owner phê duyệt PRD, pilot supply/partner, cơ chế thu phí và trách nhiệm vận hành.
- **G1:** Runtime audit xác minh reuse, security baseline, dữ liệu và môi trường đại diện.
- **G2:** Prototype UX được người dùng đại diện và nhân viên đối tác thử task, các vấn đề nghiêm trọng được sửa.
- **G3:** V1 flows và UAT được ký duyệt; đổi mã đồng thời/timeout/reversal và PWA device tests pass.
- **G4:** Partner statement/attribution reconciles, legal/privacy/marketing disclosures được duyệt, monitoring/backup restore có bằng chứng.
- **G5:** Client chấp thuận public marketing; có đội ngũ vận hành, hỗ trợ và đối tác hoạt động thật.

## 15. Design handoff checklist (cho UX/UI và Codex)

**A. UX prototype cần có tối thiểu 6 hành trình có thể click:**

1. Guest tại Cần Thơ → tìm trải nghiệm hợp budget → detail → chia sẻ kèo.
2. Người dùng đã login → nhận offer → xem “Quà của tôi” → đưa mã tại quầy.
3. Merchant staff → quét QR hoặc nhập code → xác minh thành công / expired / used / timeout.
4. Traveler → join mission → có proof từ partner → thấy dấu trong “Dấu ấn”.
5. Admin → duyệt offer → theo dõi fraud/dispute → reversal có kiểm soát.
6. Khách từ xa → lên lịch trình nhiều ngày → sửa → lưu → chia sẻ → tải offline reader.

**B. Mỗi màn hình cần bản desktop/mobile hợp lý và trạng thái:** default, loading, empty, error, permission denied, offline (nếu áp dụng), completed/expired/canceled (nếu là commerce), reduced-motion.

**C. Integration handoff:** giữ public contract/server semantics đã được kiểm chứng, định nghĩa versioned API cho domain mới; có trace FR ID ↔ design screen ↔ API ↔ test; không giao Codex yêu cầu “rewrite full UI” trong một task không có acceptance.

---

## Appendix — Glossary dành cho chủ dự án non-tech

- **Kèo:** nhóm địa điểm/hoạt động được lưu để dễ quyết định đi chơi và chia sẻ; không tự tạo một booking.
- **Trải nghiệm:** một hoạt động thật do địa điểm/đối tác tổ chức; có thể có lịch/giá/điều kiện.
- **Ưu đãi (Offer):** điều khoản quyền lợi được duyệt; **Voucher:** mã cụ thể cấp cho người đủ điều kiện.
- **Claim:** người dùng nhận voucher; **Redemption:** đối tác xác minh voucher đã được sử dụng; **Confirmed Sale:** giao dịch thương mại có bằng chứng riêng nếu áp dụng.
- **Dấu ấn:** khu vực nhiệm vụ, dấu thành tựu và quyền lợi của người dùng; không tự đồng nghĩa GPS tracking hoặc tài sản tiền tệ.
- **Achievement Stamp:** dấu kỷ niệm phi tiền tệ; khác điểm thưởng có thể quy đổi.
- **Commercial V1:** tất cả các luồng ĐÃ CHỌN hoạt động trọn vẹn và được nghiệm thu; không phải toàn bộ ý tưởng nền tảng tương lai.

**Versioning:** PRD v0.4 là bản đủ để review và tách UX task/deep audit. Chỉ nâng lên PRD v1.0 sau owner sign-off các điểm Q01–Q12 có ảnh hưởng scope. Mọi thay đổi sau đó cần change request: tác động lên luồng, tài chính, pháp lý, schema, UI, test và roadmap.
