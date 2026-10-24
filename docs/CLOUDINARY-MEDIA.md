# Cloudinary media — 24/10/2026

Theo yêu cầu owner, code mới nhất từ `nyan/admin-operations-v2` được fast-forward vào `main` trước khi chuyển ảnh. Toàn bộ 73 binary ảnh đang được Git theo dõi (56.8 MB thập phân) đã upload: 22 ảnh app và 51 ảnh tài liệu. Không xóa lịch sử Git; ảnh gốc vẫn có thể phục hồi từ commit trước.

## Tổ chức và sử dụng

- Cloud name công khai: `dqc4hufot`. Đích upload luôn nằm trong `goease/`.
- `goease/app`: logo, Goe, avatar mặc định, ảnh chào mừng/điểm đến/khám phá; `goease/app/admin`: PNG gốc và WebP admin.
- `goease/docs/design/...` và `goease/docs/screenshots/...`: concept, gallery và bằng chứng UI trước/sau; giữ cấu trúc nguồn để tìm lại dễ.
- `packages/media/src/index.ts`: `images` cho web/API và `resolveLegacyImageUrl` chỉ ánh xạ đúng các URL local đã biết. URL app dùng `f_auto,q_auto`; bản gốc không biến đổi vẫn giữ riêng trong manifest.
- `packages/media/assets-manifest.json`: 73 mapping sourcePath lịch sử → assetId/publicId/assetFolder/version/URL gốc, byte size, dimensions, SHA-256. Đuôi định dạng nằm trong publicId để PNG và WebP không đè nhau.
- `packages/media/admin-generation-manifest.json`: prompt và ghi nhận ảnh AI, vẫn là minh họa; không thay nguồn hay license của catalog.

Link ảnh tài liệu/gallery đã đổi sang CDN. Test cần avatar giả dùng SVG nội tuyến thay file ảnh local. Các đường dẫn `.local/` và `test-results/` trong tài liệu là bằng chứng lịch sử hoặc đầu ra kiểm thử ignored, không phải asset runtime cần đưa lên CDN.

## Cấu hình và kiểm tra

`server/.env` local chứa `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` lấy từ key hiện có của môi trường đã đăng nhập. Không tạo/đổi key hoặc quyền tài khoản. `.env` được Git bỏ qua; `.env.example` chỉ chứa biến trống. Web và package media chỉ cần URL công khai, không cần secret hoặc upload preset.

```powershell
npm run media:verify
npm run typecheck
npm run lint
npm test
npm run build
```

`media:verify` không cần secret: GET từng URL gốc HTTPS từ đúng Cloudinary cloud/goease, không theo redirect, yêu cầu image content type và so byte size + SHA-256. Tối đa bốn GET song song, có timeout; lỗi bất kỳ làm command thất bại.

`npm run media:upload` là công cụ operator cho ảnh source được Git theo dõi dưới `client/public/images/` hoặc `docs/`. Nó cần cấu hình server; chữ ký SHA-1 theo Upload API, `overwrite=false`, xác minh response folder/publicId/bytes và GET checksum trước khi ghi manifest checkpoint. Chạy lại bỏ qua source không đổi đã có trong manifest; thay nội dung phải dùng tên source phiên bản mới. Công cụ không tự xóa file, sửa code hoặc generate lại module URL. Sau khi upload ảnh mới, thêm export URL công khai vào package media rồi cập nhật consumer; xác minh ảnh trước khi xóa source. Để chạy lại bộ ảnh cũ, phục hồi source từ Git trước, không tải/chèn ảnh riêng tư vào thư mục source.

Nguồn kỹ thuật: [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference), [folder modes](https://cloudinary.com/documentation/folder_modes). Công cụ đặt `asset_folder` riêng với publicId để ảnh nằm đúng folder trong chế độ dynamic folders.

## Catalog và giới hạn

Seed/import/fallback mới dùng CDN. Catalog đã lưu có `/images/...` được dịch khi tạo public/admin DTO; không cần migration MongoDB và không thay revision, nguồn, audit, catalog_versions hay trip snapshots. URL bên ngoài/không biết không bị sửa. `media_assets` vẫn design-only; không thêm endpoint upload avatar/ảnh người dùng, xóa cloud tự động hoặc thay policy lưu dữ liệu.

Ảnh công khai cần mạng tới Cloudinary. Service worker hiện chỉ cache offline reader, không cache ảnh/tiles; chuyến offline tiếp tục đọc nội dung chữ. Việc xóa file khỏi checkout không làm repository history nhỏ đi; không rewrite/purge Git.

## Bằng chứng lần chuyển

- Upload thật 73/73 ảnh, response xác nhận mọi asset_folder/publicId dưới `goease/`; GET từng bản gốc và SHA-256 trùng file nguồn trước khi xóa.
- `npm run media:verify`: PASS 73/73 lần kiểm tra độc lập sau upload; bản gốc trùng SHA-256/byte size. Binary chỉ được xóa sau lần kiểm này và đối chiếu lại hash file local.
- Typecheck, lint, format toàn repo, build: PASS. Build giữ cảnh báo chunk >500 kB có sẵn; chưa deploy public hoặc xác nhận CI GitHub trong lần chuyển này.
- Unit/HTTP: 48/48 PASS, gồm giới hạn folder, collision PNG/WebP, legacy mapping, provider failure sanitization và CDN mismatch/failure.
- MongoDB integration liên quan: 11/11 PASS qua explore + Admin V2, dùng replica set27021 do harness sở hữu. Catalog cũ `/images/explore-hoian.png` trả CDN qua HTTP, trong khi giá trị database vẫn giữ nguyên. Không sửa service27017.
- Browser: 11 kiểm tra liên quan avatar/khám phá/bản đồ/ngân sách/Goe PASS qua các lượt chạy; 2/2 Admin V2 PASS trên API/MongoDB test thật, desktop và zoom125%. Kỳ vọng cũ trong test ngân sách/nhãn AI được cập nhật theo UI/BR hiện hành, không thay đổi tính tiền hoặc nhà cung cấp AI.
- Browser tài khoản mở rộng `customer profile and password persist and revoke other browser sessions`: FAIL timeout90s khi chờ nút “Thử lại đổi mật khẩu”. Trước đó test đã qua lưu/reload/profile conflict và kiểm tra avatar fallback CDN. Không coi bài này hoặc toàn suite E2E là PASS; chưa xác định nguyên nhân phần retry mật khẩu trong task đổi ảnh.
- Đã quan sát trang chủ trên Chrome thật tải logo/Goe/ảnh điểm đến từ CDN; avatar HTTPS riêng của tài khoản giữ nguyên. Cloudinary Console xác nhận `goease` có hai nhánh `app`, `docs`, tổng73 assets. Screenshot bằng chứng local tại `.local/cloudinary-media/cloudinary-folder.png` (ignored).
