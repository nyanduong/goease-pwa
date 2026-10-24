# GoEase — MongoDB Schema Baseline v0.2 / Baseline thiết kế

Ngày: **22/10/2026**. Baseline thiết kế được chủ dự án chấp thuận; F1-B đã có audit_logs test-only; task sản phẩm tiếp theo triển khai subset users/auth_identities/auth_sessions/auth_challenges/destinations/trips/trip_revisions/idempotency_keys và mở rộng audit_logs cho action thật. Xem [phạm vi runtime](PRODUCT-VERIFICATION.md). Các collection còn lại chưa triển khai. Nguồn chính cho field/type/index; [BR](BR.md) quyết định nghiệp vụ, [handoff](F1-HANDOFF.md) ghi phạm vi và khoảng trống. [Registry](collection-registry.json) là bản đọc máy, không executable. Đây là **từ điển dữ liệu mục tiêu**, không phải yêu cầu tạo tất cả collections/models ngay ở F1. Chỉ khởi tạo khi module được bật có consumer thật. Field phụ thuộc provider/hoạt động tài chính được ghi điều kiện rõ, không hứa schema đã bao phủ mọi nghiệp vụ tương lai.

Stack giữ nguyên: npm workspaces; React/Vite/TypeScript/Tailwind; Express/TypeScript; MongoDB local replica set + Mongoose; web/API localhost. Sau này Atlas/mobile không làm đổi ownership và IDs nội bộ.

## 1. Quy ước dữ liệu

- Collection: `snake_case`, dạng số nhiều; field: `camelCase`; Mongoose model có thể PascalCase và chỉ định rõ tên collection.
- `_id`: ObjectId; DTO trả ID string. Embedded activity/day/line IDs là UUID/string ổn định do server hoặc client draft phát sinh rồi server kiểm tra; không dùng vị trí mảng làm khóa.
- Timestamps hệ thống là BSON Date UTC. API serialize ISO 8601. Ngày du lịch là `YYYY-MM-DD`; giờ địa phương là `HH:mm` kèm timezone IANA; provider booking có UTC instant và timezone gốc khi cần.
- `null` có nghĩa chưa biết/không áp dụng được mô tả từng field; `0` là số không thực sự, không thay cho giá chưa biết. Trường optional không tự thu thập chỉ để lấp schema.
- Tiền: integer theo đơn vị nhỏ nhất của currency; VND dùng đồng. API kiểm tra safe integer, giới hạn miền, currency, rounding theo rule; không cộng tiền khác currency không có conversion snapshot. Nếu phát sinh miền vượt safe integer/tiền phân số cần Decimal128 hoặc representation khác qua migration.
- `schemaVersion`: version hình dạng document, mặc định 1 khi tạo; tăng khi format thay đổi. `revision`: version cập nhật nội dung cùng một entity để chống lost update. `eventVersion`: version schema của loại sự kiện. Ba giá trị này không thay thế nhau.
- Không field `metadata: Mixed` vô hạn để né thiết kế. Dùng subdocument/discriminated union có field allowlist, giới hạn kích thước. Provider-specific attributes cần schema theo provider, không passthrough raw JSON.
- Enum nghiệp vụ có state machine. Boolean đơn lẻ `isPaid`, `isPremium`, `isDeleted` không thay các mô hình vòng đời đa trạng thái. Không giữ `isDeleted` cùng `deletedAt` trừ projection được quản lý có lý do.
- Required là điều kiện tại state tương ứng. Draft có thể thiếu một số trường; publish/confirm bắt buộc validation đầy đủ tại server.

## 2. Các bộ field dùng chung

| Bộ             | Field                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUTABLE        | `_id`, `schemaVersion:1`, `revision:0`, `createdAt`, `updatedAt`, `createdBy:ObjectId\|null`, `updatedBy:ObjectId\|null`, `createdByType:user/admin/system/provider`, `updatedByType:user/admin/system/provider` |
| MUTABLE_SOFT   | MUTABLE + `deletedAt:Date\|null`, `deletedBy:ObjectId\|null`, `deletionReasonCode:enum\|null`                                                                                                                    |
| MUTABLE_RETAIN | MUTABLE + `archivedAt:Date\|null`, `retentionUntil:Date\|null`, `legalHold:boolean=false`; **không deletedAt để xóa lịch sử tài chính**                                                                          |
| EPHEMERAL      | `_id`, `schemaVersion:1`, `createdAt`, `updatedAt`; vòng đời bằng expiry/consumed/revoked và update có điều kiện, không generic soft delete                                                                      |
| APPEND         | `_id`, `eventId:UUID`, `schemaVersion:1`, `createdAt`; **không updatedAt/deletedAt cho sửa/xóa thông thường**; occurredAt/actor theo event                                                                       |

Mongoose `timestamps:true` tạo `createdAt` và `updatedAt`, không tự tạo `deletedAt` [S1]. APPEND có thể bật riêng createdAt/tắt updatedAt. Actor metadata phải gán từ request context đáng tin, không từ request body. `createdAt/createdBy` bất biến trong API bình thường; import/migration có đường đặc quyền, evidence riêng. Tránh replacement update tùy ý vì replacement có thể đổi createdAt [S1].

### Chính sách soft delete

Read/update/list/count/export thông thường lọc `deletedAt:null` và quyền. Áp dụng cả aggregation, populate, lookup, admin endpoint và job: một `pre('find')` middleware không chứng minh đã bao phủ mọi đường đọc/ghi. Restore kiểm tra dependency và unique conflicts trước; không tự cướp slug/email của record mới. Phân biệt delete/restore/purge/privacy erasure. Không bật TTL trên deletedAt cho cả DB.

### Concurrency

Trip và entity có chỉnh sửa song song dùng `{_id, owner/permission, deletedAt:null, revision:expectedRevision}` và tăng revision nguyên tử. Với Mongoose có thể dùng `versionKey:'revision'` và optimisticConcurrency cho `save`; đường query update vẫn phải kiểm tra revision rõ ràng, không giả định tất cả update tự làm đúng. Không dùng updatedAt để thay revision. Retry mutation dùng idempotency key riêng.

## 3. Kiểu lồng dùng chung

### SourceRef

`provider:string`, `externalId?:string`, `sourceUrl?:URL`, `fetchedAt:Date`, `lastVerifiedAt?:Date`, `validUntil?:Date`, `rights:{policyRef,cacheAllowed,persistentSnapshotAllowed,attributionRequired,storageUntil?}`. Các cờ rights đến từ cấu hình hợp đồng/điều khoản đã rà soát, **không từ user và không do AI tự gán**. External content chưa rõ quyền không mặc định persistentSnapshotAllowed=true.

### CostEstimate / PriceDisplay / QuoteSnapshot

- CostEstimate: `amountMinor:integer|null`, `currency`, `basis:group_total/per_person/per_unit`, `quantity:integer`, `confidence:unknown/estimated/quoted/user_entered`, `asOf?`, `sourceRef?`; group_total thì quantity=1. Server tính totalMinor, không nhận total từ client.
- PriceDisplay: `mode:from/estimated/quote_required`, `amountMinor?`, `currency`, `basis`, `asOf?`; không là booking price.
- QuoteSnapshot: `quoteId`, `quoteVersion`, `amountMinor`, `currency`, `lineItems[]` hữu hạn, `issuedAt`, `expiresAt`, `inclusions[]`, `exclusions[]`, `termsVersion`, `cancellationPolicySnapshot`, `providerRef?`. Muốn thanh toán phải quote còn hiệu lực hoặc reprice được chấp nhận.

### TripDestination

`destinationId`, `nameSnapshot`, `timezone`, `order`, `startDate?`, `endDate?`. Snapshot tối thiểu được phép dùng; nếu nguồn ngoài cấm lưu, dùng reference + fallback do GoEase sở hữu thay vì cố lưu trái điều khoản.

### TripDay

`dayId`, `date:LocalDate`, `destinationId`, `title?`, `activities:TripActivity[]`. Ngày không trùng trong cùng trip khi policy là một day mỗi date. Không cần collection TripDay riêng trong baseline; timestamp lịch sử chủ yếu ở Trip/TripRevision.

### TripActivity

`activityId`, `kind:visit/meal/transport/lodging/free_time/custom`, `placeId?`, `placeSnapshot?`, `title`, `startLocalTime?`, `endLocalTime?`, `timezone`, `durationMinutes?`, `order`, `notes?`, `estimatedCost?:CostEstimate`, `source:manual/ai/template`, `recommendationId?`, `bookingId?`, `addedAt`, `updatedAt`.

PlaceSnapshot chỉ gồm `name/category/address/location/sourceRef/asOf` cần hiển thị và được quyền lưu; không copy review/photo blobs từ provider. Notes là private. BookingId là liên kết, không tự thay trạng thái booking. Hoạt động qua đêm hoặc hành trình đa múi giờ cần explicit date/offset model trước khi bật, không lấy end-start bằng chuỗi giờ.

### Preference object và PlannerInputSummary

Sở thích tự khai: `interestCodes[]`, `pace:relaxed/balanced/active`, `budgetBand?`, `preferredTransport[]`. PlannerInputSummary thêm destination/date range/group count/budget currency + amount. Không thu nhạy cảm như bệnh tật/tôn giáo để suy đoán sở thích. Constraint người dùng tự nhập có thể nhạy cảm; hạn chế scope và không đưa vào analytics.

### OrderLine / Benefit

OrderLine: `lineId`, `productId?`, `bookingId?`, `productType`, `titleSnapshot`, `quantity`, `unitAmountMinor`, `discountMinor`, `taxMinor`, `lineTotalMinor`, `benefitSnapshot[]`, `termsVersion`. Benefit: `feature`, `unitLimit?`, `durationDays?`, `scope`. Giá trị tiền được server kiểm tra và tính với policy rounding.

### AuditActor / SafeChange

AuditActor: `type`, `userId?`, `roleSnapshot?`, `serviceName?`; actor thực từ phiên/backend. SafeChange: `path`, `before?`, `after?`, `redacted:boolean`; chỉ allowlist enum/numeric/non-sensitive. Email/name/notes/free text/password/token thay bằng changed flag hoặc omitted; không serialize full before/after document.

## 4. Registry collections mục tiêu

Phân kỳ trong bảng là đề xuất **khi module tương ứng được bật**, không phải danh sách tạo tất cả trong một task.

| #   | Collection              | Lớp      | Mục đích                                                                                               |
| --- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `users`                 | F1       | Hồ sơ nội bộ ổn định, không chứa mọi hoạt động người dùng.                                             |
| 2   | `auth_identities`       | F1       | Thông tin đăng nhập tách khỏi hồ sơ, cho phép một user liên kết Google và password.                    |
| 3   | `auth_sessions`         | F1       | Phiên ứng dụng và thu hồi từng thiết bị; web có thể dùng opaque HttpOnly cookie.                       |
| 4   | `auth_challenges`       | F1       | Token một lần cho xác minh email/reset/link/OAuth state.                                               |
| 5   | `consent_events`        | F1       | Bằng chứng thông báo/chọn/rút lại từng mục đích xử lý.                                                 |
| 6   | `privacy_requests`      | PLATFORM | Theo dõi yêu cầu truy cập, xuất, sửa, rút consent hoặc xóa dữ liệu.                                    |
| 7   | `media_assets`          | CORE     | Metadata media; binary để file/object storage, không nhúng document.                                   |
| 8   | `destinations`          | CORE     | Khu vực du lịch/chặng, phân biệt địa điểm cụ thể.                                                      |
| 9   | `places`                | CORE     | POI dùng discovery/planner; provider ref và dữ liệu chất lượng rõ ràng.                                |
| 10  | `trips`                 | CORE     | Aggregate chuyến đi: ngày/hoạt động hữu hạn nhúng; không nhúng audit/reviews/events.                   |
| 11  | `trip_revisions`        | CORE     | Bản lịch đã lưu có thể phục hồi; dữ liệu riêng không phải analytics.                                   |
| 12  | `trip_access`           | PLATFORM | Quyền collaborator có account; không thay public share token.                                          |
| 13  | `trip_share_links`      | PLATFORM | Liên kết chỉ đọc có thể thu hồi, không để private trip trở thành public ngẫu nhiên.                    |
| 14  | `trip_expenses`         | PLATFORM | Thực chi du lịch, tách ước tính planner và giao dịch tiền trên GoEase.                                 |
| 15  | `favorites`             | PLATFORM | Quan hệ yêu thích, không mảng không giới hạn trên user.                                                |
| 16  | `ai_runs`               | CORE     | Metadata thực thi planner có thể đối soát chi phí/quota/chất lượng.                                    |
| 17  | `usage_buckets`         | CORE     | Counter quota theo user/feature/time window; không nguồn bằng chứng thanh toán.                        |
| 18  | `posts`                 | PLATFORM | Cẩm nang và bài chia sẻ với vòng đời xuất bản.                                                         |
| 19  | `reviews`               | PLATFORM | Review nền tảng với provenance khác external ratings.                                                  |
| 20  | `moderation_reports`    | PLATFORM | Báo cáo nội dung và quyết định kiểm duyệt.                                                             |
| 21  | `partners`              | PLATFORM | Đối tác địa phương/công ty hoặc hướng dẫn viên, không phải identity login riêng.                       |
| 22  | `partner_memberships`   | PLATFORM | Quyền user trong một đối tác.                                                                          |
| 23  | `service_listings`      | PLATFORM | Danh mục local guide/experience/hotel/flight referral và dịch vụ có adapter thực.                      |
| 24  | `service_inquiries`     | PLATFORM | Yêu cầu liên hệ/báo giá có định danh, chưa phải booking.                                               |
| 25  | `bookings`              | COMMERCE | Thực thi dịch vụ, tách khỏi order/payment và trip chỉnh sửa.                                           |
| 26  | `products`              | COMMERCE | Sản phẩm GoEase bán: gói planner hoặc item dịch vụ được phép thu phí.                                  |
| 27  | `orders`                | COMMERCE | Đơn hàng/quote đã chấp nhận, tách quyền sử dụng và payment attempts.                                   |
| 28  | `payments`              | COMMERCE | Một lần thử thanh toán/charge qua nhà cung cấp.                                                        |
| 29  | `webhook_events`        | COMMERCE | Inbox bền vững cho event provider; envelope bất biến, processing state được cập nhật.                  |
| 30  | `refunds`               | COMMERCE | Yêu cầu hoàn tiền và kết quả đối soát, không sửa payment thành chưa từng tồn tại.                      |
| 31  | `entitlements`          | COMMERCE | Quyền sử dụng được cấp từ mua hàng hoặc admin grant có căn cứ.                                         |
| 32  | `promotions`            | COMMERCE | Chiến dịch ưu đãi versioned, không sửa lịch sử giảm giá của đơn đã mua.                                |
| 33  | `promotion_redemptions` | COMMERCE | Giữ lượt/ghi nhận dùng ưu đãi và chống vượt hạn mức.                                                   |
| 34  | `notifications`         | PLATFORM | Thông báo theo user; không mảng lịch sử vô hạn.                                                        |
| 35  | `support_tickets`       | PLATFORM | Yêu cầu hỗ trợ có quyền, tránh thu PII qua log chung.                                                  |
| 36  | `audit_logs`            | F1       | Ai đã làm gì, trên đối tượng nào, kết quả và lý do; không là hồ sơ marketing.                          |
| 37  | `analytics_events`      | CORE     | Hành vi tối thiểu để đo funnel/cá nhân hóa theo mục đích được phép.                                    |
| 38  | `outbox_events`         | F1       | Outbox trong cùng DB transaction để chuyển audit/notification/analytics có retry mà không mất sự kiện. |
| 39  | `idempotency_keys`      | CORE     | Chống tạo bản sao do retry khi client mất phản hồi.                                                    |
| 40  | `schema_migrations`     | F1       | Phiên bản thay đổi dữ liệu/index có thể truy vết và tiếp tục sau lỗi.                                  |

## 5. Data dictionary chi tiết

Mỗi bảng kế thừa field của bộ chung tương ứng ở mục 2. Các đề xuất index phải được kiểm tra với truy vấn thật và dữ liệu duplicate trước khi migration; không index mọi field.

### 01. `users`

**Lớp:** F1 · **Bộ metadata:** `MUTABLE_SOFT`

Hồ sơ nội bộ ổn định, không chứa mọi hoạt động người dùng.

| Field                                 | Kiểu                  | Required/default                      | Ý nghĩa và ràng buộc                                                                                                                                                                                                                                                        |
| ------------------------------------- | --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| emailNormalized                       | string?               | Điều kiện; duy nhất nếu có            | Trim + lower-case theo chính sách nhất quán; không xóa dấu chấm/plus như Gmail; xóa khi purge được phép.                                                                                                                                                                    |
| emailVerifiedAt                       | Date?                 | null                                  | Xác minh email hiện tại; đổi email phải xác minh lại.                                                                                                                                                                                                                       |
| displayName                           | string                | Bắt buộc; 1–100 ký tự                 | Tên hiển thị; không suy ra tên pháp lý.                                                                                                                                                                                                                                     |
| avatarAssetId                         | ObjectId?             | null                                  | Tham chiếu media_assets; không sao chép provider image khi chưa rõ quyền.                                                                                                                                                                                                   |
| avatarUrl                             | string?               | null                                  | IMPLEMENTED: URL HTTPS tối đa 2048 ký tự, không credentials; DTO trả null nếu lỗi. Google claim hoặc owner PATCH profile với revision; upload avatar server trả URL Cloudinary 512×512 WebP. Không lưu binary/crop trong users. Fallback CDN (AUTH-09, ACCOUNT-PROFILE.md). |
| status                                | enum                  | active for new email/password account | pending_verification (legacy only)/active/suspended/deletion_pending/anonymized; account usability is separate from email verification.                                                                                                                                     |
| roles                                 | enum[]                | [traveler]                            | traveler/editor/support/finance/admin; server cấp; giới hạn tập role.                                                                                                                                                                                                       |
| locale; timezone                      | string; IANA timezone | vi-VN; Asia/Ho_Chi_Minh               | Cài đặt hiển thị, không xác định vị trí thực.                                                                                                                                                                                                                               |
| preferences                           | Preference object     | {}                                    | interestCodes[], pace, budgetBand?, preferredTransport[]; chỉ sở thích user tự khai, không là consent.                                                                                                                                                                      |
| privacySettings                       | object                | optional purposes disabled            | personalization/analytics/marketing + lastConsentEventId; là projection, lịch sử ở consent_events.                                                                                                                                                                          |
| lastLoginAt                           | Date?                 | null                                  | Cập nhật có throttle, không là lịch sử đăng nhập.                                                                                                                                                                                                                           |
| securityVersion                       | integer               | 1                                     | Tăng khi thu hồi toàn bộ phiên hoặc thay đổi xác thực quan trọng.                                                                                                                                                                                                           |
| suspendedAt; suspensionReasonCode     | Date?; enum?          | null                                  | Chỉ actor được cấp quyền cập nhật.                                                                                                                                                                                                                                          |
| deactivationRequestedAt; anonymizedAt | Date?; Date?          | null                                  | Mốc xử lý xóa tài khoản, không thay deletedAt.                                                                                                                                                                                                                              |

