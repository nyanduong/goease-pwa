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

## Giao diện Lịch sử & phê duyệt — 25/10/2026

Áp dụng vòng thiết kế bảng + khung chi tiết đã được owner duyệt qua ảnh. **Nhật ký hoạt động** và **Việc chờ duyệt** là hai phần riêng. Bảng gọn hiển thị thời gian, người thực hiện, địa điểm/phạm vi và tên thao tác; chọn dòng mới xem kết quả, ghi chú, địa phương khi có căn cứ và nút mở địa điểm ở khung bên phải. Dòng đang chọn được đánh dấu. Mã sự kiện/ID/phiên bản nằm trong **Thông tin hỗ trợ** đóng mặc định. Có chọn dòng bằng bàn phím, đóng chi tiết và tự bỏ chi tiết cũ khi kết quả lọc không còn chứa dòng đã chọn. Mobile dùng các dòng xếp gọn và khung chi tiết bên dưới, cuộn/focus đến khung khi chọn, đóng để quay lại danh sách.

Tìm kiếm và bộ lọc thực hiện ở server trước phân trang30 dòng, không chỉ lọc trang đang mở. `GET /admin/catalog/history` nhận `offset` (0–100000), `q` (literal, tối đa100 ký tự, tên địa điểm/phạm vi hoặc người thực hiện), `kind` (`all|publication|editing|review|collection|settings`), `period` (`all|today|7days|30days`). Mặc định mọi thời gian để giữ khả năng đọc lịch sử cũ. Khoảng ngày tính từ 00:00 Việt Nam, 7/30 ngày gồm ngày hiện tại. Response thêm `total`; DTO thêm `actorType` và `destinationName` khi tra được. Lookup chỉ chiếu tên cần dùng; không trả email, raw audit payload hoặc thông tin riêng tư của tài khoản. Tên đối tượng/người thực hiện được tra từ bản ghi hiện tại, không phải snapshot tên tại thời điểm thao tác. Ghi chú chỉ gắn qua `operationId` đã ghi, không suy từ địa điểm.

Nhãn trạng thái mô tả thao tác tại thời điểm được ghi, không khẳng định trạng thái địa điểm hiện tại. Lưu chỉnh sửa là **Chưa xuất bản**, xuất bản là **Đã xuất bản**, yêu cầu lấy dữ liệu là **Đã yêu cầu**, nguồn thất bại là **Có lỗi**. Không coi nhận nguồn/lưu nháp là xuất bản, không bịa diff hoặc ngày hẹn khi API thiếu. Loại hoạt động chưa biết có mô tả trung tính. Nhật ký không lặp danh sách tiến trình lấy dữ liệu; mở màn thu thập để xem đầy đủ. Phần chờ duyệt giữ luồng và phạm vi hiện có; không dựng số chờ duyệt minh họa khi chưa tải count.

Nhật ký toàn hệ thống được ghi rõ và ẩn bộ chọn địa phương không áp dụng. Tải độc lập với trạng thái nguồn/lịch, polling15 giây; tìm kiếm chờ300ms, đổi bộ lọc về trang1, bỏ response cũ đến muộn. Có tải/rỗng/lỗi/thử lại và nhãn dữ liệu lần tải trước; không tự gửi lại mutation. Không thay audit đã lưu, schema persistence, index, quy tắc duyệt hoặc quyền; DB dictionary/registry giữ nguyên.

Kiểm tra: `server/test/catalog-history.integration.ts` dùng MongoDB riêng cho lọc trước phân trang35 hoạt động, total, tìm literal/người/địa điểm sau trang1, mốc ngày Việt Nam, ghi chú/context, quyền admin và projection không lộ dữ liệu thừa. `tests/admin-history.spec.ts` dùng fixture có nhãn kiểm bảng/chọn dòng/khung chi tiết, không nhầm yêu cầu với kết quả, bộ lọc/phân trang/reset, bàn phím, đóng/focus, lỗi/thử lại/rỗng, hàng chờ và desktop1600/mobile390/320 không tràn ngang. Ảnh `.local/history/desktop.png`, `mobile-390.png` không commit, không phải bằng chứng provider thật. Kết quả lệnh được báo tại bàn giao.

## Theo lô và quy mô

`POST /admin/v3/bulk/preview` nhận action publish/archive/archive_destination và selection page (ID/revision tối đa50) hoặc filter (predicate server). Preview lưu mỗi ID/revision thành item riêng, không nhét cả catalog trong document. Bulk query, list/count và map dùng chung predicate; không lấy toàn bộ catalog xuống browser.

