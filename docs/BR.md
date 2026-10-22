# GoEase — BR v0.2 / Baseline thiết kế hiện hành

Ngày thiết kế: **22/10/2026**. Repository: `nyanduong/goease-pwa`. Nền source đã đối chiếu: `685552e549a474bc300d361c9343a82c3a7c181b`.

**Trạng thái:** Baseline thiết kế v0.2 được chấp thuận trong F1-A. Task sản phẩm sau F1-B đã triển khai tài khoản local và lịch trình thủ công; xem [phạm vi và nghiệm thu](PRODUCT-VERIFICATION.md). Các module còn lại vẫn là thiết kế, không phải tính năng đã chạy. F1-B đã triển khai phần kỹ thuật context/log/audit probe test-only, xem [bằng chứng](F1-B-VERIFICATION.md); không đồng nghĩa auth/trip hoặc audit production đã hoàn thành. Quyết định ở mục 1 đã xác nhận; policy ghi đề xuất/cần duyệt vẫn còn mở. Đây là nguồn nghiệp vụ chính; [bản nhập lưu trữ](archive/BR-v0.2-draft.md) chỉ để tham chiếu.

Đọc cùng [DB baseline](DB-BASELINE.md), [truy vết](DATA-TRACEABILITY.md), [bàn giao/review](F1-HANDOFF.md) và [registry](collection-registry.json). F0 đã có health/tooling; xem [bằng chứng lịch sử](F0-VERIFICATION.md).

## 1. Quyết định đã được người dùng xác nhận

Viết mới hoàn toàn; React/Vite/TypeScript/Tailwind; Express/TypeScript; MongoDB local + Mongoose rồi mới Atlas; **npm**, một `package-lock.json`; chạy `npm run dev`; web/API dùng **localhost**; làm trên `main`; **Google và email/mật khẩu**; PWA trước, API dùng lại cho mobile sau; hướng nền tảng du lịch như ChillGo; cần audit, truy vết và dữ liệu hỗ trợ phân tích/cá nhân hóa.

Phần còn lại thuộc **baseline thiết kế đã chấp thuận**, phân kỳ triển khai; các policy được đánh dấu đề xuất/cần duyệt chưa trở thành chính sách phát hành. Phương thức đăng nhập không còn là câu hỏi mở. Chính sách quyền khách, chia sẻ, hoàn tiền, quota, giới hạn và phương thức đặt dịch vụ bên dưới chưa được suy diễn là đã duyệt.

## 2. Mục tiêu và phạm vi sản phẩm

Người dùng khám phá → lập lịch theo nhu cầu → sửa và lưu → tìm dịch vụ phù hợp → gửi yêu cầu hoặc đặt dịch vụ/thu phí khi tích hợp đủ điều kiện → xem và quản lý sau chuyến đi. GoEase lưu dữ liệu có chủ sở hữu, nguồn gốc, lịch sử và mục đích xử lý rõ ràng.

| Lớp triển khai đề xuất | Phạm vi                                                                                                 | Ý nghĩa                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| F1 nền dữ liệu         | Identity, ownership, metadata, audit, migration, privacy                                                | Thiết kế và thực thi các nền tảng dùng ngay; không sinh toàn bộ marketplace |
| CORE                   | Khám phá, AI planner, sửa/lưu/mở lại, ngân sách dự kiến, tài khoản                                      | Một hành trình sản phẩm hoạt động thật                                      |
| PLATFORM               | Yêu thích, chia sẻ, cẩm nang/blog, review, đối tác, hướng dẫn viên, thông báo, hỗ trợ, chi tiêu thực tế | Mở rộng trải nghiệm nền tảng                                                |
| COMMERCE               | Gói trả phí, đơn hàng, payment, refund, promotion, entitlement, booking tích hợp                        | Chỉ kích hoạt khi quy tắc giá/nhà cung cấp/trách nhiệm đã rõ                |
| CONDITIONAL            | Tồn chỗ tự quản, thanh toán định kỳ, chia tiền/chi trả đối tác                                          | Thiết kế mở rộng có điều kiện; không mặc định là phạm vi ngày 23/10         |

Đây là phân kỳ, **không xóa booking, khách sạn, vé máy bay hoặc local guides khỏi hướng sản phẩm**. Tuy nhiên, nút dẫn sang đối tác, yêu cầu liên hệ, báo giá, giữ chỗ và xác nhận đặt chỗ là những hành vi khác nhau. Không tuyên bố có tính năng đặt thật chỉ vì đã có UI hoặc collection.

## 3. Vai trò và phạm vi quyền

