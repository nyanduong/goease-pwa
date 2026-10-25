# GoEase Admin V3 — vận hành và nghiệm thu

CAT-18/19 (25/10/2026): Cài đặt dùng danh mục tỉnh/thành tự nạp và toggle hiển thị; không còn form tự tạo điểm đến. UI bật tỉnh tiếp tục tạo đợt lấy tham quan vào draft theo phạm vi đã cấu hình hoặc tâm tra tự động. Không tự xuất bản; admin mở danh sách nháp đúng tỉnh và duyệt lô. Xem PROVINCE-IMPORT.md. Tắt hiển thị giữ địa điểm con và lịch thu thập; archive phạm vi vẫn là thao tác phụ thuộc riêng. Xem PROVINCE-CATALOG.md.

Ngày triển khai: 24/10/2026. Authority: CAT-17 / V3-BR-01…12 tại BR.md. Bộ 15 màn hình là hướng thiết kế; số liệu trên ứng dụng lấy từ API, không lấy số demo từ ảnh.

## Phạm vi sản phẩm

Luồng: Cài đặt phạm vi → Nguồn dữ liệu → Quy tắc & lịch → Đợt thu thập → Ngoại lệ → Địa điểm → Preview/lô xuất bản → Lịch sử và chuẩn bị phục hồi. Sidebar tối và logo GoEase hiện có; chi tiết nguồn dùng màu trung tính. Một ứng dụng React, một Express API, worker MongoDB hiện có; không Redis, dịch vụ trả phí mới hoặc collection theo miền.

Catalog vẫn dùng ID và liên kết OSM ổn định. Quan sát nguồn, bản chuẩn, phiên bản đề xuất, review, run/campaign và bulk là các thực thể riêng; chỉ `places` được đếm là địa điểm.

## Bản công khai và bản đề xuất

- `places` giữ nội dung khách đang thấy và `publicRevision`; `revision` là hàng rào cho thao tác admin. `catalog_versions` giữ đề xuất với `proposalRevision`, `basePublicRevision`, lý do/actor/quy tắc/run.
- `POST/PATCH /admin/places[/:id]` nhận `intent: save|publish` (mặc định save). Save tạo đề xuất; publish tường minh áp dụng đề xuất trong transaction, kiểm quyền/revision/điểm đến/ngoại lệ và lưu audit/receipt cùng nhau.
- `POST /admin/places/:id/restore` chuẩn bị đề xuất từ phiên bản cũ. Không tự hạ public thành draft, không phục hồi quan sát nguồn cũ hoặc mở khóa thủ công.
- `GET /admin/places/:id` trả `place` hiệu lực cho editor và `publicPlace` để so sánh. Danh sách public, tìm kiếm, Goe và kiểm tra giá chuyến dùng bản công khai; giá chụp mới dùng `publicRevision ?? revision`.
- Phiên bản và diff qua `GET /admin/places/:id/versions` và `/versions/:revision`; chỉ admin được đọc ghi chú nội bộ/provenance.
- `capabilities.discovery`, `scheduling`, `budgeting` tách nhau. Unknown giá/giờ/ảnh giữ nguyên; đầy đủ không có nghĩa xác minh. Ngày nhận nguồn không tự là ngày xác minh. Khóa theo trường giới hạn bởi tập trường editor; ingest/restore/publish bảo toàn khóa.

## Đợt, quy tắc và phạm vi

`/admin/v3/campaigns` tạo một đợt tối đa20 điểm đến cấu hình, cùng nhóm nguồn và policy. Mỗi run chụp tâm/bán kính/tên/ID, nguồn, policy ID/version và cờ tự áp dụng. Đổi settings/filter/policy sau đó không đổi run đã tạo. Run dùng claim/lease/fence/retry/transaction của worker hiện có. Pause thu hồi lease; resume/retry phần lỗi tiếp tục task có kiểm tra scope đang hoạt động.

Không có Hội An mặc định. `hoi-an` chỉ là khóa tương thích của ID cũ khi caller chọn ID đó tường minh. GET không tạo schedule/settings. Chưa chọn hoặc chưa bật phạm vi phải cho trạng thái/hướng dẫn chính xác; nguồn nhập yêu cầu một vùng tròn500–10000m đã cấu hình. Taxonomy Bắc/Trung/Nam và tám vùng du lịch (gồm Tây Nam Bộ) độc lập với vùng tìm nguồn; không tuyên bố một vòng tròn bao phủ tỉnh/toàn quốc. Admin thấy điểm đến nháp và lưu trữ.

