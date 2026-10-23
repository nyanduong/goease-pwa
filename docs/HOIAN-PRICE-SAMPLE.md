# Giá thật cho kiểm thử dự toán — 24/10/2026

Owner chọn dùng dữ liệu thật trên catalog local hiện tại để tự tạo lịch nghiệm thu. Không clear DB, không nhập giá giả hoặc sửa chuyến đã lưu. Ghi qua UI admin đã đăng nhập, giữ kiểm tra quyền/revision/audit của ứng dụng.

## Dữ liệu đã lưu và xuất bản

| Địa điểm                            | Giá tham khảo     | Nguồn và phạm vi                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phố cổ Hội An (cập nhật)            | 120.000 VND/người | [Thông tin du lịch Hội An](https://hoianworldheritage.org.vn/vi/news/Dieu-can-biet/thong-tin-du-lich-hoi-an-2311.hwh). Chọn loại vé 120.000, không suy diễn từ quốc tịch. Quyền lợi theo ô vé; không khẳng định phủ mọi điểm trong lịch. Chỉ ghi giá tại record Phố cổ, không sao chép giá vé sang từng di tích.                                                                       |
| Làng rau Trà Quế (cập nhật)         | 35.000 VND/người  | [Trung tâm Văn hóa Hội An](https://hoiancreativecity.com/vi/vui-cung-lang-nghe-day-them-trai-nghiem). Giá phổ thông; chưa áp dụng miễn/giảm theo tuổi/đối tượng hoặc đoàn từ 15 vé; giới hạn dự toán 14 người. Không gồm ăn uống, lớp nấu ăn, hướng dẫn viên riêng hay di chuyển.                                                                                                      |
| LaQue Restaurant & Coffee (tạo mới) | 550.000 VND/người | [Set Love Sick cho một người](https://chuanlaque.com/product/set-menu-love-sick-550-pax/). Đúng set cụ thể, không phải giá trung bình nhà hàng. 100 Trần Phú; 11:00–21:00 hằng ngày theo website. 90 phút là thời lượng GoEase biên tập. Chưa gồm đồ uống/món thêm; nguồn không làm rõ thuế/phí. Giới hạn dự toán GoEase 10 người, không phải xác nhận sức chứa/khả dụng của nhà hàng. |

Ngày đối chiếu 2026-10-24; ngày biên tập cần rà lại 2026-11-23. Đây là ngày nhắc kiểm tra của GoEase, không phải thời hạn nhà cung cấp cam kết giá. Phố cổ cũng giới hạn 14 người để không tự tính các ưu đãi đoàn. Không có cơ chế tự nhận diện miễn/giảm tuổi, tự phân bổ ô vé hoặc khấu trừ vé dùng chung giữa các record. Các di tích khác vẫn unknown; không gán miễn phí khi chưa xác định quyền lợi.

Menu Cánh Buồm Trắng tại thời điểm đọc chứa placeholder WordPress và giá USD lặp lại nên không dùng. JEERA/The Seeds chưa có giá set đủ căn cứ từ nguồn đã đọc; giữ unknown. Chưa đủ giá cho toàn bộ catalog, lưu trú hoặc vận chuyển. Không gọi booking, liên hệ nhà hàng hay gửi tin nhắn.

## Kiểm chứng

- Đọc lại API public `/api/v1/places`, cả 3 record có giá/basis/ngày rà lại đúng; có thể dùng cho lịch mới.
- Script local read-only `.local/check-published-prices.mts` lấy giá public, tạo input kiểm thử trong bộ nhớ và chạy `catalogCost` + `calculateBudget`: 2 người = 1.410.000; 3 = 2.115.000; 4 = 2.820.000 VND. Bình quân 705.000 VND/người cho đúng 3 khoản, mỗi khoản xuất hiện 1 lần. Không gọi model hoặc lưu trip trong kiểm tra này.
- Trước nhập, `catalog.integration.ts`: 9 kiểm tra pass trên MongoDB test riêng, bao gồm quyền admin, giá từ catalog vào AI proposal, nhân số người, snapshot sau lưu, giá hết hạn và rollback.
- Sửa hai date input admin để đồng bộ thêm `onInput` như customer date fields. Trước sửa, fill ngày rà lại hiển thị giá mới nhưng khi lưu quay về ngày cũ; sau sửa public API xác nhận 2026-11-23. Không đổi schema/BR/contract giá.

Người dùng cần tạo lịch mới sau khi chuyển lại customer. Lịch AI không đảm bảo luôn chọn đủ 3 điểm này; tổng phụ thuộc điểm thực tế được chọn, số lần ăn và các khoản unknown. Chuyến cũ giữ snapshot cũ; không dùng chuyến cũ để kết luận giá mới không hoạt động. Chưa đánh dấu PASS toàn customer MVP từ bộ giá nhỏ này.