| Vai trò          | Quyền đề xuất                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Guest            | Xem nội dung đã xuất bản; xem link chia sẻ còn hiệu lực; không đọc dữ liệu riêng hoặc gọi AI tốn phí không kiểm soát |
| Traveler         | Quản lý tài khoản/chuyến của mình; dùng AI theo quota; yêu thích; gửi yêu cầu; thanh toán; quản lý privacy           |
| Partner member   | Chỉ dữ liệu listing/inquiry/booking của đối tác mà mình có membership hợp lệ; không xem toàn bộ trip/hành vi khách   |
| Content editor   | Quản lý nội dung công khai trong phạm vi được cấp                                                                    |
| Support          | Xem lượng dữ liệu tối thiểu để xử lý ticket; xem trip riêng chỉ khi có căn cứ hỗ trợ và quyền cụ thể                 |
| Finance operator | Đối soát/thao tác tài chính được cấp; không tự cấp role và không sửa lịch sử thanh toán                              |
| Admin            | Quản lý phân quyền/configuration; truy cập nhạy cảm và export đều có audit; không có quyền bỏ qua audit              |

Backend xác định actor từ phiên đã xác thực. Role không lấy từ request client. Partner permissions dựa trên membership, không chỉ một role `partner`. Không tự đăng ký thành admin hoặc tự duyệt partner.

## 4. Các quy tắc nghiệp vụ

### A. Tài khoản, xác thực và quyền

| Mã      | Quy tắc                             | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                            |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Một User nội bộ, hai cách đăng nhập | Tài khoản có `_id` ổn định; password và Google là identity có thể liên kết. Không tạo hai hồ sơ chỉ vì đăng nhập bằng hai nút.                                                                                       |
| AUTH-02 | Liên kết an toàn                    | Không tự merge chỉ do cùng email. Phải chứng minh quyền với tài khoản hiện tại và identity mới, có re-auth; identity đã thuộc user khác bị từ chối. Google dùng issuer + sub đã xác minh [S9].                       |
| AUTH-03 | Email và mật khẩu                   | Email/password cho phép dùng account và chuyến riêng ngay sau khi xác thực mật khẩu; `emailVerifiedAt` vẫn null cho đến flow xác minh thật. Email chưa xác minh không được dùng để merge/link account hoặc cấp quyền đặc biệt. Mật khẩu hash Argon2id, không plaintext/giải mã; không log kể cả hash [S8]. |
| AUTH-04 | Vòng đời phiên                      | Logout thu hồi phiên hiện tại; logout-all/khóa tài khoản/đổi mật khẩu theo chính sách thu hồi phiên. Kiểm tra expiresAt, idleExpiresAt và revokedAt ở mỗi lần xác thực; TTL không thay kiểm tra hết hạn.             |
| AUTH-05 | Quyền khách — đề xuất               | Khách xem discovery và nội dung công khai. Tạo/lưu trip trên server, gọi AI cá nhân hóa và gửi yêu cầu có định danh yêu cầu đăng nhập; form nháp trước login chỉ nằm tại thiết bị và không tự nhập vào account khác. |
| AUTH-06 | Khóa và xóa account                 | Suspended không đăng nhập/giao dịch mới. Xóa account thu hồi phiên và share links ngay, không chỉ ẩn UI. Xử lý booking/refund đang mở và dữ liệu buộc giữ riêng với dữ liệu cần xóa.                                 |
| AUTH-07 | Chống lạm dụng                      | Đăng nhập, reset, xác minh và AI có hạn mức tại server. Reset response không tiết lộ email tồn tại. Token reset dùng một lần, lưu hash, có hạn dùng.                                                                 |
| AUTH-08 | Nguyên tắc quyền                    | Mọi read/update/delete/export kiểm tra quyền. Request không được tự đặt ownerId, roles, createdBy, revision, status paid hoặc thời gian audit.                                                                       |

### B. Danh mục, nguồn dữ liệu và nội dung

| Mã     | Quy tắc                        | Yêu cầu kiểm tra/thiết kế                                                                                                                                                         |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 | Phân biệt điểm đến và địa điểm | Destination là khu vực/chặng; Place là một POI/nhà hàng/điểm tham quan. ID nội bộ ổn định; nguồn ngoài có provider + externalId.                                                  |
| CAT-02 | Nguồn và quyền sử dụng         | Mỗi dữ liệu bên ngoài có fetchedAt, nguồn, điều kiện lưu/cache/reuse và thời điểm hết quyền lưu nếu có. Không mặc định SerpApi hay một API cho phép lưu vĩnh viễn mọi ảnh/review. |
| CAT-03 | Dữ liệu không biết             | Giờ mở cửa, giá, tọa độ thiếu phải thể hiện chưa biết. Không suy ra miễn phí từ giá null. Không phát minh review hoặc nhãn đã xác minh.                                           |
| CAT-04 | Cập nhật danh mục              | Ngừng xuất bản địa điểm không tự viết lại lịch cũ. Trip dùng snapshot hợp lệ tại thời điểm chọn; nếu có yêu cầu xóa theo quyền dữ liệu, áp dụng redaction có kiểm soát.           |
| CAT-05 | Xuất bản                       | Chỉ published + chưa xóa được hiển thị công khai. Draft/rejected/archived không lọt vào search, favorites hydrate hoặc link chi tiết.                                             |
| CAT-06 | Ảnh và upload                  | Ảnh có owner/source/license. Upload giới hạn kích thước/định dạng, kiểm tra nội dung phù hợp, private file truy cập có thời hạn. Không nhét binary/base64 vào trip.               |

