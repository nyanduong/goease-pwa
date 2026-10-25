# Planner Việt Nam và phân vùng — 24/10/2026

CAT-18 (25/10/2026) thay phần thêm điểm đến thủ công:34 tỉnh/thành được bootstrap, admin bật/tắt trong Cài đặt. Hội An/Sa Pa chỉ là khu vực bên trong Đà Nẵng/Lào Cai. Lập lịch theo tỉnh vẫn cần dữ liệu đủ điều kiện; một vòng tròn thu thập không bao phủ tỉnh. Xem PROVINCE-CATALOG.md.

Owner yêu cầu mở rộng planner toàn Việt Nam và chuẩn bị phân vùng trước khi reset/import từ Bắc xuống Nam. Task chạy trực tiếp trên main. Dữ liệu ứng dụng hiện tại được giữ; không chạy clear, seed lại catalog hay import nguồn thật trong task này.

## Phạm vi thực thi

| Miền            | Vùng du lịch / code                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Bắc / north     | Tây Bắc / northwest; Đông Bắc / northeast; Đồng bằng Bắc Bộ / northern-delta                               |
| Trung / central | Bắc Trung Bộ / north-central; Duyên hải Nam Trung Bộ / south-central-coast; Tây Nguyên / central-highlands |
| Nam / south     | Đông Nam Bộ / southeast; Miền Tây (Tây Nam Bộ) / mekong-delta                                              |

Taxonomy biên tập GoEase, độc lập đơn vị hành chính; không khẳng định đây là phân vùng chính thức hoặc polygon địa lý. Mỗi điểm đến có đúng một tourismRegion; region được suy ra để Miền Tây không bị đếm thành miền thứ tư. Không tạo province list hoặc gán toàn bộ địa điểm cả nước bằng suy đoán.

Planner dùng bất kỳ điểm đến published/VN trong database với catalog đủ điều kiện. Một điểm đến/chuyến, 1–7 ngày; không còn ID/tên Hội An trong scope hoặc provider instruction. Tên điểm đến lấy từ database server, không nhận tên do client tự khai. API kiểm quota và quyền như trước; lịch đã lưu và apply cũ vẫn tương thích. Đây là khả năng xử lý catalog toàn quốc, chưa có nghĩa dữ liệu thật ở mọi nơi đã được nhập/xác minh.

Giữ tối thiểu hai tham quan/ngày, bữa trưa và bữa tối, giá đủ căn cứ/đúng nhóm khách/còn hạn và giờ đọc được. Phân loại bữa ăn nhận thêm tên nhóm món phổ biến (cơm/phở/bún/hủ tiếu/bánh/mì/lẩu/buffet/eatery) cùng venueType restaurant; đồ uống thuần túy không được tính thay bữa ăn. Người biên tập vẫn phải xác định cơ sở/loại hình/nguồn thật; heuristic này không xác minh menu trực tiếp.

Candidate scan có giới hạn: tối đa1.020 POI published theo destination, chọn tối đa30 ID cân bằng tối đa20 tham quan +10 bữa ăn, rồi bổ sung điểm khác nếu còn chỗ. Một trang nhiều quán cà phê không chặn việc tìm tham quan ở trang sau. Không bảo đảm tìm được mọi cách xếp trong catalog lớn; thiếu coverage trả lỗi, không gọi thêm provider hoặc trả thành công giả. Giờ di chuyển vẫn là đệm ước tính30 phút, chưa tối ưu tuyến đường có kiểm chứng, đường xa/liên tỉnh hoặc thời tiết.

Kiểm tra trước quota xét eligibility/số lượng candidate; kiểm tra khả thi toàn bộ giờ/ngày và đầu ra vẫn diễn ra sau provider như trước. Nếu provider đã được gọi mà đầu ra không đạt, lượt có thể vẫn được tính theo quota policy hiện hành. Không cam kết mọi lỗi xếp lịch đều miễn lượt.

## Chuẩn bị nhập dữ liệu từ miền Bắc

1. Mở `/admin#settings` → **Điểm đến & phân vùng Việt Nam**. Tạo điểm đến, slug, vùng, giới thiệu; mặc định nháp. Điểm đến cần published để dùng trong danh sách chọn/import hiện hành. Có phân trang20 mục, tìm tên và bộ lọc miền/vùng.
2. Với điểm đến cũ hiển thị **Chưa phân vùng**, mở Sửa và chọn vùng đúng. Không có thao tác tự đổi/xóa dữ liệu cũ. Seed mới của Hà Nội/Hội An/Đà Nẵng/Đà Lạt có vùng; seed không ghi đè bản đã tồn tại.
3. Trong **Phạm vi nhập theo khu vực**, cấu hình tâm/bán kính đã kiểm tra cho từng điểm đến, bật và lưu. Tối đa100 phạm vi cấu hình, bán kính500–10.000m; quota nguồn toàn hệ thống giữ nguyên. Miền/vùng là bộ lọc tổ chức, chưa phải lệnh quét toàn miền hay nhập polygon.
4. Đợt reset/import thật sẽ làm sau yêu cầu riêng của owner. Sau nhập vẫn là draft, rà trùng/nguồn/giá/giờ rồi mới xuất bản và thử planner. Không dùng ảnh AI như ảnh xác minh địa điểm.

