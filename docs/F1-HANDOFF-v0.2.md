# GoEase — Bàn giao thiết kế và thực hiện F1 v0.2

## Trạng thái

Đây là tài liệu thiết kế, **chưa sửa repository, chưa tạo Mongoose models, chưa chạy migration/test tính năng**. Repo tham chiếu lúc viết ở commit `685552e`. Giữ nguyên F0, npm, localhost và MongoDB local.

Bản BR v0.1 ở repo còn để Q-02 mở; lựa chọn **Google + email/password** đã được user xác nhận sau đó, cần cập nhật thành confirmed. Chính sách quyền guest, account linking cụ thể, retention, commerce và các giới hạn ở bản v0.2 là đề xuất cần review, không biến thành approved chỉ vì copy file.

## 1. Đưa tài liệu vào repo

Gói này dùng tên `*-v0.2*.md` để không ghi đè `docs/BR.md` và `docs/ARCHITECTURE.md` của F0. Sau review, Codex cập nhật nguồn tài liệu chính để tránh hai bộ quy tắc mâu thuẫn; ghi changelog quyết định. `collection-registry-v0.2.json` là data dictionary machine-readable, **không phải JSON Schema hay migration chạy được**.

## 2. Thứ tự triển khai đề xuất

| Bước | Đầu ra kiểm chứng được | Không làm ở bước này |
|---|---|---|
| F1-A: reconcile design | Quyết định confirmed/proposed rõ, access policy, schema/index plan và event taxonomy | Không scaffold 40 models |
| F1-B: data primitives | Common metadata, request context, safe logger, audit writer/transaction helper, migration runner | Không sinh dashboard analytics hoặc ledger |
| F1-C: auth & identity | Email/password + Google, identity linking an toàn, session revoke, consent records, tests | Không dùng Google thật giả hoặc production bypass |
| CORE-1: trip persistence | Create/read/update/delete/restore theo owner, revision, idempotency, trip history + audit | Không có API chuyến private không auth |
| CORE-2: discovery/planner | Nguồn thật, proposal riêng, apply với expectedRevision, quota và aiRun trace | Không coi algorithm/template là AI thật |
| PLATFORM/COMMERCE | Mỗi task thêm module + schema/index + API + UI + audit/test tương ứng | Không code phần provider chưa có contract |

F1-B không được kéo dài thành framework nội bộ lớn. Dùng helper mỏng và một hành vi auth/trip thật để chứng minh. `outbox_events` chỉ cần khi email/notification/external delivery phát sinh; không cần queue server khác nếu worker nhỏ trên cùng backend phù hợp tải.

## 3. Prompt review thiết kế dành cho Codex

```text
Đọc AGENTS.md, README.md, docs/BR.md, docs/ARCHITECTURE.md và bộ tài liệu v0.2 vừa thêm.
Mục tiêu lần này là đối chiếu/chốt thiết kế, CHƯA triển khai toàn bộ nền tảng.

Quyết định bắt buộc từ chủ dự án:
- Viết mới hoàn toàn; React/Vite/TypeScript/Tailwind; Express/TypeScript.
- MongoDB local + Mongoose, Atlas sau; npm, package-lock.json, npm run dev.
- Web/API truy cập localhost; không tự mở IP LAN.
- Google và email/password; làm trực tiếp trên main, không branch/PR, không force-push.
- Có truy vết, audit và analytics theo mục đích, privacy/retention rõ.

Thực hiện:
1. Kiểm tra git status/head và giữ mọi local changes có sẵn.
2. Đối chiếu tài liệu v0.2 với source F0, nêu mâu thuẫn thật sự; không đổi stack.
3. Cập nhật các quyết định đã xác nhận (npm/localhost/login kép) trong BR/Architecture.
4. Giữ nhãn proposed cho những policy chưa được owner xác nhận.
5. Rà soát data dictionary: required theo state, indexes, unique/null/soft-delete,
   ownership, transaction/audit, migrations, retention và provider-specific gaps.
6. Đề xuất danh sách nhỏ models cần cho F1-C/CORE-1; không tạo 40 collection trống.
7. Báo cáo các quyết định còn ảnh hưởng trực tiếp đến hành vi trước khi code tính năng đó.

Không viết API/module product trong task review này. Không thay database đang chạy,
không drop/syncIndexes phá dữ liệu, không thêm secrets, không tự commit thay đổi người dùng.
Bàn giao diff tài liệu, schema map, bất nhất và task triển khai có tiêu chí nghiệm thu.
```

## 4. Checklist khi duyệt implementation sau review

- Check source git head hiện tại, đừng giả định vẫn đúng commit lúc soạn.
- Audit actor do server gán; lọc secrets và private text.
- `deletedAt` không bị quên ở aggregate/populate/update/export; restore không né unique.
- `revision` kiểm soát concurrent writes, `schemaVersion` cho migrations.
- Auth sessions/password/token không lộ client/log; expiry check không chờ TTL.
- Mọi unique index quan trọng có integration test race/duplicate và dữ liệu cleanup trong DB test riêng.
- Mongo local phải replica set nếu test transaction; standalone E2E cũ của F0 không chứng minh transaction nhiều document.
- Không thực hiện external provider call trong transaction retry callback.
- Build/lint/typecheck/unit/integration/browser chạy bằng npm; báo đúng phần blocked.
- Bằng chứng runtime là logs/test results thật; tạo tài liệu không được gắn nhãn feature PASS.

## 5. Điểm cần phê duyệt trước commerce/public launch

Chốt provider Google/email/AI/data/payment, quyền lưu source, public privacy notice, giới hạn/quota, mô hình thu tiền/merchant, cancellation/refund, retention và các nghĩa vụ áp dụng. Thiết kế envelope có thể đi trước; không giả định đã đủ pháp lý hoặc có API booking hợp lệ.
