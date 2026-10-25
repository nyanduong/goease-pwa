# CAT-20 — Ảnh thật cho địa điểm

## Demo admin

1. Cài đặt → Danh mục tỉnh thành → bật tỉnh → chờ nhập địa điểm → **Kiểm tra bản nháp và xuất bản theo lô**.
2. Chọn một bản nháp chưa có ảnh → **Xem trước xuất bản**. Kết quả đúng: mục bị chặn, lý do **Thiếu ảnh bìa thật đã duyệt**; không xuất bản dù API được gọi trực tiếp.
3. **Chỉnh sửa** địa điểm → phần ảnh → **Ảnh thật từ Wikimedia Commons**. Worker tự tìm, màn hình tự cập nhật khi đang chờ/tìm. Tối đa 6 ứng viên; ảnh gần tọa độ có cảnh báo có thể là địa điểm khác.
4. Mở **trang nguồn và giấy phép**, đối chiếu ảnh đúng địa điểm và điều kiện sử dụng. Bấm **Chọn ảnh thật này làm bìa**, rồi **Lưu đề xuất**. Bản nháp vẫn chưa công khai.
5. Về danh sách → chọn các mục đã kiểm tra → **Xem trước xuất bản** → **Áp dụng … mục đủ điều kiện**. Mục thiếu ảnh vẫn bị chặn; các điều kiện nội dung khác giữ nguyên.
6. Không có ảnh/lỗi nguồn: vẫn là nháp. **Tìm lại ảnh Wikimedia** có khoảng nghỉ 60 giây. Hoặc mở **Quản lý ảnh có quyền sử dụng**, nhập URL HTTPS, tác giả, nguồn, giấy phép và xác nhận ảnh thật/quyền sử dụng. Không dùng ảnh AI để vượt gate.

## Runtime/API

- Provider cố định `https://commons.wikimedia.org/w/api.php`, không cần API key. Tìm tên+tỉnh trong namespace File, sau đó geosearch 500 m nếu kết quả hợp lệ rỗng và có tọa độ. Tối đa 2 request/attempt, timeout 12 s/request, body ≤1 MB, không redirect. Chỉ JPEG/PNG/WebP, media host `upload.wikimedia.org` hoặc `thumb.wikimedia.org`, nguồn `commons.wikimedia.org`.
- Giấy phép Commons hỗ trợ: CC0, Public-domain, CC-BY/CC-BY-SA phiên bản 2.0/2.5/3.0/4.0. Thiếu tác giả/ghi công hoặc giấy phép không hỗ trợ thì bỏ qua. Giữ Attribution nếu có, nếu không dùng Artist; bỏ HTML, không render raw markup. Manual gallery thêm owned/permission có xác nhận admin.
- `GET /api/v1/admin/places/:id/images`: chỉ admin, trả `{state,candidates,message,checkedAt}`. Không tự gọi provider trong GET.
- `POST /api/v1/admin/places/:id/images/search`: chỉ admin; xếp lại pending nếu không có lease sống và lần gần nhất đã quá 60 s. Không ghi dữ liệu client vào candidates.
- Worker poll 5 s, một lượt đang chạy/process, claim atomic + lease 60 s/token; retry 60 s tối đa 3 lần. Kết quả chỉ ghi nếu lease còn hiệu lực và name/destination/revision không đổi. Nếu nội dung đổi trong khi tìm thì xếp lại. Không giữ transaction mở trong lúc gọi mạng.
- `places.imageSearch` là trạng thái nguồn độc lập, không advance editorial revision/updatedAt, không tự lưu đề xuất hoặc audit xuất bản. Chọn/lưu ảnh đi qua catalog write, revision, version và audit hiện có. Publish/restore không khôi phục trạng thái tìm ảnh từ snapshot cũ.
- `places.images` tối đa 8; ảnh đầu làm cover. `reviewed` mặc định false; `licenseUrl` optional. Dữ liệu cũ không tự thành approved. Public loại ảnh chưa duyệt, bỏ AI imageUrl fallback. Ảnh nền chuyến đi/mascot/illustration giao diện không thuộc ảnh POI.
- Không có collection mới, không migration/destructive purge; ảnh AI cũ có thể còn trong snapshot lịch sử nhưng không làm ảnh địa điểm công khai. Seed mới là draft; seed lại không ghi đè nội dung cũ.

## Giới hạn

Wikimedia không bảo đảm có ảnh của mọi POI. Tìm theo tên/tọa độ chỉ gợi ý, có thể sai đối tượng; bộ lọc metadata không chứng minh ảnh không phải AI hoặc quyền hợp lệ. Admin chịu trách nhiệm đối chiếu trang nguồn trước duyệt. Không tải lại file vào kho riêng, không tự theo dõi license thay đổi hoặc thu hồi, không kiểm ảnh hỏng định kỳ. Nếu URL sau này lỗi, UI hiển thị placeholder; gate kiểm metadata đã duyệt, không gọi mạng lúc xuất bản.

Nguồn kỹ thuật: [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), [Geosearch](https://www.mediawiki.org/wiki/API:Geosearch), [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).

## Kiểm chứng

Kiểm thử nguồn dùng fixture có nhãn, không giả ảnh fixture là ảnh địa điểm thật. Live read-only smoke ngày 25/10/2026: Chùa Cầu/Hội An trả 6 ứng viên theo tên; Chùa Cầu/Đà Nẵng trả 6 ứng viên gần tọa độ, đều có nguồn/ghi công/giấy phép; không tự duyệt hoặc xuất bản chúng.

Đã chạy: `npm test` 71/71; typecheck, lint, build; 49 kiểm thử integration liên quan trong admin-v2, catalog-operations, catalog-publication, catalog, explore, hoian, province-import và reschedule (sau cập nhật fixture ảnh, explore/province được chạy lại 13/13); Playwright catalog config 5/5 trên cổng riêng 3016/5196. Mongo test riêng 27021. API ứng dụng health/db trả connected; không chạy migration hoặc seed vào goease.

Tình huống kiểm chứng: block thiếu/chưa duyệt/AI cover; candidate không tự publish; người dùng thường không đọc candidates; retry/cooldown/empty/provider failure/stale revision giữ nội dung; ghi công dài hơn 100 ký tự được lưu; public không lộ imageSearch và không fallback AI cũ; publish/restore không làm mất trạng thái tìm ảnh. Screenshot `.local/national-planner/wikimedia-selected.png` đã xem lại; ảnh trắng 1 px là fixture trình duyệt có nhãn.

Full integration command đã dừng trong stress archive toàn bộ 13.200 mục để chạy bộ liên quan ở trên; không tuyên bố full integration suite hoàn tất. Kiểm thử aggregate 13.200 mục trong catalog-publication đã pass. Build vẫn có cảnh báo bundle client lớn hơn 500 kB.
