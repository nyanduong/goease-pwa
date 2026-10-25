# Bổ sung dữ liệu toàn quốc — CAT-24

Owner yêu cầu ngày 26/10/2026: triển khai bộ bổ sung dữ liệu hàng loạt cho toàn bộ 26.566 địa điểm và bật cả 34 tỉnh/thành. Bật tỉnh khác với xuất bản địa điểm; không tự đổi publication của POI. Không thu hẹp scope thành bộ mẫu.

## Vận hành

Chạy `npm run dev`, mở Admin → Đợt thu thập → **Bổ sung dữ liệu toàn quốc**. **Bổ sung toàn bộ** tạo snapshot danh sách địa điểm chưa xóa thuộc danh mục tỉnh Việt Nam hiện có, không phụ thuộc bộ lọc tỉnh đang xem. Chỉ một đợt active trên toàn hệ thống. Retry cùng Idempotency-Key trả cùng job, không tạo đợt thứ hai.

Worker API ghi tối đa 500 item/lượt population, lưu cursor sau khi upsert idempotent từng item. Kết thúc population mới giao tối đa 50 mục/lượt, tối đa 150 mục đang theo dõi chờ nguồn; đọc lại tối đa 100 mục/lượt theo nextCheckAt để không bỏ đói mục phía sau. Địa điểm đã published/archived/xóa được ghi skipped, không đổi nội dung. Khóa biên tập, revision, active lease và source result đã có được giữ. Giờ/giá mới chỉ bổ sung phần observation còn thiếu, không thay bằng chứng cũ cùng context. Mục có dữ liệu/phiên bản không hợp lệ cần kiểm tra riêng, không làm dừng cả đợt.

Đóng tab vẫn chạy khi API còn hoạt động. Tắt API/máy dừng xử lý; lần khởi động kế tiếp tự tiếp tục từ MongoDB, lease hết hạn được nhận lại. **Tạm dừng giao việc** ngừng giao thêm mục mới cho đợt; việc đã giao và các worker tìm nguồn độc lập vẫn có thể hoàn tất. **Tiếp tục** dùng revision hiện tại; thao tác từ tab cũ bị từ chối. Admin bị thu hồi quyền sẽ làm đợt tạm dừng ở lượt kiểm tra tiếp theo.

Sau khi kết thúc lượt tìm, có thể tạo đợt mới để kiểm tra lại các mục chưa đầy đủ; không reset toàn bộ quan sát hoặc buộc tải lại ảnh đã có. Tạo đợt mới là thao tác tường minh, không tự lặp vô hạn. Counts là kết quả ở thời điểm xử lý từng item, không thay thế kiểm tra eligibility trực tiếp lúc xuất bản.

## Ý nghĩa trạng thái

- **Chưa xử lý**: đã đăng ký scope, chưa được giao.
- **Đang tìm / chờ nguồn**: có search pending/searching; có thể đang cooldown.
- **Cần duyệt / kiểm tra**: có dữ liệu nguồn cần duyệt hoặc bản nháp/phiên bản cần kiểm tra, chưa chắc đủ xuất bản.
- **Đủ dữ liệu cho Goe**: có bìa hợp lệ, giới thiệu, tọa độ, giờ đã đối chiếu, giá còn hạn đủ dùng, qua validation input published. Đây là danh sách xem trước; vẫn chưa tự xuất bản.
- **Chưa tìm được nguồn**: lượt tìm trong nguồn hiện hỗ trợ không có kết quả phù hợp. Không có nghĩa đã tìm hết web hoặc địa điểm không tồn tại.
- **Giữ nguyên**: mục đã công khai, lưu trữ hoặc không còn tồn tại.

Mở **Xem từng địa điểm** để lọc/phân trang20 mục, xem thông tin thiếu, bấm **Xem & duyệt** tới editor. Xuất bản vẫn qua luồng preview/bulk publish hiện có; không suy giá0, giờ24/7 hoặc tự đánh dấu thông tin nguồn reviewed=true.

## Nguồn và giới hạn thực tế

