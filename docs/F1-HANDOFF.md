# GoEase — F1-A review và bàn giao F1 v0.2

Ngày review: **22/10/2026**. Baseline thiết kế được chủ dự án chấp thuận; **F1-B đã triển khai/kiểm chứng local; F1-C/CORE-1 chưa triển khai**. F1-A chỉ chỉnh tài liệu, không thay source, dependencies, scripts, secrets hoặc MongoDB.

## 1. Trạng thái repository và nguồn chính

Đã quan sát nhánh `main`, HEAD trước chỉnh sửa `685552e549a474bc300d361c9343a82c3a7c181b` (khớp sourceCommit của bản nhập). Git ban đầu có các tài liệu v0.2 untracked và `docs/archive/`; không có tracked runtime changes. Không có `docs/BR-v0.2-draft.md`; bản nhập đã nằm ở `docs/archive/BR-v0.2-draft.md`, đã đọc và giữ nội dung tham chiếu. Không suy đoán một file nhập bị thiếu. Trong khi review, HEAD chuyển sang `fddcf6643f67356dde151d432338fc4b7cb616f8` (commit thêm đúng 5 tài liệu nhập); đã kiểm tra diff từ HEAD ban đầu, không có source/config/script thay đổi. Giữ nguyên commit mới này và tiếp tục trên main, không reset/rebase. Registry giữ sourceCommit gốc và reviewHead riêng.

```text
docs/
  BR.md                         Nguồn nghiệp vụ chính, mã BR cũ và mới
  ARCHITECTURE.md               F0 thực có / F1 dự kiến
  DB-BASELINE.md                Nguồn field/type/metadata/index mục tiêu
  DATA-TRACEABILITY.md          Nguồn audit/analytics/retention mục tiêu
  collection-registry.json      Bản đọc máy của dictionary; không executable
  F1-HANDOFF.md                 Review, gates và thứ tự triển khai
  F0-VERIFICATION.md            Bằng chứng lịch sử, giữ nguyên
  archive/BR-v0.2-draft.md       Bản nhập tham chiếu, không phải BR hiện hành
```

Đọc theo AGENTS → README → BR → ARCHITECTURE → F0-VERIFICATION → DB-BASELINE → DATA-TRACEABILITY → registry → handoff/task hiện tại. Archive chỉ dùng khi cần đối chiếu. Không còn hai bộ BR có thẩm quyền ngang nhau.

## 2. Kết quả review thiết kế

Rà cả 40 collection theo dictionary và registry; chưa xác nhận schema runtime hoặc index thật. Các số retention, caps và provider contracts chưa đủ để triển khai mọi module.

