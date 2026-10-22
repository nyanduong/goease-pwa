# Chi tiêu thực tế của chuyến đi

## Luồng customer

Mở chuyến đi đã lưu → Chi phí → Thực chi. Thêm, sửa, xóa khoản chi bằng tên, nhóm, tổng tiền VND và ngày chi. Ngày chi có thể ngoài ngày đi (ví dụ đặt cọc). Xóa cần xác nhận. Không cần cấu hình provider hoặc seed mới; API khởi tạo collection/index theo cơ chế hiện có.

Chỉ chủ chuyến đi được đọc/ghi. Khoản chi độc lập với activity và revision lịch trình, nên chỉnh lịch hoặc ngân sách không xóa chi tiêu. Chuyến đi chưa lưu chưa nhập được thực chi. Khi lịch có thay đổi chưa lưu, UI báo so sánh dùng bản đã lưu.

## API và hợp đồng

Tái sử dụng session/Origin middleware, BudgetSummary, idempotency_keys và business audit; API trước đây chỉ tính dự toán nên bổ sung:

| Method | `/api/v1` path                   | Input                                                          |
| ------ | -------------------------------- | -------------------------------------------------------------- |
| GET    | `/trips/:id/expenses`            | offset mặc định0, tối đa1.000.000; limit mặc định25, tối đa100 |
| POST   | `/trips/:id/expenses`            | `{expense: ExpenseInput}`                                      |
| PATCH  | `/trips/:id/expenses/:expenseId` | `{expense: ExpenseInput, expectedRevision}`                    |
| DELETE | `/trips/:id/expenses/:expenseId` | `{expectedRevision}`                                           |

ExpenseInput strict: description trim1–160; category transport/lodging/meal/visit/other; amountMinor số nguyên1–1.000.000.000.000; currency VND; spentOn ngày ISO hợp lệ; timezone Asia/Ho_Chi_Minh. Không nhận actor/owner từ client. Đây là ngày lịch, không giả lập thời điểm chính xác bằng spentAt.

GET trả items, totalCount, hasMore, offset, tripRevision, budget, actual. Mỗi item có id/revision/updatedAt. Tổng được tính trên mọi khoản chưa xóa, không chỉ trang hiện tại; sắp spentOn và _id giảm dần. Mutations yêu cầu UUID Idempotency-Key; POST201, PATCH/DELETE200 trả `{completed:true}` trong envelope chuẩn; UI tải lại danh sách. Sai quyền/không tồn tại404, revision hoặc key khác payload409, validation400.

## Tính toán

- Thực chi = tổng amountMinor đã ghi, không nhân số người.
- Bình quân = làm tròn thực chi / số người của chuyến đi đã lưu.
- Còn lại = ngân sách đã lưu − thực chi; âm hiển thị vượt ngân sách. Ngân sách null khác0.
- Chênh lệch = thực chi − dự toán đã biết. Giữ missingCostCount và cảnh báo: chưa nhập hết khoản chi hoặc thiếu dự toán thì không thể kết luận tiết kiệm.
- Kiểm tra safe integer trước commit; UI không quyết định tổng tiền.

## Lưu trữ, tranh chấp và lỗi

trip_expenses riêng, strict Mongoose + Zod, timestamps, revision, schemaVersion, recordedBy/updatedBy và deletedAt/deletedBy. Index `{tripId:1,deletedAt:1,spentOn:-1,_id:-1}`. Không thêm MongoDB JSON Schema validator trực tiếp; registry là tài liệu thiết kế, không executable schema.

Một transaction ghi expense, audit và key; tăng trips.expenseRevision để tuần tự hóa ghi chi tiêu/đổi trạng thái trip. Không tăng revision, updatedAt hoặc snapshot lịch trình. GET dùng snapshot transaction cho budget và tổng nhất quán. Sửa/xóa dùng revision của khoản chi; lỗi audit rollback toàn bộ. Audit chỉ giữ actor/entity/revision/action, không tên hoặc số tiền.

Key giữ24h theo TTL hiện có. Retry cùng key/payload không ghi lần hai; khác payload409. Quyền trip được kiểm tra trước replay. Sau TTL không đảm bảo dedupe. UI giữ nguyên payload/key trong lần thử lại khi kết quả mạng chưa rõ, khóa form; lỗi chắc chắn giữ nội dung cho sửa. Refresh lỗi sau mutation thành công không tự gửi lại mutation. Refresh trang có thể mất pending key; cần kiểm tra danh sách trước khi nhập lại. Không có hàng đợi offline.

Xóa mềm không có UI khôi phục. Expense của trip đã xóa không truy cập được; purge/retention tự động chưa triển khai. Chưa có receipt, paidBy, chia nợ, hoàn tiền, đa tiền tệ, liên kết activity hay thanh toán. Không gọi nhật ký này là bằng chứng payment confirmed.