### C. Lịch trình, ngân sách và cộng tác

| Mã      | Quy tắc                | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                                 |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRIP-01 | Định danh và ownership | Trip có ownerId; mặc định private. API luôn kiểm tra quyền và deletedAt. Khôi phục/chuyển quyền cần quy trình riêng, không nhận mass assignment.                                                                          |
| TRIP-02 | Ngày và múi giờ        | Ngày hành trình lưu YYYY-MM-DD; mỗi chặng/ngày có timezone IANA. Thời điểm hệ thống lưu UTC; không biến date-only thành nửa đêm UTC rồi làm lệch ngày.                                                                    |
| TRIP-03 | Phạm vi chặng          | Schema dùng destinations[] có thứ tự để mở rộng nhiều chặng. UI phát hành đầu có thể chỉ cho một điểm đến; giới hạn số chặng/ngày/người là config đã duyệt, không bịa thêm hạn chế sản phẩm.                              |
| TRIP-04 | Input                  | Ngày kết thúc không trước ngày bắt đầu; số người nguyên dương; tiền hợp lệ theo currency; các sở thích lấy taxonomy kiểm soát. Sửa số người/ngày phải kiểm tra lại lịch và chi phí.                                       |
| TRIP-05 | Cấu trúc ngày          | Day và activity có ID ổn định. Không dùng index mảng làm danh tính. Activities nhúng có giới hạn; sửa thứ tự không đổi ID, không lặp activity ID trong cùng trip.                                                         |
| TRIP-06 | Lịch thời gian         | Khoảng giờ có start/end hợp lệ; cảnh báo xung đột, thời gian di chuyển và mở cửa chưa chắc chắn. Không trình bày heuristic khoảng cách là thời gian đi đường chính xác.                                                   |
| TRIP-07 | Ngân sách              | Đề xuất ngân sách đầu vào là tổng nhóm, VND cho bản đầu. Cost có cơ sở tính group_total/per_person/per_unit và quantity rõ. Tổng tiền do server tính, không nhân số người hai lần.                                        |
| TRIP-08 | Ước tính và thực chi   | Budget, estimated cost và expense thực tế là ba thứ khác nhau. Hiển thị knownSubtotal + missingCostCount; thiếu dữ liệu không được báo chắc chắn đủ ngân sách.                                                            |
| TRIP-09 | Lưu và xung đột        | Lưu thành công nghĩa server commit. Client gửi expectedRevision; thay đổi cũ gặp revision mới trả 409 và giữ nháp. Cùng idempotency key cùng payload không tạo trùng.                                                     |
| TRIP-10 | Lịch sử và phục hồi    | Lưu revision tại thay đổi có ý nghĩa; phục hồi tạo revision mới, không sửa/xóa bản lịch sử. Không tạo revision cho mỗi phím gõ hoặc giữ lịch sử trong mảng vô hạn.                                                        |
| TRIP-11 | Chia sẻ                | Share link chỉ đọc, token random lưu hash, có revoke/expiry; không chứa email, ghi chú riêng, dữ liệu thanh toán. Collaborator editor dùng account và quyền riêng; link đọc không đồng nghĩa quyền sửa.                   |
| TRIP-12 | Xóa và restore         | Xóa mềm làm mất khả năng truy cập bình thường và vô hiệu hóa public link; restore không tự kích hoạt lại link. Purge sau thời hạn áp dụng cả revisions, media riêng, drafts server và các bản dẫn xuất thuộc phạm vi xóa. |
| TRIP-13 | Chi tiêu               | Expense gắn trip và người ghi; tiền là tổng khoản chi. Nhật ký chi tiêu không phải ví, chuyển khoản hoặc bằng chứng đã thanh toán qua GoEase.                                                                             |

### D. AI planner và hạn mức

| Mã    | Quy tắc              | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                           |
| ----- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-01 | AI có nguồn          | Planner nhận ràng buộc và tập địa điểm được phép. Đầu ra validate cấu trúc, IDs, ngày, thứ tự và các BR trước khi cho lưu.                                                                          |
| AI-02 | Không giả thành công | Phân biệt generationMode ai/rule_based/manual/template. Provider lỗi không gắn nhãn AI thành công; fallback được thông báo rõ.                                                                      |
| AI-03 | Không ghi đè         | Generate/regenerate tạo đề xuất; chỉ thay lịch khi người dùng xác nhận. Người dùng sửa trip trong lúc AI chạy thì apply kiểm tra expectedRevision.                                                  |
| AI-04 | Truy vết chất lượng  | Mỗi aiRun có requestId, userId, tripId khi có, model/promptVersion/plannerVersion, input tóm tắt, nguồn, thời gian, quota usage và lỗi đã làm sạch.                                                 |
| AI-05 | Quota đồng thời      | Giữ lượt nguyên tử trước gọi AI; release/consume theo trạng thái đã định. Không để nhiều request cùng vượt quota. Provider response không rõ trạng thái phải có reconciliation; không retry vô hạn. |
| AI-06 | Dữ liệu gửi AI       | Chỉ gửi dữ liệu cần lập lịch. Không gửi email/password/payment details; free text được xử lý có giới hạn. Đồng ý dùng AI không phải đồng ý dùng dữ liệu huấn luyện model.                           |
| AI-07 | Hiệu quả gợi ý       | Theo dõi impression → chọn/thay/xóa → lưu với recommendationId, modelVersion và rank. Không chỉ ghi click rồi suy ra chất lượng model.                                                              |