**Indexes:** Unique partial emailNormalized khi là string, KHÔNG giới hạn deletedAt; {status:1,createdAt:-1}.

**Invariant/quyền:** Email/password account mới được dùng khi emailVerifiedAt còn null. Legacy pending password account chỉ chuyển active sau xác thực mật khẩu đúng và kiểm tra chưa khóa/xóa; không xác minh email trong bước này. Không merge/link theo email chưa xác minh. Không soft-delete rồi tạo user mới cùng email để kế thừa trip cũ. Trong grace period dùng flow khôi phục; sau purge tạo account mới có ID mới. Không lưu CCCD, ngày sinh, giới tính, số điện thoại chỉ để đầy profile.

**Retention:** Profile cho đến yêu cầu xóa hoặc policy inactivity đã duyệt; audit và tài chính xử lý riêng.

### 02. `auth_identities`

**Lớp:** F1 · **Bộ metadata:** `MUTABLE`

Thông tin đăng nhập tách khỏi hồ sơ, cho phép một user liên kết Google và password.

| Field                            | Kiểu               | Required/default      | Ý nghĩa và ràng buộc                                              |
| -------------------------------- | ------------------ | --------------------- | ----------------------------------------------------------------- |
| userId                           | ObjectId           | Bắt buộc              | Chủ identity, tham chiếu users.                                   |
| provider                         | enum               | Bắt buộc              | password/google.                                                  |
| issuer                           | string?            | Bắt buộc với google   | Issuer được kiểm chứng, canonical hóa theo adapter.               |
| providerSubject                  | string?            | Bắt buộc với google   | Claim sub đã xác minh, không dùng email làm khóa Google.          |
| loginEmailNormalized             | string?            | Bắt buộc với password | Đồng bộ với email hiện tại sau verification; không có với Google. |
| passwordHash                     | string? private    | Bắt buộc với password | PHC string Argon2id gồm salt/cost; select false, không DTO/log.   |
| passwordChangedAt                | Date?              | null                  | Kiểm tra việc thu hồi phiên.                                      |
| linkedAt; verifiedAt; lastUsedAt | Date; Date?; Date? | server time           | Các mốc nghiệp vụ riêng createdAt.                                |
| unlinkedAt                       | Date?              | null                  | Thu hồi liên kết; không tự xóa chứng cứ bảo mật.                  |

**Indexes:** Unique partial {provider,issuer,providerSubject} cho google đang liên kết; unique partial {provider,loginEmailNormalized} cho password đang liên kết; unique partial {userId,provider} cho unlinkedAt:null.

**Invariant/quyền:** Điều kiện trường theo discriminator; không lưu access/refresh token Google nếu chỉ login. Linking phải re-auth; không unlink identity cuối cùng còn dùng được. Race linking xử lý E11000 an toàn. Khi unlink, bản cũ không được dùng xác thực.

**Retention:** Hash/xác thực xóa theo deletion policy; audit chỉ giữ hành động và ID tham chiếu cần thiết.

### 03. `auth_sessions`

**Lớp:** F1 · **Bộ metadata:** `EPHEMERAL`

Phiên ứng dụng và thu hồi từng thiết bị; web có thể dùng opaque HttpOnly cookie.

| Field                       | Kiểu               | Required/default | Ý nghĩa và ràng buộc                                                |
| --------------------------- | ------------------ | ---------------- | ------------------------------------------------------------------- |
| userId; identityId          | ObjectId; ObjectId | Bắt buộc         | Người dùng và identity đã login.                                    |
| sessionTokenHash            | string private     | Bắt buộc         | Hash token entropy cao; không lưu token rõ.                         |
| clientPlatform              | enum               | web              | web/ios/android; mobile là tương lai, không tạo code native lúc F1. |
| securityVersionAtIssue      | integer            | Bắt buộc         | Khớp users.securityVersion trước khi chấp nhận.                     |
| issuedAt; lastSeenAt        | Date; Date         | server time      | Throttle lastSeenAt để tránh write mỗi request.                     |
| expiresAt; idleExpiresAt    | Date; Date         | Bắt buộc         | TTL cleanup theo expiresAt; ứng dụng kiểm tra cả hai.               |
| revokedAt; revocationReason | Date?; enum?       | null             | logout/password_change/admin_suspend/reuse_detected/other.          |
| deviceLabel                 | string?            | null; giới hạn   | Mô tả dễ nhận biết đã sanitize; không fingerprint phần cứng.        |
| securityContext             | object? restricted | null             | coarse user agent/IP HMAC theo policy; không raw token/cookie.      |

**Indexes:** Unique sessionTokenHash; {userId,revokedAt,lastSeenAt:-1}; TTL expiresAt (expireAfterSeconds:0).

**Invariant/quyền:** Cookie HttpOnly/SameSite; production Secure/HTTPS và CSRF/Origin checks phù hợp. Không ép JWT vì mobile. Tách TTL session khỏi log bảo mật cần giữ lâu hơn.

**Retention:** Session hết hạn được dọn; audit sự kiện login/logout tồn tại theo security retention.

### 04. `auth_challenges`

**Lớp:** F1 · **Bộ metadata:** `EPHEMERAL`

Token một lần cho xác minh email/reset/link/OAuth state.

| Field                     | Kiểu                 | Required/default | Ý nghĩa và ràng buộc                                                                     |
| ------------------------- | -------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| userId                    | ObjectId?            | Điều kiện        | Có thể chưa có user trong flow đăng ký.                                                  |
| purpose                   | enum                 | Bắt buộc         | verify_email/reset_password/link_identity/oauth_state/change_email.                      |
| tokenHash                 | string private       | Bắt buộc         | Token random một lần; hash đối chiếu.                                                    |
| targetEmailNormalized     | string? private      | Điều kiện        | Email đang xác minh; không log giá trị.                                                  |
| context                   | discriminated object | Theo purpose     | identityId?, returnTo allowlist?, nonceHash?, encryptedPkceVerifier?; không Mixed tùy ý. |
| expiresAt                 | Date                 | Bắt buộc         | Hạn dùng nghiệp vụ.                                                                      |
| consumedAt; revokedAt     | Date?; Date?         | null             | Consume bằng update có điều kiện nguyên tử.                                              |
| attemptCount; maxAttempts | integer; integer     | 0; cấu hình      | Giới hạn thử theo policy.                                                                |
| requestId                 | string               | Bắt buộc         | Liên kết technical/audit logs.                                                           |

**Indexes:** Unique tokenHash; {userId,purpose,createdAt:-1}; TTL expiresAt.

**Invariant/quyền:** Kiểm tra purpose, expiry, consumed và user binding. Không tin returnTo tùy ý. PKCE verifier nếu cần phải encrypt để dùng lại, không chỉ hash rồi mất khả năng đổi code.

**Retention:** Thời gian ngắn theo purpose; không dùng challenge collection làm lịch sử bảo mật.

**Runtime AUTH-10, 25/10/2026 — đăng ký OTP:** `auth_challenges` purpose=verify_email thêm context.registrationFlow=true, registrationRequestedAt(Date), deliveryState(pending/sent/failed), registrationOtpHash(SHA-256), registrationPasswordHash(Argon2id), registrationDisplayName(string<=100). Ba field hash/tên và targetEmailNormalized/tokenHash là select:false. Chưa có userId trước xác nhận. expiresAt=10 phút, attemptCount=0/maxAttempts=5; gửi lại sau60giây xoay binding/mã và reset attempts. tokenHash lưu SHA-256 của browser challenge ngẫu nhiên; OTPHash=SHA-256(challenge+':'+OTP), không lưu raw binding/code. Unique partial `{purpose:1,targetEmailNormalized:1}` với purpose=verify_email và context.registrationFlow=true, ngoài unique tokenHash/TTL hiện có. Consume transaction tạo user/identity có verifiedAt, phiên và audit; bỏ tên/passwordHash/OTPHash sau thành công. Flag REGISTRATION_OTP_REQUIRED mặc định false giữ tương thích; mẫu env true và thiếu SMTP sẽ503. Link/change_email vẫn design-only. Chi tiết [EMAIL-REGISTRATION](EMAIL-REGISTRATION.md).

### 05. `consent_events`

**Lớp:** F1 · **Bộ metadata:** `APPEND`

Bằng chứng thông báo/chọn/rút lại từng mục đích xử lý.

| Field                        | Kiểu               | Required/default   | Ý nghĩa và ràng buộc                                                                                  |
| ---------------------------- | ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| subjectUserId; anonymousId   | ObjectId?; string? | Ít nhất một        | Anonymous ID chỉ dùng khi hợp lệ; không fingerprint.                                                  |
| purpose                      | enum               | Bắt buộc           | terms_acceptance/optional_analytics/personalization/marketing/ai_processing.                          |
| action                       | enum               | Bắt buộc           | accepted/granted/declined/withdrawn/notified; không gọi terms acceptance là consent cho mọi mục đích. |
| policyVersion; noticeVersion | string; string     | Bắt buộc           | Nội dung pháp lý có version và bản lưu kiểm chứng.                                                    |
| legalBasisCode               | string             | Bắt buộc           | Căn cứ đã rà soát cho purpose; không mặc định tất cả là consent.                                      |
| occurredAt; receivedAt       | Date; Date         | Bắt buộc           | Thời điểm thao tác và server tiếp nhận.                                                               |
| source; locale               | enum; string       | Bắt buộc           | settings/signup/consent_banner; ngôn ngữ thông báo.                                                   |
| requestId; evidenceRef       | string; string?    | Bắt buộc; optional | Evidence tối thiểu, không raw full request.                                                           |

**Indexes:** {subjectUserId,purpose,occurredAt:-1}; unique eventId từ APPEND.

**Invariant/quyền:** Grant/withdraw tạo bản mới, không sửa bản cũ. Server cập nhật projection privacySettings nguyên tử. Analytics tùy chọn chỉ hoạt động sau grant phù hợp; dùng chức năng cốt lõi không bị ép marketing.

**Retention:** Giữ evidence có căn cứ, tối thiểu và thời hạn đã duyệt; không TTL tùy tiện.

### 06. `privacy_requests`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Theo dõi yêu cầu truy cập, xuất, sửa, rút consent hoặc xóa dữ liệu.

| Field                                | Kiểu               | Required/default  | Ý nghĩa và ràng buộc                                                    |
| ------------------------------------ | ------------------ | ----------------- | ----------------------------------------------------------------------- |
| userId                               | ObjectId           | Bắt buộc          | Xác minh chủ thể trước export/delete.                                   |
| requestType                          | enum               | Bắt buộc          | access/export/rectify/delete/restrict.                                  |
| status                               | enum               | received          | Theo state machine BR.                                                  |
| requestedAt; verifiedAt; completedAt | Date; Date?; Date? | server time; null | Mốc nghiệp vụ.                                                          |
| identityVerificationMethod           | enum?              | null              | Re-auth phù hợp; không bắt upload giấy tờ khi chưa cần.                 |
| requestedScope; completedScope       | string[]; string[] | Bắt buộc; []      | Nhóm dữ liệu, không arbitrary query.                                    |
| retainedCategories                   | object[]           | []                | Category + basisCode + retentionUntil?; không nhân bản dữ liệu giữ lại. |
| assignedTo; outcomeCode              | ObjectId?; enum?   | null              | Phân công và kết quả đã giải thích.                                     |
| exportAssetId; exportExpiresAt       | ObjectId?; Date?   | null              | Export private, có expiry, không public URL lâu dài.                    |
| requestId                            | string             | Bắt buộc          | Trace toàn flow.                                                        |

**Indexes:** {userId,requestedAt:-1}; {status,requestedAt:1}.

**Invariant/quyền:** Purge cả linked data theo map; kết quả có thể partially_completed và giải thích dữ liệu phải giữ. Backup restore phải chạy lại suppression/deletion list.

**Retention:** Nội dung export ngắn hạn; hồ sơ xử lý giữ tối thiểu theo policy, không copy toàn PII vào ticket.

### 07. `media_assets`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE_SOFT`

Metadata media; binary để file/object storage, không nhúng document.

**Runtime ảnh tĩnh 24/10/2026 (CAT-06/AUTH-09):** `media_assets` vẫn design-only, chưa có model/collection/upload API. 73 ảnh repository chuyển sang Cloudinary `goease/app` và `goease/docs`; manifest công khai ở `packages/media/assets-manifest.json` giữ sourcePath lịch sử, assetId/publicId/assetFolder/version, URL bản gốc, byte size, width/height và SHA-256. Không có credential trong manifest. Catalog seed/import/write mới dùng URL CDN; DTO public/admin ánh xạ đúng imageUrl local cũ qua `@goease/media`, không ghi lại MongoDB, catalog_versions, audit hay lịch sử chuyến. Avatar mặc định dùng CDN; avatarUrl tài khoản HTTPS không thay đổi. Xem [Cloudinary media](CLOUDINARY-MEDIA.md).

| Field                               | Kiểu                      | Required/default   | Ý nghĩa và ràng buộc                                             |
| ----------------------------------- | ------------------------- | ------------------ | ---------------------------------------------------------------- |
| ownerId                             | ObjectId?                 | Điều kiện          | Người upload; system ingest có actor riêng.                      |
| storageKey; storageProvider         | string; enum              | Bắt buộc           | File local dev/object_storage/remote_reference.                  |
| purpose; access                     | enum; enum                | Bắt buộc; private  | avatar/place_image/post_image/attachment/export; public/private. |
| mimeType; byteSize; checksum        | string; integer; string?  | Bắt buộc; optional | Validate server; checksum không thay kiểm tra an toàn.           |
| width; height                       | integer?; integer?        | null               | Với ảnh.                                                         |
| sourceUrl; attribution; licenseCode | string?; string?; string? | Theo nguồn         | Chỉ giữ URL hợp lệ, tránh query chứa token.                      |
| scanStatus                          | enum                      | pending            | pending/clean/rejected/not_applicable.                           |
| retentionUntil; expiresAt           | Date?; Date?              | null               | Expiry áp dụng file lẫn metadata qua job có kiểm soát.           |

**Indexes:** {ownerId,createdAt:-1}; {storageProvider,storageKey} unique nếu storage nội bộ.

**Invariant/quyền:** Authorization dựa owner/access và entity liên kết. Không public export giấy tờ. Xóa file không thể bảo đảm bằng TTL metadata đơn thuần.

**Retention:** Theo entity sở hữu/license; xóa orphan và object storage bằng job có audit.

### 08. `destinations`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE_SOFT`

Khu vực du lịch/chặng, phân biệt địa điểm cụ thể.

| Field                            | Kiểu               | Required/default | Ý nghĩa và ràng buộc                                                                                                                                                                             |
| -------------------------------- | ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| slug; name                       | string; string     | Bắt buộc         | Slug nội bộ; tên có dấu.                                                                                                                                                                         |
| countryCode; administrativeCodes | string; object?    | VN; optional     | Code có source/version, không hardcode vĩnh viễn đơn vị hành chính.                                                                                                                              |
| tourismRegion                    | enum?              | null cho legacy  | IMPLEMENTED CAT-16: northwest/northeast/northern-delta/north-central/south-central-coast/central-highlands/southeast/mekong-delta. Miền north/central/south suy ra từ taxonomy, không lưu riêng. |
| parentDestinationId              | ObjectId?          | null             | Quan hệ cha nếu cần; không cycle.                                                                                                                                                                |
| summary; coverAssetId            | string?; ObjectId? | null             | Nội dung tuyển chọn.                                                                                                                                                                             |
| center                           | GeoJSON Point?     | null             | Coordinates [longitude,latitude].                                                                                                                                                                |
| timezone                         | IANA timezone      | Bắt buộc         | Múi giờ lịch tại điểm đến.                                                                                                                                                                       |
| interestCodes                    | string[]           | []               | Taxonomy kiểm soát, giới hạn số phần tử.                                                                                                                                                         |
| publicationStatus                | enum               | draft            | draft/published/archived.                                                                                                                                                                        |
| source                           | SourceRef          | Bắt buộc         | GoEase curated hoặc provider, provenance và rights.                                                                                                                                              |

**Indexes:** Unique active slug; {publicationStatus,deletedAt}; runtime CAT-16 thêm {tourismRegion,publicationStatus,deletedAt,name,_id}; optional 2dsphere center nếu có query gần.

**Runtime CAT-16:** destination admin nhận name<=100, slug ASCII kebab<=100, summary<=1000, tourismRegion trong 8 code, publicationStatus draft/published/archived. countryCode=VN và timezone=Asia/Ho_Chi_Minh do server đặt. Create revision1, update CAS và tăng1; createdBy/updatedBy từ admin session. Cả mutation + audit catalog.destination_created/updated (entityType destination) + idempotency receipt cùng transaction. Key resourceType thêm destination, operation destination.write, TTL/expiry24h kế thừa; retry reauthorize và hash cùng thao tác. Không xóa/đổi ID, không sửa trip snapshot. Legacy tourismRegion null được phép đọc, chỉnh sửa mới phải chọn vùng. Chưa tự backfill dữ liệu ứng dụng. Giới hạn cấu hình catalog_settings.regions tăng20→100, payload HTTP16KB và provider quota/radius giữ nguyên. `media_assets`/các schema baseline còn lại không được triển khai thêm bởi CAT-16.

