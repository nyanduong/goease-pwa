# Nợ kỹ thuật trước release

| Hạng mục | Trạng thái |
| --- | --- |
| GitHub CI/CD | Tạm hoãn đến trước release theo quyết định của chủ dự án. Trạng thái CI hiện tại không chặn thiết kế hoặc phát triển local. |
| Prettier baseline | Tạm hoãn xử lý đến trước release. Lần kiểm tra trước ghi nhận 16 file có cảnh báo. Trong đó, 15 lỗi tái hiện từ Git trước cleanup và mục còn lại là CRLF có sẵn của `package.json` trong checkout Windows. |

Tiếp tục chạy typecheck, lint, test và build local phù hợp với từng task.

## Đóng Documentation Reset

Phạm vi cleanup đã hoàn thành theo kết quả kiểm tra đã ghi nhận tại hai mốc `8d31de7` và `24f17a0`.

- Các trạng thái phê duyệt mâu thuẫn và câu hỏi nghiệp vụ còn mở được theo dõi trong [DECISIONS.md](DECISIONS.md).
- Hai vị trí có địa chỉ email tài khoản cá nhân được ghi nhận để xử lý riêng. Một vị trí thuộc lịch sử của `docs/AI-PLANNER.md`, vị trí còn lại thuộc ghi chú vòng khảo sát Stitch.
