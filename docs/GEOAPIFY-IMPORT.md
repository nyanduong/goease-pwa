# Geoapify Hội An — thử dữ liệu và nhập danh mục

## Cập nhật vận hành hiện hành — CAT-11–13

Đã bổ sung lịch MongoDB + worker và luồng quyết định ở [ADMIN-CATALOG](ADMIN-CATALOG.md). Các mô tả “chưa scheduler/quota chỉ trong process/không refresh” trong hồ sơ thử ban đầu dưới đây là lịch sử, được thay bằng phạm vi hiện tại này.

- Giữ nguyên provider, OSM identity/attribution/ODbL, tâm/bán kính5km và phân bổ mixed20/15/15; không Place Details/ảnh/review/contact. Snapshot so sánh chỉ name/address/lat/lon/category/venueType/categories/openingHoursNote/sourceUrl/closed. `closed` chỉ true khi nguồn OSM ghi disused=yes hoặc abandoned=yes, còn lại null; không biến thiếu kết quả thành đóng cửa. Đây là tín hiệu cần người đối chiếu, không xác nhận cơ sở thực sự đóng cửa.
- Worker không dùng preview trong RAM. Mỗi lượt lấy toàn bộ tối đa3truy vấn trước transaction. Fetch lỗi giữa chừng không nhập nửa lượt; retry lấy lại nguồn. Thành công commit draft/observations/reviews/run-result/audit trong cùng transaction có fence. Không cache response thô hoặc giữ payload provider trong run.
- Source snapshot tách nội dung biên tập. Không đổi chỉ cập nhật fetchedAt/sourceCheckedAt và thống kê lượt; không tăng revision nội dung hoặc sinh audit địa điểm hàng loạt. Thay đổi tạo/cập nhật duy nhất review source. Nếu có đề nghị chưa xử lý, giữ baseline cũ để không mất phần thay đổi chưa áp dụng qua nhiều lần sync. Giữ/bỏ qua ghi signature, thông tin giống nhau không nhắc lại. Bản archived không tự khôi phục; bản đã bỏ qua có nguồn mới liên quan vẫn có thể được đề nghị đối chiếu.
- Bản legacy chưa có snapshot nguồn: lần chạy đầu tạo đề nghị đối chiếu toàn bộ trường nguồn, giữ nguyên nội dung hiện tại. Không dùng nội dung admin làm “nguồn trước”. Các import thủ công mới cũng lưu snapshot tối thiểu.
- Quota20lượt/giờ toàn hệ thống,10/actor/giờ,2slot dùng chung worker/preview trong catalog_schedules; slot hết hạn120s, lượt lỗi vẫn tính, counters sống qua restart. Một actor hệ thống riêng cho lịch tự động. Đây là giới hạn ứng dụng, không phải số dư/billing Geoapify; không tự mua gói.429 lưu lịch theo Retry-After hợp lệ có chặn1giây–24giờ, thiếu header thì15phút; lỗi tạm1/2phút, tối đa3lần. Thiếu/sai quyền khóa chuyển cần can thiệp ngay.
- Một active run Hội An qua unique partial index; atomic claim120s, heartbeat20s, hồi phục khóa hết hạn sau restart, không catch-up mọi kỳ đã bỏ lỡ: tạo tối đa một lượt khi lịch quá hạn rồi tính kỳ tương lai. Pause không hủy lượt đã nhận. Không cần phiên người cấu hình còn mở; actor worker hạn chế scope và không xuất bản.
- Bằng chứng lượt này dùng provider fixture qua API thật/MongoDB riêng; không gọi provider live, không tự bật lịch hay xuất bản danh mục thật. Kết quả provider thật trong phần bên dưới thuộc lượt thử trước, không được tính lại thành bằng chứng worker mới.

Ngày thực hiện: **23/10/2026**. Owner yêu cầu thử 30–50 địa điểm trước, sau đó làm import trong admin nếu dữ liệu đủ dùng. Đây là thử nghiệm local, chưa phải xác minh tại cơ sở hoặc nghiệm thu production.

