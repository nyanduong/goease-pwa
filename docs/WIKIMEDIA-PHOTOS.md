# CAT-20 — Ảnh thật cho địa điểm

## Demo admin

1. Cài đặt → Danh mục tỉnh thành → bật tỉnh → chờ nhập địa điểm → **Kiểm tra bản nháp và xuất bản theo lô**.
2. Chờ ảnh được lưu Cloudinary. Ảnh đầu tiên tự làm bìa cho draft chưa có ảnh; tối đa 6 ứng viên, không đảm bảo đủ 6.
3. Mở **Chỉnh sửa → Ảnh địa điểm**. Bìa hiện tại có nhãn **Ảnh bìa**. Muốn đổi: bấm ảnh khác → **Dùng làm ảnh bìa** → **Lưu đề xuất**. Thông tin tác giả/giấy phép thu gọn trong **Thông tin ảnh**.
4. Về danh sách → chọn mục → **Xem trước xuất bản** → **Áp dụng … mục đủ điều kiện**. Có bìa mặc định thì không cần duyệt ảnh riêng; thiếu ảnh hoặc thiếu điều kiện khác vẫn bị chặn.
5. Không có ảnh/lỗi nguồn: vẫn là nháp. **Tìm ảnh khác** có khoảng nghỉ 60 giây. Hoặc bổ sung ảnh thủ công trong **Ảnh đã chọn**. Không tự xuất bản hoặc dùng ảnh AI thay thế.

## Runtime/API

- Provider cố định `https://commons.wikimedia.org/w/api.php`, không cần API key. Tìm tên+tỉnh trong namespace File, sau đó geosearch 500 m nếu kết quả hợp lệ rỗng và có tọa độ. Tối đa 2 request/attempt, timeout 12 s/request, body ≤1 MB, không redirect. Chỉ JPEG/PNG/WebP, media host `upload.wikimedia.org` hoặc `thumb.wikimedia.org`, nguồn `commons.wikimedia.org`.
- Giấy phép Commons hỗ trợ: CC0, Public-domain, CC-BY/CC-BY-SA phiên bản 2.0/2.5/3.0/4.0. Thiếu tác giả/ghi công hoặc giấy phép không hỗ trợ thì bỏ qua. Giữ Attribution nếu có, nếu không dùng Artist; bỏ HTML, không render raw markup. Manual gallery thêm owned/permission có xác nhận admin.
- `GET /api/v1/admin/places/:id/images`: chỉ admin, trả `{state,candidates,message,checkedAt,defaultCover}`. Không tự gọi provider trong GET.
- `POST /api/v1/admin/places/:id/images/search`: chỉ admin; xếp lại pending nếu không có lease sống và lần gần nhất đã quá 60 s. Không ghi dữ liệu client vào candidates.
- Worker poll 5 s, một lượt đang chạy/process, claim atomic + lease 120 s/token; retry 60 s tối đa 3 lần. Kết quả chỉ ghi nếu lease còn hiệu lực và name/destination/revision không đổi. Nếu nội dung đổi trong khi tìm thì xếp lại. Không giữ transaction mở trong lúc gọi mạng.
- Cloudinary dùng cấu hình server hiện có CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET. Tải thumbnail Wikimedia tối đa 8 MB, 15 s, không redirect; chỉ raster JPEG/PNG/WebP, 36 triệu pixel, không animation. Re-encode WebP quality85, giữ tỷ lệ, tối đa1280x1280, bỏ metadata file. Upload ký server timeout30s vào `goease/places/wikimedia/<sha256-content>` với overwrite=false để retry không tạo asset trùng. Validate secure_url đúng cloud/host/path trước lưu. Tối đa6 ảnh chạy song song; lỗi một ảnh loại ảnh đó, tất cả lỗi báo failed/retry; không dùng link gốc thay thế. Giữ sourceUrl/credit/license/licenseUrl ở dữ liệu ứng viên và ảnh đã chọn.
- `imageSearch.storageVersion=1` đánh dấu luồng lưu Cloudinary. Khởi tạo API xếp lại quan sát cũ chưa có version, bỏ ứng viên link gốc, không thay ảnh đã chọn/revision/publication. Không can thiệp lease còn sống; worker nhận lại lease hết hạn. DTO admin thêm photoSearch `{state,count}`; không có field này trong public DTO hoặc input editor.
- `places.imageSearch` là trạng thái nguồn độc lập, không advance editorial revision/updatedAt, không tự lưu đề xuất hoặc audit xuất bản. Chọn/lưu ảnh đi qua catalog write, revision, version và audit hiện có. Publish/restore không khôi phục trạng thái tìm ảnh từ snapshot cũ.
- `places.images` tối đa 8; ảnh đầu làm cover. `reviewed` mặc định false; `licenseUrl` optional. Dữ liệu cũ không tự thành approved. Public loại ảnh chưa duyệt, bỏ AI imageUrl fallback. Ảnh nền chuyến đi/mascot/illustration giao diện không thuộc ảnh POI.
- Không có collection mới, không migration/destructive purge; ảnh AI cũ có thể còn trong snapshot lịch sử nhưng không làm ảnh địa điểm công khai. Seed mới là draft; seed lại không ghi đè nội dung cũ.

## Giới hạn

Wikimedia không bảo đảm có ảnh của mọi POI. Tìm theo tên/tọa độ chỉ gợi ý, có thể sai đối tượng; bộ lọc metadata không chứng minh ảnh không phải AI hoặc quyền hợp lệ. Admin chịu trách nhiệm đối chiếu trang nguồn trước duyệt. Không tự theo dõi license thay đổi/thu hồi hoặc ảnh hỏng định kỳ. Nếu URL Cloudinary sau này lỗi, UI hiển thị placeholder; gate kiểm metadata đã duyệt, không gọi mạng lúc xuất bản. Asset chưa được chọn hoặc upload thành công nhưng mất lease có thể còn trong Cloudinary; chưa triển khai purge, không tự xóa ảnh được dùng chung. Manual gallery ngoài luồng Wikimedia vẫn giữ cơ chế quyền sử dụng hiện có.

