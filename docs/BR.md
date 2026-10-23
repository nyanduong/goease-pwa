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

| Mã      | Quy tắc                             | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Một User nội bộ, hai cách đăng nhập | Tài khoản có `_id` ổn định; password và Google là identity có thể liên kết. Không tạo hai hồ sơ chỉ vì đăng nhập bằng hai nút.                                                                                                                                                                             |
| AUTH-02 | Liên kết an toàn                    | Không tự merge chỉ do cùng email. Phải chứng minh quyền với tài khoản hiện tại và identity mới, có re-auth; identity đã thuộc user khác bị từ chối. Google dùng issuer + sub đã xác minh [S9].                                                                                                             |
| AUTH-03 | Email và mật khẩu                   | Email/password cho phép dùng account và chuyến riêng ngay sau khi xác thực mật khẩu; `emailVerifiedAt` vẫn null cho đến flow xác minh thật. Email chưa xác minh không được dùng để merge/link account hoặc cấp quyền đặc biệt. Mật khẩu hash Argon2id, không plaintext/giải mã; không log kể cả hash [S8]. |
| AUTH-04 | Vòng đời phiên                      | Logout thu hồi phiên hiện tại; logout-all/khóa tài khoản/đổi mật khẩu theo chính sách thu hồi phiên. Kiểm tra expiresAt, idleExpiresAt và revokedAt ở mỗi lần xác thực; TTL không thay kiểm tra hết hạn.                                                                                                   |
| AUTH-05 | Quyền khách — đề xuất               | Khách xem discovery và nội dung công khai. Tạo/lưu trip trên server, gọi AI cá nhân hóa và gửi yêu cầu có định danh yêu cầu đăng nhập; form nháp trước login chỉ nằm tại thiết bị và không tự nhập vào account khác.                                                                                       |
| AUTH-06 | Khóa và xóa account                 | Suspended không đăng nhập/giao dịch mới. Xóa account thu hồi phiên và share links ngay, không chỉ ẩn UI. Xử lý booking/refund đang mở và dữ liệu buộc giữ riêng với dữ liệu cần xóa.                                                                                                                       |
| AUTH-07 | Chống lạm dụng                      | Đăng nhập, reset, xác minh và AI có hạn mức tại server. Reset response không tiết lộ email tồn tại. Token reset dùng một lần, lưu hash, có hạn dùng.                                                                                                                                                       |
| AUTH-08 | Nguyên tắc quyền                    | Mọi read/update/delete/export kiểm tra quyền. Request không được tự đặt ownerId, roles, createdBy, revision, status paid hoặc thời gian audit.                                                                                                                                                             |

| AUTH-09 | Trang chủ sau đăng nhập và ảnh đại diện | Đăng nhập/đăng ký thông thường về Trang chủ `/`. Nếu người dùng bắt đầu tạo chuyến, email/password auth tiếp tục duy nhất `next=/trips/new`, giữ điểm đến hợp lệ trong catalog; không tự nhập nội dung nháp hoặc chấp nhận redirect tùy ý. Google callback vẫn về Trang chủ. Avatar dùng URL HTTPS của tài khoản nếu có; khi thiếu hoặc tải lỗi dùng avatar người du lịch mặc định. URL ảnh Google chỉ nhận từ claim đã xác minh; không chấp nhận avatar do client tự gửi trong login/register. |

### B. Danh mục, nguồn dữ liệu và nội dung

**CAT-11 — Vận hành tự động Hội An (23/10/2026, đã triển khai local theo yêu cầu owner):** admin cấu hình Geoapify một lần; lịch mặc định tắt, chỉ chạy sau khi lưu/bật. Hằng ngày/hằng tuần theo Asia/Ho_Chi_Minh; backend phải đang chạy. Tự nhập bản nháp, giữ giá null và nguồn OSM; không tự xuất bản. Dữ liệu nguồn allowlist được giữ riêng với nội dung biên tập; tên/địa chỉ/vị trí/phân loại/giờ/dấu hiệu đóng cửa thay đổi tạo việc so sánh, không tự ghi đè. Không tìm thấy trong một lượt không suy ra đóng cửa. Bản cũ chưa có snapshot nguồn được đưa qua đối chiếu lần đầu; không suy đoán dữ liệu trước đó.

