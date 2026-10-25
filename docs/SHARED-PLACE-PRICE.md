# CAT-23 — Một giá dùng cho hiển thị và ngân sách

Owner chốt ngày 25/10/2026: admin nhập giá một lần; dùng chung để hiển thị và tính ngân sách khi đủ điều kiện. Bỏ form referencePrice riêng. Quy tắc này thay phần tách hai giá trong CAT-22 và hướng dẫn editor trước đó.

## Hành vi đã triển khai

- Giá duy nhất nằm trong khối Giá tham khảo: số tiền VND, đơn vị người/món/nhóm/chưa rõ, điều kiện và nguồn. Có thể giữ Chưa rõ, chọn Miễn phí có căn cứ, hoặc nhập giá thu phí. Không có ô số tiền ngân sách thứ hai.
- Cùng khối giá có đối tượng (thông thường/đặc biệt/chưa rõ), dịch vụ gồm/chưa gồm, ngày kiểm tra lại, giới hạn người và vé gói nếu có. Xác nhận giá ghi ngày admin xác nhận hôm nay; ngày kiểm tra lại mặc định hiển thị hôm nay theo form cũ, admin có thể chọn ngày sau. Nếu cố ý để trống ngày kiểm tra lại, chỉ hiển thị, chưa dùng tính chi phí.
- Tự dùng cùng giá để tính khi đã xác nhận, theo người hoặc nhóm, đối tượng thông thường (người lớn/suất ăn tiêu chuẩn), đủ nguồn/điều kiện/gồm/chưa gồm, ngày đối chiếu không ở tương lai và còn hiệu lực. Mỗi người mặc định phạm vi 1–1000 nếu chưa giới hạn; nhóm phải có số người tối đa cụ thể. Giữ CAT-14 cho min/max và vé gói. Quán chưa cụ thể, món đơn lẻ, giá ưu đãi/trẻ em/chưa rõ đối tượng hoặc giá quá hạn chỉ để tham khảo; UI nêu lý do.
- Ví dụ 40.000đ/người → khách thấy Từ 40.000đ/người → 2 người dự kiến 80.000đ. Giá trọn nhóm chỉ tính một lần nếu số người thuộc phạm vi. Miễn phí là giá 0 đã xác nhận, khác giá chưa rõ.
- Sửa giá/đơn vị/điều kiện/nguồn/terms bỏ xác nhận và loại khỏi dự toán của bản nháp. Lưu đề xuất → xem trước/xuất bản vẫn giữ public isolation. Các chuyến đã lưu giữ snapshot giá cũ.

## Dictionary và hợp đồng

- places.visitInfo.pricingVersion optional literal 1 đánh dấu mô hình dùng chung. Canonical editorial price là places.visitInfo.price (amount 0..1e12 nguyên VND để tương thích referencePrice cũ, unit, conditions, sourceUrl, observedAt, reviewed).
- price.terms optional strict embedded object: audience standard|restricted|unknown; label≤120; minTravelers/maxTravelers 1..1000; inclusions/exclusions≤500; checkedAt/reviewAfter ngày ISO hoặc rỗng khi chưa đủ căn cứ; bundle {code,validDays,maxEntries} giữ schema vé gói cũ. Nguồn nhập không tự điền audience=standard hoặc tự reviewed. observedAt vẫn là ngày nhận, không thay verified date.
- places.referencePrice giữ schema cũ làm **projection server tính từ giá chung**, phục vụ planner, tính tổng và snapshot hiện hữu; không có input giá riêng trong UI. Server bỏ qua số tiền referencePrice do client gửi khi có visitInfo mới. stage/save/publish/restore tính lại projection khi pricingVersion=1; điều kiện chưa đủ trả null cho projection, vẫn giữ canonical price để hiển thị/làm rõ điều kiện.
- Các field locks visitInfo/referencePrice bảo vệ cùng giá khi nhận nguồn hoặc phục hồi. Restore không được lấy giá cũ ghi đè giá bị khóa; nguyên tắc manual editor và ownership không đổi.
- Public PlaceDto chiếu pricingVersion và reviewed price/terms. Customer hiển thị một giá, cùng trạng thái áp dụng chi phí. Legacy planning.priceOptions không hiển thị như giá thay thế trong DTO mô hình dùng chung; dữ liệu/historical snapshots không bị xóa.
- Không thêm collection/index hoặc tác vụ sửa giá công khai nền. Registry phản ánh field additive, không executable schema.

## Tương thích dữ liệu cũ

Editor đưa referencePrice cũ vào cùng form với nguyên số tiền, ngày, phạm vi người, dịch vụ và bundle; không cần nhập lại. Legacy giá đã được admin cấu hình tính toán được coi là giá thông thường đã đối chiếu theo chính sách cũ. Nếu đã có giá hiển thị khác, giữ giá hiển thị trong editor, không tự suy ngân sách từ số tiền khác; cần hoàn thiện điều kiện của giá đang chọn. Không tự đổi bản công khai cho đến khi admin lưu và xuất bản.

API cũ chỉ gửi referencePrice vẫn được hỗ trợ; khi sửa một record dùng chung, giá legacy gửi vào được chuyển sang snapshot dùng chung và tái tính. Hợp đồng tiền/snapshot chuyến hiện tại và các phép kiểm revision/ownership tiếp tục áp dụng.

## Kiểm chứng

- Unit: cùng số tiền, không tin số tiền thứ hai; món/ưu đãi/chưa rõ/quá hạn/thiếu điều kiện; giá 0, nhóm, min/max, bundle, legacy và locks.
- Integration MongoDB riêng: canonical 40.000đ bỏ qua projection giả 1đ; publish và DTO; lưu chuyến 2 người thực sự ra 80.000đ; sửa nháp không đổi public/chuyến cũ; từ chối publish chưa duyệt và catalog reference cũ cho chuyến mới; giá nhóm 300.000đ chỉ tính một lần, vượt giới hạn là chưa rõ.
- Browser: một ô số tiền, không form ngân sách riêng, xác nhận/sửa/readback tự có projection đúng giá, lý do đủ điều kiện và responsive.
