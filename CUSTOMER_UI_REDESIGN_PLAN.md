# Customer UI redesign - integration checklist

Date: 2026-10-29. Working branch: `V2-ui-customer`.

## Authority and scope

The latest supplied contact sheet is the visual authority; the supplied React ZIP is a component/state reference. Where they differ, use the contact sheet: warm canvas, deep ocean text, gold CTA, five tabs with centered create action. Keep the existing GoEase logo and original blue penguin/sprite atlases. Prototype ratings, reviews, social providers, trip data and fake maps are not production features and are not copied.

- [x] Read supplied integration prompt, design system, screen map and React components.
- [x] Restore existing customer/mascot WIP from stash without dropping the backup.
- [x] Scoped customer palette, typography, inputs, tabs, cards, action menus and sheets.
- [x] New home layout: toolbar/search separate from image hero; four category shortcuts; destination grid; existing trips retained below.
- [x] Replace bottom navigation with home, explore, create, saved, account. Trips remain accessible from home and account, Goe from its existing launcher.
- [x] Official logo reused on auth/recovery; no prototype logo/mascot replacements.
- [x] Bundle DM Sans and Manrope locally with OFL license files. No runtime Google-font request.
- [x] New cost composition places donut beside actual known total; calculation and missing-cost disclosures retained.
- [x] Customer-only offline-reader styling, confirmation portal styling only when customer root exists.
- [x] No backend, API contract, admin component or admin theme edits.

## 38 states: implementation is not the same as browser acceptance

The UI column means the shared redesigned kit applies to this existing state. The Browser column is tracked separately; unchecked rows must not be reported as verified. No saved trip/profile/expense writes, delete/duplicate/share publishing or OTP requests are needed for visual inspection.

| #   | State from supplied SCREEN_MAP | Existing route/action                              | UI kit | Browser |
| --- | ------------------------------ | -------------------------------------------------- | ------ | ------- |
| 01  | Welcome / Onboarding           | `/welcome`                                         | [x]    | [x]     |
| 02  | Đăng nhập                      | `/login`                                           | [x]    | [x]     |
| 03  | Đăng ký                        | `/register`                                        | [x]    | [x]     |
| 04  | Quên mật khẩu                  | `/forgot-password`                                 | [x]    | [x]     |
| 05  | Đặt lại mật khẩu               | `/reset-password`                                  | [x]    | [x]     |
| 06  | Trang chủ Customer             | `/ (signed in)`                                    | [x]    | [x]     |
| 07  | Trang chủ khách                | `/ (guest)`                                        | [x]    | [x]     |
| 08  | Chọn điểm đến từ Home          | `/ -> destination sheet`                           | [x]    | [x]     |
| 09  | Khám phá                       | `/explore`                                         | [x]    | [x]     |
| 10  | Khám phá đã lọc                | `/explore -> category`                             | [x]    | [x]     |
| 11  | Bộ lọc khu vực                 | `/explore -> region`                               | [x]    | [x]     |
| 12  | Khám phá bản đồ                | `/explore -> map`                                  | [x]    | [x]     |
| 13  | Chi tiết địa điểm              | `/places/:id`                                      | [x]    | [x]     |
| 14  | Thêm địa điểm vào lịch trình   | `/places/:id -> add sheet`                         | [x]    | [x]     |
| 15  | Địa điểm đã lưu                | `/saved`                                           | [x]    | [x]     |
| 16  | Danh sách chuyến đi            | `/trips`                                           | [x]    | [x]     |
| 17  | Tạo chuyến đi                  | `/trips/new`                                       | [x]    | [x]     |
| 18  | Chọn điểm đến tạo chuyến       | `/trips/new -> destination sheet`                  | [x]    | [x]     |
| 19  | Workspace chuyến đi mới        | `/trips/new -> manual workspace`                   | [x]    | [x]     |
| 20  | Lịch trình chuyến đi           | `/trips/:id -> schedule`                           | [x]    | [x]     |
| 21  | Thêm hoạt động                 | `/trips/:id -> add stop`                           | [x]    | [x]     |
| 22  | Bản đồ chuyến đi               | `/trips/:id -> map`                                | [x]    | [x]     |
| 23  | Chi phí chuyến đi              | `/trips/:id -> cost -> paid`                       | [x]    | [x]     |
| 24  | Tổng quan ngân sách            | `/trips/:id -> cost -> estimate`                   | [x]    | [x]     |
| 25  | Tổng kết chuyến đi             | `/trips/:id -> summary`                            | [x]    | [x]     |
| 26  | Cài đặt chuyến đi              | `/trips/:id -> information`                        | [x]    | [x]     |
| 27  | Đổi ngày                       | `/trips/:id -> information -> dates`               | [x]    | [x]     |
| 28  | Chia sẻ                        | `/trips/:id -> information -> sharing`             | [x]    | [x]     |
| 29  | Thông tin offline              | `/trips/:id -> preparation -> offline`             | [x]    | [x]     |
| 30  | Nhân bản                       | `/trips/:id -> information -> duplicate`           | [x]    | [x]     |
| 31  | Xóa chuyến đi                  | `/trips/:id -> information -> delete confirmation` | [x]    | [x]     |
| 32  | Thùng rác                      | `/trips/trash`                                     | [x]    | [x]     |
| 33  | Xem chuyến được chia sẻ        | `/share`                                           | [x]    | [ ]     |
| 34  | Chat Goe dạng popup            | `floating Goe launcher`                            | [x]    | [x]     |
| 35  | Trợ lý AI Goe                  | `/goe`                                             | [x]    | [x]     |
| 36  | Tài khoản                      | `/account`                                         | [x]    | [x]     |
| 37  | Sửa hồ sơ                      | `/account -> profile`                              | [x]    | [x]     |
| 38  | Ngoại tuyến                    | `/offline.html`                                    | [x]    | [x]     |