**Invariant/quyền:** Không suy ra cả vùng là một POI. Không để đổi tên/codes làm đổi ID trip cũ.

**Retention:** Nội dung nội bộ theo lifecycle; nguồn ngoài theo license.

### 09. `places`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE_SOFT`

**Runtime Khám phá 2026-10-22 (CAT-07):** subset catalog biên tập đã chạy; bảng dưới là thiết kế provider rộng hơn. Runtime dùng destinationId, destinationName (max100), name/slug (max120), description (max2000), category enum food/culture/nature, subtitle (max150), searchText không dấu (max2500), imageUrl/sourceUrl (max2048), imageCredit (max100), durationLabel/travelLabel/bestTimeLabel (max60), tip (max400), highlights tối đa8 mục name(max100)/query(max150), publicationStatus draft/published/archived, deletedAt và mutable metadata. Index đang chạy: {destinationId,publicationStatus,deletedAt}. Geoapify source subset và external unique index đã triển khai (xem Runtime Geoapify import); SourceRef tổng quát, categoryCodes/tags, địa lý/2dsphere, structured hours và mediaAssetIds vẫn chưa triển khai. Giá tham khảo admin có phạm vi runtime riêng ở cuối tài liệu. imageUrl trỏ ảnh AI local; sourceUrl là nguồn tham khảo, không cache ảnh/review provider. Seed chỉ thêm ID chưa tồn tại.

**Runtime bản đồ2026-10-23:** mapLocation optional object: latitude[-90,90], longitude[-180,180], label(max150), precision=area, sourceUrl HTTPS(max2048), checkedAt ISO date. Validation Mongoose/Zod; không index near/2dsphere. Đây là metadata khu vực phục vụ bản đồ; field GeoJSON location bên dưới vẫn là thiết kế chưa triển khai. Seed backfill field absent, giữ bản đã chỉnh hoặc null; trip snapshot không đổi. Xem TRIP-MAP.md.

POI dùng discovery/planner; provider ref và dữ liệu chất lượng rõ ràng.

| Field                        | Kiểu                         | Required/default   | Ý nghĩa và ràng buộc                                                      |
| ---------------------------- | ---------------------------- | ------------------ | ------------------------------------------------------------------------- |
| destinationId                | ObjectId                     | Bắt buộc           | Khu vực chính; query nhiều vùng qua địa lý khi có nhu cầu.                |
| name; slug; description      | string; string?; string?     | Bắt buộc; optional | Nội dung giới hạn, sanitize.                                              |
| categoryCodes; tags          | string[]; string[]           | Bắt buộc; []       | Enum/taxonomy versioned.                                                  |
| location; address            | GeoJSON Point?; object?      | Điều kiện          | Address có formatted/country/admin codes, không địa chỉ người dùng.       |
| contact; website             | object?; string?             | optional           | Public contact hợp lệ của cơ sở.                                          |
| openingHours; timezone       | OpeningHours?; IANA timezone | optional; bắt buộc | Weekly slots, exceptions, sourceVerifiedAt; unknown phân biệt closed.     |
| visitDurationMinutes         | integer?                     | null               | Ước tính có nhãn.                                                         |
| priceEstimate                | CostEstimate?                | null               | Giá tham khảo, có source/asOf; không quote booking.                       |
| mediaAssetIds                | ObjectId[]                   | []; bounded        | Ảnh được quyền dùng.                                                      |
| source                       | SourceRef                    | Bắt buộc           | provider/externalId/fetchedAt/validUntil/rights.                          |
| externalRating               | object?                      | null               | Provider rating tách review GoEase; không cộng gộp sai.                   |
| qualityFlags; businessStatus | enum[]; enum                 | []; unknown        | Mức kiểm chứng/temporarily_closed/permanently_closed/operational/unknown. |
| publicationStatus            | enum                         | draft              | draft/published/archived.                                                 |

**Indexes:** Unique partial {source.provider,source.externalId} khi có externalId; {destinationId,publicationStatus,deletedAt}; 2dsphere location nếu dùng near.

**Invariant/quyền:** Nguồn bị gỡ/expired phải refresh hoặc ẩn theo rights. Snapshots trong trip có policy riêng. Không coi source hợp lệ là thông tin bảo đảm luôn chính xác.

**Retention:** Theo source permissions; không mặc định dump raw API response vĩnh viễn.

### 10. `trips`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE_SOFT`

Aggregate chuyến đi: ngày/hoạt động hữu hạn nhúng; không nhúng audit/reviews/events.

| Field                         | Kiểu                       | Required/default   | Ý nghĩa và ràng buộc                                                                  |
| ----------------------------- | -------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| ownerId                       | ObjectId                   | Bắt buộc           | Gán từ authenticated user, bất biến ngoài transfer flow.                              |
| title; summary; coverAssetId  | string; string?; ObjectId? | Bắt buộc; optional | Title/notes mặc định private, không tự gửi analytics.                                 |
| status; visibility            | enum; enum                 | draft; private     | draft/planned/completed/archived; private/shared_link.                                |
| destinations                  | TripDestination[]          | 1..cap             | destinationId + nameSnapshot + timezone + order; thiết kế nhiều chặng.                |
| startDate; endDate; timezone  | LocalDate; LocalDate; IANA | Bắt buộc           | Date-only theo lịch chuyến; timezone tổng dùng khi chưa có chặng.                     |
| travelers                     | object                     | Bắt buộc           | totalCount; adults?/children? chỉ khi scope cần. Không thu tên mọi người mặc định.    |
| budget                        | object                     | Bắt buộc           | amountMinor:null hoặc integer; currency:VND; scope:group_total; includedCategories[]. |
| preferences                   | object                     | {}                 | interestCodes[], pace, transportModes[], explicit constraints allowlist.              |
| generationMode; sourceAiRunId | enum; ObjectId?            | manual; null       | manual/ai/rule_based/template; nguồn tạo đề xuất.                                     |
| days                          | TripDay[]                  | Bounded            | dayId/date/destinationId/title?/activities[]; xem embedded dictionary.                |
| summaryTotals                 | object                     | server computed    | knownEstimatedMinor, missingCostCount, currency; không là doanh thu/thực chi.         |
| notes                         | string? private            | null; length cap   | Không ghi vào analytics hoặc audit snapshot tổng quát.                                |
| firstSavedAt; completedAt     | Date; Date?                | server time; null  | Activation chỉ dùng firstSavedAt, không đếm mỗi update.                               |
| clonedFromTripId              | ObjectId?                  | null               | Clone có quyền; không lộ nguồn private cho người ngoài.                               |

**Indexes:** {ownerId,deletedAt,updatedAt:-1,_id:-1}; {ownerId,status,deletedAt}; idempotency trên key riêng.

**Invariant/quyền:** Mọi update dùng expectedRevision và quyền. Trip + tripRevision + audit/outbox commit cùng transaction khi cần lịch sử chắc chắn. Giới hạn BSON theo app nhỏ hơn mức MongoDB; không stringify toàn trip vào log.

**Retention:** Xóa mềm đề xuất 30 ngày để khôi phục rồi purge cùng revisions/shares/expenses thích hợp; booking/order độc lập.

### 11. `trip_revisions`

**Lớp:** CORE · **Bộ metadata:** `APPEND`

Bản lịch đã lưu có thể phục hồi; dữ liệu riêng không phải analytics.

| Field                                                       | Kiểu                                | Required/default                            | Ý nghĩa và ràng buộc                                                   |
| ----------------------------------------------------------- | ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| tripId; ownerIdAtWrite                                      | ObjectId; ObjectId                  | Bắt buộc                                    | Authorization luôn đối chiếu trip hiện tại, không chỉ owner snapshot.  |
| revision; previousRevision                                  | integer; integer?                   | Bắt buộc                                    | Monotonic, unique theo trip.                                           |
| tripSchemaVersion                                           | integer                             | Bắt buộc                                    | Phiên bản cấu trúc snapshot.                                           |
| action                                                      | enum                                | Bắt buộc                                    | created/saved/generated_applied/restored/deleted/transfer.             |
| snapshot                                                    | TripRestoreSnapshot                 | Bắt buộc                                    | Nội dung cần phục hồi, không auth tokens/payment/URLs private hết hạn. |
| changedFieldPaths                                           | string[]                            | []                                          | Allowlist; không raw user field path tùy ý.                            |
| actorId; actorType                                          | ObjectId?; enum                     | Bắt buộc theo actor                         | user/admin/system.                                                     |
| requestId; operationId; sourceAiRunId; restoredFromRevision | string; string; ObjectId?; integer? | Hai string bắt buộc; hai field sau optional | Cùng operationId với mutation/audit; truy vết đề xuất và phục hồi.     |

**Indexes:** Unique {tripId,revision}; {tripId,createdAt:-1}.

**Invariant/quyền:** Không lưu từng phím gõ. Snapshot được kiểm soát kích thước; mỗi version độc lập dễ restore. Nếu sau này chuyển patch phải có anchor snapshot và kiểm thử reconstruction.

**Retention:** Cùng thời hạn trip, không giữ private notes vĩnh viễn chỉ vì gọi là log.

### 12. `trip_access`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Quyền collaborator có account; không thay public share token.

| Field                            | Kiểu                    | Required/default | Ý nghĩa và ràng buộc                                     |
| -------------------------------- | ----------------------- | ---------------- | -------------------------------------------------------- |
| tripId; userId                   | ObjectId; ObjectId      | Bắt buộc         | Một member/permission cho mỗi trip + user.               |
| role                             | enum                    | viewer           | viewer/editor; owner nằm trên trips.                     |
| status                           | enum                    | invited          | invited/accepted/revoked/declined.                       |
| invitedBy; invitedAt             | ObjectId; Date          | Bắt buộc         | Ai mời và lúc nào.                                       |
| acceptedAt; revokedAt; revokedBy | Date?; Date?; ObjectId? | null             | Lịch sử chi tiết vào audit.                              |
| expiresAt                        | Date?                   | null             | Nếu membership có thời hạn; app kiểm tra, không dựa TTL. |

**Indexes:** Unique {tripId,userId}; {userId,status,updatedAt:-1}.

**Invariant/quyền:** Editor không chuyển owner, xóa trip hoặc mời editor khác trừ policy riêng. Không public lookup membership. Invitation tới email chưa có user cần auth challenge/token riêng trước khi tạo accepted access.

**Retention:** Revoke khi trip/account bị xóa; purge theo trip.

### 13. `trip_share_links`

**Implemented local — TRIP-11/TRIP-12.** Separate runtime collection; general MUTABLE metadata remains planned. Access by unique token hash; owner lists active links. No unbounded array on trip.

| Field                                        | Type/default               | Runtime constraint                                                                      |
| -------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| tripId; ownerId                              | ObjectId, required         | Owner from session; active owned trip required for management.                          |
| tokenHash                                    | string, required           | SHA-256; UI generates 32 random bytes via Web Crypto. Raw token never persisted/logged. |
| schemaVersion; permission; viewPolicyVersion | 1; read_only; itinerary-v1 | Fixed values.                                                                           |
| expiresInDays                                | 1,7,30 required            | Retry must match duration; cannot extend expiry.                                        |
| createdAt; expiresAt                         | Date, required             | Server clock; expiry enforced on reads.                                                 |
| revokedAt                                    | Date/null, default null    | Owner revoke or trip soft delete, never reset by restore.                               |

**Indexes:** unique {tokenHash:1}; {tripId:1,ownerId:1,createdAt:-1}. No TTL, migration or purge job.

**Rules:** Maximum 10 active links per trip; server serializes creation/revoke/delete via existing internal trip expenseRevision counter without changing itinerary revision/updatedAt. Create/revoke and safe audit are transactional. Soft-delete revokes all links in the same transaction. Public DTO explicitly allows itinerary labels/dates/stops/catalog IDs only; no private notes, costs, user/owner IDs, AI provenance or expense reads. See [contract and limits](TRIP-SHARING.md).

### 14. `trip_expenses`

**Implemented local subset — 2026-10-23, TRIP-08/TRIP-13.** Separate collection; owner-only CRUD. Fields: tripId, recordedBy, updatedBy (server ObjectId); description (trim1–160); category transport/lodging/meal/visit/other; amountMinor (integer1..1e12 group total), currency=VND; spentOn (ISO date-only), timezone=Asia/Ho_Chi_Minh; revision/schemaVersion default1; timestamps; deletedAt/deletedBy null by default.

**Index implemented:** `{tripId:1,deletedAt:1,spentOn:-1,_id:-1}`. Strict Mongoose and Zod runtime validation; no raw MongoDB JSON Schema validator. Date can precede/follow trip. Soft-deleted entries excluded from paginated lists and full aggregate. Owner derived from parent trip and session. No activity link, paidBy, receipts, notes, spentAt instant or settlement in current runtime; those remain future design.

**Related runtime changes:** trips.expenseRevision default0 serializes expense transactions independently of itinerary revision/updatedAt; idempotency_keys accepts resourceType trip_expense and expense.created/updated/deleted operations (24h TTL); audit_logs supports those actions/entity, with no description/amount payload. Full contract and atomicity in [TRIP-EXPENSES.md](TRIP-EXPENSES.md).

**Retention:** soft delete implemented; automatic purge/account deletion cascades and receipt retention are not implemented. This is a spending journal, not confirmed payment.

### 15. `favorites`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

**Runtime Khám phá 2026-10-22 (CAT-07):** userId, targetType=place, targetId, removedAt, note, revision và timestamps đã chạy. TargetType khác và metadata MUTABLE ngoài timestamps chưa triển khai. Hai index dưới đã chạy. Owner từ session; chỉ hydrate place published/chưa xóa. Note private không có trong public DTO/log/audit. Bỏ lưu giữ note. List hiện giới hạn100 quan hệ mới nhất; account purge/retention job chưa triển khai. Cập nhật2026-10-23: response SavedPlacesDto có items (published) và unavailable (placeId/state của chính user, không hydrate catalog). Cho phép unsave-only quan hệ đã ẩn theo revision; không đổi schema/index hoặc migration.

Quan hệ yêu thích, không mảng không giới hạn trên user.

| Field                | Kiểu           | Required/default | Ý nghĩa và ràng buộc                                                               |
| -------------------- | -------------- | ---------------- | ---------------------------------------------------------------------------------- |
| userId               | ObjectId       | Bắt buộc         | Chủ quan hệ.                                                                       |
| targetType; targetId | enum; ObjectId | Bắt buộc         | destination/place/post/service_listing.                                            |
| removedAt            | Date?          | null             | Toggle cùng một quan hệ; sự kiện thích/bỏ thích riêng nếu được phép.               |
| note                 | string         | ''               | Runtime: private, tối đa2.000 ký tự; bỏ lưu vẫn giữ.                               |
| revision             | integer        | 1                | Runtime: CAS expectedRevision; 0 khi chưa có record, conflict409 nếu phiên bản cũ. |

**Indexes:** Unique {userId,targetType,targetId}; {userId,removedAt,createdAt:-1}.

**Invariant/quyền:** Hydrate target qua quyền/publication/deleted checks. Không coi favorites là consent marketing.

**Retention:** Xóa theo account; analytics có retention độc lập hợp lệ.

### 16. `ai_runs`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE`

Metadata thực thi planner có thể đối soát chi phí/quota/chất lượng.

| Field                                          | Kiểu                       | Required/default   | Ý nghĩa và ràng buộc                                                                          |
| ---------------------------------------------- | -------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| userId; tripId                                 | ObjectId; ObjectId?        | Bắt buộc; optional | Có thể chạy trước khi trip được lưu lần đầu.                                                  |
| requestId; idempotencyKey                      | string; string             | Bắt buộc           | Key theo actor và operation; payload hash riêng.                                              |
| status                                         | enum                       | queued             | queued/running/succeeded/failed/cancelled.                                                    |
| provider; model; promptVersion; plannerVersion | string                     | Bắt buộc           | Không chỉ model name chung chung.                                                             |
| inputSummary                                   | PlannerInputSummary        | Bắt buộc           | Dest IDs/date range/group count/budget amount+currency/interests cần cho generation; private. |
| sourceRefs                                     | SourceRef[]                | Bounded            | Nguồn đã dùng; không copy toàn bộ raw response.                                               |
| inputHash; outputHash                          | string; string?            | Bắt buộc; optional | HMAC khi nội dung có entropy thấp/PII; hash không phải ẩn danh.                               |
| validatedProposal                              | ItineraryProposal? private | null               | Kết quả chờ apply, có expiry; không raw reasoning.                                            |
| startedAt; completedAt; latencyMs              | Date?; Date?; integer?     | null               | Thống kê runtime.                                                                             |
| usage                                          | object                     | {}                 | inputTokens/outputTokens/providerCostMinor? + currency; providerReported flag.                |
| quotaReservation                               | object                     | Bắt buộc           | bucketId/units/state reserved-consumed-released; recovery status.                             |
| errorCode; warnings; appliedTripRevision       | enum?; enum[]; integer?    | null; []; null     | Error sanitized; phân biệt completed và applied.                                              |
| proposalExpiresAt; retentionUntil              | Date?; Date                | Theo policy        | Xóa proposal trước metadata khi cần; không dùng TTL xóa nhầm run trước reconciliation.        |

**Indexes:** Unique {userId,idempotencyKey}; {userId,createdAt:-1}; {tripId,createdAt:-1}; {status,updatedAt}.

**Invariant/quyền:** Không gửi email/token vào prompt; không log raw prompt/output. Mọi inputSummary có mục đích phục vụ planner chứ không tự được tái dùng marketing/training.

**Retention:** Proposal ngắn hạn đề xuất 24h; metadata 90 ngày là đề xuất. Snapshot applied nằm trip_revisions với retention trip.

### 17. `usage_buckets`

**Lớp:** CORE · **Bộ metadata:** `MUTABLE`

Counter quota theo user/feature/time window; không nguồn bằng chứng thanh toán.