Ẩn một destination có POI published bị409; ngừng hiển thị POI trước. Đổi tên/vùng hoặc ngừng hiển thị không thay snapshot chuyến đã lưu. Tài khoản thường không thể tạo/sửa destination, chuyển miền, cấp quyền hoặc bỏ qua audit.

## Contracts và storage

- `GET /api/v1/geography`: VN, 3 miền, 8 vùng.
- `GET /api/v1/destinations`: q/region/tourismRegion/offset/limit, limit tối đa200, hasMore; chỉ published/VN/chưa xóa. Web đọc các trang, giới hạn tải2.000 destination và báo lỗi rõ nếu vượt.
- `GET /api/v1/places`: thêm region/tourismRegion, có thể kết hợp destinationId; cặp miền/vùng sai bị400. Mọi danh sách public lọc qua destination published/VN, giới hạn tối đa2.000 điểm đến/query và yêu cầu thu hẹp nếu vượt. Read/detail và saved hydration cũng kiểm destination; destination đã ẩn chỉ còn quan hệ saved unavailable của chính owner, không trả nội dung.
- `GET /api/v1/admin/destinations`: query như public, gồm cả draft/archived.
- `POST /api/v1/admin/destinations`: `{destination:{name,slug,summary,tourismRegion,publicationStatus}}`, UUID Idempotency-Key.
- `PATCH /api/v1/admin/destinations/:id`: thêm expectedRevision; stale409 giữ input. Key cũ/body khác409. Slug trùng409. countryCode/source/actor/region do server quyết định, client gửi thêm bị400.
- destinations thêm tourismRegion nullable; dùng lại idempotency_keys/audit_logs, không collection mới. Mutation/audit/receipt cùng transaction, audit lỗi rollback. New audit entityType destination; không ghi thông tin private vào prompt/log.
- Prompt versions mới vietnam-v1/vietnam-rank-v1/goe-v4, plannerVersion4; Goe apply vẫn nhận v1/v2/v3.

## Kiểm chứng

Đã quan sát trên Windows, Node24.15/npm11.12, MongoDB8.2 và Edge headless:

- PASS typecheck, lint, format toàn repo, build. Cảnh báo Vite chunk >500kB vẫn còn; chưa deploy public hoặc xác nhận CI GitHub trong task.
- PASS51 unit/HTTP tests, gồm3 kiểm tra geography/cap100, strict input và các guard planner/provider hiện có.
- PASS toàn bộ100 integration checks (kể cả subtests), 71.8s, dùng replica set27021 do harness sở hữu. National suite kiểm tra cả8 vùng, tên điểm đến từ server, không lẫn ID/giá/nguồn giữa catalog, thiếu dữ liệu trước quota, đọc/lưu/chỉnh một ngày/apply/đổi ngày ngoài Hội An, admin/owner, revision race, retry/hash, audit rollback và hidden destination.
- PASS9 browser regression checks avatar/khám phá/bản đồ; PASS1 quick mobile plan với lost-response retry, đổi/bỏ/hoàn tác điểm, chọn ngày, lưu và reload. PASS3 catalog browser tests cuối (40.8s), gồm2 Admin V2 cũ và1 luồng mới admin tạo/phân vùng điểm đến Bắc → reload → khách chọn trên320/390/768px → catalog thiếu503, giữ thông tin và chưa có đề xuất giả.
- Đã xem screenshot local `.local/national-planner/admin-regions.png`, `customer-empty-catalog.png`; chỉnh spacing bảng để tên/vùng/trạng thái không dính nhau. Artifacts ignored, không thêm binary ảnh vào Git.

Đã chuẩn hóa foundation spec sang `.ts` cùng các spec còn lại, contracts thêm default export condition cho Node24 require(ESM), khắc phục lỗi import khi thu thập nhiều nhóm spec cùng lúc. Fixture quick plan được bổ sung giá/giờ/venue rõ trong DB test để đúng guard hiện hành; đổi ngày kiểm tra run provenance mới thay vì giữ runId cũ. Các lượt đầu lỗi fixture/selector/module đã được sửa và chạy lại; không coi các lượt lỗi là PASS.

Provider trong test là fixture được gắn nhãn; không dùng quota trả phí hoặc nhập dữ liệu vào database goease để chứng minh phạm vi toàn quốc. Chưa chạy full browser suite, chưa kiểm chứng AI live cho mọi vùng, chất lượng catalog thật cả nước, polygon/route/weather hay thiết bị vật lý. Bài E2E retry mật khẩu đã ghi ở CLOUDINARY-MEDIA.md không được chạy lại trong task này. Không clear, tự phân loại legacy, seed lại hoặc nhập nguồn thật vào database ứng dụng.