Điều phối lại các provider thật hiện có: OSM chính xác theo ID → giờ/phí và website liên kết; Wikidata qua entity/tên+tọa độ → website; Wikipedia liên kết/tên+tọa độ → mô tả có revision/giấy phép; Wikimedia Commons có kiểm tên/quyền → một bìa lossless Cloudinary và tối đa4 link ảnh nguồn. Mô tả tiếng Anh chỉ dịch qua provider đã cấu hình và quota hiện có; không có credential/quota thì giữ needs_translation. Không sinh mô tả bịa hoặc giá ước đoán để vượt gate.

**Chưa tích hợp Google Maps/Places, chưa có công cụ search toàn web cho mọi website, chưa có tác vụ sinh ảnh AI hàng loạt.** Bộ này xử lý toàn bộ danh sách bằng nguồn đã hỗ trợ, không bảo đảm tìm đủ dữ liệu cho mọi mục. Không đồng nhất “đã giao tìm 26.566 mục” với “26.566 mục đã có nguồn/đủ xuất bản”. Cloudinary hoặc provider hết hạn mức sẽ tạo kết quả lỗi/chờ, không dùng link nguồn làm bìa giả đã lưu.

Wikipedia/Wikidata/OSM/website trả429 hoặc503: tuân Retry-After (seconds/date, tối thiểu60giây; thiếu header chờ5phút), giữ pending, hoàn lại attempt vừa claim và lưu nextAttemptAt/message để worker khôi phục cooldown khi initialize. Rate limit không bị ghi thành empty/đã xác minh. Worker ảnh giữ cơ chế cooldown riêng và pool tối đa4. Bounded concurrency không vượt giới hạn nhà cung cấp; không có ETA hoàn thành toàn quốc được xác nhận.

## API và persistence

### Chạy song song — cập nhật26/10/2026

Mô tả dùng pool `DESCRIPTION_WORKER_CONCURRENCY=3`, giờ/giá dùng `VISIT_WORKER_CONCURRENCY=4`; server kiểm số nguyên1–8. Hai pool kiểm slot mỗi1giây, thay cho một task mỗi5giây. Pool ảnh giữ3 mặc định (giới hạn4). Đây là tác vụ I/O đồng thời trong một API, không phải worker_threads hoặc nhiều Express server; không thay MongoDB service hay tạo bản sao danh mục. Atomic per-place claim/token/revision tiếp tục chống nhận trùng; stop ngừng giao việc rồi drain các tác vụ đang chạy.

Các lượt HTTP dùng chung bộ xếp hàng theo origin: mỗi origin một request đang chạy, cách thời điểm bắt đầu tối thiểu1giây; website khác vẫn chạy độc lập. Wikipedia fetch giữ slot đến khi đọc xong JSON giới hạn dung lượng. HTTPS source giữ DNS pinning/timeout/size bounds, giải phóng slot trước khi theo redirect để không tự chờ chính origin của mình. Kiểm lại cooldown sau khi đợi slot, không gửi tiếp các request đã xếp hàng nếu nguồn vừa trả429/503. Giữ Retry-After/backoff đã lưu; tăng concurrency không bỏ qua quota hoặc restart để né cooldown. Hàng đợi origin ở RAM, tự giải phóng khi nhàn rỗi; không thêm collection/index/public DTO.

Đã cấu hình local3/4; tiếp tục cùng đợt26.566 mục hiện có, không reset attempt/nextAttemptAt, không tạo đợt hoặc POI mới. Mốc37giờ từng được tính từ nhịp tuần tự cũ không còn là ETA của cấu hình này. Chưa đo được ETA hoàn thành toàn quốc trên nguồn thật; latency, giới hạn nguồn và chất lượng kết quả vẫn quyết định thời gian/coverage. Không suy tốc độ thực từ benchmark fixture. Unit kiểm pool bounded/drain/per-origin isolation; integration riêng27021 xác nhận peak3/4, unique claims, giữ revision/publication và cooldown sau initialize.