## Kết quả dữ liệu thật

Project GoEase dùng gói Free (quan sát trên Geoapify). Key lưu trong `server/.env` được Git bỏ qua; không đưa vào React, báo cáo hoặc fixture.

Thử 3 truy vấn Places API, tâm **108.328, 15.88**, bán kính **5.000 m**, ưu tiên gần tâm; không đại diện toàn bộ Hội An hoặc danh sách địa điểm nổi tiếng. Nhóm tham quan gồm tourism.attraction/tourism.sights/entertainment.museum/beach. Không gọi Place Details, ảnh hoặc reviews.

| Nhóm      | Nhận | Giữ sau kiểm tra |
| --------- | ---: | ---------------: |
| Tham quan |   20 |               16 |
| Nhà hàng  |   15 |               14 |
| Cà phê    |   15 |               15 |
| Tổng      |   50 |               45 |

45/45 bản được giữ có tên, địa chỉ hiển thị, tên đường và tọa độ trong phạm vi; 23/45 có số nhà, 13/45 có trường giờ mở cửa được đọc từ OSM. Không có giá hoặc ảnh được lấy trong thử nghiệm. Năm mục không qua bộ lọc tên/cấu trúc/nguồn/phạm vi bị loại, không gán tên giả để đủ số lượng. Không có mã OSM lặp trong 45 bản, nhưng có **hai cặp nghi trùng**: Elephant (hai vị trí cách khoảng 6 m) và Cafe 99/Café 99 (khoảng 20 m). Khác mã nguồn không chứng minh khác cơ sở.

Tên cần biên tập: có tên tiếng Anh, thiếu dấu hoặc mang tính mô tả như “Street food next to the pharmacy…”, “Boa tang gom su mau dich”. Nhãn nguồn “tourism.attraction” còn chứa cửa hàng/artwork; admin phải đánh giá phù hợp. Các vị trí/giờ chưa được đối chiếu tại cơ sở. Mẫu ưu tiên gần tâm nên chưa kiểm chứng độ phủ An Bàng, Cẩm Thanh hay Trà Quế.

**Kết luận:** đủ làm dữ liệu đầu vào cho bản nháp có duyệt; chưa đủ để tự xuất bản hoặc tính giá. Qua màn admin thật đã nhập **41 bản nháp**, bỏ chọn 4 mục thuộc 2 cặp nghi trùng. Đối chiếu MongoDB local:41 mã nguồn duy nhất,41 audit catalog.imported,1 receipt có 41 ID; tất cả draft, referencePrice=null, tọa độ area có nguồn. Public catalog không trả các bản nháp này. Dữ liệu cũ giữ nguyên.

## Dùng chức năng admin

Đăng nhập admin → **Nhập địa điểm từ Geoapify** → chọn nhóm và 30/50 kết quả → **Tìm địa điểm** → xem tên/địa chỉ/vị trí/giờ/cảnh báo/nguồn → chọn mục → **Nhập … bản nháp**. Mặc định chọn mục mới không nghi trùng. Mục có cùng mã nguồn đã lưu bị vô hiệu hóa; không cập nhật/khôi phục nó. Mục nghi trùng cần xác nhận đã kiểm tra nếu vẫn muốn nhập riêng. Bộ phát hiện chỉ là trợ giúp, không chứng minh danh tính cơ sở.

Sau nhập, mở bản nháp để sửa tên, giới thiệu, thời lượng, địa chỉ và giá rồi xem trước/xuất bản bằng luồng hiện có. Giá chưa biết là null; không tự nhập 0. Thời lượng 60 phút là ước tính khởi đầu của GoEase, không phải dữ liệu Geoapify. Ảnh AI local được ghi rõ. Giờ OSM được giữ dạng ghi chú nguồn, không phân tích thành trạng thái đang mở/đóng. Vị trí nguồn là khu vực, chưa xác minh lối vào. Sửa địa chỉ trong editor vẫn xóa tọa độ cũ.

