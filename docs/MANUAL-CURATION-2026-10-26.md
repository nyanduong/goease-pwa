# Bổ sung thủ công song song đợt toàn quốc — 26/10/2026

Owner yêu cầu tìm và nhập đầy đủ cho danh sách26.566 mục đang có, mục tiêu xuất bản. Tác vụ này bổ sung nguồn thật cho các mục hiện có; không thay scope bằng bộ mẫu, không tự coi toàn bộ26.566 mục hợp lệ/đã đủ dữ liệu và không tự xuất bản hàng loạt.

## Kết quả đã đọc lại

| Địa điểm             | Giá nguồn VND | Giờ đã đối chiếu | Bìa HTTP200 | Loại bìa        | Qua validation field xuất bản | Goe lịch/ngân sách                      |
| -------------------- | ------------: | ---------------- | ----------- | --------------- | ----------------------------- | --------------------------------------- |
| Dinh Độc Lập         |         40000 | Có               | Chưa        | Chưa có         | Chưa                          | Chưa có giá đủ điều kiện hoặc thiếu bìa |
| Công viên Thủ Lệ     |         50000 | Có               | Chưa        | Chưa có         | Chưa                          | Chưa có giá đủ điều kiện hoặc thiếu bìa |
| Thung Nham Bird Park |        250000 | Có               | Chưa        | Chưa có         | Chưa                          | Chưa có giá đủ điều kiện hoặc thiếu bìa |
| Bảo tàng Đà Nẵng     |         50000 | Có               | Có          | ai_illustration | Có                            | Có                                      |
| Thánh địa Mỹ Sơn     |        100000 | Có               | Chưa        | Chưa có         | Chưa                          | Chưa có giá đủ điều kiện hoặc thiếu bìa |

Mọi dòng trên đã xác nhận audit catalog.proposal_saved, version snapshot giữ đúng URL nguồn và vẫn draft. Ngày kiểm tra26/10, reviewAfter02/11/2026. Không dùng số field đủ như bảo đảm đủ lịch trình cho mọi số người/ngày lễ. 5 mục đã hoàn thiện ở lượt trước vẫn được giữ, kiểm chứng riêng trong curated-complete-verification.json.

## Nguồn và điều kiện

- [Dinh Độc Lập](https://dinhdoclap.gov.vn/gio-tham-quan/): vé chỉ vào Dinh40.000đ khác vé tổng hợp80.000đ, giờ07:00–18:00; không gộp Nhà trưng bày/xe điện vào giá cơ bản.
- [Vườn thú Hà Nội](https://vuonthuhanoi.com/): vé trên1,3m50.000đ; khung trưng bày động vật08:00–16:00 khác giờ công viên theo mùa.
- [Thung Nham](https://thungnham.com/dich-vu/ve-tham-quan-thung-nham/):250.000đ từ1,3m, có thuyền vườn chim và Hang Bụt, giờ mùa hè07:00–18:00/mùa đông07:30–17:30. Có điều kiện tối thiểu3vé/thuyền lúc vắng cho khách lẻ dưới2người; giữ audience=restricted, chưa dùng làm ngân sách chung cho mọi nhóm.
- [Bảo tàng Đà Nẵng cơ sở1](https://baotangdanang.vn/thong-bao-gia-ve-tham-quan-bao-tang-da-nang-ap-dung-tu-ngay-03-7-2025): đã đọc ảnh bảng phí chính thức50.000đ, giờ08:00–17:00, địa chỉ31Trần Phú. Giữ rõ đối tượng miễn/giảm và ngày miễn. Ảnh Commons Bảo tàng Đà Nẵng.jpeg chụp04/03/2018 thuộc cơ sở cũ; chưa dùng cho cơ sở mới.
- [Cổng vé Mỹ Sơn](https://mysonticketonline.vn/information):100.000đ khách Việt Nam,150.000đ khách nước ngoài; bán vé06:00–17:30, tham quan06:00–18:00. Audience=restricted để không suy giá Việt Nam cho mọi khách khi Goe chưa có ngữ cảnh quốc tịch. Hostname www lỗi certificate name mismatch; dùng đúng hostname không-www có TLS hợp lệ, không bỏ qua kiểm tra chứng chỉ.

## Ảnh và lỗi nguồn

Wikimedia trả429/Retry-After600s khi tải bản gốc đầu tiên; dừng download lô đó, không thử dồn các ảnh tiếp theo hoặc dùng link gốc giả làm bản đã lưu. Các ảnh thật lấy metadata giấy phép/credit/source qua Commons API và cần xem ảnh trước khi import. File gốc và nhật ký nằm ignored tại .local/manual-tourism-import-20261025.

Cơ sở1 Bảo tàng Đà Nẵng dùng đúng một ảnh AI do GoEase tạo, kind=ai_illustration, license=owned, credit nói rõ không phải ảnh chụp địa điểm/hiện vật thực tế. Giữ images lock để không tự thay bằng ảnh cơ sở cũ. PNG gốc2.374.674bytes đã upload vào goease/places/ai trên Cloudinary, GET và đối chiếu SHA-256 khớp hoàn toàn; không resize/lossy. Bản workspace: .local/manual-tourism-import-20261025/danang-museum-ai-cover.png; metadata cloud URL/checksum: danang-ai-cover-asset.json.

Công cụ tạo ảnh: built-in imagegen, không CLI. Prompt cuối:

> Use case: stylized-concept. Asset type: one landscape cover illustration for a Vietnamese travel app, GoEase, for the current Da Nang Museum. Create an obviously illustrated, tasteful editorial museum still life: a terracotta pottery vessel, a small abstract carved stone heritage fragment, and a woven basket on display plinths, with subtle blue-green light suggesting coastal Da Nang. Warm ivory, terracotta and teal, refined soft painted texture, inviting cultural travel aesthetic, broad landscape composition that crops cleanly to a card. This is a conceptual AI illustration, not a photograph of the actual museum interior or its architecture; avoid depicting a specific building or inventing actual exhibits. No people, no text, no logos, no watermarks. Opaque background.

## Sửa lỗi phát hiện khi rà

Legacy imageSearch.state=failed vẫn có thể giữ defaultCover automatic sai địa điểm (ví dụ ảnh cầu cho quán). Đã mở cleanup cho mọi trạng thái idle, có lease/state/revision/checkedAt fence; chỉ draft chưa chọn ảnh/không khóa. Các candidate cũ được adopt trước rồi kiểm tên; default hợp lệ nhưng không còn trong candidate list vẫn được giữ khi filename/provenance khớp. Không sửa ảnh selected/public/locked hoặc xóa asset. Integration photo pool đã kiểm thêm case failed/default sai và đạt; typecheck/lint/build server đạt. Không thêm trường/collection/gate để hợp thức hóa nội dung thiếu.

## Bằng chứng cục bộ

curated-extra-input.json, curated-extra-plan.json, curated-extra-journal.ndjson, curated-extra-verification.json, danang-price-source.webp, myson-official-source.html, ảnh thật tải thành công và danang-ai-cover-asset.json nằm trong thư mục ignored. Receipt/audit/version thật trong goease. Chưa xóa, reset database hoặc xuất bản POI trong lượt này.