| Field                        | Kiểu             | Required/default | Ý nghĩa và ràng buộc                               |
| ---------------------------- | ---------------- | ---------------- | -------------------------------------------------- |
| userId; feature              | ObjectId; enum   | Bắt buộc         | ai_generation hoặc feature được duyệt.             |
| windowStart; windowEnd       | Date; Date       | Bắt buộc         | UTC, policy múi giờ rõ; cửa sổ nửa mở [start,end). |
| limitSnapshot; policyVersion | integer; string  | Bắt buộc         | Quota lúc tạo bucket; admin changes có audit.      |
| reservedUnits; consumedUnits | integer; integer | 0; 0             | Không âm; reserve nguyên tử dưới limit.            |
| entitlementId                | ObjectId?        | null             | Nếu lượt từ gói trả phí.                           |

**Indexes:** Unique {userId,feature,windowStart}; {windowEnd:1}.

**Invariant/quyền:** Không tăng rồi kiểm tra sau; dùng điều kiện nguyên tử. Reservation có nguồn aiRun; job reconcile tránh kẹt lượt. Không query audit để tính quota mỗi request.

**Retention:** Dọn sau reconciliation và khoảng kiểm tra được duyệt; không purge khi còn reservation đang chạy.

### 18. `posts`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE_SOFT`

Cẩm nang và bài chia sẻ với vòng đời xuất bản.

| Field                                          | Kiểu                      | Required/default   | Ý nghĩa và ràng buộc                               |
| ---------------------------------------------- | ------------------------- | ------------------ | -------------------------------------------------- |
| authorId; editorId                             | ObjectId; ObjectId?       | Bắt buộc; optional | Không public email tác giả.                        |
| slug; title; excerpt                           | string; string; string?   | Bắt buộc; optional | Slug normalize và uniqueness theo policy.          |
| body; bodyFormat                               | string/typed blocks; enum | Bắt buộc           | Markdown hoặc blocks có schema; sanitize HTML/XSS. |
| coverAssetId; mediaAssetIds                    | ObjectId?; ObjectId[]     | null; bounded []   | Media có quyền.                                    |
| destinationIds; tags                           | ObjectId[]; string[]      | Bounded []         | Discovery cross links.                             |
| status; publishedAt; submittedAt               | enum; Date?; Date?        | draft; null        | Theo state machine.                                |
| moderationReasonCode; moderatedBy; moderatedAt | enum?; ObjectId?; Date?   | null               | Chi tiết vào audit, không chỉ ghi đè lý do.        |

**Indexes:** Unique active slug; {status,deletedAt,publishedAt:-1}; {authorId,updatedAt:-1}.

**Invariant/quyền:** Cần revision bài viết nếu editor cộng tác/rollback trở thành yêu cầu; không dùng audit diff chứa raw body để thay versioned content.

**Retention:** Draft/published theo lifecycle; xóa cá nhân cân nhắc bài công khai theo policy tác giả.

### 19. `reviews`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE_SOFT`

Review nền tảng với provenance khác external ratings.

| Field                                | Kiểu                     | Required/default        | Ý nghĩa và ràng buộc                              |
| ------------------------------------ | ------------------------ | ----------------------- | ------------------------------------------------- |
| authorId; targetType; targetId       | ObjectId; enum; ObjectId | Bắt buộc                | place/service_listing/partner.                    |
| rating; title; body                  | integer; string?; string | 1..5; optional; bounded | Không cho HTML tùy ý.                             |
| bookingId                            | ObjectId?                | null                    | Nguồn chứng minh trải nghiệm nếu có.              |
| verification                         | enum                     | unverified              | unverified/verified_booking do server quyết định. |
| status                               | enum                     | pending                 | pending/published/rejected/hidden.                |
| moderatedBy; moderatedAt; reasonCode | ObjectId?; Date?; enum?  | null                    | Audit mọi thay đổi moderation.                    |

**Indexes:** {targetType,targetId,status,deletedAt,createdAt:-1}; unique active {authorId,targetType,targetId} theo baseline một review/target.

**Invariant/quyền:** Rating aggregate chỉ published; sửa review có revision/audit cần thiết. Nếu review theo từng booking sau này thay unique index qua migration đã kiểm tra.

**Retention:** User deletion anonymize attribution hoặc purge theo policy; không giữ nội dung nhận diện ngoài căn cứ.

### 20. `moderation_reports`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Báo cáo nội dung và quyết định kiểm duyệt.

| Field                                  | Kiểu                     | Required/default  | Ý nghĩa và ràng buộc                                           |
| -------------------------------------- | ------------------------ | ----------------- | -------------------------------------------------------------- |
| reporterId; targetType; targetId       | ObjectId; enum; ObjectId | Bắt buộc          | Review/post/listing/user public profile.                       |
| category; description                  | enum; string? private    | Bắt buộc; bounded | spam/abuse/inaccurate/privacy/other; không gửi sang analytics. |
| status; assignedTo                     | enum; ObjectId?          | open; null        | open/in_review/resolved/rejected.                              |
| resolutionCode; resolvedAt; resolvedBy | enum?; Date?; ObjectId?  | null              | Reference audit hành động sửa target.                          |

**Indexes:** {status,createdAt:1}; {targetType,targetId,createdAt:-1}; rate-limit theo reporter.

**Invariant/quyền:** Bảo vệ danh tính người báo cáo. Report không tự xóa target trước khi đủ điều kiện policy.

**Retention:** Thời hạn xử lý và appeal policy; dọn description PII sớm khi có thể.

### 21. `partners`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE_SOFT`

Đối tác địa phương/công ty hoặc hướng dẫn viên, không phải identity login riêng.

| Field                                         | Kiểu                          | Required/default   | Ý nghĩa và ràng buộc                                                |
| --------------------------------------------- | ----------------------------- | ------------------ | ------------------------------------------------------------------- |
| kind; displayName; legalName                  | enum; string; string? private | Bắt buộc; optional | individual_guide/company/provider.                                  |
| slug; description; avatarAssetId              | string; string?; ObjectId?    | Bắt buộc; optional | Hồ sơ công khai tách dữ liệu pháp lý.                               |
| serviceDestinationIds; languages; specialties | arrays                        | Bounded []         | Khu vực, ngôn ngữ, chuyên môn đã khai.                              |
| publicContact; privateContact                 | typed object?                 | optional           | Thu tối thiểu; không tự public email/phone riêng.                   |
| verificationStatus; verifiedAt; verifiedBy    | enum; Date?; ObjectId?        | pending; null      | pending/approved/rejected/suspended.                                |
| verificationEvidenceRef                       | private media ref?            | null               | Chỉ thu giấy tờ khi quy trình yêu cầu; không lưu bản gốc trong log. |
| commissionPolicyRef                           | string?                       | null               | Hợp đồng/phiên bản, chưa tự quyết tỷ lệ.                            |

**Indexes:** Unique active slug; {verificationStatus,deletedAt}; destination query index khi có nhu cầu.

**Invariant/quyền:** Không dùng một contactEmail để suy ra partner ownership. Không lưu số dư tài chính ở đây.

**Retention:** Tắt partner không xóa bookings. Hồ sơ pháp lý theo policy riêng, không blanket soft delete.

### 22. `partner_memberships`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Quyền user trong một đối tác.

| Field                            | Kiểu                   | Required/default | Ý nghĩa và ràng buộc                   |
| -------------------------------- | ---------------------- | ---------------- | -------------------------------------- |
| partnerId; userId                | ObjectId; ObjectId     | Bắt buộc         | Actor đang active mới có quyền.        |
| role                             | enum                   | operator         | owner/manager/operator/finance_viewer. |
| status                           | enum                   | invited          | invited/active/revoked.                |
| invitedBy; acceptedAt; revokedAt | ObjectId; Date?; Date? | Bắt buộc; null   | User không tự nâng role.               |

**Indexes:** Unique {partnerId,userId}; {userId,status}.

**Invariant/quyền:** Không gỡ owner cuối trước transfer đã xác minh; partner admin không trở thành system admin.

**Retention:** Revoke ngay khi cần; audit lịch sử, purge theo quan hệ/policy.

### 23. `service_listings`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE_SOFT`

Danh mục local guide/experience/hotel/flight referral và dịch vụ có adapter thực.

| Field                               | Kiểu                   | Required/default | Ý nghĩa và ràng buộc                                                                                                       |
| ----------------------------------- | ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| partnerId; destinationId            | ObjectId?; ObjectId?   | Theo loại        | Provider listing có provenance riêng.                                                                                      |
| type; fulfillmentMode               | enum; enum             | Bắt buộc         | guide/experience/hotel/flight; referral/inquiry/manual_booking/provider_api.                                               |
| title; description; slug            | string; string; string | Bắt buộc         | Nội dung có kiểm duyệt.                                                                                                    |
| mediaAssetIds; languages; tags      | arrays                 | Bounded []       | Không lưu media binary.                                                                                                    |
| pricing                             | PriceDisplay object    | Bắt buộc         | from/estimated/quote_required + amountMinor? + currency + basis; không báo giá cam kết.                                    |
| serviceDetails                      | discriminated object   | Theo type        | Guide:duration/languages/groupSize; hotel:propertyRef/amenities; flight:providerSearchRef, không giả inventory chuyến bay. |
| provider; externalId; referralUrl   | string?; string?; URL? | Theo mode        | Referral host allowlist, nguồn/license.                                                                                    |
| cancellationPolicyRef; termsVersion | string?; string?       | Theo mode        | Booking enabled cần đủ điều kiện.                                                                                          |
| status; approvedAt; approvedBy      | enum; Date?; ObjectId? | draft; null      | draft/in_review/published/suspended/archived.                                                                              |

**Indexes:** Unique active slug; partial unique {provider,externalId}; {type,destinationId,status,deletedAt}.

**Invariant/quyền:** Mode quyết định CTA đúng: Xem đối tác/Gửi yêu cầu/Đặt dịch vụ. Partner không tự đổi provider refs thành giả mạo.

**Retention:** Theo quyền dữ liệu và lịch sử booking snapshot; gỡ listing không xóa order.

### 24. `service_inquiries`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Yêu cầu liên hệ/báo giá có định danh, chưa phải booking.

| Field                                 | Kiểu                          | Required/default | Ý nghĩa và ràng buộc                                             |
| ------------------------------------- | ----------------------------- | ---------------- | ---------------------------------------------------------------- |
| userId; listingId; partnerId          | ObjectId                      | Bắt buộc         | Actor requester và bên xử lý.                                    |
| tripId                                | ObjectId?                     | null             | Chỉ backlink, không chia sẻ toàn trip với partner.               |
| requestedDateRange; partySize; budget | typed object; integer; Money? | Theo dịch vụ     | Chỉ thông tin cần báo giá.                                       |
| message; contactChannel               | string private; enum          | Bounded; in_app  | Không tự gửi full profile ra ngoài.                              |
| status; assignedTo                    | enum; ObjectId?               | new; null        | new/acknowledged/quoted/closed/rejected/cancelled.               |
| quote                                 | QuoteSnapshot?                | null             | amount/currency/inclusions/cancellationPolicy/version/expiresAt. |
| quotedAt; closedAt; reasonCode        | Date?; Date?; enum?           | null             | Audit trạng thái.                                                |

**Indexes:** {userId,createdAt:-1}; {partnerId,status,createdAt:-1}; {listingId,createdAt:-1}.

**Invariant/quyền:** Không biến quoted thành confirmed booking. Sửa báo giá tạo quoteVersion và audit; order tham chiếu đúng version đã chấp nhận.

**Retention:** Contact/message private giữ theo vòng xử lý + retention đã duyệt.

### 25. `bookings`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Thực thi dịch vụ, tách khỏi order/payment và trip chỉnh sửa.

| Field                                       | Kiểu                        | Required/default | Ý nghĩa và ràng buộc                                                                                              |
| ------------------------------------------- | --------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| bookingCode; userId; partnerId              | string; ObjectId; ObjectId? | Bắt buộc         | Code public random đủ khó đoán, không thay authorization.                                                         |
| listingId; inquiryId; tripId                | ObjectId?                   | Theo nguồn       | Links tùy dịch vụ; xóa trip không xóa booking.                                                                    |
| fulfillmentMode; serviceType                | enum; enum                  | Bắt buộc         | manual_booking/provider_api; guide/experience/hotel/flight.                                                       |
| serviceSnapshot; acceptedQuote              | typed objects               | Bắt buộc         | Title/provider/local schedule/termsVersion/cancellation policy/amount/currency/quoteExpiry.                       |
| orderId; orderLineId                        | ObjectId?; string?          | Theo thu phí     | Ràng buộc một booking với đúng line.                                                                              |
| status                                      | enum                        | requested        | Theo BR; provider status không map không biết thành confirmed.                                                    |
| schedule                                    | discriminated object        | Bắt buộc         | Experience:start/end/timezone/groupSize; Hotel:dates/room occupancy; Flight:segments+quoteRef khi provider duyệt. |
| travelerDataRef                             | restricted encrypted ref?   | null             | Schema hành khách theo provider, tối thiểu; không generic Mixed passport dump.                                    |
| provider; providerBookingId; providerStatus | string?                     | Điều kiện        | Dùng khi provider thực đã xác nhận.                                                                               |
| confirmationRef; confirmedAt; completedAt   | string?; Date?; Date?       | null             | Có evidence nguồn, không client tự gán.                                                                           |
| cancelledAt; cancellationReasonCode         | Date?; enum?                | null             | Chính sách phí/refund áp dụng độc lập.                                                                            |

**Indexes:** Unique bookingCode; partial unique {provider,providerBookingId}; {userId,createdAt:-1}; {partnerId,status,schedule.startsAt}.

**Invariant/quyền:** Before confirmation verify slot/provider and payment rule. Không dùng deletedAt để hủy nghĩa vụ. Thông tin hành khách không được vào analytics/audit generic.

**Retention:** Không soft-delete tài chính; trạng thái archived khi cần. Retention hợp đồng/pháp lý xác định trước production.

### 26. `products`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_SOFT`

Sản phẩm GoEase bán: gói planner hoặc item dịch vụ được phép thu phí.

| Field                         | Kiểu                 | Required/default   | Ý nghĩa và ràng buộc                                              |
| ----------------------------- | -------------------- | ------------------ | ----------------------------------------------------------------- |
| code; productType; title      | string; enum; string | Bắt buộc           | planner_pass/service_fee/service_booking; không tự bật recurring. |
| priceMinor; currency          | integer; string      | Bắt buộc           | Giá server; VND bản đầu.                                          |
| benefits                      | Benefit[]            | Bounded            | feature/units/duration; không boolean isPremium toàn cục.         |
| listingId                     | ObjectId?            | null               | Nếu gắn dịch vụ.                                                  |
| status; priceVersion          | enum; integer        | draft; 1           | draft/active/retired; version giá bất biến khi đã dùng.           |
| termsVersion; refundPolicyRef | string               | Bắt buộc trước bán | Không tự quyết nội dung pháp lý.                                  |

**Indexes:** Unique code; {status,productType}.

**Invariant/quyền:** Đổi giá chỉ ảnh hưởng order mới; bản order cũ giữ snapshot. Recurring/subscription cần thiết kế billing cycle riêng sau khi chốt.

**Retention:** Giữ catalog lịch sử bằng order snapshots; soft-delete không xóa lịch sử mua.

### 27. `orders`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Đơn hàng/quote đã chấp nhận, tách quyền sử dụng và payment attempts.

| Field                                                        | Kiểu                     | Required/default     | Ý nghĩa và ràng buộc                                                                                               |
| ------------------------------------------------------------ | ------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| orderCode; userId; idempotencyKey                            | string; ObjectId; string | Bắt buộc             | Unique code và dedupe theo user.                                                                                   |
| status; currency                                             | enum; string             | pending_payment; VND | Theo BR, không dựa redirect để paid.                                                                               |
| items                                                        | OrderLine[]              | 1..cap               | lineId/productId?/bookingId?/productType/titleSnapshot/quantity/unitAmount/discount/tax/lineTotal/benefitSnapshot. |
| subtotalMinor; discountMinor; feeMinor; taxMinor; totalMinor | integer                  | Server computed      | Quy tắc sum rõ, không float; thuế chỉ khi đã chốt nghĩa vụ.                                                        |
| paidMinor; refundedMinor; refundReservedMinor                | integer                  | 0                    | Projection từ payment/refund đã xác minh; cập nhật transaction.                                                    |
| promotionSnapshot                                            | object?                  | null                 | Code/ruleVersion/discount, không query campaign mới cho đơn cũ.                                                    |
| termsSnapshot; pricingVersion                                | typed object; string     | Bắt buộc             | Bằng chứng điều kiện tại lúc mua.                                                                                  |
| expiresAt; paidAt; fulfilledAt; cancelledAt                  | Date?                    | null theo trạng thái | Quá hạn có tiền đến cần reconciliation.                                                                            |
| billingProfileRef                                            | restricted ref?          | null                 | Chỉ khi xuất hóa đơn cần; không thu mã số/địa chỉ đại trà.                                                         |

**Indexes:** Unique orderCode; unique {userId,idempotencyKey}; {userId,createdAt:-1}; {status,expiresAt}.

**Invariant/quyền:** Item có ID ổn định. Không xóa mềm/cascade; trạng thái và record bù. Không gọi tổng order là doanh thu ròng GoEase.

**Retention:** Không TTL; thời hạn lưu tài chính phải rà soát theo hình thức kinh doanh/hợp đồng.

### 28. `payments`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Một lần thử thanh toán/charge qua nhà cung cấp.