## API và giới hạn bản thử

- `POST /api/v1/admin/place-import/preview`: strict `{group:mixed|sights|restaurant|cafe,limit:30|50}`. Hội An là scope server cố định. Mixed phân bổ 20/15/15 hoặc 10/10/10; tối đa 3 request provider, không phân trang tự động.
- `POST /api/v1/admin/place-import/commit`: strict `{previewId,externalIds,acknowledgeDuplicates?}` + UUID Idempotency-Key;1–50 ID duy nhất. Body tối đa 48 KiB; không nhận dữ liệu place/source/key/role từ client.
- Preview nằm trong bộ nhớ server, gắn actor, hết hạn 15 phút; tối đa 10 preview toàn process, một preview mới nhất mỗi admin. Khởi động lại hoặc tìm lượt mới làm preview cũ hết hiệu lực. Không lưu response thô hoặc cache vào browser.
- Guard trong process:10 lượt tìm/admin/giờ,20 lượt/giờ toàn process, tối đa 2 lượt đồng thời. Lượt lỗi vẫn được tính. Đây không phải quota billing bền vững qua restart/multiple instances; provider vẫn có hạn mức riêng. Không tự chạy định kỳ hoặc tự mua gói.
- Provider cố định `https://api.geoapify.com/v2/places`, timeout 20 giây/request, không redirect; response tối đa 512.000 byte/50 features. Chỉ nhận dữ liệu OSM có ID hợp lệ, có tên/tọa độ hợp lệ trong phạm vi Việt Nam, nhóm được hỗ trợ. Các thuộc tính không dùng bị bỏ. Lỗi HTTP/timeout/JSON không biến thành import thành công; không log URL chứa key/error cause.
- So trùng bằng mã OSM ổn định, tên bỏ dấu/ký tự phân cách, tọa độ. Cùng tên trong catalog hoặc cách điểm cũ dưới 15 m là nghi trùng; trong cùng preview, tên chuẩn hóa bằng nhau và cách dưới 150 m là nghi trùng. Giới hạn đối chiếu 5.000 bản catalog; vượt ngưỡng báo lỗi, không bỏ kiểm tra. Cùng nguồn tồn tại kể cả archived/deleted luôn bỏ qua.
- Commit không gọi provider. Server kiểm quyền và destination lần nữa trong transaction; recheck trùng, tạo place + audit từng mục + receipt cùng commit. Lỗi bất kỳ rollback cả lô. Replay cùng key/payload trả kết quả đã commit ngay cả khi preview hết hạn; khác payload 409. Unique partial source index vẫn ngăn trùng sau khi TTLreceipt hết. Retry không ghi đè bản đã biên tập và không sửa trip cũ.

## Persistence và nguồn

Không tạo collection import riêng. `places.source` optional: provider=geoapify, externalId=`osm:node|way|relation:<id>`, fetchedAt(Date), attribution cố định, license=ODbL-1.0. Có index unique partial `{source.provider:1,source.externalId:1}` cho provider=geoapify và externalId string. Mã OSM không phụ thuộc tên/tọa độ hoặc Geoapify place_id. Map/source metadata và planning tái dùng field hiện có. fetchedAt là ngày lấy nguồn, không phải ngày admin xác minh. Không lưu phone, website, raw datasource, ảnh hoặc reviews.

`idempotency_keys` thêm resourceType=place_import và resultIds optional tối đa 50 ObjectId-string; operation=catalog.import, resourceId=UUIDbatch, TTL 24 h hiện có. Kết quả created từ resultIds; existing từ số lựa chọn trừ created. Replay luôn kiểm lại quyền. `audit_logs` thêm action=catalog.imported, category=catalog, entityType=place, actor từ session; chỉ metadata/ID/revision, không full payload/địa chỉ/key.