`POST /bulk/:id/execute` thực hiện tối đa50 item mỗi lần, tái kiểm role/revision/điều kiện trong transaction. Tiếp tục lô xử lý pending; retry lỗi là thao tác riêng, không làm lại succeeded. Mục đã không đủ điều kiện tại preview giữ blocked; không âm thầm mở rộng tác động sau đó. Item stale cần preview mới. API trả selection/scope/snapshotAt đã đóng băng để mở lại lô không dựa vào filter hiện tại. Kết quả từng mục được giữ; hoàn tất một phần không hiển thị thành công toàn bộ.

Archive destination yêu cầu tắt lịch và tạm dừng/hoàn tất đợt đang chạy trước; run paused được giữ. Cùng transaction dùng `destinations.catalogWriteFence` giữa ingest/publish và archive để tránh ghi mới trong lúc kiểm tra phụ thuộc. Chỉ archive cha sau khi con đã archive, revision cha còn đúng và tái kiểm phụ thuộc. Thay đổi cha hoặc lỗi finalization đưa lô về partial, giữ kết quả và giải phóng chốt chạy; không giữ khóa vô thời hạn. Điểm đến archived phải được mở lại trước khi thu thập/resume.

`GET /admin/v3/map` nhận filter+bounds+zoom, aggregate cụm trên toàn tập lọc trong viewport; tổng thiếu tọa độ tách riêng. Không chỉ lấy trang bảng. Thumbnail bản đồ tổng quan vẫn có sample500 và nhãn giới hạn; nó không dùng làm tổng số toàn catalog. Tổng quan dùng aggregation đầy đủ; hàng đợi phân biệt số địa điểm và số vấn đề.

## Tự động cập nhật — bố cục danh sách lịch

`/admin#rules` đổi tên từ Quy tắc & lịch thành **Tự động cập nhật**. Tab Lịch cập nhật hiển thị lịch đã lưu theo từng khu vực, tìm tên không dấu, lọc Đang bật/Tạm dừng và phân trang 10 dòng. Tạo lịch/Chỉnh sửa mở bảng bên phải, Escape đóng và trả focus; mobile dùng hết chiều rộng. Mỗi khu vực vẫn chỉ có một lịch; form tạo loại khu vực đã có lịch và kiểm tra lại revision trước lưu. Chỉnh sửa lịch đang tạm dừng không tự bật lại. Công tắc chỉ đổi trạng thái sau khi API xác nhận; lỗi giữ dữ liệu và có tải lại. Xung đột revision giữ nháp, người dùng có thể nạp bản mới rõ ràng.

Tab Quy tắc nâng cao giữ tạo phiên bản/mô phỏng hiện có, chọn khu vực ngay trong tab. Lịch định kỳ giữ policy mặc định không auto-apply/auto-publish; chọn policy trong tab không đổi lịch. Nút **Lần chạy** mở 30 lượt gần nhất và Chạy ngay theo khu vực, dùng API operations/run hiện có. Đợt thu thập dành cho campaign; lịch định kỳ có thể sinh run không có campaign, nên không dùng danh sách campaign làm bằng chứng duy nhất của lịch.

Bổ sung GET `/api/v1/admin/catalog/schedules?offset=0` với quyền admin, offset nguyên 0–100000, 50 dòng/trang, response `CatalogScheduleListDto` gồm connected/items/total/hasMore. Chỉ chiếu trường lịch công khai trong DTO; không trả quota/counters. Chỉ đọc scope khu vực có revision > 0 (đã lưu chủ động), bỏ provider-quota và bản mặc định do chạy thủ công. Chuẩn hóa scope legacy hoi-an về destinationId tương thích. GET không tạo/sửa dữ liệu. PUT schedule giữ CAS/idempotency, một lịch/khu vực, giới hạn nguồn và guard vùng tìm hiện có. Không đổi BR, schema/index MongoDB hay registry.

Kiểm tra tập trung: `tests/admin-schedules.spec.ts` dùng API/MongoDB fixture riêng để kiểm persistence, bật/tạm dừng, tạo lịch, xung đột, lỗi đọc/thử lại, mobile và quyền đọc. Ảnh ở `test-results/schedule-evidence/`, không dùng ảnh minh họa hoặc dữ liệu ứng dụng thật làm kết quả kiểm chứng.

Kiểm chứng triển khai: typecheck, lint, build web/API, format và diff check đạt. Lượt browser cuối đạt 2/2 (lịch cập nhật + header), gồm 401/403, offset sai, lưu/tải lại, tạo lịch mới, bật/tạm dừng, xung đột revision, phân trang 12 lịch, lỗi tải/thử lại, desktop 1600px và mobile 390/320px. Đã xem ảnh thực tế. Chưa chạy toàn bộ E2E/integration hoặc gọi provider thật; không sửa database goease. Vite giữ cảnh báo bundle >500KB hiện hữu.

