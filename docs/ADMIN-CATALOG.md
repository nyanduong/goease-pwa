# Admin catalog and automatic estimates — 2026-10-23

## Vận hành hiện tại — tự động cập nhật Hội An

CAT-11–13 bổ sung luồng dưới đây; các phần mô tả preview thủ công phía dưới là đường nhập bổ sung. `/admin` mặc định mở **Việc cần làm**, sidebar chỉ có Việc cần làm / Địa điểm / Tự động cập nhật / Lịch sử.

1. Mở **Tự động cập nhật**. Nếu “Chưa kết nối nguồn dữ liệu”, người thiết lập điền `GEOAPIFY_API_KEY` ở `server/.env` rồi restart API. UI không nhận/trả khóa. “Đã cấu hình kết nối” chỉ xác nhận có cấu hình; kết quả từng lượt mới chứng minh nguồn phản hồi.
2. Chọn nhóm địa điểm, Hằng ngày/Hằng tuần, ngày và giờ Việt Nam; **Lưu và bật tự động**. Mặc định lịch tắt. Backend đang chạy sẽ tự lấy dữ liệu dù đóng admin. Chạy ngay tạo công việc bền vững, không chờ preview hoặc phiên đăng nhập. Tạm dừng ngăn lượt tự động mới; lượt đang nhận vẫn hoàn tất/thử lại.
3. **Việc cần làm** nhóm bản nháp, nghi trùng, nguồn thay đổi, giá hết hạn và lượt cần can thiệp. Lỗi đang tự thử lại hiển thị thời điểm; chưa yêu cầu admin xử lý. Không tạo việc chỉ vì thiếu giá/ảnh/giờ. Mở hàng để thấy bản hiện tại, nguồn mới, khác biệt, ngày lấy và đường dẫn nguồn. Ngày lấy không phải ngày người xác minh.
4. **Giữ thông tin hiện tại**, **Áp dụng thay đổi**, **Bỏ qua địa điểm này** hoặc **Để sau**. Hẹn1ngày/1tuần/30ngày có thời điểm rõ. Nghi trùng có “Đây là hai địa điểm riêng”. Bỏ qua ngừng hiển thị và không tự đăng lại; nguồn mới liên quan có thể tạo việc đối chiếu mới. Áp dụng dấu hiệu đóng cửa có lời giải thích ngừng hiển thị. Các quyết định kiểm cả phiên bản việc và địa điểm.
5. Trong **Địa điểm**, tìm/lọc, chọn tối đa50 mục (qua nhiều trang), **Xem trước để đăng**, xem mục đủ điều kiện/bị chặn, rồi **Đăng các mục đủ điều kiện**. Không cần giá nếu thông tin cơ bản/nguồn đủ. Mục xung đột vẫn được chọn để mở bản mới. Màn editor dùng API cũ; nguồn hệ thống không nằm trong writable form. Lưu địa điểm đang published giữ trạng thái published; Ngừng hiển thị có xác nhận phạm vi.
6. **Lịch sử** hiển thị tác nhân người/hệ thống, địa điểm, thời gian và kết quả tiếng Việt. Mở từng lượt để xem số mới/không đổi/cần xem/bỏ qua/lỗi; mã kỹ thuật nằm trong phần mở thêm. Danh sách30lượt gần nhất, audit phân trang30; việc phân trang20. Không có chức năng khôi phục toàn bộ nội dung cũ.

API bổ sung dưới `/api/v1/admin/catalog`, dùng cùng session/admin/Origin guard, no-store và envelope hiện có:

