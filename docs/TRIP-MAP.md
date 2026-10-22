# Bản đồ lịch trình Hội An

## Phạm vi và API

Tab Bản đồ dùng lịch đang mở (gồm chỉnh sửa chưa lưu), giữ thứ tự activity và ngày đang chọn. Tái sử dụng GET /places/:id cho các placeId duy nhất trong ngày, không gửi ghi chú hoặc toàn bộ trip tới dịch vụ bản đồ. Không thêm endpoint và không thay đổi quyền GET/PATCH trip. Catalog archived/deleted vẫn bị404; không hydrate tọa độ ẩn vào lịch cũ.

PlaceDto bổ sung mapLocation tùy chọn: latitude[-90,90], longitude[-180,180], label(max150), precision=area, sourceUrl HTTPS(max2048), checkedAt ngày ISO. Mongoose và shared Zod kiểm tra shape/range; dữ liệu cũ không có trường này vẫn hợp lệ. Map dùng metadata hiện tại của catalog, không ghi đè snapshot lịch. Không có endpoint cho client sửa tọa độ, index địa lý hoặc tự geocode.

Seed chỉ backfill khi mapLocation chưa tồn tại, giữ nguyên giá trị đã chỉnh hoặc null được đặt chủ ý. Chạy npm run db:seed ở local để cập nhật năm địa điểm. Không cần xóa DB hoặc reconfigure replica set.

## Nguồn tọa độ — đối chiếu 2026-10-23

| Địa điểm      | Vị trí tham khảo                           | Nguồn                                                                                                  |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Phố cổ        | 15.8771291,108.3286631                     | [OSM node4601279489](https://www.openstreetmap.org/node/4601279489)                                    |
| Trà Quế       | 15.9027147,108.3360222                     | [OSM node3079969135](https://www.openstreetmap.org/node/3079969135)                                    |
| An Bàng       | 15.9136072,108.3406489                     | [BeachAtlas](https://www.beachatlas.com/an-bang-2)                                                     |
| Cẩm Thanh     | 15.8762535,108.3660605                     | [Geokeo](https://geokeo.com/database/suburb/vn/5/)                                                     |
| Dạo sông Hoài | 15.8764915,108.3264631; khu vực cầu An Hội | [OSM way35952574](https://www.openstreetmap.org/way/35952574); trung bình tọa độ các node của đoạn cầu |

Các vị trí chỉ đại diện khu vực, chưa xác minh lối vào, bãi đỗ xe hoặc nhà cung cấp trải nghiệm. Hai gợi ý món cơm gà/cao lầu không đại diện nhà hàng nên không có tọa độ. Không sao chép ảnh, mô tả hay review từ các nguồn tọa độ. Dữ liệu trích từ OSM ghi nhận © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright); bảng trên và seed chứa phần trích xuất tọa độ có thể đối chiếu.

## Giao diện, lỗi và giới hạn

Leaflet1.9.4 tải riêng khi mở tab. Marker đánh số theo vị trí trong lịch, có thể chọn bằng bàn phím hoặc danh sách. Chọn điểm mở thông tin, nguồn và nút chỉnh điểm dừng. Chỉ nối hai điểm liên tiếp khi cả hai có tọa độ; không nối bắc qua điểm chưa rõ. Nét đứt không phải đường đi, không tính quãng đường/ETA hoặc tối ưu thứ tự. Google Maps directions dùng tọa độ khu vực; điểm chưa rõ có link tìm kiếm để khách chọn địa điểm phù hợp.

Nền dùng [OSM standard tiles](https://operations.osmfoundation.org/policies/tiles/) qua HTTPS, attribution hiển thị, cache theo trình duyệt, không prefetch/offline download. Browser gửi Referer mặc định. Không có SLA; lỗi hoặc quá12giây hiển thị thử lại, danh sách/link vẫn dùng được. Không yêu cầu geolocation. API lỗi có retry riêng,404 thể hiện không còn hiển thị. Ngày rỗng không khởi tạo bản đồ. Không phát sinh Gemini call, API key hoặc phí routing trong task này.
