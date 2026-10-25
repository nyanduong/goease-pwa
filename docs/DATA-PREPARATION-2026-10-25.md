# Chuẩn bị ảnh, hoàn thiện dữ liệu và bản sao lưu — 25/10/2026

Owner muốn hoàn thiện dữ liệu trước khi xuất bản hàng loạt, kiểm thử customer, rồi giữ một file để khôi phục dữ liệu khi triển khai. Chưa thực hiện clear database hoặc xuất bản hàng loạt.

## Kiểm tra thực tế lúc 22:30 Việt Nam

Tổng 26.566 địa điểm, gồm 26.469 bản nháp OSM mới và 97 mục có sẵn. Tại thời điểm đọc có 1 ảnh bìa đã chọn, 87 bìa tự tìm có metadata hợp lệ, 26.478 mục chưa có bìa, 26.494 thiếu giới thiệu, 23.058 thiếu ghi chú giờ và 26.566 chưa có referencePrice đủ dùng. Chỉ 1 mục qua kiểm tra field xuất bản; số này chưa kiểm các gate tỉnh/ngoại lệ và gồm cả mục đã công khai. Không coi là đã hoàn chỉnh dữ liệu.

Hàng đợi ảnh: 26.430 pending, 38 ready, 22 empty, 76 failed; 71 lỗi tại bước lưu Cloudinary. Số liệu thay đổi khi worker chạy. Kiểm tra chỉ đọc tài khoản Cloudinary thành công, chưa chạm hạn mức credits tại thời điểm kiểm tra. Một lượt chẩn đoán ảnh của Khám Lớn Cần Thơ lấy được 6 ứng viên, thử lưu 1 raster gốc qua luồng WebP lossless hiện có thành công (6.556.030 bytes, HTTP 200). Đây không phải bằng chứng nguyên nhân của mọi lỗi hoặc bảo đảm mọi ảnh khác sẽ thành công. Không giảm độ phân giải/đổi sang ảnh nhỏ để vượt lỗi.

## Hàng đợi bổ sung

Các bản nháp nhập tay chưa có observation giới thiệu/giờ/giá vì startup prepare hiện chỉ chọn source.provider=geoapify. Tác vụ một lần đã xếp 26.469 mục OSM này vào descriptionSearch và visitSearch phiên bản 3 hiện có, chỉ khi observation chưa tồn tại và không khóa description. Giới hạn rõ vào marker đợt nhập 20261025 + sourceUrl OSM hợp lệ + trạng thái draft. Đã xếp lại 72 mục draft lỗi lưu ảnh Cloudinary một lượt; không can thiệp mục đang có lease chạy, không thay ảnh đã chọn/defaultCover và không tự xác nhận nội dung.

Đây chỉ là dữ liệu observation của worker hiện có: không tăng revision nội dung, không đổi giá/giới thiệu công khai, không tự xuất bản, không fake source.provider=geoapify. API phải tiếp tục chạy để worker xử lý. Không cam kết mọi nơi sẽ tìm được giới thiệu, ảnh, giờ hoặc giá; còn thiếu thì giữ trạng thái thật để admin bổ sung. Tiến trình giờ/giá hiển thị được các mục đã có visitSearch.

Ở thời điểm thao tác dữ liệu ban đầu, chưa tạo ảnh AI hoặc thay gate trong source code. Quy tắc ảnh được cập nhật ở bước triển khai tiếp theo bên dưới. Ảnh gen không xác minh giờ/giá/diện mạo ngoài thực tế.

## Một file sao lưu đã kiểm chứng

File local ignored: `.local/manual-tourism-import-20261025/snapshot-20261025-1792942521825/goease-catalog-draft-20261025-1792942521825.zip`.