| API                          | Hợp đồng                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/operations`            | Trạng thái cấu hình kết nối, lịch và30lượt gần nhất; không khóa/lease/token                                                                 |
| PUT `/schedule`              | `CatalogScheduleInput`: enabled, frequency daily/weekly, hour0..23, minute0..59, weekday0..6, group, expectedRevision; UUID Idempotency-Key |
| POST `/run`                  | UUID Idempotency-Key; nhận runId, gộp yêu cầu khi đã có lượt active                                                                         |
| GET `/reviews?offset=0`      | CatalogReviewDto: place, currentLocation, incoming/previous, fetchedAt, kind/reason, duplicates, revision;20mục + total/hasMore             |
| POST `/reviews/:id/decision` | expectedRevision, expectedPlaceRevision, decision keep/apply/ignore/later/distinct, revisitAt ISO cho later; UUID key                       |
| POST `/batch-preview`        | items[{id,expectedRevision}]1..50 duy nhất, status published/archived; kết quả đủ điều kiện/lý do từng mục                                  |
| POST `/batch`                | Cùng body preview + UUID key; receipt giữ kết quả từng mục và replay chính xác trong24h                                                     |
| GET `/history?offset=0`      | 30audit catalog, tác nhân người/hệ thống, tên/ID địa điểm và thời gian                                                                      |

Không lấy actor/quyền từ body. Customer bị chặn; admin không được thêm quyền đọc trip riêng. Collection/index/giới hạn: [DB baseline](DB-BASELINE.md#runtime-catalog-automation--2026-10-23). Bằng chứng và giới hạn: [CATALOG-AUTOMATION-VERIFICATION](CATALOG-AUTOMATION-VERIFICATION.md).

Owner requested milestone 1: manage places, restaurants and reference prices, connect them to customer estimates and test both roles. This is local implementation, not production acceptance or verification of real venue prices.

## Admin journey

Sign in with a provisioned admin account → automatically open **Quản trị** (`/admin`) → search/filter the paginated catalog → add or edit a place → save draft → preview → publish. Published entries can be archived (Ngừng hiển thị) and republished. The editor shows recent save/publication audit events. Admin uses a desktop workspace with a dedicated sidebar and logout. The brand returns to administration. Existing admin sessions, direct customer URLs and browser history navigation redirect to `/admin`; admin login overrides customer return intents. Admin has no travel UI. This is UI routing separation; server catalog permissions remain authoritative and this change does not introduce a new role or rewrite existing ownership policies.

The form manages the destination, name, category, place/restaurant/food-idea type, description, map search address, recommended duration, optional opening-hours note, source and one automatic reference price. Food ideas cannot have an automatic price until assigned a concrete restaurant. Destination is fixed after creation; create a separate entry for another destination. Changing the search address clears stale map coordinates. Map coordinate editing, uploads, structured hours, verified routing and a separate approval role are not implemented. Geoapify draft import is implemented as documented below. Existing artwork is retained; new entries use clearly labeled illustrative AI artwork.

Published edits affect new catalog reads/planning. Draft/archived entries are not publicly readable or available to the planner. Saving a published entry as draft removes it from public discovery. This UI explains the publication effect before the explicit publish action.

## Provision an administrator locally

Register a dedicated account through the ordinary UI, then from the repository root:

```powershell
npm run admin:access --workspace @goease/server -- grant admin@example.test
# To remove that role:
npm run admin:access --workspace @goease/server -- revoke admin@example.test
```

Replace the placeholder with an existing active account. This operator-only command refuses production, non-loopback targets, other ports/databases and anything except the existing `goease` database on localhost:27017/rs0. It changes only the selected account's roles/securityVersion and appends an audit event in one transaction; no shared Mongo service configuration changes. A privilege change requires signing in again. There is no default admin password, signup role parameter, public promotion endpoint or automatic role granted at startup. Deployment provisioning is still to be designed.

## Customer pricing

Admin explicitly chooses one reference amount (integer VND), label, per-person or whole-group basis, maximum applicable group size, conditions, HTTPS source URL, date checked and next review date. Zero means explicitly free; absent means unknown. Future checked dates and publication with an overdue reference price are rejected. The next review date is an editorial freshness cutoff, **not** a guarantee that a price will be available on a future travel date. The application does not fetch/verify the source URL on the admin's behalf.

AI output continues to contain only allowed places/times. The server attaches catalog price snapshots after validating AI output; Gemini does not invent prices or totals. Manually adding/swapping a published place also selects its active reference price. Server budget arithmetic multiplies per-person amounts once, leaves whole-group amounts unchanged and treats groups exceeding the price's maximum as missing cost. Missing accommodation/transport and activities with no price are explained in the budget UI. There is no automatic hotel, transport, child-price or promotion calculation, range estimate or booking quote in this milestone.

Each catalog estimate stores its source, conditions, checked/review dates, maximum group size and catalog revision. Existing saved trips retain these snapshots when catalog prices change or entries are archived. Changing traveler count recalculates totals using the saved basis and applicability. A customer can explicitly **Cập nhật giá tham khảo** from the stop editor or enter a personal estimate; manual input removes the catalog-provenance label. Refresh with no currently usable reference clears that estimate to unknown. No background rewrite of trips occurs.

The save API accepts a reference snapshot only if it matches the current published/fresh catalog price, the same activity/place in the owner's saved trip, or the same activity/place in their validated successful AI proposal. A fabricated or stale new reference is rejected with actionable 409; draft inputs remain. Idempotent trip replay, ownership, revisions and AI provenance remain enforced. Reference snapshots are included in read-only offline downloads; public shared trips continue to omit all costs.

## API, persistence and security

- `GET /api/v1/admin/places?q=&status=all|draft|published|archived&offset=0`: 20 items plus `hasMore`.
- `GET /api/v1/admin/places/:id`: editable DTO plus latest 20 audit event action/revision/time entries.
- `POST /api/v1/admin/places`: `{place}` and UUID `Idempotency-Key`.
- `PATCH /api/v1/admin/places/:id`: `{place,expectedRevision}` and UUID `Idempotency-Key`.

All admin APIs authenticate from the session, check an active server-side admin role and use no-store responses. Writes enforce the existing Origin/client-header guard. The service rechecks role inside its transaction. Ordinary accounts cannot access private catalog or promote themselves; admin catalog access grants no access to others' private trips.

`places`, `users`, `audit_logs`, `idempotency_keys`, `trips`, `trip_revisions` and `ai_runs` reuse existing collections. Additive optional fields preserve old records; no migration is required. Admin writes atomically commit catalog changes, audit and a 24-hour idempotency receipt. Only receipt-key races retry; unrelated DB failures propagate and roll back. `revision` is the concurrency version; Mongoose internal version keys are disabled for this catalog and its strict nested schemas so transaction rollback works. Old unused `__v` fields need no destructive cleanup. Historical catalog revision bodies/restore are not implemented; audit shows actor internally, action, target, revision and time, with no full form payload or private trip data.

Technical implementation: shared contracts in `packages/contracts/src/catalog.ts`; administration service in `server/src/features/explore/admin-catalog.ts`; snapshot validation in `server/src/features/trips/catalog-costs.ts`; admin UI in `client/src/components/admin-catalog.tsx`. See PRODUCT-VERIFICATION.md for observed checks and limits.

Geoapify import is implemented for fixed Hội An searches and draft-only batch creation; see [GEOAPIFY-IMPORT.md](GEOAPIFY-IMPORT.md). Source metadata is preserved on ordinary admin edits and omitted from writable form input; only the server sets it. Scheduled refresh and operational review are implemented as described above. A separate approval role, uploads, structured hours and coordinate editing remain unimplemented.

Concurrency clarification: every review decision also advances the place revision in the same transaction, including keep/later/distinct. This fences simultaneous editorial edits; draft review signatures advance with that decision so keeping or deferring a draft does not reopen itself. Source polling alone still does not advance editorial revision.

## Điều kiện xuất bản và vé gói — cập nhật 24/10/2026

Thay hướng dẫn cũ cho phép đăng địa điểm không giá: thiếu giá/điều kiện/phần bao gồm/phần không bao gồm hoặc giá quá hạn thì giữ bản nháp. Cả nút lưu xuất bản và xuất bản theo lô đều bị kiểm tra trên API. Địa điểm chỉ được Goe chọn khi thêm giờ rõ theo dạng `08:00–17:00` (có thể nhiều ca và ngày nghỉ theo parser hiện hành), địa chỉ và thời lượng, giá áp dụng cho số người. Không tự diễn giải giờ tùy ý hoặc chứng nhận giờ thực tế.

Vé dùng chung: bật checkbox, nhập mã chung (chữ thường/số/gạch nối), số ngày hiệu lực tính từ ngày dùng đầu và số lượt vào cửa. Chỉ gán cho điểm được vé bao gồm; sao cùng định nghĩa giá/điều kiện/nguồn/ngày sang các điểm cùng mã. Server tính một gói trong giới hạn đó; hết hạn/hết lượt tính gói mới. Khác định nghĩa cùng mã sẽ báo lỗi, không tự ghép. Không dùng cho bữa ăn; gói có quota riêng từng nhóm di tích, hạn 24 giờ trượt, hoặc điều kiện chưa xác định phải chờ hỗ trợ phù hợp. Chưa nhập/gán gói thực tế nào trong task này.

Catalog cũ vẫn giữ dữ liệu; cần biên tập thêm các trường mới. Vì vậy Hội An có thể chưa đủ nguồn hợp lệ để Goe tạo lịch ngay. Không điền placeholder hoặc tự xác nhận giá để mở khóa.

Kiểm chứng local cho thay đổi này: 41 unit tests; 23 tests trong catalog, catalog-operations, Hội An và reschedule integration trên MongoDB test riêng; typecheck, lint và build pass. Build còn cảnh báo chunk client trên 500 kB. API test xác nhận catalog thiếu dữ liệu không tăng usage_buckets. Budget tests kiểm tra gói theo người/nhóm, số lượt, hiệu lực ngày, xung đột định nghĩa và bữa ăn không bị gộp. Không gọi provider thật, không nhập giá/gói thật, không clear database hoặc sửa hồi tố lịch khách trong task này. Các integration về lưu snapshot hiện có vẫn pass; chưa có E2E trình duyệt mới cho form vé gói.

Giá set tối thiểu 2 khách: nhập `minTravelers=2`; không chỉ ghi điều kiện trong văn bản. Server loại giá khỏi Goe/dự toán cho khách đi một mình. Field cũ thiếu minTravelers được hiểu là 1.

## Bổ sung dữ liệu có nguồn — 24/10/2026

Đã áp dụng vào `goease` local theo yêu cầu chủ sản phẩm, giữ quyền xuất bản cho chủ sản phẩm. [Hồ sơ nhập và đối chiếu](data/hoian-catalog-enrichment-2026-10-24.json) chứa payload, nguồn theo trường, ngày đối chiếu, điểm chưa rõ, revision và kết quả đã lưu. Đây là hồ sơ dữ liệu đã áp dụng, không phải seed tự chạy khi khởi động.

- Bổ sung 7 mục: Văn hóa Sa Huỳnh, Thổ sản, Văn hóa Dân gian, Nghề Y truyền thống, Trà Quế, Lê Bá Truyền I và Tropical Cafe & Bistro. Có 4 mục mới, 3 mục cập nhật. Cả 7 giữ nháp.
- Bốn bảo tàng có địa chỉ, giờ và ngày nghỉ từ website bảo tàng; giá phổ thông 20.000đ/người/công trình theo tin về Nghị quyết 98/2026/NQ-HĐND trên Nhân Dân, đối chiếu thêm bản tin Đà Nẵng TV qua chỉ mục tìm kiếm (truy cập trực tiếp Đà Nẵng TV bị timeout). Không gán vé gói phố cổ hoặc tự khấu trừ vé đã mua.
- Lê Bá Truyền I dùng đúng một phần cao lầu 50.000đ trên website nhà hàng, không lấy khoảng chi tiêu trung bình làm giá cố định cho bữa ăn. Tropical dùng một phần Vegan Curry 110.000đ ở menu chính; ghi giờ nhận món đến 16:30, đóng cửa 17:00. Thuế/phụ thu chưa rõ được ghi trong điều kiện và phần loại trừ; Tropical có các phần menu không đồng nhất nên cần đối chiếu tại quán trước xuất bản.
- Trà Quế có giá 35.000đ, quyền lợi và phần loại trừ từ nguồn du lịch Hội An; chưa có nguồn giờ đón khách của đơn vị quản lý, vẫn chặn Goe. Không tự điền giờ để mở khóa. Giới hạn nhóm và hạn kiểm tra lại là phạm vi biên tập GoEase, không phải sức chứa hoặc thời hạn cam kết của cơ sở.
- Đưa 19 mục legacy đang published nhưng không qua điều kiện giá/nguồn/phần bao gồm/phần không bao gồm hiện hành về draft, giữ nội dung và nguồn gốc. Trong đó có một fixture `[TEST]` cũ. Các mục chưa xác định tên/chi nhánh, nghi trùng hoặc thiếu nguồn tiếp tục là nháp; không điền giá 0 thay cho chưa rõ.

Sau nhập: 61 mục Hội An còn hoạt động trong danh mục, gồm 55 nháp, 4 xuất bản và 2 archived. Nháp không tham gia danh mục công khai/Goe. Việc nhập này chưa mở khóa tự động chuyến Hội An nhiều ngày; chủ sản phẩm cần xem nguồn, giải quyết các điểm chưa rõ và xuất bản mục phù hợp trong `/admin` → Địa điểm. Dữ liệu giờ/ngày nghỉ vẫn theo parser hiện hành, không phải lịch vận hành được cơ sở xác nhận trực tiếp.

Đã kiểm tra 26 payload lưu lại khớp schema, 26 revision tăng đúng một lần, 26 audit và receipt hoàn tất; 26 endpoint chi tiết nháp trả 404. Bốn mục còn published qua schema xuất bản hiện hành. Nguồn Geoapify/OSM của bản ghi cũ và nội dung ngoài phạm vi được giữ nguyên; hash lịch khách không đổi trong lượt áp dụng. Thao tác dùng service quản trị có kiểm quyền của admin local hiện có, transaction/revision/idempotency/audit; không cấp quyền mới hoặc ghi bỏ qua validation. Một lỗi ở đoạn kiểm tra DTO sau lưu được sửa và phục hồi bằng cùng idempotency key, không tạo thêm revision/audit.

Không thay đổi mã ứng dụng hoặc schema, không gọi AI/Geoapify trong đợt bổ sung, không liên hệ trực tiếp cơ sở hoặc khảo sát thực địa. Chỉ chạy kiểm tra dữ liệu, API đọc và định dạng tài liệu; không coi các test ứng dụng lịch sử là đã chạy lại trong lượt này. MongoDB service/rs0 và database khác giữ nguyên.