**CAT-12 — Quyết định và duyệt lô:** một địa điểm/một loại vấn đề có tối đa một bản ghi việc; thông tin giống nhau không mở lại việc đã giữ/bỏ qua. Có thông tin nguồn mới liên quan thì có thể mở lại; hẹn lại 1/7/30 ngày từ UI (API tối đa90 ngày). Thiếu giá/ảnh/giờ không sinh việc bắt buộc; chỉ giá đã có nhưng hết hạn mới cần kiểm tra. Nghi trùng: bỏ qua bản mới (archived) hoặc xác nhận hai địa điểm riêng, không gộp tham chiếu. Áp dụng chỉ các trường nguồn thay đổi từ lần đối chiếu trước, giữ các trường biên tập còn lại; dấu hiệu đóng cửa chỉ ngừng hiển thị sau quyết định rõ ràng. Việc đang mở/tạm hoãn về nguồn hoặc nghi trùng chặn xuất bản bản nháp. Published vẫn published khi có việc mới, cho đến quyết định ngừng hiển thị. Giữ thông tin hiện tại cho phép người vận hành tiếp tục duyệt. Lô tối đa50, xem trước phạm vi, kiểm quyền/revision/điều kiện từng mục, giá null được phép; trả riêng mục thành công/bị chặn và giữ bản mới khi conflict. Mutation, quyết định, lịch và yêu cầu chạy có receipt24h/audit nguyên tử; retry cùng key không lặp tác dụng/audit.

**CAT-13 — Chạy nền và giới hạn:** MongoDB lưu lịch, lượt chạy, lần thử, thời điểm tiếp theo, kết quả và quota. Một lượt active cho Hội An; nhận nguyên tử, lease120s/heartbeat20s, mỗi transaction ghi catalog phải cập nhật cùng bản ghi lượt với token còn hạn. Restart khôi phục lượt hết khóa; worker mất khóa không ghi tác dụng. Tối đa3 lần thử; timeout/lỗi tạm dùng backoff1/2phút,429 dùng Retry-After có chặn1giây–24giờ hoặc15phút, hết quota local chờ đầu giờ.20 lượt tìm/giờ chung,10/actor/giờ (hệ thống là actor riêng), tối đa2 request-group đang giữ slot; dùng chung với preview thủ công và bền qua restart. Lỗi thiếu/sai khóa cần người thiết lập, không giả thành công. Pause ngăn lượt tự động mới; lượt đã nhận vẫn hoàn tất/thử lại; Chạy ngay vẫn cần admin. Actor hệ thống chỉ nhập draft/ghi quan sát/việc trong scope cố định, không có quyền đọc trip riêng hoặc đăng catalog. Không sửa trip/snapshot giá khách đã lưu. Chưa có purge/retention tự động, queue hạ tầng ngoài, provider mới, merge hoặc tự xuất bản.

| Mã     | Quy tắc                        | Yêu cầu kiểm tra/thiết kế                                                                                                                                                                                                                                                          |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 | Phân biệt điểm đến và địa điểm | Destination là khu vực/chặng; Place là một POI/nhà hàng/điểm tham quan. ID nội bộ ổn định; nguồn ngoài có provider + externalId.                                                                                                                                                   |
| CAT-02 | Nguồn và quyền sử dụng         | Mỗi dữ liệu bên ngoài có fetchedAt, nguồn, điều kiện lưu/cache/reuse và thời điểm hết quyền lưu nếu có. Không mặc định SerpApi hay một API cho phép lưu vĩnh viễn mọi ảnh/review.                                                                                                  |
| CAT-03 | Dữ liệu không biết             | Giờ mở cửa, giá, tọa độ thiếu phải thể hiện chưa biết. Không suy ra miễn phí từ giá null. Không phát minh review hoặc nhãn đã xác minh.                                                                                                                                            |
| CAT-04 | Cập nhật danh mục              | Ngừng xuất bản địa điểm không tự viết lại lịch cũ. Trip dùng snapshot hợp lệ tại thời điểm chọn; nếu có yêu cầu xóa theo quyền dữ liệu, áp dụng redaction có kiểm soát.                                                                                                            |
| CAT-05 | Xuất bản                       | Chỉ published + chưa xóa được hiển thị công khai. Draft/rejected/archived không lọt vào search, favorites hydrate hoặc link chi tiết.                                                                                                                                              |
| CAT-06 | Ảnh và upload                  | Ảnh có owner/source/license. Upload giới hạn kích thước/định dạng, kiểm tra nội dung phù hợp, private file truy cập có thời hạn. Không nhét binary/base64 vào trip.                                                                                                                |
| CAT-07 | Khám phá và ghi chú cá nhân    | Catalog có tìm kiếm/lọc và chi tiết địa điểm published. Lưu địa điểm/ghi chú cần đăng nhập; owner từ session, note private tối đa 2.000 ký tự, cập nhật theo expectedRevision. Bỏ lưu giữ note. Chỉ thêm vào chuyến đi của mình và ngày thuộc cùng điểm đến; bản nháp mới cần Lưu. |

