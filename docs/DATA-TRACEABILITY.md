# GoEase — Truy vết, Analytics và Vòng đời dữ liệu v0.2

CAT-19: admin UI bật tỉnh → province-imports → geocode/configured area → catalog_campaigns + catalog_runs.scopeSnapshot (areaLabel/areaSource) + audit → catalog_source_usage → places draft + catalog_reviews → bulk preview/execute theo CAT-17. Lookup geocode ghi usage riêng, không phải POI; không có raw payload hay provider key trong DTO. Xem PROVINCE-IMPORT.md.

CAT-18: bootstrap/adoption/legacy classification ghi catalog.destination_catalogued với actor system; toggle ghi catalog.destination_updated với actor admin, previousRevision/entityRevision và receipt destination.toggle cùng transaction. Không có audit nội dung tên/giá riêng tư. Legacy IDs, POI/trip references và snapshots giữ nguyên; không purge. Xem PROVINCE-CATALOG.md.

## Đăng ký OTP — AUTH-10, 25/10/2026

Register payload → Argon2id/hash browser binding + OTP → auth_challenges tạm → SMTP → verify có binding/expiry/attempt cap → consume + user/identity verified + session + audit cùng transaction. Email/tên/hash tạm chỉ trong challenge; OTP raw ở mail adapter, raw browser binding trong response và RAM client, không URL/log/audit/storage. Thành công xóa tên/passwordHash/OTPHash; TTL dọn challenge sau10phút, không thay kiểm tra hạn khi dùng. Mã sai/cooldown lưu MongoDB; hạn mức network/account vẫn bộ nhớ process. Không thêm analytics, outbox hoặc retention job tổng thể. SMTP lỗi thu hồi challenge, không tạo account. Đã xác nhận gửi/nhận OTP Gmail thật và consume thành công trên cấu hình local ngày25/10/2026; account cũ và flag false giữ hành vi cũ. Xem [EMAIL-REGISTRATION](EMAIL-REGISTRATION.md).

## Việt Nam và phân vùng — 24/10/2026

CAT-16/AI-01–04: admin session → strict destination input + expectedRevision + stable key/hash → destination update/create + actor metadata + catalog.destination_created/updated audit + idempotency receipt cùng transaction. Không audit snapshot/full name/ghi chú/quyền từ client. Đổi vùng giữ destinationId, place.source.externalId và trip snapshot. Thiếu vùng cũ không bị tự suy từ địa chỉ hoặc xóa. Region public được suy từ tourismRegion; query sai cặp miền/vùng bị từ chối. Public/admin pagination và publication boundary được kiểm tra.

Planner: destination published/VN → published catalog đúng destinationId → lọc giá/giờ/nhóm khách → bounded/balanced candidate list → kiểm coverage trước quota → provider payload dùng tên điểm đến từ server → kiểm ID/ngày/giờ/giá → proposal có provenance → owner/revision apply hiện có. Prompt version vietnam-v1/vietnam-rank-v1/goe-v4, plannerVersion4; apply nhận cả goe-v1/v2/v3 cũ. Không thêm collection, purge, telemetry hay nhập/xóa dữ liệu ứng dụng. Xem [Việt Nam planner](VIETNAM-PLANNER.md).

## Ảnh tĩnh Cloudinary — 24/10/2026

CAT-06/AUTH-09: Git sourcePath → upload có chữ ký phía server, overwrite=false, đích cố định `goease/` → manifest assetId/publicId/folder/version/URL/bytes/dimensions/SHA-256 → GET bản gốc và đối chiếu checksum → thay URL web/API/tài liệu → xóa 73 binary khỏi checkout. Prompt/credit/nhãn AI được giữ. Không log secret hay raw provider error. Không ghi user/trip/catalog/audit hoặc sửa lịch sử để chuyển URL; DTO ánh xạ allowlist các path local cũ. Không tạo media_assets model, analytics, retention/purge job hay quyền upload người dùng. Xem [hướng dẫn và bằng chứng](CLOUDINARY-MEDIA.md); các ghi nhận “local/chưa upload Cloudinary” phía dưới là lịch sử trước lần chuyển này.

## Catalog automation trace — 23/10/2026

CAT-11–13: admin session → revision-checked schedule + audit + receipt → MongoDB due schedule → atomic run claim → durable quota reservation → Geoapify fixed-scope allowlist → transaction fenced on run → draft places / separate sourceSnapshot + sourceCheckedAt / deduplicated catalog_reviews / run counts + audit. No provider call in transaction and no replay-dependent browser preview. Crash/failure before commit leaves no partial catalog writes; expired run can be reclaimed. Retry is bounded; failed run becomes an intervention item, backoff remains system work. Schedule default off; configured system actor does not inherit admin's trip visibility or publication power.

User decision → expected review revision AND place revision → source-only changed fields or archived/snoozed/resolved state → same transaction audit + receipt. Keep/ignore remembers source fingerprint; unchanged source cannot reopen it. Pending source review preserves earlier baseline across subsequent changed observations, avoiding loss of unapplied changes. Revisit time is explicit. Per-place/kind uniqueness prevents duplicate open issues. Missing price/photo/hours is not a mandatory issue; expired existing price is. New observations never rewrite editorial content by themselves, and absence in provider search never archives a place.

Batch preview → server eligibility per selected revision → per-item published/archived outcomes + audits + typed receipt in one transaction. Business conflicts become item failures; database/audit failures roll back transaction. Same-key retry within24h returns stored per-item result without new audit. Published-only public/planner and existing trip snapshots use unchanged consumer boundaries; no bulk write to trips, expenses, favorites or AI runs.

Each run has a stable operationId joining request/result and per-place imported/source_changed audits. Unchanged checks are summarized in the run event. Storage additions and exact indexes: DB-BASELINE.md / collection-registry.json. Audit retains user/system, operation/request ID, action, target/revision/time/outcome, not source bodies, credentials or customer information. Quota actor IDs stay server-side. Views expose safe localized summaries; technical run ID only in optional details. No new analytics, raw provider store, retention deletion or automatic purge.

Ngày: **22/10/2026** · Baseline thiết kế v0.2 được chấp thuận; F1-B đã triển khai context/log/audit probe test-only; task sản phẩm tiếp theo thêm audit tài khoản/phiên/trip và trip_revisions cùng transaction. Analytics và quy trình retention/purge toàn nền tảng chưa triển khai. Xem [nghiệm thu](PRODUCT-VERIFICATION.md). Nguồn chính về truy vết/vòng đời; đọc [BR](BR.md), [dictionary](DB-BASELINE.md) và [review/gates](F1-HANDOFF.md). Các thời hạn trong tài liệu là **đề xuất kỹ thuật để review**, không phải thời hạn pháp luật đã xác nhận. Không triển khai theo dõi người dùng không thông báo chỉ vì schema có sẵn.

## 1. Bốn nhóm dữ liệu khác nhau

### Khám phá — runtime 2026-10-22