`/admin/v3/policies` tạo phiên bản mới; không sửa âm thầm phiên bản đang chạy. `/policies/dry-run` phân trang mô phỏng, không ghi địa điểm. Quy tắc ít rủi ro hiện thực thi: chỉ thay duy nhất giờ trên draft, khớp nguồn trước, không khóa/ngoại lệ/trùng hoặc thay đổi quan trọng. Kết quả là đề xuất, không tự xuất bản. Mọi policy có `autoPublish=false`. Các nhóm tự động hóa khác chưa triển khai.

## Giao diện Đợt thu thập — 25/10/2026

Danh sách dùng bố cục đã được owner duyệt: ba thẻ tổng quan, tìm theo địa phương/mã đợt, lọc trạng thái/địa phương và bảng kết quả. Mỗi dòng hiển thị nhóm thu thập, tên phạm vi đã chụp, mã rút gọn (8 ký tự cuối ID), nguồn, thời điểm tạo, số tác vụ thành công và số địa điểm mới/cập nhật/cần kiểm tra/lỗi. Nút mở chi tiết đổi thành **Xem tiến trình**, **Xem kết quả** hoặc **Xem lỗi**; luồng tạo, pause/resume/retry và xuất bản vẫn giữ nguyên. Mobile chuyển từng dòng thành thẻ để đọc đủ trạng thái/kết quả/thao tác. Bộ lọc phạm vi trên topbar được ẩn riêng ở màn hình này, tránh nhầm với bộ lọc danh sách và phạm vi khi tạo đợt.

`GET /admin/v3/campaigns` nhận `offset` (0–1.000.000), `q` (tối đa100 ký tự, tìm literal theo tên địa phương/ID, không nhận regex), `state` (`running|succeeded|issues|paused`), `destinationId` (ObjectId). API aggregate `catalog_campaigns` với `catalog_runs`, lọc trước phân trang20 dòng. DTO `CampaignSummary` bổ sung `source`, `destinations[{id,name}]`, `groups`, `counts{created,updated,review,errors}`; detail và list cùng ý nghĩa. Không thêm trường lưu trữ, collection, index, migration hoặc quy tắc nghiệp vụ mới; dictionary/registry giữ nguyên.

`summary{running,completedToday,issues}` tính toàn bộ đợt, độc lập bộ lọc/trang: đang chạy theo state tổng hợp; hoàn tất hôm nay là đợt `succeeded` có thời điểm kết thúc tác vụ cuối trong ngày Việt Nam (UTC+7); có lỗi là có tác vụ failed hoặc `counts.errors>0`. Tiến độ là tỷ lệ **tác vụ thành công**, không phải tỷ lệ dữ liệu được duyệt. Kết quả mới/cập nhật/cần kiểm tra cộng từ counters đã lưu của từng run; không phải số địa điểm đã xuất bản. Có lỗi xử lý trong đợt hoàn tất được ghi rõ. Không đổi tên trạng thái nguồn thành “đã kết nối” chỉ vì có khóa.

Danh sách đọc lại mỗi5 giây khi đang mở; tìm kiếm chờ300ms, đổi bộ lọc về trang1, bỏ response danh sách cũ đến muộn. Có trạng thái tải/rỗng/lỗi/thử lại, không tự gửi lại mutation.

Kiểm chứng thay đổi: integration MongoDB riêng trong `server/test/campaign-list.integration.ts` kiểm kết quả persisted, đối chiếu list/detail, tìm literal, bộ lọc, phân trang25 đợt, tổng toàn tập, mốc ngày Việt Nam và quyền admin. Browser `tests/admin-campaigns.spec.ts` dùng dữ liệu minh họa có nhãn, kiểm desktop/mobile, không tràn trang, lọc/rỗng/lỗi/thử lại, mở tiến trình và form tạo; không là bằng chứng gọi provider thật. Ảnh kiểm tra ở `.local/campaigns/desktop.png` và `mobile.png` (không commit). Build/typecheck/lint và kết quả kiểm tra được báo ở bàn giao; không chạy thu thập nguồn thật cho thay đổi giao diện này.

## Theo lô và quy mô

`POST /admin/v3/bulk/preview` nhận action publish/archive/archive_destination và selection page (ID/revision tối đa50) hoặc filter (predicate server). Preview lưu mỗi ID/revision thành item riêng, không nhét cả catalog trong document. Bulk query, list/count và map dùng chung predicate; không lấy toàn bộ catalog xuống browser.

`POST /bulk/:id/execute` thực hiện tối đa50 item mỗi lần, tái kiểm role/revision/điều kiện trong transaction. Tiếp tục lô xử lý pending; retry lỗi là thao tác riêng, không làm lại succeeded. Mục đã không đủ điều kiện tại preview giữ blocked; không âm thầm mở rộng tác động sau đó. Item stale cần preview mới. API trả selection/scope/snapshotAt đã đóng băng để mở lại lô không dựa vào filter hiện tại. Kết quả từng mục được giữ; hoàn tất một phần không hiển thị thành công toàn bộ.

