# Goe companion — kế hoạch và nghiệm thu

Ngày: 28/10/2026. Nhánh: `V2-ui-customer`. Phạm vi: frontend demo; không sửa server, contracts, dữ liệu hoặc khóa API.

## Khảo sát

- React 19 + Vite + TypeScript. CSS theo lớp customer riêng; không có PixiJS/animation framework.
- Backend Express/TypeScript + MongoDB. `GoeChat` đã có API POST `/trips/:id/goe-proposal` và `/trips/:id/goe-apply`, bảo toàn bước xem trước/xác nhận.
- Provider hiện dùng JSON request/response (`stream: false`), chưa có SSE. Không mô phỏng streaming hoặc dùng timer giả để kết thúc AI.
- AI hiện điều chỉnh một ngày của chuyến có sẵn; tạo lịch mới qua `AiPlanner`. Chưa có endpoint chat du lịch tổng quát. Không biến câu trả lời dựng sẵn thành kết quả AI thật.
- Widget có sẵn kéo thả, lưu vị trí tương đối, đóng bằng Escape/nhấn ngoài và tránh các thanh hành động dưới màn hình.
- Dùng lại ảnh `images.goeMascot` đã tách nền, cùng nhận diện ảnh gốc. Không sửa ảnh nguồn.
- Không có skill `hatch-pet` trong phiên. Skill Work Pets dành cho pet trong ChatGPT, không áp dụng để cài linh vật lên website khác.

## Kiến trúc

`client/src/mascot/manifest.ts` khai báo metadata, anchor, ưu tiên, cooldown và fallback; `controller.ts` quản lý một animation tạm và các kênh trạng thái bền (chat/kéo/lập lịch); `context.tsx` quản lý thiết lập, vòng đời trang và lịch hành vi; `renderer.tsx` tải atlas khi đã nghiệm thu và chạy frame theo thời gian; `chat-state.ts` nhận sự kiện thực từ UI/API; `settings.tsx` cung cấp tùy chọn.

Chọn CSS sprite atlas + requestAnimationFrame thay vì thêm PixiJS ở giai đoạn này: chỉ có một nhân vật nhỏ, không có sân khấu/WebGL hay nhu cầu vật lý. Không thêm dependency hoặc bundle runtime đồ họa. Có thể thay renderer mà giữ manifest/controller.

Quy tắc: một timer kết thúc animation trong controller; một timer hành vi 15–45 giây tại widget; không gọi AI cho hành vi ngẫu nhiên; hủy timer khi unmount/tắt tự hoạt động; dừng chuyển động khi trang ẩn hoặc giảm chuyển động. Renderer chỉ chạy RAF khi có atlas đã xác nhận. Không chạy RAF cho ảnh fallback.

Thiết kế theo [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) và [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): cập nhật theo thời gian và tạm dừng khi tài liệu không hiển thị.

## Task và dependency

| Task                                              | Trạng thái | Bằng chứng / giới hạn                                                                         |
| ------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| Khảo sát stack, API, phạm vi                      | DONE       | Source frontend/server hiện tại                                                               |
| Manifest/controller/behavior                      | DONE       | 16 unit tests cho trạng thái, timer, cooldown, ưu tiên, frame và layout                       |
| Atlas MVP 8 hành động                             | DONE       | 32 frame alpha; đã mở đủ 8 trạng thái bằng renderer sprite trong trình duyệt                  |
| Mở rộng 30 hành động                              | DONE       | 120 frame sử dụng / 4 atlas; 30/30 nút preview mở đúng action và sprite                       |
| Ảnh lỗi và khôi phục                              | DONE       | Checkbox test dev làm URL ảnh lỗi → fallback → sprite khi khôi phục                           |
| Thiết lập ẩn/hiện, tự hoạt động, giảm chuyển động | DONE       | Đã kiểm tra khôi phục/giữ chat, automatic blink, reduced-motion dừng frame                    |
| Kết nối trạng thái AI thật                        | DONE       | Đã quan sát listening/planning, API trả đề xuất thật và trở về idle; không áp dụng vào chuyến |
| Chat du lịch tổng quát / streaming                | TODO       | Backend hiện không cung cấp; không sửa backend trong nhánh UI                                 |
| Nghiệm thu thiết bị / hiệu suất                   | TODO       | Chưa chạy Safari/iPhone thật hoặc benchmark bộ nhớ/khung hình                                 |