CAT-07: `favorites.note` private theo userId từ session, tối đa2.000 ký tự; optimistic revision tránh ghi đè giữa thiết bị. Public place DTO không chứa note, HTTP logger chỉ ghi route template và không ghi body/query ghi chú. Bỏ lưu giữ note; xóa note bằng chuỗi rỗng. Chưa có audit sự kiện favorites hoặc purge/retention job. GET saved hydrate qua publication/deleted checks, target archived không còn cho xem/sửa nội dung qua API. SavedPlacesDto bổ sung unavailable chỉ chứa placeId và state thuộc chính user; cho phép PATCH saved=false không kèm note để bỏ quan hệ đã ẩn, vẫn kiểm tra ownership/revision. Thêm vào trip dùng API ownership/idempotency/revision hiện có, snapshot title/category/note của hoạt động thủ công, giá chưa biết là null; lịch đã lưu không bị tự sửa khi catalog thay đổi. Ba ảnh mới là AI local, không sao chép ảnh của nguồn tham khảo và chưa upload Cloudinary.

| Nhóm              | Câu hỏi cần trả lời                                   | Nơi lưu                                          | Điều không nên làm                             |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Business state    | Hiện chuyến/đơn/user đang ở trạng thái nào?           | trips/users/orders/...                           | Dùng event analytics làm nguồn xác nhận tiền   |
| Audit trail       | Ai thay đổi cái gì, khi nào, vì sao, qua yêu cầu nào? | audit_logs; trip_revisions cho nội dung phục hồi | Chỉ dựa updatedAt hoặc log full document       |
| Product analytics | Người dùng tìm gì, bỏ ở bước nào, gợi ý có ích không? | analytics_events + aggregate được phép           | Thu mọi click/free text/GPS và giữ vô thời hạn |
| Technical logs    | Vì sao API lỗi/chậm, request nào/provider nào?        | Structured JSON stdout/log sink có rotation      | Ghi mỗi request/response body vào MongoDB      |

OWASP lưu ý các loại log phục vụ mục đích khác nhau nên thường cần tách biệt; không nên log quá nhiều hay quá ít, và phải loại bỏ/che dữ liệu nhạy cảm [S7].

## 2. Field tối thiểu để truy vết

- **requestId:** backend sinh/kiểm tra; frontend nhận để gửi support. Không tin string client dài tùy ý hoặc log-injection.
- **correlationId:** nối một flow nhiều request, ví dụ tạo lịch → apply → lưu → gửi yêu cầu; không là thông tin xác thực.
- **operationId:** khóa một hành động nghiệp vụ đã commit, dùng dedupe audit/outbox.
- **actor:** identity đã xác thực hoặc system/provider; phân biệt admin thao tác với user chủ dữ liệu.
- **entityType/entityId/revision:** đối tượng bị tác động và phiên bản.
- **occurredAt/recordedAt:** lúc xảy ra và ghi nhận; timestamp client phải được đánh dấu không đáng tin hoàn toàn.
- **action/outcome/reasonCode:** taxonomy kiểm soát, không câu tự do chứa PII.
- **appVersion/environment:** đối chiếu release, loại traffic test khỏi KPI.

### Ví dụ audit — không có email, mật khẩu hoặc toàn bộ itinerary

```json
{
  "eventId": "audit-demo-001",
  "schemaVersion": 1,
  "action": "trip.visibility_changed",
  "category": "trip",
  "actor": { "type": "user", "userId": "<internal-user-id>" },
  "entityType": "trip",
  "entityId": "<trip-id>",
  "entityRevision": 8,
  "occurredAt": "2026-10-22T05:45:00.000Z",
  "recordedAt": "2026-10-22T05:45:00.012Z",
  "requestId": "req-demo-001",
  "correlationId": "flow-demo-001",
  "operationId": "op-demo-001",
  "outcome": "succeeded",
  "changedFields": ["visibility"],
  "changes": [
    {
      "path": "visibility",
      "before": "private",
      "after": "shared_link",
      "redacted": false
    }
  ],
  "source": {
    "clientPlatform": "web",
    "channel": "api",
    "environment": "development",
    "appVersion": "0.1.0"
  },
  "retentionClass": "business_audit",
  "legalHold": false
}
```

Đây là dữ liệu minh họa, không phải event đã xảy ra. Các `_id`, timestamps và actor không nhận nguyên từ request body.

## 3. Tính nhất quán: sửa dữ liệu không được làm mất lịch sử

Một save trip thành công theo thiết kế:

1. Xác thực session/account và quyền với trip đang hoạt động.
2. Validate request, expectedRevision và idempotency key.
3. Mở transaction trên MongoDB replica set; cập nhật trip theo revision.
4. Ghi `trip_revisions` cần phục hồi và audit event trong cùng session/transaction.
5. Nếu cần thông báo/analytics server, ghi outbox tương ứng sau khi kiểm tra purpose/consent; không copy dữ liệu nhạy cảm.
6. Commit; sau đó mới trả success. Worker xử lý outbox ngoài transaction, có retry/dedupe.

Nếu lỗi ở bước audit/revision bắt buộc, mutation bị rollback, không trả success một nửa. MongoDB hỗ trợ atomicity của một document và transaction nhiều document [S6]. Nhưng **không đặt API AI/thanh toán/email trong transaction có thể tự chạy lại**, vì side effect bên ngoài không tự rollback và có thể bị lặp.

Sự kiện auth thất bại/denied ghi vào security audit độc lập; không để rollback transaction nghiệp vụ làm mất bản ghi thất bại. External analytics delivery lỗi không được làm biến mất order đã commit; outbox đảm bảo có việc cần retry. Outbox là at-least-once, consumer idempotent; không tuyên bố exactly-once end-to-end.

### Chặn đường cập nhật không có audit

Dùng service boundary, không chỉ Mongoose middleware: route, background job, bulk tool, migration và admin script phải có actor/operation context. Kiểm thử toàn bộ đường mutation. Log access/export chính audit logs cũng cần ghi nhận. DB account ứng dụng không có quyền sửa/xóa audit ngoài nhiệm vụ được cấp; thao tác DBA cần quy trình và giám sát riêng. Schema không thể tự ngăn một DBA có toàn quyền.

## 4. Event taxonomy tối thiểu

Các property dưới đây là allowlist đề xuất; **không có trường arbitrary metadata**. `userId`, `environment`, trustLevel do server gán hoặc kiểm chứng. Mọi event có eventId/eventVersion/occurredAt/receivedAt/platform và policy evidence tương ứng.