### E. Nội dung cộng đồng, yêu thích và kiểm duyệt

| Mã         | Quy tắc       | Yêu cầu kiểm tra/thiết kế                                                                                                                                 |
| ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CONTENT-01 | Blog/cẩm nang | Trạng thái draft → in_review → published; reject trả lý do; archive gỡ công khai. Quyền tự xuất bản của traveler là tính năng cần bật riêng.              |
| CONTENT-02 | Favorites     | Một user chỉ có một quan hệ yêu thích cho cùng target. Target bị gỡ không lộ nội dung private qua favorite.                                               |
| CONTENT-03 | Review        | Chỉ tác giả sửa review; kiểm duyệt lưu lý do. Verified booking chỉ cấp khi server kiểm chứng booking đủ điều kiện; rating tổng chỉ tính review published. |
| CONTENT-04 | Report        | Người dùng báo cáo nội dung; admin/đội kiểm duyệt quyết định theo quyền. Không xóa im lặng review bất lợi; lịch sử xử lý có audit.                        |

### F. Hướng dẫn viên, đối tác, khách sạn và vé máy bay

| Mã         | Quy tắc                                | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                      |
| ---------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SERVICE-01 | Đối tác                                | Partner có trạng thái xét duyệt riêng với account. Chỉ membership active được xử lý dịch vụ của partner đó; user không tự sửa verificationStatus.                                                              |
| SERVICE-02 | Phương thức cung cấp                   | Listing ghi rõ fulfillmentMode referral/inquiry/manual_booking/provider_api. Hotel/flight có thể hiện diện ở chế độ referral trước; referral click không tạo booking confirmed.                                |
| SERVICE-03 | Inquiry                                | Inquiry new → acknowledged → quoted → closed/rejected/cancelled. Quote có expiry và snapshot giá/điều kiện. Inquiry được chấp nhận liên hệ không phải đặt chỗ thành công.                                      |
| SERVICE-04 | Booking                                | Booking requested → pending_confirmation → confirmed → completed; declined/cancelled/expired là nhánh có điều kiện. Chỉ xác nhận khi có chấp thuận hợp lệ từ đối tác/provider và điều kiện thanh toán đã thỏa. |
| SERVICE-05 | Giữ chỗ                                | Không tự quản tồn chỗ trong database nếu không có giao thức tồn chỗ thực. Với slot GoEase quản lý phải có atomic hold/confirm/release; unique index theo startAt không đủ chống mọi khoảng giờ chồng lấp.      |
| SERVICE-06 | Giá và khách                           | Snapshot quote/cancellation policy tại lúc đặt; reprice trước thanh toán nếu báo giá hết hạn. Chỉ thu thập hành khách/giấy tờ khi provider bắt buộc và đã có schema bảo vệ riêng.                              |
| SERVICE-07 | Booking không phụ thuộc trip chỉnh sửa | Đổi/xóa trip không tự hủy booking hoặc hoàn tiền. Giao diện cảnh báo và dẫn tới quy trình hủy riêng.                                                                                                           |
| SERVICE-08 | Ngừng dịch vụ                          | Tắt listing không xóa booking đang thực hiện. Partner phải xử lý các nghĩa vụ còn tồn tại trước khi ngừng toàn bộ.                                                                                             |

### G. Đơn hàng, thanh toán và thương mại