## Acceptance checklist

- [ ] Full browser acceptance for all valid-data states; 37 render/open-close states inspected, public shared view still pending. Captures under `docs/customer-redesign/evidence`.
- [x] 36 DOM responsive measurements on six surfaces at 360, 375, 390, 414, 430 and desktop; no horizontal overflow. See browser-qa.json.
- [ ] Loading, empty, error, offline and keyboard focus checks.
- [x] Client build, repository lint, 16 mascot/controller regression tests and git diff --check passed.
- [ ] Admin read-only smoke check; static diff must remain empty for Admin/backend/contracts.
- [ ] Physical iOS/Android keyboard and touch acceptance (not inferred from desktop viewport).

## Existing limitations preserved

No fake Google/Apple login, ratings, notifications feed, turn-by-turn map, multi-destination AI or general AI chat is introduced for screenshot similarity. Existing validation, known-price qualifiers, citations, consent, ownership and role guards remain. Shared read-only view needs an existing valid public-share token; do not create a new public share merely for a screenshot.

Previous visual baseline: `docs/ui-customer-v2/evidence/` captures from the earlier design, not fresh before screenshots from this session. Current evidence is stored separately.

## Verification notes

Browser checks above mean rendered state / open-close inspection, not end-to-end acceptance of mutations. Screenshots are in `docs/customer-redesign/evidence`; filenames describe requested CSS viewport, and native browser captures can exclude scrollbar pixels. Current render screenshots cover the main feature groups; not every state has a fresh capture. Prior captures under `docs/ui-customer-v2/evidence` are the earlier visual baseline.

Remaining verification: a valid public shared-trip view (no existing token supplied), valid reset-password token/form and actual OTP/reset submission, physical phone/keyboard and full mutation acceptance. The reset screenshot covers the missing-token error state only. Public welcome/auth routes were inspected and captured in the main browser after the guest-profile screenshot API timed out. A temporary manual draft was inspected without saving; reloading reset its destination to the original blank default. No fake data or new public share was created. These are not claims of completed full acceptance.

No modified Admin files, backend, contracts, package manifests/lockfile or env files in this task. Admin visual smoke with an admin login is not claimed. Existing >500kB Vite bundle warning remains; no performance-budget claim. The original repository at C:/GoEase/go-ease-webapp is unchanged.

The restored customer/mascot WIP remains uncommitted together with this redesign on V2-ui-customer. The original stash backup is preserved. No push or merge was performed.