| Event                        | Nguồn tin cậy            | Property cần thiết                                             | Mục đích                                                                    |
| ---------------------------- | ------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| discovery_viewed             | client                   | destinationId?, surface                                        | Mức khám phá; optional analytics                                            |
| destination_search_performed | client/server            | queryCategory?, resultsCount, selectedDestinationId?           | Chất lượng tìm kiếm; không raw query mặc định                               |
| recommendation_impression    | client                   | recommendationId, itemId, rank, surface, modelVersion          | Mẫu số để đo hiệu quả đề xuất                                               |
| recommendation_selected      | client                   | recommendationId, itemId, rank                                 | Click/chọn; không đồng nghĩa booking                                        |
| signup_completed             | server                   | method:google/password                                         | Conversion đăng ký; không email                                             |
| trip_creation_started        | client                   | entryPoint, destinationId?                                     | Bước vào form                                                               |
| trip_generation_requested    | server                   | aiRunId, tripDays, groupSizeBucket, budgetBand, destinationIds | Chi phí/funnel; essential metadata phục vụ vận hành tách analytics tùy chọn |
| trip_generation_completed    | server                   | aiRunId, generationMode, latencyBucket, warningCount           | Thành công có validation                                                    |
| trip_generation_failed       | server                   | aiRunId, errorCode, provider                                   | Chất lượng/availability; không raw provider body                            |
| itinerary_activity_replaced  | server                   | tripId, activityCategoryBefore/After, recommendationId?        | Chất lượng recommendation; chỉ khi purpose hợp lệ                           |
| trip_first_saved             | server                   | tripId, generationMode, tripDays, destinationIds               | Activation; một lần cho mỗi trip, không mỗi revision                        |
| trip_reopened                | server/client xác nhận   | tripId, daysSinceFirstSaveBucket                               | Dùng lại sản phẩm                                                           |
| favorite_toggled             | server                   | targetType, targetId, enabled                                  | Sở thích hành vi theo consent                                               |
| service_inquiry_submitted    | server                   | listingId, serviceType, destinationId?                         | Lead generation; không message/contact                                      |
| partner_referral_clicked     | client/server            | partnerId, listingId, serviceType, campaignCode?               | Click outbound, không giả commission                                        |
| checkout_started             | server                   | orderId, productType, currency, amountBand                     | Funnel mua; chi tiết order nằm business DB                                  |
| payment_verified             | server/provider verified | orderId, paymentId, amountMinor, currency, productType         | KPI tài chính từ dữ liệu đã xác minh, quyền đọc riêng                       |
| refund_verified              | server/provider verified | orderId, refundId, amountMinor, currency                       | Net collection; không xóa event thanh toán cũ                               |
| review_submitted             | server                   | targetType, targetId, rating, verification                     | Review quality; không body tự do                                            |
| consent_changed              | server                   | purpose, newStatus, policyVersion                              | Evidence/privacy; không ép thành optional event để bỏ mất                   |

Security/business events thiết yếu có căn cứ và mục đích riêng; không gọi tất cả là analytics rồi buộc consent, cũng không đổi mọi analytics thành “thiết yếu” để thu khi user từ chối.

## 5. Các câu hỏi kinh doanh dữ liệu này trả lời được

| Câu hỏi                               | Định nghĩa đo lường đề xuất                                                                     | Lưu ý tránh hiểu sai                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Bao nhiêu người thật sự nhận giá trị? | Unique users có trip_first_saved / unique users đã hoàn tất signup trong cohort/window          | Không đếm retry, revision và test accounts                                         |
| Form khó ở đâu?                       | Funnel trip_creation_started → generation_requested → generation_completed → first_saved        | Không khẳng định bước bỏ là lỗi UI nếu provider timeout                            |
| AI có ích không?                      | Tỷ lệ proposal applied, activity replaced/removed, saved/reopened trên từng model/promptVersion | Ghi impressions và mẫu số; chỉ click dễ bị selection bias                          |
| Khách quan tâm nơi nào/chi phí nào?   | Destination IDs + budgetBand + groupSizeBucket trên event được phép                             | Không phải nhu cầu đại diện toàn thị trường; cohort có consent khác cohort còn lại |
| Chi phí AI có bền không?              | Provider cost của successful/failed runs, cost/first_saved_trip, token usage theo model         | Ước tính providerCost cần nhãn; đối soát hóa đơn thật                              |
| Có doanh thu chưa?                    | Tổng payment verified trừ refund verified; tách GMV/thu hộ/phí platform                         | Không gọi gross receipts là lợi nhuận/doanh thu kế toán                            |
| Giữ chân người dùng?                  | Cohort first_saved, quay lại thực hiện hành vi có giá trị trong cửa sổ định nghĩa               | UserId pseudonym cũng là dữ liệu cá nhân có thể liên kết                           |

Một giá trị currency không so sánh trực tiếp với currency khác; amountBand cần versioned thresholds. `trip_first_saved` business unique theo tripId, `payment_verified` unique theo paymentId/state; eventId dedupe đơn thuần chưa đủ nếu client/server sinh eventId mới khi retry.

## 6. Bảng phân loại dữ liệu và retention đề xuất

| Lớp dữ liệu                       | Mục đích                                       | Quyền truy cập                        | Mốc dự thảo để review                                                |
| --------------------------------- | ---------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Password hashes/tokens session    | Xác thực                                       | Auth service, không support/analytics | Theo identity/session lifecycle; revoke/expiry ngay tại app          |
| Reset/verify challenge            | Thao tác một lần                               | Auth service                          | Phút/giờ theo purpose; chỉ hash, consume một lần                     |
| User/trip private                 | Cung cấp dịch vụ                               | Owner và quyền được cấp               | Đến khi xóa; trash đề xuất 30 ngày rồi purge                         |
| Trip revisions                    | Khôi phục và hỗ trợ thay đổi                   | Owner + đường support có quyền        | Theo trip; không giữ vĩnh viễn sau purge                             |
| Technical logs                    | Debug, vận hành                                | Engineering giới hạn                  | Đề xuất 14–30 ngày, rotation, redaction                              |
| Security audit                    | Điều tra lạm dụng                              | Security/admin được cấp               | Đề xuất 90 ngày, điều chỉnh có căn cứ                                |
| Business audit không tài chính    | Truy vết mutation                              | Owner subset/support/admin            | Đề xuất 180 ngày, tối thiểu hóa liên kết khi purge                   |
| Analytics raw được phép           | Funnel/cá nhân hóa                             | Analytics theo quyền                  | Đề xuất 90 ngày; hết hạn dọn, không blanket forever                  |
| Aggregate thực sự không nhận diện | Thống kê dài hạn                               | Business analytics                    | Có thể dài hơn sau đánh giá tái nhận diện, ngưỡng nhóm nhỏ           |
| AI prompt/output raw              | Không cần mặc định                             | Không thu mặc định                    | Nếu cần debug opt-in/limited phải review riêng, TTL ngắn, encrypted  |
| AI run metadata/proposal          | Vận hành + áp dụng đề xuất                     | Planner service/owner subset          | Proposal 24h; metadata 90 ngày đề xuất                               |
| Orders/payments/refunds/ledger    | Thực hiện hợp đồng/đối soát/nghĩa vụ giữ hồ sơ | Finance, user subset, audit           | **Chưa đặt số năm tùy tiện; review pháp lý trước commerce**          |
| Consent/privacy request evidence  | Chứng minh quyền xử lý và thực hiện yêu cầu    | Privacy/security                      | Theo mục đích/căn cứ đã duyệt, không nhân bản full PII               |
| Backup/export                     | Khôi phục/đáp ứng yêu cầu                      | Operations/owner theo quyền           | Backup cycle giới hạn; export private hết hạn sớm, purge object thật |