## Tài nguyên hiện tại

Có 4 atlas PNG RGBA, mỗi atlas 887×1774, 4 cột × 8 hàng. 30 hành động dùng 120 frame, hai hàng dự phòng không tính thành hành động mới. Lần tạo đầu bị ngắt và các bản sát mép không được đưa vào ứng dụng. Bản đang dùng đã chỉnh khoảng đệm bằng imagegen.

- `mvp-atlas.png`: idle, blink, wave, listening, thinking, speaking, success, error.
- `natural-atlas.png`: yawn, sleep, stretch, look-around, look-up, look-down, walk-left, walk-right.
- `interaction-atlas.png`: jump, sit, inspect-map, happy, excited, surprised, follow-cursor, dragging.
- `utility-atlas.png`: point, goodbye, waiting, confused, planning, touch; hai hàng dự phòng.

Một số hàng trong ảnh sinh ra không đúng vị trí lưới tuyệt đối. `scripts/validate_mascot_assets.py` đọc alpha để tạo cửa sổ hàng và căn chân, **không chỉnh pixel ảnh**. `atlas-registration.ts` và `ui-customer-v2/mascot-assets-qa.json` ghi metadata, SHA256, số frame và khoảng trống của từng ô. Nhờ vậy không lấy lẫn phần ảnh của hàng cạnh bên. Các atlas nạp theo trạng thái được chọn; không nhúng base64 vào JS. Bốn file hiện tổng khoảng 6MB; chưa phải kết quả benchmark trên mạng chậm.

`assetStatus: reviewed` nghĩa là đã kiểm tra sheet/alpha và đường dẫn, không phải tuyên bố nghiệm thu toàn bộ hiệu suất hoặc live AI.

## Đưa atlas mới vào hệ thống

1. Dùng ảnh gốc, giữ đúng mặt/màu/khăn/túi; mỗi frame phải có thay đổi tư thế/bộ phận thật.
2. Lưu ảnh alpha trong `client/src/assets/mascot/`, giữ tỷ lệ và cấu trúc atlas hoặc cập nhật validator tương ứng.
3. Chạy `python scripts/validate_mascot_assets.py` (cần Pillow). Script phải qua trước khi bật asset.
4. Cập nhật manifest: ID, tên, URL/row, frameCount, FPS, loop, priority, cooldown, duration, transition, anchor, interruptibility, fallback.
5. Vào `/dev/mascot` khi chạy Vite dev để kiểm tra frame, biên, chuyển trạng thái và ảnh lỗi. Màn này không được mount ở production và không gọi API.
6. Chạy `node --import tsx --test tests/mascot-controller.test.ts`, client build và lint.
7. Không tính việc sao chép ảnh tĩnh thành nhiều ô là animation. Ghi riêng nghiệm thu hình ảnh, trình duyệt, live AI và thiết bị.

## Cách dùng

- Nhấn Goe để mở chat; kéo để đổi bên/vị trí. Escape hoặc nhấn ngoài để thu gọn.
- Mở “Tùy chọn Goe” trong chat hoặc Hồ sơ cá nhân: bật/tắt linh vật, tự cử động và giảm chuyển động.
- Khi ẩn linh vật, nút “Hiện Goe” cho phép khôi phục. Có thể đổi trong hồ sơ. Thiết lập lưu trên trình duyệt; nếu storage không khả dụng vẫn dùng trong phiên.
- Không tự phát âm thanh, không gửi lời chào ngẫu nhiên và không gửi API từ hành vi tự động.
- Trạng thái dựa trên thao tác thật; các lỗi API không làm thay đổi chuyến đã lưu. Bộ điều khiển không có quyền truy cập chuyến, mật khẩu hoặc API key.