- Kích thước 12.687.349 bytes.
- SHA-256 `d5213fa257ecfca20248ec18b22454ad4a8a22d2b200f58ae69e8c31edd0232e`.
- Manifest ghi **DRAFT_BASELINE_NOT_DEPLOY_READY**. Đây là bản sao trước khi hoàn thiện, không phải bản dữ liệu xuất bản cuối cùng.
- MongoDB BSON nén và metadata/index cho destinations (35, gồm 34 tỉnh và legacy), places (26.566), catalog_versions (26.569), catalog_settings (0), catalog_reviews (26.567), catalog_decisions (1), catalog_policies (0), audit_logs chỉ category catalog (26.637).
- Không đóng gói users/auth identities/sessions/challenges, trips, expenses, shares, idempotency receipts, provider credentials hoặc lịch/campaign tự động. Các actor ID lịch sử chỉ là tham chiếu; không mang tài khoản đăng nhập sang môi trường khác.
- Giữ URL Cloudinary và metadata tác giả/giấy phép; không chứa binary ảnh. Cần giữ tài khoản và asset Cloudinary để link tiếp tục hoạt động.

Đã mongodump, mongorestore vào namespace kiểm tra mới độc lập, đối chiếu số lượng từng collection, các ID/revision/destination/sourceURL và trạng thái xuất bản của toàn bộ places đều khớp. Database kiểm tra được tạo riêng cho lượt này và dọn sau kiểm chứng; `goease` không bị clear hoặc restore đè. Bản sao lưu hoàn tất trước khi xếp thêm hàng đợi bổ sung; observation mới sau đó chưa nằm trong file này.

Sau khi dữ liệu/ảnh cuối cùng được duyệt và customer kiểm thử xong, cần xuất file mới, kiểm hash, thử restore lại và tái kiểm khả năng mở URL ảnh. Clear dữ liệu ứng dụng chỉ là bước sau cùng được yêu cầu riêng, không phải điều kiện để chạy thử restore.

Lượt thao tác dữ liệu ban đầu không thay source code, schema/index hoặc BR. Kiểm chứng của lượt đó là đọc database, một lượt lưu ảnh qua provider, dump/restore ở namespace riêng và đối chiếu dữ liệu đầy đủ. Chưa xác nhận toàn bộ địa điểm có dữ liệu hoàn chỉnh hoặc sẵn sàng deploy.

## Triển khai quy tắc ảnh sau lựa chọn của owner

Owner chọn giữ chất lượng ảnh gốc lossless và chấp nhận dung lượng trả phí; chưa mua hoặc nâng gói Cloudinary. Giữ pipeline raster gốc sang WebP lossless, không resize. Mỗi địa điểm có tối đa 5 ảnh thật; khi chưa có ảnh thật có thể chọn 1 ảnh minh họa AI làm bìa, không trộn hai loại. Đây là hỗ trợ nhập metadata và hiển thị, chưa tích hợp bộ tạo ảnh AI hàng loạt.

Contract và MongoDB subdocument lưu `images.kind` (`photo` hoặc `ai_illustration`, optional cho dữ liệu cũ). AI cần quyền sử dụng owned/permission và xác nhận của admin; không mạo danh giấy phép Wikimedia. Admin chọn loại ảnh trong phần Ảnh đã chọn, nhập URL HTTPS và nguồn/bằng chứng quyền sử dụng. Customer thấy nhãn **Ảnh minh họa AI**. Ảnh thật có ưu tiên khi đọc bản nháp không khóa; nội dung đã xuất bản hoặc trường ảnh đã khóa giữ nguyên đến khi được sửa có chủ đích. Giới hạn raw MongoDB cũ được giữ để đọc dữ liệu legacy, không chạy migration xóa ảnh.

Đã cập nhật CAT-20, contract, data dictionary, registry và traceability. Typecheck, lint, build đạt; build còn cảnh báo chunk client lớn hơn 500 kB. Hai kiểm thử đơn vị về quyền/giới hạn ảnh và một kiểm thử MongoDB về lưu, xuất bản, snapshot phiên bản, ưu tiên ảnh thật và khóa ảnh đều đạt. Kiểm thử snapshot phiên bản không thay thế phép thử dump/restore toàn bộ dữ liệu cuối cùng. Chưa xuất bản hàng loạt, chưa clear database, chưa tạo ảnh AI cho tập dữ liệu.