Không dùng TTL global cho cả collection có legal hold. Nếu record có retentionUntil/hold, purge job kiểm tra từng loại và để lại chứng cứ tối thiểu phù hợp. Cần lịch review hold để không biến hold thành lý do giữ vĩnh viễn.

## 7. Quyền riêng tư ngay trong thiết kế

Luật Bảo vệ dữ liệu cá nhân số **91/2025/QH15** có hiệu lực **01/01/2026** [S12]. Tài liệu này chỉ đưa yêu cầu thiết kế giảm rủi ro; **không kết luận GoEase đã tuân thủ đầy đủ**. Trước public production cần rà soát văn bản triển khai còn hiệu lực, vai trò kiểm soát/xử lý, thông báo/consent, nhà cung cấp nước ngoài, đối tượng trẻ em và nghĩa vụ liên quan theo hoạt động thực tế.

Thiết kế đề xuất:

- Mỗi trường dữ liệu có purpose và người chịu trách nhiệm; không “thu được thì thu”.
- Optional analytics, cá nhân hóa và marketing tách lựa chọn. Người dùng từ chối vẫn dùng chức năng cốt lõi; các xử lý cần thiết có căn cứ riêng.
- Không fingerprint thiết bị, không lấy danh bạ, không thu vị trí chính xác liên tục. Địa điểm định đi do user nhập không có nghĩa user đang ở đó.
- Không ghi full URL có query token/Google code, toàn bộ referrer, nội dung form/prompt, notes, email hay số điện thoại vào analytics.
- ID pseudonym/HMAC/hash **không tự là dữ liệu vô danh** nếu vẫn liên kết với user hoặc có thể nhận diện lại.
- Nếu cần thông tin giấy tờ cho booking thực, lưu riêng/encrypt/access audit/retention theo provider; chưa cần thì không tạo form thu thập.
- Hỗ trợ rút lựa chọn và export/delete; cập nhật cache, analytics raw, revisions, media và downstream vendor theo policy. Ghi rõ phần buộc giữ và căn cứ, không hứa xóa hết ngay nếu nghĩa vụ giữ khác áp dụng.
- Backups có thời hạn; nếu restore phải áp dụng lại deletion/suppression để không làm sống lại dữ liệu đã xóa. Không tự sửa backup immutable đang lưu mà tuyên bố đã purge nếu chưa kiểm chứng.
- Dùng data để cải thiện gợi ý theo purpose đã thông báo khác với xuất raw data bán cho bên khác hoặc huấn luyện AI. Không tự bật secondary use.

## 8. Bộ kiểm thử truy vết tối thiểu

| Kịch bản                                           | Kỳ vọng                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Trip update thành công                             | Trip revision tăng, revision snapshot và audit có cùng operationId                         |
| Audit insert lỗi giữa transaction                  | Trip không bị cập nhật một nửa; client không nhận success                                  |
| Request retry do mất phản hồi                      | Cùng resource/revision, không duplicate trip/audit/entitlement                             |
| Hai editor cập nhật cùng revision                  | Một commit, một conflict 409, không mất nháp                                               |
| Admin đổi role/khóa user                           | Có actor, target, reason và requestId; user không tự nâng role                             |
| User opt-out analytics                             | Không ghi optional analytics mới; core save vẫn hoạt động                                  |
| Body chứa password/token/email/notes               | Log scanner không tìm thấy giá trị bí mật/PII chưa cho phép                                |
| TTL cleanup chưa chạy                              | Token đã hết hạn vẫn bị từ chối bởi service                                                |
| Soft-deleted target trong aggregate/populate/share | Không truy cập được theo đường thông thường                                                |
| Purge trip                                         | Revisions/share/expense và media phạm vi cần xóa không còn, order lịch sử đúng vẫn tồn tại |
| Provider webhook duplicate/out-of-order            | Không grant/refund trùng; không downgrade succeeded                                        |
| Mongo transaction retry                            | Không gọi charge/AI/email nhiều lần bên trong callback                                     |
| Backup restore sau erasure                         | Re-apply suppression, không khôi phục account/token đã thu hồi                             |

## 9. Technical logging thực tế cho Express

Dùng logger structured JSON (ví dụ Pino nếu chọn), output stdout để deploy/local dễ thu thập. Fields: level, timestamp, service, environment, appVersion, requestId, method, route **template** như `/trips/:id`, statusCode, latencyMs, sanitizedErrorCode. Không serialize req/res mặc định; redact header Authorization/Cookie, password, token, secrets, query nhạy cảm.

Health polling có thể giảm mức log để không ngập, nhưng security events không tắt im lặng. Stack trace nếu cần chỉ ở sink hạn chế với scrub, không response client. Ghi dữ liệu sản phẩm vào MongoDB theo taxonomy riêng; không thêm collection `logs` chung cho mọi thứ.

## Nguồn kỹ thuật và pháp lý đã đối chiếu

- [S5] MongoDB — TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- [S6] MongoDB — Transactions: https://www.mongodb.com/docs/manual/core/transactions/
- [S7] OWASP — Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- [S9] Google — OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- [S10] MoMo — Payment Notification: https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/
- [S11] Stripe — Webhooks: https://docs.stripe.com/webhooks
- [S12] Công báo Chính phủ — Luật 91/2025/QH15: https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578/57730.htm

Các cấu trúc, trạng thái và mức retention trong bộ tài liệu là thiết kế đề xuất của GoEase, không phải yêu cầu nguyên văn của các nguồn. Ngày đối chiếu: 22/10/2026.

## 10. Làm rõ F1-A về purge và dữ liệu dẫn xuất

Transaction save trip phải nối trips/trip_revisions/audit_logs bằng operationId; ghi idempotency completion trong cùng transaction nếu cần trả retry đúng kết quả. TTL xóa key không thay uniqueness nghiệp vụ. Audit nền F1-B ghi trực tiếp cùng transaction, chưa cần outbox.

Purge không chỉ xóa trips: phải lập inventory trip_revisions, trip_access, trip_share_links, trip_expenses, private media/object storage, server drafts, ai_runs.inputSummary/validatedProposal, idempotency result references, pending/delivered outbox, analytics raw/aggregates có thể nhận diện, exports/cache và downstream vendor. Từng mục có consumer/phạm vi/hold/retention riêng; không tự cascade sang orders/bookings/payments. Snapshot phục hồi không được làm sống lại link, quyền hoặc nội dung đã bị redaction do quyền nguồn.

Đây là inventory cần hoàn thiện trước purge, **không phê duyệt cách xóa/căn cứ/thời hạn mới**. R-07/R-08 trong handoff ghi gate. Thời hạn 24h/7/30/90/180 ngày trong bộ tài liệu vẫn là đề xuất. Public launch cần policy đã duyệt; F1-A không chạy purge, không xác nhận tuân thủ pháp lý. Backup restore cần áp dụng suppression trước khi mở truy cập; legal hold phải có căn cứ và review.