| Field                                     | Kiểu                    | Required/default  | Ý nghĩa và ràng buộc                                 |
| ----------------------------------------- | ----------------------- | ----------------- | ---------------------------------------------------- |
| orderId; userId                           | ObjectId                | Bắt buộc          | Links bắt buộc còn truy vết được dù user anonymized. |
| provider; merchantAccountRef; environment | string; string; enum    | Bắt buộc          | sandbox/live không trộn; merchantRef không secret.   |
| providerRequestId; providerTransactionId  | string; string?         | Bắt buộc; null    | Unique trong đúng merchant/provider/environment.     |
| idempotencyKey; amountMinor; currency     | string; integer; string | Bắt buộc          | Đúng order/attempt; không client định giá.           |
| status                                    | enum                    | created           | created/pending/unknown/succeeded/failed/expired.    |
| initiatedAt; verifiedAt; paidAt           | Date; Date?; Date?      | server time; null | verifiedAt ghi sau kiểm chứng.                       |
| providerResultCode; failureCode           | string?; enum?          | null              | Sanitize, không raw body.                            |
| lastWebhookEventId; lastReconciledAt      | ObjectId?; Date?        | null              | Liên kết evidence và kiểm tra provider API.          |

**Indexes:** Partial unique {provider,merchantAccountRef,environment,providerTransactionId}; unique {provider,merchantAccountRef,environment,providerRequestId}; {orderId,createdAt:-1}.

**Invariant/quyền:** Order có nhiều payment attempts; server kiểm soát overpay; không auto cấp gói thêm cho mỗi notification. Không lưu PAN/CVV/password ngân hàng.

**Retention:** Retention tài chính riêng; không soft-delete succeeded payment.

### 29. `webhook_events`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Inbox bền vững cho event provider; envelope bất biến, processing state được cập nhật.

| Field                                     | Kiểu                       | Required/default            | Ý nghĩa và ràng buộc                                                               |
| ----------------------------------------- | -------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| provider; merchantAccountRef; environment | string; string; enum       | Bắt buộc                    | Binding đã kiểm chứng.                                                             |
| eventKey; eventType; providerOccurredAt   | string; string; Date?      | Bắt buộc; optional          | Key chính thức hoặc fingerprint canonical ổn định theo adapter.                    |
| paymentId; providerTransactionId          | ObjectId?; string?         | null                        | Resolve an toàn, không tin userId từ callback.                                     |
| receivedAt; signatureVerifiedAt           | Date; Date                 | Bắt buộc cho accepted event | Invalid signature vào security log hạn chế, không accepted inbox.                  |
| payloadHash; normalizedPayload            | string; allowlisted object | Bắt buộc                    | Amount/currency/order/status cần xử lý; raw body dùng verify trong RAM, không log. |
| processingStatus; attempts                | enum; integer              | received; 0                 | received/processing/processed/retry/dead_letter.                                   |
| processedAt; nextAttemptAt; lastErrorCode | Date?; Date?; enum?        | null                        | Theo retry/backoff; có lease nếu worker.                                           |
| requestId                                 | string                     | Bắt buộc                    | Trace callback.                                                                    |

**Indexes:** Unique {provider,merchantAccountRef,environment,eventKey}; {processingStatus,nextAttemptAt}.

**Invariant/quyền:** Chỉ ACK theo contract provider sau ghi bền vững an toàn; processing idempotent. Replay không tạo thêm quyền. Đừng dùng audit generic thay inbox.

**Retention:** Envelope tài chính giữ phù hợp; raw payload mặc định không giữ, muốn giữ phải encrypted + retention riêng.

### 30. `refunds`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Yêu cầu hoàn tiền và kết quả đối soát, không sửa payment thành chưa từng tồn tại.

| Field                                      | Kiểu                       | Required/default   | Ý nghĩa và ràng buộc                                              |
| ------------------------------------------ | -------------------------- | ------------------ | ----------------------------------------------------------------- |
| refundCode; orderId; paymentId             | string; ObjectId; ObjectId | Bắt buộc           | Refund gắn charge thực đã thu.                                    |
| provider; merchantAccountRef; environment  | string; string; enum       | Bắt buộc           | Scope từ payment đã xác minh, dùng unique index providerRefundId. |
| amountMinor; currency; reasonCode          | integer; string; enum      | Bắt buộc           | Amount >0 và không vượt refundable.                               |
| requestedBy; approvedBy                    | ObjectId; ObjectId?        | Bắt buộc; policy   | Tách phê duyệt khi cần.                                           |
| idempotencyKey; providerRefundId           | string; string?            | Bắt buộc; optional | Dedupe cả nội bộ và provider.                                     |
| status                                     | enum                       | requested          | requested/processing/succeeded/failed/cancelled/unknown.          |
| requestedAt; processedAt; lastReconciledAt | Date; Date?; Date?         | server time; null  | Unknown phải đối soát trước retry tạo mới.                        |

**Indexes:** Unique refundCode; unique {paymentId,idempotencyKey}; partial unique {provider,merchantAccountRef,environment,providerRefundId} khi có giá trị; {orderId,createdAt:-1}.

**Invariant/quyền:** Reserve refund amount nguyên tử cùng order/payment balance projection; không chỉ tổng refund sau khi thành công vì hai refund concurrent sẽ vượt.

**Retention:** Theo tài chính, không TTL hoặc deletedAt để xóa tranh chấp.

### 31. `entitlements`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Quyền sử dụng được cấp từ mua hàng hoặc admin grant có căn cứ.

| Field                                   | Kiểu                       | Required/default   | Ý nghĩa và ràng buộc                         |
| --------------------------------------- | -------------------------- | ------------------ | -------------------------------------------- |
| userId; feature                         | ObjectId; enum             | Bắt buộc           | Scope cụ thể ai_generation/premium_features. |
| sourceType; sourceId; orderLineId       | enum; ObjectId; string?    | Bắt buộc           | order_line/admin_grant; orderLine khi mua.   |
| startsAt; endsAt                        | Date; Date?                | Bắt buộc; optional | Kiểm tra ở server, không dựa TTL.            |
| unitLimit; reservedUnits; consumedUnits | integer?; integer; integer | policy; 0; 0       | Null unlimited chỉ khi policy rõ.            |
| status; revokedAt; revokeReasonCode     | enum; Date?; enum?         | active; null       | active/exhausted/expired/revoked.            |
| grantPolicyVersion                      | string                     | Bắt buộc           | Benefit snapshot từ order.                   |

**Indexes:** Unique {sourceType,sourceId,orderLineId,feature}; {userId,feature,status,endsAt}.

**Invariant/quyền:** Cấp đúng một lần; refund xử lý quyền theo policy đã chốt; không reset consumed qua rename gói.

**Retention:** Giữ tối thiểu phục vụ support/tài chính; quyền hết hạn không có nghĩa xóa record ngay.

### 32. `promotions`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_SOFT`

Chiến dịch ưu đãi versioned, không sửa lịch sử giảm giá của đơn đã mua.

| Field                                                                  | Kiểu                    | Required/default | Ý nghĩa và ràng buộc                                          |
| ---------------------------------------------------------------------- | ----------------------- | ---------------- | ------------------------------------------------------------- |
| codeNormalized; title                                                  | string; string          | Bắt buộc         | Code normalize; unique policy.                                |
| discountType; value; maxDiscountMinor                                  | enum; integer; integer? | Bắt buộc         | fixed_amount/basis_points; integer basis points tránh float.  |
| currency; minimumOrderMinor                                            | string; integer         | VND; 0           | Currency bắt buộc với fixed amount.                           |
| applicableProductIds; applicableListingIds                             | ObjectId[]              | Bounded []       | Empty được định nghĩa rõ là tất cả hay không; không suy đoán. |
| startsAt; endsAt; status                                               | Date; Date; enum        | Bắt buộc         | draft/active/paused/ended.                                    |
| maxRedemptions; perUserLimit; budgetLimitMinor                         | integer?                | Theo policy      | Không null unlimited ngoài quyết định.                        |
| reservedCount; redeemedCount; reservedBudgetMinor; redeemedBudgetMinor | integers                | 0                | Counters nguyên tử, không frontend tăng.                      |
| ruleVersion                                                            | integer                 | 1                | Order giữ snapshot ruleVersion.                               |

**Indexes:** Unique codeNormalized (không tái dùng code cũ tùy tiện); {status,startsAt,endsAt}.

**Invariant/quyền:** Sửa policy khi active phải giữ ruleVersion/history; check entitlement/eligibility server.

**Retention:** Lưu rule đã dùng phục vụ order, soft-delete chỉ ẩn campaign.

### 33. `promotion_redemptions`

**Lớp:** COMMERCE · **Bộ metadata:** `MUTABLE_RETAIN`

Giữ lượt/ghi nhận dùng ưu đãi và chống vượt hạn mức.

| Field                                         | Kiểu                     | Required/default | Ý nghĩa và ràng buộc                           |
| --------------------------------------------- | ------------------------ | ---------------- | ---------------------------------------------- |
| promotionId; userId; orderId                  | ObjectId                 | Bắt buộc         | Ràng buộc cả ba.                               |
| ruleVersion; discountMinor; currency          | integer; integer; string | Bắt buộc         | Snapshot kết quả server.                       |
| status                                        | enum                     | reserved         | reserved/redeemed/released.                    |
| reservedAt; expiresAt; redeemedAt; releasedAt | Date; Date; Date?; Date? | Bắt buộc; null   | Expiry job release counter, không chỉ TTL xóa. |

**Indexes:** Unique {promotionId,orderId}; {promotionId,userId,status}; {status,expiresAt}.

**Invariant/quyền:** Counters global + user phải cập nhật transaction hoặc atomic allocation có chứng minh; không có rollback tiền thật qua TTL.

**Retention:** Giữ redeemed theo order; reserved/released dọn sau đối soát.

### 34. `notifications`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Thông báo theo user; không mảng lịch sử vô hạn.

| Field                                    | Kiểu                               | Required/default | Ý nghĩa và ràng buộc                          |
| ---------------------------------------- | ---------------------------------- | ---------------- | --------------------------------------------- |
| userId; type                             | ObjectId; enum                     | Bắt buộc         | trip/inquiry/booking/payment/security/system. |
| templateKey; templateVersion; parameters | string; string; allowlisted object | Bắt buộc         | Không nhét full sensitive payload.            |
| entityType; entityId                     | enum?; ObjectId?                   | null             | Deep link phải re-authorize khi mở.           |
| channel; status                          | enum; enum                         | in_app; pending  | in_app/email/push; pending/sent/failed.       |
| dedupeKey; sentAt; readAt; expiresAt     | string; Date?; Date?; Date?        | Bắt buộc; null   | Distinct notification với delivery retry.     |

**Indexes:** Unique {userId,channel,dedupeKey}; {userId,readAt,createdAt:-1}; TTL expiresAt nếu phù hợp chỉ in-app.

**Invariant/quyền:** Thông báo lockscreen/email không lộ trip notes hoặc giấy tờ; unsubscribe marketing không chặn thông báo giao dịch cần thiết theo policy.

**Retention:** In-app đề xuất 90 ngày; security evidence ở audit, không phụ thuộc notification tồn tại.

### 35. `support_tickets`

**Lớp:** PLATFORM · **Bộ metadata:** `MUTABLE`

Yêu cầu hỗ trợ có quyền, tránh thu PII qua log chung.

| Field                        | Kiểu                   | Required/default   | Ý nghĩa và ràng buộc                                           |
| ---------------------------- | ---------------------- | ------------------ | -------------------------------------------------------------- |
| ticketCode; userId; category | string; ObjectId; enum | Bắt buộc           | account/trip/booking/payment/privacy/other.                    |
| subject; description         | string private         | Bounded            | Không copy password/token; hướng dẫn user không nhập bí mật.   |
| relatedType; relatedId       | enum?; ObjectId?       | null               | Support access cần quyền, không cho arbitrary ref đọc dữ liệu. |
| attachmentAssetIds           | ObjectId[]             | Bounded []         | Private storage.                                               |
| status; priority; assignedTo | enum; enum; ObjectId?  | open; normal; null | open/in_progress/waiting_user/resolved/closed.                 |
| resolvedAt; resolutionCode   | Date?; enum?           | null               | Không biến description thành chat history vô hạn.              |

**Indexes:** Unique ticketCode; {userId,createdAt:-1}; {status,priority,createdAt:1}.

**Invariant/quyền:** Nếu có hội thoại hỗ trợ nhiều lượt, thêm support_messages với ticketId, không append mảng không giới hạn vào ticket.

**Retention:** Đề xuất đóng +90 ngày rồi giảm PII; tranh chấp tài chính xử lý retention riêng.

### 36. `audit_logs`

**Lớp:** F1 · **Bộ metadata:** `APPEND`

Ai đã làm gì, trên đối tượng nào, kết quả và lý do; không là hồ sơ marketing.

| Field                                     | Kiểu                    | Required/default             | Ý nghĩa và ràng buộc                                                                   |
| ----------------------------------------- | ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| action; category                          | enum; enum              | Bắt buộc                     | Taxonomy action/category theo mục 11; collection registry không phải action registry.  |
| actor                                     | AuditActor              | Bắt buộc                     | type user/admin/system/provider; userId?; roleSnapshot?; serviceName?; server-derived. |
| entityType; entityId; entityRevision      | enum; string?; integer? | Bắt buộc theo action         | ID nội bộ; không user-supplied collectionName/query.                                   |
| occurredAt; recordedAt                    | Date; Date              | server time                  | Phân biệt lúc xảy ra và ghi nhận.                                                      |
| requestId; correlationId; operationId     | string; string?; string | Bắt buộc; optional; bắt buộc | Correlation nối nhiều request, operation chống event duplicate.                        |
| outcome; reasonCode                       | enum; enum?             | Bắt buộc                     | succeeded/failed/denied; reason code không arbitrary PII.                              |
| changedFields; changes                    | string[]; SafeChange[]  | Bounded []                   | Field allowlist; before/after cho enum/numeric an toàn, text chỉ changed/redacted.     |
| source                                    | object                  | Bắt buộc                     | appVersion/clientPlatform/channel/environment.                                         |
| securityContext                           | object? restricted      | optional                     | Coarse agent/IP HMAC nếu mục đích cần; không IP raw mặc định.                          |
| retentionClass; retentionUntil; legalHold | string; Date?; boolean  | Bắt buộc; policy; false      | Không TTL blanket; legalHold cần căn cứ, expiry/review.                                |

**Indexes:** Unique {operationId,action,entityType,entityId}; {entityType,entityId,occurredAt:-1}; {actor.userId,occurredAt:-1}; {requestId:1}.

**Invariant/quyền:** Ứng dụng chỉ insert/read được cấp. Mutation quan trọng cùng transaction audit; thất bại transaction không tự tạo audit thành công. Migration/privileged bypass cần actor và runId riêng.

**Retention:** Append-only nghiệp vụ không đồng nghĩa giữ vĩnh viễn; purge/redact đặc quyền có policy và log độc lập.

### 37. `analytics_events`

**Lớp:** CORE · **Bộ metadata:** `APPEND`

Hành vi tối thiểu để đo funnel/cá nhân hóa theo mục đích được phép.

| Field                                     | Kiểu                           | Required/default | Ý nghĩa và ràng buộc                                                                              |
| ----------------------------------------- | ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| eventName; eventVersion                   | enum; integer                  | Bắt buộc         | Registry, không arbitrary event/data payload.                                                     |
| userId; anonymousId; analyticsSessionId   | ObjectId?; string?; string?    | Theo consent     | Không dùng auth token làm sessionId; guest ID chỉ khi cho phép.                                   |
| occurredAt; receivedAt                    | Date; Date                     | Bắt buộc         | Client timestamp không đáng tin; nhận lệch lớn phải cờ hóa.                                       |
| source; trustLevel                        | enum; enum                     | Bắt buộc         | client/server/provider_verified; không coi client payment event là bằng chứng tiền.               |
| entityType; entityId; requestId           | enum?; string?; string?        | Theo event       | Server xác minh userId, quyền và business event khi có.                                           |
| properties                                | discriminated allowlist object | Bắt buộc         | destinationId/budgetBand/tripDays/groupSizeBucket/rank/errorCode... không email/notes/raw search. |
| consent                                   | object                         | Bắt buộc         | purpose/policyVersion/consentEventId/status; essential event không bị đổi nhãn để né consent.     |
| appVersion; platform; environment; isTest | string; enum; enum; boolean    | Bắt buộc         | web/ios/android; dev/staging/prod; internal traffic loại KPI.                                     |
| recommendationId; experiment              | string?; object?               | optional         | modelVersion/rank; experimentId/variant khi thật sự có experiment.                                |
| expiresAt                                 | Date                           | Theo retention   | TTL raw analytics; chấp nhận trễ cleanup, không dùng để kiểm soát quyền.                          |

**Indexes:** Unique eventId; {eventName,receivedAt:-1}; {userId,receivedAt:-1} khi cần; TTL expiresAt.

**Invariant/quyền:** Không chứa free text, IP/token/email. Dedupe theo eventId; server conversion có businessKey riêng. Opt-out ngừng optional collection; aggregate được giữ chỉ khi đã loại khả năng nhận diện theo policy.

**Retention:** Raw đề xuất 90 ngày; aggregates hạn chế và không identifiers có thể lâu hơn sau rà soát; pseudonym hóa không tự thành vô danh.

### 38. `outbox_events`

**Lớp:** F1 · **Bộ metadata:** `MUTABLE`

Outbox trong cùng DB transaction để chuyển audit/notification/analytics có retry mà không mất sự kiện.

| Field                                               | Kiểu                              | Required/default  | Ý nghĩa và ràng buộc                                          |
| --------------------------------------------------- | --------------------------------- | ----------------- | ------------------------------------------------------------- |
| eventType; eventVersion; aggregateType; aggregateId | strings; integer                  | Bắt buộc          | Business event envelope bounded.                              |
| correlationId; operationId; idempotencyKey          | strings                           | Bắt buộc          | Consumer dedupe theo key.                                     |
| payload                                             | event-specific allowlisted object | Bắt buộc          | IDs và nội dung cần thiết; không auth secrets hoặc full trip. |
| status; attempts; availableAt                       | enum; integer; Date               | pending; 0; now   | pending/processing/delivered/dead_letter.                     |
| leaseOwner; leaseUntil                              | string?; Date?                    | null              | Claim nguyên tử, worker chết có thể reclaim.                  |
| processedAt; lastErrorCode                          | Date?; enum?                      | null              | Retry/backoff và giám sát.                                    |
| expiresAt                                           | Date?                             | Chỉ sau delivered | Không TTL pending/financial dead-letter chưa xử lý.           |

