# F1-B — Bằng chứng kiểm tra local

Ngày: **22/10/2026**, Windows / PowerShell. Bắt đầu trên main sạch tại `a7068d07b799d5b0f7ff3a9a9a9a3a392daf4c46`. Viết mới theo F1-A; không nhập source cũ. F1-B chỉ request context, safe technical logger, audit_logs test-only và tests. F1-C/CORE-1 chưa triển khai.

## Môi trường quan sát

- Node.js 24.15.0, npm 11.12.1, MongoDB Community **8.2.6** tại `C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe`; không cài thêm phần mềm hay dependency.
- Web/API development trên localhost 5180/3000 đang chạy; MongoDB ứng dụng 127.0.0.1:27019 được giữ nguyên. Không kill tiến trình người dùng; tsx watch của dev có thể tự reload khi source thay đổi.
- Integration dùng 127.0.0.1:27021, replica set `f1b_<runId>`, DB `goease_f1b_test_<runId>`, dbpath mới trong `.local`. Guard kiểm tên/port/loopback/matching run ID và không production/application target. Đọc getCmdLineOpts để xác minh dbpath/set name process do harness tạo trước replSetInitiate, chờ hello primary.
- Browser regression dùng Edge headless, web/API **localhost:5181/3001** qua Vite proxy test-only, MongoDB standalone riêng 27020. Không thay cổng dev. Dữ liệu test/screenshot ở .local/test-results bị gitignore.

## Lệnh và kết quả

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:integration
$env:E2E_API_PORT = '3001'
$env:E2E_WEB_PORT = '5181'
npm run test:e2e
```

| Kiểm tra                 | Bằng chứng quan sát                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm test                 | PASS **8 tests**, 0 skip; gồm F0 HTTP/config/guard và F1-B HTTP/context/logging/startup/database/guard                                                               |
| npm run test:integration | PASS **9 tests** (test cha + 8 trường hợp con), 0 skip; MongoDB replica set thật, không mock                                                                         |
| npm run test:e2e         | PASS **3 browser tests**, health/proxy ở desktop 1280/mobile 390, requestId header, fault injection rồi retry, stop MongoDB test → 503 → restart → cùng API phục hồi |
| npm run build            | PASS contracts/server/client; đã quan sát trong chuỗi npm run test:e2e                                                                                               |
| npm run typecheck        | PASS strict web/API/contracts và tools/tests                                                                                                                         |
| npm run lint             | PASS, không warning ESLint                                                                                                                                           |

`npm run format:check` PASS toàn repository; kiểm tra riêng BR vốn nằm trong prettierignore cũng PASS. `git diff --check` PASS. Python check xác nhận F0-VERIFICATION giữ nguyên byte, dependency/lockfile/client runtime/contracts không đổi, 40 dictionary/registry mirrors và đường dẫn liên kết nội bộ hợp lệ. Một negative run cố ý bỏ MONGOD_BINARY đã trả lỗi (0 skip), xác minh integration không báo PASS khi thiếu điều kiện. Không xác nhận CI GitHub/deployment từ kết quả local.

## Nội dung đã kiểm chứng

### HTTP/context/logging

Test child process gọi createApp thật, capture stdout/stderr thực của ứng dụng. RequestId thiếu/sai/dài/duplicate được thay bằng UUIDv4, UUIDv4 uppercase được chuẩn hóa; response header khớp log. 12 request DB-health đồng thời giữ context before/after riêng qua await; context chỉ chứa tracing IDs, không user/role/actor. JSON validation 400/413, route không tồn tại 404 và error handler 500 đều có header, body F0 không lộ giá trị bí mật.

Scanner dùng sentinel trong nested body, query, unmatched path, Authorization/Cookie/actor headers, Error.message/cause, startup configuration và database URI không hợp lệ. Không có sentinel trong output ứng dụng hoặc audit đã lưu; từng dòng ứng dụng là JSON hợp lệ, stderr child rỗng. Unknown fields không được serialize; known fields sai kiểu sinh event cố định. Sink ném lỗi chỉ được gọi một lần, không log đệ quy. Runtime server không còn console/error-object output ngoài logger. Tooling Playwright/Vite có warning môi trường màu/config-loader tương lai; đó không phải dữ liệu request hoặc kết quả audit.

### MongoDB thật

Lần PASS cuối sau chỉnh harness path: replica set `f1b_b64751a146ad46dc9be993806be01e1c`, dbpath `.local/f1b-mongo-sxyY9u`. Bằng chứng từ assert trong integration suite:

1. Đọc indexes từ database thật: unique eventId và unique operationId/action/entityType/entityId, cùng index entity/time, actor/time, requestId. Không TTL.
2. Fixture native-driver test + audit cùng ClientSession commit: cả hai tồn tại; audit có APPEND metadata, actor/source system test, không updatedAt/deletedAt/__v.
3. Throw sau hai insert: fixture và audit đều không tồn tại sau rollback.
4. Thêm một unique index **chỉ trong DB test** để gây lỗi ghi audit E11000 thật ở requestId: lỗi không bị nhầm thành dedupe; transaction rollback fixture. Extra index test được gỡ sau ca này.
5. Sequential retry với requestId/correlationId khác: cùng eventId, giữ bản đầu. 12 append đồng thời: đúng một audit event.
6. Cùng dedupe key khác outcome/reason bị AuditConflictError; hai payload xung đột chạy đồng thời chỉ một thành công.
7. Race giữa transactions dùng operationId ổn định: nếu E11000 abort thì caller retry toàn transaction sau abort, cuối cùng một event; không fallback ngoài session.
8. Forged actor/source, private text/nested secrets, action/category/entity ngoài taxonomy bị từ chối và không được lưu. Service không có update/delete API.

Các lỗi trong quá trình phát triển đã được sửa trước PASS: option Unix socket không có trên mongod Windows; tên field getCmdLineOpts replication.replSet; Mongoose nested versionKey gây StrictModeError khi rollback (tắt versionKey cả nested APPEND); Vite test config cần .mts để load ESM plugins. Không thay dependency hoặc sửa node_modules.

## Phạm vi và giới hạn

- Chỉ model mới audit_logs; fixture không là model sản phẩm và không được runtime import. App startup không tạo collection/index/probe, không endpoint audit, không fake login/default actor.
- Audit service chỉ mở probe ở DB test loopback 27021 với tên được guard. Chưa có user/admin/provider action implementation hoặc consumer sản phẩm; baseline rộng vẫn là thiết kế.
- Chưa production-ready: chưa xác minh quyền DB insert/read-only trong production, retention/purge/legal hold, tamper evidence hoặc DBA controls, auth authorization hay tải thực. Không có TTL hoặc policy thời hạn production tự chọn.
- Technical logging cố ý bỏ bản ghi nếu sink lỗi; không có remote logging/rotation/alerting infrastructure. Audit bắt buộc không dùng cơ chế best-effort này và lỗi vẫn throw.
- Không chạy migration/syncIndexes/drop database; không đổi rs0 ứng dụng, không provider email/Google/AI/payment, không analytics/outbox/migration runner/UI mới.
- F0-VERIFICATION giữ nguyên bằng chứng lịch sử. Commit SHA/push được báo sau khi quan sát Git; không ghi SHA tự tham chiếu vào commit.