## 11. Context/log/audit F1-B thực tế

X-Request-Id và X-Correlation-Id chỉ UUIDv4 36 ký tự, chuẩn hóa lowercase; requestId không hợp lệ được thay mới, correlationId không hợp lệ bị bỏ. AsyncLocalStorage chỉ lưu hai ID này, không actor. Middleware bao phủ validation/404, response header X-Request-Id được expose CORS; bodies F0 giữ nguyên. Logger allowlist/event enum và giới hạn field được mô tả trong README/code; unmatched route là nhãn cố định, không raw URL/query/IP/body/headers/Error/cause. Không thu analytics hay lưu access log vào MongoDB. Sink technical lỗi không log vòng lặp; audit mandatory error vẫn throw.

OperationId do caller backend cấp độc lập requestId và giữ qua retry. F1-B audit test-only gán actor/source/time từ code; không tin actor/role/header/body và không có HTTP audit endpoint. Canonical comparison trong DB mục 12 bỏ timestamp/request/correlation của attempt nhưng kiểm tra business fields cùng actor/source constants; conflict không là success. Một session caller được dùng cho cả read và append; transaction race E11000 phải abort trước khi retry toàn callback. Tất cả side effect bên ngoài vẫn cấm trong callback.

APPEND không bảo vệ trước DBA trực tiếp và chưa cấu hình quyền DB production. Không có retention/purge/TTL production hoặc user audit trong F1-B. [Bằng chứng local](F1-B-VERIFICATION.md) không thay review privacy, deployment hay các acceptance auth/trip sau này.

### Luồng Hội An và ngân sách, 22/10/2026

Catalog giữ `planning.priceOptions[].sourceUrl/checkedAt` cho giá tham khảo biên tập; UI hiển thị nguồn/ngày đối chiếu. Người dùng chủ động chọn giá vào cost `user_entered`, có thể sửa; không tuyên bố giá đó vẫn được provider xác nhận. `placeId` giữ liên kết catalog, title/notes/cost đã lưu vẫn độc lập. Không có provider fetch hoặc telemetry mới. Preview ngân sách chỉ tính trên input đã validate, không ghi trip/revision/audit nghiệp vụ; lưu qua cơ chế audit/revision hiện tại. Nội dung trip và ghi chú vẫn không vào technical logs. Chưa lưu lịch sử giá catalog hoặc chứng từ báo giá.

## Gemini planner trace — 2026-10-23

AI-01/02: structured catalog selection → server date/time/place validation → ai_runs validated proposal. AI-03: explicit client apply → trip revision transaction with run owner/base-revision check → trip_revisions/audit. AI-04: request/run/model/prompt/planner IDs, summarized input, source IDs, timestamps and sanitized failures in ai_runs. AI-05: transactional UTC user/global usage_buckets plus per-run quotaState; ambiguous calls remain counted. AI-06: provider payload allowlist excludes account/title/private notes. Exact storage/contracts and verification gaps: [AI-PLANNER.md](AI-PLANNER.md). AI-07 and provider-cost analytics remain planned.

### Goe adjustment

Customer message + owned selected-day context → goe-v1 run using shared quota → validated single-day replacement + unchanged other days → GoeProposal before/after → explicit apply → trip/revision/audit transaction. UI retains run/key for lost-response retry; server enforces owner/base revision and computes budget. Raw message not stored or logged; provider sees bounded message, user decides what to enter.

Bản đồ Hội An2026-10-23: mapLocation có nguồn/checkedAt và nhãn area; bảng nguồn/quyền tại TRIP-MAP.md. Public DTO chỉ hydrate published/nondeleted. Trip giữ snapshot cũ, map đọc metadata catalog hiện tại; lỗi/thiếu tọa độ không được coi là vị trí thật. OSM chỉ nhận yêu cầu tile theo viewport; chỉ gửi truy vấn/tọa độ tới Google Maps khi bấm link, không gửi ghi chú riêng. Không lưu vị trí GPS người dùng hoặc cache bản đồ offline.

## Trip expenses — 2026-10-23

Expense runtime: trip_expenses records private descriptions, VND amounts and date-only spentOn for the trip owner. Session derives recordedBy/updatedBy/deletedBy; list/mutations verify active owned trip. Audit records identifiers/action/revision only, never description/amount. Soft delete hides records and excludes totals; no retention/purge job, receipt storage, activity link or payment proof. See TRIP-EXPENSES.md.

## Trip management — 2026-10-23

Owned source snapshot → duplicate mới với clonedFromTripId nội bộ, manual source và ID mới; không copy expenses/ai_runs/history/access. Soft delete giữ expense/history nhưng chặn truy cập bằng active owned parent; audit ghi actor/entity/revision, không tên/notes. Purge chưa có; share-links và restore đã triển khai ở các phần cập nhật bên dưới. Dời ngày không đổi ngày chi thực tế. Chi tiết TRIP-MANAGEMENT.md.

## Customer account — 2026-10-23

Profile data chỉ customer đã xác thực đọc/sửa. Password chỉ trong request/memory và Argon2id hash hiện có; không ghi requestHash từ mật khẩu hoặc receipt payload. Session giữ UUID key gần nhất để retry, mất khi session bị dọn. Audit profile.updated/password.changed chỉ actor/entity/action/revision, không tên/avatar/password/hash. URL ảnh chỉ browser tải với no-referrer; không proxy server. Quên mật khẩu/email delivery/upload media chưa triển khai. ACCOUNT-PROFILE.md ghi chi tiết.

## Read-only sharing runtime (2026-10-23)

TRIP-11/TRIP-12 → `trip_share_links` → `tripSharing` → `/shared-trip` explicit allowlist. Owner create/revoke emits trip.share_created/trip.share_revoked (entity=trip, actor from session, changedFields tripDetails, changes empty). No token/hash/notes/costs in audit/log. Soft delete updates all share revokedAt in the trip.deleted transaction; duplicate never copies shares. Existing trip expenseRevision serializes management writes, itinerary revision is unchanged. No public expense/account/private trip endpoint bypass; no share editing. Retention jobs remain unimplemented; revoked/expired records retained, expiry checked without TTL. API integration covers owner separation, retry/race, projection, expiry/revoke/delete/restore, rollback and log scanning; browser covers anonymous view, lost-response retry, mobile/map/revocation.

## Password recovery trace — 2026-10-23

AUTH-03/04/07/08 → auth_challenges(reset_password) → passwordRecovery → forgot/reset-password API → SMTP adapter. Request email binds existing password identity/active user; cannot select another user via payload. Raw random token only exists in delivery-task memory/message fragment; DB stores SHA-256, identity/securityVersion/delivery state and expiry. No reset target email in challenge, no token/email/password in audit/log/DTO. Successful reset emits password.reset, actor bound to token user, entity=user, changedFields accountState, changes empty. Transaction rollback covers consume/password/version/revocation/audit. Pending mail is unusable; failed delivery revokes it. TTL is cleanup only. No new retention/purge or durable raw-token queue. Owner deferred SMTP configuration, live delivery unverified.