## Header quản trị thống nhất — 25/10/2026

Tất cả trang danh sách/vận hành dùng `AdminTopbar`: biểu tượng theo trang, breadcrumb Quản trị / tên trang, vùng ngữ cảnh, nút mở hàng chờ và tài khoản. Desktop cao80px; mobile giữ hàng tên trang/tài khoản và đưa bộ chọn khu vực xuống hàng riêng khi cần. Editor địa điểm tiếp tục dùng masthead riêng để giữ không gian biên tập.

Tổng quan, Cần kiểm tra, Địa điểm và Tiến trình lấy dữ liệu có **Phạm vi dữ liệu**; Tự động cập nhật dùng nhãn **Lịch theo khu vực**, chọn khu vực trong form hoặc phần mô phỏng; Nguồn dữ liệu ghi rõ **Khu vực của kho địa điểm**, không ngụ ý lọc trạng thái provider toàn hệ thống. Cài đặt, Đợt thu thập và Nhật ký hoạt động dùng nhãn ngữ cảnh, không có bộ chọn không tác dụng. Chuyển Nhật ký sang Việc chờ duyệt hiển thị lại bộ chọn vì hàng chờ theo scope. Scope được giữ khi đổi trang; giao diện không tự ghi settings hoặc chạy nguồn.

Bỏ bộ lọc miền/vùng phụ và ô tìm kiếm toàn danh mục trên header; tìm kiếm/lọc chuyên biệt nằm trong từng trang. Header dùng chung CSS/component, không còn biến thể riêng cho Nguồn/Cài đặt. Test `admin-topbar.spec.ts` duyệt 9 trang trên desktop 1600px và mobile 390/320px, kiểm breadcrumb, phạm vi, kích thước và API tổng quan theo khu vực; ảnh ở `test-results/header-evidence/`. Không thay API/schema/quyền nghiệp vụ.

Kiểm chứng header: typecheck, lint, build client, format và diff check đạt. Lượt browser tập trung cuối đạt 2/2 (header và cài đặt); đã xem ảnh desktop và mobile 320px. Dùng tài khoản fixture và MongoDB test riêng; chưa chạy toàn bộ E2E. Build còn cảnh báo bundle lớn hiện hữu.

## Cài đặt theo tác vụ — 25/10/2026

`/admin#settings` có ba tab: **Tỉnh/thành hiển thị**, **Nhắc kiểm tra dữ liệu**, **Thiết lập nâng cao**. Thanh trên chỉ hiển thị đường dẫn Cài đặt; không có bộ lọc khu vực/tìm địa điểm toàn cục không áp dụng cho danh mục này. Tỉnh/thành dùng công tắc Đang hiển thị/Đang ẩn, giải thích tác dụng bật/tắt tại đầu trang. Không có nút lưu chung cho danh mục; mỗi công tắc lưu riêng với revision/idempotency và xác nhận khi tắt như trước.

Danh mục được đọc đầy đủ qua các trang GET hiện có, rồi lọc tên/mã/khu vực du lịch không dấu, miền và trạng thái ở client. Counts bật/tắt là toàn danh mục đã tải; phân trang mặc định 5 tỉnh/thành, chọn 5/10/20/50 dòng, tính trên tập đã lọc. Đổi bộ lọc hoặc số dòng về trang đầu; tự giới hạn trang khi tập kết quả giảm. Giữ nút trang đầu/cuối, các trang lân cận và dấu “…” cho khoảng xa; mobile thu gọn về đầu/hiện tại/cuối. Trước/sau bị vô hiệu ở biên, trang hiện tại có aria-current và khoảng kết quả được đọc bằng aria-live. Không dựng số 34 hoặc 3 bật từ ảnh. Tải lỗi có thử lại, rỗng có xóa bộ lọc; mobile xếp mỗi dòng thành khối dọc, không dùng khung cuộn bảng lồng nhau.

**Lấy địa điểm** mở luồng CAT-19 hiện có (bao gồm khôi phục request trong phiên). **Xem tiến trình** đi đến `#automatic?destinationId=...`, khởi tạo bộ lọc đợt theo tỉnh và chỉ đọc danh sách; không gọi POST lấy nguồn. Bật tỉnh vẫn tự mở đợt nhập nháp, lỗi nguồn không rollback trạng thái hiển thị. Nhắc kiểm tra và phạm vi nâng cao dùng settings API/CAS hiện có, giữ nháp khi chuyển tab; có nút Lưu cài đặt riêng. Không đổi BR, persistence, quyền, schema hoặc registry.