**CAT-07 / CONTENT-02 — Đã lưu → chuyến đi (2026-10-23):** Đã lưu có nút chọn chuyến/ngày cùng điểm đến; thêm snapshot ghi chú và giá chưa rõ qua API trip hiện có. Thêm trùng cùng ngày cần xác nhận; retry cùng thao tác dùng cùng idempotency key. Bỏ lưu không xóa điểm dừng trong trip. Quan hệ của chính user với target không còn published được liệt kê dưới dạng không khả dụng, không trả nội dung catalog; chỉ cho bỏ lưu (không sửa note/thêm vào trip).

**Runtime Khám phá (2026-10-22):** ba gợi ý Hội An, ảnh AI local. Cơm gà là gợi ý món ăn, không đại diện nhà hàng cụ thể. Thời lượng/Goe gợi ý là nội dung biên tập, không gọi AI trực tiếp. Không cung cấp giá/giờ mở cửa/tọa độ chưa biết. Map là bản đồ khu vực OpenStreetMap và link tìm trên Google Maps. Catalog trực tiếp cho phép khách xem; tương tác từ Trang chủ vẫn đi login theo yêu cầu trước đó.

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

### Luồng Hội An và ngân sách — phạm vi được yêu cầu 22/10/2026

- TRIP-04/07/08: chi phí nhập là VND, `basis=group_total` hoặc `per_person`, `quantity=1`. Server nhân chi phí mỗi người với số người hiện tại đúng một lần; chi phí nhóm không nhân lại. Dữ liệu cũ group_total giữ nguyên. Chặn tổng vượt số nguyên an toàn; null là chưa biết, 0 là khoản người dùng nhập bằng 0. Các nhóm không có khoản nhập không chứng minh chuyến đi không phát sinh chi phí nhóm đó.
- Server trả subtotal, số khoản chưa rõ, phân nhóm, bình quân làm tròn đồng, phần còn lại và tỷ lệ. Ngân sách null là chưa đặt; ngân sách0 không tính tỷ lệ chia0, vẫn báo số tiền vượt. Tất cả là dự kiến, không phải thực chi hoặc cam kết đủ ngân sách.
- CAT-01/03, TRIP-05/09: điểm dừng có `placeId?` để mở lại nguồn catalog. Liên kết mới phải tồn tại, published/chưa xóa và cùng điểm đến của ngày. Điểm đã lưu giữ title/notes/cost riêng; catalog bị ẩn sau đó không làm mất lịch hoặc ngăn lưu nội dung cũ. Đổi ID/ngày sang điểm đến khác phải kiểm tra lại.
- Catalog Hội An có7gợi ý địa điểm/hoạt động, nguồn công khai và thời lượng do GoEase biên tập. Giá tham khảo có nguồn/ngày đối chiếu, chỉ đưa vào nháp sau thao tác chọn của người dùng; vẫn là `confidence=user_entered`, không phải báo giá đã xác nhận. Không tự tính giá ăn uống, lưu trú hoặc dịch vụ thiếu dữ liệu. Vé nhiều di tích chỉ tính một lần khi người dùng chọn; giao diện nhắc tránh cộng trùng, chưa tự suy ra các vé đã bao gồm.
- Ngân sách bản nháp được tính qua API authenticated không lưu; lưu chuyến vẫn qua transaction/revision/idempotency hiện có. AI planner/chat, booking/payment và dữ liệu giá live chưa thuộc task này.

### AI customer implementation — 2026-10-23

AI-01–AI-06 have a local planner subset detailed in [AI-PLANNER.md](AI-PLANNER.md): Gemini, Hội An1–7days, catalog-only structured proposals, explicit draft apply and revision-checked save, server provenance, no invented prices, atomic quota reservations and conservative unknown-outcome recovery. Local technical defaults (5/user/day,20/global/day UTC; new-trip 4/5/6 stops for pace, selected-day adjustment 2/3/6;30minute buffers) are development guardrails/heuristics, not an approved paid policy or real routing guarantee. AI-07 analytics, provider-cost reconciliation, production retention and paid quota policy remain planned. Google provider selected explicitly by owner; provider data use follows the selected tier terms, no assumption of zero retention/training.

### Goe customer adjustment — 2026-10-23

AI-01–AI-06 now also cover selected-day adjustment from customer messages: server reads the owned saved trip, sends bounded message plus allowed catalog/context, preserves other days and retained prices/notes, validates output, then explicitly previews before/after and applies through revision/idempotency transaction only on customer confirmation. Weather/price facts remain unavailable; unknown costs cannot be asserted as savings. Conversation history is local UI memory only. See AI-PLANNER.md for endpoints and limits.