## Trip trash — 2026-10-23

TRIP-09/10/12/13 → owned tombstone → tripManagement restore → same trip + new trip_revisions/restored + audit trip.restored + receipt trip.restore trong transaction. Owner từ session, không nhận owner/notes/amount từ restore body. Danh sách thùng rác chỉ metadata, không snapshot riêng. Actual expense documents giữ nguyên; expense đã xóa riêng vẫn ẩn. Share revokedAt không bao giờ clear. Log chỉ route template/action/IDs, không tên/ghi chú. Chưa có purge/retention job; TRIP-MANAGEMENT.md mô tả giới hạn.

## Offline itinerary — 2026-10-23

DATA-10/TRIP-01/09/12: authenticated GET trip → parsed saved snapshot → owner-scoped browser localStorage → read-only text renderer. Bản lưu gồm ghi chú riêng nên không dùng chung máy mà chưa logout. Không expense/token/profile/provider response. Download rechecks owner epoch; logout clears content and invalidates pending writes. No server write/audit on download (GET read), offline logout uses existing auth/logout when online. Service worker CacheStorage chỉ3static files, không private data. Retention là customer remove/logout/account switch hoặc browser eviction; không tự đặt server retention mới. Xem OFFLINE-ITINERARY.md.

## Mobile follow-through — 2026-10-23

AUTH-09 resumes an explicit create intent after password auth using an allowlisted URL and catalog ID only; no cross-account draft import. TRIP-08 incomplete-estimate display derives from existing prices/BudgetSummary without changing persisted totals. AI-01/02 error reasons remain sanitized codes/messages; hoian-v2/goe-v2 prompts enforce existing caps with substitution guidance, and pending/uncertain recovery stays distinct from terminal failures. No raw provider text or user messages are added to logs/storage. See AI-PLANNER.md and PRODUCT-VERIFICATION.md for test evidence.

## Plan-first creation — 2026-10-23

TRIP-02/03/05/09, AI-01/03/06: visible destination/duration/group choices → existing authenticated AI proposal request → editable unsaved preview → explicit departure/save → existing trip/revision/audit transaction. Until departure is chosen, planner dates are temporary anchors, not travel intent; they remain in the existing ai_runs proposal without introducing a new data category or retention rule. No private note/title/account data is added to provider inputs. Recovery reuses the same run key; changing input invalidates its use. Quick swaps use published catalog DTOs and manual source; undo retains only the last edited day in component memory. No new telemetry, external service or persisted undated-trip state.

## Admin catalog → customer estimate trace — 2026-10-23

CAT-08/09: authenticated admin edits a place through a strict allowlisted contract. Server fixes actor/destination metadata, checks revision/role and commits place + catalog audit + same-key receipt in one transaction. Draft/archived records remain excluded from public reads and planner catalog. Local operator grant/revoke is audited and increments user securityVersion; there is no browser promotion route.

TRIP-07/08 / AI-03: admin referencePrice → public catalog DTO → server validated AI output (or explicit manual place addition) → estimatedCost reference snapshot → trip/revision + server budget → optional read-only offline snapshot. Source/date/conditions and catalog revision stay with the estimate. A catalog update never edits a saved customer's trip or actual expenses. Explicit customer refresh changes only the chosen stop's local estimate before saving; manual override removes the reference label. Save validates reference against current catalog or same owner saved activity/successful AI proposal; forged new provenance is rejected. Public shares continue to omit costs. Opening-hours notes/address updates are current catalog information, not verified trip snapshots.

Admin audit history UI exposes latest20 action/revision/time records; actor ID is retained internally. No full catalog content history, analytics tracking, retention job, external source crawling or real booking/payment added. Runtime storage details in DB-BASELINE.md and ADMIN-CATALOG.md.

## Geoapify catalog import — 2026-10-23

CAT-10/CAT-01–05/08 → admin-only preview → fixed-origin Geoapify Places → bounded normalized OSM candidates in process memory (actor-bound 15 min) → explicit selection → transactional draft places + catalog.imported metadata audit + idempotency receipt. Client cannot supply source/title/coordinates on commit. Stable canonical OSM ID + unique source index prevents repeat import; possible name/coordinate matches require review. Source fetchedAt/attribution/license retained in places, mapped into admin/public DTOs; not an admin verification timestamp. Opening-hours strings remain unverified notes; price remains null. Public reads/planner exclude imported drafts. Admin edits are never silently overwritten and trips are never bulk rewritten.

API key only server/.env/provider request memory; no secret-bearing URLs/raw errors/raw datasource/contact/review/photo in logs, audit, preview or catalog. Preview is capped and transient; search rate limits are per process, not durable billing quotas. Receipt keeps only created IDs, not provider payload. Source credits follow public catalog details and possible place-name snapshots in trip/share/offline readers. Local research artifact in ignored .local is an allowlisted sample, not an application collection or committed dataset. No retention/purge/refresh or analytics policy added. Provider permissions and verification limits: [GEOAPIFY-IMPORT](GEOAPIFY-IMPORT.md).

### Hội An three-input generation — 2026-10-23

AI-01/02/03 → itinerary-policy.ts + planner.ts + gemini.ts; TRIP-08 → unchanged catalogCost/calculateBudget and optional quick-setup budget. hoian-v3 uses public descriptions, hours, locations and reference costs; generated IDs/times remain validated, known costs remain server-derived. No new persistence schema. Verification: planner.test.ts checks null budget, complete meal/visit days, repeated visits, closure formats, fixture/food-idea exclusion and unknown costs. Route clustering and weekly-hours interpretation remain model guidance, not guaranteed server checks.

Date-change update (2026-10-23), AI-02/TRIP-08: RescheduleRequest → authenticated catalog rescheduler → private catalog ai_runs proposal for AI trips → existing revision-checked trip save. Fixed closure, time shifts, unknown costs and atomic failure: planner.test.ts. Ownership, revisions, provenance save/PATCH and zero quota: reschedule.integration.ts (isolated MongoDB). No live provider call required.

Concurrency clarification: every review decision also advances the place revision in the same transaction, including keep/later/distinct. This fences simultaneous editorial edits; draft review signatures advance with that decision so keeping or deferring a draft does not reopen itself. Source polling alone still does not advance editorial revision.

2026-10-24 AI-01/AI-02: server selects gemini/fulldichvu from AI_PROVIDER, sends only the existing minimized planner payload, records provider/model in ai_runs, and keeps provider errors sanitized. FULLDICHVU key is server-only. fulldichvu.test.ts verifies fixed endpoint, isolated auth, bounded output and no paid retry/fallback with mocked HTTP; no live provider verification yet. No customer personal identity is added to prompts.

Compact planner 2026-10-24: hoian-v4/goe-v3 omit descriptions/price provenance from provider payload, retain full hours/identity/duration/address and derived meal suitability. Final cost remains server catalogCost; strict output rejects invented price fields. planner.test.ts asserts preserved fields and omitted prose/provenance. No collection shape change.