- `GET /api/v1/admin/catalog/enrichment?offset=0&state=all`: job mới nhất, counts,20 item và hasMore; admin-only.
- `POST /api/v1/admin/catalog/enrichment`, body `{}`, UUID Idempotency-Key: tạo đợt toàn quốc, trả ID. Scope/actor được server xác định.
- `PATCH /api/v1/admin/catalog/enrichment/:id`, `{action:pause|resume,expectedRevision}`: điều khiển có version guard, admin-only.

Contracts thuần TypeScript tại packages/contracts/src/catalog-enrichment.ts. Hai collection operational có schema Mongoose strict: catalog_enrichment_jobs (bounded destinationIds<=34, scope/cursor/lease/revision) và catalog_enrichment_items (unique jobId/placeId, verdict/missing tối đa5, nextCheckAt). Không mảng26.566 item trong job, không lưu source HTML/binary. Partial unique singleton chỉ một job active; unique actor/requestKey giữ receipt không TTL. Không purge hoặc sửa DB khác.

Tạo/control job và audit catalog.enrichment_started/catalog.enrichment_controlled cùng transaction; audit entityType catalog_enrichment_job, metadata IDs/revision/actor, không source bodies/credentials. Worker không có quyền xuất bản; tiếp tục dùng observation leases/token/revision fences và catalog proposal defaults. Job lease120s ngăn hai process điều phối trùng; seeding upsert/cursor có thể replay sau crash. Quyền admin được kiểm lại khi điều phối.

## Kiểm chứng

Integration trên MongoDB test riêng27021 kiểm admin guard, start idempotency/one-active, population resume, pause/resume revision conflict, source merge, editorial revision/publication không đổi, audit và cooldown không tiêu hao attempt. Unit kiểm Retry-After seconds/date và không gọi lại Wikipedia trong cooldown. UI kiểm bằng browser riêng; không dùng fixture làm bằng chứng nguồn thật đã đầy đủ. Kết quả live và số item xử lý phải đọc lại MongoDB ở thời điểm bàn giao.

## Lượt chạy thật ngày26/10/2026

Đã bật34/34 tỉnh/thành qua destinationCatalog.toggle:30 thay đổi,4 đã bật; ghi audit/receipt, không gọi nhập Geoapify mới. Đã tạo job `6ade45ecbadd222572486434`, đăng ký đúng26.566 item, seeded=true. Đọc lại lúc01:17:42 giờ Việt Nam: running, queued26.411, waiting150, review3, ready1, skipped1. Đây là kết quả xử lý của đợt mới ở thời điểm đó, không thay số5 mục đầy đủ đã xác nhận trong audit dữ liệu trước. Publication vẫn26.565 draft và1 published, không có xuất bản hàng loạt trong tác vụ này.

Đã sửa trường hợp capacity0 bị MongoDB hiểu limit(0) là không giới hạn: bỏ hẳn truy vấn dispatch khi pool đầy, bổ sung regression integration. Đã đưa9.451 item theo dõi vượt cửa sổ trở lại queued qua lượt điều khiển pause/resume có audit; không ghi lại source observations/nội dung biên tập/ảnh hoặc publication. Đọc lại xác nhận waiting150. Nguồn vẫn chạy qua pool hiện có và provider cooldown; không có thêm9.451 provider call từ việc sắp lại item operational này.

Kiểm tra đã quan sát: typecheck đạt, lint đạt, build đạt (còn cảnh báo client chunk>500kB);107unit đạt; integration enrichment và photo pool đạt, gồm capacity-zero regression;1browser test mới đạt trên API3001/web5181/MongoDB test27021, đã xem ảnh desktop và mobile. Test namespace không dùng database ứng dụng27017. Các file journal/evidence thật lưu ignored trong `.local/manual-tourism-import-20261025`, gồm national-enrichment-started.json, national-enrichment-live-status.json, all-provinces-enabled.json, enrichment-window-reconciled.json. API thật3000 đã trả health/db connected. Không claim hoàn tất bổ sung26.566 địa điểm hoặc có ảnh/giá thật cho tất cả.