**CAT-03/CAT-05/TRIP-05/TRIP-06 — bản đồ Hội An (2026-10-23):** tab Bản đồ phản ánh ngày và thứ tự lịch đang mở. Chỉ dùng tọa độ catalog published có nguồn; vị trí khu vực không phải lối vào đã xác minh. Thiếu tọa độ hiển thị chưa rõ và tìm kiếm ngoài; không bịa vị trí cho món ăn. Nét nối thứ tự không phải tuyến đường/ETA, không tự sửa lịch. Xem [TRIP-MAP](TRIP-MAP.md).

## TRIP-08 / TRIP-13 — Customer actual expenses, 2026-10-23

Implemented: owner-only create/edit/soft-delete of independent trip expenses; positive integer VND group totals and date-only spentOn (outside itinerary dates allowed). Compare recorded actuals against saved budget and known estimate; retain unknown-cost warnings. Revision conflicts cannot overwrite silently; same-key retries deduplicate within retained key window. No activity cascade, wallet, receipts, split settlement or payment confirmation. Details/contracts: [TRIP-EXPENSES.md](TRIP-EXPENSES.md).

## TRIP-03/05/08/09/10/12/13 — Quản lý chuyến đi customer

Phân loại sắp/đang/đã kết thúc theo ngày Việt Nam, không là trạng thái xác nhận đã đi. Dời ngày giữ lịch theo ordinal/stable IDs; chặn rút ngày có hoạt động và PATCH đổi ngày làm mất activity. Expense không dịch ngày theo lịch. Duplicate owner-only tạo lịch manual riêng, không clone thực chi; xóa mềm có revision/audit/idempotency và ẩn mọi expense qua quyền trip. Tổng kết dùng dự toán đã biết và thực chi đã ghi, không báo chắc chắn tiết kiệm. API, giới hạn và policy triển khai ở TRIP-MANAGEMENT.md; thùng rác/restore đã triển khai; purge chưa triển khai.

## Customer account — 2026-10-23

AUTH-03/04/07/08/09: customer sửa tên/avatar qua endpoint profile xác thực và revision, email chỉ đọc. Avatar HTTPS hoặc null, upload chưa triển khai; Google login không ghi đè lựa chọn ảnh hiện có. Đổi mật khẩu phải xác minh password cũ, mới12–128 ký tự và khác cũ; giữ phiên hiện tại, thu hồi mọi phiên khác bằng securityVersion/revokedAt. Google-only không tự đặt password. Replay lần đổi gần nhất bound session/key và hash mới, không lưu request chứa mật khẩu. Chi tiết ACCOUNT-PROFILE.md.

### Triển khai chia sẻ chỉ xem — 2026-10-23 (TRIP-11/TRIP-12)

Owner tạo link từ chuyến đã lưu, hạn 1/7/30 ngày, tối đa 10 link hoạt động/chuyến; thu hồi từng link. Người có link đọc lịch đã lưu mới nhất và bản đồ không cần đăng nhập. Projection API chỉ có tên chuyến, điểm đến, ngày, tên/thời gian/thứ tự hoạt động và catalog ID cần bản đồ; ẩn toàn bộ ghi chú, dự toán/ngân sách/thực chi, tài khoản và AI metadata. Tên chuyến/hoạt động do người dùng nhập vẫn được chia sẻ; UI thông báo rõ.

Token Web Crypto 256-bit truyền trong fragment `/share#token`, gửi API bằng Authorization; DB lưu SHA-256, không log token/URL. Retry cùng token/duration không tạo trùng hay gia hạn. Hết hạn/thu hồi/chuyến bị xóa trả404 chung; xóa chuyến thu hồi link trong transaction, khôi phục dữ liệu không kích hoạt link cũ. Chưa có editor/collaborator, link không có quyền ghi. Không thể thu lại nội dung người nhận đã xem/lưu; trang kiểm lại khi focus/tải lại/cập nhật lịch, không realtime push.

### Quên mật khẩu — 2026-10-23 (AUTH-03/04/07/08)

Đã triển khai email/password recovery cho account active không bị xóa, có password identity đang liên kết. Chủ sản phẩm sẽ cung cấp cấu hình SMTP sau; chưa xác nhận gửi/nhận email thật. Link server-random, chỉ lưu hash, hạn mặc định15phút (cấu hình5–60phút), consume một lần trong transaction cùng đổi mật khẩu/thu hồi mọi phiên/audit. Không đánh dấu emailVerifiedAt hoặc tạo/link identity Google. Request có response chung, cooldown60giây/user, rate limit server; SMTP lỗi không được báo là đã giao thư. Token securityVersion binding khiến đổi mật khẩu trước đó vô hiệu link. Xem PASSWORD-RECOVERY.md cho hợp đồng, queue trong bộ nhớ và giới hạn chưa có durable retry. Policy reset mới này khác đổi password trong hồ sơ: reset thu hồi cả phiên hiện tại.

