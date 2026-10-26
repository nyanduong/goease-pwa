# Progress — 26/10/2026

- Repository: C:/GoEaseDemo/goease-pwa. Branch: V1-ui-customer, baseline main 9ce30dc.
- Current revision replaces the earlier large editorial presentation with compact task screens. Earlier evidence in .local/customer-v1/ is historical, not acceptance of this revision.
- C01–C10: implemented and reviewed locally. C11: local browser/static review complete; physical-device and live-provider gates remain unverified.
- Structure changed in home, trip list, trip detail, cost, account, Goe and place detail. Primary actions stay visible; secondary actions use contextual menus and disclosures. Existing handlers, validation, dirty guards and calculations remain.
- Current client build (TypeScript/Vite), ESLint and changed-file format/diff checks are recorded in QA_REPORT.md. Historical 118-test result predates this structural revision and is not a new test run.
- Current evidence: .local/customer-mobile-review/metrics.json and PNGs. Portable current samples are in evidence/current-*.png.
- Browser review used seven phone viewports, selected tablet/landscape screens, and local demo data. Device, real keyboard, screen reader, SMTP, AI proposals, production sharing and production HTTPS service-worker acceptance are not certified.
- The existing demo offline snapshot was refreshed locally through its normal UI. Static offline shell cache version was bumped so updated CSS/HTML appears; cached trip remains present. No cache deletion or server DB write was performed for this revision.
- No server/contracts/database/env edits, email, AI request, upload, public share or credential changes. Mechanical admin icon imports are part of the earlier one-pack migration; admin layout was not redesigned here.
- Full-repo format check has four pre-existing unchanged documentation failures: ADMIN-EDITOR.md, DEMO-CATALOG-2026-10-26.md, MANUAL-CURATION-2026-10-26.md and ONE-COVER-MEDIA.md. These files remain untouched.
- No commit, push or merge performed. Vite :5180 and API :3000 remain available for review.

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

## Remote sync — origin/main 302d4a2

Fetched 8 new commits and fast-forwarded V1-ui-customer from 9ce30dc to 302d4a2 before restoring the UI work. Seven overlapping files were reconciled individually. Local compact layouts, Phosphor icons, palette, focus fixes, profile and mascot were retained; upstream destination covers, catalog image selection, photo retry/loading and AI server updates were preserved. The compact cost screen keeps its layout rather than restoring the upstream decorative hero.

Full workspace build and ESLint passed; npm test passed 121/121 tests. No unresolved paths or conflict markers remain. Main UI at 375×667 was reloaded and reviewed; catalog photos stay bounded in timeline thumbnails. HEAD and origin/main have zero divergence; local UI edits remain uncommitted on V1-ui-customer. Backup stash beda70a75453696a44ede86dd995226698be2e56 is retained. No push/merge to remote main or DB mutation. Existing Vite/API continue running; DB health is connected.