Kiểm thử browser đã đi qua lưu/xuất bản API và thấy nhãn/alt ảnh AI, nhưng thất bại ở kiểm tra tràn ngang màn hình 320 px do hàng place-meta chưa xuống dòng. Đã thêm flex-wrap; chưa xác nhận lại bằng browser và chưa chạy tới bước nhập ảnh trong editor: các lượt khởi động MongoDB kiểm thử tiếp theo thất bại khi ổ C còn khoảng 9–18 MB trống. Lệnh dọn các thư mục MongoDB tạm của chính lượt kiểm thử bị bộ phê duyệt tự động chặn (blocked by policy), nên không thực hiện xóa. Các kiểm thử browser chưa đạt không được tính vào kết quả kiểm chứng hoàn tất.

## Chốt tiếp: một bìa lưu riêng và bốn link nguồn

Đã triển khai [ONE-COVER-MEDIA](ONE-COVER-MEDIA.md): worker v3 upload một bìa lossless rồi dừng, tối đa bốn ảnh bổ sung dùng link nguồn; giữ metadata storage/originalUrl và ghi công. Đổi bìa từ nguồn Wikimedia sẽ cache trước khi ghi đề xuất, giữ hash idempotency theo payload gốc; retry receipt không upload lại. Gate xuất bản chặn bìa đã đánh dấu source chưa được lưu. Gallery khách ẩn ảnh tải lỗi. Giữ quan sát v2 và ảnh legacy, không xóa asset cũ hoặc tải lại hàng loạt.

Đã quan sát typecheck/lint/build đạt và toàn bộ 103 kiểm thử đơn vị đạt, gồm kiểm soát upload đúng một bìa, giữ pixel lossless, bốn link nguồn, đổi bìa, không upload lại bìa đã cache, nguồn không an toàn, provider thất bại, metadata giả và readiness bìa chưa sao lưu. Build vẫn có cảnh báo chunk client lớn. Kiểm thử MongoDB mới bổ sung cho idempotency/metadata/failure-before-write và browser chưa chạy lại do ổ C chỉ còn khoảng 180 MB; kết quả MongoDB của bước chính sách AI trước đó không chứng minh các nhánh mới này. Chưa có live upload Cloudinary trong bước thay đổi chính sách một bìa. Chưa hoàn thiện toàn bộ dữ liệu/ảnh, chưa xuất bản hoặc clear hàng loạt.

## Kiểm chứng sau khi owner giải phóng ổ C

Ngày 25/10/2026, quan sát ổ C trống khoảng 132 GiB rồi tiếp tục phần kiểm thử bị chặn:

- `catalog-image-policy.integration.ts` đạt: AI qua lưu/xuất bản/public/version; ảnh thật thay fallback draft, public và khóa giữ nguyên; metadata bìa Cloudinary + ảnh nguồn được lưu; replay cùng idempotency key không gọi upload thêm; provider lỗi không tạo địa điểm.
- `province-import.integration.ts` đạt 13/13 (gồm subtests): nhập tỉnh, retry, default cover ổn định, xếp lại observation legacy sang v3, publish lô và bảo vệ nội dung đã xuất bản.
- Hai browser tests trong `media-policy.spec.ts` đạt: nhãn/alt AI, không tràn ngang ở 1440/390/320 px, admin thêm đúng một AI và không thêm AI thứ hai; link gallery bị abort thì ẩn ảnh đó, bìa Cloudinary vẫn hiện. Đã xem screenshot 320 px sau sửa flex-wrap.
- Server typecheck, tools typecheck, lint và diff check đạt. Không cần thay source để sửa lỗi mới trong bước kiểm chứng này; thêm browser regression cho link ảnh lỗi.

MongoDB kiểm thử dùng replica set riêng cổng 27021; web/API test 5181/3001. Không clear dữ liệu ứng dụng hoặc xuất bản hàng loạt. Các provider ảnh trong test là fixtures; chưa coi đây là live upload Cloudinary hoặc kiểm chứng đầy đủ toàn bộ ảnh du lịch. Chặn dung lượng cho các kiểm thử trên đã được giải quyết.