### TRIP-09/10/11/12/13 — Thùng rác customer (2026-10-23)

Owner xem thùng rác và khôi phục chuyến của mình bằng revision hiện tại. Khôi phục cùng ID, giữ nguyên lịch/ngày/ghi chú/dự toán/source và thực chi, tạo revision mới cùng audit; không phục hồi expense đã xóa riêng. Link chia sẻ cũ vẫn thu hồi, kể cả sau restore. Chưa có purge tự động hoặc restore về revision lịch sử tùy chọn. Xem TRIP-MANAGEMENT.md.

### DATA-10 / TRIP-01/09/12 — Lịch trình offline chỉ xem (2026-10-23)

Customer chủ động tải snapshot chuyến thuộc mình từ API đã lưu, tối đa10chuyến/bộ nhớ2triệu ký tự JSON. Xem lịch/ngày/giờ/ghi chú/dự toán, thời điểm tải và cảnh báo bản cũ; không sửa/sync queue/thực chi/AI/map offline. Logout xóa snapshot trên máy ngay và mọi tab; mất mạng thì đánh dấu hoàn tất logout server khi kết nối lại. Đổi account không kế thừa cache. Phiên hết hạn hoặc trip bị xóa được kiểm lại khi online; không thể thu hồi tức thì bản đã tải khi thiết bị mất mạng. API ownership không đổi, share link không được cache. Chi tiết OFFLINE-ITINERARY.md.

## Mobile usability — 2026-10-23

Owner requested fixes after a mobile newcomer walkthrough. AUTH-09 now continues an explicit create-trip intent after email/password login/register: only `next=/trips/new` is accepted; optional destination must match the public catalog. Ordinary sign-in still goes home. No draft content is transferred between accounts or persisted for this redirect. This supersedes the earlier always-home rule for that one intent.

CAT-03/05: unsupported destination cards are disabled and labeled; food ideas without a catalog location are identified as dishes awaiting a restaurant choice. External Maps search helps the customer choose and record a specific venue; it does not verify price, availability or route.

TRIP-08: missing prices or no entered prices show an incomplete-estimate warning before totals. Missing categories display “Chưa thêm”, not zero. Budget remaining/progress is hidden when estimates are incomplete; otherwise the difference is labeled as applying only to entered costs. Preparation actions guide lodging, transport, costs, locations and an offline copy; none certify a booking or trip readiness.

AI-01/02/03: existing 2/3/6-stop pace heuristics remain unchanged and are explained to the customer. For a requested extra stop at the cap, Goe may propose replacing another stop; customer reviews before saving. Invalid pace/times remain rejected with actionable messages. Only pending/uncertain runs offer same-key retrieval; completed failures direct customers to edit the request or manually choose stops. No automatic provider retries, quota changes, invented prices or new collections.

## Mobile plan first — owner request 2026-10-23

- TRIP-02/03/04, BR-01: new-trip setup asks destination, duration and group size inline. Defaults are visibly selected 2 days / 2 people / balanced pace; interests and budget are optional. Date-only persistence remains mandatory. Before saving, the customer explicitly chooses a departure date; the whole itinerary shifts by day index with the existing stable day/activity IDs. Until then the UI shows relative days and “Chưa chốt ngày đi”, never silently treating today as the confirmed departure.
- AI-01/02/03/06: one explicit “Lên lịch giúp mình” action requests the existing server-validated proposal and opens it directly as an unsaved editable preview. No intermediate apply/review page for a new empty trip. “Giữ lịch này” opens the short date/save sheet; only successful server commit is called saved. Existing-trip regeneration retains explicit replacement confirmation. The Google disclosure remains before generation; pending/network outcomes recover the same key, terminal failures retain inputs and manual planning. Automatic generation is still limited to Hội An 1–7 days and clearly labeled separately from manual destinations.
- TRIP-05/06/08/09: each stop exposes a quick swap and removal with single-operation undo. A timed quick swap offers only published same-destination places whose catalog duration fits the existing slot, excludes places already anywhere in the trip, and preserves all other stops/times. The new stop is a manual selection with a fresh ID and unknown price, not an invented AI recommendation/verified venue. No auto-routing or factual opening-hours claim. Editing a saved trip still needs Save; original AI provenance of retained stops remains server-checked.
- This replaces the three-step creation wizard, not the existing ownership, quota, money, booking or stored-trip contracts. A persistent undated trip and automatic hotel/restaurant booking remain unimplemented.