| Mã     | Quy tắc                           | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                    |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| COM-01 | Đơn bất biến về giá sau phát hành | Server định giá từ product/quote; order lưu từng line item, currency, giảm giá, phí và điều kiện. Không đọc giá mới trong catalog để viết lại lịch sử.                                                       |
| COM-02 | Tách trạng thái                   | Order, Payment, Booking và Entitlement là thực thể riêng. Paid không tự có nghĩa booking confirmed; payment pending không cấp quyền.                                                                         |
| COM-03 | Thông báo thanh toán              | Xác minh chữ ký/provider, merchant, mã đơn, amount và currency. Redirect trình duyệt không là nguồn xác nhận duy nhất. Webhook duplicate/out-of-order được xử lý an toàn [S10,S11].                          |
| COM-04 | Atomic fulfillment                | Ghi nhận payment thành công, tổng order, cấp entitlement và audit/outbox trong transaction phù hợp; unique business key chống cấp quyền hai lần. Không gọi API thanh toán trong transaction có thể tự retry. |
| COM-05 | Tiền không biến mất               | Timeout không tự coi thất bại; poll/reconcile. Thanh toán đến sau expiry đưa vào luồng xử lý/hoàn tiền, không giữ tiền mà không cấp dịch vụ hoặc ghi nhận.                                                   |
| COM-06 | Refund                            | Tổng refund đã thành công và đang giữ chỗ không vượt tiền đã nhận. Kiểm soát concurrent refund; có requested/processing/succeeded/failed/cancelled. Điều chỉnh là bản ghi bù, không xóa payment cũ.          |
| COM-07 | Promotions                        | Mã giảm giá có scope, điều kiện, hạn dùng, ngân sách/lượt toàn cục và theo user; reserve/redeem/release nguyên tử. Client không tự đặt số giảm.                                                              |
| COM-08 | Entitlement                       | Quyền sử dụng gắn nguồn orderLine/payment và thời gian/usage; check server, có revoke/expire. Không dùng mỗi users.isPremium để biểu diễn mọi gói.                                                           |
| COM-09 | Không ghi nhận doanh thu giả      | GMV/tiền thu hộ/hoàn tiền/phí hoa hồng/doanh thu GoEase là các khái niệm khác nhau. Click partner chỉ là referral, chưa là commission earned.                                                                |
| COM-10 | Chia tiền về sau                  | Ví, số dư, payout cho đối tác cần ledger double-entry, đối soát và review riêng. Không thêm balance vào user để thay thế sổ giao dịch.                                                                       |

### H. Truy vết, quyền riêng tư và vận hành

| Mã      | Quy tắc                  | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                             |
| ------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATA-01 | Metadata                 | Entity có thể sửa dùng createdAt/updatedAt; entity có thể xóa mềm dùng deletedAt/deletedBy; backend gán actor. schemaVersion khác revision.                                                           |
| DATA-02 | Audit                    | Hành động nhạy cảm ghi ai/làm gì/với entity nào/khi nào/kết quả/reason/requestId/changedFields an toàn; không dựa vào updatedAt để dựng lịch sử.                                                      |
| DATA-03 | Tính nguyên tử của audit | Các mutation cần truy vết phải commit cùng audit hoặc outbox đảm bảo audit; thất bại ghi audit không được im lặng trả success. Auth failed ghi ở kênh riêng ngoài transaction bị rollback.            |
| DATA-04 | Append-only có kiểm soát | Audit không có API sửa/xóa thông thường. Quyền DB ứng dụng bị giới hạn; DBA/migration vẫn có khả năng thay dữ liệu nên cần kiểm soát truy cập và vận hành, không tuyên bố tamper-proof chỉ từ schema. |
| DATA-05 | Analytics khác audit     | Event client hỗ trợ phân tích, có thể bị giả; server xác nhận tạo trip/payment/conversion. Dedupe, eventVersion, môi trường và consent snapshot bắt buộc theo taxonomy.                               |
| DATA-06 | Purpose limitation       | Thu thập từng nhóm dữ liệu có mục đích, quyền truy cập, thời hạn và cơ chế xóa/rút lại. Optional analytics/marketing không phải điều kiện để lưu trip. Không lưu dữ liệu chỉ vì có thể cần sau này.   |
| DATA-07 | Không log bí mật         | Không log passwords/hashes/tokens/cookies/connection strings/giấy tờ/thẻ/nguyên body request hoặc prompt tùy ý. Redact theo allowlist [S7].                                                           |
| DATA-08 | Xóa dữ liệu              | Soft delete là cơ chế vận hành, không đồng nghĩa xóa dữ liệu cá nhân. Xóa account cần policy cho linked data, revisions, analytics, backups, vendor exports và dữ liệu phải giữ theo căn cứ phù hợp.  |
| DATA-09 | Retention                | Mỗi lớp có retention đề xuất rõ; tài chính không tự đặt TTL. TTL session/token không thay validation expiresAt [S5]. Không giữ mọi log vĩnh viễn.                                                     |
| DATA-10 | Mobile/PWA               | API contracts không phụ thuộc DOM/Mongoose. Mobile tương lai dùng cùng account/ownership. Private offline cache phải theo owner và logout policy; không suy ra đã hỗ trợ offline chỉ từ PWA shell.    |
| DATA-11 | Migration                | Đổi schema có migration versioned và kiểm thử dữ liệu cũ; không drop database để đổi model. Không bật required mới trước khi backfill/compatibility sẵn sàng.                                         |
| DATA-12 | Thông báo và hỗ trợ      | Thông báo delivery/read có trạng thái; support chỉ dữ liệu cần thiết. Outbox retry có idempotency; notification thất bại không làm thất lạc order đã thanh toán.                                      |

## 5. State machines tối thiểu