**Indexes:** Unique idempotencyKey; {status,availableAt,leaseUntil}; optional TTL expiresAt.

**Invariant/quyền:** Delivery at-least-once; consumer phải idempotent, không hứa exactly-once. Không chạy external side effect trong retried transaction.

**Retention:** Delivered đề xuất 7 ngày; pending/dead-letter giữ để xử lý, không im lặng mất.

### 39. `idempotency_keys`

**Lớp:** CORE · **Bộ metadata:** `EPHEMERAL`

Chống tạo bản sao do retry khi client mất phản hồi.

| Field                                    | Kiểu                     | Required/default   | Ý nghĩa và ràng buộc                                                      |
| ---------------------------------------- | ------------------------ | ------------------ | ------------------------------------------------------------------------- |
| actorId; operation; key                  | ObjectId; enum; string   | Bắt buộc           | Scope theo actor + endpoint business action.                              |
| requestHash                              | string                   | Bắt buộc           | Canonical payload hash; cùng key khác payload trả conflict.               |
| status; leaseUntil                       | enum; Date?              | processing; policy | processing/completed/failed_retryable; không tự cướp request đang chạy.   |
| resourceType; resourceId; responseStatus | enum?; string?; integer? | null               | Trả lại reference/DTO nhỏ, không raw secret response.                     |
| expiresAt                                | Date                     | Theo operation     | Khoảng retry đã duyệt; tài chính cần business uniqueness bền hơn TTL này. |

**Indexes:** Unique {actorId,operation,key}; TTL expiresAt.

**Invariant/quyền:** Idempotency không thay authorization: trả cached result vẫn kiểm tra actor/current access. Race duplicate-key phải đọc record hiện có.

**Retention:** Đề xuất 24h cho trip create; payment không dựa TTL ngắn để ngăn thanh toán/cấp quyền trùng lâu dài.

### 40. `schema_migrations`

**Lớp:** F1 · **Bộ metadata:** `MUTABLE_RETAIN`

Phiên bản thay đổi dữ liệu/index có thể truy vết và tiếp tục sau lỗi.

| Field                                          | Kiểu                         | Required/default        | Ý nghĩa và ràng buộc                          |
| ---------------------------------------------- | ---------------------------- | ----------------------- | --------------------------------------------- |
| migrationId; checksum                          | string; string               | Bắt buộc                | Tên duy nhất, checksum code migration.        |
| fromVersion; toVersion; collections            | integer?; integer?; string[] | Bắt buộc theo migration | Collection có schemaVersion độc lập.          |
| status; batchCursor; affectedCount             | enum; string?; integer       | pending; null; 0        | pending/running/completed/failed/rolled_back. |
| startedAt; completedAt; executedBy; appVersion | Date?; Date?; string; string | Bắt buộc                | Actor hệ thống/operational identity.          |
| backupRef; rollbackPlanRef; errorCode          | string?; string; string?     | Policy                  | Không lưu URI có credential.                  |

**Indexes:** Unique migrationId; {status,startedAt:-1}.

**Invariant/quyền:** Dry-run/backup trước destructive migration; idempotent batches; update indexes sau kiểm tra duplicates. Không sửa migration đã chạy mà giữ cùng checksum.

**Retention:** Giữ cùng lịch sử vận hành của project; dữ liệu cá nhân không nằm trong record migration.

## 6. Ranh giới quan hệ

```text
users ──< auth_identities, auth_sessions, consent_events, privacy_requests
users ──< trips ──< trip_revisions, trip_access, trip_share_links, trip_expenses
trips ── embeds days[] ── embeds activities[]
destinations ──< places ── referenced/snapshotted by trip activities
users ──< ai_runs ──> usage_buckets / entitlements
partners ──< partner_memberships >── users
partners ──< service_listings ──< service_inquiries ──> bookings
orders ── embeds items[]; orders ──< payments ──< refunds
payments ──< webhook_events; order items ──> entitlements
business mutations ──> audit_logs / outbox_events
allowed user interactions ──> analytics_events
```

Đây là tham chiếu logic. MongoDB không tự tạo foreign key enforcement từ ObjectId; services kiểm tra target tồn tại/quyền/vòng đời, transactions cho thao tác cần tính nguyên tử. Không cascade-delete user→orders/payments. View/DTO của partner không hydrate toàn user/trip.

## 7. Extension có điều kiện — không khởi tạo ở F1

Các collection dưới đây **chỉ có khi mô hình vận hành tương ứng được duyệt**. Chúng không cần thiết cho việc thu phí một gói planner qua cổng thanh toán.

| Collection          | Field dự kiến và invariant                                                                                                                                                                                   | Khi nào cần                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| inventory_slots     | listingId/resourceId, startAt/endAt/timezone, capacity, heldCount, bookedCount, revision, status + metadata. Counters phải cập nhật cùng holds.                                                              | GoEase thực sự quản lý inventory slot, không phải referral |
| inventory_holds     | slotIds, userId, bookingId/orderId, quantity, status held/confirmed/released/expired, expiresAt, idempotencyKey. Expiry job release inventory idempotently; không TTL xóa mà quên release.                   | Checkout giữ chỗ; transaction nhiều slot và compensation   |
| ledger_accounts     | accountCode, ownerType/ownerId?, currency, accountType, status, createdAt; balance là projection, không nguồn duy nhất.                                                                                      | Có thu hộ/chia tiền/số dư và nghĩa vụ đối tác              |
| ledger_transactions | transactionCode, occurredAt, sourceType/sourceId, currency, entries[{accountId,debitMinor,creditMinor}], reversalOf?, idempotencyKey, createdAt. Tổng debit=credit, append-only; reversal bằng bút toán mới. | Sổ cái/đối soát thực sự; phải review tài chính riêng       |
| payout_requests     | partnerId, amountMinor/currency, settlementAccountRef, status, providerRef, ledgerTransactionId, requested/approved/paidAt, idempotencyKey. Không lưu plaintext bank details trong log.                      | Chi trả đối tác sau compliance/onboarding                  |
| subscriptions       | userId, productVersion, providerSubscriptionId, billingPeriod, status, cancelAtPeriodEnd, lastInvoiceRef, entitlementRef. Billing webhook và proration policy riêng.                                         | Bán gói tự gia hạn thay vì mua một lần                     |
| support_messages    | ticketId, authorId/type, bodyPrivate, attachmentIds, createdAt; pagination, retention riêng.                                                                                                                 | Có hội thoại hỗ trợ nhiều lượt                             |

**Inventory caveat:** index unique `{resourceId,startAt}` không chống toàn bộ khoảng giờ chồng lấp. Cần slot chuẩn không overlap hoặc giao thức serialize/lock theo resource để kiểm tra và ghi booking nguyên tử. Ghi design cụ thể trước khi mở bán chỗ. Hotel/flight external inventory phải kiểm tra provider, không bảo đảm bằng collection local.

**Financial caveat:** dictionary này không thay thiết kế kế toán, thuế, hợp đồng, settlement và legal compliance. Chốt merchant-of-record, refund, payout, invoice và reconciliation trước khi bật marketplace money movement.

## 8. Indexes, constraints và kích thước

Unique là DB index, không phải validator duy nhất; xử lý E11000. Unique partial chỉ áp dụng document khớp filter [S4,S13]. Ví dụ active slug có thể dùng partial `deletedAt:null` nhưng restore gặp trùng phải 409; email/identity keys có chính sách giữ chỗ khác, không copy cùng index generic.

Arrays nhúng chỉ cho dữ liệu hữu hạn đọc cùng nhau. Không nhúng lịch sử login, logs, mọi bookings, mọi reviews vào users/trips. MongoDB có giới hạn document 16 MiB và unbounded arrays có rủi ro vượt giới hạn/ảnh hưởng hiệu năng [S3]. GoEase nên có app payload/document budget nhỏ hơn nhiều, đo thực tế và chốt caps; đừng đợi tới 16 MiB mới từ chối.

TTL cleanup chỉ cho dữ liệu được phép hết hạn. Session/token phải kiểm tra expiry lúc truy cập, vì TTL không xóa tức thời [S5]. Không TTL audit/financial toàn cục. Index lựa chọn dựa access patterns: list trips theo owner, lookup identity, payment/event dedupe, chronological audit, search places, worker pending.

## 9. Nâng cấp baseline và migration

1. Ghi lý do/BR đổi, ảnh hưởng đọc/ghi/API và dữ liệu cũ.
2. **Expand:** thêm field optional/default an toàn và reader hiểu cũ+mới.
3. **Backfill:** script theo lô, idempotent, checkpoint, dry-run, backup và số liệu trước/sau; actor `migration:<id>`.
4. **Validate:** kiểm tra invariant/duplicates và update indexes; dùng test với dữ liệu cũ.
5. **Switch:** writer ghi schema mới; bật constraint required chỉ khi an toàn.
6. **Contract:** xóa field cũ ở release sau khi reader/client không còn dùng; không drop database.

MongoDB schemaVersion pattern cho phép tài liệu nhiều phiên bản cùng tồn tại nhưng ứng dụng phải biết cách đọc/update chúng [S2]. Không tự tạo backward compatibility chỉ bằng thêm field schemaVersion.

Ví dụ: thêm trip.transportPreferences có default đọc [] dễ hơn đổi budget từ mỗi người sang cả nhóm. Đổi ý nghĩa tiền là migration nghiệp vụ phải giữ snapshot và tránh nhân/chia sai, không chỉ rename field.

## 10. Bộ nhỏ cần có trước, không tạo 40 models ngay

F1-B chỉ dùng `audit_logs` cho audit nền; `schema_migrations` chỉ khi có migration/index change cụ thể cần ghi nhận, không dựng runner tổng quát trước consumer. F1-C thêm `users`, `auth_identities`, `auth_sessions`, `auth_challenges`, `consent_events` khi notice/consent flow thật cần. `outbox_events` chỉ thêm cùng delivery bền vững có consumer. Chưa mở signup public trước khi email verification và privacy policy ready.

CORE-1 dùng `trips`, `trip_revisions`, `idempotency_keys` và `destinations` tối thiểu vì TripDestination/TripDay tham chiếu destinationId. `places`, `ai_runs`, `usage_buckets` chỉ thêm cùng CORE-2; `analytics_events` đợi consent và event taxonomy đã triển khai. Mỗi collection thêm cùng endpoint/flow/test sử dụng nó; model đơn lẻ chưa chứng minh chức năng hoàn thành.

## Nguồn kỹ thuật và pháp lý đã đối chiếu

- [S1] Mongoose — Timestamps: https://mongoosejs.com/docs/timestamps.html
- [S2] MongoDB — Schema versioning: https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/
- [S3] MongoDB — Avoid unbounded arrays: https://www.mongodb.com/docs/v8.0/data-modeling/design-antipatterns/unbounded-arrays/
- [S4] MongoDB — Unique indexes: https://www.mongodb.com/docs/manual/core/index-unique/
- [S5] MongoDB — TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- [S6] MongoDB — Transactions: https://www.mongodb.com/docs/manual/core/transactions/
- [S8] OWASP — Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- [S9] Google — OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- [S13] MongoDB — Partial indexes: https://www.mongodb.com/docs/v8.0/core/index-partial/

Các cấu trúc, trạng thái và mức retention trong bộ tài liệu là thiết kế đề xuất của GoEase, không phải yêu cầu nguyên văn của các nguồn. Ngày đối chiếu: 22/10/2026.

## 11. Làm rõ sau review F1-A

### Cách đọc required/default

`?` là có thể vắng mặt; ghi default `null` nghĩa khi tạo sẽ lưu null và kiểu thực tế nullable. Không dùng missing/null/chuỗi rỗng thay thế nhau trong business key. `Bắt buộc` không có default là caller/service phải cung cấp, không tự đoán. `Theo policy`, `Điều kiện`, `Bounded`, `cap` chưa có số hay predicate **chưa đủ để tạo validator production**; chốt trong task consumer và Q-05/Q-09. Mỗi row ghép bằng dấu `;` áp dụng theo thứ tự field; registry giữ nguyên các row này, không suy ra JSON Schema.

Bộ MUTABLE yêu cầu các field và timestamp ở mục 2; actor ID null chỉ khi actor system/provider có type/context đáng tin. APPEND không có API update/delete thông thường; purge/redaction đặc quyền phải theo DATA-08/09 và có evidence độc lập. revision khởi tạo 0 theo bộ chung, tăng nguyên tử ở mutation; schemaVersion chỉ đổi hình dạng, không tăng ở mỗi lần save.

### Required theo discriminator/state đã rõ

| Đối tượng            | Điều kiện và dữ liệu cần kiểm tra                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth_identities      | google: issuer/providerSubject string đã verify, không có passwordHash/loginEmailNormalized; password: loginEmailNormalized/passwordHash bắt buộc, không dùng issuer/sub. unlinkedAt khác null không được xác thực. linkedAt bắt buộc; verifiedAt/lastUsedAt nullable theo lifecycle. |
| auth_sessions        | user/identity còn hợp lệ, securityVersionAtIssue khớp; now trước cả expiresAt và idleExpiresAt, revokedAt null. TTL chỉ cleanup. Thời lượng vẫn Q-06.                                                                                                                                 |
| auth_challenges      | Consume cần purpose đúng, còn hạn, chưa consume/revoke, chưa quá maxAttempts và binding đúng. Ma trận userId/context theo từng purpose chưa đầy đủ: R-05.                                                                                                                             |
| trips                | Các field Bắt buộc ở dictionary vẫn bắt buộc cho saved draft; draft không phải quyền bỏ hết input. planned/completed cần tiêu chí transition ở Q-09; completedAt có khi completed. Thiếu ngày/activity caps không được suy diễn là vô hạn.                                            |
| trip_revisions       | snapshot/actor/requestId/operationId bắt buộc; previousRevision null cho bản đầu; restoredFromRevision có khi phục hồi revision. Snapshot không được phục hồi owner/quyền/token hoặc link đã revoke.                                                                                  |
| content/service      | published chỉ hiển thị khi đủ field loại nội dung và chưa xóa; confirmed booking cần evidence, confirmedAt và điều kiện payment/provider. Ma trận cụ thể từng loại chưa đủ: R-06.                                                                                                     |
| payment/refund/order | Chỉ chuyển trạng thái từ evidence server/provider đã verify. Các timestamp/ID required theo từng transition, trường hợp unknown và đến muộn cần adapter/policy; chưa đủ để triển khai commerce: R-06.                                                                                 |
| outbox_events        | expiresAt chỉ có sau delivered; pending/processing/dead_letter không có TTL cleanup. processing cần lease claim nguyên tử; việc hồi phục phải có consumer cụ thể.                                                                                                                     |

### Unique/null/soft-delete và truy vấn

Các index sau là thiết kế, chưa được tạo hay benchmark:

- users.emailNormalized: partial chỉ string; không lọc deletedAt. Khóa được giữ khi xóa mềm, tái sử dụng sau purge theo Q-07. Lookup login/collision và restore phải xử lý E11000; không merge account qua email.
- auth_identities: unique google theo provider/issuer/sub và password theo provider/loginEmailNormalized, chỉ khi unlinkedAt null và khóa tương ứng là string; unique userId/provider đang linked. Tránh index chung khiến nhiều Google identity null email xung đột.
- Active slug ở destinations/posts/partners/service_listings: unique slug cho deletedAt null; restore gặp trùng trả conflict, không tự đổi quyền/chiếm slug. places.slug chưa có uniqueness policy, không tự thêm index.
- External keys ở places/service_listings/bookings/payments/refunds: partial chỉ khi toàn bộ key tùy chọn có string hợp lệ, không dùng sparse để ngầm định null được bỏ qua. Giữ dedupe external key ngoài soft-delete trừ policy riêng; scope merchant/environment đã ghi cho payment/refund.
- trip_access/partner_memberships/favorites: unique quan hệ qua mọi status; tái kích hoạt cùng record, lịch sử chi tiết ở audit. reviews một review active/target là đề xuất baseline cần moderation policy trước PLATFORM.
- trips list theo owner/deletedAt/updatedAt/_id; trip_revisions unique tripId/revision cho lịch sử và restore; audit theo entity/time, actor/time, requestId và operation dedupe. Có query consumer mới tạo index; optional geo/search index chỉ khi có query thật.
- Unique audit operation/action/entity không thay eventId: APPEND có eventId unique; auth.failed không có entityId cần operationId riêng từng attempt. Consumer phải dùng cùng operationId khi callback transaction retry.

### Taxonomy audit tối thiểu để triển khai từng slice

F1-B chỉ cần `system.audit_probe` (category `system`) trong DB test riêng, actor system, outcome succeeded/failed; action này không phải sự kiện production đã có. F1-C bổ sung auth.failed/session.created/session.revoked/identity.linked với category auth; CORE-1 thêm trip.created/trip.updated/trip.deleted/trip.restored/trip.visibility_changed với category trip khi endpoint có thật. role.granted/payment.verified chỉ khi module tương ứng triển khai. reasonCode và changedFields phải allowlist theo action; không nhận tên collection/query/path tùy ý từ client. Danh sách này là taxonomy thiết kế, chưa là executable enum.

### Quan hệ và những phụ thuộc chưa bật

Trip embeds days/activities vì đọc/lưu cùng nhau và phải bounded; lịch sử, sessions, audit tách collection vì tăng độc lập. OrderLine nhúng chỉ ở commerce với cap riêng. ObjectId không tự đảm bảo target tồn tại/quyền. `users.avatarAssetId`, trip cover và booking links phải không được ghi trước khi module đích tồn tại; không tạo collection rỗng để thỏa sơ đồ. CORE-1 cần destination tối thiểu; chưa cần places hay AI. Extension mục 7 không nằm trong 40 collection registry và chưa được bật.

### Khoảng trống còn mở

R-04–R-09 trong [F1-HANDOFF](F1-HANDOFF.md) ghi tác động và đề xuất cho email collision, challenge binding, state/provider fields, purge dẫn xuất, caps/retention và phụ thuộc catalog. Các mục đó là gate trước consumer tương ứng, không phải lỗi đã được giải quyết bằng tài liệu.