| Mã   | Phát hiện / tác động                                                                                                                                                                                                                                                                              | Xử lý hoặc đề xuất và gate                                                                                                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | BR cũ để login mở; architecture coi API prefix/replica set còn là đề xuất                                                                                                                                                                                                                         | Đã đồng bộ Google + password, npm/localhost; F0 có /api/v1 và local rs0. Giữ policy guest mở ở Q-02.                                                                                                                                                                                                      |
| R-02 | Refund registry thiếu provider/merchant/environment so với dictionary; unique providerRefundId scope không khớp                                                                                                                                                                                   | Đã đồng bộ fields/index từ dictionary, không đổi nghiệp vụ tiền hay chọn provider. Registry vẫn là mirror, không schema chạy được.                                                                                                                                                                        |
| R-03 | Traceability đòi trip revision cùng operationId với audit nhưng field thiếu; role Traveler khác casing; audit taxonomy bị gọi nhầm là collection registry                                                                                                                                         | Đã thêm operationId vào trip_revisions dictionary/registry; chuẩn hóa traveler; thêm taxonomy tối thiểu ở DB mục 11. Chưa tạo enum runtime.                                                                                                                                                               |
| R-04 | users.emailNormalized unique nhưng AUTH-01/02 cấm merge email tự động: Google signup gặp password account cùng email chưa có flow collision đầy đủ; unlink/relink và khóa email có ảnh hưởng quyền                                                                                                | Đề xuất yêu cầu login/re-auth account hiện hữu rồi link identity đã verify; chưa tạo user trùng/merge. Owner chốt UX/recovery, thay email và quyền account chưa verify trước F1-C slice tương ứng (Q-02/Q-06). Không tự đổi unique/ownership.                                                             |
| R-05 | auth_challenges.context chỉ liệt kê ví dụ; userId nullable chưa có ma trận purpose, binding OAuth/link/reset chưa đủ                                                                                                                                                                              | F1-C phải đặc tả purpose → user/identity/targetEmail/state/nonce/PKCE/session binding, consume một lần và race tests trước endpoint đó. Không nhận generic Mixed.                                                                                                                                         |
| R-06 | Nhiều enum chỉ ghi “theo BR”; transitions chưa đủ predicate/required field. Refund DB có unknown trong khi BR COM-06 không liệt kê; entitlement sourceId/admin_grant evidence và quote/order references chưa đủ contract. Booking index schedule.startsAt chưa thống nhất schedule discriminators | Giữ nguyên nội dung để không tự thay nghiệp vụ/quyền/tiền. Q-04/Q-09: trước commerce chốt unknown/reconcile, transition table + timestamp/evidence, grant source key và field lịch từng loại; chưa tạo index trên path mơ hồ. Posts/reviews có state machine khác nhau, cần mapping riêng trước PLATFORM. |
| R-07 | Purge trip chưa liệt kê hết ai_runs proposals/inputSummary, idempotency/outbox/cache/export/analytics và backup; restore snapshot có thể mang quyền/link cũ                                                                                                                                       | Đã bổ sung inventory trong DATA-TRACEABILITY, không chốt xóa mới. Q-07 phải duyệt phạm vi, hold, suppression và vendor handling trước destructive job; restore chỉ phục hồi nội dung được phép, không quyền/share.                                                                                        |
| R-08 | Bounded/cap/policy/default {} và required có điều kiện chưa đủ validator; retention là đề xuất; consent_eventId thiếu khi purpose không dựa consent; source enum analytics dùng provider_verified nhưng ví dụ environment không đồng nhất                                                         | DB mục 11 làm rõ optional/null/default và phân biệt revision/schemaVersion. Q-05/Q-07/Q-09: consumer chốt nested shape/default, caps, retention, consent evidence union và enum environment/trustLevel trước analytics; không bật thu thập hoặc tự purge.                                                 |
| R-09 | CORE-1 tham chiếu destinationId nhưng danh sách nhỏ trước đây gộp places/AI/analytics vào cùng CORE; avatar/media/privacy jobs có phụ thuộc chưa bật                                                                                                                                              | CORE-1 cần destinations tối thiểu với nguồn GoEase được phép; scope catalog manual và caps chốt trước consumer. Không tạo media/place/AI/analytics chỉ để thỏa sơ đồ. Các field tới module chưa có không được nhận từ client.                                                                             |
| R-10 | Outbox/runner tổng quát ngay F1-B dễ thành phase nền quá lớn; F0 E2E chạy mongod standalone                                                                                                                                                                                                       | Audit trực tiếp trong transaction đủ cho bước đầu; hoãn outbox đến consumer delivery và runner đến migration thật. F1-B cần bài kiểm tra replica-set riêng, F0 chưa chứng minh transaction.                                                                                                               |

### Các ranh giới đã rà và giữ

- Embeds days/activities hữu hạn, refs cho lịch sử/phiên/logs có vòng đời riêng; ObjectId không phải FK enforcement. Không tạo collection cho từng day/activity.
- Index theo list owner/time, identity lookup, revision/audit dedupe và worker queries; chưa benchmark. Partial unique phải loại null/absent đúng predicate; active slug restore conflict, email giữ chỗ qua soft-delete. Không dùng một index soft-delete generic cho tất cả.
- Mọi actor/role/ownership và thao tác nhạy cảm do server quyết định. Revision query update phải có expectedRevision, không chỉ dựa Mongoose save middleware.
- APPEND không updatedAt/deletedAt thông thường; history phục hồi khác audit tối thiểu. Append-only không phải vĩnh viễn hoặc tamper-proof; purge đặc quyền đợi policy.
- Transaction cùng session cho mutation/revision/audit/idempotency completion; operationId ổn định qua retry. Failed auth audit ngoài transaction bị rollback. Không gọi email/AI/payment trong callback có thể retry.
- Token/hash/password/private text không vào DTO/log/audit changes; technical logs dùng route template và allowlist. TTL không thay kiểm tra expiry/access.
- Migration có schemaVersion, checksum, checkpoint, compatibility và kiểm tra duplicates trước index; chưa chạy migration hay syncIndexes. Money/order history độc lập itinerary.

