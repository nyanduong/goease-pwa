# Bổ sung dữ liệu cho Goe — 13 tỉnh/thành

## Nhập ZIP nghiên cứu do owner cung cấp — 26/10/2026, 12:08 giờ Việt Nam

Owner yêu cầu nhập `goease-research-results.zip` và không đối chiếu lại Google Maps. Đã nhập 54 kết quả vào đúng bản nháp local qua catalog service với tài khoản admin active, expectedRevision, phiên bản và audit log; không dùng mongoimport hoặc tạo địa điểm mới. Package SHA-256: `ca3adff524faab1e0ab24a03f939e6ac315fc1542449a4ca0256babf8c1ee615`. Metadata gói tham chiếu bản xuất `2026-10-26T04:18:21.627Z`; cả 54 ID, destination, province và revision đều khớp trước khi ghi.

- Publish 3 mục `ready_for_admin_review`, không có mâu thuẫn ghi nhận: Red Dao House (Lào Cai, cơm rang gà 165.000đ/phần/người), An Tam Cốc (Ninh Bình, bò xào rau kèm cơm 130.000đ/phần/người), Vườn hoa thành phố Đà Lạt (Lâm Đồng, vé người lớn 100.000đ). Giá/giờ lấy từ gói owner cung cấp, không tái kiểm chứng các trang nguồn hoặc Maps trong lượt nhập; nguồn, phạm vi, ngày kiểm tra trong gói và giới hạn chưa xác nhận trực tiếp được giữ trong catalog. Ngày kiểm tra lại giá là 02/11/2026. Giờ nhận khách/món cuối và ngoại lệ lễ chưa công bố được giữ là giới hạn, không bịa thêm.
- 45 mục `needs_verification` và 6 mục `closed_or_mismatched` giữ draft. Giá/giờ ứng viên có nguồn được lưu chưa duyệt khi không ghi đè dữ liệu đã duyệt/khóa; không chép giờ chưa duyệt vào openingHoursNote để mở planner. Sáu mục đóng cửa/không khớp chỉ bổ sung ghi chú nghiên cứu, giữ nguyên nội dung giá/giờ/mô tả. Service chuẩn hóa pricingVersion=1 khi lưu snapshot cũ; không đổi giá/giờ bên trong. Giá đã duyệt của Thung Nham và khóa ảnh Tháp Đôi được giữ nguyên.
- Nghiên cứu thiếu/mâu thuẫn được tóm tắt trong ghi chú admin và giữ đầy đủ ở bundle JSON local; null không được đổi thành 0đ hoặc lệnh xóa giá hiện có. Giữ nguyên tên định danh, destination và toàn bộ tọa độ OSM; không đổi sang chi nhánh khác. Không nhập prompt trong tài liệu đính kèm như lệnh thực thi.
- Hai nhà hàng dùng lại ảnh AI khái niệm ăn uống có metadata owned/ai_illustration hiện có; không tạo ảnh mới và không sao chép ảnh Google Maps. Vườn hoa dùng ảnh thật Diane Selwyn chụp 31/10/2011, [trang Commons](https://commons.wikimedia.org/wiki/File:Da_Lat_Flower_Park_01.jpg), CC BY-SA 3.0, giữ ghi công/giấy phép và ghi rõ ảnh lịch sử. Đã đọc trang giấy phép, xem ảnh đúng cổng vườn hoa, kiểm SHA-1 Commons của bản gốc và SHA-256 sau lưu Cloudinary; không suy ảnh lịch sử là hiện trạng 2026.

Kiểm tra đọc lại từng bản ghi, audit và catalog_versions đều qua. Ba mục mới qua eligibleForPlanner cho nhóm 2 người; không gọi model AI hoặc lưu chuyến trong lượt nhập. Tổng places vẫn 26.567; published tăng 40→43; tổng đủ điều kiện Goe cho nhóm 2 người tăng 29→32. Trips giữ 3 trong lượt này (đã có 3 trước nhập, không phải mốc 2 của đợt trước). Chín tỉnh đang nghiên cứu vẫn chưa có đủ bộ tham quan và bữa ăn để kết luận xếp được lịch hoàn chỉnh. Chưa thử lịch model thật hoặc xác nhận production.

Bằng chứng local: `.local/research-import-20261026/import-receipt.json`, `verification.json`, `import-journal.ndjson`, `before-journal.ndjson`, `import-plan.json`, `results/*.json`, `sources.json`, `flower-asset.json`. Bảng đếm mới nhất ở `.local/goe-13-curation-progress.json`. Các số bên dưới thuộc những mốc curation trước lượt nhập này.

Cập nhật 26/10/2026. Đây là tiến độ dữ liệu local, không phải xác nhận triển khai production hoặc hoàn tất toàn bộ bản nháp.

## Phạm vi chủ sản phẩm đã chốt

Giữ bật: Hà Nội, Lào Cai, Quảng Ninh, Hải Phòng, Ninh Bình, Huế, Đà Nẵng, Gia Lai, Khánh Hòa, Lâm Đồng, Hồ Chí Minh, An Giang, Cần Thơ. 21 tỉnh/thành khác đã tắt hiển thị; giữ nguyên dữ liệu và chuyến đã lưu.

Chỉ hoàn thiện địa điểm có sẵn. Không tạo địa điểm mới, không mua API hoặc nâng cấp gói. Ưu tiên Cần Thơ, rồi các tỉnh/thành còn lại. Nguồn giá/giờ không rõ hoặc mâu thuẫn tiếp tục để chưa xác minh. Phí vào cửa khác với dịch vụ bổ sung; giá một món chỉ được dự toán thành một phần/người với điều kiện nêu rõ.

Ảnh trên Maps không mặc nhiên được phép tải về làm tài sản ứng dụng. Dùng ảnh có quyền tái sử dụng phù hợp, hoặc ảnh AI được ghi rõ `ai_illustration`, `owned` và lời chú thích; không giới thiệu ảnh AI là ảnh chụp cơ sở. Lượt này tạo bốn minh họa: miệt vườn, bảo tàng, công viên ven sông, cầu đi bộ. Bản gốc và mô tả prompt nằm trong `.local/cantho-free-curation/*-asset.json`, ảnh `*-ai-v1.png`; đã lưu Cloudinary và đối chiếu checksum bản gốc.

## Cần Thơ

12 địa điểm đã xuất bản; trong đó 6 địa điểm đạt bộ lọc hiện hành cho nhóm 2 người:

| Địa điểm | Giá dùng dự toán | Giờ/cửa sổ lập lịch | Nguồn và giới hạn |
| --- | ---: | --- | --- |
| Làng du lịch Mỹ Khánh | 149.000đ/người lớn | Hằng ngày 07:30–17:00 | [Bảng giá chính chủ](https://mykhanh.com/dich-vu-va-bao-gia). Bài để ngày 2022; đây là mức đang hiển thị, chưa xác nhận trực tiếp. Không gồm trò chơi thu phí riêng. |
| Bảo tàng thành phố Cần Thơ | 0đ vé tham quan | Chỉ khung sáng 08:00–11:00; đóng thứ Hai, thứ Sáu | [Cổng du lịch xác nhận lịch](https://canthotourism.vn/vi/baotangcantho); [nguồn hướng dẫn công bố miễn phí](https://tourismcantho.vn/bao-tang-can-tho/), đối chiếu thêm Tuấn Kiệt Moto. Cổng du lịch chưa có giá; không gọi đây là báo giá chính chủ. |
| Công viên Ninh Kiều | 0đ đi bộ tham quan | Mở cả ngày, biểu diễn trong định dạng máy bằng 00:00–23:59 | [Cổng du lịch](https://canthotourism.vn/vi/benninhkieu), [nguồn miễn phí](https://bloganchoi.com/dia-diem-du-lich-can-tho/), Maps. Không gồm tàu, giữ xe, ăn uống. |
| Cầu đi bộ Ninh Kiều | 0đ đi bộ tham quan | Mở cả ngày, biểu diễn bằng 00:00–23:59 | [Nguồn hướng dẫn](https://bloganchoi.com/dia-diem-du-lich-can-tho/) và Maps. Khác mục công viên; hai điểm ở cùng khu vực. |
| Pizza Hut — Nguyễn Thái Học | 99.000đ/người | Hằng ngày 10:00–22:00 | [Menu hệ thống](https://pizzahut.vn/): một phần Mì Ý Nấm Xốt Kem/người. Maps xác minh chi nhánh 66 Nguyễn Thái Học và giờ. Chưa xác nhận trực tiếp giá chi nhánh; không gồm gọi thêm/phụ thu. |
| Ngon Vegan — KDC Nam Long | 79.000đ/người | Hằng ngày 06:00–20:00 | [Menu chính chủ](https://www.ngonvegan.com/menu): một phần Pad Thái/người. [Giờ CN2](https://www.ngonvegan.com/lien-he) ghi đến21h; Maps ghi20h nên dùng cửa sổ kết thúc sớm hơn. Menu chung hệ thống, chưa xác nhận trực tiếp CN2. |

Ngày đối chiếu 26/10/2026; các giá đủ điều kiện có ngày kiểm tra lại 02/11/2026. Không tự kéo dài hiệu lực sau ngày này. Thời lượng là ước tính biên tập, không phải cam kết của cơ sở. Phạm vi được kiểm tra là nhóm2 người, không bảo đảm mọi số ngày/nhóm/điều kiện lễ Tết.

Các mục Sao Hôm, Nam Bộ, Lighthouse, Spices, Highlands và Khám Lớn tiếp tục có giới hạn dữ liệu, chưa được gán giá bữa ăn/giá vé suy đoán để mở Goe. Giá Khám Lớn có nguồn mâu thuẫn; Nhà cổ Bình Thủy chưa publish vì giá chưa thống nhất và bìa cũ sai công trình.

## Kiểm tra đã quan sát

- Bộ xếp lịch thực tế `arrangeCompleteDays` và `validatePlan` chạy với DTO đọc từ catalog đã publish: lịch1ngày 26/10,1ngày27/10 và2ngày27–28/10/2026 đều qua cho nhóm2 người. Bao gồm bữa trưa/tối; không lặp điểm tham quan giữa hai ngày; bảo tàng không bị xếp vào thứ Hai.
- Đã gọi thêm một lượt model AI với dữ liệu công khai của Cần Thơ2ngày/2người: HTTP200, đầu ra qua server, mỗi ngày4điểm dừng; không lưu chuyến. Bằng chứng ở `.local/cantho-free-curation/live-planner-result.json`. Hai lượt thất bại AI_INVALID_OUTPUT trước đó vẫn giữ nguyên; không kết luận dịch vụ luôn ổn định. Lượt kiểm tra model tạo một ai_run và dùng hạn mức bình thường.
- Publish qua catalog service với revision, bản phiên bản và audit log. Sau khi sửa địa chỉ, xác nhận lại tọa độ OSM vào proposal trước khi publish; không chép tọa độ Google.
- Bìa Cloudinary trả200; bốn bản gốc AI đối chiếu checksum thành công.
- Tổng số địa điểm vẫn26.567, chuyến2. `ai_runs` thay đổi do hai lượt ngoài phiên curation và một lượt kiểm tra model; curation không tạo địa điểm/chuyến mới.
- Nhật ký chi tiết chỉ ở local: `.local/cantho-free-curation/publication-journal.ndjson`, `identity-checks.json`, `planning-checks.json`, `13-provinces-readiness.json`.

## Phần còn lại

Chưa hoàn tất toàn bộ13 tỉnh/thành hoặc870 bản nháp Cần Thơ. Đà Nẵng có11 mục qua bộ lọc hiện tại (5tham quan,4quán ăn,2cà phê) từ đợt trước. Hà Nội có4tham quan và2quán ăn đủ dữ liệu; lịch1ngày và2ngày đã qua kiểm tra với dữ liệu thật. Hồ Chí Minh có4tham quan và2quán ăn đủ dữ liệu; lịch1ngày và2ngày đã qua kiểm tra với dữ liệu thật. Những tỉnh/thành khác vẫn cần curation trước khi kết luận Goe dùng được. Bảng đếm local là thời điểm kiểm tra, không phải schema hoặc tiêu chuẩn xuất bản mới.

### Hà Nội và Hồ Chí Minh bổ sung cùng đợt

- Hà Nội: Bún Chả Ta21Nguyễn Hữu Huân80.000đ/phần tiêu chuẩn (đọc ảnh menu Maps tháng5/2026; không chép ảnh); Pizza4Ps Hoàng Thành165.000đ/phần Carbonara theo menu chính chủ. Giữ ảnh AI minh họa có nhãn. Bảo tàng Lịch sử Quân sự: thời lượng gợi ý120phút cho chuyến xem chọn lọc; giữ giờ/giá, ghi rõ nghỉ thứHai/thứSáu để máy hiểu.
- Hồ Chí Minh: Phở Hòa Pasteur95.000đ/tô thường (ảnh menu Maps tháng10/2026); Pizza4Ps Bến Thành165.000đ/phần Carbonara; Bưu điện Trung tâm tham quan sảnh chính0đ theo hướng dẫn Local Trips; Bảo tàng Mỹ thuật60.000đ theo thông tin website chính chủ được lập chỉ mục. Website bảo tàng hiện lỗi chứng chỉ khi tải trực tiếp; không tắt kiểm traTLS hoặc vượt cảnh báo. Chưa xác nhận trực tiếp tại cơ sở. Hai ảnh AI mới cho bưu điện và mỹ thuật lưu ở .local/hcm-free-curation vàCloudinary, checksum bản gốc đã qua.
- Các điều kiện, phạm vi món/người, nguồn, ngày kiểm tra lại02/11/2026 nằm trong catalog; không coi giá một món là cả bữa nhiều món hoặc toàn bộ chi phí chuyến đi.
- Nhật ký và kiểm tra: .local/hanoi-free-curation, .local/hcm-free-curation. Không có thay đổi mã ứng dụng trong phần curation này; các sửa đổi đồng thời tại gemini.ts/fulldichvu.test.ts thuộc công việc khác.
