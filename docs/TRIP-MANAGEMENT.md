# Quản lý chuyến đi customer

## Phạm vi

Danh sách có Tất cả / Sắp đi / Đang đi / Đã kết thúc và phân trang50 mục. Phân loại theo ngày lịch Asia/Ho_Chi_Minh ở thời điểm đọc: trước startDate là upcoming, sau endDate là completed, hai đầu mút bao gồm trong ongoing. Không chuyển trường status=draft lưu trong DB, không chạy cron hoặc suy luận khách thật sự đã đi. Bộ lọc gửi server; danh sách không lọc riêng50 mục đầu. Tổng số hiển thị là số mục trong trang.

Thông tin chuyến đi dùng PATCH hiện có cho tên, thời gian, số người, ngân sách. UI dời lịch theo thứ tự Ngày1/Ngày2, giữ dayId, activityId, giờ, thứ tự, ghi chú, giá và nguồn. Kéo dài thêm ngày rỗng. Chỉ rút ngắn nếu các ngày bỏ đi rỗng; nếu còn điểm dừng thì báo lỗi. Server chặn PATCH thay ngày và đồng thời làm mất activityId đã lưu. Muốn chủ động bỏ hoạt động phải lưu việc xóa riêng trước khi đổi ngày. Expense lưu độc lập, không đổi số tiền hoặc spentOn theo ngày đi mới. Đổi số người chỉ đổi dự toán per_person và bình quân thực chi, không nhân thực chi.

Tab Tổng kết dùng GET expenses hiện có (budget + actual trong snapshot transaction), số ngày/người/điểm từ bản trip đã lưu. Hiển thị dự toán đã biết, thực chi đã ghi, ngân sách còn lại/vượt và cảnh báo thiếu dữ liệu. Trước khi kết thúc gọi là tổng kết tạm thời. Không tạo báo cáo doanh thu hoặc xác nhận thanh toán.

## API

- GET /api/v1/trips thêm phase=all|upcoming|ongoing|completed, offset0..1000000, limit1..50 (mặc định50). Trả items/hasMore/offset. Giữ tương thích consumer cũ.
- POST /api/v1/trips/:id/duplicate: `{expectedRevision, startDate}`;201 trả trip trong envelope chuẩn. Tạo ID trip/day/activity mới, revision0, tên có “(bản sao)”, giữ độ dài lịch, nội dung, ghi chú, giá và liên kết catalog đã lưu. Snapshot nguồn đã sở hữu được giữ cả khi catalog bị ẩn; không đọc thêm nội dung catalog ẩn. Bản sao là kế hoạch manual, không kế thừa aiRunId hoặc tuyên bố một lần gọi AI mới. Lưu clonedFromTripId nội bộ. Không sao chép expense, revision history, audit, share/access hoặc quyền.
- DELETE /api/v1/trips/:id: `{expectedRevision}`;200 `{deleted:true}`. Xóa mềm tăng revision, set deletedAt/deletedBy/deletionReasonCode, thêm revision action=deleted và audit. Không xóa vật lý expense/history. Mọi đường đọc trip/expense hiện có từ chối trip đã xóa. Chưa có share-link runtime; restore, trash UI và purge tự động chưa triển khai.

Mutation dùng session owner, Origin, UUID Idempotency-Key và expectedRevision không âm (trip hiện bắt đầu0). Tranh chấp409, không sở hữu404, input sai400. Mutation/revision/audit/key cùng transaction. Duplicate khóa nguồn bằng counter expenseRevision để xung đột sửa/xóa không tạo snapshot nửa cũ nửa mới; không thay revision/nội dung lịch nguồn. Delete đồng bộ với expense transaction qua document trip.

Retry cùng key/payload không lặp clone/delete trong thời gian key còn tồn tại (TTL24h). Delete replay kiểm tra owner của tombstone; duplicate replay kiểm tra nguồn và bản sao chưa xóa. Khác payload409. Không hồi sinh bản đã xóa. UI giữ key/body khi kết quả mạng chưa rõ, khóa input và có Thử lại thao tác. Reload làm mất key tạm; kiểm tra danh sách trước khi nhân bản lại.

## Data và giới hạn

Không thêm collection/provider/dependency. trips thêm clonedFromTripId optional ObjectId; trip_revisions action thêm deleted; audit thêm trip.deleted/trip.duplicated. Registry là tài liệu, chưa có raw MongoDB JSON Schema. Thực thi quyền trên server, không log tên/ghi chú/nội dung snapshot. Dữ liệu xóa mềm còn giữ trong DB; thời hạn purge chưa được triển khai. Đổi ngày không tự xác minh lại giá hoặc giờ mở cửa; customer cần xem lại tính phù hợp của lịch.