## 12. Audit subset F1-B đã triển khai

Model/service server chỉ dùng audit_logs; target rộng ở mục 5 vẫn là baseline cho các phase sau. Không tạo model/collection ở app startup. Gate service: không production, connection loopback 127.0.0.1:27021 và DB name `goease_f1b_test_<32 lowercase hex>`. Harness còn kiểm tra URI/set name/run ID/dbpath trước init; không hỗ trợ remote/app database.

Subset hiện tại: action system.audit_probe/category system/entityType system_probe; entityId string ObjectId lowercase 24 hex; entityRevision optional safe integer >=0; actor cố định system + serviceName goease-integration-test. Source server/integration_test/test, appVersion 0.0.0 từ code. Outcome succeeded/failed, reasonCode optional probe_completed/probe_failed khớp outcome. changedFields/changes mặc định [], tối đa 1 phần tử path probeState, before optional và after required chỉ pending/verified, redacted=false. Không có arbitrary Mixed/securityContext/free text/user actor trong subset này. Thời gian server; APPEND eventId UUIDv4/schemaVersion 1/createdAt, không updatedAt/deletedAt/__v, nested versionKey cũng tắt. retentionClass integration_test, retentionUntil null, legalHold false; không phê duyệt retention production.

Service trả eventId/deduplicated và có read theo operation/entity; không update/delete. initialize tạo collection/index explicit trong DB test, ngoài transaction; autoIndex/autoCreate tắt, không syncIndexes. Index thực gồm unique eventId, unique operationId/action/entityType/entityId và ba index tra cứu theo baseline; không TTL. Index actor.userId giữ baseline, subset chưa phát sinh user actor.

Dedupe so canonical JSON với thứ tự field cố định: action/category/entityType/entityId/entityRevision (missing thành null), outcome/reasonCode (missing thành null), changedFields và changes path/before/after/redacted. Actor/source/retentionClass phải khớp constants backend. Không so eventId/createdAt/occurredAt/recordedAt/requestId/correlationId/appVersion của từng attempt; bản đầu được giữ. Cùng key khác nội dung ném AuditConflictError, không update. E11000 chỉ được xử lý như dedupe nếu keyPattern đúng cả bốn field; lỗi index khác propagate. Trong transaction bị race, ném AuditTransactionRaceError để caller abort rồi retry toàn transaction, không query/ghi bù ngoài session.

## Runtime subset — task sản phẩm sau F1-B

Mongoose strict nested schemas + Zod API allowlist triển khai đúng tên field hiện cần. Các field tương lai trong dictionary không được tạo chỉ để lấp schema. Trip preferences dùng `transportModes` theo mục trips (khác `preferredTransport` của user preferences chưa triển khai). Không nhận owner, role, timestamps, source snapshot hoặc tổng tiền từ client. Day/activity UUID ổn định; arrays bị chặn 31 ngày, 50 hoạt động/ngày, 300 hoạt động/chuyến; body trip tối đa 256 KiB. Một trip và nội dung ngày/hoạt động được đọc cùng nhau; lịch sử vô hạn theo thời gian nằm ở collection APPEND riêng.

Trip + revision + mandatory audit + idempotency key ghi trong một transaction. Index bổ sung bằng createIndexes, không syncIndexes/drop index hiện có. `trip_revisions` và `audit_logs` không có mutable timestamps hay TTL; chưa bật restore/history HTTP API hoặc purge job. Idempotency scope actor/operation/key, requestHash và resourceId; lưu completed trong transaction, TTL 24 giờ là dọn tạm, không phải bằng chứng lịch sử.

Auth identity tách password PHC và Google issuer/sub khỏi user. Session/challenge lưu token hash, không raw token. OAuth challenge context chỉ có identityId/nonceHash/bindingHash/encryptedPkceVerifier (AES-GCM), không raw provider response. TTL chỉ ở session/challenge/key, kiểm tra expiry bằng query trước khi dùng. Danh mục seed có source goease_curated và rights của nội dung tự biên soạn; không chứa dữ liệu provider.

Các field runtime cụ thể xem `server/src/features/auth/auth.models.ts`, `server/src/features/trips/trip.models.ts`; registry giữ baseline mục tiêu và đánh dấu subset triển khai, không tuyên bố mọi field trong mỗi collection đã có.

### Runtime Hội An / ngân sách (22/10/2026)

- `trips.days[].activities[].placeId?`: ObjectId catalog, optional để đọc chuyến cũ. Cùng field có trong `trip_revisions.snapshot`. Title/notes/estimatedCost vẫn thuộc itinerary, không bị đồng bộ đè từ catalog. Server xác minh các liên kết mới; giữ liên kết cũ khi catalog archived/deleted, không cấp quyền xem lại nội dung đã ẩn.
- `estimatedCost.basis`: runtime mở rộng `group_total|per_person`, quantity1/currencyVND/confidenceuser_entered giữ nguyên. Server tính amount×travelers cho per_person, tính trực tiếp group_total; kiểm tra safe integer trước commit. Chưa triển khai per_unit, giá provider hoặc expense. Các phiên bản ứng dụng cũ chỉ hiểu group_total không được dùng để ghi lại chuyến per_person.
- `summaryTotals` vẫn lưu3field cũ, do cùng hàm server tính. `budgetSummary` chỉ là DTO được tính khi đọc/lưu hoặc preview: knownEstimatedMinor, missingCostCount, activityCount, perPersonMinor, budgetMinor, remainingMinor, usedPercent, categories[{key,amountMinor,missingCostCount}], currencyVND. Không nhận summary từ client và không thêm collection/cache.
- `places.planning?`: optional subdocument gồm durationMinutes(1–1440, biên tập), locationQuery(string≤200, tìm bản đồ, không phải tọa độ), costNote(string≤500), priceOptions(tối đa5; label≤120, amountMinor0–1e12, basisgroup_total/per_person, sourceUrl≤2048, checkedAtdate-only). Có schema Mongoose strict; dữ liệu do seed quản lý, chưa có public write endpoint. Seed chỉ bổ sung planning khi chưa có và insert ID mới; không ghi đè nội dung/giá/status đã chỉnh.
- Không thêm index hoặc đổi collection. Query catalog theo destinationId sử dụng index có sẵn. Không chạy migration phá dữ liệu hoặc thay MongoDB replica set. Schema nền đầy đủ và các trường provider/geo còn là kế hoạch.

## Gemini runtime subset — 2026-10-23