Ghi nguồn Geoapify/OSM và link ODbL ở màn import, editor, public catalog/detail. Lịch và bản chia sẻ/offline có chú thích nguồn cho tên địa điểm nhập trong snapshot; không thêm dữ liệu riêng tư vào provider. Offline shell tăng cache version để nhận chú thích. Không tự refresh hoặc xóa dữ liệu theo kết quả tìm sau. Phần SourceRef/geo/structured-hours/refresh/retention rộng hơn của baseline vẫn chưa triển khai.

Quyền dùng dữ liệu vẫn theo [Geoapify Places FAQ](https://www.geoapify.com/places-api/) và [OSM copyright/ODbL](https://www.openstreetmap.org/copyright). Giữ nguồn OSM riêng giúp truy vết; không tự loại bỏ nghĩa vụ ODbL đối với cơ sở dữ liệu phái sinh khi có áp dụng. Không suy ra quyền ảnh/review từ quyền Places.

## Lặp lại thử chỉ đọc

Điền GEOAPIFY_API_KEY trong server/.env, sau đó tại root:

```powershell
npm run geoapify:sample --workspace @goease/server
```

Script gọi 3 truy vấn và ghi allowlist/metrics vào `.local/geoapify-hoian-sample.json` (Git ignored), không kết nối MongoDB. Lượt chạy mới dùng quota provider. Thay key/env cần restart API; secret không nằm trong file example hoặc client bundle.

## Bằng chứng kiểm tra

Đã quan sát: live provider 50→45; browser admin tạo 41 draft rồi mở lại; read-only DB đối chiếu 41 draft/audit và receipt, không public; tests fixture provider và integration MongoDB thật. Integration bao phủ guest/customer/forged payload, preview khác admin/expired, xác nhận nghi trùng, concurrent same/different keys, receipt replay sau khi preview bị thay thế, giữ edit admin, public-hide, rollback cả lô/audit/receipt và search guard. Provider faults trong tests là fixture, không giả báo đã live thử lỗi upstream. Chi tiết check cuối lượt trong báo cáo bàn giao.

Chưa xác minh ngoài thực địa, chưa xác nhận giờ/giá, chưa test quota 20 search/giờ xuyên nhiều process hoặc browser trên điện thoại vật lý, chưa production/Atlas. Không commit key/artifact dữ liệu local, không tự xuất bản 41 bản nháp.

### Các lệnh đã PASS trong lượt này

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (27 unit), `npm run build`, `npm run db:check` (marker write/read/delete trong database test riêng).
- Với MONGOD_BINARY hiện có: `npm exec -- tsx --test --test-concurrency=1 server/test/place-import.integration.ts server/test/catalog.integration.ts server/test/geoapify.test.ts`: 21 checks, gồm17 integration và4provider fixture; không phải chạy toàn bộ integration suite.
- Với E2E_API_PORT=3001/E2E_WEB_PORT=5181: `npm exec -- playwright test tests/place-import.spec.ts tests/explore.spec.ts`:6browser tests với API fixtures. Test mới kiểm tra tìm lỗi/thử lại, chọn/khóa mục đã có, xác nhận nghi trùng, mất response vẫn giữ key/payload/lựa chọn, mở editor và lưu không gửi source do client.
- `npm exec -- playwright test tests/foundation.spec.mts --grep 'offline itinerary|share link creation|admin publishes reference'`:3browser tests với API/MongoDB test thật, kiểm hồi quy chia sẻ/offline/admin-price. Không gọi Geoapify trong các test này.
- Browser người dùng: tìm50kết quả thật, xem45mục hợp lệ, nhập41draft không nghi trùng, mở lại editor và reload vẫn thấy catalog. Read-only DB xác nhận41draft/41audit/1receipt, unique source index và public-hide.
- Git diff whitespace, registry40collection/CAT-10 references, .env/.local ignore và scan key Geoapify trong toàn bộ file Git-visible/client production bundle đều PASS. Không commit/push hoặc deploy trong lượt này.

## Rà soát biên tập tiếp theo — 23/10/2026

UI khách sau biên tập: bỏ ghi công khỏi bước tạo chuyến chưa có địa điểm; các màn có dữ liệu dùng mục thu gọn “Bản quyền dữ liệu” ở cuối phần nội dung. Giữ các link giấy phép/nhà cung cấp trong mục này và trong dữ liệu quản trị. Link giá đổi thành “Xem chi tiết giá”; bỏ link nguồn chung trên chi tiết địa điểm. Thông báo AI gửi dữ liệu và nhãn ảnh minh họa vẫn giữ. Offline shell v3 nhận cách trình bày mới.

Owner yêu cầu rà toàn bộ 41 bản nháp, bổ sung thông tin có nguồn và xuất bản mục đủ căn cứ; giá chưa xác minh phải giữ chưa rõ. Nội dung biên tập từng mục nằm trong [hồ sơ rà soát](data/hoian-catalog-review-2026-10-23.json): ID, revision gốc/mới, tên cũ/mới, nguồn, lý do và nội dung đã lưu theo contract admin.

**Trạng thái: đã áp dụng và kiểm tra trên GoEase local.** Sau khi owner đăng nhập admin, đã lưu đủ 41 mục bằng giao diện: 16 xuất bản và 25 giữ nháp. Mỗi mục được sửa qua luồng có kiểm quyền, revision và audit; không thay đổi quyền tài khoản hoặc ghi trực tiếp bỏ qua luồng admin.

Các trường hợp giữ nháp đáng chú ý: Bảo tàng Hội An 10B Trần Hưng Đạo có thông báo tạm đóng cửa trên trang chính thức; STREETS và Hoi An Smoothie có địa chỉ khác giữa các nguồn; Phùng Hưng chưa khớp địa điểm; một số quán chỉ có tên mô tả hoặc dữ liệu OSM lặp lại. Dấu hiệu đóng cửa từ danh bạ được ghi là cần xác nhận, không suy diễn thành thông báo chính thức của cơ sở.

Cả 41 payload giữ `referencePrice: null`, không dùng giá 0 thay giá chưa rõ. Nguồn OSM gốc được giữ riêng; link nguồn biên tập có thể thay đổi. Thời lượng 20–60 phút là gợi ý GoEase, không phải dữ liệu cơ sở cung cấp. Địa chỉ được biên tập sẽ làm mất tọa độ cũ theo hành vi editor hiện có, tránh dùng pin chưa đối chiếu. Giờ mở cửa chỉ là ghi chú; Goe hiện chưa tự loại ngày nghỉ hằng tháng của bảo tàng. Chưa khảo sát thực địa hoặc liên hệ trực tiếp cơ sở.

Sửa lỗi liên quan trong admin: sau khi sửa thời lượng, ghi chú khách đọc không còn giữ con số 60 phút của bản nhập cũ. Đã chạy PASS typecheck server, ESLint hai file thay đổi, 9 checks của `server/test/catalog.integration.ts` trên MongoDB test riêng (có kiểm tra sửa 60→45 phút), validation schema cho 41 payload và Git whitespace.

Đối chiếu dữ liệu thật sau lưu lúc 15:13 UTC ngày 23/10/2026: 41/41 khớp payload đã duyệt, revision đều tăng 1→2; 41 audit sửa/xuất bản; nguồn Geoapify/OSM gốc giữ nguyên; tất cả giá null và priceOptions rỗng. 16 endpoint chi tiết công khai trả 200 với tên/nguồn đã sửa và chi phí chưa rõ, 25 bản nháp trả 404. Truy vấn danh mục Hội An với limit=30 giống đầu vào Goe trả đủ 16 mục mới có planning (24 mục công khai tổng cộng, không còn trang sau). Không sửa 9 bản ghi ngoài phạm vi, kể cả fixture cũ. Chưa gọi lượt tạo lịch AI thật, chưa kiểm chứng chuyến đi ngoài thực địa hoặc triển khai production/Atlas. Ảnh minh họa AI vẫn được ghi rõ, không phải ảnh cơ sở.