## Kiểm chứng

- Asset validator: PASS, 4 atlas RGBA / 128 frame không rỗng (120 dùng + 8 dự phòng), các ô có khoảng trống và dữ liệu khác nhau. Kết quả số không tự chứng minh chất lượng chuyển động; sheet cũng đã được xem trực tiếp.
- Browser: 30/30 action mở renderer `sprite`; có quan sát frame tiến triển, chớp mắt, xem bản đồ, thiếu ảnh và khôi phục. Bằng chứng `ui-customer-v2/mascot-browser-qa.json` và ảnh `evidence/mascot-sprite-preview-375.png`.
- 16 unit tests PASS; client build và lint PASS. Cảnh báo bundle >500KB hiện hữu vẫn còn.
- Lỗi kết nối browser đã được khắc phục bằng khởi tạo lại phiên điều khiển; không còn là blocker cho các kiểm tra trên.
- Chưa xác nhận streaming, chat tự do, thiết bị iOS thật, benchmark GPU/RAM hoặc provider live chỉ từ build/tests.

## Kết quả tích hợp cuối phiên

- Đã quan sát hành vi tự động chọn `blink` trên widget mà không nhấn vào Goe; marker DOM `data-last-automatic-action` chỉ là trạng thái local để kiểm tra, không gửi telemetry.
- Đã gửi một yêu cầu thật trên chuyến có tên Demo. Khi nhập: `listening`; khi POST đang chạy: `planning`; backend trả đề xuất và bộ điều khiển trở lại `idle` sau phản ứng hoàn thành.
- Đề xuất có 1 → 2 điểm dừng, chưa đáp ứng hoàn toàn ý giữ nguyên địa điểm của câu thử. Đã nhấn “Giữ lịch cũ”; không áp dụng/lưu thay đổi vào chuyến. Đây là kiểm tra kết nối và trạng thái UI, không phải nghiệm thu chất lượng xếp lịch hoặc tuân thủ mọi chỉ dẫn của AI.
- `ai-service.ts` tách adapter HTTP giữ nguyên consent, revision, Idempotency-Key và timeout. Có interface cho chat tổng quát trong tương lai, capabilities hiện false cho generalChat/streaming; không mở tính năng giả trong UI.
- Màn chat đã cố định chiều cao viewport, chỉ vùng hội thoại cuộn; tại 375×667 documentHeight=667 và scrollY=0. Không coi đây là kiểm tra bàn phím iOS thật.
- Kéo thả: giữ cơ chế hiện có; đã thêm chặn auto-fit trong lúc kéo để việc đổi asset không giật vị trí về dock cũ. Chưa nghiệm thu lại thao tác kéo trên điện thoại cảm ứng thật.
- Rendering follow-cursor chọn frame theo góc trỏ chuột khi hover Goe; hệ thống ưu tiên vẫn nhường cho lỗi nghiêm trọng và kéo. Không gắn listener chuột toàn trang.
- Không thêm thư viện đồ họa nặng hoặc khóa API client. Không sửa backend/contracts hoặc dữ liệu danh mục.

Kết thúc kiểm tra UI: tại 1280×800, canvas customer và thanh menu đều rộng 430px, không tràn ngang. Đã khôi phục viewport mặc định và để lại trang chủ đang chạy. Ảnh cuối: `evidence/home-final-polish-375.png`, `evidence/home-final-polish-1280.png`. Đã kiểm tra lại giảm chuyển động với sprite thật: motion=none, frame=0; sau đó khôi phục tùy chọn ban đầu. Nhánh chưa push/merge.