`ai_runs` and `usage_buckets` now have local runtime consumers; their exact implemented fields, bounds, indexes and state transitions are documented in [AI-PLANNER.md](AI-PLANNER.md#runtime-storage-authoritative-implemented-subset). Earlier generic baseline fields remain design targets and are not claims about runtime. Trips/revisions support optional aiRunId and ai/manual origins; ownership and successful proposal provenance are checked in the save transaction. Old manual documents remain compatible. No TTL/retention policy or provider token/cost accounting is implemented.

### Goe run proposal extension (2026-10-23)

Existing ai_runs bounded validated proposal may additionally include before (one original day), dayId UUID and baseRevision integer for promptVersion goe-v1. These server-created fields support before/after preview; apply resolves run owner/target/revision and uses existing trip transaction. Same indexes and collections; no raw chat message collection or migration. Exact runtime contract: AI-PLANNER.md.

## Runtime trip management — 2026-10-23

trips.clonedFromTripId: ObjectId?, default null, server-only source reference; expenseRevision còn dùng serialize duplicate nguồn. trip_revisions.action thêm deleted (snapshot cuối, revision tăng); bản sao tạo revision0/action created và ID mới. audit_logs.action thêm trip.deleted/trip.duplicated, entityType trip, không payload tên/notes. idempotency_keys.operation thêm trip.delete/trip.duplicate, resourceType trip; TTL24h hiện có. phase date-derived chỉ filter/hiển thị, không thêm enum/status hay cron. Không thêm collection/index hoặc raw DB validator. API/validation: TRIP-MANAGEMENT.md.

## Customer account — 2026-10-23

users.displayName/avatarUrl/revision sử dụng PATCH profile, audit profile.updated; profile identical-state retry không tăng revision. auth_identities.passwordChangedAt/lastUsedAt được dùng khi đổi mật khẩu/login. auth_sessions.passwordChangeKey string UUID nullable, giữ receipt lần đổi gần nhất tới khi hết session; revocationReason enum thêm password_changed. users.securityVersion tăng, current session.securityVersionAtIssue được cập nhật, others revoked. audit_logs thêm profile.updated/password.changed, không secrets/PII payload. Không thêm collection/index. Xem ACCOUNT-PROFILE.md.

## Password recovery runtime extension — 2026-10-23

AUTH-03/04/07/08: users.recoverySequence (Number default0, internal) serializes issuance with reset/change-password; does not alter profile revision. auth_sessions.revocationReason supports password_reset; every active session revoked on successful reset. Existing indexes reused, no new collection/index/migration.

`auth_challenges` adds reset_password to runtime purpose. For that purpose userId is required; context requires identityId (ObjectId), securityVersionAtIssue (positive integer), deliveryState (pending/sent/failed). Save validates binding. tokenHash is server random256-bit token SHA-256 with select:false; no target email/raw token retained for reset. expiresAt server time + configured300–3600seconds(default900), consumedAt/revokedAt null, attemptCount0/maxAttempts1. Existing unique tokenHash, user/purpose/createdAt and expiresAt TTL reused. Runtime reads check purpose/expiry/consume/revoke/delivery/identity/active user/securityVersion independently of TTL. Context nonce/PKCE/binding remains OAuth-only. Other proposed purposes remain unimplemented.

Issuance uses cooldown60seconds and atomically revokes previous unused reset challenges. Delivery failure revokes the new challenge. Consume, identity password update, user securityVersion increment, all-session revocation, sibling-token revocation and password.reset audit commit together. SMTP executes outside retryable transactions; no durable queue/token persistence. See PASSWORD-RECOVERY.md.

## Runtime trip trash — 2026-10-23

TRIP-09/10/12/13: trips dùng lại deletedAt/deletedBy/deletionReasonCode, restore clear cả3field và tăng revision; không thay content/expenseRevision/firstSavedAt. trip_revisions.action bổ sung restored, previousRevision=revision tombstone, snapshot cùng nội dung. audit_logs.action bổ sung trip.restored; idempotency_keys.operation trip.restore, responseStatus200, TTL24h. Share revokedAt chỉ set khi null, không clear; trip_expenses không bị ghi. Không collection/index/migration mới, không raw DB validator mới. API/query/DTO: TRIP-MANAGEMENT.md. Restore thùng rác khác restore revision lịch sử (chưa triển khai).

## Offline reader — 2026-10-23

Không thay MongoDB schema/collection/index. Snapshot riêng chỉ ở localStorage browser, contract version1/owner epoch/bounded10trips và2triệu ký tự; không auth token/expense. Logout xóa local data ngay, marker phi cá nhân chờ thu hồi server. Trip DTO/API có sẵn giữ nguyên. Xem OFFLINE-ITINERARY.md; registry browserStorage chỉ mô tả, không executable schema.

## Mobile usability storage/contract impact — 2026-10-23

AUTH-09 redirect intent stays in the login/register URL (allowlisted `/trips/new`, optional catalog destination ID); no draft, token or new field is stored. Budget completeness/preparation UI is derived from existing activities and the server BudgetSummary DTO; no completion/booking flag is added. Existing ai_runs.promptVersion strings now use hoian-v2/goe-v2; apply still accepts owned successful goe-v1 proposals for compatibility. Error envelope is unchanged, with AI_PACE_LIMIT, AI_SCHEDULE_CONFLICT, AI_RUN_PENDING and AI_RUN_FAILED codes. No MongoDB schema/index/collection/migration or localStorage contract changes. Registry mobileUsability mirrors these qualifications.

## Plan-first creation contract — 2026-10-23

No persisted schema, index, migration or request/response shape changes. `TripInput`/`PlannerRequest` still require ISO startDate/endDate and matching days. During the unsaved relative-day preview the client anchors dates to its initial local date solely to use the existing planner contract; this is not the user's selected departure. `ai_runs` may contain that validated preview as before. Before POST trips, explicit departure input invokes the existing `shiftTripDays`, preserving day/activity IDs, notes/costs and AI provenance while moving all dates. `datesConfirmed`, generation loading, save sheet and one-day undo snapshot are React memory only, not new localStorage or database fields. A quick place replacement uses the existing manual activity contract and unknown cost. Server owner/provenance/date validation and idempotent save remain unchanged. Registry `planFirstCreation` mirrors this scope; persistent undated trips are not implemented.

## Admin catalog and automatic reference costs — 2026-10-23

CAT-08/09, AUTH-08, TRIP-07/08, AI-03, DATA-02/03. Additive runtime subset, no destructive migration or new collection; legacy costs and places remain readable. Contracts and API details: [ADMIN-CATALOG.md](ADMIN-CATALOG.md).

- `users.roles`: runtime enum now traveler/admin; register still traveler only. `UserDto.isAdmin` is a UI hint derived from DB, not authorization. Local operator grant/revoke updates selected user's securityVersion and records audit in a transaction. API checks active role on every admin request and again inside writes.
- `places`: optional venueType=place/restaurant/food_idea, openingHoursNote(max400), referencePrice(nullable). Reference shape: label(max120), amountMinor integer0..1e12 VND, basis per_person/group_total, maxTravelers integer1..1000, conditions(max500), HTTPS sourceUrl(max2048,no credentials), checkedAt/reviewAfter valid ISO dates with reviewAfter>=checkedAt. No range/availability quote. Admin service validates current/future dates; expired published prices cannot be newly submitted. Runtime place revision increments on every admin save; actor metadata updated. Map coordinates cleared when locationQuery changes. Destination cannot change after record creation. Strict nested schemas/internal version keys align with transactional rollback; existing unused __v need not be deleted.
- `trips.days.activities.estimatedCost` and the same `trip_revisions` snapshot: confidence now user_entered/catalog_reference; optional reference contains full referencePrice plus placeRevision. Catalog confidence requires reference and exact amount/basis agreement; manual confidence cannot carry a reference. Server authenticates origin against current published reference or same activity/place in saved owner trip/successful owner AI proposal. Snapshot preserved across admin edits, archive, date shifts and read; group-size limits affect known/missing totals. Manual override removes reference.
- `ai_runs.proposal`: validated trip may contain catalog reference snapshots attached by server; provider still does not generate price. Retained successful proposal validates the initial snapshot even if catalog changes before saving. New place links still require published status at save.
- `idempotency_keys.resourceType`: add place, operations catalog.create/catalog.update; existing actor+operation+key unique index and TTL24h reused. Receipt reauthorization required; unrelated index failure is not treated as a key race.
- `audit_logs`: actions catalog.created/catalog.updated/catalog.publication_changed, category catalog, entityType place, changedFields catalogDetails. Actor type user with session-derived userId after admin authorization. Local role actions admin.granted/admin.revoked use system serviceName admin-bootstrap, entity user, security_audit retention class. No catalog body/price values in audit; no full revision restore.

DB indexes remain unchanged. Registry is descriptive, not executable. Existing legacy `planning.priceOptions` remain separate manual choices and are not automatically selected; admin's explicit `referencePrice` drives automatic estimates. No provider price ingestion, structured business hours, precision coordinates editor, CMS media upload or commerce schema is introduced.

Admin desktop routing clarification: existing `users.roles` and `UserDto.isAdmin` drive the dedicated UI. No collection, schema, API contract or migration change. See BR CAT-08/AUTH-08.

## Runtime Geoapify import — 2026-10-23

CAT-10 cùng CAT-01/02/03/05/08: optional `places.source` strict subdocument `{provider:'geoapify',externalId:string(max512),fetchedAt:Date,attribution:'Powered by Geoapify · © OpenStreetMap contributors',license:'ODbL-1.0'}`. externalId canonical `osm:node|way|relation:<numeric id>`, server-derived, not editable via admin contract. Index **implemented** unique partial `{source.provider:1,source.externalId:1}` for provider=geoapify and externalId BSON string; includes archived/deleted records to prevent import revival. Existing curated sourceUrl records stay valid without source. No general SourceRef rights/validUntil or other provider support added. Fixed rights mapping is documented in GEOAPIFY-IMPORT.md; license does not waive ODbL conditions.

Imported place uses existing fields: draft, revision 1, server actor; referencePrice=null, no priceOptions; planning.durationMinutes=60 is labeled initial editorial estimate; address in locationQuery, opening_hours in note, mapLocation area with OSM permalink/source fetch date (not verified entrance/date). Source ID remains stable when name/coordinates change. No raw response/contact/review/photo/geospatial index. Published edit/archive/trip snapshot behavior unchanged.

`idempotency_keys.resourceType` adds place_import; optional resultIds (array<=50, each 24 hex ObjectId string, no default array on old records). operation=catalog.import, resourceId=UUIDbatch, existing 24 hTTL. Receipt and every place/audit committed in one transaction; replay reauthorizes and returns created IDs without needing live preview. `audit_logs.action` adds catalog.imported with entityType place/category catalog; no source payload or credential in audit. No new collection, data migration, syncIndexes, refresh or purge job. Additive unique source index created by existing initialize/createIndexes path; local index observed. Runtime schema/registry/contracts and flow are detailed in [GEOAPIFY-IMPORT](GEOAPIFY-IMPORT.md).

### Hội An complete-day planner storage impact — 2026-10-23

AI-01/02/03 and TRIP-08: new ai_runs promptVersion=hoian-v3 and plannerVersion=2; goe-v2 remains supported for selected-day edits. No new fields, indexes, collections or migration. Existing null budget/cost contracts remain authoritative. Activity notes now snapshot catalog address/hours (bounded to 500 characters). Provider receives public editorial context and reference costs; no raw response or private notes stored. Structured opening-hours schema and generalized import normalization remain planned. Registry hoianCompleteDays records this implemented subset.

The final implementation uses AI-ranked candidates plus server scheduling before validation: meals and visits are filled from the published catalog, recognized hours/durations are enforced, and optional extra visits stay within the AI-selected set. When editing one existing day, its current stop count (maximum 6) is allowed even if above the old pace default, to avoid dropping stops solely due to the old cap. This does not introduce new persisted fields. Future structured venue meal suitability and route matrices remain planned.

### Date rescheduling runtime (2026-10-23)

AI-02/TRIP-08: ai_runs.provider runtime enum now permits gemini and catalog. Deterministic date checks for AI trips create succeeded catalog runs (date-reschedule-v1/plannerVersion 3), quotaState=released and bounded proposal/sources; no usage_buckets mutation. New run binds authenticated user and, for saved trips, tripId/expectedRevision. Manual trip checks create no run. Trip schemas and stable activity/expense IDs unchanged. Successful date-check proposals remain private until the normal save operation; no automatic trip migration. This is runtime Mongoose validation, not a new database JSON validator. See AI-PLANNER.md for contract and limitations.

## Runtime catalog automation — 2026-10-23

CAT-11–13: additive local implementation. The original40collection design remains; these3runtime collections have concrete consumers (43registry entries total). No destructive migration or reconfiguration of MongoDB. Registry mirrors this dictionary, not an executable schema.

`places.sourceSnapshot` and `sourceCheckedAt` are optional/null, independent of editorial content/revision. SourceSnapshot is strict: name(max120), address(max200), latitude[-90,90], longitude[-180,180], category food/culture/nature, venueType place/restaurant, categories<=100 strings(max160), openingHoursNote(max400), closed boolean|null, sourceUrl(max2048). Categories sorted before hashing. Existing imported records without snapshot receive a first-observation review. Fetch dates never imply human verification. Ordinary admin writes preserve observation fields. No raw response/contact/photo/review.

### `catalog_schedules` — implemented

Singleton lịch và quota Geoapify Hội An, consumer worker và admin.

| Field                                   | Type                               | Default / required     | Rule                                                                                                 |
| --------------------------------------- | ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| scope                                   | enum                               | hoi-an, unique         | Chỉ một cấu hình Hội An.                                                                             |
| revision; enabled                       | number; boolean                    | 0; false               | CAS cấu hình; quota/nextRun không tăng revision cấu hình.                                            |
| frequency; hour; minute; weekday; group | enum; number; number; number; enum | weekly; 8; 0; 1; mixed | daily/weekly; hour0..23; minute0..59; weekday0..6; group mixed/sights/restaurant/cafe. Giờ Việt Nam. |
| nextRunAt                               | Date / null                        | null                   | UTC; tạo tối đa một lượt quá hạn rồi tính kỳ tương lai.                                              |
| quotaHour; searches                     | number; number                     | 0; 0                   | UTC epoch-hour; <=20 lượt/giờ, kể cả lỗi.                                                            |
| actorSearches                           | {actor:string,count:number}[]      | []                     | Tối đa20actor/giờ; actor userId hoặc catalog-worker; <=10 lượt/actor. Reset đầu giờ.                 |
| slots                                   | {token:UUID,until:Date}[]          | []                     | Tối đa2slot120s dùng chung preview/worker, hết hạn tự thu hồi khi nhận slot.                         |
| createdAt; updatedAt                    | Date; Date                         | timestamps             | Mongoose strict schema; không secret.                                                                |

Indexes: Unique {scope:1}.

Cấu hình admin có revision/audit/receipt; quota transaction dùng chung mọi process; mặc định tắt. Retention: Chưa purge tự động; counters và slots bounded, tự thay thế khi hết cửa sổ.

### `catalog_runs` — implemented

Lượt cập nhật bền vững, atomic claim/fencing, retry và lịch sử.

| Field                   | Type                                             | Default / required   | Rule                                                                                                                          |
| ----------------------- | ------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| operationId             | UUID                                             | server randomUUID    | Stable across attempts; joins run and place audits.                                                                           |
| scope; active; state    | enum; boolean; enum                              | hoi-an; true; queued | state queued/running/retry/succeeded/failed; active false khi kết thúc.                                                       |
| actorId; group          | ObjectId / null; enum                            | null; required       | actorId user cho chạy ngay, null theo lịch. group mixed/sights/restaurant/cafe là snapshot cấu hình.                          |
| attempts; nextAttemptAt | number; Date                                     | 0; now               | Tối đa3lần xử lý; quá3 lần do crash chuyển failed, không gọi nguồn.                                                           |
| leaseToken; leaseUntil  | UUID / null; Date / null                         | null; null           | Claim120s, heartbeat20s. Transaction ghi domain phải cập nhật cùng run với token chưa hết hạn.                                |
| finishedAt; message     | Date / null; string(max400)                      | null; empty          | Thông báo allowlist tiếng Việt, không raw error/provider key.                                                                 |
| counts                  | {created,unchanged,review,skipped,errors:number} | all zero             | Thống kê committed; review có thể gồm địa điểm mới nghi trùng. Failed atomic run ghi errors=1, không giả số địa điểm đã nhập. |
| createdAt; updatedAt    | Date; Date                                       | timestamps           | Không raw response; không mảng history vô hạn.                                                                                |

Indexes: Unique partial {scope:1,active:1} where active=true; {active:1,nextAttemptAt:1,leaseUntil:1}; {createdAt:-1}.

Một active Hội An; source fetch ngoài transaction, tất cả place/review/result/audit commit nguyên tử với fence; pause không hủy lượt đã nhận. Retention: Chưa TTL/purge; API30lượt gần nhất, audit phân trang.

### `catalog_reviews` — implemented

Một vấn đề/địa điểm; giữ signature quyết định để không nhắc lặp.

| Field                    | Type                          | Default / required | Rule                                                                                                           |
| ------------------------ | ----------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| placeId; kind; signature | ObjectId; enum; SHA256 string | required           | kind draft/duplicate/source/price; signature revision draft, normalized snapshot source/duplicate, price hash. |
| revision; state          | number; enum                  | 1; open            | state open/resolved/snoozed; CAS quyết định, đồng thời kiểm place revision.                                    |
| decision; revisitAt      | enum / null; Date / null      | null; null         | keep/apply/ignore/later/distinct; later sau now, tối đa90ngày.                                                 |
| incoming; previous       | SourceSnapshot / null         | null; null         | Strict allowlist như places.sourceSnapshot; baseline chưa giải quyết được giữ qua nhiều lần sync.              |
| fetchedAt; duplicates    | Date / null; string[]         | null; []           | Ngày lấy nguồn khác xác minh; tối đa20tên nghi trùng.                                                          |
| createdAt; updatedAt     | Date; Date                    | timestamps         | Không payload ngoài allowlist.                                                                                 |

Indexes: Unique {placeId:1,kind:1}; {state:1,revisitAt:1,updatedAt:-1}.

Signature không đổi giữ quyết định; source mới mở lại; snooze đến hạn mở lại. CAT-15: ignore giữ publicationStatus; apply dấu đóng cửa rõ ràng có thể archive. Retention: Không tự xóa receipt quyết định; một bản/loại/địa điểm, audit sự kiện riêng.

`idempotency_keys`: resourceType adds catalog_operation; optional catalogResults array<=50 of strict {id:string,name:string<=120,eligible:boolean,reason:string<=400,applied?:boolean}. No Mixed/JSON payload store. Existing actor/operation/key unique index and24h TTL reused. Schedule/run/review receipts retain resourceId; batch retains exact per-item success/failure. Same-key replay reauthorizes and different payload conflicts.

`audit_logs`: new catalog.source_changed, catalog.review_keep/apply/ignore/later/distinct, catalog.schedule_saved, catalog.run_requested/succeeded/failed; entityType place/catalog_schedule/catalog_run. System actor serviceName catalog-worker, platform server; authenticated decisions/config use user. run_failed outcome failed. Metadata only, existing audit unique dedupe retained; new history index {category:1,occurredAt:-1,_id:-1}. No full source payload in audit.

Worker uses atomic run claim + periodic lease renewal; each domain transaction also writes run with matching token and unexpired lease. This prevents stale worker side effects through MongoDB transaction write conflicts. Run counts and catalog/reviews/audit commit together; failures before commit produce no partial catalog effects. Provider calls never inside retriable transaction. Reviews and drafts never automatically demote published records. APIs/contracts and operational limits are in ADMIN-CATALOG.md and GEOAPIFY-IMPORT.md.

Concurrency clarification: every review decision also advances the place revision in the same transaction, including keep/later/distinct. This fences simultaneous editorial edits; draft review signatures advance with that decision so keeping or deferring a draft does not reopen itself. Source polling alone still does not advance editorial revision.

### FULLDICHVU runtime (2026-10-24)

ai_runs.provider runtime Mongoose enum: gemini | fulldichvu | catalog. Generation records configured provider and corresponding model; rescheduling remains catalog. No other field/index or data migration changes. API contracts and usage bucket counting remain unchanged. See AI-PLANNER.md FULLDICHVU provider for server env and verification limitations.

2026-10-24 planner metadata: FULLDICHVU new-trip promptVersion=hoian-rank-v1; successful proposals retain the existing TripInput schema after server arrangement/validation. AI_OUTPUT_TRUNCATED is a sanitized errorCode on failed/consumed runs. No new collection/index or migration. Ranking IDs never replace the persisted final trip contract.

### Runtime price readiness and bundle — 2026-10-24

CAT-14: referencePrice thêm `inclusions`/`exclusions` (optional để đọc dữ liệu cũ, trim 1..500 ký tự nếu có; bắt buộc cho xuất bản/Goe). Optional `bundle` strict subdocument `{code: lowercase alphanumeric/hyphen 3..80, validDays: integer1..31, maxEntries: integer1..300}`; không `_id`/`__v`. Cùng fields trong estimatedCost.reference/trip revisions/AI proposals qua priceSnapshotSchema. Không collection/index/migration mới, không backfill dữ liệu thật. Existing records thiếu fields vẫn đọc được nhưng không đủ điều kiện xuất bản mới/Goe.

BudgetSummary thêm optional `includedActivityIds: string[]`, server tính lại từ snapshot theo ngày, không nhận từ client làm căn cứ; đánh dấu các lượt đã tính trong vé trước đó. Giá mỗi người vẫn là tổng nhóm / totalCount, làm tròn VND. Conflicting bundle definitions fail 409 BUNDLE_PRICE_CONFLICT. Historical snapshots không tự cập nhật khi admin đổi giá.

Runtime CAT-14: `referencePrice.minTravelers?: integer 1..1000`, phải <= maxTravelers; thiếu được hiểu là 1, không backfill. Lưu cùng field trong Mongoose referencePrice và các snapshot. Admin nhập giới hạn tối thiểu; planner và budget kiểm tra cả min/max. Không thêm collection/index.

## Runtime Admin Operations V2 — 2026-10-24 (CAT-15)

**Lịch sử V2:** metadata/version/publication và giới hạn tổng hợp bên dưới được thay bởi Runtime Admin V3 ở cuối tài liệu; không hiểu mô tả V2 là hành vi hiện tại.

Ba collection mới thực thi qua Mongoose/initialize, registry vẫn chỉ tài liệu. Không destructive migration/backfill/drop/syncIndexes.

| Collection        | Fields thực thi                                                                                                                                                                                                     | Index / vòng đời                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| catalog_versions  | placeId ObjectId, revision number, snapshot Mixed (bản ghi place do server đọc), recordedAt Date                                                                                                                    | unique placeId+revision desc; append/upsert cùng transaction, baseline trước mutation đầu tiên; chưa TTL, API metadata30 bản gần nhất |
| catalog_decisions | operationId UUID, reviewId/placeId/actorId ObjectId, decision keep/apply/ignore/later/distinct/reject/revise, note<=500, placeRevision, published boolean, occurredAt                                               | unique operationId; placeId+occurredAt desc; append, không purge                                                                      |
| catalog_settings  | scope=global, revision=0, defaultDestinationId nullable, freshnessDays7..365(default90), showQualityAlerts=true, autoApplyDraftHours=false, regions<=100 gồm destinationId/lat/lon/radiusMeters/enabled; timestamps | unique scope; CAS expectedRevision, transaction+audit; defaults không bật auto-apply                                                  |

places thêm internalNote<=1000 (không public), images<=8 {url HTTPS, credit, license owned/permission/CC0/CC-BY-4.0/CC-BY-SA-4.0, sourceUrl HTTPS}; ảnh đầu projection imageUrl/imageCredit. mapLocation giữ schema hiện có và được ghi qua editor. Giữ sourceSnapshot riêng khỏi nội dung biên tập. Restore chỉ writable editorial fields, luôn draft; không sửa snapshot nguồn/trip history.

catalog_reviews thêm kind quality, decision reject/revise, decisionNote/decidedBy/decidedAt. Signature chất lượng giữ issue ổn định; task nguồn/trùng ưu tiên trước task draft/quality. catalog_runs.counts thêm updated (0 cho dữ liệu cũ); catalog_runs/catalog_schedules.scope string max24 (hoi-an legacy hoặc destination ObjectId), một active mỗi scope. Quota lock vẫn global. Audit action thêm catalog.settings_saved/catalog.review_reject/catalog.review_revise/catalog.restored; không chứa snapshot/secret. Place filters/count/pagination dùng indexes hiện có; substring normalized search không có text/geo index mới. Dashboard giới hạn tổng hợp5000 record, map500 và hiển thị giới hạn, không tự nhận tổng toàn hệ thống khi bị cắt.

## Avatar upload runtime — 24/10/2026

AUTH-09/CAT-06: users.avatarUrl giữ URL HTTPS CDN từ upload hoặc URL legacy; không đổi type/default/index và không thêm collection. GET profile thêm projection createdAt/updatedAt đã có; không cho client sửa. Binary bản cắt chỉ trong request/memory, không MongoDB, audit, log hoặc registry. Cloud asset UUID ở goease/avatars, chưa tham chiếu avatarAssetId/media_assets. Giới hạn, lỗi, retry và asset chưa dùng: ACCOUNT-PROFILE.md. Ghi nhận chưa có upload phía trên là lịch sử trước runtime này.

## Runtime Admin V3 — 2026-10-24 (CAT-17 / V3-BR-01…12)

Một document places vẫn là một POI. Thêm publicationModelVersion=2; publicRevision/proposalRevision nullable; fieldLocks và fieldProvenance giới hạn tập trường editor. Provenance strict: field, origin manual/geoapify/legacy, sourceUrl, receivedAt, verifiedAt, validUntil, actorId, state unknown/observed/edited/verified. Legacy không tự thành verified. Public revision ổn định khi save đề xuất; editorial revision tăng để chặn xung đột. Goe/giá mới đọc public; trips/trip_revisions giữ snapshot cũ.

catalog_versions giữ unique placeId+revision, snapshot server-owned như hiện có; state historical/proposal/published, basePublicRevision, actorId, reason legacy/save/publish/restore/source/backfill, restoredFromRevision, ruleRevision, runId, recordedAt. Snapshot không nhận raw client/provider tùy ý. Proposal/public tách bằng revision pointers; không mảng lịch sử tăng vô hạn trong places. Migration manifest metadata-only, guard hash/revision/source và rollback tại ADMIN-OPERATIONS-V3.md; chưa chạy trên database goease.

| Collection           | Fields / giới hạn                                                                                                                                                                                            | Index / vòng đời                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| catalog_campaigns    | actorId/requestKey/requestHash, source=geoapify, policySnapshot immutable, state active/paused; tối đa20 task theo destination khi tạo                                                                       | unique actorId+requestKey; tasks trong catalog_runs, không mảng vô hạn                   |
| catalog_policies     | name<=100, version, autoApplyDraftHours, createdBy/requestKey/requestHash; autoPublish luôn false ở snapshot/API                                                                                             | unique version và createdBy+requestKey; tạo phiên bản mới, không mutate policy đang dùng |
| catalog_bulk_jobs    | actorId/requestKey/requestHash, action publish/archive/archive_destination, state preparing/preview/running/completed/partial, selection filter hoặc page<=50, destinationId/name/revision, snapshotAt,total | unique actorId+requestKey; destinationId+action+state; ID toàn tập nằm trong items       |
| catalog_bulk_items   | jobId/placeId/expectedRevision/name, state pending/succeeded/blocked/failed, eligible,reason<=500,operationKey                                                                                               | unique jobId+placeId; jobId+state+_id; transaction từng mục, execute<=50                 |
| catalog_source_usage | runId nullable, provider=geoapify, group/requestedLimit, state requested/fetched/failed,received/errorCode/internalRequests,providerCredits nullable                                                         | createdAt desc; runId; request nội bộ không chứng minh credits provider                  |

catalog_runs thêm campaignId,scopeSnapshot(destinationID/name/lat/lon/radius),policySnapshot(policyID/version/autoApplyDraftHours/autoPublish=false),source,paused; giữ lease/fence/retry nguyên tử. catalog_schedules có provider-quota singleton kỹ thuật để giữ quota toàn cục; không tạo khi GET. Settings.regions<=100 và không đòi destination published; importer không nhận scope thiếu cấu hình. Nguồn rỗng/timeout không tự đóng cửa.

audit_logs thêm proposal_saved/restore_prepared/published/campaign_paused/campaign_resumed/policy_created; entityType catalog_campaign/catalog_policy; optional previousRevision,campaignId,batchId,runId. Before/after đầy đủ đọc qua version snapshots với quyền admin; audit không nhận raw facts, khóa hay secrets. Không viết lại sự kiện legacy thiếu thông tin. Existing unique audit dedupe giữ nguyên.

Không thêm TTL/purge mới trên các collection này; cần chốt retention trước vận hành dài hạn. Khởi tạo indexes additive từ product.initialize, không syncIndexes/drop. Registry là mirror tài liệu, không executable schema. Server aggregates toàn scope thay cap5000; bounded sample500 dashboard map vẫn được đánh dấu riêng. Map toàn tập và bulk dùng cùng predicate catalog-query; không trả toàn bộ catalog cho client.

Destination.catalogWriteFence mặc định0: chốt ghi chung của source/ingest/publish/archive trong transaction, khác revision biên tập. Archive đòi tắt schedule, pause/hoàn tất run; stale parent bị chặn trước sửa child, lỗi finalization đưa lô partial và giải phóng chốt.