- User email/password mới: `active` với `emailVerifiedAt=null`; trạng thái sử dụng account độc lập với xác minh email. Legacy `pending_verification` password account chỉ chuyển `active` sau khi xác thực đúng mật khẩu và kiểm tra chưa khóa/xóa; email vẫn chưa xác minh. Các trạng thái suspended/deletion_pending/anonymized vẫn chặn đăng nhập.
- Trip: `draft → planned → completed`, có `archived`; deletedAt là vòng đời khác. Trạng thái này do user/hành vi đã duyệt, không đoán user đã đi thực tế từ ngày lịch.
- AI run: `queued → running → succeeded | failed | cancelled`; một kết quả chỉ được apply vào trip đúng revision.
- Booking: `requested → pending_confirmation → confirmed → completed`; `declined`, `expired`, `cancelled` theo transition hợp lệ.
- Order: `pending_payment → paid → fulfilled`; `expired/cancelled` chỉ trước thanh toán; `partially_refunded/refunded` sau xác nhận refund. Phản hồi muộn phải đối soát.
- Payment: `created → pending → succeeded | failed | expired`; `unknown` cần reconciliation, không cho webhook cũ làm succeeded thành failed. Refund theo collection riêng.
- Content: `draft → in_review → published → archived`; `rejected` quay lại sửa thành draft theo quyền.
- Privacy request: `received → identity_verified → processing → completed | partially_completed | rejected`; lưu phạm vi/căn cứ xử lý, không log nội dung riêng tư dư thừa.

## 6. Những thông số còn phải duyệt trước khi bật tính năng

Các tham số này không làm dừng việc thiết kế chung nhưng không được agent tự coi là yêu cầu đã chốt:

| Quyết định          | Đề xuất làm việc                                            | Điểm phải xác nhận trước phát hành                                    |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Quyền guest         | Xem công khai; login để tạo/lưu server và gọi AI            | Có cần guest AI quota/draft sync không?                               |
| Giới hạn chuyến     | Schema nhiều chặng; cấu hình giới hạn ngày/người/activities | Giới hạn theo UX, kích thước và chi phí provider                      |
| Tích hợp dữ liệu/AI | Adapter độc lập, mỗi nhu cầu một provider đầu tiên          | Provider, model, quyền lưu dữ liệu, ngân sách và quota                |
| Thu tiền            | Product/order/payment tách nhau                             | Bán gói AI, phí dịch vụ hay thu hộ; đơn vị pháp lý; currency; invoice |
| Booking             | Referral/inquiry trước khi đủ provider                      | Dịch vụ nào đặt thật, ai xác nhận, refund/cancellation                |
| Nội dung cộng đồng  | Editor xuất bản; user gửi duyệt                             | Moderation policy và thời gian xử lý                                  |
| Retention           | Theo DATA-TRACEABILITY, thời hạn là đề xuất                 | Rà soát pháp lý và chi phí, nhu cầu thực tế                           |
| Dữ liệu trẻ em      | Không tự mở flow trẻ em                                     | Cơ chế tuổi/đại diện theo nghĩa vụ áp dụng trước khi nhắm nhóm này    |

Không hứa hoàn thiện toàn bộ PLATFORM/COMMERCE trước ngày 23/10 chỉ vì đã có mô hình dữ liệu.

## 7. Acceptance xuyên suốt

1. Hai phương thức login quy về đúng account; account linking sai không chiếm được tài khoản khác.
2. User B không đọc/sửa/xóa/export trip A hoặc dùng share revoked/expired.
3. Sửa trip tạo revision/audit đúng; request lặp không nhân bản; concurrent edit báo 409.
4. Tắt DB giữa transaction không để trip đã đổi mà audit thiếu; không trả success giả.
5. AI failure không mất input; apply vào revision cũ bị chặn; không bịa nguồn/giá đã xác minh.
6. Tạo/hủy/restore không để dữ liệu xóa mềm lọt search, populate, analytics export hoặc public share.
7. Không có password/token/full email/notes tùy ý trong logs và analytics.
8. Thanh toán trùng/đảo thứ tự/sai amount không cấp quyền sai; refund concurrent không vượt tiền thu.
9. Analytics có taxonomy và consent, dedupe; test/demo không vào KPI production.
10. Dữ liệu cũ đọc được qua thay đổi schema; migration chạy lại an toàn và có backup/rollback plan.

## Nguồn kỹ thuật và pháp lý đã đối chiếu

- [S5] MongoDB — TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- [S7] OWASP — Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- [S8] OWASP — Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- [S9] Google — OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- [S10] MoMo — Payment Notification: https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/
- [S11] Stripe — Webhooks: https://docs.stripe.com/webhooks
- [S12] Công báo Chính phủ — Luật 91/2025/QH15: https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578/57730.htm

Các cấu trúc, trạng thái và mức retention trong bộ tài liệu là thiết kế đề xuất của GoEase, không phải yêu cầu nguyên văn của các nguồn. Ngày đối chiếu: 22/10/2026.

