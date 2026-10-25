# Dữ liệu demo từ nguồn miễn phí — 26/10/2026

Owner yêu cầu giữ mục tiêu740địa điểm, đối chiếu Google Maps qua website, không dùng dịch vụ tính phí; hỏi xử lý nhiều luồng và sao chép ảnh Google nếu được phép. Đây là checkpoint chưa hoàn thành740mục, không phải nghiệm thu toàn quốc.

## Kết quả đã lưu

- Đã thử đối chiếu bằng3tab Google Maps độc lập. Chỉ14mục có chứng cứ website đã được đọc lại và lưu bền vững trong `google-maps-website-confirmed.json`; không dùng số lượt mở trang làm số xác minh. Các lượt khác chưa có receipt bền vững phải tiếp tục kiểm tra, không suy đã hoàn tất. Không gọi Google Places API/bật billing/tạo key.
- Đã xuất bản Dinh Độc Lập và Công viên Thủ Lệ qua catalog.write(intent=publish), có audit/version và note URL Google Maps. Đọc lại cả2: publicRevision5, proposalRevision=null, bìaHTTP200, discovery/scheduling/budgeting=true. Check Google trong script buộc fingerprint tên,tỉnh,sourceURL,tọa độ không đổi và đủ ảnh thật đã duyệt,giới thiệu,giờ/giá đã duyệt. **Đây là guard của script, chưa phải gate Google toàn bộ API/UI.** Bản public cũ không bị thu hồi hàng loạt.
- Tải dump Wikivoyage chính thức01/10/2026:131.539.958bytes, SHA-256 `1a8f791f1fd1adfc7401c88432e9e0524ad4e4ea660d89aca213c926d56644ed`. Quét80.541page, tách1.347listing trong bounding box Việt Nam; bbox có thể gồm vùng biên nên chưa là xác minh quốc gia.
- Đối chiếu26.469POIOSM theo tên/alias chuẩn hóa và khoảng cách tối đa350m, một listing identity duy nhất:135matches, trong đó26thuộc scope demo;2trường hợp mơ hồ giữ ngoài nhập.
- Biên tập tiếng Việt thủ công từ trích đoạn có giấy phép: **20đề xuất giới thiệu đã lưu**, có nguồn/phiên bản/CC-BY-SA-4.0/audit; **8quan sát giờ/giá** mới giữ reviewed=false. Không ghi đè nội dung đã có/public/khóa; không lấy giá cũ trong listing làm giá ngân sách. Hai mục public cũ và dữ liệu nguồn chính thức hiện có được giữ.
- Rà hết183mục trong scope có website gợi ý bằng3worker riêng:42giữ quan sát đã có,53nguồn không đọc được,38chưa xác nhận tên cơ sở,36link xã hội/không hỗ trợ,8không có trường giờ/giá phù hợp,6public/khóa được giữ. **Không có quan sát mới được lưu từ lô website này.** Đây không phải183địa điểm đã hoàn thiện; thông tin có thể nằm trong ảnh/PDF/menu hoặc trang không hỗ trợ parser. Journal `demo-website-journal.ndjson`, kết quả `demo-website-progress.json`.
- Toàn database đọc lại02:37giờViệtNam có13published;2trong số đó được tác vụ này xuất bản. Đây không phải13mục đã hoàn thiện mới trong scope740.

## Không phát sinh lời gọi dịch AI cho đợt nhập

Thêm server config `DESCRIPTION_TRANSLATION_ENABLED`, enum true/false mặc địnhfalse; local và .env.example=false. Khi tắt, descriptionTranslator trả null trước cả reserve quota hoặc HTTP provider, kể cả có credentials. Bài tiếng Anh tự tìm sẽ giữ needs_translation, không giả thành tiếng Việt. Các bản dịch/biên tập trong đợt nhập do agent thực hiện trực tiếp, không gọi Gemini/FULLDICHVU API. Không thay cấu hình planner khách hàng.

UI ghi công phân biệt `en.wikivoyage.org` với Wikipedia thay vì gắn mọi nguồn là Wikipedia. Không thêm collection/fieldMongo/DTO mới. Dictionary/registry tiếp tục dùng descriptionSource hiện có; bổ sung ý nghĩa nguồn, không đổi giấy phép.

## Ảnh và giới hạn nguồn

Chưa sao chép ảnh Google. Việc nhìn thấy ảnh trên Maps không chứng minh quyền tái sử dụng. Với ảnh Google cần quyền của chủ ảnh/nguồn cấp phép phù hợp và tuân thủ điều kiện nguồn; không mặc định tải lênCloudinary. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) cũng giới hạn lưu trữ nội dungAPI; đợt này không dùngAPIđó. Ảnh nguồn mở kiểm riêng giấy phép/tác giả và đúng địa điểm. Chưa upload thêm ảnh hoặc gọi sinh ảnh trả phí trong đợt này.