Kiểm tra tập trung: `tests/admin-settings.spec.ts`, dùng tài khoản/provider fixture và MongoDB riêng. Bao gồm lọc/phân trang, tìm Sa Pa không dấu, mobile320/390, bật Cao Bằng→nháp, reload, xem tiến trình không POST, hủy/xác nhận tắt, lưu nhắc kiểm tra qua reload, lỗi đọc danh mục/thử lại. Ảnh tại `test-results/settings-evidence/`, không commit. Kết quả lệnh được ghi tại bàn giao.

Kiểm chứng: typecheck, lint, build, format các file đổi và diff check đạt. Browser test cài đặt lượt cuối đạt 1/1, test màn nguồn trong lượt trước cũng đạt sau khi chuyển cài đặt sang tab. Đã xem ảnh desktop1600 và mobile320; test kiểm cả390. Không chạy toàn bộ E2E/integration, không bật tỉnh hay nhập dữ liệu vào goease thật. Vite còn cảnh báo bundle >500KB hiện hữu.

## Nguồn, hạn mức và quyền

### Giao diện thẻ nguồn — 25/10/2026

Bổ sung chi tiết nguồn: giải thích Geoapify dùng để tìm địa điểm/tra vùng, dữ liệu mới vào nháp; tình trạng chỉ phản ánh lần gọi gần nhất. Mỗi chỉ số 24 giờ có đơn vị và giải thích, áp dụng toàn hệ thống chứ không phải lượt khách tìm kiếm. `usage24h.received` gồm cả kết quả geocode, không phải số địa điểm mới/lưu/xuất bản. Có đường dẫn đến Đợt thu thập và kho đúng phạm vi. Hạn mức, lưu ý sử dụng và thông tin hỗ trợ đóng mặc định; mã lỗi kỹ thuật nằm trong thông tin hỗ trợ. Không đổi dữ liệu hoặc cách đếm server.

`/admin#sources` dùng bố cục đã duyệt: tab **Các nguồn** / **Chất lượng địa điểm**, thẻ Geoapify với trạng thái thực và lần nhận gần nhất; **Xem chi tiết** mở hoạt động 24 giờ, hạn mức nội bộ, bản quyền và thông tin cấu hình. **Kết nối nguồn** mở hướng dẫn thiết lập server; chưa có API thêm nhà cung cấp tùy ý. Không đưa Nguồn B/C minh họa vào ứng dụng. Các nguồn làm giàu ảnh/giới thiệu/giờ và giá vẫn được theo dõi qua luồng địa điểm và Tiến trình lấy dữ liệu hiện hành.

Nguồn và usage là toàn hệ thống. Kho địa điểm, số cần kiểm tra và vấn đề chất lượng theo khu vực đang chọn. Số kết quả nguồn không phải số địa điểm đã lưu; chất lượng độc lập với publication. Kho hiển thị thêm số lưu trữ khi có để giải thích tổng. Thẻ chưa cấu hình, chưa kiểm chứng, đang gọi, thành công, thiếu quyền và lỗi dùng đúng trạng thái server. Tải nguồn và kho có lỗi/thử lại riêng; không thay lỗi đọc API bằng số 0 hoặc trạng thái thành công cũ.

Chi tiết dùng dialog có giữ focus, Escape đóng và trả focus; tabs hỗ trợ phím mũi tên/Home/End. Mobile xếp thẻ dọc. Làm mới chỉ đọc API, không tự gọi nhà cung cấp hoặc nhập dữ liệu. Không đổi contracts, schema, registry, quota hay quy tắc nghiệp vụ.

Kiểm tra giao diện tập trung: `tests/admin-sources.spec.ts` (response nguồn/kho fixture có nhãn, auth và test server riêng). Ảnh kiểm tra ở `test-results/sources-evidence/`, không commit và không dùng làm bằng chứng provider thật. Kết quả lệnh cuối được ghi tại bàn giao.

Kết quả quan sát: typecheck, lint, build, format các file thay đổi và diff check đạt. Lượt cuối `npm run test:catalog-browser -- --grep 'sources distinguish'` đạt 1/1, bao gồm các trạng thái nguồn, dialog/focus/Escape, tabs, lỗi và retry độc lập, kho rỗng, desktop1600/mobile390/320 không tràn ngang; bỏ mock rồi đối chiếu API test thật và mở Tổng quan/Cài đặt cũng đạt. Test dùng Edge và MongoDB riêng, cổng API3001/web5181, không sửa database ứng dụng. Build giữ cảnh báo bundle >500KB hiện hữu. Hai kiểm tra E2E cũ mở rộng chưa đạt: `V3 operator` dừng ở chờ tổng quan sau đăng nhập; `V3 dashboard` timeout ở ô “Tìm trong danh mục” sau đóng editor, trước khi tới màn nguồn. Không nhận toàn suite đạt và chưa kiểm chứng provider live cho task UI này.

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
