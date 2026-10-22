# GoEase — Truy vết, Analytics và Vòng đời dữ liệu v0.2

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

Owned source snapshot → duplicate mới với clonedFromTripId nội bộ, manual source và ID mới; không copy expenses/ai_runs/history/access. Soft delete giữ expense/history nhưng chặn truy cập bằng active owned parent; audit ghi actor/entity/revision, không tên/notes. Không có purge, restore hay share-links runtime. Dời ngày không đổi ngày chi thực tế. Chi tiết TRIP-MANAGEMENT.md.

## Customer account — 2026-10-23

Profile data chỉ customer đã xác thực đọc/sửa. Password chỉ trong request/memory và Argon2id hash hiện có; không ghi requestHash từ mật khẩu hoặc receipt payload. Session giữ UUID key gần nhất để retry, mất khi session bị dọn. Audit profile.updated/password.changed chỉ actor/entity/action/revision, không tên/avatar/password/hash. URL ảnh chỉ browser tải với no-referrer; không proxy server. Quên mật khẩu/email delivery/upload media chưa triển khai. ACCOUNT-PROFILE.md ghi chi tiết.