## 8. Đối chiếu BR v0.1 — mã cũ tiếp tục có hiệu lực tham chiếu

Giữ toàn bộ BR-01–BR-10 và tiêu chí gốc để API/schema/tests cũ có thể liên kết. Khi diễn giải chi tiết dùng mã v0.2 tương ứng; không có yêu cầu cũ nào bị loại bỏ âm thầm.

| Mã    | Quy tắc                                                                  | Tiêu chí kiểm tra                                                                                                 |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| BR-01 | Đầu vào chuyến đi phải hợp lệ theo ngày, số người, ngân sách và điểm đến | Dữ liệu sai bị từ chối ở server với lỗi dễ hiểu; không chỉ kiểm tra trên giao diện                                |
| BR-02 | Việc tạo lịch phải sử dụng thông tin người dùng đã nhập                  | Request thực tế gửi đến planner chứa đúng ràng buộc; đầu ra được kiểm tra cấu trúc và tính nhất quán nghiệp vụ    |
| BR-03 | Chi phí/gợi ý không có xác nhận đặt dịch vụ được thể hiện là ước tính    | Không trình bày giá ước tính hoặc gợi ý AI thành giá đã xác nhận hay chỗ đã đặt                                   |
| BR-04 | Bản đã lưu phải khôi phục được từ database                               | Sau reload/restart server, đọc lại qua API được nội dung đã lưu; không chỉ tồn tại trong state trình duyệt        |
| BR-05 | Quyền đọc/sửa/xóa dữ liệu riêng do server thực thi                       | Tài khoản B không thể đọc/sửa/xóa trip riêng của A bằng cách đổi ID                                               |
| BR-06 | Sửa itinerary không sửa lịch sử đơn hàng/thanh toán                      | Khi có commerce, order giữ snapshot giá và điều khoản tại thời điểm đặt                                           |
| BR-07 | Lỗi nhà cung cấp không được báo thành công                               | Giữ đầu vào để thử lại; phân biệt dữ liệu mẫu, dữ liệu được tuyển chọn và kết quả gọi dịch vụ thật                |
| BR-08 | Một thao tác lưu không được âm thầm ghi đè thay đổi mới hơn              | Khi có nguy cơ cập nhật đồng thời, kiểm tra version và báo xung đột phù hợp                                       |
| BR-09 | Quyền admin được kiểm tra tại API nếu có chức năng quản trị              | Ẩn nút trên UI không được coi là kiểm soát quyền                                                                  |
| BR-10 | Phạm vi offline được mô tả cụ thể                                        | Bản đầu đề xuất có màn hình offline rõ ràng; tạo lịch AI/tìm dữ liệu online không được hứa hoạt động khi mất mạng |

| Mã cũ | Quy tắc chi tiết v0.2       |
| ----- | --------------------------- |
| BR-01 | TRIP-02, TRIP-03, TRIP-04   |
| BR-02 | AI-01, AI-03                |
| BR-03 | TRIP-08, CAT-03, SERVICE-02 |
| BR-04 | TRIP-09, TRIP-10            |
| BR-05 | AUTH-08, TRIP-01            |
| BR-06 | SERVICE-07, COM-01, COM-02  |
| BR-07 | AI-02, AI-03                |
| BR-08 | TRIP-09                     |
| BR-09 | AUTH-08, DATA-02            |
| BR-10 | DATA-10                     |

Giữ mục tiêu người đi tự túc Việt Nam/cá nhân/nhóm nhỏ như giả thuyết, không giới hạn thị trường đã duyệt. Luồng khám phá → nhập nhu cầu → tạo → xem theo ngày/chi phí → sửa → lưu → reload/mở lại vẫn là luồng tham chiếu. Snapshot địa điểm giữ theo quyền nguồn; commerce và mobile giữ hướng phát triển theo mục 2. Nội dung ChillGo chỉ là tham khảo trải nghiệm.

### Tiêu chí bàn giao kế thừa v0.1

- Một người mới thực hiện được luồng được chốt trên giao diện điện thoại.
- Lưu rồi mở lại đọc từ MongoDB, giữ đúng nội dung.
- Các thao tác với dữ liệu riêng có kiểm tra ownership tại server.
- Đầu vào không hợp lệ và nhà cung cấp lỗi có thông báo và đường tiếp tục.
- Có một kịch bản demo được lặp lại; ghi rõ bước nào dùng dữ liệu mẫu và bước nào đã gọi dịch vụ thật.
- Build/typecheck/lint đạt; kiểm thử tập trung vào hành vi có rủi ro, không dùng số lượng test làm tiêu chí thay cho kết quả.
- Nếu bàn giao link công khai: kiểm tra trực tiếp bản triển khai, kết nối database, biến môi trường, HTTPS và quá trình mở ứng dụng trên điện thoại.
- Nếu bàn giao PWA: kiểm tra manifest, icon, chế độ mở, hành vi offline và cập nhật trên trình duyệt/thiết bị mục tiêu; không suy ra thành công chỉ từ cấu hình.