Google Maps có thể dùng tên địa phương cũ; dùng cụm du lịch/thành phố cụ thể thay vì chỉ tên tỉnh mới khi tìm. Mục cùng tên/nhiều chi nhánh, khác vị trí, địa chỉ mơ hồ hoặc không tiếp cận công khai chưa được coi đủ điều kiện. Ví dụ Phủ Chủ tịch chỉ xác nhận công trình tồn tại, không xác nhận được tham quan bên trong. Một số tênOSMlà mô tả/chung chung như “Restaurant that doesn't serve wester people.”, “Gardens by the locals”; cần thay ứng viên hoặc nghiên cứu trước khi nhập nội dung. Không dùng mô tả mẫu để lấp đủ740.

Một lô browser vượt60giây khiến runtime mất state; chỉ giữ số có receipt thật, không dựng lại chứng cứ cho các kết quả đã mất. Chia lô nhỏ và checkpoint sau mỗi lô là phần vận hành cần tiếp tục cải thiện. Website matching hiện không phải daemon tự chạy sau khi kết thúc lượt.

## Bằng chứng

Kiểm chứng code: typecheck toànrepo đạt,110/110unit tests đạt,lint đạt,build toànrepo đạt; sau đổi nhãn ghi công trong editor đã build client và lint lại đều đạt. Build còn cảnh báo kích thước chunk có sẵn. Không chạy lại browserE2E hoặc toàn bộ integration trong lượt này. Bảng tác nghiệp tạm trong client/public đã được gỡ khỏi source và bản build; chỉ manifest/receipt ignored còn giữ. Chưa commit/push.

Đọc lại scope740lúc02:42giờViệtNam:13public,64có ứng viên bìa,39có giới thiệu,10có giờ đã duyệt,8có giá đủ điều kiện planner,14có chứng cứ Maps còn khớp context,5qua đầy đủ các flag cơ bản. Số bìa/flag không xác nhận mọi ảnh đúng hoặc quyền tiếp cận, không dùng để publish tự động. Đã kiểm đủ20source version/audit cho các giới thiệu mới. `demo-free-verification.json` giữ từng mục và các trường thiếu.

Thư mục ignored `.local/manual-tourism-import-20261025` giữ:

- `google-maps-website-confirmed.json`, `demo-confirmed-publications.json`.
- `wikivoyage-dump-status.json`, `wikivoyage-extraction.json`, `wikivoyage-place-matches.ndjson`, `wikivoyage-demo-matches.ndjson`, `wikivoyage-match-summary.json`.
- `wikivoyage-demo-vi.json`, `wikivoyage-demo-import-journal.ndjson`, `wikivoyage-demo-import-results.json`.
- Snapshot bản gốc và các script tiếp tục/đối chiếu; không commit binary/credentials vàoGit.

