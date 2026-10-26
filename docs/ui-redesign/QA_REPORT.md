# Customer UI QA — current mobile revision, 26/10/2026

## Scope and evidence

Repository C:/GoEaseDemo/goease-pwa, branch V1-ui-customer. Frontend presentation only; existing actions, business rules and API contracts preserved. Earlier screenshots in .local/customer-v1/ and unprefixed evidence files describe the superseded presentation.

Current screenshots and metrics: .local/customer-mobile-review/. Portable examples: evidence/current-home.png, current-trips.png, current-trip.png, current-explore.png, current-account.png, current-goe.png, current-budget.png and current-offline.png. Browser screenshots are not native-device captures. Scrollbars can reduce capture width by 15px. Metrics record CSS viewport and document width; visibleParagraphs is a rectangle count, not a reliable visibility/accessibility measurement.

## Current responsive review

- Phone matrix: 360×800, 375×667, 375×812, 390×844, 393×852, 412×915, 430×932. Home, trips, Explore, saved, account, Goe, trip timeline, setup and place detail captured across these sizes. No document horizontal overflow in recorded measurements. Horizontal day/chip strips scroll within their own containers.
- Selected tablet: home, trips, Explore and actual expenses at 768×1024. Landscape: trips and setup at 844×390. Screenshot review accompanied DOM measurements; this is not every state on every tablet size.
- Extra 375×667 states: login/register, trash, offline, cost tabs and floating chat. The offline heading now reads “Lịch trình offline” at 22px, and the downloaded demo trip remains listed after shell update.
- Place detail footer was previously offset by a legacy transform. Scoped transform:none corrects its bounds on all seven phone sizes.
- Action menus use native disclosure, close on item selection/blur/Escape, and switch above the trigger when space permits. Long menus scroll. Main task buttons are 44px; some secondary chips/controls are 36–40px. Do not claim universal 48px target compliance.

## Functional presentation checks

| Flow                    | Observed result                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Home destination picker | Search `ha noi` selects Hà Nội; no provider request needed                                                                        |
| Manual draft            | Add Công viên Thủ Lệ, remove via contextual menu, undo restores it; no DB save                                                    |
| Existing trip           | Day navigation, activity menu and notes disclosure work; dirty note shows save bar; “Bỏ thay đổi” discards the local edit         |
| Cost switch             | Dự kiến / Đã chi retains journey navigation; estimate 450,000 VND, per person 150,000; actual 125,000, actual remainder 2,875,000 |
| Place detail            | Description and citations expand; add-to-trip dialog opens; Escape closes and restores trigger focus; no add submitted            |
| Profile                 | Identity and profile/security settings rows open existing forms; no credential/upload changes                                     |
| Goe                     | Context and privacy controls accessible, composer and chat panel fit small viewport; no AI message submitted                      |
| Offline                 | Existing demo snapshot refreshed locally, shell cache version updated, trip retained; no cache clear/delete                       |
| Console                 | No error entries returned from the current review tab at final log check                                                          |

The current structure uses short app bars, horizontal trip cards, photo grids, compact timelines and on-demand explanations. Labels for AI imagery, missing prices and source data remain accessible. Cost calculations and incomplete-cost qualifications were not replaced by new business logic.

## Static verification

- Current client TypeScript/Vite build: PASS.
- Current ESLint: PASS.
- Changed-file Prettier and git diff --check: PASS.
- No server or packages source diff. Historical whole-workspace build/typecheck and 118 unit tests passed before this structural revision; they were not rerun as backend acceptance for UI-only changes.
- Vite main chunk remains about 1.13 MB minified / 308 kB gzip; no Lighthouse/performance-budget pass claimed.
- Full format:check has four unchanged pre-existing documentation failures listed in PROGRESS.md; unrelated files were not reformatted.

## Outstanding acceptance

No connected Android/iOS device. Real keyboard, system back, OS text scaling, screen reader and native safe-area behavior require physical-device review. Reduced-motion/focus/visualViewport CSS is implemented but is not proof of OS acceptance.

Not re-executed live: SMTP verification/recovery, successful reset, AI generation/proposal/apply, valid public recipient flow, persistent save/delete/restore/upload and production HTTPS offline installation/update. Existing source handlers remain, but these gates are not UI QA passes. Local demo cache refresh does not certify production offline behavior. C11 is partial until these checks are performed; no claim of full release readiness.

## 26/10/2026 — color, field and profile correction

Current review supersedes earlier color acceptance. Source changes: customer-ui.css, customer-shell.tsx, avatar-picker.tsx and offline presentation/cache version. No backend/API/schema/env changes.

- Corrected doubled focus boxes in destination search, discovery, Explore, chat composer and password wrappers. Runtime destination input border/outline are both 0px; outer field has one 1px border plus subtle focus shadow.
- Fixed avatar frame/image size mismatch and the inherited decorative profile stripe; actions wrap separately. Open profile and security forms reviewed, including focus/eye-control layout. No profile save, upload or password change submitted.
- Replaced olive/cream controls with white/cool-neutral surfaces, consistent teal selection and white-on-orange primary actions. Default pair calculates 4.52:1; hovered create action measured white on rgb(172,69,7), 5.82:1. This is not an accessibility audit of all text/images/states.
- Navigation: sliding top marker, filled selected icon, no icon bubble/bounce, and no false home marker on Goe. Existing routes remain unchanged. The floating launcher retains its transparent mascot, without a white circle.
- Exact CSS viewport 375×667 for all current polish states; browser screenshot width can exclude 15px scrollbar. Chrome DevTools 125% scales its preview; no claim of reproducing browser chrome or physical iPhone behavior.
- Inspected home, destination focus, Explore focus, saved, profile open, security focus, trips/list menu/empty, timeline, settings/preferences, budget, expenses, summary, setup/options, standalone/floating Goe, login/register, recovery/invalid reset, welcome, place detail/add sheet, trash and offline. Local metrics and PNGs: .local/customer-ui-polish/. No document horizontal overflow in these recorded states.
- Offline CSS follows the palette. Static shell cache v5 activated; existing downloaded demo trip remains listed. Its local copy was refreshed through the existing UI. No user cache deletion or server DB write.
- Current portable samples: evidence/polish-*.png. Older evidence is preserved as historical. No browser error entries at final review-tab log check.
- Build/lint/changed-file format/diff checks passed after changes. Bundle-size warning remains. Device/real keyboard, full screen-reader audit, live SMTP/AI/sharing and persisted mutations remain outside this UI QA. No push/merge.