2026-10-24 provider diagnostics: length + empty final content is AI_OUTPUT_TRUNCATED, no reasoning text/credentials in application logs. FULLDICHVU hoian-rank-v1 strict ID ranking → catalog arrangement → unchanged validation/cost. Fixture tests reject fake IDs, duplicate IDs, price fields and insufficient catalog; live ranking still truncated pending final diagnostic probe.

2026-10-24 selected model: FULLDICHVU Haiku 4.5 now default for that provider after two successful live catalog-ranking/arrangement/validation probes (2 days:10.232s; 3 days:8.270s). All costs unknown retained; known Nov11 museum closure respected. Scripts ran read-only catalog + provider adapter, not persisted trips/quota receipts. See AI-PLANNER.md for usage, rejected Llama trial and verification boundaries.

### CAT-14 — giá đủ dữ liệu và vé gói, 24/10/2026

Admin nhập inclusions/exclusions và bundle metadata có nguồn; đi qua contract + service authorization + transaction/audit hiện có đến places.referencePrice. Goe lọc priceReady + giờ/địa chỉ trước provider, dùng catalogCost tạo snapshot, validateCatalogCosts xác thực snapshot lúc save. Bundle metadata đi cùng reference vào trips/trip_revisions/ai_runs; includedActivityIds chỉ là output tính toán, không collection mới. Không sửa hồi tố lịch cũ hay coi null là 0. Giá có cấu trúc vẫn cần admin xác minh ngoài thực tế.

CAT-14 minTravelers: nguồn menu có điều kiện số khách tối thiểu được lưu thành field có cấu trúc, đi cùng snapshot. `server/test/budget.test.ts` kiểm tra 1 khách không được áp dụng giá set từ 2 khách; 3 khách tính đúng 3 suất, min > max bị từ chối.

## CAT-15 — Admin Operations V2, 24/10/2026

Admin session → contracts validation → admin guard trong transaction → places/catalog_settings → audit_logs + catalog_versions; review mutation thêm catalog_decisions riêng. Before/after nguồn từ snapshot allowlist, attribution theo trường là so sánh quan sát nguồn với nội dung hiện tại, không xác nhận đã kiểm chứng. Restore tạo revision mới ở draft, giữ provenance nguồn hiện tại. Internal notes và version snapshots không đưa lên public DTO/planner; gallery chỉ public URL/credit/license/source.

Geoapify → scope server đã cấu hình → normalize/dedupe → draft/source review → quyết định hoặc auto-apply chỉ giờ draft đáp ứng điều kiện → publish validation CAT-14 → public catalog và planner hiện có. Trips đã lưu giữ snapshot. Source lỗi không làm mất record, không báo success; last attempt tách last successful. Dashboard/quality dùng query MongoDB, completeness6 tiêu chí công khai trong UI/docs; không suy ra độ tin cậy. Settings có revision và áp dụng sau restart; lịch theo scope dùng backend worker hiện có.

Bằng chứng: admin-v2.test.ts, admin-v2.integration.ts, catalog-operations.integration.ts, tests/catalog-operations.spec.ts và ADMIN-V2-VERIFICATION.md. Live source probe chỉ đọc Geoapify và ghi sample allowlist trong .local; import/publish/review tự động dùng fixtures trong MongoDB test riêng, không phải dữ liệu demo production. Thực thi/giới hạn lưu trữ tại DB-BASELINE.md và collection-registry.json.

## Avatar thiết bị — 24/10/2026

AUTH-09/CAT-06: file local → canvas cắt JPEG512 → POST /me/avatar (session/Origin/limiter) → sharp kiểm/re-encode WebP512 bỏ metadata → Cloudinary goease/avatars UUID → AvatarUploadDto URL → PATCH profile revision/audit → users.avatarUrl. GET profile trả timestamps có sẵn cho chính owner. Original không gửi cloud hoặc ghi disk/DB; bản chuẩn hóa/URL CDN công khai, UI thông báo trước lưu. Audit không chứa ảnh/URL/tên file/crop. URL thành công tạm giữ trong bộ nhớ để retry PATCH; chưa dọn asset mồ côi/thay thế, không có job retention/purge. Các ghi nhận upload chưa triển khai phía trên là lịch sử; xem ACCOUNT-PROFILE.md cho runtime hiện hành.

## CAT-17 / V3-BR-01…12 — Admin V3

Admin session → strict request/intent/role → catalog proposal/version + audit/receipt transaction → explicit publish → places publicRevision → public search/Goe/budget. Pending edits và restore không đi vào public; catalog-costs kiểm giá với publicRevision, lịch đã lưu không tự thay. Provenance/khóa có giới hạn theo trường, source receivedAt khác verifiedAt. Legacy provenance/audit thiếu căn cứ giữ unknown/legacy.

Configured destination (draft/published/archived admin) → immutable campaign/run scope+source+policy → existing Mongo worker lease/fence/retry → normalized stable OSM ID → draft hoặc ngoại lệ/low-risk proposal → server frozen bulk item revisions → per-item atomic publish/results → history/version diff/restore proposal. Source usage ledger chỉ đếm lời gọi nội bộ; provider quota/credits chưa biết hiển thị unknown, không giả kết nối thành công.

Verification liên kết: catalog-publication.test/integration (public isolation, locks, migration/rollback,13200 aggregate); admin-v3.test/integration (scope snapshot, policy dry-run, pause fence, retry, frozen-all scale/bulk/role/map); catalog.integration (public price snapshot trip save); catalog-operations.integration (worker crash/fence/retry/audit rollback); tests/catalog-operations.spec.ts và ảnh UI thật. Trạng thái thực tế cuối cùng tại ADMIN-V3-VERIFICATION.md.

## CAT-20 photo provenance

Commons imageinfo → bounded imageSearch.candidates (unreviewed) → explicit admin selection → catalog proposal/version/audit → published images/cover. Retain sourceUrl, credit, license and optional licenseUrl; observed/checkedAt is not verified. Publish and restore preserve current imageSearch. Old AI URLs/history are not projected as POI photos. Manual approved photos retain owner-provided attribution. No auto-publication or fabricated rights. Details: WIKIMEDIA-PHOTOS.md.

CAT-20 Cloudinary: Commons source page/credit/license remain provenance; candidate image.url is now the validated Cloudinary WebP URL. Binary file metadata is stripped during optimization. UI displays stored URL; Commons link is attribution only. Observation storageVersion=1; no automatic approval/publication.

## Bổ sung ảnh bìa mặc định — 25/10/2026

Owner cập nhật CAT-20: tự chọn ảnh đầu tiên cho draft chưa có ảnh và không khóa images; admin đổi ảnh bằng **Dùng làm ảnh bìa**, không cần bước duyệt riêng. Thông tin ảnh trong editor thu gọn; giữ metadata và ghi công public. Thay các hướng dẫn duyệt thủ công bắt buộc ở phần trước.