Nguồn: [dump chính thức](https://dumps.wikimedia.org/enwikivoyage/latest/), [Wikivoyage copyleft](https://en.wikivoyage.org/wiki/Wikivoyage:Copyleft). Giá/giờ listing là dữ liệu có thể cũ, không trở thành đã xác minh vì vừa tải file. Chưa kiểm thử Goe1–2ngày cho34tỉnh; chưa hoàn thiện bìa/giờ/giá/Maps cho740mục.

## Tiếp tục đối chiếu miễn phí — 03:01 ngày26/10/2026

Owner tiếp tục cho phép tìm nhiều luồng và xuất bản mục đủ điều kiện. Dùng3tab Maps độc lập và2nhánh nghiên cứu nguồn chính thức; không gọi Google Places API, không bật billing, không gọi API dịch hoặc sinh ảnh trả phí. Không tải ảnh Google lên kho.

- Lưu thêm6đối chiếu danh tính: Tháp Đôi Quy Nhơn, Khám Lớn Cần Thơ, Cầu Rồng, Bảo tàng Điêu khắc Chăm, Precious Heritage/Di Sản Vô Giá và Bảo tàng Chứng tích Chiến tranh. Tổng receipt còn khớp context:20. Tháp Đôi có kết quả đường phố/trạm xe buýt/cơ sở trùng tên; chỉ chấp nhận khu tháp tại tọa độ OSM hiện có. Cầu Rồng là geographic feature, không phải listing có bảng giá/giờ. Receipt không lưu ảnh/review/địa chỉ/tọa độ lấy từ Google; fingerprint dùng dữ liệu GoEase hiện có.
- Đã xem3bìa Commons và lưu duyệt có version/audit: Tháp Đôi, Khám Lớn, Bảo tàng Lịch sử Quân sự cơ sở mới. Khám Lớn vẫn chưa có cover Cloudinary được xác nhận; không mặc định một source image là đã sao lưu.
- Sửa giới thiệu Khám Lớn: trước đó tự ghép nhầm bài Wikipedia về thành phố Cần Thơ. Thay bằng đoạn biên tập các sự kiện lịch sử từ [cổng du lịch Cần Thơ](https://mycantho.vn/vi/khamloncantho), xóa descriptionSource của bài sai và khóa nội dung đã biên tập. Giữ bản nháp: chưa xác nhận phí/ngày nghỉ/lịch nghỉ trưa bằng nguồn vận hành. Không lấy mức phí Bảo tàng tại1Hòa Bình áp sang di tích8NgôGiaTự.
- **Xuất bản mới1mục:** Bảo tàng Lịch sử Quân sự Việt Nam, revision/publicRevision5, proposalRevision=null. Ảnh Commons cơ sở mới đã xem, HEAD200; Google proof khớp tên/tỉnh/nguồn/tọa độ. Giờ thường `Tu-Th,Sa-Su 08:00-11:30,13:00-16:30; Mo,Fr off`; phí40.000đ/người/lượt theoTT90/2025/TT-BTC, giữ điều kiện miễn/giảm, thời lượng180phút là ước tính GoEase. Không áp miễn phí cuối2024 hoặc kỳ lễ đã qua cho ngày thường. Nguồn [Chính phủ](https://xaydungchinhsach.chinhphu.vn/tu-1-11-bao-tang-lich-su-quan-su-viet-nam-vi-tri-moi-mo-cua-don-khach-mien-phi-tham-quan-119241004184508454.htm), [Công báo TT90](https://congbao.chinhphu.vn/van-ban/thong-tu-so-90-2025-tt-btc-46276/59090.htm), [đơn vị](https://btlsqsvn.mod.gov.vn/tham-quan). Đọc lại version/audit và discovery/scheduling/budgeting=true. Không thêm upload ảnh hoặc lời gọi trả phí để xuất bản mục này.
- Giữ Tháp Đôi là nháp, ghi cảnh báo mức20.000đ trong Wikivoyage/blog có thể đã cũ. Nguồn thứ cấp dẫn NQ09/2025/NQ-HĐND Gia Lai ghi30.000đ; chưa đọc được PDF chính thức để duyệt giá và chưa có lịch mở cửa đủ rõ. [Metadata Công báo](https://congbao.gialai.gov.vn/congbao/congbao.nsf/ThuocTinh?ParentUNID=DCA50D23D663FEBB88258D400004A476&openForm=). Không dùng số lần các blog lặp lại làm bằng chứng giá đúng.

Đọc lại scope740lúc03:00: **14đang public**,66có ứng viên bìa,41có giới thiệu,11có giờ đã duyệt,9có giá đủ điều kiện planner,20có chứng cứ Maps.9mục qua flags cơ bản, nhưng flags không thay thế duyệt đúng ảnh/tiếp cận/bản đề xuất; ví dụ proposal Bảo tàng Đà Nẵng vẫn cần đối chiếu ảnh cơ sở cũ.13public đã có trước lượt tiếp tục này, không báo thành14mới xuất bản. Không có draft khác qua đủ flags tại checkpoint này.

Toàn database14public/26.552draft,34tỉnh/thành vẫn bật. Job toàn quốc vẫn là26.566mục, chưa đổi thành job riêng740; đọc trạng thái running không chứng minh740đang được browser tự đối chiếu. Các nhánh browser/nghiên cứu không tiếp tục sau khi kết thúc lượt. Không cam kết thời gian hoàn tất740 khi thiếu nguồn xác nhận/ảnh được phép dùng.

[Điều khoản Google Maps website](https://www.google.com/help/terms_maps/) có giới hạn sao chép/tải hàng loạt; miễn phí truy cập không phải giấy phép nhập toàn bộ nội dung và ảnh thành kho riêng. Maps dùng đối chiếu danh tính; mô tả, ảnh, giờ và giá cần bằng chứng cùng quyền sử dụng thích hợp. Không giảm tiêu chí xuất bản để lấp đủ740.

Bằng chứng mới trong thư mục ignored: `continued-free-review.json` (lần chạy cuối là idempotent), `free-review-final-readback.json` (đọc lại3mục), `military-free-publication.json`, `google-maps-website-confirmed.json` (20receipt), `demo-free-verification.json`, `national-enrichment-live-status.json`. Script lưu proof cũ đã đổi sang merge theo ID để không xóa receipt mới hoặc cập nhật giả ngày kiểm tra. Kiểm tra source-version lấy phiên bản nhập đầu tiên, tránh coi publication version mới là thiếu audit proposal. Các kiểm tra dữ liệu đều đã chạy; không thay runtime/schema/BR trong lượt tiếp tục nên không chạy lại toàn bộ application tests.