Nguồn kỹ thuật: [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), [Geosearch](https://www.mediawiki.org/wiki/API:Geosearch), [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).

Lưu Cloudinary theo [Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference): signed upload, deterministic public_id và overwrite=false.

## Kiểm chứng

Kiểm thử nguồn dùng fixture có nhãn, không giả ảnh fixture là ảnh địa điểm thật. Live read-only smoke ngày 25/10/2026: Chùa Cầu/Hội An trả 6 ứng viên theo tên; Chùa Cầu/Đà Nẵng trả 6 ứng viên gần tọa độ, đều có nguồn/ghi công/giấy phép; không tự duyệt hoặc xuất bản chúng.

Đã chạy: `npm test` 71/71; typecheck, lint, build; 49 kiểm thử integration liên quan trong admin-v2, catalog-operations, catalog-publication, catalog, explore, hoian, province-import và reschedule (sau cập nhật fixture ảnh, explore/province được chạy lại 13/13); Playwright catalog config 5/5 trên cổng riêng 3016/5196. Mongo test riêng 27021. API ứng dụng health/db trả connected; không chạy migration hoặc seed vào goease.

Tình huống kiểm chứng: block thiếu/chưa duyệt/AI cover; candidate không tự publish; người dùng thường không đọc candidates; retry/cooldown/empty/provider failure/stale revision giữ nội dung; ghi công dài hơn 100 ký tự được lưu; public không lộ imageSearch và không fallback AI cũ; publish/restore không làm mất trạng thái tìm ảnh. Screenshot `.local/national-planner/wikimedia-selected.png` đã xem lại; ảnh trắng 1 px là fixture trình duyệt có nhãn.

Full integration command đã dừng trong stress archive toàn bộ 13.200 mục để chạy bộ liên quan ở trên; không tuyên bố full integration suite hoàn tất. Kiểm thử aggregate 13.200 mục trong catalog-publication đã pass. Build vẫn có cảnh báo bundle client lớn hơn 500 kB.

### Kiểm chứng bổ sung Cloudinary

Sau cập nhật lưu ảnh: 74 unit tests pass; 31 integration checks trong catalog-operations, place-import và province-import pass qua các lượt cuối (fixture publish cũ được bổ sung ảnh duyệt); 5/5 Playwright catalog tests pass với fixture URL Cloudinary, kiểm src của ảnh ứng viên, chọn/lưu/xuất bản. Typecheck/lint/build pass, cảnh báo bundle cũ còn. Đã xem screenshot tổng quan có dòng số ảnh/trạng thái.

Live: signed upload ảnh Wikimedia thành công vào Cloudinary; Bắc Bộ Phủ có 6 ứng viên Cloudinary trong MongoDB, HEAD ảnh lưu trả200 image/webp. Worker đang xử lý lại các quan sát cũ trong goease; không tự chọn bìa/xuất bản. Không có ảnh đã chọn dùng link Wikimedia tại thời điểm kiểm tra. Lưu Cloudinary đã được chủ sản phẩm yêu cầu, không còn là live read-only smoke của mốc trước.

Giao diện chọn ảnh: ảnh đầu tiên làm bìa mặc định; bấm ảnh khác rồi **Dùng làm ảnh bìa** để thay. **Ảnh địa điểm** chứa toàn bộ ứng viên và quản lý ảnh đã chọn. Chi tiết tại [ADMIN-EDITOR.md](ADMIN-EDITOR.md).

## Bổ sung ảnh bìa mặc định — 25/10/2026

Owner cập nhật CAT-20: tự chọn ảnh đầu tiên cho draft chưa có ảnh và không khóa images; admin đổi ảnh bằng **Dùng làm ảnh bìa**, không cần bước duyệt riêng. Thông tin ảnh trong editor thu gọn; giữ metadata và ghi công public. Thay các hướng dẫn duyệt thủ công bắt buộc ở phần trước.

Schema đã triển khai: photo.selection optional enum automatic/admin; reviewed vẫn là boolean, không tự gán true cho ảnh tự chọn. imageSearch.defaultCover photo|null giữ ảnh đầu tiên ổn định qua retry. Backfill ứng viên Cloudinary cũ khi thiếu defaultCover, không đổi editorial revision/publication. DTO draft và bulk áp dụng defaultCover khi images rỗng, không khóa; save/publish lưu vào snapshot. Ảnh đã chọn và public không bị thay. GET images bổ sung defaultCover để form đang mở cập nhật khi worker hoàn tất. Gate chấp nhận selection automatic/admin hoặc reviewed=true, metadata hợp lệ và không phải AI. Không tự xuất bản.

Cập nhật tương tác ảnh: nút **Chọn làm bìa** trên thumbnail chọn ngay trong form; **Lưu đề xuất** giữ thay đổi. Bấm trực tiếp thumbnail chỉ mở ảnh lớn trên nền tối, không có khung/thông tin/nút chọn ảnh trong viewer. Bấm ngoài, × hoặc Escape để đóng và giữ bìa hiện tại. Thay các hướng dẫn chọn ảnh qua hộp thoại ở trên. Đã kiểm tra component thật trên trình duyệt desktop/mobile với API ảnh fixture, không khởi tạo DB test do giới hạn dung lượng ổ đĩa.