Archive destination yêu cầu tắt lịch và tạm dừng/hoàn tất đợt đang chạy trước; run paused được giữ. Cùng transaction dùng `destinations.catalogWriteFence` giữa ingest/publish và archive để tránh ghi mới trong lúc kiểm tra phụ thuộc. Chỉ archive cha sau khi con đã archive, revision cha còn đúng và tái kiểm phụ thuộc. Thay đổi cha hoặc lỗi finalization đưa lô về partial, giữ kết quả và giải phóng chốt chạy; không giữ khóa vô thời hạn. Điểm đến archived phải được mở lại trước khi thu thập/resume.

`GET /admin/v3/map` nhận filter+bounds+zoom, aggregate cụm trên toàn tập lọc trong viewport; tổng thiếu tọa độ tách riêng. Không chỉ lấy trang bảng. Thumbnail bản đồ tổng quan vẫn có sample500 và nhãn giới hạn; nó không dùng làm tổng số toàn catalog. Tổng quan dùng aggregation đầy đủ; hàng đợi phân biệt số địa điểm và số vấn đề.

## Nguồn, hạn mức và quyền

Geoapify duy nhất. `/admin/v3/sources` hiển thị đã cấu hình/chưa kiểm tra/đã lấy/lỗi quyền hoặc lỗi khác và usage request nội bộ. Counter nội bộ không phải số credits hay số dư provider; hai giá trị provider hiện trả null. Không tạo kết nối mới chỉ để có dashboard đẹp.

Adapter giữ giới hạn50 kết quả/request, origin cố định, response allowlist, timeout và lỗi đã làm sạch. Không lưu raw payload hoặc lấy ảnh; URL/Cloudinary không cấp quyền ảnh. Hiển thị attribution OSM/ODbL; quyền khai thác và attribution Geoapify phải được kiểm tra theo tài khoản trước chạy thật.

Smoke test thật phiên này chỉ được chạy sau quota/usage preflight tài khoản: tối đa2 lượt, không hơn giới hạn thấp hơn hiện có, tổng<=100credits tính retry. Không thử ép429. [Pricing chính thức](https://www.geoapify.com/pricing-details/) và [tài liệu Places](https://apidocs.geoapify.com/docs/places/places/) có mô tả credits khác cách diễn đạt; preflight phải dùng giới hạn bảo thủ và xác nhận quota còn lại. Thiếu quota/quyền truy cập là blocker, không dùng fixture làm bằng chứng provider thật.

## Migration và rollback

Đọc tương thích dữ liệu cũ qua `publicRevision ?? revision`; không cần xóa/reimport hoặc đổi ID. Migration bổ sung metadata V2, snapshot baseline và provenance legacy/unknown; không bịa ngày xác minh và không sửa audit cũ.

Runner: `npm exec -- tsx server/scripts/catalog-publication-migrate.ts plan|apply|rollback <manifest.json>` với `GOEASE_CATALOG_MIGRATION_URI` trỏ database local riêng có prefix `goease_admin_v3_dev_` hoặc `goease_admin_v3_test_`, replica set. Từ chối database ứng dụng `goease`, remote, credentialed URI và production. Không tự nới guard để chạy trên dữ liệu thật.

1. Sao lưu database đích theo quy trình hiện có. Plan chỉ đọc và tạo manifest mới độc quyền (không ghi đè file).
2. Kiểm tra database, ID/revision/public hash và metadata trước/sau trong manifest; apply chỉ metadata/snapshot baseline tương ứng. Chạy lại bỏ qua mục đã áp dụng.
3. Kiểm tra sau giữ public hash, source/ID; rollback dùng đúng manifest, chỉ phục hồi metadata và xóa baseline do migration tạo nếu còn nguyên. Thay đổi nghiệp vụ sau migration làm guard từ chối thay vì đè dữ liệu mới.

Chưa chạy migration trên `goease`; chỉ có kiểm chứng trong harness MongoDB riêng. Không tự purge run, bulk, policy, version hoặc audit. Cần chính sách retention trước sử dụng production dài hạn.

## Mở và nghiệm thu

Branch, runtime, kết quả lệnh, số đo, ảnh thật, fixture/provider và giới hạn cuối cùng được ghi trong ADMIN-V3-VERIFICATION.md. Checkpoint đang làm nằm ở ADMIN-V3-CHECKPOINT.md. Không coi file thiết kế hoặc build xanh là nghiệm thu UI.