## 9. Quyết định còn mở và phạm vi bị chặn

Mục 6 giữ các đề xuất làm việc. Bảng này xác định phụ thuộc, không coi thiếu quyết định commerce là chặn auth/trip độc lập.

| Mã   | Chưa chốt                                                                                                     | Chặn phần nào                                                       | Phần vẫn tiến hành                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Q-01 | Giờ Việt Nam/hình thức bàn giao 23/10/2026                                                                    | Cam kết demo/deployment và phạm vi nghiệm thu ngày đó               | F1-B local                                                            |
| Q-02 | Quyền guest, draft sync, quyền account chưa verify                                                            | Guest AI/save, gate hành động nhạy cảm; cần chốt trước CORE-1       | Hai phương thức Google + password đã xác nhận; nền context/audit      |
| Q-03 | AI/data provider, model, quyền snapshot, quota/ngân sách                                                      | CORE-2 tích hợp thật, cache dữ liệu ngoài                           | Auth và trip manual theo ownership                                    |
| Q-04 | Hàng bán/thu hộ, merchant, payment/booking provider, hủy/refund/thuế                                          | COMMERCE và booking thật, không tự chốt state transitions tài chính | F1-B/F1-C và trip không commerce                                      |
| Q-05 | Luồng/màn hình bắt buộc và giới hạn bản đầu                                                                   | Cam kết phạm vi phát hành, caps ngày/người/chặng/activity           | Review và nền kỹ thuật                                                |
| Q-06 | Email delivery provider; Google client/redirect/config; session lifetimes, rate limits và recovery/linking UX | Nghiệm thu F1-C email/Google thật và mở signup public               | Triển khai từng slice sau khi contract được chốt; không bypass verify |
| Q-07 | Retention/purge, privacy notice, mục đích/căn cứ và dữ liệu trẻ em                                            | Tự động purge, optional analytics, public launch                    | F1-B không thu optional analytics, không chạy purge                   |
| Q-08 | Vai trò chi tiết, collaborator/share, moderation và dữ liệu partner                                           | PLATFORM access/export/public share và community                    | Owner-only trip sau Q-02; không mặc định quyền support đọc trip       |
| Q-09 | Các khoảng trống schema theo state/provider trong F1-HANDOFF                                                  | Model/endpoint tương ứng trước khi bật                              | Không tạo collection chưa có consumer                                 |

Q-02 không còn hỏi phương thức login. npm, localhost và stack không phải câu hỏi mở. Linking không tự merge theo email; vẫn phải thiết kế xử lý email collision an toàn (R-04 trong handoff).

## 10. Cách cập nhật nguồn chính

Sửa nghiệp vụ phải cập nhật mã BR, dictionary/schema/contracts và tests liên quan trong cùng thay đổi; nếu chưa có implementation/test, ghi rõ trạng thái đó và acceptance dự kiến. Schema mục tiêu ở DB-BASELINE, registry là bản đọc máy để đối chiếu, không executable. Lưu quyết định mới cùng tiêu chí kiểm tra và tác động migration; không biến policy đề xuất thành đã xác nhận chỉ bằng sửa nhãn phiên bản.

## Tài liệu tham khảo sản phẩm

- https://canva.link/vq7dcojad4x9fby
- https://canva.link/0nf2jh8ukc9fi23
- https://canva.link/5kpkekj5ywd8b7n

## Phạm vi thực thi sau F1-B — ưu tiên sản phẩm 22/10/2026

Theo yêu cầu mới nhất của chủ sản phẩm, đi trực tiếp từ UI tới tài khoản và chuyến đi đầu tiên, không chờ triển khai mọi gate/collection. Guest được phác thảo trong bộ nhớ trang; lưu server cần phiên đã xác thực. Với email/password, trạng thái xác thực email tách biệt theo AUTH-03. Không tự ghi nháp vào tài khoản sau đăng nhập. Trips mặc định private/manual/draft, ownership từ session; revision conflict trả 409 và giữ input. Ngân sách/chi phí hiện là VND tổng nhóm, số dư dự phòng = ngân sách trừ chi phí đã nhập; bình quân chia số người và làm tròn tới đồng. Khoản null vẫn chưa biết, tổng/số dư được ghi rõ chưa đầy đủ khi có khoản thiếu. Đây không phải giá xác nhận/thực chi.

Email/password đăng ký và đăng nhập bằng API/MongoDB, không phụ thuộc môi trường hoặc email provider; account mới dùng được ngay nhưng `emailVerifiedAt` vẫn null. Mốc này không phát verification challenge/mailbox và mailbox development không được expose qua API/UI. Email chưa xác minh không được dùng tự liên kết/merge hay cấp quyền đặc biệt. Google chỉ bật khi cấu hình đủ và vẫn phải xác minh OIDC. Link/unlink/reset/logout-all chưa có UI/API. AI/discovery và commerce vẫn chưa triển khai.