## Admin catalog và giá tự động — yêu cầu owner 2026-10-23

Mốc 1 đã được owner yêu cầu: quản trị địa điểm/quán ăn/giá tham khảo và nối vào dự toán Customer. Phạm vi runtime cụ thể ở [ADMIN-CATALOG.md](ADMIN-CATALOG.md); không suy ra booking, thanh toán, quản trị người dùng toàn diện hoặc kiểm chứng giá ngoài thực tế.

| Mã     | Quy tắc                      | Runtime / kiểm tra                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CAT-08 | Quản trị danh mục            | Account active với role admin do operator cấp; kiểm tra tại API và service, không lấy role từ client. CRUD tối thiểu create/read/update và draft/published/archived; không hard delete. Destination của record đã tạo cố định; đổi địa chỉ tìm kiếm xóa tọa độ cũ để tránh dẫn sai. Revision chống ghi đè; cùng key/payload không tạo trùng. Catalog + audit + receipt commit hoặc rollback cùng nhau.                   |
| CAT-09 | Giá dùng cho dự toán tự động | Admin chỉ định một giá tham khảo VND có cơ sở per_person/group_total, giới hạn số người, điều kiện, nguồn HTTPS, ngày đối chiếu và ngày kiểm tra lại. Chưa biết là null, miễn phí xác nhận là 0. Gợi ý món ăn chưa gắn quán không được bật giá tự động. Ngày kiểm tra lại là hạn biên tập, không phải cam kết giá ngày du lịch. Quá hạn không tự áp dụng cho lượt thêm/generate mới; vượt nhóm tối đa tính là thiếu giá. |

**TRIP-07/08, AI-01/03:** server lấy giá catalog sau khi xác thực output AI; model không tạo giá/tổng. Thêm/đổi điểm thủ công cũng dùng reference nếu có. Snapshot bao gồm giá, basis, nguồn, điều kiện, ngày và revision. Không thay đổi giá đã lưu khi admin sửa catalog. Đổi số người chỉ tính lại trên basis/snapshot đang dùng; không nhân hai lần. Khách chủ động cập nhật tham khảo hoặc nhập giá riêng (bỏ provenance catalog). Snapshot mới phải được server đối chiếu với catalog hiện hành hoặc bản trip/proposal thuộc đúng owner; không tin nhãn nguồn do client tự gắn. Dự toán không tuyên bố đã bao gồm khoản chưa thêm như lưu trú/di chuyển.

**AUTH-08, DATA-02/03:** role admin không mở quyền xem trip riêng của người khác. Cấp/thu hồi admin local ghi audit và đổi securityVersion để yêu cầu đăng nhập lại. Đăng ký/profile không nhận role. Audit catalog có actor từ session, action/target/revision/time; chưa có lịch sử đầy đủ nội dung catalog hoặc khôi phục phiên bản. Quyền upload/kiểm duyệt nhiều cấp/production provisioning chưa triển khai.

### CAT-08 / AUTH-08 — Admin desktop workspace

Owner clarification: admin uses desktop administration only. Successful admin login goes directly to `/admin`, overriding customer return intents. Restored sessions and customer-route navigation return admin to this workspace; no travel navigation or customer onboarding is shown. Customer mobile journeys remain unchanged. This is UI separation with existing server role checks, not a new role/schema or a change to ownership authorization.

## CAT-10 — Nhập địa điểm từ Geoapify (2026-10-23)

| Mã | Quy tắc | Yêu cầu |
| --- | --- | --- |
| CAT-10 | Nhập địa điểm có duyệt | Admin tìm và chọn nguồn OSM, nhập nháp với provenance; chống trùng, không ghi đè hoặc tự xuất bản. |

Owner yêu cầu thử 30–50 địa điểm Hội An trước rồi bổ sung import admin. Đã triển khai local: admin tìm 30/50 kết quả trong phạm vi Hội An cố định tại server, xem trước và chọn nhập bản nháp. Chỉ dữ liệu OSM có tên/tọa độ/ID hợp lệ được nhận; mã nguồn duy nhất chống nhập trùng, nghi trùng cần admin kiểm tra/xác nhận. Không ghi đè dữ liệu đã biên tập, không tự xuất bản, không biến thiếu giá thành miễn phí, không cập nhật trip cũ. Key/quota/request/provider normalization và quyền đều ở server; nguồn/ngày lấy/ODbL được giữ. Batch place/audit/receipt nguyên tử, retry idempotent và không nhận provenance từ client. Baseline provider/refresh rộng hơn chưa triển khai. Kết quả live 50→45, nhập 41 draft bỏ 4 mục nghi trùng; contract/giới hạn/bằng chứng tại [GEOAPIFY-IMPORT](GEOAPIFY-IMPORT.md). CAT-01–06/08/09 và AUTH-08 tiếp tục áp dụng; đây không phải booking hoặc xác nhận thông tin tại cơ sở.