Nguồn đối chiếu F1-A: [MongoDB unique](https://www.mongodb.com/docs/manual/core/index-unique/), [TTL](https://www.mongodb.com/docs/manual/core/index-ttl/), [transactions](https://www.mongodb.com/docs/manual/core/transactions/) và [Công báo Luật 91/2025/QH15](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578/57730.htm). Đây là review thiết kế; không xác nhận tuân thủ pháp lý hoặc provider đã được chọn. Skill mongodb-schema-design được dùng cho review access patterns, embed/reference và document history, không truy cập DB.

## 3. F1-B — context, log an toàn và audit tối thiểu

**Trạng thái: IMPLEMENTED / VERIFIED LOCAL cho phạm vi F1-B; chưa production-ready.** Xem [F1-B-VERIFICATION](F1-B-VERIFICATION.md). Các mô tả “task tiếp theo/READY” bên dưới là phạm vi phê duyệt ban đầu của F1-A. R-04–R-09 không chặn context/audit test không chứa PII, không chạy purge, không mở signup hay thu analytics. READY không phải đã triển khai/PASS; hoàn thành F1-A không tự cho phép thực hiện F1-B trong cùng task.

**Mục tiêu:** request có requestId hợp lệ; log allowlist không lộ bí mật; primitive mỏng ghi audit cùng transaction và chứng minh rollback trên local replica set.

**Phạm vi được sửa trong task tiếp theo:** server middleware/context/logger và audit service/model vừa đủ consumer, tests database riêng, contracts chỉ khi response thực cần requestId, README/BR/DB/traceability theo thay đổi. Không framework repository/base model lớn, dashboard, generic runner hoặc 40 models.

**Collection/field dùng ngay:** chỉ `audit_logs`: APPEND metadata, action/category, actor, entityType/entityId/entityRevision theo action, occurredAt/recordedAt, requestId/operationId/correlationId?, outcome/reasonCode, safe changedFields/changes, source, retentionClass/retentionUntil/legalHold. F1-B chỉ ghi system.audit_probe trong DB test; giữ fixture domain của rollback trong DB test, không thành product collection. `schema_migrations` chưa cần model/runner trước migration thật; `outbox_events` chưa có consumer.

**BR:** DATA-01–DATA-04, DATA-07, DATA-09, DATA-11; AUTH-08 cho nguồn actor. APPEND và actor/type được DB mục 2/11 định nghĩa.

**Nghiệm thu:** requestId thiếu/sai/dài bị chuẩn hóa; scanner không thấy giá trị password/token/cookie/email/notes mẫu trong stdout hoặc audit; audit không nhận actor từ body; duplicate operation retry không tạo hai event. Transaction thử trong DB test riêng rollback cả fixture lẫn audit khi inject lỗi; commit có đủ cả hai. Test harness tự sở hữu replica-set test hoặc kiểm tra điều kiện và báo blocked, không reconfigure rs0 app/instance người dùng. Không dùng F0 standalone E2E làm bằng chứng transaction. Check build/typecheck/lint/tests phù hợp và báo kết quả quan sát.

**Điều kiện còn thiếu:** không có business decision chặn phạm vi này. Public audit production retention/purge và quyền DB vận hành cần Q-07 trước rollout; F1-B không tự chọn thời hạn hoặc cleanup production. Nếu không có test replica set khả dụng, phần nghiệm thu transaction phải báo blocked đúng thực tế.

## 4. F1-C — authentication và identity

**Mục tiêu:** Google và email/password trên một user ID ổn định, link an toàn, session revoke, token một lần; không giả thành công provider.

**Phạm vi được sửa:** auth/user feature server, auth contracts/validation, UI login tối thiểu và trạng thái retry, env example placeholder, focused tests, tài liệu. Triển khai từng slice đăng ký/verify → login/logout/revoke → Google/link; không bắt đầu commerce hay trip CRUD.

**Collection/field:** `users` (_id/emailNormalized/emailVerifiedAt/displayName/status/roles/securityVersion/privacySettings và metadata); `auth_identities` (userId/provider/issuer/providerSubject hoặc loginEmailNormalized/passwordHash, linkedAt/verifiedAt/unlinkedAt); `auth_sessions` (hash token/userId/identityId/securityVersionAtIssue/issuedAt/lastSeenAt/expiresAt/idleExpiresAt/revokedAt); `auth_challenges` (purpose/hash/binding/expiry/consumed/revoked/attempt limits); `audit_logs` từ F1-B. `consent_events` chỉ cùng notice/version/purpose flow thật, projection cập nhật nguyên tử; không giả consent cho mọi xử lý. Outbox chỉ nếu chọn delivery bền vững có worker/retry/dedupe thật; avatar media chưa cần.

**BR:** AUTH-01–AUTH-08, DATA-01–DATA-09, DATA-12. Các policy guest/lifecycle còn mở không được biến thành gate ngầm đã chốt.

**Nghiệm thu:** login hai cách đúng identity; email collision không merge/takeover; re-auth/link race chống identity thuộc user khác và unlink cuối cùng; verify/reset consume một lần, expired/revoked bị chặn dù TTL chưa dọn; logout/all/suspend/password change thu hồi theo policy; role/actor body không nâng quyền; generic reset response; secrets/hash không DTO/log. Tích hợp Google kiểm issuer/sub/audience/state/nonce/PKCE theo flow chọn; email/provider lỗi không báo đã gửi thành công. Test fixture ghi rõ, live provider chỉ PASS khi quan sát thật.

**Điều kiện còn thiếu:** Q-06 và R-04/R-05: Google đã chọn nhưng client/redirect/credentials chưa thiết lập, email delivery chưa chọn; session TTL/rate limit/recovery/verification gate/notice cần chốt cho slice đó. Q-07 chặn signup public chưa có notice/policy. Có thể làm slice không phụ thuộc sau khi đặc tả, không bypass hoặc gắn nhãn login thật khi mock.

## 5. CORE-1 — tạo, sửa, lưu và mở lại trip theo owner

**Mục tiêu:** user xác thực tạo trip manual, lưu MongoDB rồi reload/restart mở lại đúng nội dung; B không truy cập trip A; conflict giữ nháp.

**Phạm vi được sửa:** trips feature/model/validation/service/routes, shared DTO độc lập Mongoose, UI create/edit/list/reopen và retry/conflict; tests và tài liệu. Có delete/restore nếu policy đã chốt; chưa expose share/collaboration/transfer/purge tự động/AI/commerce.

**Collection/field:** `trips` ownerId + MUTABLE_SOFT/revision/schemaVersion, title/status/visibility private, destinations/startDate/endDate/timezone/travelers/budget/preferences/days stable IDs/summaryTotals/generationMode manual/firstSavedAt/notes; `trip_revisions` tripId/revision/previousRevision/tripSchemaVersion/snapshot/action/actor/requestId/operationId; `idempotency_keys` actorId/operation/key/requestHash/status/lease/resource reference/responseStatus/expiresAt; `audit_logs`; `destinations` tối thiểu _id/name/slug/timezone/publicationStatus/source và metadata theo dictionary vì trip cần destinationId. Không places/media/AI/usage/analytics trong slice manual. Auth collections được tái dùng, không tạo lại.

**BR:** BR-01/BR-03–BR-05/BR-07/BR-08, AUTH-08, TRIP-01–TRIP-05, TRIP-07–TRIP-10, TRIP-12, DATA-01–DATA-04/DATA-07/DATA-08/DATA-10. TRIP-07 VND/group_total vẫn đề xuất; cần chốt trước tính tổng.

**Nghiệm thu:** persist/read sau reload và restart API; owner filter ở list/read/update/history/delete/restore; invalid IDs/input/date/count/money bị từ chối; hai save cùng revision chỉ một commit và một 409; retry cùng key/payload không duplicate, khác payload conflict, cached response vẫn reauthorize. Audit/revision insert lỗi rollback mutation và completion key. Xóa mềm không lọt count/aggregate/populate/history đường thường; restore có quyền, kiểm unique/dependency, tạo revision mới, không sửa snapshot cũ hay mở lại link. Không báo thiếu chi phí là miễn phí; UI loading/empty/error/retry/conflict usable.

**Điều kiện còn thiếu:** F1-C identity usable; Q-02 cho quyền saved draft/unverified user; Q-05/Q-09 cho caps/nested defaults/destination source và trip transitions; xác nhận TRIP-07 tiền/group scope. Q-07 chặn purge tự động và retention chưa duyệt, không ngăn xây owner persistence sau các quyết định liên quan. Commerce không chặn CORE-1 manual.

## 6. Sau CORE-1

CORE-2 mới thêm places/ai_runs/usage_buckets với provider/data rights/quota/apply expectedRevision và fallback rõ; analytics_events đợi purpose/consent/taxonomy. PLATFORM và COMMERCE đi từng consumer sau gate ở BR mục 9 và R-06. Không coi bản đồ 40 collection là backlog tạo models hàng loạt.

## 7. Kiểm tra F1-A và giới hạn bằng chứng

Kiểm tra tài liệu: JSON parse; mirror 40 tên/phase/base/field/type/default/index/rule/retention với dictionary; BR codes/mapping/registry references; liên kết nội bộ, đường dẫn cũ, trạng thái design-only; format từng file thay đổi; git diff chỉ tài liệu. Kết quả đã quan sát: PASS Python JSON/mirror check cho 40 collection và brRefs; PASS giữ 68 rule rows v0.2 + 10 rule rows BR cũ; PASS 32 liên kết Markdown nội bộ và registry authority paths/anchor; không còn đường dẫn tên cũ trong tài liệu hiện hành. Prettier check với --ignore-path NUL đã kiểm cả BR/AGENTS vốn nằm trong ignore mặc định; PASS git diff --check và phạm vi chỉ tài liệu. Đã đối chiếu remote main ở fddcf66 trước commit; trạng thái push được báo sau thao tác thực tế. F0-VERIFICATION giữ nguyên byte và bằng chứng pnpm/npm lịch sử. Registry bổ sung brRefs cho cả 40 collection để kiểm tra mã BR có đích; DB-BASELINE vẫn là nguồn field/index, BR là nguồn nghiệp vụ.

Không chạy application tests, migration, syncIndexes, db:check, provider hoặc thay MongoDB trong F1-A. Chưa có bằng chứng auth/trip/transaction/AI/payment/PWA hoạt động từ task này. Commit SHA và push được báo ở bàn giao sau khi quan sát Git, không ghi SHA tự tham chiếu vào nội dung commit.

## 8. Bàn giao F1-B

Đã thêm context UUIDv4 tách request, safe logger JSON cho HTTP/startup/database/error, audit_logs model/service append/read test-only và integration harness replica set riêng. Không thêm dependency; contracts/client runtime không đổi, health/error body giữ nguyên. Playwright có optional localhost ports và test-only Vite proxy config để giữ dev server đang chạy.

Đã kiểm chứng unit/HTTP, scan stdout/stderr, concurrency, index thật, commit/rollback/audit write failure, sequential/concurrent dedupe và conflict; chi tiết lệnh/môi trường ở verification. F1-B không ghi audit lúc app startup, không HTTP audit API, không auth/trip/analytics/outbox/migration/purge. Fixture và probe chỉ nằm trong DB test riêng, cleanup không đụng rs0 ứng dụng.

F1-C vẫn cần Q-06/R-04/R-05: email delivery provider; Google OAuth client/redirect/config; session/rate-limit thông số, email collision/re-auth/link/recovery UX, ma trận challenge binding; Q-02 cho quyền account chưa verify và Q-07 cho notice/policy trước public signup. Google + email/password đã chốt, không hỏi lại phương thức login. F1-B không tự chọn các policy đó và dừng tại đây.