Schema đã triển khai: photo.selection optional enum automatic/admin; reviewed vẫn là boolean, không tự gán true cho ảnh tự chọn. imageSearch.defaultCover photo|null giữ ảnh đầu tiên ổn định qua retry. Backfill ứng viên Cloudinary cũ khi thiếu defaultCover, không đổi editorial revision/publication. DTO draft và bulk áp dụng defaultCover khi images rỗng, không khóa; save/publish lưu vào snapshot. Ảnh đã chọn và public không bị thay. GET images bổ sung defaultCover để form đang mở cập nhật khi worker hoàn tất. Gate chấp nhận selection automatic/admin hoặc reviewed=true, metadata hợp lệ và không phải AI. Không tự xuất bản.

## Bổ sung CAT-21 — Giới thiệu địa điểm

Đã triển khai hàng đợi embedded `places.descriptionSearch`, snapshot `descriptionSource`, optional Wikipedia/Wikidata hints trong `sourceSnapshot`; draft cho phép giới thiệu trống, xuất bản yêu cầu nội dung thực. Worker chỉ điền mặc định đúng ngữ cảnh và giữ nội dung admin/field locks; nguồn và bản dịch được truy vết. Dịch dùng quota AI global hiện có. Không thêm collection hoặc index. Hợp đồng, dictionary, giới hạn và kiểm chứng: [WIKIPEDIA-DESCRIPTIONS](WIKIPEDIA-DESCRIPTIONS.md).

## Cần kiểm tra và ảnh gốc — 25/10/2026

Hàng chờ #work đổi nhãn Cần kiểm tra, dùng hai cột và count theo phạm vi từ API. imageSearch.storageVersion=2 triển khai ảnh nguyên kích thước từ Wikimedia, WebP lossless trên Cloudinary; xếp lại quan sát cũ, nâng URL cùng sourceUrl cho draft không khóa; giữ bản công khai. Không thêm collection. Hợp đồng và giới hạn: [ADMIN-REVIEW-QUEUE](ADMIN-REVIEW-QUEUE.md).

## CAT-22 — Giờ/giá tham khảo

OSM ID + tên → opening_hours/charge/fee → website liên kết JSON-LD đúng tên khi thiếu → visitSearch observation → default draft visitInfo → admin sửa/kiểm tra/bỏ → save proposal/version/audit → explicit publish → reviewed PlaceDto → giá “Từ”. Không vào referencePrice/ngân sách; không tự xác minh từ observedAt. Scope và bằng chứng tại [VISIT-INFORMATION](VISIT-INFORMATION.md).

CAT-22 bổ sung nguồn: Wikidata P856 (entity liên kết hoặc tên+tọa độ), HTML giờ/giá có nhãn và liên kết cùng origin; visitSearch.providerVersion=3 xếp tìm lại observation cũ, context bổ sung tọa độ. Giữ nội dung đã duyệt/public, không thay giá ngân sách. Phạm vi và giới hạn tại [VISIT-INFORMATION](VISIT-INFORMATION.md).

CAT-23: source observation → unreviewed candidate → single editorial visitInfo.price + terms → admin confirmation → server-derived referencePrice → explicit publication/publicRevision → customer label + planner/budget + trip price snapshot. Client second amount is ignored for shared inputs; raw source never authorizes automatic pricing. Old published and saved trip data are not bulk-rewritten. See [SHARED-PLACE-PRICE](SHARED-PLACE-PRICE.md).

CAT-20 cập nhật gallery: kind photo|ai_illustration theo từng ảnh, giữ credit/license/sourceUrl, selection/reviewed trong đề xuất, phiên bản, public và file export; AI không dùng nhãn tác giả/giấy phép Wikimedia và không xác minh giá/giờ. Không chứa prompt, API key hoặc thông tin tài khoản tạo ảnh trong public DTO.

CAT-20 storageVersion=3: binary Wikimedia → lossless Cloudinary chỉ cho bìa; tối đa 4 ảnh bổ sung giữ link binary nguồn. `storage` phân biệt cloudinary/source, `originalUrl` truy vết binary gốc trong khi `sourceUrl` giữ trang ghi công/quyền. Chọn bìa nguồn → cache trước transaction → proposal/version → explicit publish; lỗi cache không ghi thay đổi. Gallery khách ẩn ảnh lỗi; không xóa metadata/asset nguồn cũ. Export giữ URL/metadata, chưa đóng gói binary. Xem ONE-COVER-MEDIA.md.

26/10/2026: pool 3/maximum4 → atomic Mongo claim theo tỉnh ưu tiên và imageSearch.priority → Commons query tuần tự/maxlag/cooldown → kiểm tên ảnh → cache một bìa → observation, không publication. Admin enqueue priority100 vẫn qua role guard, cooldown và lease. Automatic observation sai tên trên draft chưa chọn/không khóa được rút lại khi initialize, không xóa asset hoặc audit/version nội dung công khai.

Nhập bổ sung toàn quốc26/10: fileOSM có hash/mốc24/10 → osmVisitInfo/visitInfoSchema → visitSearch.result reviewed=false cho draft đúng source/revision, lease không hoạt động, chưa có kết quả; không ghi giá budget hoặc editorial revision. Website link trong OSM → bounded HTTPS/DNS guard → named structured/text parser → candidate unreviewed; chỉ bổ sung trường observation còn thiếu và giữ kết quả đã duyệt. Những mô tả Wikipedia có bằng chứng được ghi qua stageInSession + audit trong transaction; giờ/giá chính thức và ảnh được nhập bằng catalog.write. Mọi mục giữ draft và trạng thái tỉnh giữ nguyên. Chi tiết nguồn/đối chiếu: NATIONWIDE-DATA-PREPARATION-2026-10-26.md.
# CAT-24 — Enrichment trace, 26/10/2026

CAT-24 cập nhật tốc độ: pool mô tả3 + giờ/giá4 có claim/lease riêng, ảnh giữ3; một request/origin và giãn start1giây, origin khác độc lập, recheck cooldown sau khi đợi. Không restart để reset Retry-After, không tự approve/publish hoặc đổi source provenance. Không thêm collection/index/DTO; cấu hình server và bằng chứng tại BULK-ENRICHMENT.md.

Authenticated admin + Idempotency-Key → job/scope và catalog.enrichment_started cùng transaction → cursor/upsert per-place item → bounded source queue/lease/fence → unreviewed observations/proposal defaults → item missing/verdict → editor và explicit publish hiện có. Pause/resume expectedRevision + catalog.enrichment_controlled cùng transaction; admin role được kiểm lại trong worker. Hai audit action có entityType catalog_enrichment_job, không ảnh/source HTML/provider secrets. Rate limit429/503 → Retry-After → pending/nextAttemptAt + hoàn attempt, prepare khôi phục cooldown. Không tự apply giá ngân sách, sửa public snapshot hoặc dùng verdict thay publication validation. Ngày26/10 owner yêu cầu bật cả34 tỉnh; destination toggle tạo audit/receipt riêng và không khởi tạo provider import. Hướng dẫn/bằng chứng tại [BULK-ENRICHMENT](BULK-ENRICHMENT.md).