### Hội An: ba lựa chọn để có lịch cụ thể — 23/10/2026

Owner xác nhận AI-01/02/03 và TRIP-08: chỉ yêu cầu điểm đến, số ngày, số người; ngân sách là tùy chọn, null không có nghĩa là miễn phí hay không giới hạn tiền. Ngày mới ưu tiên nhịp vừa sức, bữa trưa/tối tại cơ sở cụ thể, điểm tham quan đa dạng, ghép khu vực gần nhau và có khoảng nghỉ. Không dùng food_idea hoặc fixture [TEST]/[KIỂM THỬ] để tạo lịch. Mục tiêu này không phải cam kết thời tiết, đặt chỗ hoặc hành trình hoàn hảo.

Triển khai Hội An: giới hạn điểm mới theo relaxed/balanced/active là 4/5/6 (thay 2/3/6 cho tạo lịch; chỉnh một ngày giữ hành vi cũ). Với catalog có ít nhất 4 điểm tham quan và 2 quán cụ thể, server yêu cầu mỗi ngày ít nhất 4 điểm, ít nhất 2 tham quan, bữa trưa bắt đầu 11–14h và tối 17–20h. Không lặp điểm tham quan giữa các ngày; quán có thể lặp khi ít lựa chọn. Thời lượng lấy từ catalog, đệm tối thiểu 30 phút, ghép khu vực là hướng dẫn model chứ chưa phải tối ưu tuyến đường có kiểm chứng.

Giờ hoạt động: truyền ghi chú hiện có cho model và kiểm tra server định dạng hẹp HH:mm–HH:mm cùng “đóng cửa ngày N và M hằng tháng”. Ghi chú chưa xác minh/không thống nhất không thành cam kết mở cửa. Schema giờ có cấu trúc, ngày lễ và chuẩn hóa mọi nguồn import khác vẫn cần triển khai; không suy ra chúng đã có từ xác nhận chất lượng dữ liệu của owner. Giá vẫn chỉ từ catalog còn hiệu lực; phần thiếu, lưu trú/di chuyển chưa thêm không nằm trong tổng đã biết. Ngày đầu/cuối mặc định là ngày trọn vẹn, giờ đến/về chưa thu thập.

Bổ sung AI-02: sau khi AI chọn ứng viên, server bố trí lại giờ và bổ sung bữa ăn/điểm tham quan từ catalog đủ điều kiện trước khi kiểm tra. Không tự thành công khi provider lỗi. Chỉnh riêng một ngày cho phép ít nhất số điểm ngày đó đã có (tối đa 6), tránh buộc xóa điểm chỉ vì giới hạn cũ. AI-02/TRIP-08: đổi ngày ở workspace và chọn ngày khởi hành khi lưu preview tự kiểm tra giờ catalog trên server; giữ điểm hợp lệ, đổi giờ hoặc thay điểm đóng cửa cùng loại, không gọi thêm Gemini. Thiếu phương án thì giữ nguyên lịch cũ. Giữ activityId, ghi chú riêng và giá điểm giữ lại; điểm thay dùng giá catalog hoặc null.


### AI-01/AI-02: tùy chọn nhà cung cấp — 24/10/2026

Theo yêu cầu owner, server hỗ trợ Google trực tiếp hoặc FULLDICHVU qua cấu hình riêng. Không tự chuyển nhà cung cấp hay retry có phí khi lỗi. Mọi đầu ra vẫn qua kiểm tra lịch/catalog/giá; không coi lỗi provider là tạo lịch thành công. API key chỉ lưu ở server. Chưa có xác nhận chất lượng hoặc chi phí thực tế của model qua FULLDICHVU khi chưa thử key thật.


AI-02 vận hành (24/10/2026): theo yêu cầu owner, tăng thời gian chờ provider lên 120 giây; client 135 giây, đối soát lượt pending sau 180 giây. Vẫn không retry/fallback tự động có phí. Timeout vẫn là kết quả chưa xác định, không báo tạo lịch thành công.


AI-02 payload gọn (24/10/2026): bỏ mô tả dài và provenance giá khỏi dữ liệu gửi model; giữ ID/địa chỉ/thời lượng/ghi chú giờ nguyên vẹn. Giá cuối lấy từ catalog đầy đủ ở server, model không được trả field giá. Schema đầu ra và kiểm tra ID/ngày/giờ không nới lỏng.


AI-02 (24/10/2026): FULLDICHVU tạo chuyến mới chỉ xếp hạng ID có thật; server xếp ngày/giờ từ catalog rồi kiểm tra lịch và tính giá. Phản hồi bị cắt/rỗng không được dùng làm lịch thành công. Goe chỉnh riêng ngày vẫn giữ schema lịch hiện tại. Chất lượng live của model đang thử chưa được xác nhận.

AI-02/TRIP-08 kiểm chứng customer (24/10/2026): thay điểm khi đổi ngày phải giữ mục đích bữa ăn; nhãn restaurant do import chưa đủ nếu tên/mô tả chỉ thể hiện quán cà phê. Dùng cùng bằng chứng phục vụ món ăn như bước tạo lịch. Không đủ điểm thay phù hợp thì giữ lịch cũ; không bịa giá. Không thay đổi schema/contract lưu trữ. Luồng tạo, lưu, đổi ngày và Goe chỉnh lịch đã kiểm thử trực tiếp với Haiku; phạm vi và giới hạn tại docs/CUSTOMER-LIFECYCLE-VERIFICATION.md.

## CAT-14 / TRIP-07 / AI-01 — dữ liệu đủ giá và vé gói (24/10/2026)

Theo yêu cầu owner, xuất bản trực tiếp và theo lô đều cần referencePrice còn hạn, nguồn HTTPS, điều kiện, phần bao gồm (`inclusions`) và không bao gồm (`exclusions`). Giá 0 chỉ do admin xác nhận miễn phí; thiếu dữ liệu giữ bản nháp. Kiểm tra cấu trúc không thay việc admin xác minh sự thật. Quy tắc này thay mô tả cũ cho phép xuất bản không giá.

Goe chỉ chọn giá đủ điều kiện cho số người, địa chỉ/thời lượng có sẵn và ghi chú giờ có khoảng HH:mm–HH:mm hợp lệ, không chứa dấu chưa xác minh/chưa rõ. Lọc trước gọi model; thiếu số điểm/bữa ăn trả lỗi khả dụng, không dùng quota. Áp dụng cả chỉnh lịch và tìm điểm thay thế khi đổi ngày. Dữ liệu cũ không tự sửa/xóa; lịch đã lưu vẫn giữ snapshot.

Vé gói là dữ liệu admin gán tường minh: mã dùng chung, số ngày lịch tính cả ngày đầu và tổng số lượt vào cửa. Chỉ các điểm gán cùng mã, cùng toàn bộ giá/điều kiện được dùng chung; mỗi lượt hoạt động tiêu thụ một lượt vé. Hết hạn hoặc hết lượt thì tính gói mới. Bữa ăn không dùng cơ chế vé gói. Khác định nghĩa cùng mã thì từ chối tính, không tự chọn giá thấp. Các gói giới hạn riêng theo loại di tích, hạn theo giờ hoặc miễn giảm theo tuổi chưa hỗ trợ; không nhập như gói đơn giản. Không tự suy ra vé phố cổ thực tế đã thỏa mô hình.

CAT-14 / TRIP-07: Giá có thể quy định `minTravelers` (1..1000, mặc định đọc là 1 nếu thiếu), không lớn hơn maxTravelers. Xuất bản được giá cho nhóm tối thiểu 2; Goe và dự toán chỉ áp dụng khi số người nằm trong cả hai giới hạn. Không tự nâng giá một khách lên giá hai khách, không nhân thiếu suất tối thiểu.

TRIP-07 / EXP-01 — UI customer (24/10/2026): dùng nhãn “Chi phí dự kiến”; bỏ cặp tab Dự toán/Thực chi. “Ghi lại chi tiêu (tùy chọn)” chỉ có trong chuyến đã lưu, không bắt nhập để dùng hoặc hoàn thành chuyến. Bỏ khối Bản quyền dữ liệu ở TripWorkspace theo yêu cầu owner. Không thay phép tính, quyền sở hữu, API/schema hoặc dữ liệu chi tiêu đã lưu.

AI-01 / TRIP-07 / EXP-01 — rà UX customer (24/10/2026): khi thiếu catalog, hướng dẫn nêu cần bổ sung dữ liệu, không khuyên tạo lại cùng đầu vào. Không hứa hỗ trợ mọi lịch 1–7 ngày khi catalog chưa đủ. Vào tab Chi phí luôn mở chi phí dự kiến trước; chi tiêu vẫn tùy chọn. Nhân bản hiện giữ điểm dừng, chưa kiểm tra lại giờ mở cửa cho ngày mới, và phải nói rõ trước thao tác. Đồng bộ ô ngày nhân bản/ngày chi trên cả input và change; không thay contract, schema hay phép tính.
